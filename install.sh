#!/usr/bin/env bash
################################################################################
# MarFaNet Fully Automated Installation Script
# سیستم نصب کاملاً خودکار MarFaNet - نسخه Production-Ready
#
# این اسکریپت تمام مراحل نصب را از صفر تا راه‌اندازی کامل انجام می‌دهد:
# ✅ نصب تمام پیش‌نیازها (Docker, Git, Nginx, Certbot)
# ✅ کلون یا آپدیت مخزن
# ✅ تولید خودکار رمزها و تنظیمات امنیتی
# ✅ ساخت و راه‌اندازی کانتینرها
# ✅ اجرای migrations دیتابیس
# ✅ ایجاد کاربر admin اولیه
# ✅ پیکربندی Nginx و SSL/TLS
# ✅ نصب ابزار مدیریت (agent)
#
# استفاده: sudo bash install.sh
################################################################################

set -euo pipefail
IFS=$'\n\t'

# رنگ‌ها برای خروجی بهتر
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color
readonly BOLD='\033[1m'

# متغیرهای پیکربندی
readonly DOMAIN="${DOMAIN:-marfanet.irnrefnation.com}"
readonly REPO_URL="https://github.com/Iscgr/AgentPortalShield.git"
readonly REPO_BRANCH="prof"
readonly INSTALL_DIR="/opt/marfanet"
readonly BACKUP_DIR="${INSTALL_DIR}/backups"
readonly LOG_DIR="${INSTALL_DIR}/logs"
readonly LOG_FILE="/var/log/marfanet-install.log"

# توابع کمکی
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✅ $*${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}❌ خطا: $*${NC}" | tee -a "$LOG_FILE" >&2
}

warning() {
    echo -e "${YELLOW}⚠️  $*${NC}" | tee -a "$LOG_FILE"
}

step() {
    echo -e "\n${CYAN}${BOLD}▶ $*${NC}\n" | tee -a "$LOG_FILE"
}

# بررسی دسترسی root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "این اسکریپت باید با دسترسی root اجرا شود"
        echo "لطفاً با دستور زیر مجدداً اجرا کنید:"
        echo "  sudo bash install.sh"
        exit 1
    fi
}

# بررسی سیستم عامل
check_os() {
    if ! grep -qi 'ubuntu' /etc/os-release; then
        warning "این اسکریپت برای Ubuntu بهینه‌سازی شده است"
        warning "ممکن است روی توزیع‌های دیگر Linux مشکل داشته باشد"
        read -p "آیا می‌خواهید ادامه دهید؟ (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi
    
    local os_version
    os_version=$(lsb_release -rs 2>/dev/null || echo "unknown")
    log "سیستم عامل: Ubuntu $os_version"
}

# نصب پیش‌نیازهای سیستمی
install_system_dependencies() {
    step "نصب پیش‌نیازهای سیستمی"
    
    export DEBIAN_FRONTEND=noninteractive
    
    log "به‌روزرسانی لیست پکیج‌ها..."
    apt-get update -qq
    
    log "نصب ابزارهای پایه..."
    apt-get install -y -qq \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release \
        git \
        jq \
        openssl \
        ufw \
        nginx \
        certbot \
        python3-certbot-nginx \
        software-properties-common \
        unzip \
        wget \
        net-tools \
        htop \
        nano \
        vim \
        > /dev/null 2>&1
    
    success "پیش‌نیازهای سیستمی نصب شد"
}

# نصب Docker
install_docker() {
    step "نصب Docker"
    
    if command -v docker &> /dev/null; then
        local docker_version
        docker_version=$(docker --version | cut -d' ' -f3 | tr -d ',')
        success "Docker از قبل نصب است (نسخه: $docker_version)"
        return 0
    fi
    
    log "افزودن مخزن رسمی Docker..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
        gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    log "نصب Docker Engine..."
    apt-get update -qq
    apt-get install -y -qq \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin \
        > /dev/null 2>&1
    
    systemctl enable docker --now
    
    success "Docker نصب و فعال شد"
    docker --version
}

# کلون یا آپدیت مخزن
setup_repository() {
    step "راه‌اندازی مخزن کد"
    
    if [[ -d "$INSTALL_DIR/.git" ]]; then
        log "مخزن موجود است، در حال آپدیت..."
        cd "$INSTALL_DIR"
        git fetch --all --prune
        git reset --hard "origin/$REPO_BRANCH"
        git clean -fd
        success "مخزن به‌روز شد"
    else
        log "کلون مخزن از GitHub..."
        rm -rf "$INSTALL_DIR"
        git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR"
        success "مخزن کلون شد"
    fi
    
    cd "$INSTALL_DIR"
}

