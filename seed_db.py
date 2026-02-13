#!/usr/bin/env python3
"""
F3 Fitness - Database Seed Script
Creates default admin user and settings
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed_database():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'f3fitness')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print(f"Connected to MongoDB: {db_name}")
    
    # 1. Create Admin User
    admin_email = "admin@f3fitness.in"
    existing_admin = await db.users.find_one({"email": admin_email})
    
    if not existing_admin:
        admin_user = {
            "id": "admin_001",
            "email": admin_email,
            "phone": "+919999999999",
            "password": pwd_context.hash("admin123"),
            "first_name": "Admin",
            "last_name": "F3 Fitness",
            "role": "admin",
            "gender": "male",
            "date_of_birth": "1990-01-01",
            "address": "F3 Fitness Gym, Jaipur",
            "emergency_contact": "+919999999999",
            "profile_photo": None,
            "assigned_trainer_id": None,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "joining_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
        }
        await db.users.insert_one(admin_user)
        print("✅ Admin user created: admin@f3fitness.in / admin123")
    else:
        print("ℹ️  Admin user already exists")
    
    # 2. Create Default Settings (SMTP & Twilio placeholders)
    existing_settings = await db.settings.find_one({"id": "1"})
    
    if not existing_settings:
        default_settings = {
            "id": "1",
            "gym_name": "F3 Fitness Gym",
            "gym_email": "info@f3fitness.in",
            "gym_phone": "+917230052193",
            "gym_address": "4th Avenue Plot No 4R-B, Sector 4, Vidyadhar Nagar, Jaipur, Rajasthan 302039",
            # SMTP Settings - User needs to configure these
            "smtp_host": "",
            "smtp_port": 587,
            "smtp_user": "",
            "smtp_pass": "",
            "smtp_from_email": "",
            "smtp_from_name": "F3 Fitness Gym",
            # Twilio Settings - User needs to configure these
            "twilio_account_sid": "",
            "twilio_auth_token": "",
            "twilio_whatsapp_number": "",
            # Other settings
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.settings.insert_one(default_settings)
        print("✅ Default settings created")
    else:
        print("ℹ️  Settings already exist")
    
    # 3. Create Sample Membership Plans
    existing_plans = await db.plans.count_documents({})
    
    if existing_plans == 0:
        plans = [
            {
                "id": "plan_monthly",
                "name": "Monthly",
                "duration_days": 30,
                "price": 1500,
                "description": "1 Month gym access",
                "includes_pt": False,
                "pt_sessions": 0,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": "plan_quarterly",
                "name": "Quarterly",
                "duration_days": 90,
                "price": 4000,
                "description": "3 Months gym access",
                "includes_pt": False,
                "pt_sessions": 0,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": "plan_halfyearly",
                "name": "Half Yearly",
                "duration_days": 180,
                "price": 7000,
                "description": "6 Months gym access",
                "includes_pt": False,
                "pt_sessions": 0,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": "plan_yearly",
                "name": "Yearly",
                "duration_days": 365,
                "price": 12000,
                "description": "12 Months gym access",
                "includes_pt": False,
                "pt_sessions": 0,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        await db.plans.insert_many(plans)
        print("✅ Sample membership plans created")
    else:
        print("ℹ️  Plans already exist")
    
    # 4. Create indexes for better performance
    await db.users.create_index("email", unique=True)
    await db.users.create_index("phone")
    await db.users.create_index("role")
    await db.memberships.create_index("user_id")
    await db.payments.create_index("user_id")
    await db.attendance.create_index([("user_id", 1), ("date", 1)])
    print("✅ Database indexes created")
    
    print("\n" + "="*50)
    print("Database seeding complete!")
    print("="*50)
    print("\nAdmin Login:")
    print("  Email: admin@f3fitness.in")
    print("  Password: admin123")
    print("\n⚠️  IMPORTANT: Change the admin password after first login!")
    print("\n📧 Configure SMTP & WhatsApp in Admin Panel > Settings")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_database())
