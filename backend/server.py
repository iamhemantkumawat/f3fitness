from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks, Request, Form, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
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
import razorpay
import base64
import aiofiles
import random
import string
import httpx
import json
import asyncio
from contextlib import asynccontextmanager

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
    member_id: str
    role: str
    joining_date: str
    profile_photo_url: Optional[str] = None
    trainer_id: Optional[str] = None
    pt_trainer_id: Optional[str] = None
    pt_sessions_remaining: Optional[int] = 0
    created_at: str

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
    email: EmailStr

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

class WhatsAppSettings(BaseModel):
    twilio_account_sid: str
    twilio_auth_token: str
    twilio_whatsapp_number: str
    use_sandbox: bool = True
    sandbox_url: Optional[str] = None

class SettingsResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "1"
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_secure: Optional[bool] = True
    sender_email: Optional[str] = None
    twilio_account_sid: Optional[str] = None
    twilio_whatsapp_number: Optional[str] = None
    use_sandbox: Optional[bool] = True

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

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
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
    return datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)

def get_ist_today_start():
    """Get today's start in IST (midnight)"""
    ist_now = get_ist_now()
    return datetime(ist_now.year, ist_now.month, ist_now.day, 0, 0, 0)

def get_ist_today_end():
    """Get today's end in IST"""
    ist_now = get_ist_now()
    return datetime(ist_now.year, ist_now.month, ist_now.day, 23, 59, 59)

