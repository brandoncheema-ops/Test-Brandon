#!/bin/bash
# =============================================================================
# Hire Onboarding - Full VPS Deployment Script
# Run this on your Hostinger VPS as root:
#   curl -sL https://raw.githubusercontent.com/brandoncheema-ops/Test-Brandon/claude/hire-onboarding-automation-KAVRZ/deploy/setup-vps.sh | bash
# Or copy this file to your server and run: bash setup-vps.sh
# =============================================================================

set -e

DOMAIN="brandon.nfapps.ai"
REPO_URL="https://github.com/brandoncheema-ops/Test-Brandon.git"
BRANCH="claude/hire-onboarding-automation-KAVRZ"
APP_DIR="/var/www/${DOMAIN}/hire-onboarding"
APP_NAME="hire-onboarding"
BACKEND_PORT=4000
DB_NAME="hire_onboarding"
DB_USER="hire_user"
DB_PASS="hire_pass_$(openssl rand -hex 8)"

echo "============================================="
echo "  Hire Onboarding VPS Deployment"
echo "  Domain: ${DOMAIN}"
echo "  Path:   /${APP_NAME}"
echo "============================================="

# ---------------------------------------------------------------------------
# 1. System packages
# ---------------------------------------------------------------------------
echo ""
echo "[1/9] Installing system packages..."
apt-get update -qq
apt-get install -y -qq nginx postgresql postgresql-contrib redis-server \
  curl git build-essential libreoffice-writer 2>/dev/null

# Install Node.js 20 if not present
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 20 ]]; then
  echo "  Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
  apt-get install -y -qq nodejs
fi

echo "  Node: $(node -v) | npm: $(npm -v)"

# Install pm2 globally for process management
npm install -g pm2 2>/dev/null

# ---------------------------------------------------------------------------
# 2. PostgreSQL setup
# ---------------------------------------------------------------------------
echo ""
echo "[2/9] Configuring PostgreSQL..."
systemctl enable postgresql
systemctl start postgresql

# Create user and database (ignore errors if already exists)
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true

echo "  Database: ${DB_NAME} | User: ${DB_USER}"

# ---------------------------------------------------------------------------
# 3. Redis setup
# ---------------------------------------------------------------------------
echo ""
echo "[3/9] Configuring Redis..."
systemctl enable redis-server
systemctl start redis-server

# ---------------------------------------------------------------------------
# 4. Clone / pull the repository
# ---------------------------------------------------------------------------
echo ""
echo "[4/9] Fetching application code..."
mkdir -p /var/www/${DOMAIN}

if [ -d "${APP_DIR}" ]; then
  echo "  Updating existing code..."
  cd "${APP_DIR}"
  git fetch origin ${BRANCH}
  git reset --hard origin/${BRANCH}
else
  echo "  Cloning repository..."
  cd /tmp
  rm -rf Test-Brandon-deploy
  git clone -b ${BRANCH} --single-branch ${REPO_URL} Test-Brandon-deploy
  mv Test-Brandon-deploy/hire-onboarding ${APP_DIR}
  rm -rf Test-Brandon-deploy
fi

cd ${APP_DIR}

# ---------------------------------------------------------------------------
# 5. Backend setup
# ---------------------------------------------------------------------------
echo ""
echo "[5/9] Setting up backend..."
cd ${APP_DIR}/backend

npm install --production=false 2>/dev/null

# Create .env file
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

# Create output directory
mkdir -p ${APP_DIR}/backend/output

# Run migrations and seed
echo "  Running database migrations and seed..."
npx tsx src/infrastructure/database/seed.ts 2>&1 | tail -3

# ---------------------------------------------------------------------------
# 6. Frontend build
# ---------------------------------------------------------------------------
echo ""
echo "[6/9] Building frontend..."
cd ${APP_DIR}/frontend
npm install 2>/dev/null
npx vite build 2>&1 | tail -5

# ---------------------------------------------------------------------------
# 7. Start backend with PM2
# ---------------------------------------------------------------------------
echo ""
echo "[7/9] Starting backend with PM2..."
cd ${APP_DIR}/backend

