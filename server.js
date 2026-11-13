/* ----------------------------- server.js --------------------------------
   • Express + yt-dlp + ffmpeg-static
   • Fila de downloads (vários links, N simultâneos)
   • Progresso em tempo real via SSE (um único stream p/ todos os jobs)
   • Nome do arquivo = título do YouTube (sanitizado p/ Windows)
   • Cancelamento com limpeza das sobras (.part, .ytdl, fragmentos…)
   • Faxina geral a cada 1 h (remove sobras >10 min que não pertençam a jobs)
   ---------------------------------------------------------------------- */

import express from "express";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import ytDlp from "youtube-dl-exec";
import ffmpeg from "ffmpeg-static";

const app = express();
const PORT = process.env.PORT || 3000;
const PARALLEL_LIMIT = { min: 1, max: 10 };
let maxParallel = Number(process.env.MAX_PARALLEL) || 3;   // ajustável pela página

const ONE_HOUR = 60 * 60 * 1_000;
const TEN_MIN = 10 * 60 * 1_000;

/* ----------- diretório temporário -------------------------------------- */
const downloadDir = process.env.DOWNLOAD_DIR
    ? path.resolve(process.env.DOWNLOAD_DIR)
    : path.join(process.cwd(), "output");

fs.mkdirSync(downloadDir, { recursive: true });

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

/* -------- mapa de qualidades ------------------------------------------- */
const QUALITY_MAP = {
    low: "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]",
    medium: "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]",
    high: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]",
    // qualidade máxima real (1440p/4K/8K, VP9/AV1) — remuxado para mp4
    max: "bestvideo*+bestaudio/best",
};

const YT_REGEX = /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.?be)\//;

/* -------- utilidades ---------------------------------------------------- */
const num = v => (v === undefined || v === "NA" || v === "None" ? null : Number(v));

/** Título -> nome de arquivo válido no Windows */
function safeName(title) {
    let s = String(title || "")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")   // proibidos no Windows
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 150)
        .replace(/[. ]+$/, "");                   // não pode terminar em . ou espaço
    if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) s = `_${s}`;
    return s || "video";
}

/** Apaga todos os arquivos de um job (final, .part, .ytdl, fragmentos…) */
function removeJobFiles(id) {
    const prefix = `video_${id}`;
    fs.readdir(downloadDir, (err, files) => {
        if (err) return;
        for (const f of files)
            if (f.startsWith(prefix)) fs.unlink(path.join(downloadDir, f), () => { });
    });
}

/** Mata o processo e os filhos (yt-dlp -> ffmpeg) */
function killTree(child) {
    if (!child?.pid) return;
    if (process.platform === "win32")
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGKILL");
}

/* -------- jobs + fila --------------------------------------------------- */
const jobs = new Map();               // id -> job
const sseClients = new Set();         // respostas SSE abertas
const activeStreams = new Set();      // arquivos sendo enviados ao navegador

function snapshot(job) {
    const { child, ...data } = job;
    return data;
}

function broadcast(job) {
    const msg = `data: ${JSON.stringify(snapshot(job))}\n\n`;
    for (const res of sseClients) res.write(msg);
}

function update(job, patch) {
    Object.assign(job, patch);
    broadcast(job);
}

function finish(job, patch) {
    update(job, patch);
    // some da lista (e libera os arquivos p/ a faxina) depois de 1 h
    setTimeout(() => {
        jobs.delete(job.id);
        broadcast({ id: job.id, state: "removed" });
    }, ONE_HOUR);
    pump();
}

const runningCount = () =>
    [...jobs.values()].filter(j => j.state === "starting" || j.state === "downloading" || j.state === "merging").length;

function pump() {
    for (const job of jobs.values()) {
        if (runningCount() >= maxParallel) return;
        if (job.state === "queued") run(job);
    }
}

function run(job) {
    const filePath = path.join(downloadDir, job.filename);
    update(job, { state: "starting" });

    const child = ytDlp.exec(job.url, {
        output: filePath,
        format: QUALITY_MAP[job.quality],
        mergeOutputFormat: "mp4",
        ffmpegLocation: ffmpeg,          // junta vídeo + áudio
        noCheckCertificate: true,
        noWarnings: true,
        restrictFilenames: true,
        noPlaylist: true,
        concurrentFragments: 8,          // baixa fragmentos em paralelo
        httpChunkSize: "10M",            // evita throttling do YouTube
        newline: true,
        // título vai por último porque pode conter "|"
        progressTemplate:
            "download:PROG|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|" +
            "%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s|%(info.title)s",
    });
    job.child = child;

    let buf = "";
    child.stdout.on("data", chunk => {
        buf += chunk.toString();
        const lines = buf.split(/\r?\n/);
        buf = lines.pop();
        for (const line of lines) {
            if (line.startsWith("PROG|")) {
                const [, done, total, est, speed, eta, ...titleParts] = line.split("|");
                const t = num(total) ?? num(est);
                const d = num(done) ?? 0;
                const title = titleParts.join("|");
                update(job, {
                    state: "downloading",
                    title: job.title || (title && title !== "NA" ? title : null),
                    downloaded: d,
                    total: t,
                    percent: t ? Math.min(100, (d / t) * 100) : job.percent,
                    speed: num(speed),
                    eta: num(eta),
                });
            } else if (line.includes("Destination:")) {
                update(job, { part: job.part + 1, percent: 0, downloaded: 0 });
            } else if (line.startsWith("[Merger]")) {
                update(job, { state: "merging", percent: 100, eta: null, speed: null });
            }
        }
    });

    let stderr = "";
    child.stderr.on("data", c => { stderr += c.toString(); });

    child.on("close", code => {
        job.child = null;
        if (job.state === "canceled") {
            removeJobFiles(job.id);
            return pump();
        }
        if (code === 0 && fs.existsSync(filePath)) {
            finish(job, { state: "done", percent: 100, speed: null, eta: null, fileUrl: `/downloads/${job.filename}` });
        } else {
            console.error(`[${job.id}] ${job.url}\n${stderr}`);
            removeJobFiles(job.id);
            const msg = /private|unavailable|removed/i.test(stderr)
                ? "Vídeo indisponível ou privado."
                : "Falha no download.";
            finish(job, { state: "error", error: msg });
        }
    });
    child.catch?.(() => { });           // erro já tratado no "close"
}