async def get_template(template_type: str, channel: str) -> dict:
    """Get notification template"""
    template = await db.templates.find_one({"template_type": template_type, "channel": channel}, {"_id": 0})
    if template:
        return template
    # Return default templates
    defaults = {
        ("welcome", "email"): {
            "subject": "Welcome to F3 Fitness Gym! 💪",
            "content": """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090b; color: #fff; padding: 40px;">
                <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" style="width: 150px; margin-bottom: 20px;" />
                <h1 style="color: #06b6d4;">Welcome, {{name}}!</h1>
                <p>Thank you for joining F3 Fitness Gym - Jaipur's premier fitness destination.</p>
                <p>Your Member ID: <strong style="color: #06b6d4;">{{member_id}}</strong></p>
                <p>We're excited to be part of your fitness journey!</p>
                <hr style="border-color: #27272a; margin: 20px 0;" />
                <p style="color: #71717a; font-size: 12px;">F3 Fitness Health Club, Vidyadhar Nagar, Jaipur</p>
            </div>
            """
        },
        ("welcome", "whatsapp"): {
            "content": "🏋️ Welcome to F3 Fitness Gym, {{name}}! Your Member ID is {{member_id}}. Let's crush your fitness goals together! 💪"
        },
        ("attendance", "whatsapp"): {
            "content": "✅ Attendance marked! Great job showing up today, {{name}}. Keep the momentum going! 🔥"
        },
        ("absent_warning", "email"): {
            "subject": "We Miss You at F3 Fitness! 😢",
            "content": """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090b; color: #fff; padding: 40px;">
                <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" style="width: 150px; margin-bottom: 20px;" />
                <h1 style="color: #f97316;">We Miss You, {{name}}!</h1>
                <p>It's been {{days}} days since your last visit. Your fitness goals are waiting!</p>
                <p>Remember: Consistency is key to achieving your dream physique. 💪</p>
                <p>See you soon at the gym!</p>
            </div>
            """
        },
        ("absent_warning", "whatsapp"): {
            "content": "😢 Hey {{name}}, it's been {{days}} days since your last gym visit. Your fitness goals miss you! Come back stronger 💪"
        },
        ("birthday", "email"): {
            "subject": "Happy Birthday from F3 Fitness! 🎂",
            "content": """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090b; color: #fff; padding: 40px;">
                <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" style="width: 150px; margin-bottom: 20px;" />
                <h1 style="color: #06b6d4;">🎉 Happy Birthday, {{name}}!</h1>
                <p>Wishing you a fantastic birthday filled with health, happiness, and gains!</p>
                <p>Here's to another year of crushing your fitness goals! 🎂💪</p>
                <p>Your F3 Fitness Family</p>
            </div>
            """
        },
        ("birthday", "whatsapp"): {
            "content": "🎂 Happy Birthday, {{name}}! 🎉 Wishing you a year full of health, happiness and fitness gains! Enjoy your special day! - F3 Fitness Gym 💪"
        },
        ("plan_shared", "email"): {
            "subject": "Your New {{plan_type}} Plan is Ready! 📋",
            "content": """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090b; color: #fff; padding: 40px;">
                <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" style="width: 150px; margin-bottom: 20px;" />
                <h1 style="color: #06b6d4;">New {{plan_type}} Plan! 📋</h1>
                <p>Hi {{name}},</p>
                <p>Your trainer has created a new {{plan_type}} plan for you: <strong>{{plan_title}}</strong></p>
                <p>Log in to your dashboard to view the full details.</p>
                <p>Let's achieve your goals together!</p>
            </div>
            """
        },
        ("plan_shared", "whatsapp"): {
            "content": "📋 Hi {{name}}! Your trainer has created a new {{plan_type}} plan: {{plan_title}}. Check your F3 Fitness dashboard to view it! 💪"
        },
        ("renewal_reminder", "email"): {
            "subject": "Your Membership Expires Soon! ⏰",
            "content": """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090b; color: #fff; padding: 40px;">
                <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" style="width: 150px; margin-bottom: 20px;" />
                <h1 style="color: #f97316;">Renewal Reminder ⏰</h1>
                <p>Hi {{name}},</p>
                <p>Your membership expires on <strong>{{expiry_date}}</strong> ({{days_left}} days left).</p>
                <p>Renew now to continue your fitness journey without interruption!</p>
                <p>Visit the gym or renew online.</p>
            </div>
            """
        },
        ("renewal_reminder", "whatsapp"): {
            "content": "⏰ Hi {{name}}, your F3 Fitness membership expires on {{expiry_date}} ({{days_left}} days left). Renew now to keep your fitness journey going! 💪"
        },
        ("membership_activated", "email"): {
            "subject": "Membership Activated! 🎉",
            "content": """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090b; color: #fff; padding: 40px;">
                <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" style="width: 150px; margin-bottom: 20px;" />
                <h1 style="color: #06b6d4;">Membership Activated! 🎉</h1>
                <p>Hi {{name}},</p>
                <p>Your <strong>{{plan_name}}</strong> membership is now active!</p>
                <div style="background: #18181b; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <p style="margin: 5px 0;"><strong>Plan:</strong> {{plan_name}}</p>
                    <p style="margin: 5px 0;"><strong>Start Date:</strong> {{start_date}}</p>
                    <p style="margin: 5px 0;"><strong>End Date:</strong> {{end_date}}</p>
                </div>
                <p>See you at the gym! 💪</p>
            </div>
            """
        },
        ("membership_activated", "whatsapp"): {
            "content": "🎉 Hi {{name}}! Your {{plan_name}} membership is now active from {{start_date}} to {{end_date}}. Let's crush those fitness goals! 💪 - F3 Fitness Gym"
        },
        ("payment_received", "email"): {
            "subject": "Payment Received - F3 Fitness Gym 💰",
            "content": """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090b; color: #fff; padding: 40px;">
                <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" style="width: 150px; margin-bottom: 20px;" />
                <h1 style="color: #06b6d4;">Payment Received! 💰</h1>
                <p>Hi {{name}},</p>
                <p>Thank you for your payment. Here are the details:</p>
                <div style="background: #18181b; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <p style="margin: 5px 0;"><strong>Receipt No:</strong> {{receipt_no}}</p>
                    <p style="margin: 5px 0;"><strong>Amount:</strong> ₹{{amount}}</p>
                    <p style="margin: 5px 0;"><strong>Payment Mode:</strong> {{payment_mode}}</p>
                    <p style="margin: 5px 0;"><strong>Date:</strong> {{payment_date}}</p>
                    <p style="margin: 5px 0;"><strong>For:</strong> {{description}}</p>
                </div>
                <p>Keep this as your payment confirmation.</p>
            </div>
            """
        },
        ("payment_received", "whatsapp"): {
            "content": "💰 Hi {{name}}, payment received!\n\nReceipt: {{receipt_no}}\nAmount: ₹{{amount}}\nMode: {{payment_mode}}\nFor: {{description}}\n\nThank you! - F3 Fitness Gym"
        },
        ("holiday", "email"): {
            "subject": "Holiday Notice - F3 Fitness Gym 🏖️",
            "content": """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090b; color: #fff; padding: 40px;">
                <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" style="width: 150px; margin-bottom: 20px;" />
                <h1 style="color: #f97316;">Holiday Notice 🏖️</h1>
                <p>Hi {{name}},</p>
                <p>Please note that F3 Fitness Gym will be closed on:</p>
                <div style="background: #18181b; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
                    <p style="font-size: 24px; color: #06b6d4; margin: 0;"><strong>{{holiday_date}}</strong></p>
                    <p style="color: #71717a; margin: 10px 0 0 0;">{{holiday_reason}}</p>
                </div>
                <p>Plan your workouts accordingly. See you soon!</p>
            </div>
            """
        },
        ("holiday", "whatsapp"): {
            "content": "🏖️ Hi {{name}}, F3 Fitness Gym will be closed on {{holiday_date}} for {{holiday_reason}}. Plan your workouts accordingly. See you soon! 💪"
        },
        ("announcement", "email"): {
            "subject": "📢 {{announcement_title}} - F3 Fitness Gym",
            "content": """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090b; color: #fff; padding: 40px;">
                <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" style="width: 150px; margin-bottom: 20px;" />
                <h1 style="color: #06b6d4;">📢 {{announcement_title}}</h1>
                <p>Hi {{name}},</p>
                <div style="background: #18181b; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <p>{{announcement_content}}</p>
                </div>
                <p>Stay fit, stay healthy!</p>
            </div>
            """
        },
        ("announcement", "whatsapp"): {
            "content": "📢 {{announcement_title}}\n\nHi {{name}}, {{announcement_content}}\n\n- F3 Fitness Gym"
        }
    }
    return defaults.get((template_type, channel), {"subject": "", "content": ""})

