# -*- coding: utf-8 -*-
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks, Request, Form, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
from jose import JWTError, jwt
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import razorpay
import base64
import aiofiles
import random
import string
import httpx
import json
import asyncio
import qrcode
from contextlib import asynccontextmanager
from io import BytesIO
from logo_base64 import F3_LOGO_BASE64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'f3-fitness-gym-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Create the main app with lifespan
app = FastAPI(title="F3 Fitness Gym API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Health Check Endpoint
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "f3fitness-backend"}

# Security
security = HTTPBearer()

# Razorpay Client (lazy initialization)
razorpay_client = None

def get_razorpay_client():
    global razorpay_client
    key_id = os.environ.get('RAZORPAY_KEY_ID')
    key_secret = os.environ.get('RAZORPAY_KEY_SECRET')
    if key_id and key_secret:
        razorpay_client = razorpay.Client(auth=(key_id, key_secret))
    return razorpay_client

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== PYDANTIC MODELS ====================

# Auth Models
class UserBase(BaseModel):
    name: str
    email: EmailStr
    phone_number: str
    country_code: str = "+91"
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    emergency_phone: Optional[str] = None

class UserCreate(UserBase):
    password: str
    joining_date: Optional[str] = None  # If not provided, defaults to now

class UserLogin(BaseModel):
    email_or_phone: str
    password: str
    rememberMe: bool = False

class UserResponse(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    member_id: Optional[str] = None
    role: str
    joining_date: Optional[str] = None
    profile_photo_url: Optional[str] = None
    trainer_id: Optional[str] = None
    pt_trainer_id: Optional[str] = None
    pt_sessions_remaining: Optional[int] = 0
    created_at: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    country_code: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    joining_date: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    emergency_phone: Optional[str] = None
    profile_photo_url: Optional[str] = None
    trainer_id: Optional[str] = None
    pt_trainer_id: Optional[str] = None
    pt_sessions_remaining: Optional[int] = None
    role: Optional[str] = None
    # Trainer specific fields
    speciality: Optional[str] = None
    instagram_url: Optional[str] = None
    bio: Optional[str] = None
    is_visible_on_website: Optional[bool] = None

class ForgotPasswordRequest(BaseModel):
    email: Optional[str] = None  # Can be email or phone number

class ResetPasswordRequest(BaseModel):
    token: Optional[str] = None
    otp: Optional[str] = None
    new_password: str

# OTP Models
class SendOTPRequest(BaseModel):
    phone_number: str
    country_code: str = "+91"
    email: Optional[EmailStr] = None

class VerifyOTPRequest(BaseModel):
    phone_number: str
    country_code: str = "+91"
    phone_otp: str
    email: Optional[EmailStr] = None
    email_otp: Optional[str] = None

class SignupWithOTP(UserBase):
    password: str
    phone_otp: str
    email_otp: str

# Plan Models
class PlanBase(BaseModel):
    name: str
    duration_days: int
    price: float
    is_active: bool = True
    includes_pt: bool = False
    pt_sessions: int = 0

class PlanCreate(PlanBase):
    pass

class PlanResponse(PlanBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str

# PT Package Models
class PTPackageBase(BaseModel):
    name: str
    sessions: int
    price: float
    validity_days: int
    is_active: bool = True

class PTPackageCreate(PTPackageBase):
    pass

class PTPackageResponse(PTPackageBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str

# Membership Models
class MembershipCreate(BaseModel):
    user_id: str
    plan_id: str
    discount_amount: float = 0
    initial_payment: float = 0
    payment_method: str = "cash"
    # Custom dates for importing existing members with active memberships
    custom_start_date: Optional[str] = None  # Format: YYYY-MM-DD
    custom_end_date: Optional[str] = None    # Format: YYYY-MM-DD
    payment_date: Optional[str] = None       # Format: YYYY-MM-DD (when member actually paid)

class MembershipResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    plan_id: str
    plan_name: Optional[str] = None
    start_date: str
    end_date: str
    status: str
    original_price: float
    discount_amount: float
    final_price: float
    amount_paid: float = 0
    amount_due: float = 0
    created_at: str

class MembershipFreezeRequest(BaseModel):
    freeze_start_date: str  # YYYY-MM-DD
    freeze_end_date: str    # YYYY-MM-DD
    freeze_fee: float = 0
    payment_method: str = "cash"
    notes: Optional[str] = None

class MembershipFreezeEditRequest(BaseModel):
    freeze_start_date: str  # YYYY-MM-DD
    freeze_end_date: str    # YYYY-MM-DD
    freeze_fee: Optional[float] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None

class MembershipFreezeEndRequest(BaseModel):
    end_date: Optional[str] = None  # YYYY-MM-DD, unfreeze effective date (member active on this date), defaults to today

# Payment Models
class PaymentCreate(BaseModel):
    user_id: str
    amount_paid: float
    payment_method: str = "cash"
    notes: Optional[str] = None

class PaymentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    membership_id: Optional[str] = None
    user_id: str
    user_name: Optional[str] = None
    member_id: Optional[str] = None
    amount_paid: float
    payment_date: str
    payment_method: str
    notes: Optional[str] = None
    recorded_by_admin_id: Optional[str] = None

# Payment Request Models
class PaymentRequestCreate(BaseModel):
    plan_id: str

class PaymentRequestResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    user_name: Optional[str] = None
    member_id: Optional[str] = None
    plan_id: str
    plan_name: Optional[str] = None
    plan_price: Optional[float] = None
    status: str
    created_at: str

# Attendance Models
class AttendanceCreate(BaseModel):
    member_id: str

class AttendanceResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    user_name: Optional[str] = None
    member_id: Optional[str] = None
    check_in_time: str
    marked_by: Optional[str] = None  # 'self', 'admin', 'receptionist'
    marked_by_name: Optional[str] = None

# Holiday Models
class HolidayBase(BaseModel):
    holiday_date: str
    name: str

class HolidayCreate(HolidayBase):
    pass

class HolidayResponse(HolidayBase):
    model_config = ConfigDict(extra="ignore")
    id: str

# Announcement Models
class AnnouncementBase(BaseModel):
    title: str
    content: str

class AnnouncementCreate(AnnouncementBase):
    pass

class AnnouncementResponse(AnnouncementBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str

# Settings Models
class SMTPSettings(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_pass: str
    smtp_secure: bool = True
    sender_email: str
    admin_test_email: Optional[str] = ""

class WhatsAppSettings(BaseModel):
    whatsapp_provider: str = "twilio"  # twilio | fast2sms | evolution
    twilio_account_sid: Optional[str] = ""
    twilio_auth_token: Optional[str] = ""
    twilio_whatsapp_number: Optional[str] = ""
    use_sandbox: bool = True
    sandbox_url: Optional[str] = None
    fast2sms_api_key: Optional[str] = ""
    fast2sms_base_url: Optional[str] = "https://www.fast2sms.com"
    fast2sms_waba_number: Optional[str] = ""  # optional sender / business number if required by account
    fast2sms_phone_number_id: Optional[str] = ""
    fast2sms_use_template_api: bool = False
    # Fast2SMS template message IDs (can be changed from Admin > WhatsApp Settings)
    # Some defaults may be pending approval; they will work after Fast2SMS marks them APPROVED.
    fast2sms_template_otp_message_id: Optional[str] = "13503"
    fast2sms_template_password_reset_message_id: Optional[str] = "13754"
    fast2sms_template_welcome_message_id: Optional[str] = "13750"
    fast2sms_template_new_user_credentials_message_id: Optional[str] = ""
    fast2sms_template_membership_activated_message_id: Optional[str] = "13752"
    fast2sms_template_payment_received_message_id: Optional[str] = "13753"
    fast2sms_template_invoice_sent_message_id: Optional[str] = "13755"
    evolution_api_base_url: Optional[str] = ""
    evolution_api_key: Optional[str] = ""
    evolution_instance_name: Optional[str] = "f3fitness"
    evolution_instance_token: Optional[str] = ""
    admin_whatsapp_test_numbers: Optional[str] = ""  # comma separated
    attendance_confirmation_whatsapp_enabled: bool = True
    attendance_confirmation_email_enabled: bool = True
    absent_warning_whatsapp_enabled: bool = True

class SettingsResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "1"
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_secure: Optional[bool] = True
    sender_email: Optional[str] = None
    admin_test_email: Optional[str] = None
    whatsapp_provider: Optional[str] = "twilio"
    twilio_account_sid: Optional[str] = None
    twilio_whatsapp_number: Optional[str] = None
    use_sandbox: Optional[bool] = True
    fast2sms_base_url: Optional[str] = "https://www.fast2sms.com"
    fast2sms_waba_number: Optional[str] = None
    fast2sms_phone_number_id: Optional[str] = None
    fast2sms_use_template_api: Optional[bool] = False
    fast2sms_template_otp_message_id: Optional[str] = "13503"
    fast2sms_template_password_reset_message_id: Optional[str] = "13754"
    fast2sms_template_welcome_message_id: Optional[str] = "13750"
    fast2sms_template_new_user_credentials_message_id: Optional[str] = ""
    fast2sms_template_membership_activated_message_id: Optional[str] = "13752"
    fast2sms_template_payment_received_message_id: Optional[str] = "13753"
    fast2sms_template_invoice_sent_message_id: Optional[str] = "13755"
    evolution_api_base_url: Optional[str] = None
    evolution_instance_name: Optional[str] = "f3fitness"
    admin_whatsapp_test_numbers: Optional[str] = None
    attendance_confirmation_whatsapp_enabled: Optional[bool] = True
    attendance_confirmation_email_enabled: Optional[bool] = True
    absent_warning_whatsapp_enabled: Optional[bool] = True

# Template Models
class TemplateUpdate(BaseModel):
    template_type: str  # welcome, attendance, absent_warning, birthday, holiday, plan_shared, renewal_reminder
    channel: str  # email or whatsapp
    subject: Optional[str] = None  # for email
    content: str

class TemplateResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    template_type: str
    channel: str
    subject: Optional[str] = None
    content: str

class TemplateTestSendRequest(BaseModel):
    template_type: str
    channel: str  # email | whatsapp
    recipient: str
    subject: Optional[str] = None
    content: Optional[str] = None

class AttendanceConfirmationWhatsAppToggle(BaseModel):
    enabled: bool = True

class AttendanceConfirmationEmailToggle(BaseModel):
    enabled: bool = True

class AbsentWarningWhatsAppToggle(BaseModel):
    enabled: bool = True

# Lead Task Management Models
class LeadTaskUpdateRequest(BaseModel):
    called_status: str  # answered | not_answered
    remarks: Optional[str] = None
    recall_date: Optional[str] = None  # YYYY-MM-DD
    renewal_when: Optional[str] = None
    gym_visit_when: Optional[str] = None
    mark_done: bool = True

# Health Tracking Models
class HealthLogCreate(BaseModel):
    weight: Optional[float] = None  # kg
    body_fat: Optional[float] = None  # percentage
    height: Optional[float] = None  # cm for BMI calculation
    notes: Optional[str] = None

class HealthLogResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    weight: Optional[float] = None
    body_fat: Optional[float] = None
    height: Optional[float] = None
    bmi: Optional[float] = None
    notes: Optional[str] = None
    logged_at: str

# Calorie Tracking Models
class CalorieLogCreate(BaseModel):
    calories: int
    protein: Optional[int] = None
    carbs: Optional[int] = None
    fats: Optional[int] = None
    meal_type: Optional[str] = None  # breakfast, lunch, dinner, snack
    food_items: Optional[str] = None
    notes: Optional[str] = None

class CalorieGoalUpdate(BaseModel):
    target_calories: int
    goal_type: str = "maintenance"  # maintenance, deficit, surplus

class CalorieLogResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    calories: int
    protein: Optional[int] = None
    carbs: Optional[int] = None
    fats: Optional[int] = None
    meal_type: Optional[str] = None
    food_items: Optional[str] = None
    notes: Optional[str] = None
    logged_at: str
    date: str

class CalorieSummaryResponse(BaseModel):
    date: str
    total_calories: int
    total_protein: Optional[int] = None
    total_carbs: Optional[int] = None
    total_fats: Optional[int] = None
    target_calories: int
    difference: int
    goal_type: str

# Diet/Workout Plan Models
class MealItem(BaseModel):
    time: str
    meal_name: str
    items: List[str]
    calories: Optional[int] = None
    protein: Optional[int] = None
    carbs: Optional[int] = None
    fats: Optional[int] = None

class DietPlanCreate(BaseModel):
    user_id: str
    title: str
    description: Optional[str] = None
    meals: Optional[List[MealItem]] = None
    pdf_url: Optional[str] = None
    notes: Optional[str] = None

class DietPlanResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    created_by: str
    title: str
    description: Optional[str] = None
    meals: Optional[List[dict]] = None
    pdf_url: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    is_active: bool = True

class ExerciseItem(BaseModel):
    name: str
    sets: int
    reps: str
    rest_seconds: Optional[int] = None
    notes: Optional[str] = None

class WorkoutDay(BaseModel):
    day: str  # Monday, Tuesday, etc.
    focus: str  # Chest, Back, Legs, etc.
    exercises: List[ExerciseItem]

class WorkoutPlanCreate(BaseModel):
    user_id: str
    title: str
    description: Optional[str] = None
    days: Optional[List[WorkoutDay]] = None
    pdf_url: Optional[str] = None
    notes: Optional[str] = None

class WorkoutPlanResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    created_by: str
    title: str
    description: Optional[str] = None
    days: Optional[List[dict]] = None
    pdf_url: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    is_active: bool = True

# Dashboard Stats
class DashboardStats(BaseModel):
    total_members: int
    active_memberships: int
    today_collection: float
    present_today: int
    absent_today: int
    today_birthdays: List[dict] = []
    upcoming_birthdays: List[dict] = []
    upcoming_renewals: List[dict] = []
    regular_absentees: List[dict] = []

# Razorpay Models
class RazorpayOrderCreate(BaseModel):
    plan_id: str

class RazorpayOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str

class RazorpayPaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_id: str

# Testimonial Models
class TestimonialCreate(BaseModel):
    name: str
    role: str = "Member"
    content: str
    rating: int = 5
    image_url: Optional[str] = None

class TestimonialResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    role: str
    content: str
    rating: int
    image_url: Optional[str] = None
    is_active: bool = True
    created_at: str

# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_access_token(data: dict, remember_me: bool = False) -> str:
    to_encode = data.copy()
    # Extended expiry for remember me (30 days) vs normal (24 hours)
    expire_hours = 30 * 24 if remember_me else ACCESS_TOKEN_EXPIRE_HOURS
    expire = datetime.now(timezone.utc) + timedelta(hours=expire_hours)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def generate_otp(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))

async def log_activity(user_id: str, action: str, description: str, ip_address: str = None, metadata: dict = None):
    """Log user activity"""
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "description": description,
        "ip_address": ip_address,
        "metadata": metadata or {},
        "timestamp": get_ist_now().isoformat()
    })

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def get_admin_or_receptionist(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "receptionist"]:
        raise HTTPException(status_code=403, detail="Admin or receptionist access required")
    return current_user

async def get_trainer_or_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "trainer"]:
        raise HTTPException(status_code=403, detail="Trainer or admin access required")
    return current_user

async def generate_member_id() -> str:
    last_user = await db.users.find_one(sort=[("member_id", -1)], projection={"member_id": 1})
    if last_user and last_user.get("member_id"):
        try:
            num = int(last_user["member_id"].split("-")[1]) + 1
        except:
            num = 1
    else:
        num = 1
    return f"F3-{num:04d}"

def get_ist_now():
    """Get current time in IST"""
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz)

def get_ist_today_start():
    """Get today's start in IST (midnight)"""
    ist_now = get_ist_now()
    return datetime(ist_now.year, ist_now.month, ist_now.day, 0, 0, 0)

def get_ist_today_end():
    """Get today's end in IST"""
    ist_now = get_ist_now()
    return datetime(ist_now.year, ist_now.month, ist_now.day, 23, 59, 59)

def wrap_email_in_template(content: str, title: str = "F3 Fitness Notification") -> str:
    """Wrap email content in professional F3 Fitness template - light/white theme with detailed footer.
    If content already appears to be a complete HTML email (has its own styling), returns it as-is with DOCTYPE wrapper.
    """
    # Check if content is already a complete styled email (user-customized template)
    content_stripped = content.strip()
    is_complete_email = (
        content_stripped.startswith('<!DOCTYPE') or
        content_stripped.startswith('<html') or
        (content_stripped.startswith('<div') and 'style=' in content_stripped[:200] and ('max-width' in content_stripped[:300] or 'background' in content_stripped[:300]))
    )
    
    if is_complete_email:
        # Content is already a complete styled email, just wrap in basic HTML structure
        return f'''<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
</head>
<body style="margin:0; padding:0; font-family: Arial, sans-serif; background: #f4f6f8;">
{content}
</body>
</html>'''
    
    # Simple content - wrap in full professional template
    return f'''<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
body {{ margin:0; padding:0; font-family: 'Poppins', Arial, sans-serif; background: linear-gradient(135deg,#f4f6f8,#eef1f5); }}
.wrapper {{ padding:40px 15px; }}
.container {{ max-width:620px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 15px 40px rgba(0,0,0,0.08); border:1px solid #eaeaea; }}
.top-accent {{ height:6px; background: linear-gradient(135deg,#0ea5b7,#0b7285); }}
.header {{ padding:35px 30px 25px 30px; text-align:center; background:linear-gradient(135deg,#0ea5b7,#0b7285); }}
.logo {{ max-width:160px; margin-bottom:10px; }}
.tagline {{ font-size:13px; letter-spacing:2px; text-transform:uppercase; color:#e0f2fe; margin-top:5px; font-weight:600; }}
.content {{ padding:40px 35px 35px 35px; color:#374151; font-size:16px; line-height:1.7; }}
.content h2 {{ margin-top:0; font-size:24px; color:#111827; }}
.highlight-box {{ background:#f0f9ff; border-left:4px solid #0ea5b7; padding:18px; border-radius:6px; margin:25px 0; font-size:14px; color:#0f766e; }}
.button {{ display:inline-block; margin-top:25px; background: linear-gradient(135deg,#0ea5b7,#0b7285); color:#ffffff; padding:14px 32px; text-decoration:none; border-radius:50px; font-weight:600; font-size:14px; letter-spacing:0.5px; box-shadow:0 8px 20px rgba(14,165,183,0.25); }}
.footer {{ background:#f3f4f6; padding:25px 25px; font-size:14px; color:#6b7280; border-top:1px solid #e5e7eb; text-align:center; line-height:1.7; }}
.footer-title {{ font-size:18px; font-weight:700; color:#111827; margin-bottom:10px; }}
.footer-address {{ max-width:480px; margin:0 auto 15px auto; }}
.footer-contact {{ margin-bottom:10px; }}
.footer-hours {{ margin-bottom:20px; }}
.footer-social {{ color:#0ea5b7; font-weight:700; }}
.footer a {{ color:#0ea5b7; text-decoration:none; font-weight:500; }}
.small {{ margin-top:20px; padding-top:15px; border-top:1px solid #e5e7eb; font-size:11px; color:#9ca3af; }}
.divider {{ height:1px; background:#e5e5e5; margin:25px 0; }}
.otp-code {{ background:#f0f9ff; border:2px solid #0ea5b7; padding:20px; border-radius:10px; text-align:center; font-size:32px; font-weight:700; color:#0b7285; letter-spacing:8px; }}
</style>
</head>
<body>
<div class="wrapper">
  <div class="container">
    <div class="top-accent"></div>
    <div class="header">
      <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" alt="F3 Fitness Logo" class="logo">
      <div class="tagline">TRAIN • TRANSFORM • TRIUMPH</div>
    </div>
    <div class="content">
      {content}
    </div>
    <div class="footer">
      <div class="footer-title">F3 Fitness Health Club</div>
      <div class="footer-address">
        4th Avenue Plot No 4R-B, Mode, near Mandir Marg,<br>
        Sector 4, Vidyadhar Nagar, Jaipur, Rajasthan 302039
      </div>
      <div class="footer-contact">
        📞 072300 52193 &nbsp;|&nbsp; 📧 info@f3fitness.in
      </div>
      <div class="footer-hours">
        🕒 Mon–Sat: 5:00 AM – 10:00 PM &nbsp;|&nbsp; Sun: 6:00 AM – 12:00 PM
      </div>
      <div>
        Follow us on Instagram: <a href="https://instagram.com/f3fitnessclub" class="footer-social">@f3fitnessclub</a>
      </div>
      <div class="small">
        © 2026 F3 Fitness Health Club. All rights reserved.
      </div>
    </div>
  </div>
</div>
</body>
</html>'''

