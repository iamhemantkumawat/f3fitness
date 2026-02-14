# F3 Fitness Health Club - Gym Management System

A comprehensive gym management web application for F3 Fitness Gym, Jaipur.

![F3 Fitness](https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png)

## Features

- **Member Management** - Add, edit, disable members with profile photos
- **Attendance Tracking** - Mark attendance by name, phone, email or member ID
- **Membership Plans** - Create and manage membership plans
- **Payment Management** - Track payments and generate reports
- **Notifications** - Email & WhatsApp notifications for birthdays, renewals, etc.
- **Health Tracking** - Members can track weight, BMI, body fat
- **Admin Dashboard** - Stats, birthdays, renewals, absentees widgets

## Tech Stack

- **Frontend**: React 19, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Notifications**: SMTP Email, Twilio WhatsApp

---

## Quick Installation (Ubuntu VPS)

### One-Click Setup

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Clone and run setup script
git clone https://github.com/iamhemantkumawat/f3fitness.git /opt/f3fitness
cd /opt/f3fitness
chmod +x setup.sh
./setup.sh
```

### Manual Installation

#### 1. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g yarn

# Install Python 3
sudo apt install -y python3 python3-pip python3-venv

# Install MongoDB 7.0
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl start mongod && sudo systemctl enable mongod

# Install Nginx & Supervisor
sudo apt install -y nginx supervisor
```

#### 2. Setup Backend

```bash
cd /opt/f3fitness/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file
cat > .env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=f3fitness
CORS_ORIGINS=https://f3fitness.in,https://dashboard.f3fitness.in
JWT_SECRET=your-secret-key-here
EOF
```

#### 3. Setup Frontend

```bash
cd /opt/f3fitness/frontend

# Create .env
echo "REACT_APP_BACKEND_URL=https://dashboard.f3fitness.in" > .env

# Install and build
yarn install
yarn build
```

#### 4. Configure Supervisor

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
EOF

sudo mkdir -p /var/log/f3fitness
sudo chown -R www-data:www-data /opt/f3fitness /var/log/f3fitness
sudo supervisorctl reread && sudo supervisorctl update
```

#### 5. Configure Nginx

```bash
sudo cat > /etc/nginx/sites-available/f3fitness << 'EOF'
server {
    listen 80;
    server_name dashboard.f3fitness.in f3fitness.in www.f3fitness.in;

    root /opt/f3fitness/frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/f3fitness /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

#### 6. Seed Database

```bash
cd /opt/f3fitness/backend
source venv/bin/activate
python3 ../seed_db.py
```

---

## DNS Configuration (Cloudflare)

Add these A records pointing to your VPS IP:

| Type | Name | Content |
|------|------|---------|
| A | @ | YOUR_VPS_IP |
| A | www | YOUR_VPS_IP |
| A | dashboard | YOUR_VPS_IP |

Set SSL/TLS mode to **"Full"**

---

## Default Login

- **Email**: admin@f3fitness.in
- **Password**: admin123

⚠️ **Change password immediately after first login!**

---

## Update Commands

### Update from GitHub

```bash
cd /opt/f3fitness
git pull origin main
cd frontend && yarn build
sudo supervisorctl restart f3fitness-backend
```

### View Logs

```bash
# Backend logs
sudo tail -f /var/log/f3fitness/backend.out.log
sudo tail -f /var/log/f3fitness/backend.err.log

# Nginx logs
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

### Check Service Status

```bash
sudo supervisorctl status f3fitness-backend
sudo systemctl status nginx
sudo systemctl status mongod
```

---

## Configuration

### SMTP Settings (Admin Panel)
Configure email notifications in Admin Panel > Settings > SMTP

### WhatsApp Settings (Admin Panel)
Configure Twilio WhatsApp in Admin Panel > Settings > WhatsApp

### Razorpay (Optional)
Add to `/opt/f3fitness/backend/.env`:
```
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
```

---

## File Structure

```
/opt/f3fitness/
├── backend/
│   ├── server.py      # FastAPI application
│   ├── requirements.txt
│   └── .env           # Backend config
├── frontend/
│   ├── src/           # React source
│   ├── build/         # Production build
│   └── .env           # Frontend config
├── setup.sh           # Installation script
├── seed_db.py         # Database seeder
└── README.md
```

---

## Support

- **Location**: 4th Avenue Plot No 4R-B, Sector 4, Vidyadhar Nagar, Jaipur
- **Phone**: 072300 52193
- **Email**: info@f3fitness.in
- **Instagram**: @f3fitnessclub

---

## License

Private - F3 Fitness Gym