def replace_template_vars(template: str, variables: dict) -> str:
    """Replace template variables like {{name}} with actual values"""
    for key, value in variables.items():
        template = template.replace(f"{{{{{key}}}}}", str(value))
    return template

async def send_email(to_email: str, subject: str, body: str):
    """Send email using configured SMTP settings"""
    settings = await db.settings.find_one({"id": "1"}, {"_id": 0})
    if not settings or not settings.get("smtp_host"):
        logger.warning("SMTP not configured")
        return False
    
    try:
        message = MIMEMultipart()
        message["From"] = settings.get("sender_email", settings.get("smtp_user"))
        message["To"] = to_email
        message["Subject"] = subject
        message.attach(MIMEText(body, "html"))
        
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
        return True
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return False

async def send_whatsapp(to_number: str, message: str):
    """Send WhatsApp message using Twilio"""
    settings = await db.settings.find_one({"id": "1"}, {"_id": 0})
    if not settings or not settings.get("twilio_account_sid"):
        logger.warning("WhatsApp not configured")
        return False
    
    # Clean phone number - remove spaces, dashes, and ensure E.164 format
    to_number = to_number.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
    
    # Ensure number starts with +
    if not to_number.startswith('+'):
        to_number = '+' + to_number.lstrip('+')
    
    try:
        if settings.get("use_sandbox") and settings.get("sandbox_url"):
            # Use Twilio Sandbox via HTTP
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    settings["sandbox_url"],
                    data={
                        "To": f"whatsapp:{to_number}",
                        "Body": message
                    }
                )
                logger.info(f"Sandbox response: {response.status_code}")
                return response.status_code == 200
        else:
            # Use Twilio API directly
            from twilio.rest import Client
            twilio_client = Client(settings["twilio_account_sid"], settings["twilio_auth_token"])
            
            # Clean the from number as well
            from_number = settings["twilio_whatsapp_number"].replace(' ', '').replace('-', '')
            
            msg = twilio_client.messages.create(
                from_=f'whatsapp:{from_number}',
                body=message,
                to=f'whatsapp:{to_number}'
            )
            logger.info(f"WhatsApp message sent: {msg.sid}")
            return True
    except Exception as e:
        logger.error(f"WhatsApp send failed: {e}")
        return False

