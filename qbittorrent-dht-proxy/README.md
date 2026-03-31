# qBittorrent DHT Proxy

HTTP proxy that sits between your client and qBittorrent's Web UI API. Intercepts torrent additions, routes them through [DHT Proxy](../README.md) to get privacy-preserving torrent files, then forwards them to qBittorrent.

## How it works

```
Browser / Sonarr / Radarr
    │
    ▼
qBittorrent DHT Proxy (:9080)
    │
    ├── POST /api/v2/torrents/add → intercepts, proxies through DHT Proxy
    └── All other requests → passes through to qBittorrent
```

Point your apps at this proxy instead of qBittorrent directly. Torrent additions are automatically routed through DHT Proxy so your qBittorrent client's IP is never exposed to public DHT/trackers.

## Security

**This proxy must not be exposed to the public internet.** It has no authentication and forwards requests to qBittorrent using a pre-authenticated session. Anyone who can reach this proxy's port has full access to your qBittorrent instance. Only bind it to `localhost` or a private network behind a firewall.

## Setup

```bash
cp .env.example .env
# Edit .env with your qBittorrent and DHT Proxy connection details
```

### Run directly

```bash
bun run start
```

### Run with Docker

```bash
docker compose up -d
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `QBITTORRENT_URL` | `http://localhost:8080` | qBittorrent Web UI URL |
| `QBITTORRENT_USERNAME` | `admin` | qBittorrent username |
| `QBITTORRENT_PASSWORD` | `adminadmin` | qBittorrent password |
| `DHT_PROXY_URL` | `http://localhost:3000` | DHT Proxy URL |
| `DHT_PROXY_API_TOKEN` | (empty) | Bearer token if DHT Proxy is private |
| `PROXY_PORT` | `9080` | Port to listen on |