async def get_template(template_type: str, channel: str) -> dict:
    """Get notification template"""
    template = await db.templates.find_one({"template_type": template_type, "channel": channel}, {"_id": 0})
    if template:
        return template
    # Return default templates - now using the wrap_email_in_template for emails
    defaults = {
        ("welcome", "email"): {
            "subject": "Welcome to F3 Fitness Gym! 💪",
            "content": """<h2>Welcome to F3 Fitness 💪</h2>
<p>Hi <strong>{{name}}</strong>,</p>
<p>Thank you for joining F3 Fitness Gym - Jaipur's premier fitness destination.</p>
<div class="highlight-box">
  <strong>Your Member ID:</strong> {{member_id}}<br>
  We're excited to be part of your fitness journey!
</div>
<p>Stay consistent. Stay disciplined. Your transformation starts now.</p>
<center><a href="https://f3fitness.in" class="button">Visit Our Website</a></center>
<div class="divider"></div>
<p style="font-size:13px; color:#777777;">If you have any questions, feel free to reach out to us anytime.</p>"""
        },
        ("otp", "email"): {
            "subject": "Your F3 Fitness OTP Code 🔐",
            "content": """<h2>Verify Your Account 🔐</h2>
<p>Hi <strong>{{name}}</strong>,</p>
<p>Please use the following OTP to verify your account:</p>
<div class="otp-code">{{otp}}</div>
<div class="highlight-box">
  This code will expire in 10 minutes. Do not share this code with anyone.
</div>
<p style="font-size:13px; color:#777777;">If you didn't request this code, please ignore this email.</p>"""
        },
        ("otp", "whatsapp"): {
            "content": "🔐 Your F3 Fitness OTP is: *{{otp}}*\n\nThis code expires in 10 minutes. Do not share with anyone."
        },
        ("password_reset", "email"): {
            "subject": "Reset Your F3 Fitness Password 🔑",
            "content": """<h2>Password Reset Request 🔑</h2>
<p>Hi <strong>{{name}}</strong>,</p>
<p>We received a request to reset your password. Your new temporary password is:</p>
<div class="otp-code">{{otp}}</div>
<div class="highlight-box">
  Please log in with this password and change it immediately from your profile settings.
</div>
<p style="font-size:13px; color:#777777;">If you didn't request this, please contact us immediately.</p>"""
        },
        ("password_reset", "whatsapp"): {
            "content": "🔑 Hi {{name}}, your F3 Fitness password has been reset.\n\nYour new temporary password: *{{otp}}*\n\nPlease login and change it immediately from your profile."
        },
        ("welcome", "whatsapp"): {
            "content": "🏋️ Welcome to F3 Fitness Gym, {{name}}!\n\nYour Member ID: *{{member_id}}*\n\nLet's crush your fitness goals together! 💪\n\n- F3 Fitness Team"
        },
        ("attendance", "email"): {
            "subject": "Attendance Marked - F3 Fitness Gym ✅",
            "content": """<h2>Great Job, {{name}}! ✅</h2>
<p>Your attendance has been marked for today.</p>
<div class="highlight-box">
  Keep showing up consistently - that's the key to achieving your fitness goals! 💪
</div>
<p>See you at the gym!</p>
<p><strong>Your F3 Fitness Team</strong></p>"""
        },
        ("attendance", "whatsapp"): {
            "content": "✅ Attendance marked!\n\nGreat job showing up today, {{name}}. Keep the momentum going! 🔥\n\n- F3 Fitness"
        },
        ("absent_warning", "email"): {
            "subject": "We Miss You at F3 Fitness! 😢",
            "content": """<h2>We Miss You, {{name}}! 😢</h2>
<p>It's been <strong>{{days}} days</strong> since your last visit.</p>
<div class="highlight-box">
  Your fitness goals are waiting! Remember: Consistency is key to achieving your dream physique. 💪
</div>
<p>See you soon at the gym!</p>
<center><a href="https://f3fitness.in" class="button">Plan Your Visit</a></center>"""
        },
        ("absent_warning", "whatsapp"): {
            "content": "😢 Hey {{name}},\n\nIt's been {{days}} days since your last gym visit. Your fitness goals miss you!\n\nCome back stronger 💪\n\n- F3 Fitness Team"
        },
        ("birthday", "email"): {
            "subject": "Happy Birthday from F3 Fitness! 🎂",
            "content": """<h2>🎉 Happy Birthday, {{name}}! 🎂</h2>
<p>Wishing you a fantastic birthday filled with health, happiness, and gains!</p>
<div class="highlight-box">
  Here's to another year of crushing your fitness goals! May this year bring you closer to your dream physique.
</div>
<p>Celebrate well and see you at the gym!</p>
<p><strong>Your F3 Fitness Family</strong></p>"""
        },
        ("birthday", "whatsapp"): {
            "content": "🎂 Happy Birthday, {{name}}! 🎉\n\nWishing you a year full of health, happiness and fitness gains!\n\nEnjoy your special day!\n\n- F3 Fitness Gym 💪"
        },
        ("plan_shared", "email"): {
            "subject": "Your New {{plan_type}} Plan is Ready! 📋",
            "content": """<h2>New {{plan_type}} Plan Ready! 📋</h2>
<p>Hi <strong>{{name}}</strong>,</p>
<p>Your trainer has created a new plan for you:</p>
<div class="highlight-box">
  <strong>Plan Type:</strong> {{plan_type}}<br>
  <strong>Title:</strong> {{plan_title}}
</div>
<p>Log in to your dashboard to view the full details.</p>
<center><a href="https://f3fitness.in/login" class="button">View Your Plan</a></center>
<p>Let's achieve your goals together!</p>"""
        },
        ("plan_shared", "whatsapp"): {
            "content": "📋 Hi {{name}}!\n\nYour trainer has created a new {{plan_type}} plan: *{{plan_title}}*\n\nCheck your F3 Fitness dashboard to view it! 💪"
        },
        ("renewal_reminder", "email"): {
            "subject": "Your Membership Expires Soon! ⏰",
            "content": """<h2>Renewal Reminder ⏰</h2>
<p>Hi <strong>{{name}}</strong>,</p>
<div class="highlight-box">
  Your membership expires on <strong>{{expiry_date}}</strong><br>
  <strong>Days Remaining:</strong> {{days_left}} days
</div>
<p>Renew now to continue your fitness journey without interruption!</p>
<center><a href="https://f3fitness.in/login" class="button">Renew Now</a></center>
<p style="font-size:13px; color:#777777;">Visit the gym or renew online to keep your momentum going.</p>"""
        },
        ("renewal_reminder", "whatsapp"): {
            "content": "⏰ Hi {{name}},\n\nYour F3 Fitness membership expires on *{{expiry_date}}* ({{days_left}} days left).\n\nRenew now to keep your fitness journey going! 💪\n\n- F3 Fitness"
        },
        ("freeze_started", "email"): {
            "subject": "Membership Freeze Confirmed ❄️",
            "content": """<h2>Membership Freeze Confirmed ❄️</h2>
<p>Hi <strong>{{name}}</strong>,</p>
<p>Your membership freeze request has been applied successfully.</p>
<div class="highlight-box">
  <strong>Freeze Period:</strong> {{freeze_start_date}} to {{freeze_end_date}}<br>
  <strong>Total Freeze Days:</strong> {{freeze_days}}<br>
  <strong>New Membership Expiry:</strong> {{new_expiry_date}}<br>
  <strong>Freeze Fee:</strong> Rs.{{freeze_fee}}
</div>
<p>You can resume your workouts after the freeze period ends.</p>"""
        },
        ("freeze_started", "whatsapp"): {
            "content": "❄️ Hi {{name}}, your membership has been frozen.\n\nFreeze: {{freeze_start_date}} to {{freeze_end_date}}\nDays: {{freeze_days}}\nNew Expiry: {{new_expiry_date}}\nFee: Rs.{{freeze_fee}}\n\n- F3 Fitness"
        },
        ("freeze_ended", "email"): {
            "subject": "Membership Freeze Ended ✅",
            "content": """<h2>Freeze Ended ✅</h2>
<p>Hi <strong>{{name}}</strong>,</p>
<p>Your membership freeze has been ended {{end_mode}}.</p>
<div class="highlight-box">
  <strong>Freeze End Date:</strong> {{freeze_end_date}}<br>
  <strong>Current Membership Expiry:</strong> {{new_expiry_date}}
</div>
<p>Welcome back to your fitness routine! 💪</p>"""
        },
        ("freeze_ended", "whatsapp"): {
            "content": "✅ Hi {{name}}, your membership freeze has been ended {{end_mode}}.\n\nFreeze ends on: {{freeze_end_date}}\nCurrent Expiry: {{new_expiry_date}}\n\nWelcome back! 💪\n- F3 Fitness"
        },
        ("freeze_ending_tomorrow", "email"): {
            "subject": "Freeze Ends Tomorrow ⏰",
            "content": """<h2>Freeze Ending Tomorrow ⏰</h2>
<p>Hi <strong>{{name}}</strong>,</p>
<p>Your membership freeze is ending tomorrow.</p>
<div class="highlight-box">
  <strong>Freeze End Date:</strong> {{freeze_end_date}}<br>
  <strong>Membership Expiry:</strong> {{new_expiry_date}}
</div>
<p>We look forward to seeing you back at F3 Fitness! 💪</p>"""
        },
        ("freeze_ending_tomorrow", "whatsapp"): {
            "content": "⏰ Hi {{name}}, your membership freeze ends tomorrow ({{freeze_end_date}}).\n\nCurrent Expiry: {{new_expiry_date}}\nSee you at F3 Fitness! 💪"
        },
        ("membership_activated", "email"): {
            "subject": "Membership Activated! 🎉",
            "content": """<h2>Membership Activated! 🎉</h2>
<p>Hi <strong>{{name}}</strong>,</p>
<p>Your membership is now active!</p>
<div class="highlight-box">
  <strong>Plan:</strong> {{plan_name}}<br>
  <strong>Start Date:</strong> {{start_date}}<br>
  <strong>End Date:</strong> {{end_date}}
</div>
<p>See you at the gym! 💪</p>
<center><a href="https://f3fitness.in/login" class="button">View Dashboard</a></center>"""
        },
        ("membership_activated", "whatsapp"): {
            "content": "🎉 Hi {{name}}!\n\nYour *{{plan_name}}* membership is now active!\n\n📅 Start: {{start_date}}\n📅 End: {{end_date}}\n\nLet's crush those fitness goals! 💪\n\n- F3 Fitness Gym"
        },
        ("payment_received", "email"): {
            "subject": "Payment Received - F3 Fitness Gym 💰",
            "content": """<h2>Payment Received! 💰</h2>
<p>Hi <strong>{{name}}</strong>,</p>
<p>Thank you for your payment. Here are the details:</p>
<div class="highlight-box">
  <strong>Receipt No:</strong> {{receipt_no}}<br>
  <strong>Amount:</strong> Rs.{{amount}}<br>
  <strong>Payment Mode:</strong> {{payment_mode}}
</div>
<p>Thank you for being a valued member of F3 Fitness!</p>
<center><a href="https://f3fitness.in/login" class="button">View Receipt</a></center>"""
        },
        ("payment_received", "whatsapp"): {
            "content": "💰 Hi {{name}}, payment received!\n\nReceipt: {{receipt_no}}\nAmount: Rs.{{amount}}\nMode: {{payment_mode}}\n\nThank you! - F3 Fitness Gym"
        },
        ("invoice_sent", "email"): {
            "subject": "Your Invoice {{receipt_no}} - F3 Fitness 🧾",
            "content": """<h2>Invoice Attached 🧾</h2>
<p>Hi <strong>{{name}}</strong>,</p>
<p>Please find your invoice PDF attached for your recent payment.</p>
<div class="highlight-box">
  <strong>Receipt No:</strong> {{receipt_no}}<br>
  <strong>Amount Paid:</strong> Rs.{{amount}}<br>
  <strong>Date:</strong> {{payment_date}}
</div>
<p>Thank you for being a valued member of F3 Fitness! 💪</p>"""
        },
        ("invoice_sent", "whatsapp"): {
            "content": "🧾 F3 Fitness Invoice\nReceipt: {{receipt_no}}\nAmount: Rs.{{amount}}\nDate: {{payment_date}}\n\nYour invoice PDF is attached."
        },
        ("holiday", "email"): {
            "subject": "Holiday Notice - F3 Fitness Gym 🏖️",
            "content": """<h2>Holiday Notice 🏖️</h2>
<p>Hi <strong>{{name}}</strong>,</p>
<p>Please note that F3 Fitness Gym will be closed on:</p>
<div class="highlight-box" style="text-align:center;">
  <strong style="font-size:20px; color:#0891b2;">{{holiday_date}}</strong><br>
  <span>{{holiday_reason}}</span>
</div>
<p>Plan your workouts accordingly. See you soon!</p>"""
        },
        ("holiday", "whatsapp"): {
            "content": "🏖️ Hi {{name}},\n\nF3 Fitness Gym will be closed on *{{holiday_date}}* for {{holiday_reason}}.\n\nPlan your workouts accordingly. See you soon! 💪\n\n- F3 Fitness"
        },
        ("announcement", "email"): {
            "subject": "📢 {{announcement_title}} - F3 Fitness Gym",
            "content": """<h2>📢 {{announcement_title}}</h2>
<p>Hi <strong>{{name}}</strong>,</p>
<div class="highlight-box">
  {{announcement_content}}
</div>
<p>Stay fit, stay healthy!</p>
<center><a href="https://f3fitness.in" class="button">Visit Website</a></center>"""
        },
        ("announcement", "whatsapp"): {
            "content": "📢 *{{announcement_title}}*\n\nHi {{name}},\n\n{{announcement_content}}\n\n- F3 Fitness Gym"
        },
        ("new_user_credentials", "email"): {
            "subject": "F3 Fitness Account Details (Service Message)",
            "content": """<h2>F3 Fitness Account Created ✅</h2>
<p>Hi <strong>{{name}}</strong>,</p>
<p>Your member account has been created successfully. Use these login details:</p>
<div class="highlight-box">
  <strong>Member ID:</strong> {{member_id}}<br>
  <strong>Email:</strong> {{email}}<br>
  <strong>Password:</strong> <code style="color:#dc2626; font-weight:700;">{{password}}</code>
</div>
<p style="color:#dc2626; font-weight:500;">⚠️ Please change your password after your first login.</p>
<center><a href="https://f3fitness.in/login" class="button">Login Now</a></center>
<p style="font-size:13px; color:#777777;">This is an important service message from F3 Fitness.</p>"""
        },
        ("new_user_credentials", "whatsapp"): {
            "content": "Hello {{name}},\n\nYour F3 Fitness member account has been created successfully.\n\nMember ID: {{member_id}}\nEmail: {{email}}\nPassword: {{password}}\n\nLogin: https://f3fitness.in/login\n\nPlease change your password after first login.\n\n- F3 Fitness Health Club"
        },
        ("test_email", "email"): {
            "subject": "F3 Fitness Gym - Test Email ✅",
            "content": """<h2>SMTP Test Successful! ✅</h2>
<p>This is a test email from F3 Fitness Gym.</p>
<div class="highlight-box">
  Your SMTP configuration is working correctly.<br>
  You can now send emails to your members!
</div>
<p>Keep motivating your members! 💪</p>"""
        }
    }
    return defaults.get((template_type, channel), {"subject": "", "content": ""})

def replace_template_vars(template: str, variables: dict) -> str:
    """Replace template variables like {{name}} with actual values"""
    for key, value in variables.items():
        template = template.replace(f"{{{{{key}}}}}", str(value))
    return template

def sanitize_invoice_whatsapp_message(message: str) -> str:
    """Keep invoice WhatsApp captions attachment-first, without fallback links."""
    text = str(message or "")
    lines = []
    skip_phrases = [
        "if attachment is not shown",
        "open this secure link",
        "view invoice pdf",
        "copy this link",
    ]
    for line in text.splitlines():
        line_clean = line.strip()
        lower = line_clean.lower()
        if not line_clean:
            lines.append("")
            continue
        if "invoice_pdf_url" in line_clean:
            continue
        if line_clean.startswith("http://") or line_clean.startswith("https://"):
            continue
        if any(phrase in lower for phrase in skip_phrases):
            continue
        lines.append(line)

    cleaned = "\n".join(lines)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned

def create_invoice_share_token(payment_id: str, expires_days: int = 30) -> str:
    payload = {
        "sub": payment_id,
        "purpose": "invoice_pdf_share",
        "exp": datetime.now(timezone.utc) + timedelta(days=expires_days)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_invoice_share_token(token: str, payment_id: str) -> bool:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("purpose") == "invoice_pdf_share" and payload.get("sub") == payment_id
    except Exception:
        return False

def get_public_base_url() -> str:
    return (
        os.environ.get("PUBLIC_BASE_URL")
        or os.environ.get("APP_BASE_URL")
        or "https://f3fitness.in"
    ).rstrip("/")

async def send_email(to_email: str, subject: str, body: str, attachments: Optional[List[dict]] = None):
    """Send email using configured SMTP settings"""
    settings = await db.settings.find_one({"id": "1"}, {"_id": 0})
    body_html = body or ""
    # Best-effort OTP extraction for reception fallback (supports common 4-8 digit OTP formats)
    otp_detected = None
    otp_match = re.search(r'(?i)otp[^0-9]{0,20}([0-9]{4,8})', body_html)
    if not otp_match:
        otp_match = re.search(r'(?<!\d)([0-9]{4,8})(?!\d)', body_html)
    if otp_match:
        otp_detected = otp_match.group(1)
    log_data = {
        "id": str(uuid.uuid4()),
        "to_email": to_email,
        "subject": (subject or "")[:200],
        "body_preview": (body_html.replace("\n", " ").replace("\r", " ")[:300] + "...") if len(body_html) > 300 else body_html,
        # Store HTML for click-to-preview in Email Logs. Truncate to keep log docs bounded.
        "body_html": (body_html[:50000] + "\n<!-- truncated -->") if len(body_html) > 50000 else body_html,
        "otp_detected": otp_detected,
        "status": "pending",
        "error": None,
        "timestamp": get_ist_now().isoformat()
    }
    if not settings or not settings.get("smtp_host"):
        logger.warning("SMTP not configured")
        log_data["status"] = "failed"
        log_data["error"] = "SMTP not configured"
        await db.email_logs.insert_one(log_data)
        return False
    
    try:
        message = MIMEMultipart()
        # Use display name "F3 FITNESS HEALTH CLUB" with email address
        sender_email = settings.get("sender_email", settings.get("smtp_user"))
        message["From"] = f"F3 FITNESS HEALTH CLUB <{sender_email}>"
        message["To"] = to_email
        message["Subject"] = subject
        message.attach(MIMEText(body, "html"))
        for att in (attachments or []):
            part = MIMEBase("application", "octet-stream")
            part.set_payload(att.get("content_bytes", b""))
            encoders.encode_base64(part)
            filename = att.get("filename", "attachment.bin")
            part.add_header("Content-Disposition", f'attachment; filename="{filename}"')
            part.add_header("Content-Type", att.get("content_type", "application/octet-stream"))
            message.attach(part)
        
        port = settings["smtp_port"]
        smtp_secure = settings.get("smtp_secure", True)
        
        # Port 587 uses STARTTLS, Port 465 uses direct SSL
        if port == 587:
            # Use STARTTLS for port 587
            await aiosmtplib.send(
                message,
                hostname=settings["smtp_host"],
                port=port,
                username=settings["smtp_user"],
                password=settings["smtp_pass"],
                start_tls=True
            )
        elif port == 465:
            # Use direct TLS for port 465
            await aiosmtplib.send(
                message,
                hostname=settings["smtp_host"],
                port=port,
                username=settings["smtp_user"],
                password=settings["smtp_pass"],
                use_tls=True
            )
        else:
            # For other ports, use the smtp_secure setting
            await aiosmtplib.send(
                message,
                hostname=settings["smtp_host"],
                port=port,
                username=settings["smtp_user"],
                password=settings["smtp_pass"],
                start_tls=smtp_secure
            )
        log_data["status"] = "sent"
        await db.email_logs.insert_one(log_data)
        return True
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        log_data["status"] = "failed"
        log_data["error"] = str(e)
        await db.email_logs.insert_one(log_data)
        return False

def _normalize_phone_e164(number: str) -> str:
    clean = (number or "").replace(' ', '').replace('-', '').replace('(', '').replace(')', '').replace('\u202a', '').replace('\u202c', '')
    if not clean.startswith('+'):
        clean = '+' + clean.lstrip('+')
    return clean

def _normalize_phone_digits(number: str) -> str:
    return "".join(ch for ch in str(number or "") if ch.isdigit())

def _evolution_api_base_url(settings: dict) -> str:
    return str(settings.get("evolution_api_base_url") or "").strip().rstrip("/")

def _evolution_instance_name(settings: dict) -> str:
    return str(settings.get("evolution_instance_name") or "f3fitness").strip()

def _build_qr_data_url(payload: str) -> str:
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(payload)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"

async def _evolution_request(
    settings: dict,
    method: str,
    path: str,
    *,
    json_body: Optional[dict] = None,
    params: Optional[dict] = None,
    timeout: int = 30
):
    base_url = _evolution_api_base_url(settings)
    api_key = str(settings.get("evolution_api_key") or "").strip()
    if not base_url:
        raise HTTPException(status_code=400, detail="Evolution API base URL is missing.")
    if not api_key:
        raise HTTPException(status_code=400, detail="Evolution API key is missing.")

    url = f"{base_url}{path}"
    headers = {"apikey": api_key}
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.request(method.upper(), url, headers=headers, json=json_body, params=params)
    return response

async def _get_evolution_connection_state(settings: dict) -> dict:
    instance_name = _evolution_instance_name(settings)
    response = await _evolution_request(settings, "GET", f"/instance/connectionState/{instance_name}")
    if response.status_code == 404:
        return {
            "provider": "evolution",
            "instance_name": instance_name,
            "exists": False,
            "connected": False,
            "state": "not_created"
        }
    try:
        payload = response.json()
    except Exception:
        payload = {"raw": response.text}
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=str(payload))
    state = str(((payload or {}).get("instance") or {}).get("state") or "").lower()
    return {
        "provider": "evolution",
        "instance_name": instance_name,
        "exists": True,
        "connected": state == "open",
        "state": state or "unknown",
        "raw": payload
    }

async def _ensure_evolution_instance(settings: dict) -> dict:
    instance_name = _evolution_instance_name(settings)
    payload = {
        "instanceName": instance_name,
        "integration": "WHATSAPP-BAILEYS",
        "token": str(settings.get("evolution_instance_token") or "").strip(),
        "qrcode": True,
        "rejectCall": False,
        "groupsIgnore": False,
        "alwaysOnline": True,
        "readMessages": False,
        "readStatus": False,
        "syncFullHistory": False
    }
    response = await _evolution_request(settings, "POST", "/instance/create", json_body=payload, timeout=45)
    try:
        body = response.json()
    except Exception:
        body = {"raw": response.text}
    if response.status_code < 400:
        return {"created": True, "raw": body}
    error_text = json.dumps(body) if not isinstance(body, str) else body
    lowered = error_text.lower()
    if "already exists" in lowered or "instance exists" in lowered or "duplic" in lowered:
        return {"created": False, "raw": body}
    return {"created": False, "raw": body, "status_code": response.status_code}

async def _send_whatsapp_evolution(
    settings: dict,
    to_number_clean: str,
    message: str,
    log_data: dict,
    log_to_db: bool = True,
    media_url: Optional[str] = None,
    media_base64: Optional[str] = None,
    media_filename: Optional[str] = None,
    media_mimetype: Optional[str] = None
):
    base_url = _evolution_api_base_url(settings)
    api_key = str(settings.get("evolution_api_key") or "").strip()
    instance_name = _evolution_instance_name(settings)
    if not base_url:
        log_data["status"] = "failed"
        log_data["error"] = "Evolution API base URL not configured"
        await _log_whatsapp(log_data, log_to_db)
        return False
    if not api_key:
        log_data["status"] = "failed"
        log_data["error"] = "Evolution API key not configured"
        await _log_whatsapp(log_data, log_to_db)
        return False
    if not instance_name:
        log_data["status"] = "failed"
        log_data["error"] = "Evolution instance name not configured"
        await _log_whatsapp(log_data, log_to_db)
        return False

    target_number = _normalize_phone_digits(to_number_clean)
    if not target_number:
        log_data["status"] = "failed"
        log_data["error"] = "Recipient number is invalid"
        await _log_whatsapp(log_data, log_to_db)
        return False

    try:
        if media_url or media_base64:
            media_source = media_base64 or media_url
            url_lower = str(media_url or media_filename or "").lower()
            media_type = "document"
            mime_type = media_mimetype or "application/pdf"
            file_name = media_filename or "attachment.pdf"
            if any(url_lower.endswith(ext) for ext in [".jpg", ".jpeg"]):
                media_type = "image"
                mime_type = media_mimetype or "image/jpeg"
                file_name = media_filename or "image.jpg"
            elif url_lower.endswith(".png"):
                media_type = "image"
                mime_type = media_mimetype or "image/png"
                file_name = media_filename or "image.png"
            elif url_lower.endswith(".mp4"):
                media_type = "video"
                mime_type = media_mimetype or "video/mp4"
                file_name = media_filename or "video.mp4"

            payload = {
                "number": target_number,
                "mediatype": media_type,
                "mimetype": mime_type,
                "caption": message,
                "media": media_source,
                "fileName": file_name
            }
            response = await _evolution_request(
                settings,
                "POST",
                f"/message/sendMedia/{instance_name}",
                json_body=payload,
                timeout=45
            )
        else:
            payload = {
                "number": target_number,
                "text": message,
                "linkPreview": True
            }
            response = await _evolution_request(
                settings,
                "POST",
                f"/message/sendText/{instance_name}",
                json_body=payload,
                timeout=45
            )

        try:
            body = response.json()
        except Exception:
            body = {"raw": response.text}

        if 200 <= response.status_code < 300:
            message_key = ((body or {}).get("key") or {}) if isinstance(body, dict) else {}
            log_data["status"] = "sent"
            log_data["message_sid"] = message_key.get("id") or "evolution"
            log_data["provider_response"] = body
            await _log_whatsapp(log_data, log_to_db)
            return True

        log_data["status"] = "failed"
        log_data["error"] = f"Evolution API returned status {response.status_code}: {body}"
        log_data["provider_response"] = body
        await _log_whatsapp(log_data, log_to_db)
        return False
    except HTTPException as e:
        log_data["status"] = "failed"
        log_data["error"] = e.detail
        await _log_whatsapp(log_data, log_to_db)
        return False
    except Exception as e:
        log_data["status"] = "failed"
        log_data["error"] = str(e)
        await _log_whatsapp(log_data, log_to_db)
        logger.error(f"Evolution WhatsApp send failed: {e}")
        return False

async def _log_whatsapp(log_data: dict, log_to_db: bool = True):
    if log_to_db:
        await db.whatsapp_logs.insert_one(log_data)

async def _send_whatsapp_twilio(settings: dict, to_number_clean: str, message: str, log_data: dict, log_to_db: bool = True, media_url: Optional[str] = None):
    if not settings.get("twilio_account_sid"):
        log_data["status"] = "failed"
        log_data["error"] = "Twilio Account SID not configured"
        await _log_whatsapp(log_data, log_to_db)
        return False
    if not settings.get("twilio_auth_token"):
        log_data["status"] = "failed"
        log_data["error"] = "Twilio Auth Token not configured"
        await _log_whatsapp(log_data, log_to_db)
        return False
    if not settings.get("twilio_whatsapp_number"):
        log_data["status"] = "failed"
        log_data["error"] = "Twilio WhatsApp number not configured"
        await _log_whatsapp(log_data, log_to_db)
        return False

    try:
        if settings.get("use_sandbox") and settings.get("sandbox_url"):
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(
                    settings["sandbox_url"],
                    data={"To": f"whatsapp:{to_number_clean}", "Body": message}
                )
            if response.status_code == 200:
                log_data["status"] = "sent"
                log_data["message_sid"] = "sandbox"
            else:
                log_data["status"] = "failed"
                log_data["error"] = f"Sandbox returned status {response.status_code}"
            await _log_whatsapp(log_data, log_to_db)
            return response.status_code == 200

        from twilio.rest import Client
        twilio_client = Client(settings["twilio_account_sid"], settings["twilio_auth_token"])
        from_number = _normalize_phone_e164(settings["twilio_whatsapp_number"])
        twilio_kwargs = {
            "from_": f'whatsapp:{from_number}',
            "body": message,
            "to": f'whatsapp:{to_number_clean}'
        }
        if media_url:
            twilio_kwargs["media_url"] = [media_url]
        msg = twilio_client.messages.create(**twilio_kwargs)
        log_data["status"] = "sent"
        log_data["message_sid"] = getattr(msg, "sid", None)
        await _log_whatsapp(log_data, log_to_db)
        return True
    except Exception as e:
        log_data["status"] = "failed"
        log_data["error"] = str(e)
        await _log_whatsapp(log_data, log_to_db)
        logger.error(f"Twilio WhatsApp send failed: {e}")
        return False

async def _send_whatsapp_fast2sms(settings: dict, to_number_clean: str, message: str, log_data: dict, log_to_db: bool = True, media_url: Optional[str] = None):
    api_key = settings.get("fast2sms_api_key")
    if not api_key:
        log_data["status"] = "failed"
        log_data["error"] = "Fast2SMS API key not configured"
        await _log_whatsapp(log_data, log_to_db)
        return False

    base_url = (settings.get("fast2sms_base_url") or "https://www.fast2sms.com").rstrip("/")
    endpoint = f"{base_url}/dev/whatsapp-session"
    display_number = str(settings.get("fast2sms_waba_number") or "").strip()
    phone_number_id = str(settings.get("fast2sms_phone_number_id") or "").strip()

    async def _resolve_waba_sender():
        nonlocal display_number, phone_number_id
        if display_number and phone_number_id:
            return
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.get(
                    f"{base_url}/dev/dlt_manager/whatsapp",
                    headers={"authorization": api_key},
                    params={"authorization": api_key}
                )
            if response.status_code >= 400:
                return
            data = response.json() if response.headers.get("content-type", "").startswith("application/json") else None
            if not isinstance(data, list):
                return

            def _digits(v):
                return "".join(ch for ch in str(v or "") if ch.isdigit())

            matched = None
            if display_number:
                want = _digits(display_number)
                for row in data:
                    if _digits(row.get("number")) == want:
                        matched = row
                        break
            if not matched:
                for row in data:
                    if str(row.get("connection_status", "")).upper() == "CONNECTED":
                        matched = row
                        break
            if not matched and data:
                matched = data[0]

            if matched:
                display_number = display_number or str(matched.get("number") or "")
                phone_number_id = phone_number_id or str(matched.get("phone_number_id") or "")
                log_data["fast2sms_sender_auto_resolved"] = {
                    "display_number": display_number,
                    "phone_number_id": phone_number_id
                }
        except Exception:
            return

    await _resolve_waba_sender()

    if media_url and media_url not in (message or ""):
        final_message = f"{message}\n\nInvoice PDF: {media_url}"
    else:
        final_message = message
    base_payload = {
        "to": to_number_clean,
        "text": final_message,
        "type": "text"
    }
    display_number_digits = "".join(ch for ch in display_number if ch.isdigit()) if display_number else ""

    headers = {"authorization": api_key}

    async def _attempt_send(client: httpx.AsyncClient):
        attempts = []
        to_variants = [to_number_clean, to_number_clean.lstrip("+")]
        sender_variants = []
        if phone_number_id:
            sender_variants.append({"phone_number_id": phone_number_id})
        if display_number:
            sender_variants.append({"display_number": display_number})
        if display_number_digits and display_number_digits != display_number:
            sender_variants.append({"display_number": display_number_digits})
        if phone_number_id and display_number:
            sender_variants.append({"phone_number_id": phone_number_id, "display_number": display_number})
        if phone_number_id and display_number_digits:
            sender_variants.append({"phone_number_id": phone_number_id, "display_number": display_number_digits})
        if not sender_variants:
            sender_variants.append({})

        # de-duplicate sender payloads
        dedup = []
        seen = set()
        for sv in sender_variants:
          key = tuple(sorted(sv.items()))
          if key not in seen:
            seen.add(key)
            dedup.append(sv)
        sender_variants = dedup

        for sender_fields in sender_variants:
            for to_value in to_variants:
                attempts.append(("json", {**base_payload, **sender_fields, "to": to_value}))
                attempts.append(("form", {**base_payload, **sender_fields, "to": to_value}))

        last_response = None
        tried = []
        for kind, body in attempts:
            req_headers = dict(headers)
            if kind == "json":
                req_headers["Content-Type"] = "application/json"
                resp = await client.post(endpoint, headers=req_headers, json=body)
            else:
                resp = await client.post(endpoint, headers=req_headers, data=body)
            tried.append({"kind": kind, "keys": sorted(list(body.keys()))})
            last_response = resp
            if 200 <= resp.status_code < 300:
                log_data["provider_attempts"] = tried
                return resp

            # Retry on 400/415 with alternate payloads; stop early on auth failures.
            if resp.status_code in (401, 403):
                log_data["provider_attempts"] = tried
                return resp

        log_data["provider_attempts"] = tried
        return last_response

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await _attempt_send(client)
        body_text = response.text[:500] if response.text else ""
        try:
            body_json = response.json()
        except Exception:
            body_json = None

        # Fast2SMS returns provider-specific JSON. Treat HTTP 2xx + no obvious failure flags as success.
        is_success = 200 <= response.status_code < 300
        if body_json and isinstance(body_json, dict):
            if body_json.get("return") is False or str(body_json.get("status", "")).lower() in {"fail", "failed", "error"}:
                is_success = False
            log_data["provider_response"] = body_json
        elif body_text:
            log_data["provider_response_text"] = body_text

        if is_success:
            log_data["status"] = "sent"
            log_data["message_sid"] = (body_json or {}).get("request_id") or (body_json or {}).get("message_id") or "fast2sms"
        else:
            log_data["status"] = "failed"
            log_data["error"] = f"Fast2SMS returned status {response.status_code}: {body_text or body_json}"
        await _log_whatsapp(log_data, log_to_db)
        return is_success
    except Exception as e:
        log_data["status"] = "failed"
        log_data["error"] = str(e)
        await _log_whatsapp(log_data, log_to_db)
        logger.error(f"Fast2SMS WhatsApp send failed: {e}")
        return False