async def send_notification(user: dict, template_type: str, variables: dict, background_tasks: BackgroundTasks = None):
    """Send notification via both email and WhatsApp"""
    # Prepare variables
    vars_with_user = {**variables, "name": user.get("name"), "member_id": user.get("member_id")}
    
    # Get templates
    email_template = await get_template(template_type, "email")
    whatsapp_template = await get_template(template_type, "whatsapp")
    
    # Send email
    if user.get("email") and email_template.get("content"):
        subject = replace_template_vars(email_template.get("subject", "F3 Fitness Notification"), vars_with_user)
        body = replace_template_vars(email_template["content"], vars_with_user)
        if background_tasks:
            background_tasks.add_task(send_email, user["email"], subject, body)
        else:
            await send_email(user["email"], subject, body)
    
    # Send WhatsApp
    if user.get("phone_number") and whatsapp_template.get("content"):
        phone = user.get("country_code", "+91") + user["phone_number"].lstrip("0")
        message = replace_template_vars(whatsapp_template["content"], vars_with_user)
        if background_tasks:
            background_tasks.add_task(send_whatsapp, phone, message)
        else:
            await send_whatsapp(phone, message)

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

async def scheduler_loop():
    """Background scheduler that runs daily tasks"""
    while True:
        try:
            now = get_ist_now()
            # Run at 9 AM IST
            if now.hour == 9 and now.minute < 5:
                await send_expiry_reminders()
                await send_birthday_wishes()
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
    
    # Send WhatsApp OTP
    full_phone = f"{req.country_code}{req.phone_number.lstrip('0')}"
    whatsapp_message = f"🔐 Your F3 Fitness OTP is: {otp}\n\nValid for 10 minutes. Do not share this code with anyone."
    background_tasks.add_task(send_whatsapp, full_phone, whatsapp_message)
    
    # Send same OTP to Email
    if req.email:
        email_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090b; color: #fff; padding: 40px;">
            <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" style="width: 150px; margin-bottom: 20px;" />
            <h1 style="color: #06b6d4;">Your OTP Code</h1>
            <p>Use the following code to verify your account:</p>
            <div style="background: #18181b; padding: 20px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #06b6d4;">{otp}</span>
            </div>
            <p style="color: #71717a;">This code is valid for 10 minutes.</p>
        </div>
        """
        background_tasks.add_task(send_email, req.email, "F3 Fitness - Verification OTP", email_body)
    
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
    
    # Send welcome notification
    await send_notification(user_doc, "welcome", {}, background_tasks)
    
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
    
    # Send welcome notification
    await send_notification(user_doc, "welcome", {}, background_tasks)
    
    token = create_access_token({"sub": user_id, "role": "member"})
    return {"token": token, "user": {k: v for k, v in user_doc.items() if k not in ["password_hash", "_id"]}}

@api_router.post("/auth/login", response_model=dict)
async def login(credentials: UserLogin, request: Request):
    user = await db.users.find_one({
        "$or": [{"email": credentials.email_or_phone}, {"phone_number": credentials.email_or_phone}]
    })
    
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Log login activity
    ip_address = request.client.host if request.client else None
    await log_activity(user["id"], "login", "User logged in", ip_address)
    
    token = create_access_token({"sub": user["id"], "role": user["role"]})
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
    
    # Send OTP via Email
    email_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090b; color: #fff; padding: 40px;">
        <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" style="width: 150px; margin-bottom: 20px;" />
        <h1 style="color: #06b6d4;">Password Reset OTP</h1>
        <p>Hello {user['name']},</p>
        <p>Use the following OTP to reset your password:</p>
        <div style="background: #18181b; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #06b6d4;">{otp}</span>
        </div>
        <p style="color: #71717a;">This OTP is valid for 10 minutes. Do not share it with anyone.</p>
    </div>
    """
    background_tasks.add_task(send_email, user["email"], "Password Reset OTP - F3 Fitness Gym", email_body)
    
    # Send OTP via WhatsApp
    if user.get("phone_number"):
        full_phone = f"{user.get('country_code', '+91')}{user['phone_number'].lstrip('0')}"
        whatsapp_message = f"🔐 F3 Fitness Password Reset\n\nYour OTP is: {otp}\n\nValid for 10 minutes. Do not share this code with anyone."
        background_tasks.add_task(send_whatsapp, full_phone, whatsapp_message)
    
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
    
    return {"message": "Password changed successfully"}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ==================== USERS/MEMBERS ROUTES ====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(
    role: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_admin_user)
):
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
    
    # Send welcome notification with credentials
    if background_tasks:
        # WhatsApp message
        if user.phone_number:
            full_phone = f"{user.country_code}{user.phone_number.lstrip('0')}"
            whatsapp_msg = f"""🏋️ Welcome to F3 Fitness Gym!

Hello {user.name},

Your account has been created successfully!

📋 Your Login Details:
Member ID: {member_id}
Email: {user.email}
Password: {user.password}

Login at: https://f3fitness.in/login

Transform Your Body, Transform Your Life! 💪"""
            background_tasks.add_task(send_whatsapp, full_phone, whatsapp_msg)
        
        # Email notification
        email_body = f"""
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto; background: #09090b; color: #fff; padding: 40px;">
            <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" style="width: 150px; margin-bottom: 20px;" />
            <h1 style="color: #06b6d4;">Welcome to F3 Fitness Gym!</h1>
            <p>Hello {user.name},</p>
            <p>Your account has been created successfully. Here are your login credentials:</p>
            <div style="background: #18181b; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <p style="margin: 5px 0;"><strong>Member ID:</strong> <span style="color: #06b6d4;">{member_id}</span></p>
                <p style="margin: 5px 0;"><strong>Email:</strong> {user.email}</p>
                <p style="margin: 5px 0;"><strong>Password:</strong> <code style="color: #f97316;">{user.password}</code></p>
            </div>
            <p style="color: #71717a;">We recommend changing your password after your first login.</p>
            <a href="https://f3fitness.in/login" style="display: inline-block; background: #06b6d4; color: #000; padding: 12px 24px; text-decoration: none; font-weight: bold; margin-top: 10px; border-radius: 4px;">Login Now</a>
            <hr style="border: none; border-top: 1px solid #27272a; margin: 30px 0;" />
            <p style="color: #71717a; font-size: 14px;">Transform Your Body, Transform Your Life! 💪</p>
        </div>
        """
        background_tasks.add_task(send_email, user.email, "Welcome to F3 Fitness Gym - Your Login Details", email_body)
        
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
                "amount_due": amount_due
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
    
    if existing:
        start_date = datetime.fromisoformat(existing["end_date"])
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
        receipt_no = f"F3-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        payment_doc = {
            "id": str(uuid.uuid4()),
            "receipt_no": receipt_no,
            "membership_id": membership_id,
            "user_id": membership.user_id,
            "amount_paid": membership.initial_payment,
            "payment_date": now,
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
            "payment_date": datetime.now().strftime("%d %b %Y"),
            "description": f"Payment for {plan['name']}"
        }, background_tasks)
    
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

