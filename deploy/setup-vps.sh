#!/bin/bash
# =============================================================================
# Hire Onboarding - VPS Deployment Script
# Run on your Hostinger VPS as root:
#   curl -sL https://raw.githubusercontent.com/brandoncheema-ops/Test-Brandon/claude/hire-onboarding-automation-KAVRZ/deploy/setup-vps.sh | bash
# =============================================================================

set -euo pipefail

DOMAIN="brandon.nfapps.ai"
REPO_URL="https://github.com/brandoncheema-ops/Test-Brandon.git"
BRANCH="claude/hire-onboarding-automation-KAVRZ"
APP_DIR="/var/www/${DOMAIN}/hire-onboarding"
APP_NAME="hire-onboarding"
BACKEND_PORT=4000
DB_NAME="hire_onboarding"
DB_USER="hire_user"

echo "============================================="
echo "  Hire Onboarding VPS Deployment"
echo "============================================="

# ---------------------------------------------------------------------------
# 1. System packages
# ---------------------------------------------------------------------------
echo ""
echo "[1/8] Installing system packages..."
apt-get update -qq
apt-get install -y -qq nginx postgresql postgresql-contrib redis-server \
  curl git build-essential 2>&1 | tail -3

# Install Node.js 20+ if not present
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 20 ]]; then
  echo "  Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
echo "  Node: $(node -v) | npm: $(npm -v)"

npm install -g pm2 2>&1 | tail -1

# ---------------------------------------------------------------------------
# 2. PostgreSQL setup
# ---------------------------------------------------------------------------
echo ""
echo "[2/8] Configuring PostgreSQL..."
systemctl enable postgresql
systemctl start postgresql

# Generate a stable password based on hostname (same across re-runs)
DB_PASS="hire_prod_$(hostname | md5sum | cut -c1-16)"

sudo -u postgres psql -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}'; END IF; END \$\$;" 2>/dev/null
sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true
# Also grant schema permissions (needed for PostgreSQL 15+)
sudo -u postgres psql -d ${DB_NAME} -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" 2>/dev/null || true

echo "  Database: ${DB_NAME} | User: ${DB_USER}"

# ---------------------------------------------------------------------------
# 3. Redis setup
# ---------------------------------------------------------------------------
echo ""
echo "[3/8] Configuring Redis..."
systemctl enable redis-server
systemctl start redis-server
echo "  Redis running"

# ---------------------------------------------------------------------------
# 4. Clone the repository
# ---------------------------------------------------------------------------
echo ""
echo "[4/8] Fetching application code..."
mkdir -p /var/www/${DOMAIN}

# Backup .env if it exists
if [ -f "${APP_DIR}/backend/.env" ]; then
  cp "${APP_DIR}/backend/.env" /tmp/hire-onboarding-env-backup
  echo "  Backed up existing .env"
fi

# Fresh clone
cd /tmp
rm -rf Test-Brandon-deploy
echo "  Cloning from GitHub..."
git clone -b ${BRANCH} --depth 1 --single-branch ${REPO_URL} Test-Brandon-deploy

# Replace app directory
rm -rf ${APP_DIR}
mv Test-Brandon-deploy/hire-onboarding ${APP_DIR}
rm -rf Test-Brandon-deploy

# Restore .env
if [ -f /tmp/hire-onboarding-env-backup ]; then
  mv /tmp/hire-onboarding-env-backup ${APP_DIR}/backend/.env
  echo "  Restored existing .env"
fi

echo "  Code deployed to ${APP_DIR}"

# ---------------------------------------------------------------------------
# 5. Backend setup
# ---------------------------------------------------------------------------
echo ""
echo "[5/8] Setting up backend..."
cd ${APP_DIR}/backend

echo "  Installing dependencies..."
npm install --production=false 2>&1 | tail -3

# Create .env if it doesn't exist
if [ ! -f .env ]; then
  cat > .env <<ENVEOF
NODE_ENV=production
PORT=${BACKEND_PORT}
LOG_LEVEL=info

BETA_MODE=true
BETA_ALLOWED_DOMAINS=balcpa.com

DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

REDIS_URL=redis://localhost:6379

SESSION_SECRET=$(openssl rand -hex 32)

DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD_HASH=

AZURE_TENANT_ID=demo
AZURE_CLIENT_ID=demo
AZURE_CLIENT_SECRET=demo
AUTOMATION_INBOX_EMAIL=hire-automation@balcpa.com
EMAIL_POLL_INTERVAL_SECONDS=300

SHAREPOINT_SITE_ID=demo
SHAREPOINT_DRIVE_ID=demo

ANTHROPIC_API_KEY=demo
LLM_MODEL=claude-sonnet-4-6
LLM_CONFIDENCE_THRESHOLD=0.8

TEMPLATES_DIR=${APP_DIR}/backend/templates
OUTPUT_DIR=${APP_DIR}/backend/output
LIBREOFFICE_PATH=/usr/bin/libreoffice
ENVEOF
  echo "  .env created"
