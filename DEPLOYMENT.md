# F3 Fitness Gym - Ubuntu VPS Deployment Guide

## Quick Deploy (One-Click Setup)

After cloning the repository, run the setup script:

```bash
# Clone the repository
git clone https://github.com/iamhemantkumawat/f3fitness.git
cd f3fitness

# Make the setup script executable and run it
chmod +x setup.sh
sudo ./setup.sh
```

---

## Prerequisites

- Ubuntu 20.04/22.04 LTS VPS (minimum 2GB RAM, 2 vCPU recommended)
- Domain: f3fitness.in (with Cloudflare DNS)
- Root/sudo access to the server

---

## Step-by-Step Manual Deployment

### Step 1: Initial Server Setup

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git build-essential software-properties-common
```

### Step 2: Install Node.js 18.x

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version
npm --version

# Install yarn globally
sudo npm install -g yarn
```

### Step 3: Install Python 3.10+

```bash
# Install Python and pip
sudo apt install -y python3 python3-pip python3-venv

# Verify installation
python3 --version
pip3 --version
```

### Step 4: Install MongoDB

```bash
# Import MongoDB GPG key
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update and install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Start and enable MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify MongoDB is running
sudo systemctl status mongod
```

### Step 5: Install Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Step 6: Install Supervisor

```bash
# Install supervisor
sudo apt install -y supervisor

# Start and enable supervisor
sudo systemctl start supervisor
sudo systemctl enable supervisor
```

### Step 7: Clone and Setup Application

```bash
# Create application directory
sudo mkdir -p /var/www/f3fitness
sudo chown $USER:$USER /var/www/f3fitness

# Clone repository
cd /var/www
git clone https://github.com/iamhemantkumawat/f3fitness.git f3fitness
cd f3fitness
```

### Step 8: Setup Backend

```bash
cd /var/www/f3fitness/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=f3_fitness_prod
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
EOF

# Deactivate virtual environment
deactivate
```

### Step 9: Setup Frontend

```bash
cd /var/www/f3fitness/frontend

# Install dependencies
yarn install

# Create production .env
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=https://f3fitness.in
EOF

# Build for production
yarn build
```

### Step 10: Configure Supervisor

Create backend supervisor config:

```bash
sudo cat > /etc/supervisor/conf.d/f3fitness-backend.conf << 'EOF'
[program:f3fitness-backend]
command=/var/www/f3fitness/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
directory=/var/www/f3fitness/backend
user=www-data
autostart=true
autorestart=true
stderr_logfile=/var/log/f3fitness/backend.err.log
stdout_logfile=/var/log/f3fitness/backend.out.log
environment=PATH="/var/www/f3fitness/backend/venv/bin"
EOF

# Create log directory
sudo mkdir -p /var/log/f3fitness
sudo chown www-data:www-data /var/log/f3fitness

# Reload supervisor
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start f3fitness-backend
```

### Step 11: Configure Nginx

```bash
sudo cat > /etc/nginx/sites-available/f3fitness << 'EOF'
server {
    listen 80;
    server_name f3fitness.in www.f3fitness.in;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name f3fitness.in www.f3fitness.in;

    # SSL Configuration (Cloudflare Origin Certificate)
    ssl_certificate /etc/ssl/f3fitness/origin.pem;
    ssl_certificate_key /etc/ssl/f3fitness/origin-key.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Frontend (React build)
    root /var/www/f3fitness/frontend/build;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # API routes proxy to backend
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Frontend routes (SPA support)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static file caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/f3fitness /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## Cloudflare DNS Setup

### Step 1: Add A Records

In your Cloudflare dashboard for f3fitness.in:

1. Go to **DNS** > **Records**
2. Add the following records:

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| A | @ | YOUR_VPS_IP | Proxied (Orange cloud) | Auto |
| A | www | YOUR_VPS_IP | Proxied (Orange cloud) | Auto |

Replace `YOUR_VPS_IP` with your actual VPS IP address.

### Step 2: SSL/TLS Settings

1. Go to **SSL/TLS** > **Overview**
2. Set encryption mode to **Full (strict)**

### Step 3: Generate Origin Certificate

1. Go to **SSL/TLS** > **Origin Server**
2. Click **Create Certificate**
3. Keep default settings (RSA 2048, 15 years validity)
4. Click **Create**
5. Copy the **Origin Certificate** and **Private Key**

### Step 4: Install Origin Certificate on Server

```bash
# Create SSL directory
sudo mkdir -p /etc/ssl/f3fitness

