# F3 Fitness Gym - Ubuntu VPS Deployment Guide

This guide will help you deploy the F3 Fitness application on an Ubuntu VPS and connect it to your domain `f3fitness.in` using Cloudflare DNS.

## Prerequisites

- Ubuntu 20.04/22.04/24.04 VPS with root access
- Domain: `f3fitness.in` managed via Cloudflare
- GitHub repository: `https://github.com/iamhemantkumawat/f3fitness.git`

## Quick Start (One-Click Setup)

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Download and run the setup script
curl -fsSL https://raw.githubusercontent.com/iamhemantkumawat/f3fitness/main/setup.sh | bash
```

Or manually:

```bash
git clone https://github.com/iamhemantkumawat/f3fitness.git /opt/f3fitness
cd /opt/f3fitness
chmod +x setup.sh
./setup.sh
```

---

## Step-by-Step Manual Deployment

### Step 1: Update System & Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git build-essential software-properties-common

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Yarn
sudo npm install -g yarn

# Install Python 3.11+
sudo apt install -y python3 python3-pip python3-venv

# Install MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Install Nginx
sudo apt install -y nginx

# Install Supervisor
sudo apt install -y supervisor
```

### Step 2: Clone the Repository

```bash
# Create application directory
sudo mkdir -p /opt/f3fitness
cd /opt/f3fitness

# Clone the repository
git clone https://github.com/iamhemantkumawat/f3fitness.git .
```

### Step 3: Configure Backend

```bash
cd /opt/f3fitness/backend

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create backend .env file
cat > .env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=f3fitness
CORS_ORIGINS=https://f3fitness.in,https://www.f3fitness.in,https://dashboard.f3fitness.in
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
EOF
```

**Important:** Edit the `.env` file and replace:
- `JWT_SECRET` with a strong random string (use `openssl rand -hex 32`)
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` with your Razorpay credentials

### Step 4: Configure Frontend

```bash
cd /opt/f3fitness/frontend

# Install Node dependencies
yarn install

# Create frontend .env file
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=https://dashboard.f3fitness.in
EOF

# Build the frontend for production
yarn build
```

### Step 5: Configure Supervisor (Process Manager)

Create supervisor configuration for backend:

```bash
sudo cat > /etc/supervisor/conf.d/f3fitness-backend.conf << 'EOF'
[program:f3fitness-backend]
directory=/opt/f3fitness/backend
command=/opt/f3fitness/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
user=www-data
autostart=true
autorestart=true
stderr_logfile=/var/log/f3fitness/backend.err.log
stdout_logfile=/var/log/f3fitness/backend.out.log
environment=PATH="/opt/f3fitness/backend/venv/bin"
EOF
```

Create log directory and update supervisor:

```bash
sudo mkdir -p /var/log/f3fitness
sudo chown -R www-data:www-data /var/log/f3fitness
sudo chown -R www-data:www-data /opt/f3fitness

sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start f3fitness-backend
```

### Step 6: Configure Nginx (Web Server & Reverse Proxy)

Create Nginx configuration:

```bash
sudo cat > /etc/nginx/sites-available/f3fitness << 'EOF'
# Main Dashboard App (dashboard.f3fitness.in)
server {
    listen 80;
    server_name dashboard.f3fitness.in;

    # Frontend static files
    root /opt/f3fitness/frontend/build;
    index index.html;

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

    # Redirect to dashboard for now (or serve separate landing page)
    return 301 https://dashboard.f3fitness.in$request_uri;
}
EOF
```

Enable the site and restart Nginx:

```bash
sudo ln -sf /etc/nginx/sites-available/f3fitness /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: Configure Cloudflare DNS

1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain `f3fitness.in`
3. Go to **DNS** > **Records**
4. Add the following **A Records**:

| Type | Name | Content (IPv4) | Proxy Status | TTL |
|------|------|----------------|--------------|-----|
| A | `@` | `YOUR_VPS_IP` | Proxied | Auto |
| A | `www` | `YOUR_VPS_IP` | Proxied | Auto |
| A | `dashboard` | `YOUR_VPS_IP` | Proxied | Auto |

Replace `YOUR_VPS_IP` with your actual VPS IP address.

### Step 8: Enable SSL with Cloudflare (Recommended)

Since you're using Cloudflare, SSL is handled automatically. Configure these settings:

1. Go to **SSL/TLS** > **Overview**
2. Set encryption mode to **Full** or **Full (Strict)**

3. Go to **SSL/TLS** > **Edge Certificates**
4. Enable **Always Use HTTPS**

Update Nginx to work with Cloudflare SSL:

```bash
sudo cat > /etc/nginx/sites-available/f3fitness << 'EOF'
# Main Dashboard App (dashboard.f3fitness.in)
server {
    listen 80;
    server_name dashboard.f3fitness.in;

    # Frontend static files
    root /opt/f3fitness/frontend/build;
    index index.html;

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

# Landing Page Redirect
server {
    listen 80;
    server_name f3fitness.in www.f3fitness.in;
    return 301 https://dashboard.f3fitness.in$request_uri;
}
EOF

sudo nginx -t && sudo systemctl reload nginx
```

### Step 9: Verify Deployment

```bash
# Check MongoDB status
sudo systemctl status mongod

# Check Backend status
sudo supervisorctl status f3fitness-backend

# Check Nginx status
sudo systemctl status nginx

# Test backend API
curl http://localhost:8001/api/health

# Check logs if issues
sudo tail -f /var/log/f3fitness/backend.err.log
sudo tail -f /var/log/nginx/error.log
```

---

## Post-Deployment Configuration

### Configure SMTP & Twilio (Admin Panel)

1. Open `https://dashboard.f3fitness.in`
2. Login as admin: `admin@f3fitness.in` / `admin123`
3. Go to **Settings** > **Notifications**
4. Configure SMTP settings for email notifications
5. Configure Twilio settings for WhatsApp notifications

### Change Default Admin Password

**Important:** Change the default admin password immediately after deployment!

### Configure Razorpay (Optional)

1. Get your Razorpay API keys from [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Update `/opt/f3fitness/backend/.env`:
   ```
   RAZORPAY_KEY_ID=rzp_live_xxxxx
   RAZORPAY_KEY_SECRET=xxxxx
   ```
3. Restart backend: `sudo supervisorctl restart f3fitness-backend`

---

## Useful Commands

```bash
# Restart backend
sudo supervisorctl restart f3fitness-backend

# View backend logs
sudo tail -f /var/log/f3fitness/backend.out.log
sudo tail -f /var/log/f3fitness/backend.err.log

# Restart Nginx
sudo systemctl restart nginx

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Update application
cd /opt/f3fitness
git pull origin main
cd frontend && yarn install && yarn build
sudo supervisorctl restart f3fitness-backend
```

---

## Troubleshooting

### Backend not starting
```bash
# Check logs
sudo tail -50 /var/log/f3fitness/backend.err.log

# Check if port 8001 is in use
sudo lsof -i :8001

# Test manually
cd /opt/f3fitness/backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001
```

### MongoDB connection issues
```bash
# Check MongoDB status
sudo systemctl status mongod

# Restart MongoDB
sudo systemctl restart mongod

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

### 502 Bad Gateway
```bash
# Backend might not be running
sudo supervisorctl status f3fitness-backend
sudo supervisorctl restart f3fitness-backend
```

### Permission issues
```bash
sudo chown -R www-data:www-data /opt/f3fitness
sudo chown -R www-data:www-data /var/log/f3fitness
```

---

## Security Recommendations

1. **Change JWT Secret:** Generate a strong secret using `openssl rand -hex 32`
2. **Change Admin Password:** Update immediately after first login
3. **Enable UFW Firewall:**
   ```bash
   sudo ufw allow ssh
   sudo ufw allow http
   sudo ufw allow https
   sudo ufw enable
   ```
4. **Regular Updates:** Keep your system updated with `sudo apt update && sudo apt upgrade`
5. **MongoDB Security:** Consider enabling authentication for MongoDB in production

---

## Architecture Overview

```
                    Internet
                        |
                   Cloudflare
                   (SSL/CDN)
                        |
                     Nginx
                    (Port 80)
                        |
        +---------------+---------------+
        |                               |
   Static Files              API Requests
   (React Build)              (/api/*)
        |                               |
   /opt/f3fitness/             FastAPI Backend
   frontend/build              (Port 8001)
                                        |
                                    MongoDB
                                 (Port 27017)
```

---

## Support

For issues or questions, contact:
- GitHub: https://github.com/iamhemantkumawat/f3fitness
- Email: [Your support email]
