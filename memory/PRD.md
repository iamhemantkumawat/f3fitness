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

### Admin Member Management - Session 5
- ✅ **Plan & Expiry Display** - Members list now shows active plan name and expiry date
- ✅ **Avatar Thumbnails** - Profile photos displayed, with default male/female icons for those without
- ✅ **Multi-Select Delete** - Checkbox selection for bulk deleting multiple members
- ✅ **User Status Toggle** - Disable/Enable user accounts with notifications
- ✅ **Admin Password Reset** - Set new password and send via Email/WhatsApp
- ✅ **Revoke Membership** - Cancel active membership with notification
- ✅ **Column Sorting** - Sort by Member ID, Name, Phone, Plan, Expiry (asc/desc)
- ✅ **Status Filter** - Filter by All, Active (with plan), Inactive (no plan), Disabled
- ✅ **Welcome Notifications** - New members receive Email/WhatsApp with login credentials

### Deployment Guide Created - Session 7 (December 2025)
- ✅ **DEPLOYMENT.md** - Comprehensive step-by-step Ubuntu VPS deployment guide
- ✅ **setup.sh** - One-click automated setup script for Ubuntu 20.04/22.04/24.04
- ✅ **QUICK_DEPLOY.md** - Quick reference card for deployment
- ✅ **Cloudflare DNS Instructions** - A record setup for f3fitness.in domain
- ✅ **Nginx Configuration** - Reverse proxy setup for API and SPA routing
- ✅ **Supervisor Configuration** - Process management for backend
- ✅ **Security Recommendations** - JWT secret, firewall, admin password guidance

### Bug Fixes & Enhancements - Session 6
- ✅ **Edit Member Route Fixed** - Edit button now navigates to edit page correctly (was redirecting to home)
- ✅ **Joining Date Field** - Added to Create and Edit member forms (defaults to today)
- ✅ **Profile Photo Editing** - Admin can update member's profile photo via edit page
- ✅ **Landing Page Updates:**
  - Updated trainer names: Faizan Khan, Rizwan Khan, Faizal Khan
  - Added Instagram Reels testimonials section with 4 embedded posts
  - Fixed Google Maps location with Plus Code: XQ5P+6G Jaipur, Rajasthan
  - Added @f3fitnessclub Instagram handle link

### Bug Fixes - Session 4
- ✅ **Signup Flow Fixed** - Context now properly updates after signup (uses login flow to update auth state)
- ✅ **Forgot Password UI** - Complete 3-step flow (Enter email → Enter OTP + new password → Success)
- ✅ **Duplicate Account Prevention** - Backend properly rejects duplicate email/phone during OTP send

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

### Authentication - COMPLETE
- ✅ **OTP-based Signup Flow** - 2-step process:
  - Step 1: Enter details with +91 default country code
  - Step 2: Verify single OTP (sent to both WhatsApp + Email)
  - Auto-login after successful signup
- ✅ **Duplicate Prevention** - Rejects existing email/phone at OTP send stage
- ✅ JWT-based login (works with email or phone)
- ✅ **Forgot Password Flow** - Complete 3-step OTP-based reset:
  - Step 1: Enter email or phone
  - Step 2: Enter OTP + new password + confirm password
  - Step 3: Success confirmation
- ✅ **Change Password** - Available in user profile

### Member Features
- ✅ **Health Tracking Page** - Log weight, BMI, body fat
  - Auto-calculates BMI from weight and height
  - Shows progress history with color-coded BMI categories
  - Weight change tracking
- ✅ **Calorie Tracker** - Daily calorie intake logging
- ✅ **Member Profile Page** - View and edit personal information
- ✅ **Profile Photo Upload** - Backend ready, UI integrated

### Backend APIs
- ✅ OTP send/verify (WhatsApp + Email)
- ✅ Signup with OTP verification
- ✅ Forgot Password + Reset Password
- ✅ Change Password
- ✅ BMI Calculator API
- ✅ Maintenance Calories Calculator API
- ✅ Health logs (weight, BMI, body fat)
- ✅ Calorie logs
- ✅ Diet plans (PDF + structured)
- ✅ Workout plans (PDF + structured)
- ✅ PT package management
- ✅ Template management
- ✅ Testimonials CRUD
- ✅ Regular absentees detection
- ✅ Profile photo upload

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
- Email: context_test@example.com
- Password: testpass123

