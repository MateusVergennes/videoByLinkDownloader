FROM node:20-slim

# se quiser passar GH_TOKEN na hora do build:
ARG GH_TOKEN
ENV GH_TOKEN=$GH_TOKEN

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci            

COPY . .
ENV PORT=3000
ENV DOWNLOAD_DIR=/tmp
CMD ["node","server.js"]