# Stop existing instance if running
pm2 delete ${APP_NAME} 2>/dev/null || true

pm2 start "npx tsx src/index.ts" \
  --name ${APP_NAME} \
  --cwd ${APP_DIR}/backend \
  --max-restarts 10 \
  --restart-delay 5000

pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo "  Backend running on port ${BACKEND_PORT}"

# ---------------------------------------------------------------------------
# 8. Nginx configuration
# ---------------------------------------------------------------------------
echo ""
echo "[8/9] Configuring Nginx..."

# Check if main server block exists
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

if [ ! -f "${NGINX_CONF}" ]; then
  # Create a new server block
  cat > ${NGINX_CONF} <<NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN};

    root /var/www/${DOMAIN};

    # Hire Onboarding App
    location /hire-onboarding {
        alias ${APP_DIR}/frontend/dist;
        index index.html;
        try_files \$uri \$uri/ /hire-onboarding/index.html;
    }

    location /hire-onboarding/api {
        rewrite ^/hire-onboarding/api(.*) /api\$1 break;
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120s;
    }
}
NGINXEOF
else
  # Append location blocks if not already present
  if ! grep -q "hire-onboarding" ${NGINX_CONF}; then
    # Insert before the last closing brace
    sed -i '/^}/i \
    # Hire Onboarding App\
    location /hire-onboarding {\
        alias '"${APP_DIR}"'/frontend/dist;\
        index index.html;\
        try_files $uri $uri/ /hire-onboarding/index.html;\
    }\
\
    location /hire-onboarding/api {\
        rewrite ^/hire-onboarding/api(.*) /api$1 break;\
        proxy_pass http://127.0.0.1:'"${BACKEND_PORT}"';\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection '"'"'upgrade'"'"';\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_cache_bypass $http_upgrade;\
        proxy_read_timeout 120s;\
    }' ${NGINX_CONF}
  else
    echo "  Nginx location blocks already exist"
  fi
fi

# Enable the site
ln -sf ${NGINX_CONF} /etc/nginx/sites-enabled/${DOMAIN} 2>/dev/null || true

# Test and reload
nginx -t 2>&1
systemctl reload nginx

echo "  Nginx configured and reloaded"

# ---------------------------------------------------------------------------
# 9. SSL with Certbot (if not already set up)
# ---------------------------------------------------------------------------
echo ""
echo "[9/9] Checking SSL..."
if command -v certbot &>/dev/null; then
  if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
    echo "  Setting up SSL with Let's Encrypt..."
    apt-get install -y -qq certbot python3-certbot-nginx 2>/dev/null
    certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m admin@${DOMAIN} 2>/dev/null || echo "  SSL setup skipped (may need manual configuration)"
  else
    echo "  SSL already configured"
  fi
else
  echo "  Installing certbot..."
  apt-get install -y -qq certbot python3-certbot-nginx 2>/dev/null
  certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m admin@${DOMAIN} 2>/dev/null || echo "  SSL setup skipped (may need manual configuration)"
fi

# ---------------------------------------------------------------------------
# Done!
# ---------------------------------------------------------------------------
echo ""
echo "============================================="
echo "  DEPLOYMENT COMPLETE!"
echo "============================================="
echo ""
echo "  URL: https://${DOMAIN}/hire-onboarding"
echo "  Login: admin / admin"
echo ""
echo "  Database password saved in:"
echo "    ${APP_DIR}/backend/.env"
echo ""
echo "  Manage the backend:"
echo "    pm2 status"
echo "    pm2 logs ${APP_NAME}"
echo "    pm2 restart ${APP_NAME}"
echo ""
echo "  To redeploy after code changes:"
echo "    cd ${APP_DIR} && git pull origin ${BRANCH}"
echo "    cd backend && npm install && npx tsx src/infrastructure/database/seed.ts"
echo "    cd ../frontend && npm install && npx vite build"
echo "    pm2 restart ${APP_NAME}"
echo "============================================="
