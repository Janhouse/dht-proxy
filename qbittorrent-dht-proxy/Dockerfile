FROM oven/bun:1.4-alpine
WORKDIR /app

COPY package.json ./
RUN bun install

COPY src/ ./src/

LABEL org.opencontainers.image.title="qBittorrent DHT Proxy"
LABEL org.opencontainers.image.description="HTTP proxy for qBittorrent that intercepts torrent additions and routes them through DHT Proxy"
LABEL org.opencontainers.image.source="https://github.com/Janhouse/dht-proxy"
LABEL org.opencontainers.image.vendor="Janhouse"

EXPOSE 9080
ENV PROXY_PORT=9080

CMD ["bun", "run", "src/index.ts"]