# Create certificate file (paste your Origin Certificate)
sudo nano /etc/ssl/f3fitness/origin.pem

# Create private key file (paste your Private Key)
sudo nano /etc/ssl/f3fitness/origin-key.pem

# Set proper permissions
sudo chmod 600 /etc/ssl/f3fitness/origin-key.pem
sudo chmod 644 /etc/ssl/f3fitness/origin.pem
```

### Step 5: Cloudflare Page Rules (Optional)

1. Go to **Rules** > **Page Rules**
2. Add rule: `*f3fitness.in/*` - **Always Use HTTPS**

---

## Environment Variables Configuration

### Backend (.env)

Edit `/var/www/f3fitness/backend/.env`:

```bash
MONGO_URL=mongodb://localhost:27017
DB_NAME=f3_fitness_prod
JWT_SECRET=generate-a-strong-random-secret-key-here

# SMTP Settings (configure in admin panel or here)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Twilio WhatsApp (configure in admin panel or here)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Razorpay (when ready)
RAZORPAY_KEY_ID=your-key-id
RAZORPAY_KEY_SECRET=your-key-secret
```

### Frontend (.env)

Edit `/var/www/f3fitness/frontend/.env`:

```bash
REACT_APP_BACKEND_URL=https://f3fitness.in
```

---

## Seed Initial Data

```bash
# Activate backend virtual environment
cd /var/www/f3fitness/backend
source venv/bin/activate

# Run seed script (creates admin user)
curl -X POST http://localhost:8001/api/seed

# Deactivate
deactivate
```

**Default Admin Credentials:**
- Email: admin@f3fitness.com
- Password: admin123

**IMPORTANT:** Change the admin password after first login!

---

## Useful Commands

### Check Service Status

```bash
# Check all services
sudo systemctl status mongod
sudo systemctl status nginx
sudo supervisorctl status

# Check backend logs
sudo tail -f /var/log/f3fitness/backend.out.log
sudo tail -f /var/log/f3fitness/backend.err.log

# Check Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Restart Services

```bash
# Restart backend
sudo supervisorctl restart f3fitness-backend

# Restart Nginx
sudo systemctl restart nginx

# Restart MongoDB
sudo systemctl restart mongod
```

### Update Application

```bash
cd /var/www/f3fitness

# Pull latest changes
git pull origin main

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
deactivate
sudo supervisorctl restart f3fitness-backend

# Update frontend
cd ../frontend
yarn install
yarn build
```

---

## Firewall Setup (UFW)

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

---

## Troubleshooting

### Backend not starting
```bash
# Check logs
sudo tail -50 /var/log/f3fitness/backend.err.log

# Check if port 8001 is in use
sudo lsof -i :8001

# Manually test backend
cd /var/www/f3fitness/backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001
```

### MongoDB connection issues
```bash
# Check MongoDB status
sudo systemctl status mongod

# Check MongoDB logs
sudo tail -50 /var/log/mongodb/mongod.log

# Test connection
mongosh
```

### Nginx 502 Bad Gateway
```bash
# Check if backend is running
sudo supervisorctl status f3fitness-backend

# Check Nginx error logs
sudo tail -50 /var/log/nginx/error.log

# Verify backend is accessible
curl http://localhost:8001/api/health
```

### SSL Certificate Issues
```bash
# Test SSL configuration
sudo nginx -t

# Check certificate expiry
openssl x509 -in /etc/ssl/f3fitness/origin.pem -noout -dates
```

---

## Security Recommendations

1. **Change default passwords** - Update admin password immediately
2. **Enable MongoDB authentication** - Add user authentication to MongoDB
3. **Regular updates** - Keep system packages updated
4. **Backup database** - Set up automated MongoDB backups
5. **Monitor logs** - Set up log monitoring and alerts
6. **Rate limiting** - Configure Nginx rate limiting for API endpoints

---

## Support

For issues or questions:
- Email: info@f3fitness.in
- Phone: 072300 52193

---

*Last updated: February 2026*
