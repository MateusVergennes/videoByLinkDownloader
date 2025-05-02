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