async def _send_whatsapp_fast2sms_template(
    settings: dict,
    to_number_clean: str,
    template_type: str,
    template_vars: Optional[dict],
    log_data: dict,
    log_to_db: bool = True
):
    """Send approved WhatsApp template via Fast2SMS /dev/whatsapp endpoint.
    Returns:
      True/False for attempted send result,
      None when template mode is not configured for the given template (caller may fallback to session API).
    """
    template_field_map = {
        "otp": "fast2sms_template_otp_message_id",
        "password_reset": "fast2sms_template_password_reset_message_id",
        "welcome": "fast2sms_template_welcome_message_id",
        "new_user_credentials": "fast2sms_template_new_user_credentials_message_id",
        "membership_activated": "fast2sms_template_membership_activated_message_id",
        "payment_received": "fast2sms_template_payment_received_message_id",
        "invoice_sent": "fast2sms_template_invoice_sent_message_id",
    }
    api_key = settings.get("fast2sms_api_key")
    if not api_key:
        return None

    base_url = (settings.get("fast2sms_base_url") or "https://www.fast2sms.com").rstrip("/")
    if not bool(settings.get("fast2sms_use_template_api")):
        return None

    msg_id_key = template_field_map.get(template_type)
    if not msg_id_key:
        return None
    message_id = str(settings.get(msg_id_key) or "").strip()
    if not message_id:
        log_data["provider_mode"] = "fast2sms_template"
        log_data["status"] = "failed"
        log_data["error"] = f"Fast2SMS template message_id is missing for template '{template_type}'"
        await _log_whatsapp(log_data, log_to_db)
        return False

    template_vars = template_vars or {}
    if template_type == "otp":
        variables_values = [str(template_vars.get("otp") or "")]
    elif template_type == "password_reset":
        # Recommend Fast2SMS template with single variable for temporary password/reset code.
        variables_values = [str(template_vars.get("otp") or template_vars.get("new_password") or "")]
    elif template_type == "welcome":
        variables_values = [
            str(template_vars.get("name") or ""),
            str(template_vars.get("member_id") or "")
        ]
    elif template_type == "new_user_credentials":
        variables_values = [
            str(template_vars.get("name") or ""),
            str(template_vars.get("member_id") or ""),
            str(template_vars.get("email") or ""),
            str(template_vars.get("password") or "")
        ]
    elif template_type == "membership_activated":
        variables_values = [
            str(template_vars.get("name") or ""),
            str(template_vars.get("plan_name") or ""),
            str(template_vars.get("start_date") or ""),
            str(template_vars.get("end_date") or "")
        ]
    elif template_type == "payment_received":
        variables_values = [
            str(template_vars.get("name") or ""),
            str(template_vars.get("receipt_no") or ""),
            str(template_vars.get("amount") or ""),
            str(template_vars.get("payment_mode") or "")
        ]
    elif template_type == "invoice_sent":
        variables_values = [
            str(template_vars.get("receipt_no") or ""),
            str(template_vars.get("amount") or ""),
            str(template_vars.get("payment_date") or ""),
            str(template_vars.get("invoice_pdf_url") or "")
        ]
    else:
        return None
    if any(v is None for v in variables_values) or any(v == "" for v in variables_values):
        log_data["provider_mode"] = "fast2sms_template"
        log_data["status"] = "failed"
        log_data["error"] = f"Missing template variables for '{template_type}'"
        await _log_whatsapp(log_data, log_to_db)
        return False

    display_number = str(settings.get("fast2sms_waba_number") or "").strip()
    phone_number_id = str(settings.get("fast2sms_phone_number_id") or "").strip()
    display_number_digits = "".join(ch for ch in display_number if ch.isdigit()) if display_number else ""

    async def _resolve_waba_sender():
        nonlocal display_number, phone_number_id, display_number_digits
        if display_number and phone_number_id:
            return
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.get(
                    f"{base_url}/dev/dlt_manager/whatsapp",
                    headers={"authorization": api_key},
                    params={"authorization": api_key}
                )
            if response.status_code >= 400:
                return
            data = response.json() if response.headers.get("content-type", "").startswith("application/json") else None
            if not isinstance(data, list):
                return
            def _digits(v):
                return "".join(ch for ch in str(v or "") if ch.isdigit())
            matched = None
            if display_number:
                want = _digits(display_number)
                for row in data:
                    if _digits(row.get("number")) == want:
                        matched = row
                        break
            if not matched:
                for row in data:
                    if str(row.get("connection_status", "")).upper() == "CONNECTED":
                        matched = row
                        break
            if not matched and data:
                matched = data[0]
            if matched:
                display_number = display_number or str(matched.get("number") or "")
                phone_number_id = phone_number_id or str(matched.get("phone_number_id") or "")
                display_number_digits = "".join(ch for ch in display_number if ch.isdigit()) if display_number else ""
        except Exception:
            return

    await _resolve_waba_sender()
    endpoint = f"{base_url}/dev/whatsapp"
    headers = {"authorization": api_key}
    numbers_variants = [to_number_clean, to_number_clean.lstrip("+")]
    sender_variants = []
    if phone_number_id:
        sender_variants.append({"phone_number_id": phone_number_id})
    if display_number:
        sender_variants.append({"display_number": display_number})
    if display_number_digits and display_number_digits != display_number:
        sender_variants.append({"display_number": display_number_digits})
    if phone_number_id and display_number:
        sender_variants.append({"phone_number_id": phone_number_id, "display_number": display_number})
    if phone_number_id and display_number_digits:
        sender_variants.append({"phone_number_id": phone_number_id, "display_number": display_number_digits})
    if not sender_variants:
        sender_variants.append({})

    # de-duplicate sender payloads
    dedup = []
    seen = set()
    for sv in sender_variants:
        key = tuple(sorted(sv.items()))
        if key not in seen:
            seen.add(key)
            dedup.append(sv)
    sender_variants = dedup

    payload_base = {
        "message_id": message_id,
        "numbers": numbers_variants[0],
        "variables_values": "|".join(variables_values)
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            last_resp = None
            attempts = []
            for sender in sender_variants:
                for num in numbers_variants:
                    body = {**payload_base, **sender, "numbers": num}
                    variants = [
                        ("get", body),
                        ("post_json", body),
                        ("post_form", body),
                    ]
                    for mode, payload in variants:
                        attempts.append({"mode": mode, "keys": sorted(list(payload.keys()))})
                        if mode == "get":
                            resp = await client.get(endpoint, headers=headers, params={**payload, "authorization": api_key})
                        elif mode == "post_json":
                            resp = await client.post(endpoint, headers=headers, json=payload)
                        else:
                            resp = await client.post(endpoint, headers=headers, data=payload)
                        last_resp = resp
                        if 200 <= resp.status_code < 300:
                            try:
                                body_json = resp.json()
                            except Exception:
                                body_json = None
                            failed_flag = isinstance(body_json, dict) and (
                                body_json.get("return") is False or str(body_json.get("status", "")).lower() in {"fail", "failed", "error"}
                            )
                            if not failed_flag:
                                log_data["provider_mode"] = "fast2sms_template"
                                log_data["provider_attempts"] = attempts
                                log_data["status"] = "sent"
                                log_data["message_sid"] = (body_json or {}).get("request_id") or (body_json or {}).get("message_id") or "fast2sms-template"
                                log_data["provider_response"] = body_json or resp.text[:500]
                                await _log_whatsapp(log_data, log_to_db)
                                return True
            if last_resp is None:
                return None
            err_text = last_resp.text[:500] if getattr(last_resp, "text", None) else ""
            log_data["provider_mode"] = "fast2sms_template"
            log_data["provider_attempts"] = attempts
            log_data["status"] = "failed"
            log_data["error"] = f"Fast2SMS template API returned status {last_resp.status_code}: {err_text}"
            await _log_whatsapp(log_data, log_to_db)
            return False
    except Exception as e:
        log_data["provider_mode"] = "fast2sms_template"
        log_data["status"] = "failed"
        log_data["error"] = str(e)
        await _log_whatsapp(log_data, log_to_db)
        logger.error(f"Fast2SMS template send failed: {e}")
        return False

async def send_whatsapp(
    to_number: str,
    message: str,
    log_to_db: bool = True,
    media_url: Optional[str] = None,
    media_base64: Optional[str] = None,
    media_filename: Optional[str] = None,
    media_mimetype: Optional[str] = None,
    template_type: Optional[str] = None,
    template_vars: Optional[dict] = None
):
    """Send WhatsApp message using configured provider (Twilio, Fast2SMS, or Evolution)."""
    settings = await db.settings.find_one({"id": "1"}, {"_id": 0}) or {}
    provider = (settings.get("whatsapp_provider") or "twilio").lower()
    to_number_clean = _normalize_phone_e164(to_number)

    log_data = {
        "id": str(uuid.uuid4()),
        "to_number": to_number_clean,
        "message": message[:200] + "..." if len(message) > 200 else message,
        "status": "pending",
        "error": None,
        "message_sid": None,
        "provider": provider,
        "media_url": media_url,
        "has_media_attachment": bool(media_url or media_base64),
        "timestamp": get_ist_now().isoformat()
    }

    if provider == "fast2sms":
        if template_type:
            template_result = await _send_whatsapp_fast2sms_template(
                settings, to_number_clean, template_type, template_vars, dict(log_data), log_to_db
            )
            if template_result is True:
                return True
            # False means template send attempted+failed and is already logged. Do not double-send via session.
            if template_result is False:
                return False
        return await _send_whatsapp_fast2sms(settings, to_number_clean, message, log_data, log_to_db, media_url=media_url)
    if provider == "evolution":
        return await _send_whatsapp_evolution(
            settings,
            to_number_clean,
            message,
            log_data,
            log_to_db,
            media_url=media_url,
            media_base64=media_base64,
            media_filename=media_filename,
            media_mimetype=media_mimetype
        )

    return await _send_whatsapp_twilio(settings, to_number_clean, message, log_data, log_to_db, media_url=media_url)

async def send_notification(user: dict, template_type: str, variables: dict, background_tasks: BackgroundTasks = None):
    """Send notification via both email and WhatsApp"""
    # Prepare variables
    vars_with_user = {**variables, "name": user.get("name"), "member_id": user.get("member_id")}
    
    # Get templates
    email_template = await get_template(template_type, "email")
    whatsapp_template = await get_template(template_type, "whatsapp")
    
    send_email_allowed = True
    send_whatsapp_allowed = True
    if template_type == "attendance":
        settings = await db.settings.find_one(
            {"id": "1"},
            {"_id": 0, "attendance_confirmation_whatsapp_enabled": 1, "attendance_confirmation_email_enabled": 1, "absent_warning_whatsapp_enabled": 1}
        ) or {}
        send_whatsapp_allowed = settings.get("attendance_confirmation_whatsapp_enabled", True)
        send_email_allowed = settings.get("attendance_confirmation_email_enabled", True)
    elif template_type == "absent_warning":
        settings = await db.settings.find_one(
            {"id": "1"},
            {"_id": 0, "absent_warning_whatsapp_enabled": 1}
        ) or {}
        send_whatsapp_allowed = settings.get("absent_warning_whatsapp_enabled", True)

    # Send email - wrap in professional template
    if send_email_allowed and user.get("email") and email_template.get("content"):
        subject = replace_template_vars(email_template.get("subject", "F3 Fitness Notification"), vars_with_user)
        content = replace_template_vars(email_template["content"], vars_with_user)
        # Wrap content in professional template
        body = wrap_email_in_template(content, subject)
        if background_tasks:
            background_tasks.add_task(send_email, user["email"], subject, body)
        else:
            await send_email(user["email"], subject, body)
    
    # Send WhatsApp (attendance confirmations can be disabled independently to save cost)
    if send_whatsapp_allowed and user.get("phone_number") and whatsapp_template.get("content"):
        phone = user.get("country_code", "+91") + user["phone_number"].lstrip("0")
        message = replace_template_vars(whatsapp_template["content"], vars_with_user)
        if background_tasks:
            background_tasks.add_task(
                send_whatsapp,
                phone,
                message,
                True,
                None,
                None,
                None,
                None,
                template_type,
                vars_with_user
            )
        else:
            await send_whatsapp(
                phone,
                message,
                True,
                None,
                None,
                None,
                None,
                template_type,
                vars_with_user
            )

async def send_account_credentials_notification(
    user: dict,
    login_email: str,
    plain_password: str,
    background_tasks: Optional[BackgroundTasks] = None
):
    """Send account-created login credentials to member via email + WhatsApp."""
    vars_with_user = {
        "name": user.get("name"),
        "member_id": user.get("member_id"),
        "email": login_email or user.get("email") or "",
        "password": plain_password or ""
    }

    email_template = await get_template("new_user_credentials", "email")
    whatsapp_template = await get_template("new_user_credentials", "whatsapp")

    if user.get("email") and email_template.get("content"):
        subject = replace_template_vars(
            email_template.get("subject", "F3 Fitness Account Details"),
            vars_with_user
        )
        content = replace_template_vars(email_template["content"], vars_with_user)
        body = wrap_email_in_template(content, subject)
        if background_tasks:
            background_tasks.add_task(send_email, user["email"], subject, body)
        else:
            await send_email(user["email"], subject, body)

    if user.get("phone_number") and whatsapp_template.get("content"):
        phone = user.get("country_code", "+91") + user["phone_number"].lstrip("0")
        message = replace_template_vars(whatsapp_template["content"], vars_with_user)
        if background_tasks:
            background_tasks.add_task(
                send_whatsapp,
                phone,
                message,
                True,
                None,
                None,
                None,
                None,
                "new_user_credentials",
                vars_with_user
            )
        else:
            await send_whatsapp(
                phone,
                message,
                True,
                None,
                None,
                None,
                None,
                "new_user_credentials",
                vars_with_user
            )

async def send_notification_to_all(template_type: str, variables: dict, background_tasks: BackgroundTasks):
    """Send notification to all active members"""
    users = await db.users.find({"role": "member"}, {"_id": 0}).to_list(10000)
    for user in users:
        await send_notification(user, template_type, variables, background_tasks)

# ==================== SCHEDULED TASKS ====================

async def send_expiry_reminders():
    """Send reminders for memberships expiring in 10 days"""
    logger.info("Running expiry reminder task...")
    try:
        now = get_ist_now()
        reminder_date = now + timedelta(days=10)
        
        # Find memberships expiring in exactly 10 days
        memberships = await db.memberships.find({
            "status": "active",
            "end_date": {
                "$gte": reminder_date.replace(hour=0, minute=0, second=0).isoformat(),
                "$lt": (reminder_date + timedelta(days=1)).replace(hour=0, minute=0, second=0).isoformat()
            }
        }).to_list(1000)
        
        for membership in memberships:
            user = await db.users.find_one({"id": membership["user_id"]}, {"_id": 0})
            if user:
                expiry = datetime.fromisoformat(membership["end_date"])
                days_left = (expiry - now).days
                await send_notification(user, "renewal_reminder", {
                    "expiry_date": expiry.strftime("%d %b %Y"),
                    "days_left": days_left
                })
        
        logger.info(f"Sent {len(memberships)} expiry reminders")
    except Exception as e:
        logger.error(f"Error in expiry reminders: {e}")

async def send_birthday_wishes():
    """Send birthday wishes to members"""
    logger.info("Running birthday wishes task...")
    try:
        now = get_ist_now()
        today_str = now.strftime("%m-%d")
        
        users = await db.users.find({
            "role": "member",
            "date_of_birth": {"$regex": f".*-{today_str}$"}
        }, {"_id": 0}).to_list(1000)
        
        for user in users:
            await send_notification(user, "birthday", {})
        
        logger.info(f"Sent {len(users)} birthday wishes")
    except Exception as e:
        logger.error(f"Error in birthday wishes: {e}")

async def send_freeze_ending_tomorrow_reminders():
    """Send reminders for active freezes ending tomorrow."""
    logger.info("Running freeze ending tomorrow reminder task...")
    try:
        now = get_ist_now()
        tomorrow = (now + timedelta(days=1)).date()

        memberships = await db.memberships.find({"status": "active"}, {"_id": 0}).to_list(5000)
        sent_count = 0
        for membership in memberships:
            freeze_history = membership.get("freeze_history", []) or []
            for freeze in freeze_history:
                try:
                    freeze_start = datetime.fromisoformat(freeze.get("freeze_start_date", "")[:10]).date()
                    freeze_end = datetime.fromisoformat(freeze.get("freeze_end_date", "")[:10]).date()
                except Exception:
                    continue
                # only current/active freeze windows and ends tomorrow
                if not (freeze_start <= now.date() <= freeze_end):
                    continue
                if freeze_end != tomorrow:
                    continue
                user = await db.users.find_one({"id": membership["user_id"]}, {"_id": 0})
                if not user:
                    continue
                await send_notification(user, "freeze_ending_tomorrow", {
                    "freeze_end_date": freeze_end.strftime("%d %b %Y"),
                    "new_expiry_date": datetime.fromisoformat(membership["end_date"]).strftime("%d %b %Y")
                })
                sent_count += 1
                break
        logger.info(f"Sent {sent_count} freeze ending tomorrow reminders")
    except Exception as e:
        logger.error(f"Error in freeze ending tomorrow reminders: {e}")

async def scheduler_loop():
    """Background scheduler that runs daily tasks"""
    while True:
        try:
            now = get_ist_now()
            # Run at 9 AM IST
            if now.hour == 9 and now.minute < 5:
                await send_expiry_reminders()
                await send_birthday_wishes()
                await send_freeze_ending_tomorrow_reminders()
            await asyncio.sleep(300)  # Check every 5 minutes
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
            await asyncio.sleep(60)

scheduler_task = None

@asynccontextmanager
async def lifespan(app):
    global scheduler_task
    # Start scheduler on startup
    scheduler_task = asyncio.create_task(scheduler_loop())
    logger.info("Scheduler started")
    yield
    # Stop scheduler on shutdown
    if scheduler_task:
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass
    logger.info("Scheduler stopped")

# ==================== OTP ROUTES ====================

@api_router.post("/otp/send")
async def send_otp(req: SendOTPRequest, background_tasks: BackgroundTasks):
    """Send same OTP to both phone (WhatsApp) and email"""
    
    # Check if email or phone is already registered
    existing_user = await db.users.find_one({
        "$or": [
            {"email": req.email} if req.email else {"_id": None},
            {"phone_number": req.phone_number}
        ]
    })
    
    if existing_user:
        if existing_user.get("email") == req.email:
            raise HTTPException(status_code=400, detail="This email is already registered. Please login instead.")
        if existing_user.get("phone_number") == req.phone_number:
            raise HTTPException(status_code=400, detail="This phone number is already registered. Please login instead.")
    
    # Generate single OTP for both channels
    otp = generate_otp()
    
    # Store OTP with expiry
    otp_doc = {
        "phone_number": req.phone_number,
        "country_code": req.country_code,
        "otp": otp,  # Single OTP for both channels
        "email": req.email,
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        "verified": False
    }
    
    await db.otps.delete_many({"phone_number": req.phone_number})
    await db.otps.insert_one(otp_doc)
    
    # Send WhatsApp OTP using template
    full_phone = f"{req.country_code}{req.phone_number.lstrip('0')}"
    whatsapp_template = await get_template("otp", "whatsapp")
    whatsapp_message = replace_template_vars(whatsapp_template.get("content", "🔐 Your OTP: {{otp}}"), {"otp": otp, "name": "User"})
    background_tasks.add_task(
        send_whatsapp,
        full_phone,
        whatsapp_message,
        True,
        None,
        None,
        None,
        None,
        "otp",
        {"otp": otp, "name": "User"}
    )
    
    # Send same OTP to Email using template
    if req.email:
        email_template = await get_template("otp", "email")
        subject = replace_template_vars(email_template.get("subject", "Your F3 Fitness OTP Code"), {"otp": otp, "name": "User"})
        content = replace_template_vars(email_template.get("content", ""), {"otp": otp, "name": "User"})
        email_body = wrap_email_in_template(content, subject)
        background_tasks.add_task(send_email, req.email, subject, email_body)
    
    return {"message": "OTP sent successfully", "phone_sent": True, "email_sent": bool(req.email)}

@api_router.post("/otp/verify")
async def verify_otp(req: VerifyOTPRequest):
    """Verify OTP - single OTP works for both channels"""
    otp_doc = await db.otps.find_one({
        "phone_number": req.phone_number,
        "country_code": req.country_code
    })
    
    if not otp_doc:
        raise HTTPException(status_code=400, detail="OTP not found. Please request a new one.")
    
    if datetime.fromisoformat(otp_doc["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    
    # Check single OTP (can be entered in either field)
    provided_otp = req.phone_otp or req.email_otp
    if otp_doc["otp"] != provided_otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Mark as verified
    await db.otps.update_one(
        {"phone_number": req.phone_number},
        {"$set": {"verified": True}}
    )
    
    return {"message": "OTP verified successfully", "verified": True}

@api_router.post("/auth/signup-with-otp", response_model=dict)
async def signup_with_otp(user: SignupWithOTP, background_tasks: BackgroundTasks):
    """Signup with OTP verification"""
    # Verify OTP first
    otp_doc = await db.otps.find_one({
        "phone_number": user.phone_number,
        "country_code": user.country_code,
        "verified": True
    })
    
    if not otp_doc:
        raise HTTPException(status_code=400, detail="Please verify OTP first")
    
    # Check if user exists
    existing = await db.users.find_one({"$or": [{"email": user.email}, {"phone_number": user.phone_number}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email or phone number already registered")
    
    member_id = await generate_member_id()
    user_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    user_doc = {
        "id": user_id,
        "member_id": member_id,
        "name": user.name,
        "email": user.email,
        "phone": f"{user.country_code}{user.phone_number.lstrip('0')}",
        "phone_number": user.phone_number,
        "country_code": user.country_code,
        "password_hash": hash_password(user.password),
        "role": "member",
        "gender": user.gender,
        "date_of_birth": user.date_of_birth,
        "address": user.address,
        "city": user.city,
        "zip_code": user.zip_code,
        "emergency_phone": user.emergency_phone,
        "profile_photo_url": None,
        "trainer_id": None,
        "pt_trainer_id": None,
        "pt_sessions_remaining": 0,
        "joining_date": now,
        "is_active": True,
        "created_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    # Clean up OTP
    await db.otps.delete_one({"phone_number": user.phone_number})
    
    # Send account credentials notification
    await send_account_credentials_notification(user_doc, user.email, user.password, background_tasks)
    
    token = create_access_token({"sub": user_id, "role": "member"})
    return {"token": token, "user": {k: v for k, v in user_doc.items() if k not in ["password_hash", "_id"]}}

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/signup", response_model=dict)
async def signup(user: UserCreate, background_tasks: BackgroundTasks):
    existing = await db.users.find_one({"$or": [{"email": user.email}, {"phone_number": user.phone_number}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email or phone number already registered")
    
    member_id = await generate_member_id()
    user_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    user_doc = {
        "id": user_id,
        "member_id": member_id,
        "name": user.name,
        "email": user.email,
        "phone_number": user.phone_number,
        "country_code": user.country_code,
        "password_hash": hash_password(user.password),
        "role": "member",
        "gender": user.gender,
        "date_of_birth": user.date_of_birth,
        "address": user.address,
        "city": user.city,
        "zip_code": user.zip_code,
        "emergency_phone": user.emergency_phone,
        "profile_photo_url": None,
        "trainer_id": None,
        "pt_trainer_id": None,
        "pt_sessions_remaining": 0,
        "joining_date": now,
        "created_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    # Send account credentials notification
    await send_account_credentials_notification(user_doc, user.email, user.password, background_tasks)
    
    token = create_access_token({"sub": user_id, "role": "member"})
    return {"token": token, "user": {k: v for k, v in user_doc.items() if k not in ["password_hash", "_id"]}}

@api_router.post("/auth/login", response_model=dict)
async def login(credentials: UserLogin, request: Request):
    user = await db.users.find_one({
        "$or": [{"email": credentials.email_or_phone}, {"phone_number": credentials.email_or_phone}]
    })
    
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user is active
    if user.get("is_active") == False:
        raise HTTPException(status_code=401, detail="Account is disabled. Contact admin.")
    
    # Log login activity
    ip_address = request.client.host if request.client else None
    await log_activity(user["id"], "login", "User logged in", ip_address)
    
    token = create_access_token({"sub": user["id"], "role": user["role"]}, credentials.rememberMe)
    return {"token": token, "user": {k: v for k, v in user.items() if k not in ["password_hash", "_id"]}}

@api_router.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    user = await db.users.find_one({"$or": [{"email": req.email}, {"phone_number": req.email}]})
    if not user:
        return {"message": "If an account exists, a reset OTP has been sent"}
    
    # Generate OTP for password reset
    otp = generate_otp()
    expire = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    await db.password_resets.delete_many({"user_id": user["id"]})
    await db.password_resets.insert_one({
        "user_id": user["id"],
        "otp": otp,
        "expires_at": expire.isoformat(),
        "used": False
    })
    
    # Use template system for password reset notifications (handles both email and WhatsApp)
    await send_notification(user, "password_reset", {"otp": otp}, background_tasks)
    await log_activity(
        user["id"],
        "password_reset_requested",
        "User requested password reset OTP",
        metadata={"channel": "self_service"}
    )
    
    return {"message": "If an account exists, a reset OTP has been sent to your email and phone"}

@api_router.post("/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    # Support both token and OTP-based reset
    reset = None
    if hasattr(req, 'otp') and req.otp:
        reset = await db.password_resets.find_one({"otp": req.otp, "used": False})
    elif hasattr(req, 'token') and req.token:
        reset = await db.password_resets.find_one({"token": req.token, "used": False})
    
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP/token")
    
    if datetime.fromisoformat(reset["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP/Token expired")
    
    await db.users.update_one({"id": reset["user_id"]}, {"$set": {"password_hash": hash_password(req.new_password)}})
    await db.password_resets.update_one({"_id": reset["_id"]}, {"$set": {"used": True}})
    await log_activity(
        reset["user_id"],
        "password_reset",
        "User reset password via OTP/token",
        metadata={"channel": "self_service"}
    )
    
    return {"message": "Password reset successful"}

@api_router.post("/users/change-password")
async def change_password(
    current_password: str = Body(...),
    new_password: str = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Change password for logged in user"""
    user = await db.users.find_one({"id": current_user["id"]})
    
    if not verify_password(current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password_hash": hash_password(new_password)}}
    )
    await log_activity(
        current_user["id"],
        "password_changed",
        "User changed password",
        metadata={"channel": "self_service"}
    )
    
    return {"message": "Password changed successfully"}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ==================== USERS/MEMBERS ROUTES ====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(
    role: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_admin_or_receptionist)
):
    # Receptionist can only search for members
    if current_user["role"] == "receptionist":
        role = "member"
    
    query = {}
    if role:
        query["role"] = role
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone_number": {"$regex": search, "$options": "i"}},
            {"member_id": {"$regex": search, "$options": "i"}}
        ]
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate, role: str = "member", current_user: dict = Depends(get_admin_user), background_tasks: BackgroundTasks = None):
    existing = await db.users.find_one({"$or": [{"email": user.email}, {"phone_number": user.phone_number}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email or phone already exists")
    
    member_id = await generate_member_id()
    user_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    # Use provided joining_date or default to now
    joining_date = user.joining_date if user.joining_date else now
    
    user_doc = {
        "id": user_id,
        "member_id": member_id,
        "name": user.name,
        "email": user.email,
        "phone_number": user.phone_number,
        "country_code": user.country_code,
        "password_hash": hash_password(user.password),
        "role": role,
        "gender": user.gender,
        "date_of_birth": user.date_of_birth,
        "address": user.address,
        "city": user.city,
        "zip_code": user.zip_code,
        "emergency_phone": user.emergency_phone,
        "profile_photo_url": None,
        "trainer_id": None,
        "pt_trainer_id": None,
        "pt_sessions_remaining": 0,
        "is_disabled": False,
        "joining_date": joining_date,
        "created_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    # Send account credentials notification for admin-created users
    await send_account_credentials_notification(user_doc, user.email, user.password, background_tasks)

    # Log activity
    await log_activity(current_user["id"], "create_member", f"Created new {role}: {user.name} ({member_id})")
    
    return {k: v for k, v in user_doc.items() if k not in ["password_hash", "_id"]}

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, update: UserUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    if "role" in update_data and current_user["role"] != "admin":
        del update_data["role"]
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_admin_user), background_tasks: BackgroundTasks = None):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.delete_one({"id": user_id})
    # Also delete related data
    await db.memberships.delete_many({"user_id": user_id})
    await db.attendance.delete_many({"user_id": user_id})
    await db.health_logs.delete_many({"user_id": user_id})
    await db.calorie_logs.delete_many({"user_id": user_id})
    
    return {"message": "User deleted"}

# ==================== ADMIN USER MANAGEMENT ROUTES ====================

@api_router.get("/admin/users-with-membership")
async def get_users_with_membership(
    role: Optional[str] = None,
    search: Optional[str] = None,
    status: Optional[str] = None,  # active, inactive, disabled
    current_user: dict = Depends(get_admin_user)
):
    """Get users with their active membership data"""
    query = {}
    if role:
        query["role"] = role
    if status == "disabled":
        query["is_disabled"] = True
    elif status == "active" or status == "inactive":
        query["$or"] = [{"is_disabled": {"$exists": False}}, {"is_disabled": False}]
    if search:
        search_query = {
            "$or": [
                {"name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"phone_number": {"$regex": search, "$options": "i"}},
                {"member_id": {"$regex": search, "$options": "i"}}
            ]
        }
        if query:
            query = {"$and": [query, search_query]}
        else:
            query = search_query
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    # Get all active memberships
    all_memberships = await db.memberships.find({"status": "active"}, {"_id": 0}).to_list(10000)
    membership_map = {m["user_id"]: m for m in all_memberships}
    
    # Get all payments grouped by membership_id
    all_payments = await db.payments.find({}, {"_id": 0, "membership_id": 1, "amount_paid": 1}).to_list(10000)
    payment_totals = {}
    for p in all_payments:
        mid = p.get("membership_id")
        if mid:
            payment_totals[mid] = payment_totals.get(mid, 0) + p.get("amount_paid", 0)
    
    # Get all plans
    all_plans = await db.plans.find({}, {"_id": 0}).to_list(100)
    plan_map = {p["id"]: p for p in all_plans}
    
    # Combine data
    result = []
    for user in users:
        membership = membership_map.get(user["id"])
        user_data = {**user}
        if membership:
            plan = plan_map.get(membership.get("plan_id"))
            final_price = membership.get("final_price", 0)
            amount_paid = payment_totals.get(membership.get("id"), 0)
            amount_due = final_price - amount_paid
            user_data["active_membership"] = {
                "id": membership.get("id"),
                "plan_id": membership.get("plan_id"),
                "plan_name": plan["name"] if plan else "Unknown",
                "start_date": membership.get("start_date"),
                "end_date": membership.get("end_date"),
                "status": membership.get("status"),
                "final_price": final_price,
                "amount_paid": amount_paid,
                "amount_due": amount_due,
                "freeze_history": membership.get("freeze_history", []),
                "total_frozen_days": membership.get("total_frozen_days", 0),
                "total_freeze_fee": membership.get("total_freeze_fee", 0),
            }
        else:
            user_data["active_membership"] = None
        
        # Filter by membership status if requested
        if status == "active" and not membership:
            continue
        if status == "inactive" and membership:
            continue
            
        result.append(user_data)
    
    return result

@api_router.post("/admin/users/bulk-delete")
async def bulk_delete_users(
    user_ids: List[str] = Body(...),
    current_user: dict = Depends(get_admin_user),
    background_tasks: BackgroundTasks = None
):
    """Delete multiple users"""
    deleted_count = 0
    for user_id in user_ids:
        user = await db.users.find_one({"id": user_id})
        if user and user.get("role") != "admin":
            await db.users.delete_one({"id": user_id})
            await db.memberships.delete_many({"user_id": user_id})
            await db.attendance.delete_many({"user_id": user_id})
            await db.health_logs.delete_many({"user_id": user_id})
            await db.calorie_logs.delete_many({"user_id": user_id})
            deleted_count += 1
    
    return {"message": f"{deleted_count} users deleted", "deleted_count": deleted_count}

@api_router.post("/admin/users/{user_id}/toggle-status")
async def toggle_user_status(
    user_id: str,
    action: str = Body(..., embed=True),  # "disable" or "enable"
    current_user: dict = Depends(get_admin_user),
    background_tasks: BackgroundTasks = None
):
    """Disable or enable a user account"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Cannot disable admin user")
    
    is_disabled = action == "disable"
    await db.users.update_one({"id": user_id}, {"$set": {"is_disabled": is_disabled}})
    
    # Send notification
    if background_tasks:
        if is_disabled:
            message = "Your F3 Fitness account has been temporarily disabled. Please contact the gym for more information."
        else:
            message = "Your F3 Fitness account has been reactivated. You can now login and use all features."
        
        # Send WhatsApp
        if user.get("phone_number"):
            full_phone = f"{user.get('country_code', '+91')}{user['phone_number'].lstrip('0')}"
            background_tasks.add_task(send_whatsapp, full_phone, f"🏋️ F3 Fitness Update\n\n{message}")
        
        # Send Email
        email_body = f"""
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto; background: #09090b; color: #fff; padding: 40px;">
            <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" style="width: 150px; margin-bottom: 20px;" />
            <h1 style="color: #06b6d4;">Account Status Update</h1>
            <p>Hello {user['name']},</p>
            <p>{message}</p>
        </div>
        """
        background_tasks.add_task(send_email, user["email"], "Account Status Update - F3 Fitness", email_body)
    
    return {"message": f"User {'disabled' if is_disabled else 'enabled'} successfully"}

@api_router.post("/admin/users/{user_id}/revoke-membership")
async def revoke_membership(
    user_id: str,
    current_user: dict = Depends(get_admin_user),
    background_tasks: BackgroundTasks = None
):
    """Revoke/cancel active membership for a user"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    membership = await db.memberships.find_one({"user_id": user_id, "status": "active"})
    if not membership:
        raise HTTPException(status_code=400, detail="No active membership found")
    
    await db.memberships.update_one(
        {"id": membership["id"]},
        {"$set": {"status": "revoked", "revoked_at": get_ist_now().isoformat()}}
    )
    
    # Send notification
    if background_tasks:
        plan = await db.plans.find_one({"id": membership.get("plan_id")})
        plan_name = plan["name"] if plan else "membership"
        
        message = f"Your {plan_name} at F3 Fitness has been revoked. Please contact the gym for more information."
        
        if user.get("phone_number"):
            full_phone = f"{user.get('country_code', '+91')}{user['phone_number'].lstrip('0')}"
            background_tasks.add_task(send_whatsapp, full_phone, f"🏋️ F3 Fitness\n\n{message}")
        
        email_body = f"""
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto; background: #09090b; color: #fff; padding: 40px;">
            <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" style="width: 150px; margin-bottom: 20px;" />
            <h1 style="color: #f97316;">Membership Revoked</h1>
            <p>Hello {user['name']},</p>
            <p>{message}</p>
        </div>
        """
        background_tasks.add_task(send_email, user["email"], "Membership Revoked - F3 Fitness", email_body)
    
    await log_activity(
        current_user["id"],
        "membership_revoked",
        f"Revoked membership {membership['id']} for {user.get('name') or user.get('member_id')}",
        metadata={"membership_id": membership["id"], "target_user_id": user_id}
    )
    
    return {"message": "Membership revoked successfully"}

@api_router.get("/admin/users/{user_id}/password")
async def get_user_password(
    user_id: str,
    current_user: dict = Depends(get_admin_user)
):
    """Get user's password (admin only) - returns masked password hint"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # For security, we can't retrieve the actual password (it's hashed)
    # Instead, we return info that admin can set a new password
    return {
        "message": "Password is hashed and cannot be retrieved. Use the reset endpoint to set a new password.",
        "can_reset": True
    }

@api_router.post("/admin/users/{user_id}/reset-password")
async def admin_reset_user_password(
    user_id: str,
    new_password: str = Body(..., embed=True),
    current_user: dict = Depends(get_admin_user),
    background_tasks: BackgroundTasks = None
):
    """Admin resets a user's password and sends notification"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hash_password(new_password)}}
    )
    
    # Send notification with new password
    if background_tasks:
        if user.get("phone_number"):
            full_phone = f"{user.get('country_code', '+91')}{user['phone_number'].lstrip('0')}"
            whatsapp_msg = f"""🏋️ F3 Fitness - Password Reset

Hello {user['name']},

Your password has been reset by the admin.

New Password: {new_password}

Please login and change your password immediately for security.

Login: https://f3fitness.in/login"""
            background_tasks.add_task(send_whatsapp, full_phone, whatsapp_msg)
        
        email_body = f"""
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto; background: #09090b; color: #fff; padding: 40px;">
            <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" style="width: 150px; margin-bottom: 20px;" />
            <h1 style="color: #06b6d4;">Password Reset</h1>
            <p>Hello {user['name']},</p>
            <p>Your password has been reset by the admin.</p>
            <div style="background: #18181b; padding: 20px; margin: 20px 0;">
                <p style="margin: 0;"><strong>New Password:</strong> <code style="color: #06b6d4; font-size: 18px;">{new_password}</code></p>
            </div>
            <p style="color: #f97316;">Please login and change your password immediately for security.</p>
            <a href="https://f3fitness.in/login" style="display: inline-block; background: #06b6d4; color: #000; padding: 12px 24px; text-decoration: none; font-weight: bold; margin-top: 10px;">Login Now</a>
        </div>
        """
        background_tasks.add_task(send_email, user["email"], "Password Reset - F3 Fitness", email_body)
    
    await log_activity(
        current_user["id"],
        "admin_reset_password",
        f"Admin reset password for {user.get('name') or user.get('member_id')}",
        metadata={"target_user_id": user_id}
    )
    
    return {"message": "Password reset successfully and notification sent"}

# ==================== PT ASSIGNMENT ROUTES ====================

@api_router.post("/users/{user_id}/assign-pt")
async def assign_pt_to_user(
    user_id: str,
    trainer_id: str,
    sessions: int = 0,
    current_user: dict = Depends(get_admin_user)
):
    """Assign a PT trainer to a user"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    trainer = await db.users.find_one({"id": trainer_id, "role": "trainer"})
    if not trainer:
        raise HTTPException(status_code=404, detail="Trainer not found")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"pt_trainer_id": trainer_id, "pt_sessions_remaining": sessions}}
    )
    
    return {"message": f"PT assigned: {trainer['name']} ({sessions} sessions)"}

@api_router.get("/users/{user_id}/pt-clients", response_model=List[UserResponse])
async def get_pt_clients(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get all PT clients for a trainer"""
    if current_user["role"] not in ["admin", "trainer"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    trainer_id = user_id if current_user["role"] == "admin" else current_user["id"]
    clients = await db.users.find({"pt_trainer_id": trainer_id}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return clients

# ==================== PLANS ROUTES ====================

@api_router.get("/plans", response_model=List[PlanResponse])
async def get_plans(active_only: bool = False):
    query = {"is_active": True} if active_only else {}
    plans = await db.plans.find(query, {"_id": 0}).to_list(100)
    return plans

@api_router.post("/plans", response_model=PlanResponse)
async def create_plan(plan: PlanCreate, current_user: dict = Depends(get_admin_user)):
    plan_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    plan_doc = {
        "id": plan_id,
        **plan.model_dump(),
        "created_at": now
    }
    
    await db.plans.insert_one(plan_doc)
    return {k: v for k, v in plan_doc.items() if k != "_id"}

@api_router.put("/plans/{plan_id}", response_model=PlanResponse)
async def update_plan(plan_id: str, plan: PlanCreate, current_user: dict = Depends(get_admin_user)):
    update_data = plan.model_dump()
    result = await db.plans.update_one({"id": plan_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    updated = await db.plans.find_one({"id": plan_id}, {"_id": 0})
    return updated

@api_router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str, current_user: dict = Depends(get_admin_user)):
    result = await db.plans.delete_one({"id": plan_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"message": "Plan deleted"}

# ==================== PT PACKAGES ROUTES ====================

@api_router.get("/pt-packages", response_model=List[PTPackageResponse])
async def get_pt_packages(active_only: bool = False):
    query = {"is_active": True} if active_only else {}
    packages = await db.pt_packages.find(query, {"_id": 0}).to_list(100)
    return packages

@api_router.post("/pt-packages", response_model=PTPackageResponse)
async def create_pt_package(package: PTPackageCreate, current_user: dict = Depends(get_admin_user)):
    package_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    package_doc = {
        "id": package_id,
        **package.model_dump(),
        "created_at": now
    }
    
    await db.pt_packages.insert_one(package_doc)
    return {k: v for k, v in package_doc.items() if k != "_id"}

@api_router.put("/pt-packages/{package_id}", response_model=PTPackageResponse)
async def update_pt_package(package_id: str, package: PTPackageCreate, current_user: dict = Depends(get_admin_user)):
    update_data = package.model_dump()
    result = await db.pt_packages.update_one({"id": package_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    
    updated = await db.pt_packages.find_one({"id": package_id}, {"_id": 0})
    return updated

@api_router.delete("/pt-packages/{package_id}")
async def delete_pt_package(package_id: str, current_user: dict = Depends(get_admin_user)):
    result = await db.pt_packages.delete_one({"id": package_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    return {"message": "Package deleted"}

# ==================== MEMBERSHIPS ROUTES ====================

@api_router.get("/memberships", response_model=List[MembershipResponse])
async def get_memberships(user_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if user_id:
        query["user_id"] = user_id
    elif current_user["role"] != "admin":
        query["user_id"] = current_user["id"]
    
    memberships = await db.memberships.find(query, {"_id": 0}).to_list(1000)
    
    for m in memberships:
        plan = await db.plans.find_one({"id": m["plan_id"]}, {"_id": 0, "name": 1})
        m["plan_name"] = plan["name"] if plan else None
        
        # Calculate total amount paid for this membership
        payments = await db.payments.find({"membership_id": m["id"]}, {"amount_paid": 1}).to_list(100)
        total_paid = sum(p.get("amount_paid", 0) for p in payments)
        m["amount_paid"] = total_paid
        m["amount_due"] = m.get("final_price", 0) - total_paid
    
    return memberships

@api_router.get("/memberships/active/{user_id}", response_model=Optional[MembershipResponse])
async def get_active_membership(user_id: str, current_user: dict = Depends(get_current_user)):
    membership = await db.memberships.find_one(
        {"user_id": user_id, "status": "active"},
        {"_id": 0},
        sort=[("end_date", -1)]
    )
    
    if membership:
        plan = await db.plans.find_one({"id": membership["plan_id"]}, {"_id": 0, "name": 1})
        membership["plan_name"] = plan["name"] if plan else None
        
        # Calculate total amount paid for this membership
        payments = await db.payments.find({"membership_id": membership["id"]}, {"amount_paid": 1}).to_list(100)
        total_paid = sum(p.get("amount_paid", 0) for p in payments)
        membership["amount_paid"] = total_paid
        membership["amount_due"] = membership.get("final_price", 0) - total_paid
    
    return membership

@api_router.post("/memberships", response_model=MembershipResponse)
async def create_membership(membership: MembershipCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_admin_user)):
    plan = await db.plans.find_one({"id": membership.plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    user = await db.users.find_one({"id": membership.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = await db.memberships.find_one(
        {"user_id": membership.user_id, "status": "active"},
        sort=[("end_date", -1)]
    )
    
    # Use custom dates if provided (for importing existing members)
    if membership.custom_start_date and membership.custom_end_date:
        # Parse custom dates
        start_date = datetime.fromisoformat(membership.custom_start_date)
        end_date = datetime.fromisoformat(membership.custom_end_date)
    elif existing:
        start_date = datetime.fromisoformat(existing["end_date"])
        end_date = start_date + timedelta(days=plan["duration_days"])
    else:
        start_date = get_ist_now()
        end_date = start_date + timedelta(days=plan["duration_days"])
    
    final_price = plan["price"] - membership.discount_amount
    amount_paid = membership.initial_payment
    amount_due = final_price - amount_paid
    
    membership_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    membership_doc = {
        "id": membership_id,
        "user_id": membership.user_id,
        "plan_id": membership.plan_id,
        "start_date": start_date.isoformat() if isinstance(start_date, datetime) else start_date,
        "end_date": end_date.isoformat(),
        "status": "active",
        "original_price": plan["price"],
        "discount_amount": membership.discount_amount,
        "final_price": final_price,
        "amount_paid": amount_paid,
        "amount_due": amount_due,
        "created_at": now
    }
    
    await db.memberships.insert_one(membership_doc)
    
    # Add PT sessions if plan includes PT
    if plan.get("includes_pt") and plan.get("pt_sessions", 0) > 0:
        current_sessions = user.get("pt_sessions_remaining", 0)
        await db.users.update_one(
            {"id": membership.user_id},
            {"$set": {"pt_sessions_remaining": current_sessions + plan["pt_sessions"]}}
        )
    
    receipt_no = None
    if membership.initial_payment > 0:
        # Use custom payment date if provided, otherwise use current time
        if membership.payment_date:
            payment_datetime = datetime.fromisoformat(membership.payment_date)
            payment_date_str = payment_datetime.isoformat()
            payment_date_display = payment_datetime.strftime("%d %b %Y")
        else:
            payment_date_str = now
            payment_date_display = datetime.now().strftime("%d %b %Y")
        
        receipt_no = f"F3-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        payment_doc = {
            "id": str(uuid.uuid4()),
            "receipt_no": receipt_no,
            "membership_id": membership_id,
            "user_id": membership.user_id,
            "amount_paid": membership.initial_payment,
            "payment_date": payment_date_str,
            "payment_method": membership.payment_method,
            "notes": f"Payment for {plan['name']}",
            "recorded_by_admin_id": current_user["id"]
        }
        await db.payments.insert_one(payment_doc)
        
        # Send payment notification
        await send_notification(user, "payment_received", {
            "receipt_no": receipt_no,
            "amount": membership.initial_payment,
            "payment_mode": membership.payment_method,
            "payment_date": payment_date_display,
            "description": f"Payment for {plan['name']}"
        }, background_tasks)
        await send_invoice_to_member(user, payment_doc["id"], background_tasks)
    
    # Send membership activation notification
    await send_notification(user, "membership_activated", {
        "plan_name": plan["name"],
        "start_date": (start_date if isinstance(start_date, datetime) else datetime.fromisoformat(start_date)).strftime("%d %b %Y"),
        "end_date": end_date.strftime("%d %b %Y")
    }, background_tasks)
    
    result = {k: v for k, v in membership_doc.items() if k != "_id"}
    result["plan_name"] = plan["name"]
    return result

@api_router.put("/memberships/{membership_id}/cancel")
async def cancel_membership(membership_id: str, current_user: dict = Depends(get_admin_user)):
    result = await db.memberships.update_one({"id": membership_id}, {"$set": {"status": "cancelled"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Membership not found")
    return {"message": "Membership cancelled"}

@api_router.post("/memberships/{membership_id}/freeze")
async def freeze_membership(
    membership_id: str,
    req: MembershipFreezeRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_admin_user)
):
    """Freeze an active membership for a date range and extend expiry accordingly."""
    membership = await db.memberships.find_one({"id": membership_id}, {"_id": 0})
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    if membership.get("status") != "active":
        raise HTTPException(status_code=400, detail="Only active memberships can be frozen")

    try:
        freeze_start = datetime.fromisoformat(req.freeze_start_date[:10]).date()
        freeze_end = datetime.fromisoformat(req.freeze_end_date[:10]).date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid freeze dates. Use YYYY-MM-DD format")

    if freeze_end < freeze_start:
        raise HTTPException(status_code=400, detail="Freeze end date cannot be before start date")

    membership_start = datetime.fromisoformat(membership["start_date"]).date()
    membership_end_dt = datetime.fromisoformat(membership["end_date"])
    membership_end = membership_end_dt.date()

    if freeze_start < membership_start:
        raise HTTPException(status_code=400, detail="Freeze cannot start before membership start date")
    if freeze_start > membership_end:
        raise HTTPException(status_code=400, detail="Freeze start date must be within the current membership period")

    freeze_days = (freeze_end - freeze_start).days + 1
    if freeze_days <= 0:
        raise HTTPException(status_code=400, detail="Invalid freeze duration")

    # Prevent overlapping freeze ranges for the same membership
    for existing in membership.get("freeze_history", []):
        try:
            existing_start = datetime.fromisoformat(existing["freeze_start_date"][:10]).date()
            existing_end = datetime.fromisoformat(existing["freeze_end_date"][:10]).date()
            overlaps = not (freeze_end < existing_start or freeze_start > existing_end)
            if overlaps:
                raise HTTPException(status_code=400, detail="Freeze period overlaps an existing freeze range")
        except HTTPException:
            raise
        except Exception:
            # Ignore malformed legacy freeze entries
            pass

    extended_end_dt = membership_end_dt + timedelta(days=freeze_days)
    now_iso = get_ist_now().isoformat()

    freeze_entry = {
        "id": str(uuid.uuid4()),
        "freeze_start_date": freeze_start.isoformat(),
        "freeze_end_date": freeze_end.isoformat(),
        "freeze_days": freeze_days,
        "freeze_fee": req.freeze_fee,
        "payment_method": req.payment_method,
        "notes": req.notes,
        "frozen_at": now_iso,
        "frozen_by_admin_id": current_user["id"]
    }

    update_doc = {
        "$set": {
            "end_date": extended_end_dt.isoformat(),
            "updated_at": now_iso
        },
        "$push": {"freeze_history": freeze_entry},
        "$inc": {
            "total_frozen_days": freeze_days,
            "total_freeze_fee": req.freeze_fee
        }
    }
    await db.memberships.update_one({"id": membership_id}, update_doc)

    # Optional freeze fee payment record
    if req.freeze_fee and req.freeze_fee > 0:
        payment_id = str(uuid.uuid4())
        receipt_no = f"F3-FRZ-{datetime.now().strftime('%Y%m%d')}-{payment_id[:8].upper()}"
        await db.payments.insert_one({
            "id": payment_id,
            "receipt_no": receipt_no,
            "membership_id": membership_id,
            "user_id": membership["user_id"],
            "amount_paid": req.freeze_fee,
            "payment_date": now_iso,
            "payment_method": req.payment_method,
            "notes": req.notes or f"Membership freeze fee ({freeze_days} days)",
            "recorded_by_admin_id": current_user["id"]
        })

    await log_activity(
        current_user["id"],
        "membership_frozen",
        f"Froze membership {membership_id} for {freeze_days} days (fee: {req.freeze_fee})",
        metadata={
            "membership_id": membership_id,
            "freeze_days": freeze_days,
            "freeze_start_date": freeze_start.isoformat(),
            "freeze_end_date": freeze_end.isoformat(),
            "freeze_fee": req.freeze_fee,
        }
    )

    updated = await db.memberships.find_one({"id": membership_id}, {"_id": 0})
    user = await db.users.find_one({"id": membership["user_id"]}, {"_id": 0})
    if updated:
        plan = await db.plans.find_one({"id": updated.get("plan_id")}, {"_id": 0, "name": 1})
        if plan:
            updated["plan_name"] = plan.get("name")
    if user:
        await send_notification(user, "freeze_started", {
            "freeze_start_date": freeze_start.strftime("%d %b %Y"),
            "freeze_end_date": freeze_end.strftime("%d %b %Y"),
            "freeze_days": freeze_days,
            "new_expiry_date": extended_end_dt.strftime("%d %b %Y"),
            "freeze_fee": req.freeze_fee
        }, background_tasks)
    return {
        "message": "Membership frozen successfully",
        "membership": updated,
        "freeze": freeze_entry,
        "new_end_date": extended_end_dt.date().isoformat()
    }

@api_router.put("/memberships/{membership_id}/freeze/{freeze_id}")
async def edit_membership_freeze(
    membership_id: str,
    freeze_id: str,
    req: MembershipFreezeEditRequest,
    current_user: dict = Depends(get_admin_user)
):
    membership = await db.memberships.find_one({"id": membership_id}, {"_id": 0})
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    freeze_history = membership.get("freeze_history", [])
    freeze_idx = next((i for i, f in enumerate(freeze_history) if f.get("id") == freeze_id), None)
    if freeze_idx is None:
        raise HTTPException(status_code=404, detail="Freeze record not found")

    try:
        new_start = datetime.fromisoformat(req.freeze_start_date[:10]).date()
        new_end = datetime.fromisoformat(req.freeze_end_date[:10]).date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid freeze dates. Use YYYY-MM-DD")
    if new_end < new_start:
        raise HTTPException(status_code=400, detail="Freeze end date cannot be before start date")

    membership_start = datetime.fromisoformat(membership["start_date"]).date()
    if new_start < membership_start:
        raise HTTPException(status_code=400, detail="Freeze cannot start before membership start date")

    freeze_entry = freeze_history[freeze_idx]
    old_start = datetime.fromisoformat(freeze_entry["freeze_start_date"][:10]).date()
    old_end = datetime.fromisoformat(freeze_entry["freeze_end_date"][:10]).date()
    old_days = int(freeze_entry.get("freeze_days") or ((old_end - old_start).days + 1))
    old_fee = float(freeze_entry.get("freeze_fee") or 0)
    new_days = (new_end - new_start).days + 1

    # overlap check with all other freeze entries
    for i, f in enumerate(freeze_history):
        if i == freeze_idx:
            continue
        try:
            fs = datetime.fromisoformat(f["freeze_start_date"][:10]).date()
            fe = datetime.fromisoformat(f["freeze_end_date"][:10]).date()
            overlaps = not (new_end < fs or new_start > fe)
            if overlaps:
                raise HTTPException(status_code=400, detail="Freeze period overlaps an existing freeze range")
        except HTTPException:
            raise
        except Exception:
            pass

    delta_days = new_days - old_days
    membership_end_dt = datetime.fromisoformat(membership["end_date"]) + timedelta(days=delta_days)

    freeze_entry["freeze_start_date"] = new_start.isoformat()
    freeze_entry["freeze_end_date"] = new_end.isoformat()
    freeze_entry["freeze_days"] = new_days
    if req.freeze_fee is not None:
        freeze_entry["freeze_fee"] = req.freeze_fee
    if req.payment_method is not None:
        freeze_entry["payment_method"] = req.payment_method
    if req.notes is not None:
        freeze_entry["notes"] = req.notes
    freeze_entry["updated_at"] = get_ist_now().isoformat()
    freeze_entry["updated_by_admin_id"] = current_user["id"]

    total_frozen_days = max(0, (membership.get("total_frozen_days", 0) or 0) + delta_days)
    fee_delta = (float(freeze_entry.get("freeze_fee") or 0) - old_fee)
    total_freeze_fee = max(0, float(membership.get("total_freeze_fee", 0) or 0) + fee_delta)
    now_iso = get_ist_now().isoformat()
    await db.memberships.update_one(
        {"id": membership_id},
        {"$set": {
            "freeze_history": freeze_history,
            "total_frozen_days": total_frozen_days,
            "total_freeze_fee": total_freeze_fee,
            "end_date": membership_end_dt.isoformat(),
            "updated_at": now_iso
        }}
    )

    await log_activity(
        current_user["id"],
        "membership_freeze_edited",
        f"Edited freeze {freeze_id} on membership {membership_id} ({old_days} -> {new_days} days)",
        metadata={"membership_id": membership_id, "freeze_id": freeze_id}
    )

    updated = await db.memberships.find_one({"id": membership_id}, {"_id": 0})
    return {
        "message": "Freeze updated successfully",
        "membership": updated,
        "freeze": freeze_entry,
        "new_end_date": membership_end_dt.date().isoformat()
    }

@api_router.post("/memberships/{membership_id}/freeze/{freeze_id}/end")
async def end_membership_freeze_early(
    membership_id: str,
    freeze_id: str,
    req: MembershipFreezeEndRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_admin_user)
):
    membership = await db.memberships.find_one({"id": membership_id}, {"_id": 0})
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    freeze_history = membership.get("freeze_history", [])
    freeze_idx = next((i for i, f in enumerate(freeze_history) if f.get("id") == freeze_id), None)
    if freeze_idx is None:
        raise HTTPException(status_code=404, detail="Freeze record not found")

    freeze_entry = freeze_history[freeze_idx]
    freeze_start = datetime.fromisoformat(freeze_entry["freeze_start_date"][:10]).date()
    freeze_end = datetime.fromisoformat(freeze_entry["freeze_end_date"][:10]).date()
    unfreeze_date = get_ist_now().date() if not req.end_date else datetime.fromisoformat(req.end_date[:10]).date()

    # UI sends the date member should become active again.
    # Therefore the final frozen date is one day before unfreeze_date.
    if unfreeze_date < freeze_start:
        raise HTTPException(status_code=400, detail="Unfreeze date cannot be before freeze start date")
    if unfreeze_date > (freeze_end + timedelta(days=1)):
        raise HTTPException(status_code=400, detail="Unfreeze date must be on or before one day after current freeze end date")

    old_days = int(freeze_entry.get("freeze_days") or ((freeze_end - freeze_start).days + 1))
    final_freeze_end = unfreeze_date - timedelta(days=1)
    new_days = 0 if final_freeze_end < freeze_start else (final_freeze_end - freeze_start).days + 1
    delta_remove = old_days - new_days

    if delta_remove <= 0:
        return {
            "message": "Freeze end date unchanged",
            "membership": membership,
            "freeze": freeze_entry,
            "new_end_date": datetime.fromisoformat(membership["end_date"]).date().isoformat(),
            "unfreeze_date": unfreeze_date.isoformat()
        }

    membership_end_dt = datetime.fromisoformat(membership["end_date"]) - timedelta(days=delta_remove)
    freeze_entry["original_freeze_end_date"] = freeze_entry.get("original_freeze_end_date", freeze_end.isoformat())

    if new_days <= 0:
        freeze_history.pop(freeze_idx)
    else:
        freeze_entry["freeze_end_date"] = final_freeze_end.isoformat()
        freeze_entry["freeze_days"] = new_days
        freeze_entry["ended_early_at"] = get_ist_now().isoformat()
        freeze_entry["ended_early_by_admin_id"] = current_user["id"]

    total_frozen_days = max(0, (membership.get("total_frozen_days", 0) or 0) - delta_remove)
    now_iso = get_ist_now().isoformat()
    await db.memberships.update_one(
        {"id": membership_id},
        {"$set": {
            "freeze_history": freeze_history,
            "total_frozen_days": total_frozen_days,
            "end_date": membership_end_dt.isoformat(),
            "updated_at": now_iso
        }}
    )

    await log_activity(
        current_user["id"],
        "membership_freeze_ended_early",
        f"Ended freeze {freeze_id} early on membership {membership_id} (reduced {delta_remove} days)",
        metadata={"membership_id": membership_id, "freeze_id": freeze_id, "reduced_days": delta_remove}
    )

    updated = await db.memberships.find_one({"id": membership_id}, {"_id": 0})
    user = await db.users.find_one({"id": membership["user_id"]}, {"_id": 0})
    if user:
        await send_notification(user, "freeze_ended", {
            "freeze_end_date": unfreeze_date.strftime("%d %b %Y"),
            "new_expiry_date": membership_end_dt.strftime("%d %b %Y"),
            "end_mode": "early"
        }, background_tasks)
    return {
        "message": "Freeze ended early successfully",
        "membership": updated,
        "freeze": freeze_entry,
        "new_end_date": membership_end_dt.date().isoformat(),
        "unfreeze_date": unfreeze_date.isoformat()
    }

@api_router.post("/memberships/{membership_id}/freeze/{freeze_id}/cancel")
async def cancel_upcoming_membership_freeze(
    membership_id: str,
    freeze_id: str,
    current_user: dict = Depends(get_admin_user)
):
    membership = await db.memberships.find_one({"id": membership_id}, {"_id": 0})
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    freeze_history = membership.get("freeze_history", []) or []
    freeze_idx = next((i for i, f in enumerate(freeze_history) if f.get("id") == freeze_id), None)
    if freeze_idx is None:
        raise HTTPException(status_code=404, detail="Freeze record not found")

    freeze_entry = freeze_history[freeze_idx]
    freeze_start = datetime.fromisoformat(freeze_entry["freeze_start_date"][:10]).date()
    freeze_end = datetime.fromisoformat(freeze_entry["freeze_end_date"][:10]).date()
    today = get_ist_now().date()

    if freeze_start <= today:
        raise HTTPException(status_code=400, detail="Only upcoming freezes can be cancelled. Use End Freeze for active freeze")

    freeze_days = int(freeze_entry.get("freeze_days") or ((freeze_end - freeze_start).days + 1))
    if freeze_days < 0:
        freeze_days = 0

    membership_end_dt = datetime.fromisoformat(membership["end_date"]) - timedelta(days=freeze_days)
    freeze_history.pop(freeze_idx)

    total_frozen_days = max(0, (membership.get("total_frozen_days", 0) or 0) - freeze_days)
    now_iso = get_ist_now().isoformat()
    await db.memberships.update_one(
        {"id": membership_id},
        {"$set": {
            "freeze_history": freeze_history,
            "total_frozen_days": total_frozen_days,
            "end_date": membership_end_dt.isoformat(),
            "updated_at": now_iso
        }}
    )

    await log_activity(
        current_user["id"],
        "membership_freeze_cancelled",
        f"Cancelled upcoming freeze {freeze_id} on membership {membership_id} ({freeze_days} days)",
        metadata={"membership_id": membership_id, "freeze_id": freeze_id, "cancelled_days": freeze_days}
    )

    updated = await db.memberships.find_one({"id": membership_id}, {"_id": 0})
    return {
        "message": "Upcoming freeze cancelled successfully",
        "membership": updated,
        "cancelled_freeze": freeze_entry,
        "new_end_date": membership_end_dt.date().isoformat()
    }

# ==================== PAYMENTS ROUTES ====================

@api_router.get("/payments", response_model=List[PaymentResponse])
async def get_payments(
    user_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    # Non-admin users can only see their own payments
    if current_user["role"] != "admin":
        query["user_id"] = current_user["id"]
    elif user_id:
        query["user_id"] = user_id
        
    if date_from:
        query["payment_date"] = {"$gte": date_from}
    if date_to:
        if "payment_date" in query:
            query["payment_date"]["$lte"] = date_to
        else:
            query["payment_date"] = {"$lte": date_to}
    
    payments = await db.payments.find(query, {"_id": 0}).sort("payment_date", -1).to_list(1000)
    
    for p in payments:
        user = await db.users.find_one({"id": p["user_id"]}, {"_id": 0, "name": 1, "member_id": 1})
        if user:
            p["user_name"] = user["name"]
            p["member_id"] = user["member_id"]
    
    return payments

@api_router.get("/payments/today-collection")
async def get_today_collection(current_user: dict = Depends(get_admin_user)):
    today_start = get_ist_today_start().isoformat()
    today_end = get_ist_today_end().isoformat()
    
    payments = await db.payments.find({
        "payment_date": {"$gte": today_start, "$lte": today_end}
    }, {"_id": 0, "amount_paid": 1}).to_list(1000)
    
    total = sum(p["amount_paid"] for p in payments)
    return {"total": total, "count": len(payments)}

@api_router.get("/payments/summary")
async def get_payment_summary(
    period: str = "daily",
    date: Optional[str] = None,
    current_user: dict = Depends(get_admin_user)
):
    if not date:
        date = get_ist_now().strftime("%Y-%m-%d")
    
    if period == "daily":
        start = f"{date}T00:00:00"
        end = f"{date}T23:59:59"
    elif period == "monthly":
        year_month = date[:7]
        start = f"{year_month}-01T00:00:00"
        year, month = int(date[:4]), int(date[5:7])
        if month == 12:
            end = f"{year + 1}-01-01T00:00:00"
        else:
            end = f"{year}-{month + 1:02d}-01T00:00:00"
    elif period == "yearly":
        year = date[:4]
        start = f"{year}-01-01T00:00:00"
        end = f"{int(year) + 1}-01-01T00:00:00"
    else:
        raise HTTPException(status_code=400, detail="Invalid period")
    
    payments = await db.payments.find({
        "payment_date": {"$gte": start, "$lt": end}
    }, {"_id": 0}).to_list(10000)
    
    total = sum(p["amount_paid"] for p in payments)
    
    by_method = {}
    for p in payments:
        method = p["payment_method"]
        by_method[method] = by_method.get(method, 0) + p["amount_paid"]
    
    return {"total": total, "count": len(payments), "by_method": by_method}

@api_router.post("/payments", response_model=PaymentResponse)
async def create_payment(payment: PaymentCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"id": payment.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    membership = await db.memberships.find_one(
        {"user_id": payment.user_id, "status": "active"},
        sort=[("end_date", -1)]
    )
    
    payment_id = str(uuid.uuid4())
    receipt_no = f"F3-{datetime.now().strftime('%Y%m%d')}-{payment_id[:8].upper()}"
    now = get_ist_now().isoformat()
    
    payment_doc = {
        "id": payment_id,
        "receipt_no": receipt_no,
        "membership_id": membership["id"] if membership else None,
        "user_id": payment.user_id,
        "amount_paid": payment.amount_paid,
        "payment_date": now,
        "payment_method": payment.payment_method,
        "notes": payment.notes,
        "recorded_by_admin_id": current_user["id"]
    }
    
    await db.payments.insert_one(payment_doc)
    await log_activity(
        current_user["id"],
        "payment_added",
        f"Recorded payment ₹{payment.amount_paid} for {user.get('name') or user.get('member_id')}",
        metadata={
            "payment_id": payment_id,
            "receipt_no": receipt_no,
            "target_user_id": payment.user_id,
            "membership_id": payment_doc.get("membership_id"),
            "payment_method": payment.payment_method
        }
    )
    
    # Send payment notification
    await send_notification(user, "payment_received", {
        "receipt_no": receipt_no,
        "amount": payment.amount_paid,
        "payment_mode": payment.payment_method,
        "payment_date": datetime.now().strftime("%d %b %Y"),
        "description": payment.notes or "Gym Payment"
    }, background_tasks)
    await send_invoice_to_member(user, payment_id, background_tasks)
    
    result = {k: v for k, v in payment_doc.items() if k != "_id"}
    result["user_name"] = user["name"]
    result["member_id"] = user["member_id"]
    return result

# ==================== INVOICE ROUTES ====================

async def _build_invoice_pdf_bytes(payment_id: str):
    """Generate invoice PDF bytes and filename for a payment."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT

    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    user = await db.users.find_one({"id": payment["user_id"]}, {"_id": 0})

    membership = None
    plan = None
    if payment.get("membership_id"):
        membership = await db.memberships.find_one({"id": payment["membership_id"]}, {"_id": 0})
        if membership:
            plan = await db.plans.find_one({"id": membership["plan_id"]}, {"_id": 0})

    receipt_no = payment.get("receipt_no", f"F3-{payment['id'][:8].upper()}")
    payment_date = payment.get("payment_date", "")
    if payment_date:
        try:
            dt = datetime.fromisoformat(payment_date.replace('Z', '+00:00'))
            payment_date_formatted = dt.strftime("%d %b %Y")
        except Exception:
            payment_date_formatted = payment_date[:10] if payment_date else "N/A"
    else:
        payment_date_formatted = "N/A"

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=20*mm, leftMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)

    primary_color = HexColor('#0ea5b7')
    dark_color = HexColor('#0b7285')
    gray_color = HexColor('#64748b')

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=20, textColor=primary_color, alignment=TA_CENTER, spaceAfter=5)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, textColor=gray_color, alignment=TA_CENTER)
    normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontSize=10, textColor=HexColor('#334155'))
    bold_style = ParagraphStyle('Bold', parent=styles['Normal'], fontSize=10, textColor=HexColor('#334155'), fontName='Helvetica-Bold')

    elements = []
    try:
        logo_data = base64.b64decode(F3_LOGO_BASE64)
        logo_buffer = BytesIO(logo_data)
        logo_img = RLImage(logo_buffer, width=120, height=72)
        elements.append(logo_img)
    except Exception as e:
        logger.error(f"Error adding logo: {e}")

    elements.append(Spacer(1, 10))
    elements.append(Paragraph("F3 FITNESS HEALTH CLUB", title_style))
    elements.append(Paragraph("Your Fitness Journey Partner", subtitle_style))
    elements.append(Spacer(1, 5))
    elements.append(Paragraph(f"<b>Receipt: {receipt_no}</b>", ParagraphStyle('Receipt', parent=styles['Normal'], fontSize=12, textColor=primary_color, alignment=TA_CENTER)))
    elements.append(Spacer(1, 20))

    user_name = user.get("name", "N/A") if user else "N/A"
    user_member_id = user.get("member_id", "N/A") if user else "N/A"
    user_phone = user.get("phone_number", "") if user else ""
    user_email = user.get("email", "") if user else ""

    info_data = [
        [Paragraph("<b>BILLED TO</b>", ParagraphStyle('H', fontSize=9, textColor=gray_color)),
         Paragraph("<b>INVOICE DETAILS</b>", ParagraphStyle('R0', fontSize=9, textColor=gray_color, alignment=TA_RIGHT))],
        [Paragraph(f"<b>{user_name}</b>", bold_style),
         Paragraph(f"<b>Invoice #:</b> {receipt_no}", ParagraphStyle('R1', fontSize=10, alignment=TA_RIGHT))],
        [Paragraph(f"Member ID: {user_member_id}", normal_style),
         Paragraph(f"<b>Date:</b> {payment_date_formatted}", ParagraphStyle('R2', fontSize=10, alignment=TA_RIGHT))],
        [Paragraph(f"{user_phone}", normal_style),
         Paragraph(f"<b>Payment Mode:</b> {payment.get('payment_method', 'Cash').title()}", ParagraphStyle('R3', fontSize=10, alignment=TA_RIGHT))],
        [Paragraph(f"{user_email}", normal_style), ""],
    ]
    info_table = Table(info_data, colWidths=[250, 250])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 20))

    header_style = ParagraphStyle('Header', fontSize=10, textColor=HexColor('#FFFFFF'), fontName='Helvetica-Bold')
    if membership and plan:
        start_date = membership.get("start_date", "")[:10] if membership.get("start_date") else ""
        end_date = membership.get("end_date", "")[:10] if membership.get("end_date") else ""
        original_price = membership.get("original_price", 0)
        discount = membership.get("discount_amount", 0)
        table_data = [
            [Paragraph("Description", header_style), Paragraph("Amount", header_style)],
            [Paragraph(f"<b>{plan.get('name', 'Membership Plan')}</b><br/><font size=8 color='#64748b'>{start_date} to {end_date} ({plan.get('duration_days', '')} days)</font>", normal_style),
             Paragraph(f"Rs. {original_price:,.0f}", ParagraphStyle('RA', fontSize=10, alignment=TA_RIGHT))],
        ]
        if discount > 0:
            table_data.append([
                Paragraph("<font color='#10b981'>Discount Applied</font>", normal_style),
                Paragraph(f"<font color='#10b981'>-Rs. {discount:,.0f}</font>", ParagraphStyle('RB', fontSize=10, alignment=TA_RIGHT))
            ])
    else:
        table_data = [
            [Paragraph("Description", header_style), Paragraph("Amount", header_style)],
            [Paragraph(payment.get("notes", "Gym Payment"), normal_style),
             Paragraph(f"Rs. {payment.get('amount_paid', 0):,.0f}", ParagraphStyle('RC', fontSize=10, alignment=TA_RIGHT))],
        ]

    table_data.append([
        Paragraph("<b>Amount Paid</b>", ParagraphStyle('B', fontSize=12, fontName='Helvetica-Bold', textColor=dark_color)),
        Paragraph(f"<b>Rs. {payment.get('amount_paid', 0):,.0f}</b>", ParagraphStyle('RD', fontSize=12, fontName='Helvetica-Bold', textColor=dark_color, alignment=TA_RIGHT))
    ])

    items_table = Table(table_data, colWidths=[350, 150])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), primary_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#FFFFFF')),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, -1), (-1, -1), HexColor('#f0f9ff')),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#e5e7eb')),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 30))

    thanks_style = ParagraphStyle('Thanks', fontSize=11, textColor=dark_color, alignment=TA_CENTER)
    elements.append(Paragraph("Thank you for being a valued member of F3 Fitness Health Club!", thanks_style))
    elements.append(Paragraph("<b>Transform Your Body, Transform Your Life!</b>", ParagraphStyle('Motto', fontSize=10, textColor=primary_color, alignment=TA_CENTER, spaceAfter=30)))

    footer_style = ParagraphStyle('Footer', fontSize=9, textColor=gray_color, alignment=TA_CENTER)
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("<b>F3 FITNESS HEALTH CLUB</b>", ParagraphStyle('FTitle', fontSize=11, textColor=HexColor('#334155'), alignment=TA_CENTER)))
    elements.append(Paragraph("4th Avenue Plot No 4R-B, Mode, near Mandir Marg, Sector 4, Vidyadhar Nagar, Jaipur, Rajasthan 302039", footer_style))
    elements.append(Paragraph("Phone: 072300 52193 | Email: info@f3fitness.in", footer_style))
    elements.append(Paragraph("Mon-Sat: 5:00 AM - 10:00 PM | Sun: 6:00 AM - 12:00 PM | Instagram: @f3fitnessclub", ParagraphStyle('Hours', fontSize=8, textColor=HexColor('#94a3b8'), alignment=TA_CENTER)))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    filename = f"F3_Invoice_{receipt_no}.pdf"
    return pdf_bytes, filename, payment

def _build_demo_invoice_pdf_bytes():
    """Generate a lightweight dummy invoice PDF for template tests."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    from reportlab.pdfgen import canvas

    receipt_no = "RCP-DEMO-001"
    amount = "2500"
    payment_date = "24 Feb 2026"
    filename = "F3_Demo_Invoice.pdf"

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    primary = HexColor("#0ea5b7")
    dark = HexColor("#334155")
    muted = HexColor("#64748b")

    pdf.setFillColor(primary)
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawCentredString(width / 2, height - 30 * mm, "F3 FITNESS HEALTH CLUB")

    pdf.setFillColor(muted)
    pdf.setFont("Helvetica", 11)
    pdf.drawCentredString(width / 2, height - 38 * mm, "Demo Invoice PDF for Template Testing")

    pdf.setFillColor(dark)
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(20 * mm, height - 58 * mm, f"Receipt: {receipt_no}")

    pdf.setFont("Helvetica", 11)
    pdf.drawString(20 * mm, height - 72 * mm, "Customer: Rahul Sharma")
    pdf.drawString(20 * mm, height - 82 * mm, "Member ID: F3-0042")
    pdf.drawString(20 * mm, height - 92 * mm, f"Date: {payment_date}")
    pdf.drawString(20 * mm, height - 102 * mm, "Plan: Quarterly")
    pdf.drawString(20 * mm, height - 112 * mm, f"Amount Paid: Rs.{amount}")

    pdf.setFillColor(primary)
    pdf.rect(20 * mm, height - 145 * mm, width - 40 * mm, 12 * mm, fill=1, stroke=0)
    pdf.setFillColor(HexColor("#ffffff"))
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(24 * mm, height - 137.5 * mm, "This is a dummy invoice PDF used for template testing.")

    pdf.setFillColor(muted)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(20 * mm, 20 * mm, "F3 Fitness Health Club | Jaipur | Template Test Attachment")

    pdf.showPage()
    pdf.save()
    return buffer.getvalue(), filename

async def send_invoice_to_member(user: dict, payment_id: str, background_tasks: Optional[BackgroundTasks] = None):
    """Send invoice PDF by email attachment and WhatsApp (media/link) after payment creation."""
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment or not user:
        return
    try:
        pdf_bytes, filename, payment_doc = await _build_invoice_pdf_bytes(payment_id)
    except Exception as e:
        logger.error(f"Invoice PDF generation failed for payment {payment_id}: {e}")
        return

    receipt_no = payment_doc.get("receipt_no", f"F3-{payment_id[:8].upper()}")
    amount_paid = payment_doc.get("amount_paid", 0)
    payment_date = payment_doc.get("payment_date", "")[:10]
    token = create_invoice_share_token(payment_id)
    invoice_url = f"{get_public_base_url()}/api/invoices/{payment_id}/pdf/public?token={token}"
    vars_with_user = {
        "name": user.get("name"),
        "member_id": user.get("member_id"),
        "receipt_no": receipt_no,
        "amount": amount_paid,
        "payment_date": payment_date or "N/A",
        "invoice_pdf_url": invoice_url
    }

    email_template = await get_template("invoice_sent", "email")
    whatsapp_template = await get_template("invoice_sent", "whatsapp")

    invoice_subject = replace_template_vars(
        email_template.get("subject", f"Invoice {receipt_no} - F3 Fitness"),
        vars_with_user
    )
    invoice_email_content = replace_template_vars(email_template.get("content", ""), vars_with_user)
    invoice_html = wrap_email_in_template(invoice_email_content, invoice_subject)

    email_attachments = [{"filename": filename, "content_bytes": pdf_bytes, "content_type": "application/pdf"}]
    if user.get("email") and invoice_email_content:
        if background_tasks:
            background_tasks.add_task(send_email, user["email"], invoice_subject, invoice_html, email_attachments)
        else:
            await send_email(user["email"], invoice_subject, invoice_html, email_attachments)

    if user.get("phone_number") and whatsapp_template.get("content"):
        phone = user.get("country_code", "+91") + user["phone_number"].lstrip("0")
        wa_text = replace_template_vars(whatsapp_template["content"], vars_with_user)
        wa_text = sanitize_invoice_whatsapp_message(wa_text)
        settings = await db.settings.find_one({"id": "1"}, {"_id": 0, "whatsapp_provider": 1}) or {}
        provider = (settings.get("whatsapp_provider") or "twilio").lower()
        media_kwargs = {
            "media_url": invoice_url,
            "media_base64": None,
            "media_filename": None,
            "media_mimetype": None
        }
        if provider == "evolution":
            media_kwargs = {
                "media_url": None,
                "media_base64": base64.b64encode(pdf_bytes).decode(),
                "media_filename": filename,
                "media_mimetype": "application/pdf"
            }
        if background_tasks:
            background_tasks.add_task(
                send_whatsapp,
                phone,
                wa_text,
                True,
                media_kwargs["media_url"],
                media_kwargs["media_base64"],
                media_kwargs["media_filename"],
                media_kwargs["media_mimetype"],
                "invoice_sent",
                vars_with_user
            )
        else:
            await send_whatsapp(
                phone,
                wa_text,
                True,
                media_kwargs["media_url"],
                media_kwargs["media_base64"],
                media_kwargs["media_filename"],
                media_kwargs["media_mimetype"],
                "invoice_sent",
                vars_with_user
            )

@api_router.get("/invoices/{payment_id}")
async def get_invoice(payment_id: str, current_user: dict = Depends(get_current_user)):
    """Get invoice details for a payment"""
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Check authorization - admin can view all, members can only view their own
    if current_user["role"] != "admin" and payment["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this invoice")
    
    user = await db.users.find_one({"id": payment["user_id"]}, {"_id": 0})
    
    # Get membership details if linked
    membership = None
    plan = None
    amount_due = 0
    total_paid = 0
    if payment.get("membership_id"):
        membership = await db.memberships.find_one({"id": payment["membership_id"]}, {"_id": 0})
        if membership:
            plan = await db.plans.find_one({"id": membership["plan_id"]}, {"_id": 0})
            # Get all payments for this membership to calculate due
            all_payments = await db.payments.find({"membership_id": payment["membership_id"]}, {"_id": 0, "amount_paid": 1}).to_list(100)
            total_paid = sum(p.get("amount_paid", 0) for p in all_payments)
            amount_due = membership.get("final_price", 0) - total_paid
    
    # Get gym settings
    settings = await db.settings.find_one({"id": "1"}, {"_id": 0})
    
    return {
        "invoice": {
            "receipt_no": payment.get("receipt_no", f"F3-{payment['id'][:8].upper()}"),
            "payment_date": payment.get("payment_date"),
            "amount_paid": payment.get("amount_paid"),
            "payment_method": payment.get("payment_method"),
            "notes": payment.get("notes")
        },
        "customer": {
            "name": user.get("name") if user else "Unknown",
            "member_id": user.get("member_id") if user else "",
            "email": user.get("email") if user else "",
            "phone": user.get("phone_number") if user else "",
            "address": user.get("address") if user else ""
        },
        "membership": {
            "plan_name": plan.get("name") if plan else None,
            "duration_days": plan.get("duration_days") if plan else None,
            "start_date": membership.get("start_date") if membership else None,
            "end_date": membership.get("end_date") if membership else None,
            "original_price": membership.get("original_price") if membership else None,
            "discount": membership.get("discount_amount") if membership else 0,
            "final_price": membership.get("final_price") if membership else None,
            "total_paid": total_paid,
            "amount_due": amount_due
        } if membership else None,
        "gym": {
            "name": settings.get("gym_name", "F3 Fitness Gym") if settings else "F3 Fitness Gym",
            "address": settings.get("gym_address", "") if settings else "",
            "phone": settings.get("gym_phone", "") if settings else "",
            "email": settings.get("gym_email", "") if settings else ""
        }
    }

@api_router.get("/memberships/{membership_id}/payments")
async def get_membership_payments(membership_id: str, current_user: dict = Depends(get_current_user)):
    """Get all payments for a specific membership"""
    membership = await db.memberships.find_one({"id": membership_id}, {"_id": 0})
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    
    # Check authorization
    if current_user["role"] != "admin" and membership["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    payments = await db.payments.find(
        {"membership_id": membership_id}, 
        {"_id": 0}
    ).sort("payment_date", -1).to_list(100)
    
    plan = await db.plans.find_one({"id": membership["plan_id"]}, {"_id": 0})
    
    return {
        "membership": {
            "id": membership["id"],
            "plan_name": plan.get("name") if plan else None,
            "start_date": membership.get("start_date"),
            "end_date": membership.get("end_date"),
            "final_price": membership.get("final_price"),
            "amount_paid": sum(p.get("amount_paid", 0) for p in payments),
            "amount_due": membership.get("final_price", 0) - sum(p.get("amount_paid", 0) for p in payments)
        },
        "payments": payments
    }

# ==================== PDF INVOICE GENERATION ====================

@api_router.get("/invoices/{payment_id}/pdf")
async def get_invoice_pdf(payment_id: str, current_user: dict = Depends(get_current_user)):
    """Generate and download PDF invoice using reportlab"""
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Check authorization
    if current_user["role"] != "admin" and payment["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    pdf_bytes, filename, _ = await _build_invoice_pdf_bytes(payment_id)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@api_router.get("/invoices/{payment_id}/pdf/public")
async def get_invoice_pdf_public(payment_id: str, token: str):
    """Public (token-protected) invoice PDF endpoint used for WhatsApp document/link sharing."""
    if not verify_invoice_share_token(token, payment_id):
        raise HTTPException(status_code=403, detail="Invalid or expired invoice token")
    pdf_bytes, filename, _ = await _build_invoice_pdf_bytes(payment_id)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename=\"{filename}\"'}
    )

@api_router.get("/invoices/demo/pdf/public")
async def get_demo_invoice_pdf_public():
    """Public dummy invoice PDF used for template tests and attachment verification."""
    pdf_bytes, filename = _build_demo_invoice_pdf_bytes()
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename=\"{filename}\"'}
    )

# ==================== WHATSAPP LOGS ROUTES ====================

@api_router.get("/email-logs")
async def get_email_logs(
    status: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    current_user: dict = Depends(get_admin_user)
):
    """Get email delivery logs with filtering"""
    query = {}
    if status:
        query["status"] = status

    logs = await db.email_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)

    total = await db.email_logs.count_documents({})
    sent = await db.email_logs.count_documents({"status": "sent"})
    failed = await db.email_logs.count_documents({"status": "failed"})
    pending = await db.email_logs.count_documents({"status": "pending"})

    return {
        "logs": logs,
        "stats": {"total": total, "sent": sent, "failed": failed, "pending": pending},
        "pagination": {"skip": skip, "limit": limit, "total": total}
    }

@api_router.delete("/email-logs")
async def clear_email_logs(current_user: dict = Depends(get_admin_user)):
    result = await db.email_logs.delete_many({})
    return {"message": f"Deleted {result.deleted_count} log entries"}

@api_router.get("/email-logs/stats")
async def get_email_stats(current_user: dict = Depends(get_admin_user)):
    total = await db.email_logs.count_documents({})
    sent = await db.email_logs.count_documents({"status": "sent"})
    failed = await db.email_logs.count_documents({"status": "failed"})

    recent_failures = await db.email_logs.find(
        {"status": "failed"},
        {"_id": 0}
    ).sort("timestamp", -1).limit(10).to_list(10)

    today_start = get_ist_today_start().isoformat()
    today_sent = await db.email_logs.count_documents({
        "status": "sent",
        "timestamp": {"$gte": today_start}
    })
    today_failed = await db.email_logs.count_documents({
        "status": "failed",
        "timestamp": {"$gte": today_start}
    })

    return {
        "total": total,
        "sent": sent,
        "failed": failed,
        "success_rate": round((sent / total * 100), 2) if total > 0 else 0,
        "today": {"sent": today_sent, "failed": today_failed},
        "recent_failures": recent_failures
    }

@api_router.get("/whatsapp-logs")
async def get_whatsapp_logs(
    status: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    current_user: dict = Depends(get_admin_user)
):
    """Get WhatsApp message logs with filtering"""
    query = {}
    if status:
        query["status"] = status
    
    logs = await db.whatsapp_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get total counts for stats
    total = await db.whatsapp_logs.count_documents({})
    sent = await db.whatsapp_logs.count_documents({"status": "sent"})
    failed = await db.whatsapp_logs.count_documents({"status": "failed"})
    pending = await db.whatsapp_logs.count_documents({"status": "pending"})
    
    return {
        "logs": logs,
        "stats": {
            "total": total,
            "sent": sent,
            "failed": failed,
            "pending": pending
        },
        "pagination": {
            "skip": skip,
            "limit": limit,
            "total": total
        }
    }

@api_router.delete("/whatsapp-logs")
async def clear_whatsapp_logs(current_user: dict = Depends(get_admin_user)):
    """Clear all WhatsApp logs"""
    result = await db.whatsapp_logs.delete_many({})
    return {"message": f"Deleted {result.deleted_count} log entries"}

@api_router.get("/whatsapp-logs/stats")
async def get_whatsapp_stats(current_user: dict = Depends(get_admin_user)):
    """Get WhatsApp message statistics"""
    total = await db.whatsapp_logs.count_documents({})
    sent = await db.whatsapp_logs.count_documents({"status": "sent"})
    failed = await db.whatsapp_logs.count_documents({"status": "failed"})
    
    # Get recent failures for debugging
    recent_failures = await db.whatsapp_logs.find(
        {"status": "failed"},
        {"_id": 0}
    ).sort("timestamp", -1).limit(10).to_list(10)
    
    # Get today's stats
    today_start = get_ist_today_start().isoformat()
    today_sent = await db.whatsapp_logs.count_documents({
        "status": "sent",
        "timestamp": {"$gte": today_start}
    })
    today_failed = await db.whatsapp_logs.count_documents({
        "status": "failed",
        "timestamp": {"$gte": today_start}
    })
    
    return {
        "total": total,
        "sent": sent,
        "failed": failed,
        "success_rate": round((sent / total * 100), 2) if total > 0 else 0,
        "today": {
            "sent": today_sent,
            "failed": today_failed
        },
        "recent_failures": recent_failures
    }

@api_router.get("/payment-requests", response_model=List[PaymentRequestResponse])
async def get_payment_requests(status: Optional[str] = None, current_user: dict = Depends(get_admin_user)):
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.payment_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for r in requests:
        user = await db.users.find_one({"id": r["user_id"]}, {"_id": 0, "name": 1, "member_id": 1})
        plan = await db.plans.find_one({"id": r["plan_id"]}, {"_id": 0, "name": 1, "price": 1})
        if user:
            r["user_name"] = user["name"]
            r["member_id"] = user["member_id"]
        if plan:
            r["plan_name"] = plan["name"]
            r["plan_price"] = plan["price"]
    
    return requests

@api_router.post("/payment-requests", response_model=PaymentRequestResponse)
async def create_payment_request(req: PaymentRequestCreate, current_user: dict = Depends(get_current_user)):
    plan = await db.plans.find_one({"id": req.plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    request_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    request_doc = {
        "id": request_id,
        "user_id": current_user["id"],
        "plan_id": req.plan_id,
        "status": "pending",
        "created_at": now
    }
    
    await db.payment_requests.insert_one(request_doc)
    
    result = {k: v for k, v in request_doc.items() if k != "_id"}
    result["user_name"] = current_user["name"]
    result["member_id"] = current_user["member_id"]
    result["plan_name"] = plan["name"]
    result["plan_price"] = plan["price"]
    return result

@api_router.put("/payment-requests/{request_id}/approve")
async def approve_payment_request(
    request_id: str,
    background_tasks: BackgroundTasks,
    discount: float = 0,
    payment_method: str = "cash",
    amount_paid: float = 0,
    current_user: dict = Depends(get_admin_user)
):
    request = await db.payment_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")
    
    membership_data = MembershipCreate(
        user_id=request["user_id"],
        plan_id=request["plan_id"],
        discount_amount=discount,
        initial_payment=amount_paid,
        payment_method=payment_method
    )
    
    await create_membership(membership_data, background_tasks, current_user)
    await db.payment_requests.update_one({"id": request_id}, {"$set": {"status": "completed"}})
    
    return {"message": "Payment request approved and membership created"}

@api_router.put("/payment-requests/{request_id}/reject")
async def reject_payment_request(
    request_id: str,
    current_user: dict = Depends(get_admin_user)
):
    request = await db.payment_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")
    
    await db.payment_requests.update_one({"id": request_id}, {"$set": {"status": "rejected"}})
    
    return {"message": "Payment request rejected"}

# ==================== ATTENDANCE ROUTES ====================

@api_router.get("/attendance", response_model=List[AttendanceResponse])
async def get_attendance(
    user_id: Optional[str] = None,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if user_id:
        query["user_id"] = user_id
    elif current_user["role"] not in ["admin", "receptionist"]:
        query["user_id"] = current_user["id"]
    
    if date:
        query["check_in_time"] = {"$regex": f"^{date}"}
    
    attendance = await db.attendance.find(query, {"_id": 0}).sort("check_in_time", -1).to_list(10000)
    
    for a in attendance:
        user = await db.users.find_one(
            {"id": a["user_id"]},
            {"_id": 0, "name": 1, "member_id": 1, "profile_photo_url": 1, "gender": 1, "role": 1}
        )
        if user:
            if user.get("role") != "member":
                continue
            a["user_name"] = user.get("name", "Unknown User")
            a["member_id"] = user.get("member_id")
            a["profile_photo_url"] = user.get("profile_photo_url")
            a["gender"] = user.get("gender")

    attendance = [a for a in attendance if a.get("user_name")]
    return attendance

@api_router.get("/attendance/today")
async def get_today_attendance(current_user: dict = Depends(get_admin_user)):
    today = get_ist_now().strftime("%Y-%m-%d")
    
    attendance = await db.attendance.find(
        {"check_in_time": {"$regex": f"^{today}"}},
        {"_id": 0}
    ).to_list(10000)
    
    active_memberships = await db.memberships.find({"status": "active"}, {"_id": 0, "user_id": 1}).to_list(10000)
    active_user_ids = set(m["user_id"] for m in active_memberships)

    present = []
    present_member_user_ids = set()
    for a in attendance:
        user = await db.users.find_one({"id": a["user_id"]}, {"_id": 0, "name": 1, "member_id": 1, "role": 1})
        if user:
            if user.get("role") != "member":
                continue
            present_member_user_ids.add(a["user_id"])
            present.append({
                **a,
                "user_name": user.get("name", "Unknown User"),
                "member_id": user.get("member_id")
            })

    absent_user_ids = active_user_ids - present_member_user_ids
    
    absent = []
    for uid in absent_user_ids:
        user = await db.users.find_one({"id": uid}, {"_id": 0, "id": 1, "name": 1, "member_id": 1, "phone_number": 1})
        if user:
            absent.append(user)
    
    return {"present": present, "absent": absent, "present_count": len(present), "absent_count": len(absent)}

@api_router.post("/attendance", response_model=AttendanceResponse)
async def mark_attendance(attendance: AttendanceCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_admin_or_receptionist)):
    search_term = attendance.member_id.strip()
    
    # Search by member_id, id, email, phone, or name
    user = await db.users.find_one({
        "$or": [
            {"id": search_term},
            {"member_id": search_term},
            {"member_id": search_term.upper()},
            {"email": search_term.lower()},
            {"phone": search_term},
            {"phone": f"+91{search_term}" if not search_term.startswith('+') else search_term},
            {"name": {"$regex": f"^{search_term}$", "$options": "i"}}
        ]
    }, {"_id": 0})
    
    # If no exact match, try partial name match
    if not user:
        user = await db.users.find_one({
            "name": {"$regex": search_term, "$options": "i"}
        }, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="Member not found. Try searching by name, phone, email or member ID")

    if user.get("role") != "member":
        raise HTTPException(status_code=400, detail="Attendance can only be marked for members")

    membership = await db.memberships.find_one(
        {"user_id": user["id"]},
        {"_id": 0},
        sort=[("end_date", -1)]
    )
    if not _membership_is_currently_active_for_attendance(membership):
        raise HTTPException(status_code=400, detail=f"No active membership for {user['name']}")
    
    today = get_ist_now().strftime("%Y-%m-%d")
    existing = await db.attendance.find_one({
        "user_id": user["id"],
        "check_in_time": {"$regex": f"^{today}"}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Attendance already marked today for {user['name']}")
    
    attendance_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    # Determine who marked the attendance
    if current_user["role"] == "admin":
        marked_by = "admin"
    elif current_user["role"] == "receptionist":
        marked_by = "self"  # Receptionist is for self check-in kiosk
    else:
        marked_by = "self"
    
    attendance_doc = {
        "id": attendance_id,
        "user_id": user["id"],
        "check_in_time": now,
        "marked_by": marked_by,
        "marked_by_name": current_user["name"] if marked_by == "admin" else None
    }
    
    await db.attendance.insert_one(attendance_doc)
    await log_activity(
        current_user["id"],
        "attendance_marked",
        f"Attendance marked for {user.get('name') or user.get('member_id')}",
        metadata={
            "attendance_id": attendance_id,
            "target_user_id": user["id"],
            "marked_by_role": current_user.get("role"),
            "marked_by_mode": marked_by
        }
    )
    
    # Send attendance notification
    await send_notification(user, "attendance", {}, background_tasks)
    
    return {
        **{k: v for k, v in attendance_doc.items() if k != "_id"},
        "user_name": user["name"],
        "member_id": user["member_id"]
    }

@api_router.get("/attendance/user/{user_id}")
async def get_user_attendance_history(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    attendance = await db.attendance.find({"user_id": user_id}, {"_id": 0}).sort("check_in_time", -1).to_list(1000)
    return attendance

@api_router.get("/attendance/regular-absentees")
async def get_regular_absentees(days: int = 7, current_user: dict = Depends(get_admin_user)):
    """Get members absent for specified consecutive days"""
    cutoff_date = (get_ist_now() - timedelta(days=days)).strftime("%Y-%m-%d")
    
    # Get all active members
    active_memberships = await db.memberships.find({"status": "active"}, {"_id": 0, "user_id": 1}).to_list(10000)
    active_user_ids = [m["user_id"] for m in active_memberships]
    
    absentees = []
    for user_id in active_user_ids:
        # Get last attendance
        last_attendance = await db.attendance.find_one(
            {"user_id": user_id},
            {"_id": 0},
            sort=[("check_in_time", -1)]
        )
        
        if not last_attendance:
            # Never attended
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "name": 1, "member_id": 1, "phone_number": 1})
            if user:
                user["days_absent"] = "Never attended"
                absentees.append(user)
        elif last_attendance["check_in_time"][:10] < cutoff_date:
            # Absent for more than X days
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "name": 1, "member_id": 1, "phone_number": 1})
            if user:
                # Compare date-to-date to avoid mixing timezone-aware and naive datetimes.
                last_date = datetime.fromisoformat(last_attendance["check_in_time"][:10]).date()
                days_absent = (get_ist_now().date() - last_date).days
                user["days_absent"] = days_absent
                user["last_attendance"] = last_attendance["check_in_time"]
                absentees.append(user)
    
    return absentees

# ==================== TASK MANAGEMENT (LEADS) ROUTES ====================

def _parse_iso_date_only(value: Optional[str]):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value)[:10]).date()
    except Exception:
        return None

def _current_freeze_info_for_membership(membership: Optional[dict]):
    if not membership:
        return None
    today = get_ist_now().date()
    for freeze in (membership.get("freeze_history") or []):
        start = _parse_iso_date_only(freeze.get("freeze_start_date"))
        end = _parse_iso_date_only(freeze.get("freeze_end_date"))
        if start and end and start <= today <= end:
            return {
                **freeze,
                "remaining_freeze_days": (end - today).days + 1
            }
    return None

def _membership_is_currently_active_for_attendance(membership: Optional[dict]) -> bool:
    if not membership:
        return False
    if membership.get("status") != "active":
        return False
    end_date = _parse_iso_date_only(membership.get("end_date"))
    if not end_date:
        return False
    return end_date >= get_ist_now().date()

async def _build_member_membership_map():
    users = await db.users.find(
        {"role": "member"},
        {"_id": 0, "id": 1, "name": 1, "member_id": 1, "phone_number": 1, "country_code": 1, "email": 1, "is_disabled": 1}
    ).to_list(10000)
    user_map = {u["id"]: u for u in users}
    memberships = await db.memberships.find({"status": "active"}, {"_id": 0}).to_list(10000)
    membership_map = {m["user_id"]: m for m in memberships}
    return user_map, membership_map

async def _get_saved_task_map(lead_type: str):
    docs = await db.lead_tasks.find({"lead_type": lead_type}, {"_id": 0}).to_list(10000)
    return {d["user_id"]: d for d in docs}

def _merge_task_meta(row: dict, task_doc: Optional[dict]):
    task_doc = task_doc or {}
    row["task"] = {
        "id": task_doc.get("id"),
        "called_status": task_doc.get("called_status"),
        "remarks": task_doc.get("remarks"),
        "recall_date": task_doc.get("recall_date"),
        "renewal_when": task_doc.get("renewal_when"),
        "gym_visit_when": task_doc.get("gym_visit_when"),
        "is_done": bool(task_doc.get("is_done", False)),
        "updated_at": task_doc.get("updated_at"),
        "completed_at": task_doc.get("completed_at")
    }
    return row

@api_router.get("/tasks/leads/{lead_type}")
async def get_task_leads(lead_type: str, current_user: dict = Depends(get_admin_user)):
    """Lead task lists for admin calling workflow: renewal, absent, inactive"""
    allowed = {"renewals", "absent", "inactive"}
    if lead_type not in allowed:
        raise HTTPException(status_code=400, detail="Invalid lead type")

    today = get_ist_now().date()
    user_map, membership_map = await _build_member_membership_map()
    task_map = await _get_saved_task_map(lead_type)
    rows = []

    if lead_type == "renewals":
        for user_id, membership in membership_map.items():
            user = user_map.get(user_id)
            if not user or user.get("is_disabled"):
                continue
            freeze = _current_freeze_info_for_membership(membership)
            if freeze:
                continue
            end_date = _parse_iso_date_only(membership.get("end_date"))
            if not end_date:
                continue
            days_left = (end_date - today).days
            # Renewal leads = expired or expiring in next 6 days
            if days_left > 6:
                continue
            row = {
                "lead_type": lead_type,
                "user_id": user["id"],
                "name": user.get("name"),
                "member_id": user.get("member_id"),
                "phone_number": user.get("phone_number"),
                "country_code": user.get("country_code", "+91"),
                "email": user.get("email"),
                "plan_name": membership.get("plan_name"),
                "membership_id": membership.get("id"),
                "membership_end_date": membership.get("end_date"),
                "days_left": days_left,
                "lead_status": "expired" if days_left < 0 else ("expiring_today" if days_left == 0 else "expiring_soon")
            }
            rows.append(_merge_task_meta(row, task_map.get(user["id"])))
        rows.sort(key=lambda r: (r.get("days_left", 9999), (r.get("name") or "").lower()))

    elif lead_type == "inactive":
        active_user_ids = set(membership_map.keys())
        for user in user_map.values():
            if user.get("is_disabled"):
                continue
            if user["id"] in active_user_ids:
                continue
            row = {
                "lead_type": lead_type,
                "user_id": user["id"],
                "name": user.get("name"),
                "member_id": user.get("member_id"),
                "phone_number": user.get("phone_number"),
                "country_code": user.get("country_code", "+91"),
                "email": user.get("email"),
                "lead_status": "no_active_plan"
            }
            rows.append(_merge_task_meta(row, task_map.get(user["id"])))
        rows.sort(key=lambda r: ((r.get("name") or "").lower()))

    elif lead_type == "absent":
        cutoff_days = 3
        active_memberships = [m for m in membership_map.values()]
        for membership in active_memberships:
            user = user_map.get(membership.get("user_id"))
            if not user or user.get("is_disabled"):
                continue
            if _current_freeze_info_for_membership(membership):
                continue
            last_attendance = await db.attendance.find_one(
                {"user_id": user["id"]},
                {"_id": 0, "check_in_time": 1},
                sort=[("check_in_time", -1)]
            )
            days_absent = None
            last_attendance_iso = None
            if last_attendance and last_attendance.get("check_in_time"):
                last_attendance_iso = last_attendance["check_in_time"]
                last_date = _parse_iso_date_only(last_attendance_iso)
                if last_date:
                    days_absent = (today - last_date).days
            else:
                days_absent = 9999  # never attended

            if days_absent is None or days_absent < cutoff_days:
                continue

            row = {
                "lead_type": lead_type,
                "user_id": user["id"],
                "name": user.get("name"),
                "member_id": user.get("member_id"),
                "phone_number": user.get("phone_number"),
                "country_code": user.get("country_code", "+91"),
                "email": user.get("email"),
                "plan_name": membership.get("plan_name"),
                "membership_end_date": membership.get("end_date"),
                "days_absent": "Never attended" if days_absent == 9999 else days_absent,
                "last_attendance": last_attendance_iso,
                "lead_status": "absent"
            }
            rows.append(_merge_task_meta(row, task_map.get(user["id"])))
        rows.sort(key=lambda r: (-(999999 if r.get("days_absent") == "Never attended" else int(r.get("days_absent") or 0)), (r.get("name") or "").lower()))

    return {
        "lead_type": lead_type,
        "count": len(rows),
        "instruction": {
            "renewals": "Call members whose plans are expired or expiring soon. Ask when they will renew and when they will come to gym, then mark task done.",
            "absent": "Call absent members and ask why they are not coming. Add remarks and schedule recall if needed, then mark task done.",
            "inactive": "Call members without an active plan. Ask if they want to restart and set recall date if needed, then mark task done."
        }[lead_type],
        "items": rows
    }

@api_router.post("/tasks/leads/{lead_type}/{user_id}")
async def update_task_lead(
    lead_type: str,
    user_id: str,
    req: LeadTaskUpdateRequest,
    current_user: dict = Depends(get_admin_user)
):
    allowed = {"renewals", "absent", "inactive"}
    if lead_type not in allowed:
        raise HTTPException(status_code=400, detail="Invalid lead type")
    if req.called_status not in {"answered", "not_answered"}:
        raise HTTPException(status_code=400, detail="called_status must be answered or not_answered")
    if req.recall_date and not _parse_iso_date_only(req.recall_date):
        raise HTTPException(status_code=400, detail="Invalid recall_date")

    user = await db.users.find_one({"id": user_id, "role": "member"}, {"_id": 0, "id": 1, "name": 1, "member_id": 1})
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")

    now_iso = get_ist_now().isoformat()
    task_id = f"{lead_type}:{user_id}"
    update_doc = {
        "id": task_id,
        "lead_type": lead_type,
        "user_id": user_id,
        "called_status": req.called_status,
        "remarks": (req.remarks or "").strip() or None,
        "recall_date": req.recall_date,
        "renewal_when": (req.renewal_when or "").strip() or None,
        "gym_visit_when": (req.gym_visit_when or "").strip() or None,
        "is_done": bool(req.mark_done),
        "updated_at": now_iso,
        "updated_by_admin_id": current_user["id"],
        "updated_by_admin_name": current_user.get("name")
    }
    if req.mark_done:
        update_doc["completed_at"] = now_iso

    await db.lead_tasks.update_one(
        {"lead_type": lead_type, "user_id": user_id},
        {"$set": update_doc, "$setOnInsert": {"created_at": now_iso}},
        upsert=True
    )

    await log_activity(
        current_user["id"],
        "task_lead_updated",
        f"{lead_type} task updated for {user.get('name') or user.get('member_id')}: {req.called_status}"
    )
    return {"message": "Task updated", "task": update_doc}

# ==================== HOLIDAYS ROUTES ====================

@api_router.get("/holidays", response_model=List[HolidayResponse])
async def get_holidays():
    holidays = await db.holidays.find({}, {"_id": 0}).to_list(100)
    return holidays

@api_router.post("/holidays", response_model=HolidayResponse)
async def create_holiday(holiday: HolidayCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_admin_user)):
    holiday_id = str(uuid.uuid4())
    
    holiday_doc = {
        "id": holiday_id,
        **holiday.model_dump()
    }
    
    await db.holidays.insert_one(holiday_doc)
    
    # Send notification to all members
    await send_notification_to_all("holiday", {
        "holiday_date": holiday.date,
        "holiday_reason": holiday.reason
    }, background_tasks)
    
    return {k: v for k, v in holiday_doc.items() if k != "_id"}

@api_router.delete("/holidays/{holiday_id}")
async def delete_holiday(holiday_id: str, current_user: dict = Depends(get_admin_user)):
    result = await db.holidays.delete_one({"id": holiday_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    return {"message": "Holiday deleted"}

# ==================== ANNOUNCEMENTS ROUTES ====================

@api_router.get("/announcements", response_model=List[AnnouncementResponse])
async def get_announcements():
    announcements = await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return announcements

@api_router.post("/announcements", response_model=AnnouncementResponse)
async def create_announcement(announcement: AnnouncementCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_admin_user)):
    announcement_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    announcement_doc = {
        "id": announcement_id,
        **announcement.model_dump(),
        "created_at": now
    }
    
    await db.announcements.insert_one(announcement_doc)
    
    # Send notification to all members
    await send_notification_to_all("announcement", {
        "announcement_title": announcement.title,
        "announcement_content": announcement.content
    }, background_tasks)
    
    return {k: v for k, v in announcement_doc.items() if k != "_id"}

@api_router.delete("/announcements/{announcement_id}")
async def delete_announcement(announcement_id: str, current_user: dict = Depends(get_admin_user)):
    result = await db.announcements.delete_one({"id": announcement_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return {"message": "Announcement deleted"}

# ==================== SETTINGS ROUTES ====================

@api_router.get("/settings", response_model=SettingsResponse)
async def get_settings(current_user: dict = Depends(get_admin_user)):
    settings = await db.settings.find_one(
        {"id": "1"},
        {"_id": 0, "smtp_pass": 0, "twilio_auth_token": 0, "fast2sms_api_key": 0, "evolution_api_key": 0}
    )
    if not settings:
        return SettingsResponse()
    return settings

@api_router.put("/settings/smtp")
async def update_smtp_settings(settings: SMTPSettings, current_user: dict = Depends(get_admin_user)):
    update_data = settings.model_dump()
    if update_data.get("smtp_pass") == "":
        update_data.pop("smtp_pass", None)
    
    await db.settings.update_one(
        {"id": "1"},
        {"$set": update_data},
        upsert=True
    )
    await log_activity(
        current_user["id"],
        "settings_updated",
        "Updated SMTP settings",
        metadata={"settings_section": "smtp"}
    )
    
    return {"message": "SMTP settings updated"}

@api_router.post("/settings/smtp/test")
async def test_smtp(to_email: str, current_user: dict = Depends(get_admin_user)):
    # Use template system for test email
    email_template = await get_template("test_email", "email")
    subject = email_template.get("subject", "F3 Fitness Gym - Test Email")
    content = email_template.get("content", "<h2>SMTP Test Successful!</h2><p>Your SMTP is working correctly.</p>")
    email_body = wrap_email_in_template(content, subject)
    success = await send_email(to_email, subject, email_body)
    if success:
        return {"message": "Test email sent successfully"}
    raise HTTPException(status_code=500, detail="Failed to send test email. Check SMTP settings.")

@api_router.put("/settings/whatsapp")
async def update_whatsapp_settings(settings: WhatsAppSettings, current_user: dict = Depends(get_admin_user)):
    update_data = settings.model_dump()
    provider = (update_data.get("whatsapp_provider") or "twilio").lower()
    update_data["whatsapp_provider"] = provider if provider in {"twilio", "fast2sms", "evolution"} else "twilio"
    # Preserve stored secrets when form submits blank password/api key values.
    if update_data.get("twilio_auth_token") == "":
        update_data.pop("twilio_auth_token", None)
    if update_data.get("fast2sms_api_key") == "":
        update_data.pop("fast2sms_api_key", None)
    if update_data.get("evolution_api_key") == "":
        update_data.pop("evolution_api_key", None)
    if update_data.get("fast2sms_phone_number_id") == "":
        update_data["fast2sms_phone_number_id"] = ""
    
    await db.settings.update_one(
        {"id": "1"},
        {"$set": update_data},
        upsert=True
    )
    await log_activity(
        current_user["id"],
        "settings_updated",
        "Updated WhatsApp settings",
        metadata={"settings_section": "whatsapp", "provider": update_data.get("whatsapp_provider")}
    )
    
    return {"message": "WhatsApp settings updated"}

@api_router.put("/settings/notifications/attendance-confirmation-whatsapp")
async def update_attendance_confirmation_whatsapp_toggle(
    req: AttendanceConfirmationWhatsAppToggle,
    current_user: dict = Depends(get_admin_user)
):
    await db.settings.update_one(
        {"id": "1"},
        {"$set": {"attendance_confirmation_whatsapp_enabled": bool(req.enabled)}},
        upsert=True
    )
    await log_activity(
        current_user["id"],
        "settings_updated",
        f"Attendance confirmation WhatsApp {'enabled' if bool(req.enabled) else 'disabled'}",
        metadata={"settings_section": "notifications", "setting": "attendance_confirmation_whatsapp_enabled", "enabled": bool(req.enabled)}
    )
    return {
        "message": "Attendance confirmation WhatsApp setting updated",
        "attendance_confirmation_whatsapp_enabled": bool(req.enabled)
    }

@api_router.put("/settings/notifications/attendance-confirmation-email")
async def update_attendance_confirmation_email_toggle(
    req: AttendanceConfirmationEmailToggle,
    current_user: dict = Depends(get_admin_user)
):
    await db.settings.update_one(
        {"id": "1"},
        {"$set": {"attendance_confirmation_email_enabled": bool(req.enabled)}},
        upsert=True
    )
    await log_activity(
        current_user["id"],
        "settings_updated",
        f"Attendance confirmation email {'enabled' if bool(req.enabled) else 'disabled'}",
        metadata={"settings_section": "notifications", "setting": "attendance_confirmation_email_enabled", "enabled": bool(req.enabled)}
    )
    return {
        "message": "Attendance confirmation email setting updated",
        "attendance_confirmation_email_enabled": bool(req.enabled)
    }

@api_router.put("/settings/notifications/absent-warning-whatsapp")
async def update_absent_warning_whatsapp_toggle(
    req: AbsentWarningWhatsAppToggle,
    current_user: dict = Depends(get_admin_user)
):
    await db.settings.update_one(
        {"id": "1"},
        {"$set": {"absent_warning_whatsapp_enabled": bool(req.enabled)}},
        upsert=True
    )
    await log_activity(
        current_user["id"],
        "settings_updated",
        f"Absence warning WhatsApp {'enabled' if bool(req.enabled) else 'disabled'}",
        metadata={"settings_section": "notifications", "setting": "absent_warning_whatsapp_enabled", "enabled": bool(req.enabled)}
    )
    return {
        "message": "Absence warning WhatsApp setting updated",
        "absent_warning_whatsapp_enabled": bool(req.enabled)
    }

@api_router.post("/settings/whatsapp/test")
async def test_whatsapp(to_number: str, current_user: dict = Depends(get_admin_user)):
    settings = await db.settings.find_one({"id": "1"}, {"_id": 0}) or {}
    provider = (settings.get("whatsapp_provider") or "twilio").lower()

    if provider == "fast2sms":
        if not settings.get("fast2sms_api_key"):
            raise HTTPException(status_code=400, detail="Fast2SMS API key is missing.")
    elif provider == "evolution":
        if not settings.get("evolution_api_base_url"):
            raise HTTPException(status_code=400, detail="Evolution API base URL is missing.")
        if not settings.get("evolution_api_key"):
            raise HTTPException(status_code=400, detail="Evolution API key is missing.")
        if not settings.get("evolution_instance_name"):
            raise HTTPException(status_code=400, detail="Evolution instance name is missing.")
    else:
        if not settings.get("twilio_account_sid"):
            raise HTTPException(status_code=400, detail="Twilio Account SID is missing.")
        if not settings.get("twilio_auth_token"):
            raise HTTPException(status_code=400, detail="Twilio Auth Token is missing.")
        if not settings.get("twilio_whatsapp_number"):
            raise HTTPException(status_code=400, detail="Twilio WhatsApp number is missing.")
    
    try:
        use_fast2sms_template_test = provider == "fast2sms" and bool(settings.get("fast2sms_use_template_api"))
        test_template_type = "welcome" if use_fast2sms_template_test else None
        test_template_vars = {"name": "Test Member", "member_id": "F3-TEST-001"} if use_fast2sms_template_test else None
        test_message = "🏋️ Hello from F3 Fitness Gym! WhatsApp integration is working. 💪"
        success = await send_whatsapp(
            to_number,
            test_message,
            True,
            None,
            None,
            None,
            None,
            test_template_type,
            test_template_vars
        )
        if success:
            return {
                "message": "Test message sent successfully", 
                "success": True,
                "provider": provider,
                "mode": "template" if use_fast2sms_template_test else "session",
                "from_number": (
                    _normalize_phone_e164(settings.get("twilio_whatsapp_number", ""))
                    if provider == "twilio"
                    else settings.get("fast2sms_waba_number")
                    if provider == "fast2sms"
                    else settings.get("evolution_instance_name")
                ),
                "to_number": to_number
            }
        else:
            # Get the latest log entry for details
            latest_log = await db.whatsapp_logs.find_one(
                {"to_number": {"$regex": to_number.replace('+', '').replace(' ', '')}},
                sort=[("timestamp", -1)]
            )
            error_detail = latest_log.get("error", "Unknown error") if latest_log else "Check server logs for details"
            raise HTTPException(status_code=500, detail=f"Failed to send test message: {error_detail}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"WhatsApp test exception: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error sending message: {str(e)}")

@api_router.get("/settings/whatsapp/fast2sms/waba-templates")
async def get_fast2sms_waba_templates(current_user: dict = Depends(get_admin_user)):
    settings = await db.settings.find_one({"id": "1"}, {"_id": 0}) or {}
    api_key = settings.get("fast2sms_api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="Fast2SMS API key is missing.")

    base_url = (settings.get("fast2sms_base_url") or "https://www.fast2sms.com").rstrip("/")
    url = f"{base_url}/dev/dlt_manager/whatsapp"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                url,
                headers={"authorization": api_key},
                params={"authorization": api_key}
            )
        try:
            payload = response.json()
        except Exception:
            payload = {"raw": response.text}
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=str(payload))
        return {"success": True, "provider": "fast2sms", "data": payload}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fast2SMS template fetch failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch Fast2SMS WABA templates: {e}")

@api_router.get("/settings/whatsapp/evolution/status")
async def get_evolution_status(current_user: dict = Depends(get_admin_user)):
    settings = await db.settings.find_one({"id": "1"}, {"_id": 0}) or {}
    state = await _get_evolution_connection_state(settings)
    return {"success": True, **state}

@api_router.post("/settings/whatsapp/evolution/connect")
async def connect_evolution_instance(current_user: dict = Depends(get_admin_user)):
    settings = await db.settings.find_one({"id": "1"}, {"_id": 0}) or {}
    instance_name = _evolution_instance_name(settings)
    await _ensure_evolution_instance(settings)
    response = await _evolution_request(settings, "GET", f"/instance/connect/{instance_name}", timeout=45)
    try:
        payload = response.json()
    except Exception:
        payload = {"raw": response.text}
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=str(payload))

    qr_payload = str((payload or {}).get("code") or "").strip()
    pairing_code = str((payload or {}).get("pairingCode") or "").strip()
    count = int((payload or {}).get("count") or 0)
    connection_state = await _get_evolution_connection_state(settings)

    await log_activity(
        current_user["id"],
        "settings_updated",
        "Requested Evolution WhatsApp QR connection",
        metadata={"settings_section": "whatsapp", "provider": "evolution", "instance_name": instance_name}
    )

    return {
        "success": True,
        "provider": "evolution",
        "instance_name": instance_name,
        "pairing_code": pairing_code,
        "qr_code_data_url": _build_qr_data_url(qr_payload) if qr_payload else None,
        "count": count,
        "state": connection_state.get("state"),
        "connected": connection_state.get("connected", False),
        "raw": payload
    }

@api_router.post("/settings/whatsapp/evolution/restart")
async def restart_evolution_instance(current_user: dict = Depends(get_admin_user)):
    settings = await db.settings.find_one({"id": "1"}, {"_id": 0}) or {}
    instance_name = _evolution_instance_name(settings)
    response = await _evolution_request(settings, "PUT", f"/instance/restart/{instance_name}", timeout=45)
    try:
        payload = response.json()
    except Exception:
        payload = {"raw": response.text}
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=str(payload))
    await log_activity(
        current_user["id"],
        "settings_updated",
        "Restarted Evolution WhatsApp instance",
        metadata={"settings_section": "whatsapp", "provider": "evolution", "instance_name": instance_name}
    )
    return {"success": True, "provider": "evolution", "instance_name": instance_name, "raw": payload}

@api_router.delete("/settings/whatsapp/evolution/logout")
async def logout_evolution_instance(current_user: dict = Depends(get_admin_user)):
    settings = await db.settings.find_one({"id": "1"}, {"_id": 0}) or {}
    instance_name = _evolution_instance_name(settings)
    response = await _evolution_request(settings, "DELETE", f"/instance/logout/{instance_name}", timeout=45)
    try:
        payload = response.json()
    except Exception:
        payload = {"raw": response.text}
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=str(payload))
    await log_activity(
        current_user["id"],
        "settings_updated",
        "Logged out Evolution WhatsApp instance",
        metadata={"settings_section": "whatsapp", "provider": "evolution", "instance_name": instance_name}
    )
    return {"success": True, "provider": "evolution", "instance_name": instance_name, "raw": payload}

# ==================== TEMPLATE ROUTES ====================

@api_router.get("/templates", response_model=List[TemplateResponse])
async def get_templates(current_user: dict = Depends(get_admin_user)):
    templates = await db.templates.find({}, {"_id": 0}).to_list(100)
    
    # Add default templates if not exist - include ALL template types
    template_types = [
        "welcome", "otp", "password_reset", "attendance", "absent_warning", 
        "birthday", "holiday", "plan_shared", "renewal_reminder", 
        "membership_activated", "payment_received", "invoice_sent", "announcement",
        "freeze_started", "freeze_ended", "freeze_ending_tomorrow",
        "new_user_credentials", "test_email"
    ]
    channels = ["email", "whatsapp"]
    
    existing_keys = set(f"{t['template_type']}_{t['channel']}" for t in templates)
    
    for tt in template_types:
        for ch in channels:
            if f"{tt}_{ch}" not in existing_keys:
                default = await get_template(tt, ch)
                templates.append({
                    "id": f"{tt}_{ch}",
                    "template_type": tt,
                    "channel": ch,
                    "subject": default.get("subject"),
                    "content": default.get("content", "")
                })
    
    return templates

@api_router.put("/templates")
async def update_template(template: TemplateUpdate, current_user: dict = Depends(get_admin_user)):
    template_id = f"{template.template_type}_{template.channel}"
    
    template_doc = {
        "id": template_id,
        **template.model_dump()
    }
    
    await db.templates.update_one(
        {"id": template_id},
        {"$set": template_doc},
        upsert=True
    )
    await log_activity(
        current_user["id"],
        "template_updated",
        f"Updated {template.template_type} template ({template.channel})",
        metadata={"template_type": template.template_type, "channel": template.channel}
    )
    
    return {"message": "Template updated"}

@api_router.delete("/templates/{template_type}/{channel}")
async def reset_template(template_type: str, channel: str, current_user: dict = Depends(get_admin_user)):
    """Reset template to default by deleting customized version"""
    template_id = f"{template_type}_{channel}"
    
    # Delete the customized template so default will be used
    result = await db.templates.delete_one({"id": template_id})
    if result.deleted_count > 0:
        await log_activity(
            current_user["id"],
            "template_reset",
            f"Reset {template_type} template ({channel}) to default",
            metadata={"template_type": template_type, "channel": channel}
        )
    
    if result.deleted_count > 0:
        return {"message": "Template reset to default"}
    else:
        return {"message": "Template already at default"}

@api_router.post("/templates/test-send")
async def test_send_template(req: TemplateTestSendRequest, current_user: dict = Depends(get_admin_user)):
    channel = (req.channel or "").lower().strip()
    if channel not in {"email", "whatsapp"}:
        raise HTTPException(status_code=400, detail="Invalid channel")
    recipient = (req.recipient or "").strip()
    if not recipient:
        settings = await db.settings.find_one({"id": "1"}, {"_id": 0}) or {}
        if channel == "email":
            recipient = (settings.get("admin_test_email") or "").strip()
        else:
            numbers_raw = (settings.get("admin_whatsapp_test_numbers") or "").strip()
            recipient = next((n.strip() for n in numbers_raw.split(",") if n.strip()), "")
    if not recipient:
        raise HTTPException(status_code=400, detail="Recipient is required (or configure admin test contact in Settings)")

    saved_template = await get_template(req.template_type, channel)
    content = req.content if req.content is not None else saved_template.get("content", "")
    subject = req.subject if req.subject is not None else saved_template.get("subject", f"F3 Fitness - {req.template_type}")
    demo_invoice_url = f"{get_public_base_url()}/api/invoices/demo/pdf/public"

    sample_vars = {
        "name": "Rahul Sharma",
        "member_id": "F3-0042",
        "email": "rahul@example.com",
        "password": "Temp@1234",
        "otp": "123456",
        "reset_link": "https://example.com/reset-password",
        "plan_name": "Quarterly",
        "start_date": "01 Jan 2026",
        "end_date": "31 Mar 2026",
        "expiry_date": "31 Mar 2026",
        "days_left": "6",
        "days": "7",
        "amount": "2500",
        "payment_mode": "UPI",
        "payment_date": "24 Feb 2026",
        "receipt_no": "RCP-2026-001",
        "invoice_pdf_url": demo_invoice_url,
        "holiday_date": "26 Jan 2026",
        "holiday_reason": "Republic Day",
        "announcement_title": "New Equipment Arrived",
        "announcement_content": "Check out new treadmills and machines.",
        "plan_type": "Workout",
        "plan_title": "Fat Loss Plan",
        "freeze_start_date": "23 Feb 2026",
        "freeze_end_date": "24 Feb 2026",
        "freeze_days": "2",
        "freeze_fee": "300",
        "new_expiry_date": "17 Mar 2026",
        "end_mode": "early"
    }

    if channel == "email":
        rendered_subject = replace_template_vars(subject or "F3 Fitness Notification", sample_vars)
        rendered_content = replace_template_vars(content or "", sample_vars)
        body = wrap_email_in_template(rendered_content, rendered_subject)
        attachments = None
        if req.template_type == "invoice_sent":
            pdf_bytes, filename = _build_demo_invoice_pdf_bytes()
            attachments = [{"filename": filename, "content_bytes": pdf_bytes, "content_type": "application/pdf"}]
        success = await send_email(recipient, rendered_subject, body, attachments)
    else:
        rendered_message = replace_template_vars(content or "", sample_vars)
        media_url = None
        media_base64 = None
        media_filename = None
        media_mimetype = None
        if req.template_type == "invoice_sent":
            rendered_message = sanitize_invoice_whatsapp_message(rendered_message)
            settings = await db.settings.find_one({"id": "1"}, {"_id": 0, "whatsapp_provider": 1}) or {}
            provider = (settings.get("whatsapp_provider") or "twilio").lower()
            if provider == "evolution":
                pdf_bytes, filename = _build_demo_invoice_pdf_bytes()
                media_base64 = base64.b64encode(pdf_bytes).decode()
                media_filename = filename
                media_mimetype = "application/pdf"
            else:
                media_url = demo_invoice_url
        success = await send_whatsapp(
            recipient,
            rendered_message,
            True,
            media_url,
            media_base64,
            media_filename,
            media_mimetype,
            req.template_type,
            sample_vars
        )

    if not success:
        latest_log = await db.whatsapp_logs.find_one(sort=[("timestamp", -1)]) if channel == "whatsapp" else None
        detail = latest_log.get("error") if latest_log else None
        raise HTTPException(status_code=500, detail=detail or f"Failed to send test {channel}")

    return {"message": f"Test {channel} sent successfully", "recipient": recipient}

# ==================== ACTIVITY LOGS ROUTES ====================

@api_router.get("/activity-logs")
async def get_activity_logs(
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_admin_user)
):
    query = {}
    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = action
    
    logs = await db.activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    
    # Enrich with user names
    for log in logs:
        user = await db.users.find_one({"id": log["user_id"]}, {"_id": 0, "name": 1, "email": 1})
        if user:
            log["user_name"] = user.get("name")
            log["user_email"] = user.get("email")
    
    return logs

# ==================== USER HISTORY ROUTES ====================

@api_router.get("/users/{user_id}/history")
async def get_user_history(user_id: str, current_user: dict = Depends(get_admin_user)):
    """Get complete history of a user - memberships, payments, attendance"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get all memberships (past and present)
    memberships = await db.memberships.find(
        {"user_id": user_id}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich memberships with plan names
    for m in memberships:
        plan = await db.plans.find_one({"id": m.get("plan_id")}, {"_id": 0, "name": 1, "duration_days": 1})
        if plan:
            m["plan_name"] = plan.get("name")
            m["duration_days"] = plan.get("duration_days")
    
    # Get all payments
    payments = await db.payments.find(
        {"user_id": user_id}, 
        {"_id": 0}
    ).sort("payment_date", -1).to_list(100)
    
    # Get attendance count
    attendance_count = await db.attendance.count_documents({"user_id": user_id})
    
    # Get last attendance
    last_attendance = await db.attendance.find_one(
        {"user_id": user_id}, 
        {"_id": 0},
        sort=[("check_in_time", -1)]
    )
    
    # Calculate total payments
    total_paid = sum(p.get("amount_paid", 0) for p in payments)
    
    return {
        "user": {
            "id": user.get("id"),
            "name": user.get("name"),
            "member_id": user.get("member_id"),
            "email": user.get("email"),
            "phone_number": user.get("phone_number"),
            "joining_date": user.get("joining_date") or user.get("created_at", "")[:10],
            "profile_photo_url": user.get("profile_photo_url")
        },
        "memberships": memberships,
        "payments": payments,
        "stats": {
            "total_memberships": len(memberships),
            "total_payments": len(payments),
            "total_amount_paid": total_paid,
            "attendance_count": attendance_count,
            "last_attendance": last_attendance.get("check_in_time") if last_attendance else None
        }
    }

# ==================== PAYMENT GATEWAY SETTINGS ====================

@api_router.get("/settings/payment-gateway")
async def get_payment_gateway_settings(current_user: dict = Depends(get_admin_user)):
    settings = await db.settings.find_one({"id": "1"}, {"_id": 0})
    if not settings:
        return {"razorpay_key_id": "", "razorpay_key_secret_masked": ""}
    
    key_secret = settings.get("razorpay_key_secret", "")
    masked = "*" * (len(key_secret) - 4) + key_secret[-4:] if len(key_secret) > 4 else "*" * len(key_secret)
    
    return {
        "razorpay_key_id": settings.get("razorpay_key_id", ""),
        "razorpay_key_secret_masked": masked
    }

@api_router.put("/settings/payment-gateway")
async def update_payment_gateway_settings(
    razorpay_key_id: str = Body(...),
    razorpay_key_secret: str = Body(...),
    current_user: dict = Depends(get_admin_user)
):
    await db.settings.update_one(
        {"id": "1"},
        {"$set": {
            "razorpay_key_id": razorpay_key_id,
            "razorpay_key_secret": razorpay_key_secret
        }},
        upsert=True
    )
    
    # Reinitialize Razorpay client
    global razorpay_client
    razorpay_client = None
    get_razorpay_client()
    await log_activity(
        current_user["id"],
        "settings_updated",
        "Updated payment gateway settings",
        metadata={"settings_section": "payment_gateway", "provider": "razorpay", "key_id": razorpay_key_id[:6] + "..." if razorpay_key_id else ""}
    )
    
    return {"message": "Payment gateway settings updated"}

# ==================== HEALTH TRACKING ROUTES ====================

@api_router.get("/health-logs", response_model=List[HealthLogResponse])
async def get_health_logs(user_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if user_id:
        if current_user["id"] != user_id and current_user["role"] not in ["admin", "trainer"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        query["user_id"] = user_id
    else:
        query["user_id"] = current_user["id"]
    
    logs = await db.health_logs.find(query, {"_id": 0}).sort("logged_at", -1).to_list(100)
    return logs

@api_router.post("/health-logs", response_model=HealthLogResponse)
async def create_health_log(log: HealthLogCreate, current_user: dict = Depends(get_current_user)):
    log_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    # Get user's stored height if not provided
    height = log.height
    if not height:
        user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
        height = user.get("height")
    
    # If height is provided, save it to user profile
    if log.height:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"height": log.height}}
        )
    
    # Calculate BMI if height and weight provided
    bmi = None
    if log.weight and height:
        height_m = height / 100
        bmi = round(log.weight / (height_m * height_m), 1)
    
    log_doc = {
        "id": log_id,
        "user_id": current_user["id"],
        "weight": log.weight,
        "body_fat": log.body_fat,
        "height": height,
        "bmi": bmi,
        "notes": log.notes,
        "logged_at": now
    }
    
    await db.health_logs.insert_one(log_doc)
    return {k: v for k, v in log_doc.items() if k != "_id"}

# ==================== CALORIE TRACKING ROUTES ====================

@api_router.get("/calorie-logs")
async def get_calorie_logs(date: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"user_id": current_user["id"]}
    if date:
        query["date"] = date
    
    logs = await db.calorie_logs.find(query, {"_id": 0}).sort("logged_at", -1).to_list(100)
    return logs

@api_router.post("/calorie-logs", response_model=CalorieLogResponse)
async def create_calorie_log(log: CalorieLogCreate, current_user: dict = Depends(get_current_user)):
    log_id = str(uuid.uuid4())
    now = get_ist_now()
    
    log_doc = {
        "id": log_id,
        "user_id": current_user["id"],
        "calories": log.calories,
        "protein": log.protein,
        "carbs": log.carbs,
        "fats": log.fats,
        "meal_type": log.meal_type,
        "food_items": log.food_items,
        "notes": log.notes,
        "logged_at": now.isoformat(),
        "date": now.strftime("%Y-%m-%d")
    }
    
    await db.calorie_logs.insert_one(log_doc)
    return {k: v for k, v in log_doc.items() if k != "_id"}

@api_router.delete("/calorie-logs/{log_id}")
async def delete_calorie_log(log_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.calorie_logs.delete_one({"id": log_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Log not found")
    return {"message": "Log deleted"}

@api_router.get("/calorie-summary")
async def get_calorie_summary(date: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    target_date = date or get_ist_now().strftime("%Y-%m-%d")
    
    # Get user's calorie goal
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    target_calories = user.get("target_calories", 2000)
    goal_type = user.get("calorie_goal_type", "maintenance")
    
    # Get today's logs
    logs = await db.calorie_logs.find({
        "user_id": current_user["id"],
        "date": target_date
    }, {"_id": 0}).to_list(100)
    
    total_calories = sum(log.get("calories", 0) for log in logs)
    total_protein = sum(log.get("protein", 0) or 0 for log in logs)
    total_carbs = sum(log.get("carbs", 0) or 0 for log in logs)
    total_fats = sum(log.get("fats", 0) or 0 for log in logs)
    
    return {
        "date": target_date,
        "total_calories": total_calories,
        "total_protein": total_protein,
        "total_carbs": total_carbs,
        "total_fats": total_fats,
        "target_calories": target_calories,
        "difference": total_calories - target_calories,
        "goal_type": goal_type
    }

@api_router.put("/calorie-goal")
async def update_calorie_goal(goal: CalorieGoalUpdate, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "target_calories": goal.target_calories,
            "calorie_goal_type": goal.goal_type
        }}
    )
    return {"message": "Calorie goal updated", "target_calories": goal.target_calories, "goal_type": goal.goal_type}

# ==================== DIET PLAN ROUTES ====================

@api_router.get("/diet-plans", response_model=List[DietPlanResponse])
async def get_diet_plans(user_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if user_id:
        if current_user["id"] != user_id and current_user["role"] not in ["admin", "trainer"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        query["user_id"] = user_id
    elif current_user["role"] == "member":
        query["user_id"] = current_user["id"]
    
    plans = await db.diet_plans.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return plans

@api_router.post("/diet-plans", response_model=DietPlanResponse)
async def create_diet_plan(plan: DietPlanCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_trainer_or_admin)):
    plan_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    plan_doc = {
        "id": plan_id,
        "user_id": plan.user_id,
        "created_by": current_user["id"],
        "title": plan.title,
        "description": plan.description,
        "meals": [m.model_dump() for m in plan.meals] if plan.meals else None,
        "pdf_url": plan.pdf_url,
        "notes": plan.notes,
        "created_at": now,
        "is_active": True
    }
    
    await db.diet_plans.insert_one(plan_doc)
    
    # Notify user
    user = await db.users.find_one({"id": plan.user_id}, {"_id": 0})
    if user:
        await send_notification(user, "plan_shared", {"plan_type": "Diet", "plan_title": plan.title}, background_tasks)
    
    return {k: v for k, v in plan_doc.items() if k != "_id"}

@api_router.delete("/diet-plans/{plan_id}")
async def delete_diet_plan(plan_id: str, current_user: dict = Depends(get_trainer_or_admin)):
    result = await db.diet_plans.delete_one({"id": plan_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"message": "Diet plan deleted"}

# ==================== WORKOUT PLAN ROUTES ====================

@api_router.get("/workout-plans", response_model=List[WorkoutPlanResponse])
async def get_workout_plans(user_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if user_id:
        if current_user["id"] != user_id and current_user["role"] not in ["admin", "trainer"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        query["user_id"] = user_id
    elif current_user["role"] == "member":
        query["user_id"] = current_user["id"]
    
    plans = await db.workout_plans.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return plans

@api_router.post("/workout-plans", response_model=WorkoutPlanResponse)
async def create_workout_plan(plan: WorkoutPlanCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_trainer_or_admin)):
    plan_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    plan_doc = {
        "id": plan_id,
        "user_id": plan.user_id,
        "created_by": current_user["id"],
        "title": plan.title,
        "description": plan.description,
        "days": [d.model_dump() for d in plan.days] if plan.days else None,
        "pdf_url": plan.pdf_url,
        "notes": plan.notes,
        "created_at": now,
        "is_active": True
    }
    
    await db.workout_plans.insert_one(plan_doc)
    
    # Notify user
    user = await db.users.find_one({"id": plan.user_id}, {"_id": 0})
    if user:
        await send_notification(user, "plan_shared", {"plan_type": "Workout", "plan_title": plan.title}, background_tasks)
    
    return {k: v for k, v in plan_doc.items() if k != "_id"}

@api_router.delete("/workout-plans/{plan_id}")
async def delete_workout_plan(plan_id: str, current_user: dict = Depends(get_trainer_or_admin)):
    result = await db.workout_plans.delete_one({"id": plan_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"message": "Workout plan deleted"}

# ==================== TESTIMONIALS ROUTES ====================

@api_router.get("/testimonials", response_model=List[TestimonialResponse])
async def get_testimonials(active_only: bool = True):
    query = {"is_active": True} if active_only else {}
    testimonials = await db.testimonials.find(query, {"_id": 0}).to_list(100)
    return testimonials

@api_router.post("/testimonials", response_model=TestimonialResponse)
async def create_testimonial(testimonial: TestimonialCreate, current_user: dict = Depends(get_admin_user)):
    testimonial_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    testimonial_doc = {
        "id": testimonial_id,
        **testimonial.model_dump(),
        "is_active": True,
        "created_at": now
    }
    
    await db.testimonials.insert_one(testimonial_doc)
    return {k: v for k, v in testimonial_doc.items() if k != "_id"}

@api_router.delete("/testimonials/{testimonial_id}")
async def delete_testimonial(testimonial_id: str, current_user: dict = Depends(get_admin_user)):
    result = await db.testimonials.delete_one({"id": testimonial_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    return {"message": "Testimonial deleted"}

# ==================== DASHBOARD ROUTES ====================

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_admin_user)):
    total_members = await db.users.count_documents({"role": "member"})
    active_memberships = await db.memberships.count_documents({"status": "active"})
    
    # Today's collection
    today = get_ist_now().strftime("%Y-%m-%d")
    today_payments = await db.payments.find(
        {"payment_date": {"$regex": f"^{today}"}},
        {"_id": 0, "amount_paid": 1}
    ).to_list(10000)
    today_collection = sum(p["amount_paid"] for p in today_payments)
    
    # Present today
    today_attendance = await db.attendance.find(
        {"check_in_time": {"$regex": f"^{today}"}},
        {"_id": 0, "user_id": 1}
    ).to_list(10000)
    present_user_ids = set(a["user_id"] for a in today_attendance)
    present_today = len(present_user_ids)
    
    # Absent today
    active_membership_users = await db.memberships.find(
        {"status": "active"},
        {"_id": 0, "user_id": 1}
    ).to_list(10000)
    active_user_ids = set(m["user_id"] for m in active_membership_users)
    absent_today = len(active_user_ids - present_user_ids)
    
    # Today's birthdays
    today_mmdd = get_ist_now().strftime("-%m-%d")
    all_members = await db.users.find({"role": "member", "date_of_birth": {"$exists": True, "$ne": None}}, {"_id": 0, "id": 1, "name": 1, "member_id": 1, "date_of_birth": 1, "phone_number": 1}).to_list(10000)
    
    today_birthdays = []
    upcoming_birthdays = []
    
    for m in all_members:
        if m.get("date_of_birth"):
            dob = m["date_of_birth"]
            if dob.endswith(today_mmdd):
                today_birthdays.append({"name": m["name"], "member_id": m["member_id"], "phone_number": m.get("phone_number")})
            else:
                # Check upcoming 7 days
                try:
                    dob_date = datetime.strptime(dob, "%Y-%m-%d")
                    this_year_bday = dob_date.replace(year=get_ist_now().year)
                    days_until = (this_year_bday - datetime(get_ist_now().year, get_ist_now().month, get_ist_now().day)).days
                    if 0 < days_until <= 7:
                        upcoming_birthdays.append({
                            "name": m["name"],
                            "member_id": m["member_id"],
                            "date": dob,
                            "days_until": days_until
                        })
                except:
                    pass
    
    upcoming_birthdays.sort(key=lambda x: x["days_until"])
    
    # Upcoming renewals (next 7 days)
    upcoming_renewals = []
    cutoff_date = (get_ist_now() + timedelta(days=7)).isoformat()
    expiring_memberships = await db.memberships.find({
        "status": "active",
        "end_date": {"$lte": cutoff_date}
    }, {"_id": 0}).to_list(100)
    
    for m in expiring_memberships:
        user = await db.users.find_one({"id": m["user_id"]}, {"_id": 0, "name": 1, "member_id": 1, "phone_number": 1})
        if user:
            end_date = datetime.fromisoformat(m["end_date"][:10])
            days_left = (end_date - datetime(get_ist_now().year, get_ist_now().month, get_ist_now().day)).days
            upcoming_renewals.append({
                "name": user["name"],
                "member_id": user["member_id"],
                "phone_number": user.get("phone_number"),
                "end_date": m["end_date"][:10],
                "days_left": days_left
            })
    
    upcoming_renewals.sort(key=lambda x: x["days_left"])
    
    # Regular absentees (7+ days)
    regular_absentees = await get_regular_absentees(7, current_user)
    
    return DashboardStats(
        total_members=total_members,
        active_memberships=active_memberships,
        today_collection=today_collection,
        present_today=present_today,
        absent_today=absent_today,
        today_birthdays=today_birthdays[:5],
        upcoming_birthdays=upcoming_birthdays[:5],
        upcoming_renewals=upcoming_renewals[:10],
        regular_absentees=regular_absentees[:10]
    )

# ==================== TRAINER ROUTES ====================

@api_router.get("/trainer/clients", response_model=List[UserResponse])
async def get_trainer_clients(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["trainer", "admin"]:
        raise HTTPException(status_code=403, detail="Trainer or admin access required")
    
    trainer_id = current_user["id"] if current_user["role"] == "trainer" else None
    
    query = {"trainer_id": trainer_id} if trainer_id else {"trainer_id": {"$ne": None}}
    clients = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return clients

@api_router.get("/trainers", response_model=List[UserResponse])
async def get_trainers(current_user: dict = Depends(get_current_user)):
    trainers = await db.users.find({"role": "trainer"}, {"_id": 0, "password_hash": 0}).to_list(100)
    return trainers

@api_router.get("/trainers/public")
async def get_public_trainers():
    """Get trainers for public landing page - no auth required"""
    trainers = await db.users.find(
        {"role": "trainer", "is_visible_on_website": {"$ne": False}},
        {"_id": 0, "password_hash": 0, "email": 0, "phone": 0, "phone_number": 0}
    ).to_list(100)
    
    # Return only necessary fields for landing page
    result = []
    for t in trainers:
        result.append({
            "id": t.get("id"),
            "name": t.get("name", "Trainer"),
            "role": t.get("speciality", "Fitness Coach"),
            "speciality": t.get("bio", "Expert Trainer"),
            "image": t.get("profile_photo_url"),
            "instagram_url": t.get("instagram_url")
        })
    return result

# ==================== CALCULATORS (PUBLIC) ====================

@api_router.post("/calculators/bmi")
async def calculate_bmi(weight: float, height: float):
    """Calculate BMI - weight in kg, height in cm"""
    height_m = height / 100
    bmi = round(weight / (height_m * height_m), 1)
    
    if bmi < 18.5:
        category = "Underweight"
    elif bmi < 25:
        category = "Normal weight"
    elif bmi < 30:
        category = "Overweight"
    else:
        category = "Obese"
    
    return {"bmi": bmi, "category": category}

@api_router.post("/calculators/maintenance-calories")
async def calculate_maintenance_calories(
    weight: float,
    height: float,
    age: int,
    gender: str,
    activity_level: str = "moderate"
):
    """Calculate maintenance calories using Mifflin-St Jeor equation"""
    # BMR calculation
    if gender.lower() == "male":
        bmr = 10 * weight + 6.25 * height - 5 * age + 5
    else:
        bmr = 10 * weight + 6.25 * height - 5 * age - 161
    
    # Activity multipliers
    multipliers = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9
    }
    
    multiplier = multipliers.get(activity_level, 1.55)
    maintenance = round(bmr * multiplier)
    
    return {
        "bmr": round(bmr),
        "maintenance_calories": maintenance,
        "weight_loss": maintenance - 500,
        "weight_gain": maintenance + 500
    }

# ==================== RAZORPAY ROUTES ====================

@api_router.post("/razorpay/create-order", response_model=RazorpayOrderResponse)
async def create_razorpay_order(order: RazorpayOrderCreate, current_user: dict = Depends(get_current_user)):
    client = get_razorpay_client()
    if not client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    plan = await db.plans.find_one({"id": order.plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    amount = int(plan["price"] * 100)
    
    try:
        razorpay_order = client.order.create({
            "amount": amount,
            "currency": "INR",
            "payment_capture": 1
        })
        
        return RazorpayOrderResponse(
            order_id=razorpay_order["id"],
            amount=amount,
            currency="INR",
            key_id=os.environ.get('RAZORPAY_KEY_ID', '')
        )
    except Exception as e:
        logger.error(f"Razorpay order creation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create order")

@api_router.post("/razorpay/verify-payment")
async def verify_razorpay_payment(payment: RazorpayPaymentVerify, current_user: dict = Depends(get_current_user)):
    client = get_razorpay_client()
    if not client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    try:
        client.utility.verify_payment_signature({
            'razorpay_order_id': payment.razorpay_order_id,
            'razorpay_payment_id': payment.razorpay_payment_id,
            'razorpay_signature': payment.razorpay_signature
        })
    except Exception as e:
        logger.error(f"Payment verification failed: {e}")
        raise HTTPException(status_code=400, detail="Payment verification failed")
    
    plan = await db.plans.find_one({"id": payment.plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    existing = await db.memberships.find_one(
        {"user_id": current_user["id"], "status": "active"},
        sort=[("end_date", -1)]
    )
    
    if existing:
        start_date = datetime.fromisoformat(existing["end_date"])
    else:
        start_date = get_ist_now()
    
    end_date = start_date + timedelta(days=plan["duration_days"])
    
    membership_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    membership_doc = {
        "id": membership_id,
        "user_id": current_user["id"],
        "plan_id": payment.plan_id,
        "start_date": start_date.isoformat() if isinstance(start_date, datetime) else start_date,
        "end_date": end_date.isoformat(),
        "status": "active",
        "original_price": plan["price"],
        "discount_amount": 0,
        "final_price": plan["price"],
        "created_at": now
    }
    
    await db.memberships.insert_one(membership_doc)
    
    payment_doc = {
        "id": str(uuid.uuid4()),
        "membership_id": membership_id,
        "user_id": current_user["id"],
        "amount_paid": plan["price"],
        "payment_date": now,
        "payment_method": "online",
        "notes": f"Razorpay Payment ID: {payment.razorpay_payment_id}",
        "recorded_by_admin_id": None
    }
    
    await db.payments.insert_one(payment_doc)
    
    return {"message": "Payment verified and membership activated", "membership_id": membership_id}

# ==================== FILE UPLOAD ROUTES ====================

@api_router.post("/upload/profile-photo")
async def upload_profile_photo(
    file: UploadFile = File(...), 
    user_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Check file size (max 2MB)
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be less than 2MB")
    
    # Determine which user to update
    target_user_id = current_user["id"]
    if user_id and current_user["role"] == "admin":
        target_user_id = user_id
    
    base64_content = base64.b64encode(content).decode()
    data_url = f"data:{file.content_type};base64,{base64_content}"
    
    await db.users.update_one({"id": target_user_id}, {"$set": {"profile_photo_url": data_url}})
    
    return {"profile_photo_url": data_url, "url": data_url}

@api_router.delete("/upload/profile-photo/{user_id}")
async def delete_profile_photo(user_id: str, current_user: dict = Depends(get_current_user)):
    # Only admin or the user themselves can delete
    if current_user["role"] != "admin" and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.users.update_one({"id": user_id}, {"$set": {"profile_photo_url": None}})
    return {"message": "Profile photo deleted"}

@api_router.post("/upload/plan-pdf")
async def upload_plan_pdf(file: UploadFile = File(...), current_user: dict = Depends(get_trainer_or_admin)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    content = await file.read()
    base64_content = base64.b64encode(content).decode()
    data_url = f"data:{file.content_type};base64,{base64_content}"
    
    return {"pdf_url": data_url}


# ==================== BROADCAST ROUTES ====================

class BroadcastRequest(BaseModel):
    message: str
    target_audience: str = "all"  # all, active, inactive
    selected_user_ids: Optional[List[str]] = None

@api_router.post("/broadcast/whatsapp")
async def broadcast_whatsapp(
    request: BroadcastRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_admin_user)
):
    """Send WhatsApp broadcast to all members"""
    query = {"role": "member"}
    if request.selected_user_ids:
        query["id"] = {"$in": [uid for uid in request.selected_user_ids if uid]}
    elif request.target_audience == "active":
        # Get users with active membership
        active_memberships = await db.memberships.find({"status": "active"}, {"_id": 0, "user_id": 1}).to_list(10000)
        active_user_ids = [m["user_id"] for m in active_memberships]
        query["id"] = {"$in": active_user_ids}
    elif request.target_audience == "inactive":
        active_memberships = await db.memberships.find({"status": "active"}, {"_id": 0, "user_id": 1}).to_list(10000)
        active_user_ids = [m["user_id"] for m in active_memberships]
        query["id"] = {"$nin": active_user_ids}
    
    users = await db.users.find(query, {"_id": 0, "name": 1, "phone_number": 1, "country_code": 1, "member_id": 1}).to_list(10000)
    
    sent_count = 0
    failed_count = 0
    
    for user in users:
        if user.get("phone_number"):
            # Personalize message
            personalized_message = request.message.replace("{{name}}", user.get("name", "Member"))
            personalized_message = personalized_message.replace("{{member_id}}", user.get("member_id", ""))
            
            phone = f"{user.get('country_code', '+91')}{user['phone_number'].lstrip('0')}"
            background_tasks.add_task(send_whatsapp, phone, personalized_message)
            sent_count += 1
        else:
            failed_count += 1
    
    # Log activity
    await log_activity(current_user["id"], "broadcast_whatsapp", f"Sent WhatsApp broadcast to {sent_count} members")
    
    return {
        "message": f"WhatsApp broadcast queued for {sent_count} members",
        "sent_count": sent_count,
        "failed_count": failed_count
    }

@api_router.post("/broadcast/email")
async def broadcast_email(
    request: BroadcastRequest,
    subject: str,
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_admin_user)
):
    """Send Email broadcast to all members"""
    query = {"role": "member"}
    if request.target_audience == "active":
        active_memberships = await db.memberships.find({"status": "active"}, {"_id": 0, "user_id": 1}).to_list(10000)
        active_user_ids = [m["user_id"] for m in active_memberships]
        query["id"] = {"$in": active_user_ids}
    elif request.target_audience == "inactive":
        active_memberships = await db.memberships.find({"status": "active"}, {"_id": 0, "user_id": 1}).to_list(10000)
        active_user_ids = [m["user_id"] for m in active_memberships]
        query["id"] = {"$nin": active_user_ids}
    
    users = await db.users.find(query, {"_id": 0, "name": 1, "email": 1, "member_id": 1}).to_list(10000)
    
    sent_count = 0
    failed_count = 0
    
    # Professional email template with detailed F3 Fitness footer
    email_template = """<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { margin:0; padding:0; font-family: Arial, sans-serif; background: linear-gradient(135deg,#f4f6f8,#eef1f5); }
.wrapper { padding:40px 15px; }
.container { max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.05); border:1px solid #e5e7eb; }
.header { background:linear-gradient(135deg,#0ea5b7,#0b7285); padding:40px 30px; text-align:center; }
.logo { width:160px; margin-bottom:10px; }
.tagline { color:#e0f2fe; font-size:13px; letter-spacing:2px; font-weight:600; }
.content { padding:40px 35px 35px 35px; color:#374151; font-size:16px; line-height:1.7; }
.content h2 { margin-top:0; font-size:24px; color:#111827; }
.highlight-box { margin-top:25px; padding:18px; background:#f0f9ff; border-left:4px solid #0ea5b7; border-radius:6px; font-size:14px; color:#0f766e; }
.footer { background:#f3f4f6; padding:25px 25px; font-size:14px; color:#6b7280; border-top:1px solid #e5e7eb; text-align:center; line-height:1.7; }
.footer-title { font-size:18px; font-weight:700; color:#111827; margin-bottom:10px; }
.footer-address { max-width:480px; margin:0 auto 15px auto; }
.footer-contact { margin-bottom:10px; }
.footer-hours { margin-bottom:20px; }
.footer-social { color:#0ea5b7; font-weight:700; text-decoration:none; }
.footer a { color:#0ea5b7; text-decoration:none; font-weight:500; }
.small { margin-top:20px; padding-top:15px; border-top:1px solid #e5e7eb; font-size:11px; color:#9ca3af; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="container">
    <div class="header">
      <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" alt="F3 Fitness Logo" class="logo">
      <div class="tagline">TRAIN • TRANSFORM • TRIUMPH</div>
    </div>
    <div class="content">
      <h2>Hello, {{name}}!</h2>
      <div style="white-space: pre-wrap;">{{content}}</div>
    </div>
    <div class="footer">
      <div class="footer-title">F3 Fitness Health Club</div>
      <div class="footer-address">
        4th Avenue Plot No 4R-B, Mode, near Mandir Marg,<br>
        Sector 4, Vidyadhar Nagar, Jaipur, Rajasthan 302039
      </div>
      <div class="footer-contact">
        📞 072300 52193 &nbsp;|&nbsp; 📧 info@f3fitness.in
      </div>
      <div class="footer-hours">
        🕒 Mon–Sat: 5:00 AM – 10:00 PM &nbsp;|&nbsp; Sun: 6:00 AM – 12:00 PM
      </div>
      <div>
        Follow us on Instagram: <a href="https://instagram.com/f3fitnessclub" class="footer-social">@f3fitnessclub</a>
      </div>
      <div class="small">
        © 2026 F3 Fitness Health Club. All rights reserved.
      </div>
    </div>
  </div>
</div>
</body>
</html>"""
    
    for user in users:
        if user.get("email"):
            # Personalize content
            personalized_content = request.message.replace("{{name}}", user.get("name", "Member"))
            personalized_content = personalized_content.replace("{{member_id}}", user.get("member_id", ""))
            
            # Create full email body
            email_body = email_template.replace("{{name}}", user.get("name", "Member"))
            email_body = email_body.replace("{{content}}", personalized_content.replace("\n", "<br>"))
            
            background_tasks.add_task(send_email, user["email"], subject, email_body)
            sent_count += 1
        else:
            failed_count += 1
    
    # Log activity
    await log_activity(current_user["id"], "broadcast_email", f"Sent Email broadcast to {sent_count} members")
    
    return {
        "message": f"Email broadcast queued for {sent_count} members",
        "sent_count": sent_count,
        "failed_count": failed_count
    }


# ==================== SEED DATA ROUTE ====================

@api_router.post("/seed")
async def seed_data():
    """Seed initial data for testing"""
    
    admin = await db.users.find_one({"email": "admin@f3fitness.com"})
    if admin:
        return {"message": "Data already seeded"}
    
    now = get_ist_now().isoformat()
    
    # Create admin user
    admin_doc = {
        "id": str(uuid.uuid4()),
        "member_id": "F3-0001",
        "name": "Admin User",
        "email": "admin@f3fitness.com",
        "phone_number": "9999999999",
        "country_code": "+91",
        "password_hash": hash_password("admin123"),
        "role": "admin",
        "gender": "male",
        "date_of_birth": "1990-01-01",
        "address": "4th avenue Plot No 4R-B, Sector 4",
        "city": "Jaipur",
        "zip_code": "302039",
        "emergency_phone": "9999999998",
        "profile_photo_url": None,
        "trainer_id": None,
        "pt_trainer_id": None,
        "pt_sessions_remaining": 0,
        "joining_date": now,
        "created_at": now
    }
    await db.users.insert_one(admin_doc)
    
    # Create sample trainer
    trainer_doc = {
        "id": str(uuid.uuid4()),
        "member_id": "F3-0002",
        "name": "Rahul Sharma",
        "email": "trainer@f3fitness.com",
        "phone_number": "9888888888",
        "country_code": "+91",
        "password_hash": hash_password("trainer123"),
        "role": "trainer",
        "gender": "male",
        "date_of_birth": "1992-05-15",
        "address": "Vidyadhar Nagar",
        "city": "Jaipur",
        "zip_code": "302039",
        "emergency_phone": None,
        "profile_photo_url": None,
        "trainer_id": None,
        "pt_trainer_id": None,
        "pt_sessions_remaining": 0,
        "joining_date": now,
        "created_at": now
    }
    await db.users.insert_one(trainer_doc)
    
    # Create sample plans
    plans = [
        {"id": str(uuid.uuid4()), "name": "Monthly", "duration_days": 30, "price": 1000, "is_active": True, "includes_pt": False, "pt_sessions": 0, "created_at": now},
        {"id": str(uuid.uuid4()), "name": "Quarterly", "duration_days": 90, "price": 2500, "is_active": True, "includes_pt": False, "pt_sessions": 0, "created_at": now},
        {"id": str(uuid.uuid4()), "name": "Half Yearly", "duration_days": 180, "price": 4500, "is_active": True, "includes_pt": False, "pt_sessions": 0, "created_at": now},
        {"id": str(uuid.uuid4()), "name": "Yearly", "duration_days": 365, "price": 8000, "is_active": True, "includes_pt": False, "pt_sessions": 0, "created_at": now},
        {"id": str(uuid.uuid4()), "name": "Monthly + PT", "duration_days": 30, "price": 3000, "is_active": True, "includes_pt": True, "pt_sessions": 12, "created_at": now},
        {"id": str(uuid.uuid4()), "name": "Quarterly + PT", "duration_days": 90, "price": 8000, "is_active": True, "includes_pt": True, "pt_sessions": 36, "created_at": now},
    ]
    await db.plans.insert_many(plans)
    
    # Create PT packages
    pt_packages = [
        {"id": str(uuid.uuid4()), "name": "10 Sessions", "sessions": 10, "price": 3000, "validity_days": 45, "is_active": True, "created_at": now},
        {"id": str(uuid.uuid4()), "name": "20 Sessions", "sessions": 20, "price": 5500, "validity_days": 60, "is_active": True, "created_at": now},
        {"id": str(uuid.uuid4()), "name": "30 Sessions", "sessions": 30, "price": 7500, "validity_days": 90, "is_active": True, "created_at": now},
    ]
    await db.pt_packages.insert_many(pt_packages)
    
    # Create sample announcement
    announcement_doc = {
        "id": str(uuid.uuid4()),
        "title": "Welcome to F3 Fitness Gym!",
        "content": "We're excited to have you as a member. Check out our new equipment and classes!",
        "created_at": now
    }
    await db.announcements.insert_one(announcement_doc)
    
    # Create sample testimonials
    testimonials = [
        {
            "id": str(uuid.uuid4()),
            "name": "Amit Kumar",
            "role": "Member since 2023",
            "content": "F3 Fitness transformed my life! Lost 15kg in 6 months with amazing trainers.",
            "rating": 5,
            "image_url": None,
            "is_active": True,
            "created_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Priya Singh",
            "role": "Fitness Enthusiast",
            "content": "Best gym in Jaipur! Clean equipment, helpful staff, and great atmosphere.",
            "rating": 5,
            "image_url": None,
            "is_active": True,
            "created_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Rajesh Sharma",
            "role": "PT Client",
            "content": "The personal training program is exceptional. My trainer pushed me to achieve goals I thought were impossible.",
            "rating": 5,
            "image_url": None,
            "is_active": True,
            "created_at": now
        }
    ]
    await db.testimonials.insert_many(testimonials)
    
    # Save WhatsApp settings for sandbox testing
    settings_doc = {
        "id": "1",
        "twilio_account_sid": "AC90629793b1b80228b667f3a239ffb773",
        "twilio_auth_token": "251ae784c0912cc5bdf07737648af837",
        "twilio_whatsapp_number": "+14155238886",
        "use_sandbox": True,
        "sandbox_url": "https://timberwolf-mastiff-9776.twil.io/demo-reply"
    }
    await db.settings.update_one({"id": "1"}, {"$set": settings_doc}, upsert=True)
    
    return {
        "message": "Data seeded successfully",
        "admin_email": "admin@f3fitness.com",
        "admin_password": "admin123",
        "trainer_email": "trainer@f3fitness.com",
        "trainer_password": "trainer123"
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