/* POST /download  { urls: [...], quality }  -> enfileira ----------------- */
app.post("/download", (req, res) => {
    const { quality = "high" } = req.body;
    let { urls, url } = req.body;
    if (!urls) urls = url ? [url] : [];
    if (!Array.isArray(urls)) urls = String(urls).split(/\s+/);

    urls = [...new Set(urls.map(u => String(u).trim()).filter(Boolean))];

    if (!urls.length)
        return res.status(400).json({ error: "Nenhum link informado." });

    if (!QUALITY_MAP[quality])
        return res.status(400).json({ error: "Qualidade inválida." });

    const created = urls.map(u => {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const job = {
            id, url: u, quality, filename: `video_${id}.mp4`,
            state: YT_REGEX.test(u) ? "queued" : "error",
            error: YT_REGEX.test(u) ? null : "URL inválida.",
            title: null, part: 0, percent: 0, downloaded: 0, total: null, speed: null, eta: null,
            createdAt: Date.now(),
        };
        jobs.set(id, job);
        broadcast(job);
        return job.id;
    });

    pump();
    res.json({ ids: created });
});

/* POST /cancel/:id ------------------------------------------------------- */
app.post("/cancel/:id", (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: "Job não encontrado." });

    if (job.state === "queued") {
        finish(job, { state: "canceled" });
    } else if (["starting", "downloading", "merging"].includes(job.state)) {
        update(job, { state: "canceled", speed: null, eta: null });
        killTree(job.child);            // o "close" apaga as sobras e chama pump()
    }
    res.json({ ok: true });
});

/* POST /parallel { value }  -> quantos downloads simultâneos ------------- */
const configMsg = () => `event: config\ndata: ${JSON.stringify({ parallel: maxParallel })}\n\n`;

app.post("/parallel", (req, res) => {
    const v = Math.round(Number(req.body?.value));
    if (!Number.isFinite(v) || v < PARALLEL_LIMIT.min || v > PARALLEL_LIMIT.max)
        return res.status(400).json({ error: `Use um valor entre ${PARALLEL_LIMIT.min} e ${PARALLEL_LIMIT.max}.` });

    maxParallel = v;
    for (const r of sseClients) r.write(configMsg());
    pump();                             // se aumentou, já puxa mais da fila
    res.json({ parallel: maxParallel });
});

/* GET /events  -> SSE com o estado de todos os jobs ---------------------- */
app.get("/events", (req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
    });
    res.write(configMsg());
    for (const job of jobs.values())
        res.write(`data: ${JSON.stringify(snapshot(job))}\n\n`);

    sseClients.add(res);
    const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
    req.on("close", () => {
        clearInterval(ping);
        sseClients.delete(res);
    });
});

/* GET /downloads/:file  -------------------------------------------------- */
app.get("/downloads/:file", (req, res) => {
    const file = path.basename(req.params.file);
    const filePath = path.join(downloadDir, file);

    if (!fs.existsSync(filePath))
        return res.status(404).json({ error: "Arquivo não encontrado." });

    const job = [...jobs.values()].find(j => j.filename === file);
    const name = `${safeName(job?.title)}.mp4`;
    const ascii = name.replace(/[^\x20-\x7E]/g, "_");

    activeStreams.add(file);           // marca como “em uso”

    const stat = fs.statSync(filePath);
    res.writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Content-Length": stat.size,
        "Cache-Control": "no-store",
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    const cleanup = () => {
        activeStreams.delete(file);
        fs.unlink(filePath, () => { });   // remove arquivo
    };
    stream.on("close", cleanup);
    stream.on("error", cleanup);
});

/* ----------------------------------------------------------------------- */
app.listen(PORT, () => console.log(`🚀  http://localhost:${PORT}`));

/* --- faxina geral ------------------------------------------------------- */
function sweepOutput() {
    fs.readdir(downloadDir, (err, files) => {
        if (err) return;
        files.forEach(file => {
            if (activeStreams.has(file)) return;
            // arquivos de jobs ainda conhecidos (rodando, na fila ou aguardando envio)
            const id = file.match(/^video_([a-z0-9]+)/)?.[1];
            if (id && jobs.has(id)) return;

            const full = path.join(downloadDir, file);
            fs.stat(full, (e, st) => {
                if (e) return;
                if (Date.now() - st.mtimeMs > TEN_MIN)
                    fs.unlink(full, () => { });
            });
        });
    });
}

/* executa já na largada */
sweepOutput();

/* e depois a cada 1 h */
setInterval(sweepOutput, ONE_HOUR);
/* ----------------------------------------------------------------------- */
