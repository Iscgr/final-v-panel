#!/usr/bin/env bash
# MarFaNet Auto Installer for Ubuntu 24.04+
# One-line bootstrap: curl -sSL https://example.com/install.sh | bash
# This script performs:
# 1. Pre-flight checks
# 2. Prompt for domain
# 3. Install Docker & dependencies
# 4. Clone repo to /opt/marfanet (if not exists)
# 5. Generate secrets and .env
# 6. Create docker-compose stack (app + db + redis + nginx proxy)
# 7. Obtain Let's Encrypt SSL (HTTP-01)
# 8. Start services and print credentials

set -euo pipefail
IFS=$'\n\t'

VERSION="1.0.0"
REPO_URL_DEFAULT="https://github.com/Iscgr/final-v-panel.git"
REPO_URL="${MARFANET_REPO_URL:-$REPO_URL_DEFAULT}"
INSTALL_DIR="/opt/marfanet"
ENV_FILE="$INSTALL_DIR/.env"
COMPOSE_FILE="$INSTALL_DIR/docker-compose-stack.yml"
NGINX_CONF_DIR="/etc/nginx/conf.d"
LOG_FILE="/var/log/marfanet-install.log"

COLOR_RESET='\033[0m'
COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[0;33m'
COLOR_BLUE='\033[0;34m'
BOLD='\033[1m'

log() { echo -e "${COLOR_BLUE}[INFO]${COLOR_RESET} $*" | tee -a "$LOG_FILE"; }
ok() { echo -e "${COLOR_GREEN}[OK]${COLOR_RESET} $*" | tee -a "$LOG_FILE"; }
warn() { echo -e "${COLOR_YELLOW}[WARN]${COLOR_RESET} $*" | tee -a "$LOG_FILE"; }
err() { echo -e "${COLOR_RED}[ERR]${COLOR_RESET} $*" | tee -a "$LOG_FILE" >&2; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    err "لطفاً اسکریپت را با دسترسی روت اجرا کنید (sudo)."; exit 1; fi
}

trap 'err "خطا رخ داد. خروجی log در: $LOG_FILE"' ERR

require_root

log "مرحله 1: بررسی سیستم عامل"
if ! grep -qi 'ubuntu' /etc/os-release; then
  warn "سیستم عامل Ubuntu شناسایی نشد. ادامه می‌دهیم ولی تضمین کامل نیست."; fi

log "مرحله 2: تنظیم دامنه ثابت (Hardcoded)"
# دامنه به صورت ثابت تنظیم شده است؛ برای تغییر موقت می‌توانید قبل از اجرای اسکریپت دستور زیر را بزنید:
# DOMAIN=example.com bash auto-install.sh
DOMAIN_DEFAULT="marfanet.irnrefnation.com"
DOMAIN="${DOMAIN:-$DOMAIN_DEFAULT}"
if [[ -z "$DOMAIN" ]]; then err "دامنه خالی است"; exit 1; fi
ok "دامنه استفاده‌شده: $DOMAIN"

# Derive WWW and portal if needed (using same root domain)
PORTAL_DOMAIN="portal.$DOMAIN" # قابل تغییر در آینده

log "مرحله 3: نصب پکیج‌های پایه"
apt-get update -y >/dev/null
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git jq ufw nginx software-properties-common certbot python3-certbot-nginx unzip >/dev/null

log "مرحله 4: نصب Docker اگر موجود نیست"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
$(. /etc/os-release && echo "$VERSION_CODENAME") stable" >/etc/apt/sources.list.d/docker.list
  apt-get update -y >/dev/null
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
  systemctl enable --now docker
else
  ok "Docker از قبل نصب است"
fi

if ! command -v docker compose >/dev/null 2>&1; then
  err "Docker Compose v2 در دسترس نیست"; exit 1; fi

log "مرحله 5: کلون یا بروزرسانی مخزن"
ok "ریپوی استفاده‌شده: $REPO_URL"
if [[ -d "$INSTALL_DIR/.git" ]]; then
  (cd "$INSTALL_DIR" && git remote set-url origin "$REPO_URL" && git fetch --all && git reset --hard origin/prof)
else
  git clone --branch prof "$REPO_URL" "$INSTALL_DIR"
fi

log "مرحله 6: تولید رمزها و مقادیر تصادفی"
RANDOM_DB_PASS=$(openssl rand -hex 16)
RANDOM_SESSION_SECRET=$(openssl rand -hex 32)
RANDOM_ADMIN_PASS=$(openssl rand -hex 12)
DB_USER="marfanet"
DB_NAME="marfanet_db"
DB_HOST="db"
DB_PORT="5432"
APP_PORT="3000"
PUBLIC_BASE_URL="https://$DOMAIN"
PUBLIC_PORTAL_BASE_URL="https://$DOMAIN" # یا می‌توان به portal.$DOMAIN تغییر داد

log "مرحله 7: ساخت فایل env"
cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=$APP_PORT
DATABASE_URL=postgresql://$DB_USER:$RANDOM_DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME
SESSION_SECRET=$RANDOM_SESSION_SECRET
PUBLIC_BASE_URL=$PUBLIC_BASE_URL
PUBLIC_PORTAL_BASE_URL=$PUBLIC_PORTAL_BASE_URL
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$RANDOM_ADMIN_PASS
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
SKIP_REDIS_HEALTH=1
EOF
chmod 600 "$ENV_FILE"

log "مرحله 8: ساخت docker-compose stack (افزوده شدن app + nginx)"
cat > "$COMPOSE_FILE" <<EOF
services:
  db:
    image: postgres:15
    container_name: marfanet-db
    environment:
      POSTGRES_USER: marfanet
      POSTGRES_PASSWORD: $RANDOM_DB_PASS
      POSTGRES_DB: marfanet_db
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U marfanet"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - marfanet-network

  redis:
    image: redis:7-alpine
    container_name: marfanet-redis
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - marfanet-network

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: marfanet-app
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "127.0.0.1:3000:3000"
    networks:
      - marfanet-network
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: marfanet-nginx
    depends_on:
      - app
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "80:80"
      - "443:443"
    networks:
      - marfanet-network
    restart: unless-stopped

volumes:
  postgres-data:
  redis-data:

networks:
  marfanet-network:
    driver: bridge
EOF

log "مرحله 9: پیکربندی Nginx اولیه"
cat > "$INSTALL_DIR/nginx.conf" <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    location / {
        proxy_pass http://marfanet-app:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

log "مرحله 10: ساخت ایمیج و بالا آوردن سرویس‌ها"
(cd "$INSTALL_DIR" && docker compose -f "$COMPOSE_FILE" build && docker compose -f "$COMPOSE_FILE" up -d)

log "مرحله 11: دریافت SSL با certbot (nginx plugin)"
# Stop container nginx temporarily to free port 80 if needed
if docker ps --format '{{.Names}}' | grep -q marfanet-nginx; then
  docker stop marfanet-nginx >/dev/null || true
fi
# Use standalone mode
certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos -m admin@$DOMAIN || warn "دریافت گواهی با certbot شکست خورد"

# Create SSL-enabled nginx conf
cat > "$INSTALL_DIR/nginx.conf" <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://$DOMAIN$request_uri;
}
server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://marfanet-app:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /health {
        proxy_pass http://marfanet-app:3000/health;
    }
}
EOF

