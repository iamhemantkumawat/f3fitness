#!/bin/bash

#############################################
# F3 Fitness Gym - One-Click Setup Script
# For Ubuntu 20.04/22.04/24.04 VPS
#############################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/opt/f3fitness"
REPO_URL="https://github.com/iamhemantkumawat/f3fitness.git"
DOMAIN="dashboard.f3fitness.in"
BACKEND_PORT=8001

echo -e "${BLUE}"
echo "=============================================="
echo "   F3 Fitness Gym - VPS Setup Script"
echo "=============================================="
echo -e "${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_step() {
    echo -e "\n${BLUE}>>> $1${NC}\n"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Detect Ubuntu version
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    print_error "Cannot detect OS version"
    exit 1
fi

print_status "Detected: $OS $VER"

#############################################
# Step 1: Update System
#############################################
print_step "Step 1: Updating System Packages"

apt update && apt upgrade -y
apt install -y curl wget git build-essential software-properties-common gnupg lsb-release

print_status "System updated"

#############################################
# Step 2: Install Node.js 20.x
#############################################
print_step "Step 2: Installing Node.js 20.x"

if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    npm install -g yarn
    print_status "Node.js $(node --version) installed"
else
    print_status "Node.js already installed: $(node --version)"
fi

#############################################
# Step 3: Install Python 3
#############################################
print_step "Step 3: Installing Python 3"

apt install -y python3 python3-pip python3-venv
print_status "Python $(python3 --version) installed"

#############################################
# Step 4: Install MongoDB 7.0
#############################################
print_step "Step 4: Installing MongoDB 7.0"

if ! command -v mongod &> /dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    
    # Detect Ubuntu codename
    UBUNTU_CODENAME=$(lsb_release -cs)
    
    # MongoDB supports: focal (20.04), jammy (22.04), noble (24.04)
    if [[ "$UBUNTU_CODENAME" == "noble" ]]; then
        echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    else
        echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${UBUNTU_CODENAME}/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    fi
    
    apt update
    apt install -y mongodb-org
    
    systemctl start mongod
    systemctl enable mongod
    print_status "MongoDB installed and started"
else
    print_status "MongoDB already installed"
fi

#############################################
# Step 5: Install Nginx
#############################################
print_step "Step 5: Installing Nginx"

apt install -y nginx
systemctl enable nginx
print_status "Nginx installed"

#############################################
# Step 6: Install Supervisor
#############################################
print_step "Step 6: Installing Supervisor"

apt install -y supervisor
systemctl enable supervisor
print_status "Supervisor installed"

#############################################
# Step 7: Clone Repository
#############################################
print_step "Step 7: Cloning F3 Fitness Repository"

if [ -d "$APP_DIR" ]; then
    print_warning "Directory $APP_DIR exists. Pulling latest changes..."
    cd $APP_DIR
    git pull origin main || git pull origin master
else
    git clone $REPO_URL $APP_DIR
    print_status "Repository cloned to $APP_DIR"
fi

#############################################
# Step 8: Setup Backend
#############################################
print_step "Step 8: Setting up Backend"

cd $APP_DIR/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 32)

# Create .env file if not exists
if [ ! -f .env ]; then
    cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=f3fitness
CORS_ORIGINS=https://f3fitness.in,https://www.f3fitness.in,https://dashboard.f3fitness.in,http://localhost:3000
JWT_SECRET=${JWT_SECRET}
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
EOF
    print_status "Backend .env created with secure JWT secret"
else
    print_warning "Backend .env already exists, skipping..."
fi

deactivate

#############################################
# Step 9: Setup Frontend
#############################################
print_step "Step 9: Setting up Frontend"

cd $APP_DIR/frontend

# Create .env file
cat > .env << EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
EOF

# Install dependencies and build
yarn install
yarn build

print_status "Frontend built successfully"

#############################################
# Step 10: Configure Supervisor
#############################################
print_step "Step 10: Configuring Supervisor"

# Create log directory
mkdir -p /var/log/f3fitness

# Create supervisor config
cat > /etc/supervisor/conf.d/f3fitness-backend.conf << EOF
[program:f3fitness-backend]
directory=${APP_DIR}/backend
command=${APP_DIR}/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port ${BACKEND_PORT}
user=www-data
autostart=true
autorestart=true
stderr_logfile=/var/log/f3fitness/backend.err.log
stdout_logfile=/var/log/f3fitness/backend.out.log
environment=PATH="${APP_DIR}/backend/venv/bin"
EOF

