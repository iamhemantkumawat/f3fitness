# F3 Fitness - Quick Deployment Reference Card

## One-Click Deployment

```bash
ssh root@YOUR_VPS_IP
curl -fsSL https://raw.githubusercontent.com/iamhemantkumawat/f3fitness/main/setup.sh | bash
```

## Cloudflare DNS Setup

Add these A Records in Cloudflare DNS:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | YOUR_VPS_IP | Proxied |
| A | www | YOUR_VPS_IP | Proxied |
| A | dashboard | YOUR_VPS_IP | Proxied |

**SSL/TLS Settings:** Set to "Full"

## After Deployment

1. **Login:** https://dashboard.f3fitness.in
   - Email: `admin@f3fitness.in`
   - Password: `admin123`

2. **Change Admin Password** (Important!)

3. **Configure Settings:**
   - SMTP for emails
   - Twilio for WhatsApp
   - Razorpay for payments

## Quick Commands

```bash
# View logs
sudo tail -f /var/log/f3fitness/backend.out.log

# Restart backend
sudo supervisorctl restart f3fitness-backend

# Update app
cd /opt/f3fitness && git pull && cd frontend && yarn build && sudo supervisorctl restart f3fitness-backend
```

## File Locations

- App: `/opt/f3fitness/`
- Backend Logs: `/var/log/f3fitness/`
- Nginx Config: `/etc/nginx/sites-available/f3fitness`
- Supervisor Config: `/etc/supervisor/conf.d/f3fitness-backend.conf`
