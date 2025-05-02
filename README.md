# Video-by-Link Downloader  

Aplicação full-stack em **Node 20 + Express** que faz download de vídeos públicos do YouTube já em `.mp4`, com áudio e vídeo mesclados via **yt-dlp + ffmpeg**.  
Interface estática em HTML/CSS/JS (tema escuro), nenhuma dependência de framework no client.

![2025-05-01 23-03-16](https://github.com/user-attachments/assets/690472b0-f37c-4018-a5f3-7a91a940a8ae)


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

### Via **Docker**

```bash
# Construir a imagem
docker build -t vblink .

# Executar, expondo a porta 3000 do container na 4000 local
docker run --rm -p 4000:3000 vblink
```
# Depois abra http://localhost:4000 no navegador


### Variáveis opcionais

| Variável de ambiente             | Padrão         | Para quê serve                                                                    |
|----------------------------------|----------------|-----------------------------------------------------------------------------------|
| `PORT`                           | `3000`         | Porta que o Express escuta. O Dockerfile expõe **3000**, mas você mapeia fora.    |
| `DOWNLOAD_DIR`                   | `./output`     | Pasta temporária onde os `.mp4` são salvos até o fim do download.                 |
| `GH_TOKEN`                       | _(vazio)_      | Personal-Access-Token do GitHub para contornar *API rate-limit* do `youtube-dl-exec` no **npm install**. |
| `YOUTUBE_DL_SKIP_PYTHON_CHECK`   | `1`            | Pula a checagem de “python” durante o *postinstall* de `youtube-dl-exec`; já definido no Dockerfile. |
| `QUALITY_MAP_LOW/MEDIUM/HIGH`    | hard-coded     | Se quiser alterar filtros de resolução, basta editar o objeto `QUALITY_MAP` em `server.js`. |

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
