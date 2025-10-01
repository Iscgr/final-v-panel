#!/usr/bin/env bash
################################################################################
# MarFaNet One-Command Installer
# نسخه خودکار و سبک برای نصب مستقیم
################################################################################

cat > /tmp/marfanet-install.sh <<'INSTALL_EOF'
#!/usr/bin/env bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Config
DOMAIN="${DOMAIN:-marfanet.irnrefnation.com}"
REPO_URL="https://github.com/Iscgr/AgentPortalShield.git"
REPO_BRANCH="prof"
INSTALL_DIR="/opt/marfanet"
LOG_FILE="/var/log/marfanet-install.log"

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"; }
success() { echo -e "${GREEN}✅ $*${NC}" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}❌ $*${NC}" | tee -a "$LOG_FILE" >&2; exit 1; }

# Check root
[[ $EUID -eq 0 ]] || error "Run with sudo"

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║   MarFaNet Auto Installer v1.0.0      ║"
echo "║   Domain: $DOMAIN                     ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# Update system
log "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git jq ufw nginx software-properties-common \
    certbot python3-certbot-nginx unzip openssl wget > /dev/null 2>&1

# Install Docker
if ! command -v docker &> /dev/null; then
    log "Installing Docker..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
        gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin > /dev/null 2>&1
    systemctl enable --now docker
    success "Docker installed"
else
    success "Docker already installed"
fi

# Clone or update repo
log "Setting up repository..."
if [[ -d "$INSTALL_DIR/.git" ]]; then
    cd "$INSTALL_DIR"
    git fetch --all --prune
    git reset --hard "origin/$REPO_BRANCH"
    git clean -fd
    success "Repository updated"
else
    rm -rf "$INSTALL_DIR"
    git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR"
    success "Repository cloned"
fi

cd "$INSTALL_DIR"

# Generate secrets
log "Generating secure credentials..."
DB_PASS=$(openssl rand -hex 24)
SESSION_SECRET=$(openssl rand -hex 48)
ADMIN_PASS=$(openssl rand -hex 16)
APP_SECRET=$(openssl rand -hex 32)

# Create .env
cat > "$INSTALL_DIR/.env" <<ENV
NODE_ENV=production
PORT=3000
POSTGRES_USER=marfanet
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=marfanet_db
DATABASE_URL=postgresql://marfanet:${DB_PASS}@db:5432/marfanet_db
SESSION_SECRET=${SESSION_SECRET}
APP_SECRET=${APP_SECRET}
PUBLIC_BASE_URL=https://${DOMAIN}
PUBLIC_PORTAL_BASE_URL=https://${DOMAIN}
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${ADMIN_PASS}
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
SKIP_REDIS_HEALTH=1
LOG_DIRECTORY=./logs
ENV

chmod 600 "$INSTALL_DIR/.env"
success ".env created"

# Save credentials
cat > "$INSTALL_DIR/credentials.txt" <<CRED
========================================
MarFaNet Credentials - $(date)
========================================

URL: https://${DOMAIN}
Admin Panel: https://${DOMAIN}/admin

Admin Login:
  Username: admin
  Password: ${ADMIN_PASS}

Database:
  User: marfanet
  Password: ${DB_PASS}
  Database: marfanet_db

⚠️  Keep this file secure!
========================================
CRED

chmod 600 "$INSTALL_DIR/credentials.txt"

# Create docker-compose
log "Creating Docker Compose configuration..."
cat > "$INSTALL_DIR/docker-compose.prod.yml" <<'COMPOSE'
version: '3.8'
services:
  db:
    image: postgres:15-alpine
    container_name: marfanet-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-marfanet}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-marfanet_db}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-marfanet}"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - marfanet_network
    ports:
      - "127.0.0.1:5432:5432"

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
    networks:
      - marfanet_network
    ports:
      - "127.0.0.1:6379:6379"

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
    ports:
      - "80:80"
      - "443:443"
    networks:
      - marfanet_network

volumes:
  postgres_data:
  redis_data:

networks:
  marfanet_network:
    driver: bridge
COMPOSE

# Create nginx config
log "Creating Nginx configuration..."
cat > "$INSTALL_DIR/nginx.conf" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    
    client_max_body_size 50M;
    
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
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /health {
        proxy_pass http://marfanet-app:3000/health;
        access_log off;
    }
}
NGINX

# Create directories
mkdir -p "$INSTALL_DIR/backups" "$INSTALL_DIR/logs"
chmod 755 "$INSTALL_DIR/backups" "$INSTALL_DIR/logs"

# Build and start
log "Building Docker images..."
docker compose -f docker-compose.prod.yml build --no-cache

log "Starting services..."
docker compose -f docker-compose.prod.yml up -d

# Wait for services
log "Waiting for services to be ready..."
sleep 15

