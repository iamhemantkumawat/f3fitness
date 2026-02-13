# F3 Fitness Gym Management App - PRD

## Original Problem Statement
Build a gym management webapp for "F3 Fitness Gym" from Jaipur that can be deployed on Ubuntu VPS with custom domain support.

## User Choices
- Database: MongoDB
- WhatsApp Integration: Twilio (cost-friendly, pay-as-you-go)
- SMTP: Configurable via admin settings
- Payment Gateway: Razorpay
- Design: Dark theme with cyan/orange accents, using gym's black/white logo

## Architecture
- **Backend**: FastAPI with MongoDB (Motor async driver)
- **Frontend**: React 19 with Tailwind CSS + Shadcn UI
- **Authentication**: JWT-based with bcrypt password hashing
- **Database**: MongoDB collections - users, plans, memberships, payments, payment_requests, attendance, holidays, announcements, settings

## User Personas
1. **Admin**: Gym owner/manager who manages members, payments, attendance, and settings
2. **Member**: Gym member who views plans, tracks attendance, and manages profile
3. **Trainer**: Gym trainer who manages assigned clients

## Core Requirements
- Multi-role authentication (admin, member, trainer)
- Member management with unique Member IDs (F3-XXXX)
- Membership plan management with pricing
- Payment tracking (cash, UPI, card, online)
- Attendance tracking with calendar view
- Announcements and holidays management
- SMTP and WhatsApp configuration

## What's Been Implemented (January 2026)

### Backend APIs
- ✅ Authentication (login, signup, forgot password, reset)
- ✅ Users CRUD with role-based access
- ✅ Plans CRUD
- ✅ Memberships with plan queuing
- ✅ Payments with summaries
- ✅ Payment requests for counter payments
- ✅ Attendance marking and history
- ✅ Holidays CRUD
- ✅ Announcements CRUD
- ✅ Settings (SMTP, WhatsApp)
- ✅ Dashboard stats
- ✅ Razorpay order creation (placeholder verification)

### Frontend Pages
- ✅ Login/Signup/Forgot Password
- ✅ Admin Dashboard with stats
- ✅ Member management (list, create, detail, assign plan)
- ✅ Payment management (list, add, reports, pending)
- ✅ Attendance (mark, today report, history)
- ✅ Settings (plans, announcements, holidays, SMTP, WhatsApp)
- ✅ Profile management
- ✅ Member Dashboard with calendar
- ✅ Member Plans page
- ✅ Trainer Dashboard with clients

### Integrations
- ✅ Twilio WhatsApp (configured, needs credentials)
- ✅ SMTP Email (configurable via admin)
- ✅ Razorpay (order creation implemented)

## Prioritized Backlog

### P0 (Critical)
- None remaining

### P1 (High Priority)
- Razorpay payment verification flow
- Diet/Workout plan upload for trainers
- Member edit functionality
- Membership expiry notifications

### P2 (Medium Priority)
- Password change in profile
- Bulk SMS/WhatsApp notifications
- Export reports to PDF/Excel
- Member check-in via QR code

### P3 (Low Priority)
- Dark/Light theme toggle
- Multi-language support
- Advanced analytics dashboard
- Mobile app (React Native)

## Next Tasks
1. Complete Razorpay payment verification
2. Add member edit page
3. Implement trainer diet/workout upload
4. Add automated expiry notifications
5. Create deployment script for Ubuntu VPS

## Admin Credentials
- Email: admin@f3fitness.com
- Password: admin123