# تولید رمزها و تنظیمات امنیتی
generate_secrets() {
    step "تولید رمزها و تنظیمات امنیتی"
    
    local db_password
    local session_secret
    local admin_password
    local app_secret
    
    db_password=$(openssl rand -hex 24)
    session_secret=$(openssl rand -hex 48)
    admin_password=$(openssl rand -hex 16)
    app_secret=$(openssl rand -hex 32)
    
    log "رمزهای امن تولید شدند"
    
    # ذخیره رمزها در فایل محرمانه
    cat > "$INSTALL_DIR/.env" <<EOF
# MarFaNet Environment Configuration
# Generated at: $(date)

# Node.js Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
POSTGRES_USER=marfanet
POSTGRES_PASSWORD=${db_password}
POSTGRES_DB=marfanet_db
DATABASE_URL=postgresql://marfanet:${db_password}@db:5432/marfanet_db

# Session & Security
SESSION_SECRET=${session_secret}
APP_SECRET=${app_secret}

# Application URLs
PUBLIC_BASE_URL=https://${DOMAIN}
PUBLIC_PORTAL_BASE_URL=https://${DOMAIN}

# Admin Credentials (Initial Setup)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${admin_password}

# Telegram (Optional - برای بکاپ خودکار)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Feature Flags
SKIP_REDIS_HEALTH=1
LOG_DIRECTORY=./logs
EOF
    
    chmod 600 "$INSTALL_DIR/.env"
    success "فایل .env ایجاد شد"
    
    # ذخیره credentials در فایل جداگانه
    cat > "$INSTALL_DIR/credentials.txt" <<EOF
========================================
MarFaNet Credentials - نصب $(date)
========================================

دامنه: https://${DOMAIN}
پنل ادمین: https://${DOMAIN}/admin

👤 اطلاعات ورود ادمین:
   Username: admin
   Password: ${admin_password}

🗄️ اطلاعات دیتابیس:
   User: marfanet
   Password: ${db_password}
   Database: marfanet_db
   Host: db (داخلی Docker)
   Port: 5432

🔐 Session Secret: ${session_secret}

⚠️  این فایل را در جای امن نگهداری کنید!
========================================
EOF
    
    chmod 600 "$INSTALL_DIR/credentials.txt"
    success "اطلاعات ورود در credentials.txt ذخیره شد"
}

# ایجاد docker-compose production
create_docker_compose() {
    step "ایجاد پیکربندی Docker Compose"
    
    cat > "$INSTALL_DIR/docker-compose.prod.yml" <<'EOF'
version: '3.8'

services:
  # PostgreSQL Database
  db:
    image: postgres:15-alpine
    container_name: marfanet-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-marfanet}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-marfanet_db}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-marfanet}"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s
    networks:
      - marfanet_network
    ports:
      - "127.0.0.1:5432:5432"

  # Redis Cache (Optional)
  redis:
    image: redis:7-alpine
    container_name: marfanet-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 5s
    networks:
      - marfanet_network
    ports:
      - "127.0.0.1:6379:6379"

  # MarFaNet Application
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: marfanet-app
    restart: unless-stopped
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./logs:/app/logs
      - ./backups:/app/backups
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
    networks:
      - marfanet_network
    ports:
      - "127.0.0.1:3000:3000"

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: marfanet-nginx
    restart: unless-stopped
    depends_on:
      app:
        condition: service_healthy
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /var/lib/letsencrypt:/var/lib/letsencrypt:ro
    ports:
      - "80:80"
      - "443:443"
    networks:
      - marfanet_network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  marfanet_network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
EOF
    
    success "docker-compose.prod.yml ایجاد شد"
}

# پیکربندی Nginx
configure_nginx() {
    step "پیکربندی Nginx"
    
    # پیکربندی اولیه HTTP (قبل از SSL)
    cat > "$INSTALL_DIR/nginx.conf" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Client max body size
    client_max_body_size 50M;
    
    # Proxy settings
    location / {
        proxy_pass http://marfanet-app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://marfanet-app:3000/health;
        access_log off;
    }
}
EOF
    
    success "پیکربندی Nginx ایجاد شد"
}

