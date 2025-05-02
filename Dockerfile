FROM node:20-slim

ARG GH_TOKEN
ENV GH_TOKEN=${GH_TOKEN}

ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=3000 \
    DOWNLOAD_DIR=/tmp

EXPOSE 3000
CMD ["node", "server.js"]