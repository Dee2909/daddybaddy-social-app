#!/usr/bin/env python3
"""
Test script to check database connection and show current users
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing Supabase configuration")
    print("Please check your .env file for SUPABASE_URL and SUPABASE_ANON_KEY")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def test_database_connection():
    """Test database connection and show current data"""
    try:
        print("🔍 Testing database connection...")
        
        # Test profiles table
        print("\n📊 PROFILES TABLE:")
        profiles_response = supabase.table("profiles").select("*").execute()
        
        if profiles_response.data:
            print(f"✅ Found {len(profiles_response.data)} users:")
            for profile in profiles_response.data:
                print(f"  - ID: {profile.get('id', 'N/A')}")
                print(f"    Username: {profile.get('username', 'N/A')}")
                print(f"    Phone: {profile.get('phone', 'N/A')}")
                print(f"    Full Name: {profile.get('full_name', 'N/A')}")
                print(f"    Email: {profile.get('email', 'N/A')}")
                print(f"    Verified: {profile.get('verified', 'N/A')}")
                print(f"    Created: {profile.get('created_at', 'N/A')}")
                print("    ---")
        else:
            print("❌ No users found in profiles table")
        
        # Test battles table
        print("\n⚔️ BATTLES TABLE:")
        battles_response = supabase.table("battles").select("*").execute()
        
        if battles_response.data:
            print(f"✅ Found {len(battles_response.data)} battles:")
            for battle in battles_response.data:
                print(f"  - ID: {battle.get('id', 'N/A')}")
                print(f"    Title: {battle.get('title', 'N/A')}")
                print(f"    Option A: {battle.get('option_a', 'N/A')}")
                print(f"    Option B: {battle.get('option_b', 'N/A')}")
                print(f"    Active: {battle.get('is_active', 'N/A')}")
                print("    ---")
        else:
            print("❌ No battles found in battles table")
        
        # Test votes table
        print("\n🗳️ VOTES TABLE:")
        votes_response = supabase.table("votes").select("*").execute()
        
        if votes_response.data:
            print(f"✅ Found {len(votes_response.data)} votes:")
            for vote in votes_response.data:
                print(f"  - Battle ID: {vote.get('battle_id', 'N/A')}")
                print(f"    User ID: {vote.get('user_id', 'N/A')}")
                print(f"    Choice: {vote.get('choice', 'N/A')}")
                print("    ---")
        else:
            print("❌ No votes found in votes table")
        
        # Test chat_rooms table
        print("\n💬 CHAT ROOMS TABLE:")
        chat_rooms_response = supabase.table("chat_rooms").select("*").execute()
        
        if chat_rooms_response.data:
            print(f"✅ Found {len(chat_rooms_response.data)} chat rooms:")
            for room in chat_rooms_response.data:
                print(f"  - ID: {room.get('id', 'N/A')}")
                print(f"    Name: {room.get('name', 'N/A')}")
                print(f"    Type: {room.get('room_type', 'N/A')}")
                print(f"    Active: {room.get('is_active', 'N/A')}")
                print("    ---")
        else:
            print("❌ No chat rooms found in chat_rooms table")
        
        # Test notifications table
        print("\n🔔 NOTIFICATIONS TABLE:")
        notifications_response = supabase.table("notifications").select("*").execute()
        
        if notifications_response.data:
            print(f"✅ Found {len(notifications_response.data)} notifications:")
            for notification in notifications_response.data:
                print(f"  - ID: {notification.get('id', 'N/A')}")
                print(f"    Title: {notification.get('title', 'N/A')}")
                print(f"    Type: {notification.get('type', 'N/A')}")
                print(f"    Read: {notification.get('is_read', 'N/A')}")
                print("    ---")
        else:
            print("❌ No notifications found in notifications table")
        
        print("\n✅ Database connection successful!")
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False
    
    return True

def show_database_schema():
    """Show the current database schema"""
    print("\n📋 DATABASE SCHEMA:")
    print("=" * 50)
    
    tables = [
        "profiles",
        "battles", 
        "votes",
        "user_follows",
        "chat_rooms",
        "chat_messages",
        "notifications"
    ]
    
    for table in tables:
        try:
            # Get table info by selecting one row
            response = supabase.table(table).select("*").limit(1).execute()
            if response.data:
                columns = list(response.data[0].keys())
                print(f"\n{table.upper()}:")
                for col in columns:
                    print(f"  - {col}")
            else:
                print(f"\n{table.upper()}: (empty table)")
        except Exception as e:
            print(f"\n{table.upper()}: Error - {e}")

if __name__ == "__main__":
    print("🚀 DaddyBaddy Database Test")
    print("=" * 50)
    
    # Test connection
    if test_database_connection():
        # Show schema
        show_database_schema()
        
        print("\n🎉 Database test completed successfully!")
        print("\nTo update your database schema, run the SQL script:")
        print("supabase_updated_schema.sql")
    else:
        print("\n❌ Database test failed!")
        sys.exit(1)