log "مرحله 12: راه‌اندازی مجدد nginx کانتینری با SSL"
(cd "$INSTALL_DIR" && docker compose -f "$COMPOSE_FILE" up -d nginx)

log "مرحله 13: ساخت اسکریپت منوی agent"
AGENT_SCRIPT="/usr/local/bin/agent"
cat > "$AGENT_SCRIPT" <<'AGENT_EOF'
#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="/opt/marfanet"
COMPOSE_FILE="$INSTALL_DIR/docker-compose-stack.yml"
ENV_FILE="$INSTALL_DIR/.env"
BACKUP_DIR="$INSTALL_DIR/backups"
REPO_URL="__REPO_URL__"
mkdir -p "$BACKUP_DIR"

usage() {
  cat <<USG
مدیریت MarFaNet - گزینه‌ها:
  1) بکاپ + ارسال تلگرام
  2) آپدیت پنل (pull + rebuild)
  3) ریستارت پنل
  4) نمایش لاگ
  5) وضعیت سلامت (health)
  q) خروج
USG
}

send_telegram() {
  local file_path="$1"
  source "$ENV_FILE" || true
  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
    echo "TELEGRAM_BOT_TOKEN یا TELEGRAM_CHAT_ID ست نشده است."; return 1; fi
  curl -s -F document=@"$file_path" "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument?chat_id=${TELEGRAM_CHAT_ID}&caption=MarFaNet Backup" >/dev/null && echo "ارسال تلگرام انجام شد" || echo "ارسال تلگرام شکست خورد"
}

