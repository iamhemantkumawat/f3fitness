#!/usr/bin/env python3
"""
F3 Fitness - Database Seed Script
Creates default admin user and settings
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

# Password hashing (using bcrypt directly like server.py)
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

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
            "password_hash": hash_password("admin123"),
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
        # Fix existing admin if password field is wrong
        if "password" in existing_admin and "password_hash" not in existing_admin:
            await db.users.update_one(
                {"email": admin_email},
                {"$set": {"password_hash": hash_password("admin123")}, "$unset": {"password": ""}}
            )
            print("✅ Admin user password fixed")
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
    
    # 4. Create Default Trainers
    existing_trainers = await db.users.count_documents({"role": "trainer"})
    
    if existing_trainers == 0:
        trainers = [
            {
                "id": "trainer_001",
                "member_id": "F3-T001",
                "email": "faizan@f3fitness.in",
                "phone": "+919999999001",
                "phone_number": "9999999001",
                "password_hash": hash_password("trainer123"),
                "name": "Faizan Khan",
                "role": "trainer",
                "gender": "male",
                "speciality": "Head Trainer",
                "bio": "Strength & Conditioning",
                "instagram_url": "https://instagram.com/f3fitnessclub",
                "profile_photo_url": "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=400",
                "is_active": True,
                "is_visible_on_website": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "joining_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
            },
            {
                "id": "trainer_002",
                "member_id": "F3-T002",
                "email": "rizwan@f3fitness.in",
                "phone": "+919999999002",
                "phone_number": "9999999002",
                "password_hash": hash_password("trainer123"),
                "name": "Rizwan Khan",
                "role": "trainer",
                "gender": "male",
                "speciality": "Fitness Coach",
                "bio": "Weight Loss & Nutrition",
                "instagram_url": "https://instagram.com/f3fitnessclub",
                "profile_photo_url": "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400",
                "is_active": True,
                "is_visible_on_website": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "joining_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
            },
            {
                "id": "trainer_003",
                "member_id": "F3-T003",
                "email": "faizal@f3fitness.in",
                "phone": "+919999999003",
                "phone_number": "9999999003",
                "password_hash": hash_password("trainer123"),
                "name": "Faizal Khan",
                "role": "trainer",
                "gender": "male",
                "speciality": "PT Specialist",
                "bio": "Muscle Building",
                "instagram_url": "https://instagram.com/f3fitnessclub",
                "profile_photo_url": "https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?w=400",
                "is_active": True,
                "is_visible_on_website": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "joining_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
            }
        ]
        await db.users.insert_many(trainers)
        print("✅ Default trainers created (3 trainers)")
    else:
        print(f"ℹ️  Trainers already exist ({existing_trainers} found)")
    
    # 5. Create indexes for better performance
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
    print("\nTrainer Logins:")
    print("  Email: faizan@f3fitness.in / trainer123")
    print("  Email: rizwan@f3fitness.in / trainer123")
    print("  Email: faizal@f3fitness.in / trainer123")
    print("\n⚠️  IMPORTANT: Change passwords after first login!")
    print("\n📧 Configure SMTP & WhatsApp in Admin Panel > Settings")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_database())