# Set permissions
chown -R www-data:www-data $APP_DIR
chown -R www-data:www-data /var/log/f3fitness

# Reload supervisor
supervisorctl reread
supervisorctl update
supervisorctl restart f3fitness-backend

print_status "Supervisor configured and backend started"

#############################################
# Step 11: Configure Nginx
#############################################
print_step "Step 11: Configuring Nginx"

cat > /etc/nginx/sites-available/f3fitness << 'NGINXEOF'
# Main Dashboard App (dashboard.f3fitness.in)
server {
    listen 80;
    server_name dashboard.f3fitness.in;

    # Frontend static files
    root /opt/f3fitness/frontend/build;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Handle React Router (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy to Backend
    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        client_max_body_size 50M;
    }

    # Static file caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Landing Page (f3fitness.in & www.f3fitness.in)
server {
    listen 80;
    server_name f3fitness.in www.f3fitness.in;

    # Serve same app for landing page
    root /opt/f3fitness/frontend/build;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        client_max_body_size 50M;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINXEOF

# Enable site
ln -sf /etc/nginx/sites-available/f3fitness /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
nginx -t && systemctl reload nginx

print_status "Nginx configured"

#############################################
# Step 12: Configure Firewall (UFW)
#############################################
print_step "Step 12: Configuring Firewall"

if command -v ufw &> /dev/null; then
    ufw allow ssh
    ufw allow http
    ufw allow https
    ufw --force enable
    print_status "Firewall configured (SSH, HTTP, HTTPS allowed)"
else
    print_warning "UFW not installed, skipping firewall setup"
fi

#############################################
# Step 13: Final Status Check
#############################################
print_step "Step 13: Verifying Installation"

echo ""
echo "Service Status:"
echo "---------------"

# Check MongoDB
if systemctl is-active --quiet mongod; then
    print_status "MongoDB: Running"
else
    print_error "MongoDB: Not Running"
fi

# Check Backend
if supervisorctl status f3fitness-backend | grep -q "RUNNING"; then
    print_status "Backend: Running"
else
    print_error "Backend: Not Running"
fi

# Check Nginx
if systemctl is-active --quiet nginx; then
    print_status "Nginx: Running"
else
    print_error "Nginx: Not Running"
fi

# Test backend API
if curl -s http://localhost:${BACKEND_PORT}/api/health > /dev/null 2>&1; then
    print_status "Backend API: Responding"
else
    print_warning "Backend API: May need a moment to start"
fi

#############################################
# Complete!
#############################################
echo ""
echo -e "${GREEN}"
echo "=============================================="
echo "   Setup Complete!"
echo "=============================================="
echo -e "${NC}"
echo ""
echo "Next Steps:"
echo "-----------"
echo "1. Configure Cloudflare DNS with these A records:"
echo "   - Type: A, Name: @, Content: $(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_VPS_IP')"
echo "   - Type: A, Name: www, Content: $(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_VPS_IP')"
echo "   - Type: A, Name: dashboard, Content: $(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_VPS_IP')"
echo ""
echo "2. In Cloudflare SSL/TLS settings, set mode to 'Full'"
echo ""
echo "3. Access your site:"
echo "   - Dashboard: https://dashboard.f3fitness.in"
echo "   - Landing:   https://f3fitness.in"
echo ""
echo "4. Default Admin Login:"
echo "   - Email: admin@f3fitness.in"
echo "   - Password: admin123"
echo "   - IMPORTANT: Change this password immediately!"
echo ""
echo "5. Configure in Admin Panel:"
echo "   - SMTP settings for email notifications"
echo "   - Twilio settings for WhatsApp"
echo "   - Razorpay keys for payments"
echo ""
echo "Useful Commands:"
echo "----------------"
echo "  View backend logs:    sudo tail -f /var/log/f3fitness/backend.out.log"
echo "  Restart backend:      sudo supervisorctl restart f3fitness-backend"
echo "  Restart nginx:        sudo systemctl restart nginx"
echo "  Update application:   cd /opt/f3fitness && git pull && cd frontend && yarn build && sudo supervisorctl restart f3fitness-backend"
echo ""
echo -e "${YELLOW}Remember to change the default admin password!${NC}"
echo ""