backup_db() {
  echo "ایجاد بکاپ..."
  local ts=$(date +%Y%m%d_%H%M%S)
  source "$ENV_FILE"
  local dump_file="$BACKUP_DIR/db_$ts.sql"
  docker compose -f "$COMPOSE_FILE" exec -T db pg_dump -U marfanet marfanet_db > "$dump_file"
  gzip "$dump_file"
  local gz_file="$dump_file.gz"
  echo "بکاپ ایجاد شد: $gz_file"
  if [[ -f "$gz_file" ]]; then
    send_telegram "$gz_file" || true
  fi
}

update_panel() {
  echo "آپدیت پنل..."
  (cd "$INSTALL_DIR" && git remote set-url origin "$REPO_URL" && git fetch --all && git reset --hard origin/prof && docker compose -f "$COMPOSE_FILE" build app && docker compose -f "$COMPOSE_FILE" up -d app)
  echo "آپدیت انجام شد"
}

restart_panel() {
  docker compose -f "$COMPOSE_FILE" restart
  echo "ریستارت انجام شد"
}

show_logs() {
  docker compose -f "$COMPOSE_FILE" logs -f --tail=200 app
}

health_check() {
  if ! command -v curl >/dev/null 2>&1; then echo "curl نصب نیست"; return 1; fi
  source "$ENV_FILE" || true
  local base=${PUBLIC_BASE_URL:-http://localhost}
  echo "Health: $base/health"
  curl -k -s "$base/health" || echo "عدم دسترسی"
}

main_menu() {
  usage
  read -rp "انتخاب: " choice
  case "$choice" in
    1) backup_db ;;
    2) update_panel ;;
    3) restart_panel ;;
    4) show_logs ;;
    5) health_check ;;
    q|Q) exit 0 ;;
    *) echo "گزینه نامعتبر" ;;
  esac
}

if [[ $# -gt 0 ]]; then
  case "$1" in
    backup) backup_db ; exit 0 ;;
    update) update_panel ; exit 0 ;;
    restart) restart_panel ; exit 0 ;;
    logs) show_logs ; exit 0 ;;
    health) health_check ; exit 0 ;;
  esac
fi

while true; do
  main_menu
  echo
  read -rp "ادامه (Enter) یا خروج (q)? " ans
  [[ "$ans" == "q" ]] && break
done
AGENT_EOF
chmod +x "$AGENT_SCRIPT"
sed -i "s|__REPO_URL__|$REPO_URL|g" "$AGENT_SCRIPT"

log "مرحله 14: خلاصه نهایی"
cat <<SUMMARY
============================================================
 نصب MarFaNet تکمیل شد
============================================================
دامنه: https://$DOMAIN
پنل:  https://$DOMAIN/admin
پورتال: https://$DOMAIN/portal/[ID]

اطلاعات ورود ادمین:
  Username: admin
  Password: $RANDOM_ADMIN_PASS

دیتابیس:
  DB User: $DB_USER
  DB Name: $DB_NAME
  DB Pass: $RANDOM_DB_PASS
  داخلی در شبکه docker با نام سرویس db

فایل ENV: $ENV_FILE
ابزار مدیریت: agent  (دستورات: agent backup|update|restart|logs)

گواهی SSL در مسیر: /etc/letsencrypt/live/$DOMAIN/

(جهت تنظیم Telegram پس از ویرایش .env: agent backup را تست کنید.)
============================================================
SUMMARY

ok "تمام شد!"
