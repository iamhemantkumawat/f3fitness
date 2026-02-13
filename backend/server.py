from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks, Request
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

# Create the main app
app = FastAPI(title="F3 Fitness Gym API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

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
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    emergency_phone: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email_or_phone: str
    password: str

class UserResponse(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    member_id: str
    role: str
    joining_date: str
    profile_photo_url: Optional[str] = None
    trainer_id: Optional[str] = None
    created_at: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    emergency_phone: Optional[str] = None
    profile_photo_url: Optional[str] = None
    trainer_id: Optional[str] = None
    role: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# Plan Models
class PlanBase(BaseModel):
    name: str
    duration_days: int
    price: float
    is_active: bool = True

class PlanCreate(PlanBase):
    pass

class PlanResponse(PlanBase):
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
    member_id: str  # Can be user_id or member_id (F3-XXXX)

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

# Dashboard Stats
class DashboardStats(BaseModel):
    total_members: int
    active_memberships: int
    today_collection: float
    present_today: int
    absent_today: int

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
        
        await aiosmtplib.send(
            message,
            hostname=settings["smtp_host"],
            port=settings["smtp_port"],
            username=settings["smtp_user"],
            password=settings["smtp_pass"],
            use_tls=settings.get("smtp_secure", True)
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
    
    try:
        from twilio.rest import Client
        client = Client(settings["twilio_account_sid"], settings["twilio_auth_token"])
        
        msg = client.messages.create(
            from_=f'whatsapp:{settings["twilio_whatsapp_number"]}',
            body=message,
            to=f'whatsapp:{to_number}'
        )
        return True
    except Exception as e:
        logger.error(f"WhatsApp send failed: {e}")
        return False

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/signup", response_model=dict)
async def signup(user: UserCreate):
    # Check if email or phone already exists
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
        "joining_date": now,
        "created_at": now
    }
    
    await db.users.insert_one(user_doc)
    token = create_access_token({"sub": user_id, "role": "member"})
    
    return {"token": token, "user": {k: v for k, v in user_doc.items() if k not in ["password_hash", "_id"]}}

@api_router.post("/auth/login", response_model=dict)
async def login(credentials: UserLogin):
    user = await db.users.find_one({
        "$or": [{"email": credentials.email_or_phone}, {"phone_number": credentials.email_or_phone}]
    })
    
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    return {"token": token, "user": {k: v for k, v in user.items() if k not in ["password_hash", "_id"]}}

@api_router.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    user = await db.users.find_one({"email": req.email})
    if not user:
        return {"message": "If an account exists, a reset email has been sent"}
    
    reset_token = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await db.password_resets.insert_one({
        "user_id": user["id"],
        "token": reset_token,
        "expires_at": expire.isoformat(),
        "used": False
    })
    
    reset_link = f"https://f3-fitness-gym.preview.emergentagent.com/reset-password?token={reset_token}"
    email_body = f"""
    <h2>F3 Fitness Gym - Password Reset</h2>
    <p>Hello {user['name']},</p>
    <p>Click the link below to reset your password:</p>
    <a href="{reset_link}">{reset_link}</a>
    <p>This link expires in 1 hour.</p>
    """
    
    background_tasks.add_task(send_email, req.email, "Password Reset - F3 Fitness Gym", email_body)
    return {"message": "If an account exists, a reset email has been sent"}

@api_router.post("/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    reset = await db.password_resets.find_one({"token": req.token, "used": False})
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    if datetime.fromisoformat(reset["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")
    
    await db.users.update_one({"id": reset["user_id"]}, {"$set": {"password_hash": hash_password(req.new_password)}})
    await db.password_resets.update_one({"token": req.token}, {"$set": {"used": True}})
    
    return {"message": "Password reset successful"}

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
async def create_user(user: UserCreate, role: str = "member", current_user: dict = Depends(get_admin_user)):
    existing = await db.users.find_one({"$or": [{"email": user.email}, {"phone_number": user.phone_number}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email or phone already exists")
    
    member_id = await generate_member_id()
    user_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    user_doc = {
        "id": user_id,
        "member_id": member_id,
        "name": user.name,
        "email": user.email,
        "phone_number": user.phone_number,
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
        "joining_date": now,
        "created_at": now
    }
    
    await db.users.insert_one(user_doc)
    return {k: v for k, v in user_doc.items() if k not in ["password_hash", "_id"]}

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, update: UserUpdate, current_user: dict = Depends(get_current_user)):
    # Users can only update themselves unless admin
    if current_user["id"] != user_id and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    # Only admin can change role
    if "role" in update_data and current_user["role"] != "admin":
        del update_data["role"]
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_admin_user)):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

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

# ==================== MEMBERSHIPS ROUTES ====================

@api_router.get("/memberships", response_model=List[MembershipResponse])
async def get_memberships(user_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if user_id:
        query["user_id"] = user_id
    elif current_user["role"] != "admin":
        query["user_id"] = current_user["id"]
    
    memberships = await db.memberships.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich with plan names
    for m in memberships:
        plan = await db.plans.find_one({"id": m["plan_id"]}, {"_id": 0, "name": 1})
        m["plan_name"] = plan["name"] if plan else None
    
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
    
    return membership

@api_router.post("/memberships", response_model=MembershipResponse)
async def create_membership(membership: MembershipCreate, current_user: dict = Depends(get_admin_user)):
    # Get plan details
    plan = await db.plans.find_one({"id": membership.plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Check for existing active membership
    existing = await db.memberships.find_one(
        {"user_id": membership.user_id, "status": "active"},
        sort=[("end_date", -1)]
    )
    
    if existing:
        # Queue: Start after current membership ends
        start_date = datetime.fromisoformat(existing["end_date"])
    else:
        start_date = get_ist_now()
    
    end_date = start_date + timedelta(days=plan["duration_days"])
    
    final_price = plan["price"] - membership.discount_amount
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
        "created_at": now
    }
    
    await db.memberships.insert_one(membership_doc)
    
    # Record initial payment if any
    if membership.initial_payment > 0:
        payment_doc = {
            "id": str(uuid.uuid4()),
            "membership_id": membership_id,
            "user_id": membership.user_id,
            "amount_paid": membership.initial_payment,
            "payment_date": now,
            "payment_method": membership.payment_method,
            "notes": "Initial membership payment",
            "recorded_by_admin_id": current_user["id"]
        }
        await db.payments.insert_one(payment_doc)
    
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
    
    # Enrich with user details
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
        # Get last day of month
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
    
    # Group by payment method
    by_method = {}
    for p in payments:
        method = p["payment_method"]
        by_method[method] = by_method.get(method, 0) + p["amount_paid"]
    
    return {"total": total, "count": len(payments), "by_method": by_method}

@api_router.post("/payments", response_model=PaymentResponse)
async def create_payment(payment: PaymentCreate, current_user: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"id": payment.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get active membership
    membership = await db.memberships.find_one(
        {"user_id": payment.user_id, "status": "active"},
        sort=[("end_date", -1)]
    )
    
    payment_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    payment_doc = {
        "id": payment_id,
        "membership_id": membership["id"] if membership else None,
        "user_id": payment.user_id,
        "amount_paid": payment.amount_paid,
        "payment_date": now,
        "payment_method": payment.payment_method,
        "notes": payment.notes,
        "recorded_by_admin_id": current_user["id"]
    }
    
    await db.payments.insert_one(payment_doc)
    
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
    
    # Enrich with user and plan details
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
    discount: float = 0,
    payment_method: str = "cash",
    current_user: dict = Depends(get_admin_user)
):
    request = await db.payment_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")
    
    # Create membership
    membership_data = MembershipCreate(
        user_id=request["user_id"],
        plan_id=request["plan_id"],
        discount_amount=discount,
        initial_payment=0,
        payment_method=payment_method
    )
    
    await create_membership(membership_data, current_user)
    
    # Update request status
    await db.payment_requests.update_one({"id": request_id}, {"$set": {"status": "completed"}})
    
    return {"message": "Payment request approved and membership created"}

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
    
    # Enrich with user details
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
    
    # Get all active members
    active_memberships = await db.memberships.find({"status": "active"}, {"_id": 0, "user_id": 1}).to_list(10000)
    active_user_ids = set(m["user_id"] for m in active_memberships)
    
    absent_user_ids = active_user_ids - present_user_ids
    
    # Get user details
    present = []
    for a in attendance:
        user = await db.users.find_one({"id": a["user_id"]}, {"_id": 0, "name": 1, "member_id": 1})
        if user:
            present.append({**a, "user_name": user["name"], "member_id": user["member_id"]})
    
    absent = []
    for uid in absent_user_ids:
        user = await db.users.find_one({"id": uid}, {"_id": 0, "id": 1, "name": 1, "member_id": 1})
        if user:
            absent.append(user)
    
    return {"present": present, "absent": absent, "present_count": len(present), "absent_count": len(absent)}

@api_router.post("/attendance", response_model=AttendanceResponse)
async def mark_attendance(attendance: AttendanceCreate, current_user: dict = Depends(get_admin_user)):
    # Find user by member_id or user_id
    user = await db.users.find_one({
        "$or": [{"id": attendance.member_id}, {"member_id": attendance.member_id}]
    }, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Check if already marked today
    today = get_ist_now().strftime("%Y-%m-%d")
    existing = await db.attendance.find_one({
        "user_id": user["id"],
        "check_in_time": {"$regex": f"^{today}"}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Attendance already marked today")
    
    attendance_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    attendance_doc = {
        "id": attendance_id,
        "user_id": user["id"],
        "check_in_time": now
    }
    
    await db.attendance.insert_one(attendance_doc)
    
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

# ==================== HOLIDAYS ROUTES ====================

@api_router.get("/holidays", response_model=List[HolidayResponse])
async def get_holidays():
    holidays = await db.holidays.find({}, {"_id": 0}).to_list(100)
    return holidays

@api_router.post("/holidays", response_model=HolidayResponse)
async def create_holiday(holiday: HolidayCreate, current_user: dict = Depends(get_admin_user)):
    holiday_id = str(uuid.uuid4())
    
    holiday_doc = {
        "id": holiday_id,
        **holiday.model_dump()
    }
    
    await db.holidays.insert_one(holiday_doc)
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
async def create_announcement(announcement: AnnouncementCreate, current_user: dict = Depends(get_admin_user)):
    announcement_id = str(uuid.uuid4())
    now = get_ist_now().isoformat()
    
    announcement_doc = {
        "id": announcement_id,
        **announcement.model_dump(),
        "created_at": now
    }
    
    await db.announcements.insert_one(announcement_doc)
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
    success = await send_email(to_email, "F3 Fitness Gym - Test Email", "<h2>Test email from F3 Fitness Gym</h2><p>SMTP configuration is working correctly!</p>")
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
    success = await send_whatsapp(to_number, "Hello from F3 Fitness Gym! WhatsApp integration is working.")
    if success:
        return {"message": "Test message sent successfully"}
    raise HTTPException(status_code=500, detail="Failed to send test message. Check WhatsApp settings.")

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
    
    # Absent today (active members not in attendance)
    active_membership_users = await db.memberships.find(
        {"status": "active"},
        {"_id": 0, "user_id": 1}
    ).to_list(10000)
    active_user_ids = set(m["user_id"] for m in active_membership_users)
    absent_today = len(active_user_ids - present_user_ids)
    
    return DashboardStats(
        total_members=total_members,
        active_memberships=active_memberships,
        today_collection=today_collection,
        present_today=present_today,
        absent_today=absent_today
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

# ==================== RAZORPAY ROUTES ====================

@api_router.post("/razorpay/create-order", response_model=RazorpayOrderResponse)
async def create_razorpay_order(order: RazorpayOrderCreate, current_user: dict = Depends(get_current_user)):
    client = get_razorpay_client()
    if not client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    plan = await db.plans.find_one({"id": order.plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    amount = int(plan["price"] * 100)  # Convert to paise
    
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
    
    # Get plan details
    plan = await db.plans.find_one({"id": payment.plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Check for existing active membership
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
    
    # Create membership
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
    
    # Record payment
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
async def upload_profile_photo(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Read file and convert to base64
    content = await file.read()
    base64_content = base64.b64encode(content).decode()
    data_url = f"data:{file.content_type};base64,{base64_content}"
    
    # Update user profile
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"profile_photo_url": data_url}})
    
    return {"profile_photo_url": data_url}

# ==================== SEED DATA ROUTE ====================

@api_router.post("/seed")
async def seed_data():
    """Seed initial data for testing"""
    
    # Check if admin exists
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
        "password_hash": hash_password("admin123"),
        "role": "admin",
        "gender": "male",
        "date_of_birth": "1990-01-01",
        "address": "123 Gym Street",
        "city": "Jaipur",
        "zip_code": "302001",
        "emergency_phone": "9999999998",
        "profile_photo_url": None,
        "trainer_id": None,
        "joining_date": now,
        "created_at": now
    }
    await db.users.insert_one(admin_doc)
    
    # Create sample plans
    plans = [
        {"id": str(uuid.uuid4()), "name": "Monthly", "duration_days": 30, "price": 1000, "is_active": True, "created_at": now},
        {"id": str(uuid.uuid4()), "name": "Quarterly", "duration_days": 90, "price": 2500, "is_active": True, "created_at": now},
        {"id": str(uuid.uuid4()), "name": "Half Yearly", "duration_days": 180, "price": 4500, "is_active": True, "created_at": now},
        {"id": str(uuid.uuid4()), "name": "Yearly", "duration_days": 365, "price": 8000, "is_active": True, "created_at": now},
    ]
    await db.plans.insert_many(plans)
    
    # Create sample announcement
    announcement_doc = {
        "id": str(uuid.uuid4()),
        "title": "Welcome to F3 Fitness Gym!",
        "content": "We're excited to have you as a member. Check out our new equipment and classes!",
        "created_at": now
    }
    await db.announcements.insert_one(announcement_doc)
    
    return {"message": "Data seeded successfully", "admin_email": "admin@f3fitness.com", "admin_password": "admin123"}

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
