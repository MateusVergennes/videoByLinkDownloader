# Video-by-Link Downloader  

[![Live Demo](https://img.shields.io/badge/Live-Demo-online-4ade80?style=for-the-badge&logo=vercel&logoColor=white)](https://videobylinkdownloader.onrender.com)

Aplicação full-stack em **Node 20 + Express** que faz download de vídeos públicos do YouTube já em `.mp4`, com áudio e vídeo mesclados via **yt-dlp + ffmpeg**.  
Interface estática em HTML/CSS/JS (tema escuro), nenhuma dependência de framework no client.

---

## ✨ Funcionalidades

* Campo para colar o link + seletor de qualidade **(Leve / Média / Alta)**  
* Download começa imediatamente sem sair da página  
* Arquivo é salvo em `/tmp` (ou `output/`) e **apagado** ao término do download  
* Faxina automática a cada hora (remove sobras > 10 min)  
* Dark theme responsivo, zero dependências de CSS externo  

---

## 🚀 Como rodar

### 1. Via **npm / Node**

> Requer **Node ≥ 18** (LTS 20 recomendado)

```bash
git clone https://github.com/<sua-conta>/video-by-link-downloader.git
cd video-by-link-downloader

# instala dependências, inclusive yt-dlp e ffmpeg-static
npm ci

# inicia em http://localhost:3000
node server.js
```

### Variáveis opcionais

| Variável de ambiente             | Padrão         | Para quê serve                                                                    |
|----------------------------------|----------------|-----------------------------------------------------------------------------------|
| `PORT`                           | `3000`         | Porta que o Express escuta. O Dockerfile expõe **3000**, mas você mapeia fora.    |
| `DOWNLOAD_DIR`                   | `./output`     | Pasta temporária onde os `.mp4` são salvos até o fim do download.                 |
| `GH_TOKEN`                       | _(vazio)_      | Personal-Access-Token do GitHub para contornar *API rate-limit* do `youtube-dl-exec` no **npm install**. |
| `YOUTUBE_DL_SKIP_PYTHON_CHECK`   | `1`            | Pula a checagem de “python” durante o *postinstall* de `youtube-dl-exec`; já definido no Dockerfile. |
| `QUALITY_MAP_LOW/MEDIUM/HIGH`    | hard-coded     | Se quiser alterar filtros de resolução, basta editar o objeto `QUALITY_MAP` em `server.js`. |

---

## ☁️ Deploy gratuito (Render)

### A. Usar **Dockerfile** (recomendado)

1. **New → Web Service → Docker**  
2. *Build Args* (opcional)  
   * `GH_TOKEN=<seu-token-github>`  
3. Deploy e aguarde; URL final será algo como:

   `https://videobylinkdownloader.onrender.com`

### B. Usar ambiente **Node** (sem Docker)

1. Crie serviço **Node**.  
2. *Build Command*: `npm ci`  
3. *Start Command*: `node server.js`  
4. Adicione a env `GH_TOKEN` (PAT GitHub) para evitar rate-limit.

---

## 🗂️ Customizações rápidas

* **Intervalo da faxina** → edite `ONE_HOUR` em `server.js`.  
* **Idade mínima para deleção** → edite `TEN_MIN`.  
* **Tema** → altere cores em `public/styles.css`.  
* **Suprimir logs do yt-dlp** → adicione/remova `quiet: true` no objeto de opções.

---

## 🤔 FAQ

* **“Baixou só áudio ou só vídeo”**  
  Verifique se o `ffmpeg` foi encontrado (`ffmpeg-static` já embute o binário).  
* **“Build falhou por rate-limit do GitHub”**  
  Defina a variável `GH_TOKEN` com um PAT (escopo `public_repo`).  
* **“Docker build quebra em python check”**  
  O Dockerfile já instala `python3` **e** define `YOUTUBE_DL_SKIP_PYTHON_CHECK=1`.  
* **“Arquivos ficam ocupando espaço”**  
  A faxina roda 1×/h e apaga tudo > 10 min que não esteja sendo baixado.  
  Ajuste `TEN_MIN` ou crie um cron no host, se precisar.

---

Feito! Clone, `npm ci` ou `docker build`, e **curta seus vídeos offline**.  
Contribuições são bem-vindas – abra uma _issue_ ou mande PR 🚀