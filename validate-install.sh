#!/usr/bin/env bash
################################################################################
# MarFaNet Installation Validator
# اسکریپت اعتبارسنجی نصب MarFaNet
#
# این اسکریپت تمام جنبه‌های نصب را بررسی می‌کند
################################################################################

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTALL_DIR="/opt/marfanet"
COMPOSE_FILE="$INSTALL_DIR/docker-compose.prod.yml"

passed=0
failed=0
warnings=0

check_pass() {
    echo -e "${GREEN}✅ PASS:${NC} $1"
    ((passed++))
}

check_fail() {
    echo -e "${RED}❌ FAIL:${NC} $1"
    ((failed++))
}

check_warn() {
    echo -e "${YELLOW}⚠️  WARN:${NC} $1"
    ((warnings++))
}

section() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
}

section "1. System Requirements"

# Check if root
if [[ $EUID -eq 0 ]]; then
    check_pass "Running as root"
else
    check_warn "Not running as root (some checks may fail)"
fi

# Check OS
if grep -qi 'ubuntu' /etc/os-release; then
    check_pass "Ubuntu detected"
else
    check_warn "Not Ubuntu (might work but not tested)"
fi

# Check RAM
total_ram=$(free -m | awk '/^Mem:/{print $2}')
if [[ $total_ram -ge 2000 ]]; then
    check_pass "RAM: ${total_ram}MB (sufficient)"
else
    check_warn "RAM: ${total_ram}MB (recommended: 2GB+)"
fi

# Check disk space
free_space=$(df -BG "$INSTALL_DIR" 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'G' || echo "0")
if [[ $free_space -ge 10 ]]; then
    check_pass "Disk space: ${free_space}GB (sufficient)"
else
    check_fail "Disk space: ${free_space}GB (need 10GB+)"
fi

section "2. Dependencies"

# Docker
if command -v docker &> /dev/null; then
    docker_version=$(docker --version | awk '{print $3}' | tr -d ',')
    check_pass "Docker installed: $docker_version"
else
    check_fail "Docker not installed"
fi

# Docker Compose
if command -v docker compose &> /dev/null; then
    check_pass "Docker Compose plugin available"
else
    check_fail "Docker Compose plugin not available"
fi

# Git
if command -v git &> /dev/null; then
    check_pass "Git installed"
else
    check_fail "Git not installed"
fi

# Nginx
if command -v nginx &> /dev/null; then
    check_pass "Nginx installed"
else
    check_fail "Nginx not installed"
fi

# Certbot
if command -v certbot &> /dev/null; then
    check_pass "Certbot installed"
else
    check_warn "Certbot not installed (SSL won't work)"
fi

section "3. Installation Files"

# Repository
if [[ -d "$INSTALL_DIR/.git" ]]; then
    check_pass "Repository cloned at $INSTALL_DIR"
    
    cd "$INSTALL_DIR"
    current_branch=$(git branch --show-current)
    if [[ "$current_branch" == "prof" ]]; then
        check_pass "On correct branch: prof"
    else
        check_warn "Wrong branch: $current_branch (expected: prof)"
    fi
else
    check_fail "Repository not cloned at $INSTALL_DIR"
fi

# .env file
if [[ -f "$INSTALL_DIR/.env" ]]; then
    check_pass ".env file exists"
    
    # Check required variables
    source "$INSTALL_DIR/.env"
    
    [[ -n "${DATABASE_URL:-}" ]] && check_pass "DATABASE_URL set" || check_fail "DATABASE_URL not set"
    [[ -n "${SESSION_SECRET:-}" ]] && check_pass "SESSION_SECRET set" || check_fail "SESSION_SECRET not set"
    [[ -n "${PUBLIC_PORTAL_BASE_URL:-}" ]] && check_pass "PUBLIC_PORTAL_BASE_URL set" || check_fail "PUBLIC_PORTAL_BASE_URL not set"
else
    check_fail ".env file not found"
fi

# Docker Compose file
if [[ -f "$COMPOSE_FILE" ]]; then
    check_pass "docker-compose.prod.yml exists"
else
    check_fail "docker-compose.prod.yml not found"
fi

# Nginx config
if [[ -f "$INSTALL_DIR/nginx.conf" ]]; then
    check_pass "nginx.conf exists"
else
    check_fail "nginx.conf not found"
fi

section "4. Docker Containers"

if [[ -f "$COMPOSE_FILE" ]]; then
    cd "$INSTALL_DIR"
    
    # Check if containers are running
    if docker compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        check_pass "Containers are running"
        
        # Check individual services
        for service in db redis app nginx; do
            if docker compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
                check_pass "Service $service is up"
            else
                check_fail "Service $service is not running"
            fi
        done
        
        # Check health
        for service in db redis app; do
            status=$(docker compose -f "$COMPOSE_FILE" ps "$service" 2>/dev/null | grep -o "(healthy)" || echo "")
            if [[ -n "$status" ]]; then
                check_pass "Service $service is healthy"
            else
                check_warn "Service $service health status unknown"
            fi
        done
    else
        check_fail "No containers are running"
    fi