## Prioritized Backlog

### P0 (Critical) - COMPLETED ✅
- ✅ SMTP bug fix
- ✅ WhatsApp bug fix
- ✅ Signup flow bug fix (body stream already read)
- ✅ Duplicate account prevention
- ✅ Forgot Password UI flow
- ✅ Trainer password reset bug fix (Session 8)
- ✅ Theme toggle bug fix (Session 8)

### P1 (High Priority) - COMPLETED ✅
- ✅ OTP signup flow UI with +91 default
- ✅ Admin Dashboard birthdays/renewals widgets
- ✅ Member health tracking page
- ✅ Calorie tracker
- ✅ Change password feature
- ✅ Member profile page
- ✅ Dark/Light theme toggle (Session 8)
- ✅ Broadcast feature - WhatsApp & Email (Session 8)
- ✅ Email Templates management (Session 8)
- ✅ WhatsApp Templates management (Session 8)

### P2 (Medium Priority) - IN PROGRESS
- ⏳ Razorpay payment integration
- ⏳ Diet/Workout plan creation UI for trainers
- ⏳ Template editor in admin panel (rich text)
- ⏳ Invoice generation with payments
- ⏳ PDF export for reports
- ⏳ Instagram feed integration on landing page

### P3 (Low Priority) - BACKLOG
- Scheduled birthday/renewal notifications (cron)
- QR code check-in
- ✅ ~~Dark/Light theme toggle~~ - COMPLETED Session 8
- Multi-language support
- Mobile app (React Native)

## Session 8 Updates (February 2026)

### Bug Fixes
- ✅ **Trainer Password Reset** - Fixed API call from `adminResetPassword` to `resetPassword` 
- ✅ **Theme Toggle** - Fixed CSS variables for dark/light themes, added ThemeToggle to dashboard header

### New Features
- ✅ **Dark/Light Theme Toggle** - Toggle button in dashboard header with Sun/Moon icons
- ✅ **WhatsApp Broadcast** - Admin can send messages to all/active/inactive members
- ✅ **Email Broadcast** - Admin can send professional HTML emails to members
- ✅ **Email Templates Settings** - Edit and customize automated email notifications
- ✅ **WhatsApp Templates Settings** - Edit and customize automated WhatsApp messages

### New Routes
- `/dashboard/admin/broadcast/whatsapp` - WhatsApp Broadcast page
- `/dashboard/admin/broadcast/email` - Email Broadcast page
- `/dashboard/admin/settings/email-templates` - Email templates management
- `/dashboard/admin/settings/whatsapp-templates` - WhatsApp templates management

### New API Endpoints
- `POST /api/broadcast/whatsapp` - Send WhatsApp broadcast
- `POST /api/broadcast/email?subject=X` - Send Email broadcast  
- `DELETE /api/templates/{type}/{channel}` - Reset template to default

## Session 9 Updates (February 14, 2026)

### Bug Fixes
- ✅ **Backend Server Crash Fixed** - Removed orphaned HTML code (lines 774-781) in server.py that was causing Python SyntaxError
- ✅ **Footer Logo Fix** - Fixed undefined `LOGO_URL` in LandingPage.js footer - now uses theme-aware logos (`LOGO_DARK`/`LOGO_LIGHT`)

### Session 9.1 - Theme & Email Improvements
- ✅ **Light Theme Visibility Fixes** - Fixed landing page colors for light theme:
  - Hero section: Always white text (dark overlay ensures visibility)
  - Services section: Cards now have bg-gray-50 with shadow, dark text
  - About section: bg-gray-100, dark heading, gray-600 body text
  - Trainers section: bg-gray-100 with proper card styling
  - Contact section: bg-gray-100, dark headings, proper icon backgrounds
  - Instagram/Testimonials: Theme-aware backgrounds and text colors
  - CTA section: Theme-aware text colors