# ساخت و راه‌اندازی کانتینرها
build_and_start() {
    step "ساخت و راه‌اندازی کانتینرها"
    
    cd "$INSTALL_DIR"
    
    # ایجاد دایرکتوری‌های ضروری
    mkdir -p "$BACKUP_DIR" "$LOG_DIR"
    chmod 755 "$BACKUP_DIR" "$LOG_DIR"
    
    log "در حال ساخت تصاویر Docker..."
    docker compose -f docker-compose.prod.yml build --no-cache
    
    log "راه‌اندازی سرویس‌ها..."
    docker compose -f docker-compose.prod.yml up -d
    
    success "کانتینرها راه‌اندازی شدند"
    
    # انتظار برای آماده شدن سرویس‌ها
    log "انتظار برای آماده شدن سرویس‌ها..."
    local retries=30
    local count=0
    
    while [ $count -lt $retries ]; do
        if docker compose -f docker-compose.prod.yml ps | grep -q "healthy"; then
            success "سرویس‌ها آماده هستند"
            return 0
        fi
        count=$((count + 1))
        echo -n "."
        sleep 2
    done
    
    warning "سرویس‌ها هنوز در حال آماده‌سازی هستند (ادامه می‌یابد...)"
}

# اجرای migrations دیتابیس
run_migrations() {
    step "اجرای migrations دیتابیس"
    
    cd "$INSTALL_DIR"
    
    log "اجرای فایل‌های migration..."
    
    # اجرای هر migration به ترتیب
    for migration in server/migrations/*.sql; do
        if [[ -f "$migration" ]]; then
            local migration_name=$(basename "$migration")
            log "اجرای migration: $migration_name"
            
            docker compose -f docker-compose.prod.yml exec -T db \
                psql -U marfanet -d marfanet_db -f "/dev/stdin" < "$migration" 2>&1 | tee -a "$LOG_FILE"
            
            success "Migration $migration_name اجرا شد"
        fi
    done
    
    success "تمام migrations اجرا شدند"
}

# ایجاد کاربر admin اولیه
create_admin_user() {
    step "ایجاد کاربر admin اولیه"
    
    source "$INSTALL_DIR/.env"
    
    local admin_sql="
    DO \$\$
    DECLARE
        admin_user_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO admin_user_count FROM users WHERE username = 'admin';
        
        IF admin_user_count = 0 THEN
            INSERT INTO users (username, password, role, is_active)
            VALUES (
                'admin',
                crypt('${ADMIN_PASSWORD}', gen_salt('bf', 10)),
                'admin',
                true
            );
            RAISE NOTICE 'Admin user created successfully';
        ELSE
            RAISE NOTICE 'Admin user already exists';
        END IF;
    END \$\$;
    "
    
    echo "$admin_sql" | docker compose -f docker-compose.prod.yml exec -T db \
        psql -U marfanet -d marfanet_db 2>&1 | tee -a "$LOG_FILE"
    
    success "کاربر admin بررسی/ایجاد شد"
}

# پیکربندی SSL با Let's Encrypt
setup_ssl() {
    step "پیکربندی SSL با Let's Encrypt"
    
    # بررسی DNS
    log "بررسی تنظیمات DNS..."
    local domain_ip
    domain_ip=$(dig +short "$DOMAIN" | head -n1)
    local server_ip
    server_ip=$(curl -s ifconfig.me)
    
    if [[ -z "$domain_ip" ]]; then
        warning "دامنه $DOMAIN به هیچ IP اشاره نمی‌کند"
        warning "لطفاً ابتدا رکورد A دامنه را به $server_ip تنظیم کنید"
        return 1
    fi
    
    if [[ "$domain_ip" != "$server_ip" ]]; then
        warning "دامنه به IP دیگری اشاره دارد ($domain_ip != $server_ip)"
        warning "SSL به صورت خودکار پیکربندی نمی‌شود"
        return 1
    fi
    
    success "تنظیمات DNS صحیح است"
    
    # توقف موقت nginx برای certbot standalone
    docker compose -f docker-compose.prod.yml stop nginx
    
    log "درخواست گواهی SSL..."
    certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email "admin@${DOMAIN}" \
        --domains "${DOMAIN}" \
        --domains "www.${DOMAIN}" \
        2>&1 | tee -a "$LOG_FILE"
    
    if [[ -d "/etc/letsencrypt/live/${DOMAIN}" ]]; then
        success "گواهی SSL صادر شد"
        
        # پیکربندی Nginx با SSL
        cat > "$INSTALL_DIR/nginx.conf" <<EOF
# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    
    location /.well-known/acme-challenge/ {
        root /var/lib/letsencrypt;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Client max body size
    client_max_body_size 50M;
    
    # Proxy settings
    location / {
        proxy_pass http://marfanet-app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://marfanet-app:3000/health;
        access_log off;
    }
}
EOF
        
        # تنظیم تمدید خودکار
        (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && docker compose -f ${INSTALL_DIR}/docker-compose.prod.yml restart nginx") | crontab -
        
        success "SSL پیکربندی شد و تمدید خودکار فعال است"
    else
        warning "صدور گواهی SSL شکست خورد"
        warning "سیستم با HTTP ادامه می‌یابد"
    fi
    
    # راه‌اندازی مجدد nginx
    docker compose -f docker-compose.prod.yml up -d nginx
}

# نصب ابزار مدیریت
install_agent_tool() {
    step "نصب ابزار مدیریت (agent)"
    
    cat > /usr/local/bin/marfanet <<'AGENT_SCRIPT'
#!/usr/bin/env bash
# MarFaNet Management Tool

set -euo pipefail

INSTALL_DIR="/opt/marfanet"
COMPOSE_FILE="$INSTALL_DIR/docker-compose.prod.yml"

cd "$INSTALL_DIR"

show_menu() {
    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║   MarFaNet Management Tool             ║"
    echo "╠════════════════════════════════════════╣"
    echo "║  1) وضعیت سیستم (Status)              ║"
    echo "║  2) لاگ‌های زنده (Live Logs)           ║"
    echo "║  3) بکاپ دیتابیس (Backup)              ║"
    echo "║  4) ریستارت سرویس‌ها (Restart)         ║"
    echo "║  5) آپدیت سیستم (Update)               ║"
    echo "║  6) نمایش اطلاعات ورود (Credentials)  ║"
    echo "║  7) تست سلامت (Health Check)          ║"
    echo "║  8) خروج (Exit)                        ║"
    echo "╚════════════════════════════════════════╝"
    echo ""
}

status() {
    echo "📊 وضعیت سرویس‌ها:"
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    echo "💾 استفاده از دیسک:"
    df -h "$INSTALL_DIR" | tail -1
    echo ""
    echo "🐳 استفاده از Docker:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
}

logs() {
    echo "📜 لاگ‌های زنده (Ctrl+C برای خروج):"
    docker compose -f "$COMPOSE_FILE" logs -f --tail=100
}

backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$INSTALL_DIR/backups/marfanet_backup_${timestamp}.sql.gz"
    
    echo "💾 در حال ایجاد بکاپ..."
    docker compose -f "$COMPOSE_FILE" exec -T db \
        pg_dump -U marfanet marfanet_db | gzip > "$backup_file"
    
    if [[ -f "$backup_file" ]]; then
        local size=$(du -h "$backup_file" | cut -f1)
        echo "✅ بکاپ ایجاد شد: $backup_file (حجم: $size)"
        
        # ارسال به تلگرام (اگر تنظیم شده باشد)
        if [[ -f "$INSTALL_DIR/.env" ]]; then
            source "$INSTALL_DIR/.env"
            if [[ -n "${TELEGRAM_BOT_TOKEN:-}" ]] && [[ -n "${TELEGRAM_CHAT_ID:-}" ]]; then
                curl -s -F document=@"$backup_file" \
                    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument?chat_id=${TELEGRAM_CHAT_ID}&caption=MarFaNet Backup ${timestamp}" \
                    > /dev/null && echo "📤 بکاپ به تلگرام ارسال شد"
            fi
        fi
    else
        echo "❌ خطا در ایجاد بکاپ"
    fi
}

restart() {
    echo "🔄 ریستارت سرویس‌ها..."
    docker compose -f "$COMPOSE_FILE" restart
    echo "✅ سرویس‌ها ریستارت شدند"
}

update() {
    echo "🔄 آپدیت سیستم..."
    cd "$INSTALL_DIR"
    
    echo "📥 دریافت آخرین تغییرات..."
    git fetch --all
    git reset --hard origin/prof
    
    echo "🔨 ساخت مجدد..."
    docker compose -f "$COMPOSE_FILE" build --no-cache app
    
    echo "🚀 راه‌اندازی مجدد..."
    docker compose -f "$COMPOSE_FILE" up -d app
    
    echo "✅ آپدیت کامل شد"
}

show_credentials() {
    if [[ -f "$INSTALL_DIR/credentials.txt" ]]; then
        cat "$INSTALL_DIR/credentials.txt"
    else
        echo "❌ فایل اطلاعات ورود یافت نشد"
    fi
}

health_check() {
    echo "🏥 تست سلامت سیستم..."
    
    # بررسی دیتابیس
    if docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U marfanet > /dev/null 2>&1; then
        echo "✅ دیتابیس: سالم"
    else
        echo "❌ دیتابیس: مشکل دارد"
    fi
    
    # بررسی Redis
    if docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis: سالم"
    else
        echo "❌ Redis: مشکل دارد"
    fi
    
    # بررسی Application
    if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ Application: سالم"
    else
        echo "❌ Application: مشکل دارد"
    fi
    
    # بررسی Nginx
    if curl -sf http://localhost > /dev/null 2>&1; then
        echo "✅ Nginx: سالم"
    else
        echo "❌ Nginx: مشکل دارد"
    fi
}

# Main menu loop
if [[ $# -gt 0 ]]; then
    case "$1" in
        status) status ;;
        logs) logs ;;
        backup) backup ;;
        restart) restart ;;
        update) update ;;
        credentials) show_credentials ;;
        health) health_check ;;
        *) echo "دستور نامعتبر. استفاده: marfanet [status|logs|backup|restart|update|credentials|health]" ;;
    esac
    exit 0
fi

while true; do
    show_menu
    read -rp "انتخاب شما: " choice
    
    case $choice in
        1) status ;;
        2) logs ;;
        3) backup ;;
        4) restart ;;
        5) update ;;
        6) show_credentials ;;
        7) health_check ;;
        8) echo "خداحافظ!"; exit 0 ;;
        *) echo "انتخاب نامعتبر" ;;
    esac
    
    echo ""
    read -rp "فشار Enter برای ادامه..."
done
AGENT_SCRIPT
    
    chmod +x /usr/local/bin/marfanet
    success "ابزار مدیریت نصب شد (دستور: marfanet)"
}

# پیکربندی Firewall
configure_firewall() {
    step "پیکربندی Firewall"
    
    if command -v ufw &> /dev/null; then
        log "فعال‌سازی UFW..."
        
        # اجازه SSH
        ufw allow ssh
        ufw allow 22/tcp
        
        # اجازه HTTP/HTTPS
        ufw allow 80/tcp
        ufw allow 443/tcp
        
        # فعال‌سازی با پاسخ خودکار yes
        echo "y" | ufw enable
        
        success "Firewall پیکربندی شد"
        ufw status
    else
        warning "UFW یافت نشد، Firewall پیکربندی نشد"
    fi
}

# نمایش خلاصه نهایی
show_summary() {
    local credentials_file="$INSTALL_DIR/credentials.txt"
    
    clear
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║     ✅  نصب MarFaNet با موفقیت تکمیل شد!                     ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    
    if [[ -f "$credentials_file" ]]; then
        cat "$credentials_file"
    fi
    
    echo ""
    echo "🛠️  دستورات مفید:"
    echo "   marfanet              - منوی مدیریت"
    echo "   marfanet status       - نمایش وضعیت"
    echo "   marfanet logs         - نمایش لاگ‌ها"
    echo "   marfanet backup       - بکاپ دیتابیس"
    echo "   marfanet restart      - ریستارت سیستم"
    echo "   marfanet update       - آپدیت سیستم"
    echo ""
    echo "📁 مسیرها:"
    echo "   نصب: $INSTALL_DIR"
    echo "   لاگ‌ها: $LOG_DIR"
    echo "   بکاپ: $BACKUP_DIR"
    echo "   Log نصب: $LOG_FILE"
    echo ""
    echo "📚 مستندات بیشتر:"
    echo "   $INSTALL_DIR/README.md"
    echo ""
    echo "⚠️  یادآوری امنیتی:"
    echo "   - رمز عبور را تغییر دهید"
    echo "   - فایل credentials.txt را در جای امن نگهداری کنید"
    echo "   - تنظیمات Telegram را برای بکاپ خودکار انجام دهید"
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
}

# تابع اصلی
main() {
    clear
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║          MarFaNet Automated Installation Script              ║"
    echo "║              نصب خودکار سیستم مدیریت مالی مرفع‌نت           ║"
    echo "║                                                               ║"
    echo "║                    نسخه: 1.0.0                               ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    
    log "شروع نصب MarFaNet..."
    log "دامنه: $DOMAIN"
    log "مسیر نصب: $INSTALL_DIR"
    echo ""
    
    # مراحل نصب
    check_root
    check_os
    install_system_dependencies
    install_docker
    setup_repository
    generate_secrets
    create_docker_compose
    configure_nginx
    build_and_start
    
    # صبر برای آماده شدن کامل
    sleep 10
    
    run_migrations
    create_admin_user
    install_agent_tool
    configure_firewall
    
    # تلاش برای SSL (اختیاری)
    setup_ssl || warning "SSL پیکربندی نشد، سیستم با HTTP در دسترس است"
    
    show_summary
    
    success "نصب کامل شد!"
    log "زمان اتمام: $(date)"
}

# اجرای اسکریپت
main "$@"
