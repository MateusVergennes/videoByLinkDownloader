# ---------------------- Dockerfile --------------------------
    FROM node:20-slim

    # --- build-arg opcional p/ driblar rate-limit do GitHub -----
    ARG GH_TOKEN
    ENV GH_TOKEN=${GH_TOKEN}
    
    # --- pula verificação de Python (caso queira contêiner slim)-
    ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1
    
    # --- pacotes mínimos + python3 ------------------------------
    RUN apt-get update && \
        apt-get install -y --no-install-recommends \
            ca-certificates \
            python3         \  # ← satisfaz youtube-dl-exec
        && rm -rf /var/lib/apt/lists/*
    
    # --- código -------------------------------------------------
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci --omit=dev          # usa GH_TOKEN se existir
    
    COPY . .
    
    # --- variáveis do app --------------------------------------
    ENV PORT=3000 \
        DOWNLOAD_DIR=/tmp
    
    EXPOSE 3000
    CMD ["node", "server.js"]
    # -----------------------------------------------------------    