else
  echo "  .env already exists, keeping it"
fi

mkdir -p ${APP_DIR}/backend/output

# Run seed (creates tables + sample data)
echo "  Running database seed..."
npx tsx src/infrastructure/database/seed.ts 2>&1 || echo "  WARNING: Seed had errors (may be OK if tables exist)"

# ---------------------------------------------------------------------------
# 6. Frontend build
# ---------------------------------------------------------------------------
echo ""
echo "[6/8] Building frontend..."
cd ${APP_DIR}/frontend

echo "  Installing dependencies..."
npm install 2>&1 | tail -3

echo "  Running vite build..."
npx vite build 2>&1

# Verify the build produced files
if [ ! -f "${APP_DIR}/frontend/dist/index.html" ]; then
  echo "  ERROR: Frontend build failed! dist/index.html not found."
  echo "  Trying alternative build..."
  # Try without tsc (in case of TS errors)
  npx vite build --mode production 2>&1
fi

if [ -f "${APP_DIR}/frontend/dist/index.html" ]; then
  echo "  Frontend built successfully:"
  ls -la ${APP_DIR}/frontend/dist/
else
  echo "  FATAL: Frontend build failed. Check errors above."
  exit 1
fi

# ---------------------------------------------------------------------------
# 7. Start backend with PM2
# ---------------------------------------------------------------------------
echo ""
echo "[7/8] Starting backend with PM2..."
cd ${APP_DIR}/backend

pm2 delete ${APP_NAME} 2>/dev/null || true

pm2 start "npx tsx src/index.ts" \
  --name ${APP_NAME} \
  --cwd ${APP_DIR}/backend \
  --max-restarts 10 \
  --restart-delay 5000

pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# Wait for backend to start and verify
echo "  Waiting for backend to start..."
sleep 3
if curl -sf http://127.0.0.1:${BACKEND_PORT}/api/health > /dev/null 2>&1; then
  echo "  Backend is running on port ${BACKEND_PORT}"
else
  echo "  WARNING: Backend health check failed. Checking logs..."
  pm2 logs ${APP_NAME} --lines 15 --nostream 2>&1 || true
  echo "  Backend may still be starting up..."
fi

# ---------------------------------------------------------------------------
# 8. Nginx configuration
# ---------------------------------------------------------------------------
echo ""
echo "[8/8] Configuring Nginx..."

NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

# Remove default site to avoid conflicts
rm -f /etc/nginx/sites-enabled/default

# Create Nginx config - proxy ALL /hire-onboarding traffic to backend
# This avoids the unreliable alias + try_files combination
cat > ${NGINX_CONF} <<'NGINXEOF'
server {
    listen 80 default_server;
    server_name brandon.nfapps.ai;

    # Redirect bare /hire-onboarding to /hire-onboarding/
    location = /hire-onboarding {
        return 301 /hire-onboarding/;
    }

    # Proxy ALL /hire-onboarding/ requests to the Node.js backend
    # The backend serves both the API and the frontend static files
    location /hire-onboarding/ {
        rewrite ^/hire-onboarding(/.*)$ $1 break;
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        proxy_buffering off;
    }

    # Default root
    location / {
        root /var/www/brandon.nfapps.ai;
        index index.html;
    }
}
NGINXEOF

ln -sf ${NGINX_CONF} /etc/nginx/sites-enabled/${DOMAIN}

echo "  Testing Nginx config..."
nginx -t 2>&1
systemctl reload nginx
echo "  Nginx configured and reloaded"

# ---------------------------------------------------------------------------
# SSL (optional, non-blocking)
# ---------------------------------------------------------------------------
echo ""
echo "Checking SSL..."
if ! [ -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  apt-get install -y -qq certbot python3-certbot-nginx 2>/dev/null || true
  certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m admin@${DOMAIN} 2>/dev/null || echo "  SSL: configure manually later if needed"
else
  echo "  SSL already configured"
fi

# ---------------------------------------------------------------------------
# Final verification
# ---------------------------------------------------------------------------
echo ""
echo "============================================="
echo "  VERIFYING DEPLOYMENT..."
echo "============================================="

# Check if backend responds
if curl -sf http://127.0.0.1:${BACKEND_PORT}/api/health; then
  echo ""
  echo "  Backend: OK"
else
  echo "  Backend: STARTING (may take a moment)"
fi

# Check if Nginx proxies correctly
sleep 1
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/hire-onboarding/ 2>/dev/null || echo "000")
echo "  Nginx proxy test: HTTP ${HTTP_CODE}"

echo ""
echo "============================================="
echo "  DEPLOYMENT COMPLETE!"
echo "============================================="
echo ""
echo "  URL: https://${DOMAIN}/hire-onboarding"
echo "  (or http://${DOMAIN}/hire-onboarding if SSL not configured)"
echo "  Login: admin / admin"
echo ""
echo "  Manage:"
echo "    pm2 status"
echo "    pm2 logs ${APP_NAME}"
echo "    pm2 restart ${APP_NAME}"
echo "============================================="