# ==================== PAYMENTS ROUTES ====================

@api_router.get("/payments", response_model=List[PaymentResponse])
async def get_payments(
    user_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_admin_user)
):
    query = {}
    if user_id:
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
    
    # Send payment notification
    await send_notification(user, "payment_received", {
        "receipt_no": receipt_no,
        "amount": payment.amount_paid,
        "payment_mode": payment.payment_method,
        "payment_date": datetime.now().strftime("%d %b %Y"),
        "description": payment.notes or "Gym Payment"
    }, background_tasks)
    
    result = {k: v for k, v in payment_doc.items() if k != "_id"}
    result["user_name"] = user["name"]
    result["member_id"] = user["member_id"]
    return result

# ==================== PAYMENT REQUESTS ROUTES ====================

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
    elif current_user["role"] != "admin":
        query["user_id"] = current_user["id"]
    
    if date:
        query["check_in_time"] = {"$regex": f"^{date}"}
    
    attendance = await db.attendance.find(query, {"_id": 0}).sort("check_in_time", -1).to_list(10000)
    
    for a in attendance:
        user = await db.users.find_one({"id": a["user_id"]}, {"_id": 0, "name": 1, "member_id": 1})
        if user:
            a["user_name"] = user["name"]
            a["member_id"] = user["member_id"]
    
    return attendance