- ✅ **Email From Name Updated** - Emails now show "F3 FITNESS HEALTH CLUB" as sender name
- ✅ **Email Template Footer Enhanced** - All email templates now include detailed footer:
  - Full address: 4th Avenue Plot No 4R-B, Mode, near Mandir Marg, Sector 4, Vidyadhar Nagar, Jaipur, Rajasthan 302039
  - Phone: 072300 52193
  - Email: info@f3fitness.in
  - Hours: Mon–Sat: 5:00 AM – 10:00 PM | Sun: 6:00 AM – 12:00 PM
  - Instagram: @f3fitnessclub
- ✅ **Broadcast Email Template Updated** - Same detailed footer as notification emails

### Session 9.2 - Login Page Fix & Template System Improvements
- ✅ **Login Page Light Mode Fix** - Changed hero text colors from `text-foreground` to explicit `text-white` for visibility on dark gradient background
- ✅ **Password Reset Uses Template System** - Forgot password OTP now uses `send_notification()` with the template from database instead of hardcoded HTML
- ✅ **All Email Templates Populated** - Added 12 template types (24 total with email/WhatsApp):
  - welcome, otp, password_reset, attendance, absent_warning
  - birthday, holiday, plan_shared, renewal_reminder
  - membership_activated, payment_received, announcement
- ✅ **Templates Editable in Settings** - All templates visible and editable in Settings > Email Templates page

### Verified Working Features
- ✅ Landing page loads correctly in dark mode
- ✅ Landing page loads correctly in light mode (theme toggle works)
- ✅ Logo displays correctly in navbar and footer
- ✅ Login functionality works with admin credentials
- ✅ Admin dashboard shows all 5 stats cards
- ✅ Dashboard layout shows Upcoming Renewals and Regular Absentees sections
- ✅ Sidebar navigation accessible with all menu items
- ✅ Theme toggle persists across pages
- ✅ Favicon displays correctly

## Next Tasks
1. Integrate Razorpay for online payments
2. Create Diet/Workout plan editor UI for trainers/admins
3. ✅ ~~Build Template Management UI with rich text editor~~ - COMPLETED Session 8
4. Invoice generation and sending with payment notifications
5. ✅ ~~Create deployment guide for Ubuntu VPS~~ - COMPLETED
6. ✅ ~~Logo/Favicon updates with light/dark theme variants~~ - COMPLETED Session 8/9
7. Opening hours update on landing page
8. **Refactor server.py** - Break down monolithic backend into modular structure (routes, models, services)

## Technical Debt
- **server.py Refactoring** - The monolithic backend file (3000+ lines) needs to be split into:
  - `/app/backend/routes/` - API routes
  - `/app/backend/models/` - Pydantic models
  - `/app/backend/services/` - Business logic

## Session 10 Updates (December 2026)

### Email Template System Enhancements
- ✅ **OTP Email Uses Template System** - OTP verification emails now fetch from database templates instead of hardcoded HTML
- ✅ **OTP WhatsApp Uses Template System** - OTP WhatsApp messages now use database templates
- ✅ **New User Credentials Template** - Welcome emails with login credentials (admin-created users) now use `new_user_credentials` template
- ✅ **Test Email Uses Template** - SMTP test emails now use `test_email` template with proper styling
- ✅ **Smart Template Wrapping** - `wrap_email_in_template()` now intelligently detects if content is already a complete styled HTML (user-customized templates) and doesn't double-wrap it

### Custom Membership Dates for Importing Existing Members
- ✅ **Backend Support** - `MembershipCreate` model now accepts optional `custom_start_date` and `custom_end_date` parameters
- ✅ **Frontend UI** - Assign Plan page has "Import Existing Membership" checkbox toggle with custom date fields
- ✅ **Use Case** - Allows admin to import 300+ existing gym members with their current membership dates

### New Template Types Added
- ✅ `new_user_credentials` (email/whatsapp) - For admin-created users with login details
- ✅ `test_email` (email only) - For SMTP test emails
- **Total Templates**: 28 (14 types × 2 channels)

### WhatsApp Error Handling Improved
- ✅ Better error messages when Twilio credentials are missing/invalid
- ✅ Detailed logging for WhatsApp send failures

### Verified Working Features
- ✅ 28 templates returned from GET /api/templates
- ✅ Custom membership dates work in backend
- ✅ Import Existing Membership toggle shows date fields in UI
- ✅ OTP emails use database templates
- ✅ Test emails use template system