# Run migrations
log "Running database migrations..."
for migration in server/migrations/*.sql; do
    [[ -f "$migration" ]] || continue
    docker compose -f docker-compose.prod.yml exec -T db \
        psql -U marfanet -d marfanet_db -f "/dev/stdin" < "$migration" 2>&1 | tee -a "$LOG_FILE"
done

# Create admin user
log "Creating admin user..."
ADMIN_SQL="
DO \$\$
DECLARE admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM users WHERE username = 'admin';
    IF admin_count = 0 THEN
        INSERT INTO users (username, password, role, is_active)
        VALUES ('admin', crypt('${ADMIN_PASS}', gen_salt('bf', 10)), 'admin', true);
    END IF;
END \$\$;
"
echo "$ADMIN_SQL" | docker compose -f docker-compose.prod.yml exec -T db \
    psql -U marfanet -d marfanet_db 2>&1 | tee -a "$LOG_FILE"

# SSL setup
log "Setting up SSL..."
domain_ip=$(dig +short "$DOMAIN" 2>/dev/null | head -n1)
server_ip=$(curl -s ifconfig.me 2>/dev/null || echo "")

if [[ -n "$domain_ip" ]] && [[ "$domain_ip" == "$server_ip" ]]; then
    docker compose -f docker-compose.prod.yml stop nginx
    
    if certbot certonly --standalone --non-interactive --agree-tos \
        --email "admin@${DOMAIN}" -d "${DOMAIN}" 2>&1 | tee -a "$LOG_FILE"; then
        
        cat > "$INSTALL_DIR/nginx.conf" <<NGINX_SSL
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ {
        root /var/lib/letsencrypt;
    }
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};
    
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    
    client_max_body_size 50M;
    
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
    }
    
    location /health {
        proxy_pass http://marfanet-app:3000/health;
        access_log off;
    }
}
NGINX_SSL
        
        success "SSL certificate installed"
        
        # Auto-renewal
        (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && docker compose -f ${INSTALL_DIR}/docker-compose.prod.yml restart nginx") | crontab -
    fi
    
    docker compose -f docker-compose.prod.yml up -d nginx
else
    log "⚠️  DNS not configured or mismatch. Running on HTTP only."
fi

# Install management tool
log "Installing management tool..."
cat > /usr/local/bin/marfanet <<'AGENT'
#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="/opt/marfanet"
COMPOSE_FILE="$INSTALL_DIR/docker-compose.prod.yml"
cd "$INSTALL_DIR"

case "${1:-menu}" in
    status)
        docker compose -f "$COMPOSE_FILE" ps
        ;;
    logs)
        docker compose -f "$COMPOSE_FILE" logs -f --tail=100
        ;;
    backup)
        TS=$(date +%Y%m%d_%H%M%S)
        FILE="backups/backup_${TS}.sql.gz"
        docker compose -f "$COMPOSE_FILE" exec -T db \
            pg_dump -U marfanet marfanet_db | gzip > "$FILE"
        echo "✅ Backup: $FILE"
        ;;
    restart)
        docker compose -f "$COMPOSE_FILE" restart
        echo "✅ Restarted"
        ;;
    update)
        git fetch --all && git reset --hard origin/prof
        docker compose -f "$COMPOSE_FILE" build app
        docker compose -f "$COMPOSE_FILE" up -d app
        echo "✅ Updated"
        ;;
    credentials)
        cat "$INSTALL_DIR/credentials.txt"
        ;;
    health)
        curl -sf http://localhost:3000/health || echo "❌ App unhealthy"
        docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U marfanet || echo "❌ DB unhealthy"
        docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping || echo "❌ Redis unhealthy"
        ;;
    *)
        echo "MarFaNet Management Tool"
        echo "Usage: marfanet [status|logs|backup|restart|update|credentials|health]"
        ;;
esac
AGENT

chmod +x /usr/local/bin/marfanet
success "Management tool installed"

# Configure firewall
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    echo "y" | ufw enable 2>/dev/null || true
    success "Firewall configured"
fi

# Final summary
clear
echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║                                                   ║"
echo "║     ✅  MarFaNet Installation Complete!          ║"
echo "║                                                   ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
cat "$INSTALL_DIR/credentials.txt"
echo ""
echo "🛠️  Management:"
echo "   marfanet status       - Show status"
echo "   marfanet logs         - View logs"
echo "   marfanet backup       - Backup database"
echo "   marfanet restart      - Restart services"
echo "   marfanet update       - Update system"
echo "   marfanet credentials  - Show credentials"
echo "   marfanet health       - Health check"
echo ""
echo "📁 Files:"
echo "   Installation: $INSTALL_DIR"
echo "   Logs: $INSTALL_DIR/logs"
echo "   Backups: $INSTALL_DIR/backups"
echo ""
success "Installation complete!"
INSTALL_EOF

# Execute the installer
bash /tmp/marfanet-install.sh