@api_router.get("/attendance/today")
async def get_today_attendance(current_user: dict = Depends(get_admin_user)):
    today = get_ist_now().strftime("%Y-%m-%d")
    
    attendance = await db.attendance.find(
        {"check_in_time": {"$regex": f"^{today}"}},
        {"_id": 0}
    ).to_list(10000)
    
    present_user_ids = set(a["user_id"] for a in attendance)
    
    active_memberships = await db.memberships.find({"status": "active"}, {"_id": 0, "user_id": 1}).to_list(10000)
    active_user_ids = set(m["user_id"] for m in active_memberships)
    
    absent_user_ids = active_user_ids - present_user_ids
    
    present = []
    for a in attendance:
        user = await db.users.find_one({"id": a["user_id"]}, {"_id": 0, "name": 1, "member_id": 1})
        if user:
            present.append({**a, "user_name": user["name"], "member_id": user["member_id"]})
    
    absent = []
    for uid in absent_user_ids:
        user = await db.users.find_one({"id": uid}, {"_id": 0, "id": 1, "name": 1, "member_id": 1, "phone_number": 1})
        if user:
            absent.append(user)
    
    return {"present": present, "absent": absent, "present_count": len(present), "absent_count": len(absent)}

@api_router.post("/attendance", response_model=AttendanceResponse)
async def mark_attendance(attendance: AttendanceCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_admin_user)):
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
    
    today = get_ist_now().strftime("%Y-%m-%d")
    existing = await db.attendance.find_one({
        "user_id": user["id"],
        "check_in_time": {"$regex": f"^{today}"}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Attendance already marked today for {user['name']}")
    
    attendance_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    attendance_doc = {
        "id": attendance_id,
        "user_id": user["id"],
        "check_in_time": now
    }
    
    await db.attendance.insert_one(attendance_doc)
    
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
                last_date = datetime.fromisoformat(last_attendance["check_in_time"][:10])
                days_absent = (get_ist_now() - last_date).days
                user["days_absent"] = days_absent
                user["last_attendance"] = last_attendance["check_in_time"]
                absentees.append(user)
    
    return absentees

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
    settings = await db.settings.find_one({"id": "1"}, {"_id": 0, "smtp_pass": 0, "twilio_auth_token": 0})
    if not settings:
        return SettingsResponse()
    return settings

@api_router.put("/settings/smtp")
async def update_smtp_settings(settings: SMTPSettings, current_user: dict = Depends(get_admin_user)):
    update_data = settings.model_dump()
    
    await db.settings.update_one(
        {"id": "1"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "SMTP settings updated"}

@api_router.post("/settings/smtp/test")
async def test_smtp(to_email: str, current_user: dict = Depends(get_admin_user)):
    email_body = """
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090b; color: #fff; padding: 40px;">
        <img src="https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png" style="width: 150px; margin-bottom: 20px;" />
        <h1 style="color: #06b6d4;">Test Email</h1>
        <p>SMTP configuration is working correctly!</p>
        <p style="color: #71717a;">This is a test email from F3 Fitness Gym.</p>
    </div>
    """
    success = await send_email(to_email, "F3 Fitness Gym - Test Email", email_body)
    if success:
        return {"message": "Test email sent successfully"}
    raise HTTPException(status_code=500, detail="Failed to send test email. Check SMTP settings.")

@api_router.put("/settings/whatsapp")
async def update_whatsapp_settings(settings: WhatsAppSettings, current_user: dict = Depends(get_admin_user)):
    update_data = settings.model_dump()
    
    await db.settings.update_one(
        {"id": "1"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "WhatsApp settings updated"}

@api_router.post("/settings/whatsapp/test")
async def test_whatsapp(to_number: str, current_user: dict = Depends(get_admin_user)):
    success = await send_whatsapp(to_number, "🏋️ Hello from F3 Fitness Gym! WhatsApp integration is working. 💪")
    if success:
        return {"message": "Test message sent successfully"}
    raise HTTPException(status_code=500, detail="Failed to send test message. Check WhatsApp settings.")

# ==================== TEMPLATE ROUTES ====================

@api_router.get("/templates", response_model=List[TemplateResponse])
async def get_templates(current_user: dict = Depends(get_admin_user)):
    templates = await db.templates.find({}, {"_id": 0}).to_list(100)
    
    # Add default templates if not exist
    template_types = ["welcome", "attendance", "absent_warning", "birthday", "holiday", "plan_shared", "renewal_reminder"]
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
    
    return {"message": "Template updated"}

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