### Known Issues
- ⚠️ WhatsApp test returns 500 - Twilio credentials need updating (not a code issue)

## Session 11 Updates (February 2026)

### Import Existing Membership Enhancements
- ✅ **Auto-Calculate End Date** - When start date selected, end date auto-calculates based on plan duration
- ✅ **Auto-Calculate Start Date** - When end date selected, start date auto-calculates based on plan duration
- ✅ **Payment Date Field** - Custom payment date for recording when existing member actually paid
- ✅ **Plan Duration Sync** - Dates recalculate when different plan is selected

### User History Page (New)
- ✅ **Separate Page** - Accessible via View History button in Member Details Quick Actions
- ✅ **Stats Cards** - Total memberships, total paid, attendance count, last visit
- ✅ **Membership History** - All past and current memberships with plan name, dates, status, amounts
- ✅ **Payment History** - All payments with receipt numbers, dates, methods, and Invoice button

### Invoice System (New)
- ✅ **Invoice Modal** - Professional invoice display with gym header, customer details, invoice info
- ✅ **View Invoice** - Click "Invoice" button on any payment to view full invoice
- ✅ **Print Invoice** - Print button opens print dialog
- ✅ **Download Invoice** - Download button generates printable HTML version

### API Endpoints Added
- ✅ `GET /api/users/{userId}/history` - Returns full user history (memberships, payments, stats)
- ✅ `GET /api/invoices/{paymentId}` - Returns invoice details for a specific payment
- ✅ `GET /api/memberships/{membershipId}/payments` - Returns all payments for a membership

## Session 12 Updates (February 2026)

### Invoice System Enhancements
- ✅ **F3 Logo in Invoice** - Professional header with F3 Fitness logo
- ✅ **Detailed Footer** - Address, phone, email, Instagram, opening hours
- ✅ **Invoice in All Payments** - Invoice button added to Admin > All Payments page
- ✅ **Shared InvoiceModal Component** - Reusable component at `/app/frontend/src/components/InvoiceModal.js`

### Member Portal Enhancements
- ✅ **Member History Page** - New page at `/dashboard/member/history` showing membership & payment history
- ✅ **Sidebar Menu** - "My History" link added to member sidebar navigation
- ✅ **Dashboard Buttons** - "View Invoice" and "My History" buttons in membership card
- ✅ **Invoice for Members** - Members can view and download their own invoices

### Admin Dashboard Improvements
- ✅ **Phone Numbers Display** - Regular Absentees shows phone numbers instead of Call button
- ✅ **Increased Scroll Height** - Upcoming Renewals and Regular Absentees now have 400px max-height (was 256px)
- ✅ **Show All Entries** - Scroll to see all entries (15+ members)

### Files Updated/Created
- `/app/frontend/src/components/InvoiceModal.js` - New shared invoice modal component
- `/app/frontend/src/pages/Member/MemberHistory.js` - New member history page
- `/app/frontend/src/pages/Admin/Payments.js` - Added Invoice column
- `/app/frontend/src/pages/Member/Dashboard.js` - Added View Invoice/My History buttons
- `/app/frontend/src/pages/Admin/Dashboard.js` - Phone numbers, increased scroll height

## Test Reports
- /app/test_reports/iteration_2.json - SMTP/WhatsApp bug fixes
- /app/test_reports/iteration_3.json - New features (OTP, Dashboard widgets, Health Tracking)
- /app/test_reports/iteration_4.json - Auth flows (Signup, Login, Forgot Password, Profile)
- /app/test_reports/iteration_5.json - Admin Members Enhancement (100% pass)
- /app/test_reports/iteration_6.json - Bug fixes & Landing page updates (100% pass)
- /app/test_reports/iteration_9.json - Theme & Email improvements (100% pass)
- /app/test_reports/iteration_10.json - Template system & custom membership dates (91% pass)
- /app/test_reports/iteration_11.json - User History, Invoice, Import Membership enhancements (100% pass)
- /app/test_reports/iteration_12.json - Invoice UI with logo/footer, Member portal enhancements (95% pass)

