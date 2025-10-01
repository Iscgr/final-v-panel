# 📋 MarFaNet - Technical Deployment Specification

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Internet (Port 80/443)               │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
         ┌──────────────────────────┐
         │   Nginx Reverse Proxy    │
         │   - SSL/TLS Termination  │
         │   - Load Balancing       │
         │   - Security Headers     │
         └────────────┬─────────────┘
                      │
                      ▼
         ┌──────────────────────────┐
         │   MarFaNet Application   │
         │   - Node.js 20 + Express │
         │   - React 18 Frontend    │
         │   - Port: 3000           │
         └────────┬─────────────────┘
                  │
         ┌────────┴────────┐
         ▼                 ▼
┌─────────────┐    ┌──────────────┐
│ PostgreSQL  │    │    Redis     │
│   Port 5432 │    │  Port 6379   │
│  (internal) │    │  (internal)  │
└─────────────┘    └──────────────┘
```

## 🔧 Technology Stack

### Backend
- **Runtime:** Node.js 20 LTS
- **Framework:** Express.js 4.21+
- **Database:** PostgreSQL 15
- **ORM:** Drizzle ORM 0.44+
- **Session Store:** Redis 7 + connect-pg-simple
- **Authentication:** Passport.js + bcrypt

### Frontend
- **Library:** React 18
- **Build Tool:** Vite 5
- **UI Framework:** Radix UI + Tailwind CSS
- **State Management:** TanStack Query
- **Routing:** Wouter

### Infrastructure
- **Containerization:** Docker + Docker Compose
- **Reverse Proxy:** Nginx (Alpine)
- **SSL/TLS:** Let's Encrypt (Certbot)
- **Process Management:** Docker restart policies

## 📦 Container Services

### 1. PostgreSQL Database (`db`)
- **Image:** postgres:15-alpine
- **Port:** 5432 (internal only)
- **Volume:** postgres_data
- **Health Check:** pg_isready
- **Resources:**
  - CPU: 1 core
  - RAM: 512MB-1GB
  - Storage: 10GB+

### 2. Redis Cache (`redis`)
- **Image:** redis:7-alpine
- **Port:** 6379 (internal only)
- **Volume:** redis_data
- **Configuration:**
  - Persistence: AOF enabled
  - Max Memory: 256MB
  - Eviction Policy: allkeys-lru

### 3. Application (`app`)
- **Build:** Multi-stage Dockerfile
- **Port:** 3000 (bound to localhost only)
- **Volumes:**
  - ./logs:/app/logs
  - ./backups:/app/backups
- **Environment:** Production (.env)
- **Health Check:** GET /health

### 4. Nginx Proxy (`nginx`)
- **Image:** nginx:alpine
- **Ports:** 80, 443 (external)
- **Configuration:** nginx.conf
- **SSL Certificates:** /etc/letsencrypt (read-only)

## 🔐 Security Configuration

### Environment Variables (.env)
```bash
# Critical - Auto-generated
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@db:5432/dbname
SESSION_SECRET=<64-char-hex>
APP_SECRET=<64-char-hex>
ADMIN_PASSWORD=<32-char-hex>

# Application
PUBLIC_BASE_URL=https://domain.com
PUBLIC_PORTAL_BASE_URL=https://domain.com
PORT=3000

# Database Credentials
POSTGRES_USER=marfanet
POSTGRES_PASSWORD=<48-char-hex>
POSTGRES_DB=marfanet_db