else
    check_warn "Cannot check containers (compose file missing)"
fi

section "5. Database"

if docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U marfanet &> /dev/null; then
    check_pass "Database is ready"
    
    # Check if tables exist
    table_count=$(docker compose -f "$COMPOSE_FILE" exec -T db \
        psql -U marfanet -d marfanet_db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d ' ' || echo "0")
    
    if [[ $table_count -gt 10 ]]; then
        check_pass "Database has $table_count tables (migrations applied)"
    else
        check_warn "Database has only $table_count tables (migrations may not be complete)"
    fi
else
    check_fail "Database is not ready"
fi

section "6. Application Health"

# Check app health endpoint
if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    check_pass "Application /health endpoint responding"
else
    check_fail "Application /health endpoint not responding"
fi

# Check app is accessible
if curl -sf http://localhost > /dev/null 2>&1; then
    check_pass "Application accessible via nginx (HTTP)"
else
    check_fail "Application not accessible via nginx"
fi

section "7. SSL/TLS"

DOMAIN=$(grep ^PUBLIC_PORTAL_BASE_URL= "$INSTALL_DIR/.env" 2>/dev/null | cut -d= -f2 | sed 's|https\?://||' || echo "marfanet.irnrefnation.com")

if [[ -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
    check_pass "SSL certificate exists for $DOMAIN"
    
    # Check certificate expiry
    cert_file="/etc/letsencrypt/live/$DOMAIN/cert.pem"
    if [[ -f "$cert_file" ]]; then
        expiry_date=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
        expiry_epoch=$(date -d "$expiry_date" +%s)
        now_epoch=$(date +%s)
        days_left=$(( ($expiry_epoch - $now_epoch) / 86400 ))
        
        if [[ $days_left -gt 30 ]]; then
            check_pass "Certificate valid for $days_left days"
        elif [[ $days_left -gt 0 ]]; then
            check_warn "Certificate expires in $days_left days (renew soon)"
        else
            check_fail "Certificate has expired!"
        fi
    fi
else
    check_warn "SSL certificate not found (system running on HTTP)"
fi

section "8. Management Tools"

# Check marfanet command
if command -v marfanet &> /dev/null; then
    check_pass "marfanet command installed"
else
    check_fail "marfanet command not found"
fi

# Check directories
for dir in logs backups; do
    if [[ -d "$INSTALL_DIR/$dir" ]]; then
        check_pass "$dir directory exists"
    else
        check_warn "$dir directory not found"
    fi
done

section "9. Firewall"

if command -v ufw &> /dev/null; then
    if ufw status | grep -q "Status: active"; then
        check_pass "UFW firewall is active"
        
        # Check required ports
        for port in 22 80 443; do
            if ufw status | grep -q "$port"; then
                check_pass "Port $port is allowed"
            else
                check_warn "Port $port may not be allowed"
            fi
        done
    else
        check_warn "UFW firewall is not active"
    fi
else
    check_warn "UFW not installed"
fi

section "10. Network Connectivity"

# Check DNS
if command -v dig &> /dev/null; then
    domain_ip=$(dig +short "$DOMAIN" | head -n1)
    if [[ -n "$domain_ip" ]]; then
        check_pass "DNS resolves $DOMAIN to $domain_ip"
        
        server_ip=$(curl -s ifconfig.me || echo "")
        if [[ "$domain_ip" == "$server_ip" ]]; then
            check_pass "DNS points to this server"
        else
            check_warn "DNS points to $domain_ip but server IP is $server_ip"
        fi
    else
        check_warn "DNS does not resolve $DOMAIN"
    fi
fi

# Check internet connectivity
if curl -sf https://google.com > /dev/null 2>&1; then
    check_pass "Internet connectivity OK"
else
    check_fail "No internet connectivity"
fi

# Final Summary
section "VALIDATION SUMMARY"

total=$((passed + failed + warnings))

echo ""
echo -e "${GREEN}Passed:${NC}   $passed/$total"
echo -e "${RED}Failed:${NC}   $failed/$total"
echo -e "${YELLOW}Warnings:${NC} $warnings/$total"
echo ""

if [[ $failed -eq 0 ]]; then
    echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ Installation is VALID             ║${NC}"
    echo -e "${GREEN}║  System is ready for production!     ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
    exit 0
elif [[ $failed -le 2 ]]; then
    echo -e "${YELLOW}╔═══════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  ⚠️  Installation has minor issues   ║${NC}"
    echo -e "${YELLOW}║  Review failed checks above          ║${NC}"
    echo -e "${YELLOW}╚═══════════════════════════════════════╝${NC}"
    exit 1
else
    echo -e "${RED}╔═══════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ❌ Installation FAILED                ║${NC}"
    echo -e "${RED}║  Please fix the issues above         ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════╝${NC}"
    exit 2
fi
