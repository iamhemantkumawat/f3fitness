# F3 Fitness Gym Management App - PRD

## Original Problem Statement
Build a complete gym management webapp for "F3 Fitness Gym" from Jaipur with:
- Landing page at f3fitness.in
- Dashboard portal at f3fitness.in/dashboard
- WhatsApp OTP verification for signup
- Email notifications with beautiful templates
- PT packages and trainer assignment
- Health tracking (weight, BMI, body fat)
- Diet and workout plans (PDF + built-in editor)
- Birthday/holiday notifications
- Regular absent member tracking

## User Choices
- Database: MongoDB
- WhatsApp Integration: Twilio (sandbox testing enabled)
- SMTP: Configurable via admin settings
- Payment Gateway: Razorpay
- Design: Dark theme with cyan/orange accents

## Contact Information
- Phone: 072300 52193
- Email: info@f3fitness.in
- Instagram: @f3fitnessclub
- Address: 4th Avenue Plot No 4R-B, Mode, near Mandir Marg, Sector 4, Vidyadhar Nagar, Jaipur, Rajasthan 302039

## Architecture
- **Backend**: FastAPI with MongoDB (Motor async driver)
- **Frontend**: React 19 with Tailwind CSS + Shadcn UI
- **Authentication**: JWT-based with OTP verification
- **Routes**: Landing (/) → Dashboard (/dashboard/*)

## What's Been Implemented (February 2026)

### Bug Fixes - Session 2
- ✅ **SMTP Integration Fixed** - Changed from `use_tls=True` to `start_tls=True` for port 587 (STARTTLS)
- ✅ **WhatsApp Integration Fixed** - Phone numbers now cleaned of spaces/dashes for E.164 format

### Landing Page (f3fitness.in)
- ✅ Hero section with rotating gym images
- ✅ About section
- ✅ Services/Facilities showcase
- ✅ Trainers section
- ✅ BMI Calculator
- ✅ Maintenance Calories Calculator
- ✅ Membership plans preview
- ✅ Testimonials section
- ✅ Contact section with map, address, phone, email, Instagram
- ✅ Opening hours
- ✅ Login/Signup buttons

### Dashboard Portal (/dashboard/*)
- ✅ Admin Dashboard with enhanced stats:
  - Today's birthdays widget
  - Upcoming birthdays (7 days) widget
  - Upcoming renewals widget
  - Regular absentees (7+ days) widget
- ✅ Member management with PT assignment
- ✅ Payment management with reports
- ✅ Attendance tracking
- ✅ Plans CRUD (with PT sessions option)
- ✅ PT Packages CRUD
- ✅ Announcements, Holidays, Templates
- ✅ SMTP & WhatsApp settings (with working test buttons)

### Authentication
- ✅ **OTP-based Signup Flow** - 2-step process:
  - Step 1: Enter details with +91 default country code
  - Step 2: Verify WhatsApp OTP and Email OTP
- ✅ JWT-based login
- ✅ Forgot password flow

### Member Features
- ✅ **Health Tracking Page** - Log weight, BMI, body fat
  - Auto-calculates BMI from weight and height
  - Shows progress history with color-coded BMI categories
  - Weight change tracking

### Backend APIs
- ✅ OTP send/verify (WhatsApp + Email)
- ✅ Signup with OTP verification
- ✅ BMI Calculator API
- ✅ Maintenance Calories Calculator API
- ✅ Health logs (weight, BMI, body fat)
- ✅ Diet plans (PDF + structured)
- ✅ Workout plans (PDF + structured)
- ✅ PT package management
- ✅ Template management
- ✅ Testimonials CRUD
- ✅ Regular absentees detection

### Integrations
- ✅ Twilio WhatsApp (WORKING)
  - Account SID: AC90629793b1b80228b667f3a239ffb773
  - Sandbox: +14155238886
- ✅ SMTP Email (WORKING)
- ⏳ Razorpay (placeholder)

## Twilio Sandbox Testing
To test WhatsApp:
1. Send "join <sandbox-keyword>" from your phone to +14155238886
2. Then test messages will work to your number

## Admin Credentials
- Email: admin@f3fitness.com
- Password: admin123

## Test Member Credentials
- Email: testmember_102810@example.com
- Password: test123

## Prioritized Backlog

### P0 (Critical) - COMPLETED
- ✅ SMTP bug fix
- ✅ WhatsApp bug fix

### P1 (High Priority) - PARTIALLY COMPLETE
- ✅ OTP signup flow UI with +91 default
- ✅ Admin Dashboard birthdays/renewals widgets
- ✅ Member health tracking page
- ⏳ Diet/Workout plan creation UI for trainers
- ⏳ Template editor in admin panel (rich text)
- ⏳ Scheduled birthday/renewal notifications (cron)

### P2 (Medium Priority)
- Razorpay payment verification flow
- Instagram feed integration on landing page
- PDF export for reports
- QR code check-in

### P3 (Low Priority)
- Dark/Light theme toggle
- Multi-language support
- Mobile app (React Native)

## Next Tasks
1. Create Diet/Workout plan editor UI for trainers/admins
2. Build Template Management UI with rich text editor
3. Implement scheduled notification cron jobs
4. Integrate Razorpay for online payments
5. Create deployment guide for Ubuntu VPS

## Test Reports
- /app/test_reports/iteration_2.json - SMTP/WhatsApp bug fixes
- /app/test_reports/iteration_3.json - New features (OTP, Dashboard widgets, Health Tracking)
