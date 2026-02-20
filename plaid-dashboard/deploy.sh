#!/bin/bash
# ============================================================
# NF6 Family Office Financial Dashboard - Hostinger VPS Deploy
# Run this script ON your Hostinger VPS after SSH-ing in
# ============================================================

set -e
echo ""
echo "=========================================="
echo "  NF6 Family Office Dashboard - Deploy"
echo "=========================================="
echo ""

# 1. Install Node.js 22 if not present
if ! command -v node &> /dev/null; then
    echo "[1/6] Installing Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
else
    echo "[1/6] Node.js already installed: $(node --version)"
fi

# 2. Install PM2 globally
if ! command -v pm2 &> /dev/null; then
    echo "[2/6] Installing PM2 process manager..."
    npm install -g pm2
else
    echo "[2/6] PM2 already installed"
fi

# 3. Install Nginx if not present
if ! command -v nginx &> /dev/null; then
    echo "[3/6] Installing Nginx..."
    apt-get update -qq
    apt-get install -y nginx
else
    echo "[3/6] Nginx already installed"
fi

# 4. Set up the application
APP_DIR="/opt/nf6-dashboard"
echo "[4/6] Setting up application in $APP_DIR..."

if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    git pull origin claude/plaid-financial-dashboard-YvPTS
else
    git clone https://github.com/brandoncheema-ops/Test-Brandon.git "$APP_DIR"
    cd "$APP_DIR"
    git checkout claude/plaid-financial-dashboard-YvPTS
fi

# Install server dependencies
echo "  Installing server dependencies..."
cd "$APP_DIR/plaid-dashboard/server"
npm install --production

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "  Creating .env file..."
    cat > .env << 'ENVEOF'
PLAID_CLIENT_ID=6997417fe8a45f001e390093
PLAID_SECRET=08b872e451d778ce028d2b5952693b
PLAID_ENV=sandbox
PORT=8000
ENVEOF
    echo "  .env created with sandbox credentials"
fi

# Install client dependencies and build
echo "  Installing client dependencies & building..."
cd "$APP_DIR/plaid-dashboard/client"
npm install
npm run build

echo "  React build complete!"

# 5. Set up PM2
echo "[5/6] Starting application with PM2..."
cd "$APP_DIR/plaid-dashboard/server"
pm2 delete nf6-dashboard 2>/dev/null || true
pm2 start server.js --name nf6-dashboard
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# 6. Set up Nginx
echo "[6/6] Configuring Nginx..."
cat > /etc/nginx/sites-available/nf6-dashboard << 'NGINXEOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
NGINXEOF

# Enable the site
ln -sf /etc/nginx/sites-available/nf6-dashboard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
nginx -t
systemctl restart nginx
systemctl enable nginx

echo ""
echo "=========================================="
echo "  DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "  Your dashboard is live at:"
echo "  http://194.195.92.224"
echo ""
echo "  Useful commands:"
echo "  pm2 logs nf6-dashboard    - View app logs"
echo "  pm2 restart nf6-dashboard - Restart the app"
echo "  pm2 status                - Check app status"
echo ""
echo "  To add SSL later:"
echo "  apt install certbot python3-certbot-nginx"
echo "  certbot --nginx -d yourdomain.com"
echo ""
