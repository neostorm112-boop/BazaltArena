#!/usr/bin/env bash
# Одноразовый bootstrap на чистом Ubuntu (Lightsail). Запуск: на сервере от ubuntu.
set -euo pipefail
REPO_URL="${REPO_URL:-https://github.com/neostorm112-boop/BazaltArena.git}"
APP_DIR="${APP_DIR:-$HOME/bazalt-arena}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-http://$(curl -fsS ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')}"

echo "==> PUBLIC_ORIGIN=$PUBLIC_ORIGIN APP_DIR=$APP_DIR"

sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git nginx openssl

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker"
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
fi

if ! command -v node >/dev/null 2>&1 || ! node -e "process.exit(Number(process.version.slice(1).split('.')[0])>=20?0:1)" 2>/dev/null; then
  echo "==> Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "==> Cloning"
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
else
  echo "==> Pulling"
  cd "$APP_DIR" && git fetch origin && git reset --hard origin/main
fi

cd "$APP_DIR"
sudo chown -R "$(id -un):$(id -gn)" "$APP_DIR" || true

echo "==> Docker compose (postgres + redis)"
sudo docker compose up -d

ACCESS="$(openssl rand -hex 24)"
REFRESH="$(openssl rand -hex 32)"
JWT_A="$(openssl rand -hex 32)"
JWT_R="$(openssl rand -hex 32)"

cat >"$APP_DIR/.env" <<EOF
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
DATABASE_URL=postgresql://basalt:basalt@127.0.0.1:5433/basalt?schema=bff
REDIS_URL=redis://127.0.0.1:6379
JWT_ACCESS_SECRET=${JWT_A}
JWT_REFRESH_SECRET=${JWT_R}
CORS_ORIGINS=${PUBLIC_ORIGIN},${PUBLIC_ORIGIN}:8080,http://127.0.0.1:8080,http://127.0.0.1
SEED_ADMIN_PASSWORD=${ACCESS}
SEED_DEMO_PASSWORD=demo1234
EOF
cp "$APP_DIR/.env" "$APP_DIR/bff/.env"

echo "==> npm install + prisma generate"
rm -rf node_modules client/node_modules admin/node_modules bff/node_modules server/node_modules 2>/dev/null || true
npm ci
npm run prisma:generate -w bff

echo "==> Migrations + seed"
npm run db:migrate
npm run db:seed || true

echo "==> Build"
npm run build:all

sudo tee /etc/systemd/system/basalt-bff.service >/dev/null <<EOF
[Unit]
Description=Basalt Arena BFF
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR/bff
EnvironmentFile=$APP_DIR/bff/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/nginx/sites-available/basalt-arena >/dev/null <<'NGX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    root ROOT_PLACEHOLDER/client/dist;
    index index.html;
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
    location /avatar {
        proxy_pass http://127.0.0.1:3001;
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 8080 default_server;
    listen [::]:8080 default_server;
    server_name _;
    root ROOT_PLACEHOLDER/admin/dist;
    index index.html;
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
    location /avatar {
        proxy_pass http://127.0.0.1:3001;
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGX
sudo sed -i "s|ROOT_PLACEHOLDER|$APP_DIR|g" /etc/nginx/sites-available/basalt-arena
sudo ln -sf /etc/nginx/sites-available/basalt-arena /etc/nginx/sites-enabled/basalt-arena
sudo rm -f /etc/nginx/sites-enabled/default

# nginx runs as www-data; default Ubuntu home is 750, so traverse is required to reach APP_DIR.
chmod o+x "$HOME" 2>/dev/null || sudo chmod o+x "$HOME" || true

sudo nginx -t
sudo systemctl reload nginx
sudo systemctl daemon-reload
sudo systemctl enable --now basalt-bff.service

sleep 5
curl -fsS "http://127.0.0.1/api/v1/health" && echo
curl -fsSI "http://127.0.0.1/" | head -3

echo "==> Admin seed password (store safely): $ACCESS"
echo "==> Done. Client: ${PUBLIC_ORIGIN}/  Admin: ${PUBLIC_ORIGIN}:8080/"