# Optional - Telegram Notifications
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Feature Flags
SKIP_REDIS_HEALTH=1
LOG_DIRECTORY=./logs
```

### File Permissions
- `.env` → 600 (root only)
- `credentials.txt` → 600 (root only)
- `logs/` → 755
- `backups/` → 755

### Network Security
- Internal Docker network: 172.28.0.0/16
- Database & Redis: Not exposed externally
- Application: Bound to 127.0.0.1:3000
- Only Nginx exposes 80/443

### Firewall Rules (UFW)
```bash
22/tcp   ALLOW    # SSH
80/tcp   ALLOW    # HTTP
443/tcp  ALLOW    # HTTPS
```

## 🗄️ Database Schema

### Key Tables
1. **users** - Admin/Staff users
2. **representatives** - نمایندگان
3. **invoices** - فاکتورهای صادر شده
4. **payments** - پرداخت‌ها
5. **transactions** - تراکنش‌های مالی
6. **reconciliation_runs** - گزارش‌های تطابق
7. **session** - User sessions (via connect-pg-simple)
8. **outbox** - Event sourcing outbox pattern

### Migrations
- Location: `server/migrations/*.sql`
- Execution: Sequential order (001, 002, ...)
- Applied during: Installation script
- Re-run safe: Most migrations use IF NOT EXISTS

## 📊 Performance Specifications

### Minimum Requirements
- **CPU:** 2 cores
- **RAM:** 2GB
- **Disk:** 20GB SSD
- **Network:** 10Mbps

### Recommended Production
- **CPU:** 4 cores
- **RAM:** 4-8GB
- **Disk:** 50GB SSD
- **Network:** 100Mbps
- **Load:** 100-500 concurrent users

### Resource Limits (Docker)
```yaml
app:
  cpus: '2'
  mem_limit: 2g
  mem_reservation: 1g

db:
  cpus: '1'
  mem_limit: 1g
  mem_reservation: 512m

redis:
  cpus: '0.5'
  mem_limit: 512m
```

## 🔄 Deployment Workflow

### Initial Installation
1. ✅ System prep (Ubuntu packages)
2. ✅ Docker installation
3. ✅ Repository clone
4. ✅ Secret generation
5. ✅ Environment configuration
6. ✅ Docker Compose setup
7. ✅ Container build & start
8. ✅ Database migration
9. ✅ Admin user creation
10. ✅ SSL certificate issuance
11. ✅ Management tool installation

**Total Time:** 5-10 minutes

### Update Workflow
```bash
marfanet update
# or manually:
cd /opt/marfanet
git pull origin prof
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d app
```

### Backup Strategy
```bash
# Manual backup
marfanet backup

# Automated (cron)
0 2 * * * /usr/local/bin/marfanet backup

# Backup location
/opt/marfanet/backups/marfanet_backup_YYYYMMDD_HHMMSS.sql.gz
```

### Monitoring Endpoints
- **Health Check:** `GET /health`
- **Database Status:** `GET /api/health/db`
- **Metrics:** Container stats via `docker stats`

## 🚀 Installation Methods

### Method 1: One-Line Remote Install
```bash
curl -sSL https://raw.githubusercontent.com/Iscgr/AgentPortalShield/prof/install.sh | sudo bash
```

### Method 2: Manual Install (Cloned Repo)
```bash
cd /opt/marfanet
sudo bash install.sh
```

### Method 3: Validation After Install
```bash
sudo bash /opt/marfanet/validate-install.sh
```

## 🧪 Testing & Validation

### Health Checks
```bash
# Database
docker compose -f /opt/marfanet/docker-compose.prod.yml exec db pg_isready -U marfanet

# Redis
docker compose -f /opt/marfanet/docker-compose.prod.yml exec redis redis-cli ping

# Application
curl http://localhost:3000/health

# Full system
marfanet health
```

### Common Issues & Fixes

#### Issue: Port already in use
```bash
# Find process using port
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting service
sudo systemctl stop apache2  # or nginx
```

#### Issue: Database migration fails
```bash
# Manual migration
cd /opt/marfanet
for f in server/migrations/*.sql; do
  docker compose -f docker-compose.prod.yml exec -T db \
    psql -U marfanet -d marfanet_db < "$f"
done
```

#### Issue: SSL certificate failed
```bash
# Check DNS
dig +short marfanet.irnrefnation.com

# Manual certbot
sudo certbot certonly --standalone -d marfanet.irnrefnation.com

# Restart nginx
docker compose -f /opt/marfanet/docker-compose.prod.yml restart nginx
```

## 📈 Scaling Considerations

### Horizontal Scaling
- Application: Stateless, can run multiple instances behind load balancer
- Database: Consider read replicas for heavy read workloads
- Redis: Redis Cluster for high availability

### Vertical Scaling
- Increase container resource limits in docker-compose.prod.yml
- Tune PostgreSQL parameters (shared_buffers, work_mem, etc.)
- Enable Redis persistence to disk if needed

### Production Checklist
- [ ] DNS configured and propagated
- [ ] Firewall rules applied
- [ ] SSL certificate installed
- [ ] Admin password changed
- [ ] Backup strategy configured
- [ ] Monitoring alerts set up
- [ ] Telegram notifications configured
- [ ] Log rotation configured
- [ ] Database connection pooling tuned
- [ ] Performance testing completed

## 📞 Support & Maintenance

### Management Tool
```bash
marfanet              # Interactive menu
marfanet status       # System status
marfanet logs         # Live logs
marfanet backup       # Database backup
marfanet restart      # Restart services
marfanet update       # Update to latest
marfanet health       # Health check
marfanet credentials  # Show login info
```

### Log Locations
- Installation: `/var/log/marfanet-install.log`
- Application: `/opt/marfanet/logs/`
- Docker: `docker compose logs`
- Nginx: Container logs via Docker

### Troubleshooting Commands
```bash
# Container status
docker ps

# Service logs
docker compose -f /opt/marfanet/docker-compose.prod.yml logs [service]

# Restart specific service
docker compose -f /opt/marfanet/docker-compose.prod.yml restart [service]

# Database shell
docker compose -f /opt/marfanet/docker-compose.prod.yml exec db psql -U marfanet -d marfanet_db

# Application shell
docker compose -f /opt/marfanet/docker-compose.prod.yml exec app sh
```

---

**Version:** 1.0.0  
**Last Updated:** October 2025  
**Maintainer:** MarFaNet Development Team
