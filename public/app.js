const form = document.getElementById("form");
const status = document.getElementById("status");
const button = form.querySelector("button");
const list = document.getElementById("jobs");

const rows = new Map();          // id -> { el, state }

/* ---------- formatação ------------------------------------------------- */
const fmtBytes = b => {
    if (b == null) return "?";
    const u = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return `${b.toFixed(i ? 1 : 0)} ${u[i]}`;
};

const fmtTime = s => {
    if (s == null) return "--:--";
    s = Math.round(s);
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = s % 60;
    const pad = n => String(n).padStart(2, "0");
    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
};

function saveFile(fileUrl) {
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = "";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

/* ---------- linha de cada job ----------------------------------------- */
function createRow(id) {
    const li = document.createElement("li");
    li.className = "job";
    li.innerHTML = `
        <div class="job-head">
            <span class="job-title"></span>
            <button type="button" class="job-cancel" title="Cancelar">✕</button>
        </div>
        <div class="bar"><div class="bar-fill"></div></div>
        <div class="job-info"></div>`;
    li.querySelector(".job-cancel").onclick = () =>
        fetch(`/cancel/${id}`, { method: "POST" });
    list.prepend(li);
    return li;
}

const ACTIVE = ["queued", "starting", "downloading", "merging"];

function render(j) {
    if (j.state === "removed") {
        rows.get(j.id)?.el.remove();
        rows.delete(j.id);
        return;
    }

    let row = rows.get(j.id);
    const isNew = !row;
    if (isNew) {
        row = { el: createRow(j.id), state: null };
        rows.set(j.id, row);
    }
    const el = row.el;
    const fill = el.querySelector(".bar-fill");
    const info = el.querySelector(".job-info");

    el.dataset.state = j.state;
    el.querySelector(".job-title").textContent = j.title || j.url;
    el.querySelector(".job-cancel").hidden = !ACTIVE.includes(j.state);
    fill.style.width = `${(j.percent || 0).toFixed(1)}%`;

    switch (j.state) {
        case "queued":
            info.textContent = "Na fila…";
            break;
        case "starting":
            info.textContent = "Iniciando…";
            break;
        case "downloading": {
            const label = j.part === 1 ? "Vídeo" : j.part === 2 ? "Áudio" : "Baixando";
            info.textContent =
                `${label} ${j.percent.toFixed(1)}% · ${fmtBytes(j.downloaded)} / ${fmtBytes(j.total)}` +
                ` · ${j.speed ? fmtBytes(j.speed) + "/s" : "—"} · faltam ${fmtTime(j.eta)}`;
            break;
        }
        case "merging":
            info.textContent = "Juntando vídeo + áudio…";
            break;
        case "done":
            info.innerHTML = "";
            info.append("Pronto! ");
            const a = document.createElement("a");
            a.href = j.fileUrl;
            a.download = "";
            a.textContent = "Salvar (se não baixou)";
            info.append(a);
            // só dispara o download automático se vimos a transição ao vivo
            if (!isNew && row.state !== "done") saveFile(j.fileUrl);
            break;
        case "error":
            info.textContent = j.error || "Falha no download.";
            break;
        case "canceled":
            info.textContent = "Cancelado.";
            break;
    }
    row.state = j.state;
}

/* ---------- stream de eventos (um só p/ todos os jobs) ------------------ */
const es = new EventSource("/events");
es.onmessage = ev => render(JSON.parse(ev.data));

/* ---------- downloads simultâneos (configurável) ----------------------- */
const parallelInput = document.getElementById("parallel");

es.addEventListener("config", ev => {
    const { parallel } = JSON.parse(ev.data);
    if (document.activeElement !== parallelInput) parallelInput.value = parallel;
});

parallelInput.addEventListener("change", async () => {
    const value = Math.min(10, Math.max(1, Math.round(Number(parallelInput.value) || 3)));
    parallelInput.value = value;
    try {
        const res = await fetch("/parallel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        status.className = "";
        status.textContent = `Agora baixando até ${data.parallel} por vez.`;
    } catch (err) {
        status.className = "error";
        status.textContent = err.message;
    }
});

/* ---------- envio do formulário --------------------------------------- */
form.addEventListener("submit", async e => {
    e.preventDefault();
    status.className = "";

    const urls = document.getElementById("urls").value
        .split(/\s+/).map(s => s.trim()).filter(Boolean);
    const quality = document.getElementById("quality").value;

    if (!urls.length) return;

    button.disabled = true;
    try {
        const res = await fetch("/download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ urls, quality }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro desconhecido");

        status.textContent = `${data.ids.length} link(s) adicionado(s) à fila.`;
        document.getElementById("urls").value = "";
    } catch (err) {
        status.className = "error";
        status.textContent = err.message;
    } finally {
        button.disabled = false;
    }
});
