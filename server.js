/* ----------------------------- server.js --------------------------------
   • Express + yt-dlp + ffmpeg-static
   • Seleção de qualidade (low / medium / high)
   • Auto-delete individual ao fim do download
   • Faxina geral a cada 1 h (remove sobras >10 min e não em uso)
   ---------------------------------------------------------------------- */

import express from "express";
import path from "node:path";
import fs from "node:fs";
import ytDlp from "youtube-dl-exec";
import ffmpeg from "ffmpeg-static";

const app = express();
const PORT = process.env.PORT || 3000;

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
};

/* -------- rastreamento de streams ativos ------------------------------- */
const activeStreams = new Set();      // nomes de arquivos ainda em uso

/* POST /download  -------------------------------------------------------- */
app.post("/download", async (req, res) => {
    const { url, quality = "high" } = req.body;
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\//;

    if (!url || !ytRegex.test(url))
        return res.status(400).json({ error: "URL inválida." });

    if (!QUALITY_MAP[quality])
        return res.status(400).json({ error: "Qualidade inválida." });

    const filename = `video_${Date.now()}.mp4`;
    const filePath = path.join(downloadDir, filename);

    try {
        await ytDlp(url, {
            output: filePath,
            format: QUALITY_MAP[quality],
            mergeOutputFormat: "mp4",
            ffmpegLocation: ffmpeg,          // junta vídeo + áudio
            noCheckCertificate: true,
            noWarnings: true,
            addHeader: [
                "referer:youtube.com",
                "user-agent:googlebot",
            ],
            restrictFilenames: true,
            quiet: true,
        });

        res.json({ fileUrl: `/downloads/${filename}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Falha no download." });
    }
});

/* GET /downloads/:file  -------------------------------------------------- */
app.get("/downloads/:file", (req, res) => {
    const file = req.params.file;
    const filePath = path.join(downloadDir, file);

    if (!fs.existsSync(filePath))
        return res.status(404).json({ error: "Arquivo não encontrado." });

    activeStreams.add(file);           // marca como “em uso”

    const stat = fs.statSync(filePath);
    res.writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${file}"`,
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

/* -------- faxina geral a cada 1 h -------------------------------------- */
/* --- faxina geral ------------------------------------------------------- */
const ONE_HOUR = 60 * 60 * 1_000;
const TEN_MIN  = 10 * 60 * 1_000;

function sweepOutput() {
  fs.readdir(downloadDir, (err, files) => {
    if (err) return;
    files.forEach(file => {
      if (activeStreams.has(file)) return;
      const full = path.join(downloadDir, file);
      fs.stat(full, (e, st) => {
        if (e) return;
        if (Date.now() - st.mtimeMs > TEN_MIN)
          fs.unlink(full, () => {});
      });
    });
  });
}

/* executa já na largada */
sweepOutput();

/* e depois a cada 1 h */
setInterval(sweepOutput, ONE_HOUR);
/* ----------------------------------------------------------------------- */
