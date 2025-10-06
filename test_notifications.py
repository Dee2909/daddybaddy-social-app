#!/usr/bin/env python3
"""
Test script to verify notifications endpoint
"""
import requests
import json

# Test the notifications endpoint
def test_notifications():
    base_url = "http://localhost:8001"
    
    # Test without authentication (should return 401)
    print("Testing notifications endpoint without authentication...")
    try:
        response = requests.get(f"{base_url}/api/notifications")
        print(f"Status: {response.status_code}")
        if response.status_code == 401:
            print("✅ Correctly returns 401 for unauthenticated request")
        else:
            print(f"❌ Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test with invalid token (should return 401)
    print("\nTesting notifications endpoint with invalid token...")
    try:
        headers = {"Authorization": "Bearer invalid_token"}
        response = requests.get(f"{base_url}/api/notifications", headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 401:
            print("✅ Correctly returns 401 for invalid token")
        else:
            print(f"❌ Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test health endpoint (should work)
    print("\nTesting health endpoint...")
    try:
        response = requests.get(f"{base_url}/api/health")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Health endpoint working")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ Health endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_notifications()

