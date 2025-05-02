const form = document.getElementById("form");
const status = document.getElementById("status");

form.addEventListener("submit", async e => {
    e.preventDefault();
    status.textContent = "Processando…";

    try {
        const url = document.getElementById("url").value;
        const quality = document.getElementById("quality").value;

        const res = await fetch("/download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, quality }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro desconhecido");

        status.textContent = "Preparando download…";

        /* dispara download sem sair da página */
        const a = document.createElement("a");
        a.href = data.fileUrl;
        a.download = "";            // força “Save as…”
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        status.textContent = "Download iniciado!";
    } catch (err) {
        status.textContent = err.message;
    }
});