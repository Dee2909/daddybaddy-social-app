from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, validator, root_validator
from typing import List, Optional, Dict, Any, Set
import os
import logging
import json
import asyncio
import hashlib
import secrets
import re
from datetime import datetime, timedelta, date, timezone
from pathlib import Path
from supabase import create_client, Client
import uuid
from twilio.rest import Client as TwilioClient
import random

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Supabase client initialization
supabase_url = os.getenv("SUPABASE_URL")
supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(supabase_url, supabase_anon_key)
supabase_admin: Client = create_client(supabase_url, supabase_service_key)

# Twilio configuration
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")

# Initialize Twilio client
twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN else None

# In-memory OTP storage (in production, use Redis or database)
otp_storage = {}

# FastAPI app setup
app = FastAPI(title="DaddyBaddy API", version="1.0.0")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== Notification helper ====================
def notify_user(user_id: str, title: str, message: str = "", ntype: str = "user", reference_id: Optional[str] = None):
    try:
        record = {
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": ntype,
            "reference_id": reference_id,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        supabase.table("notifications").insert(record).execute()
    except Exception as e:
        logger.warning(f"notify_user failed: {e}")

def tag_from_user(u: Any) -> str:
    try:
        return f"@{(u.get('id') if isinstance(u, dict) else u.id)}"
    except Exception:
        return "@unknown"

DM_NAME_PREFIX = "dm:"


def _canonical_dm_name(user_a: str, user_b: str) -> str:
    participants = sorted([user_a, user_b])
    return f"{DM_NAME_PREFIX}{participants[0]}:{participants[1]}"


def _parse_dm_metadata(raw: Optional[str]) -> dict:
    if not raw:
        return {}
    try:
        if isinstance(raw, str):
            return json.loads(raw)
        return raw or {}
    except Exception:
        return {}


def _ensure_dm_metadata(chat: dict, user_a: str, user_b: str) -> dict:
    metadata = _parse_dm_metadata(chat.get("description"))
    participants = metadata.get("participants")
    if not participants or not isinstance(participants, list):
        participants = sorted({user_a, user_b})
        metadata["participants"] = participants
    return metadata

# Connection manager for WebSocket
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, set] = {}
        self.user_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, battle_id: str, user_id: str):
        await websocket.accept()
        if battle_id not in self.active_connections:
            self.active_connections[battle_id] = set()
        self.active_connections[battle_id].add(websocket)
        self.user_connections[f"{battle_id}:{user_id}"] = websocket
        logger.info(f"User {user_id} connected to battle {battle_id}")

    def disconnect(self, websocket: WebSocket, battle_id: str, user_id: str):
        if battle_id in self.active_connections:
            self.active_connections[battle_id].discard(websocket)
            if not self.active_connections[battle_id]:
                del self.active_connections[battle_id]
        self.user_connections.pop(f"{battle_id}:{user_id}", None)
        logger.info(f"User {user_id} disconnected from battle {battle_id}")

    async def broadcast_to_battle(self, battle_id: str, message: dict):
        if battle_id not in self.active_connections:
            return
        
        message_str = json.dumps(message)
        disconnected = []
        
        for connection in self.active_connections[battle_id]:
            try:
                await connection.send_text(message_str)
            except:
                disconnected.append(connection)
        
        # Clean up disconnected connections
        for connection in disconnected:
            self.active_connections[battle_id].discard(connection)

manager = ConnectionManager()

# Pydantic models
class UserProfile(BaseModel):
    id: str
    email: Optional[str] = None
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    created_at: datetime

class LoginRequest(BaseModel):
    username: Optional[str] = None
    phone: Optional[str] = None
    password: str

    @root_validator(skip_on_failure=True)
    def validate_identifier(cls, values):
        username = (values.get('username') or '').strip()
        phone = (values.get('phone') or '').strip()
        if not username and not phone:
            raise ValueError('username or phone is required')
        values['username'] = username or None
        values['phone'] = phone or None
        return values

class RegisterRequest(BaseModel):
    firstName: str
    lastName: str
    phone: str
    dateOfBirth: str
    username: str
    password: str
    confirmPassword: str
    fullName: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None

    @validator('dateOfBirth')
    def validate_age(cls, v):
        birth_date = datetime.strptime(v, '%Y-%m-%d').date()
        today = date.today()
        age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        if age < 18:
            raise ValueError('You must be at least 18 years old')
        return v

    @validator('confirmPassword')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError('Passwords do not match')
        return v

class ForgotPasswordRequest(BaseModel):
    phone: str

class ResetPasswordRequest(BaseModel):
    phone: str
    token: str
    new_password: str

class OTPVerificationRequest(BaseModel):
    phone: str
    token: str

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserProfile
    expires_in: int

class Battle(BaseModel):
    id: str
    creator_id: str
    title: str
    description: Optional[str] = None
    option_a: str
    option_b: str
    image_a_url: Optional[str] = None
    image_b_url: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    end_time: Optional[datetime] = None

class CreateBattleRequest(BaseModel):
    title: str
    description: Optional[str] = None
    option_a: str
    option_b: str
    duration_hours: Optional[int] = 24

    @validator('title')
    def validate_title(cls, v):
        if len(v.strip()) < 3:
            raise ValueError('Title must be at least 3 characters long')
        return v.strip()

class VoteRequest(BaseModel):
    choice: str
    
    @validator('choice')
    def validate_choice(cls, v):
        if v not in ['A', 'B']:
            raise ValueError('Choice must be A or B')
        return v

class VoteResponse(BaseModel):
    battle_id: str
    choice: str
    user_id: str
    created_at: datetime

class BattleResultsResponse(BaseModel):
    battle_id: str
    total_votes: int
    option_a_votes: int
    option_b_votes: int
    option_a_percentage: float
    option_b_percentage: float

class DirectChatRequest(BaseModel):
    recipient_id: str

class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    avatar_url: Optional[str] = None

class PrivateCommentCreate(BaseModel):
    content: str
    reactions: Optional[List[str]] = None

    @validator('content')
    def validate_content(cls, v):
        v = (v or '').strip()
        if len(v) == 0:
            raise ValueError('Content cannot be empty')
        if len(v) > 280:
            raise ValueError('Content exceeds 280 characters')
        return v

class UserBattleCreate(BaseModel):
    title: str
    description: Optional[str] = None
    mode: str  # '1v1' | 'multi'
    invited_user_ids: List[str]
    visibility: Optional[str] = 'public'
    tags: Optional[List[str]] = None

    @validator('mode')
    def validate_mode(cls, v):
        if v not in ['1v1', 'multi']:
            raise ValueError('mode must be 1v1 or multi')
        return v
    
    @validator('invited_user_ids')
    def validate_invites(cls, v, values):
        if values.get('mode') == '1v1':
            if len(v) != 1:
                raise ValueError('1v1 battles require exactly one invited user')
        else:
            if len(v) < 2 or len(v) > 3:
                # multi = 2–4 total including creator, so invites 1–3; we enforce 2–3 invites to ensure >=2 acceptances potential
                pass
        return v

# Helper functions
def hash_password(password: str) -> str:
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed

def generate_jwt_token(user_id: str) -> dict:
    """Generate JWT tokens using proper JWT structure"""
    import jwt
    from datetime import datetime, timedelta, timezone
    
    # JWT secret key (in production, use environment variable)
    secret_key = "your-secret-key-change-in-production"
    
    # Token expiration times
    access_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    refresh_expires = datetime.now(timezone.utc) + timedelta(days=7)
    
    # Create payload
    access_payload = {
        "user_id": user_id,
        "type": "access",
        "exp": access_expires,
        "iat": datetime.now(timezone.utc)
    }
    
    refresh_payload = {
        "user_id": user_id,
        "type": "refresh", 
        "exp": refresh_expires,
        "iat": datetime.now(timezone.utc)
    }
    
    # Generate tokens
    access_token = jwt.encode(access_payload, secret_key, algorithm="HS256")
    refresh_token = jwt.encode(refresh_payload, secret_key, algorithm="HS256")
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": 3600  # 1 hour
    }

# Authentication functions
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Verify JWT token
        import jwt
        secret_key = "your-secret-key-change-in-production"
        
        payload = jwt.decode(credentials.credentials, secret_key, algorithms=["HS256"])
        user_id = payload.get("user_id")
        
        if not user_id:
            raise credentials_exception
            
        # Get user profile
        profile_response = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
        if profile_response.data:
            return profile_response.data
        else:
            raise credentials_exception
            
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise credentials_exception
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise credentials_exception

# API Routes
@api_router.get("/")
async def root():
    return {"message": "DaddyBaddy API is running!", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc)}

# Authentication endpoints
@api_router.post("/auth/register")
async def register(request: RegisterRequest):
    try:
        # Format phone number
        phone = request.phone.strip()
        if not phone.startswith('+'):
            phone = '+1' + re.sub(r'\D', '', request.phone)
        
        # Check if username is unique
        existing_user = supabase.table("profiles").select("id").eq("username", request.username).execute()
        if existing_user.data:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        # Check if phone is unique
        existing_phone = supabase.table("profiles").select("id").eq("phone", phone).execute()
        if existing_phone.data:
            raise HTTPException(status_code=400, detail="Phone number already registered")
        
        # Create user in Supabase Auth (this will trigger the profile creation)
        auth_response = supabase.auth.sign_up({
            "phone": phone,
            "password": request.password,
            "options": {
                "data": {
                    "username": request.username,
                    "full_name": request.fullName or f"{request.firstName} {request.lastName}",
                    "bio": request.bio,
                    "location": request.location,
                    "website": request.website
                }
            }
        })
        
        if auth_response.user:
            # Update profile with additional info
            profile_data = {
                "id": auth_response.user.id,
                "username": request.username,
                "full_name": request.fullName or f"{request.firstName} {request.lastName}",
                "phone": phone,
                "bio": request.bio,
                "location": request.location,
                "website": request.website,
                "password_hash": hash_password(request.password),  # Store for custom auth
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            supabase.table("profiles").upsert(profile_data).execute()
            
            return {"message": "Registration successful", "user_id": auth_response.user.id}
        else:
            raise HTTPException(status_code=400, detail="Registration failed")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    try:
        # Find user in database using provided identifier
        query = (
            supabase
            .table("profiles")
            .select("*")
        )

        if request.phone:
            query = query.eq("phone", request.phone)
        elif request.username:
            query = query.eq("username", request.username)
        else:
            raise HTTPException(status_code=400, detail="Username or phone required")

        profile_response = query.maybe_single().execute()
        
        if not profile_response.data:
            raise HTTPException(status_code=401, detail="User not found")
        
        profile = profile_response.data
        
        # Verify password
        if not verify_password(request.password, profile.get('password_hash', '')):
            raise HTTPException(status_code=401, detail="Invalid password")
        
        # Generate tokens
        tokens = generate_jwt_token(profile['id'])
        
        # Create user profile
        user_profile = UserProfile(**profile)
        
        return AuthResponse(
            access_token=tokens['access_token'],
            refresh_token=tokens['refresh_token'],
            user=user_profile,
            expires_in=3600
        )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    try:
        # Send OTP via Supabase
        response = supabase.auth.reset_password_for_phone(request.phone)
        
        return {"message": "Reset code sent to your phone"}
        
    except Exception as e:
        logger.error(f"Forgot password error: {e}")
        raise HTTPException(status_code=400, detail="Failed to send reset code")

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    try:
        # Verify OTP and update password
        response = supabase.auth.verify_otp({
            "phone": request.phone,
            "token": request.token,
            "type": "phone_change"
        })
        
        if response.user:
            # Update password hash in profiles table
            password_hash = hash_password(request.new_password)
            supabase.table("profiles").update({
                "password_hash": password_hash,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("phone", request.phone).execute()
            
            return {"message": "Password reset successfully"}
        else:
            raise HTTPException(status_code=400, detail="Invalid reset code")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset password error: {e}")
        raise HTTPException(status_code=400, detail="Password reset failed")

# Twilio OTP endpoints
@api_router.post("/auth/send-otp")
async def send_otp(request: ForgotPasswordRequest):
    """Send OTP using Twilio directly"""
    try:
        if not twilio_client:
            raise HTTPException(status_code=500, detail="Twilio not configured")
        
        # Generate 6-digit OTP
        otp = str(random.randint(100000, 999999))
        
        # Store OTP with expiration (5 minutes)
        otp_storage[request.phone] = {
            "otp": otp,
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
            "attempts": 0
        }
        
        # Send SMS via Twilio
        message = twilio_client.messages.create(
            body=f"Your DaddyBaddy verification code is: {otp}. This code expires in 5 minutes.",
            from_=TWILIO_PHONE_NUMBER,
            to=request.phone
        )
        
        logger.info(f"OTP for {request.phone}: {otp}")
        return {"message": "OTP sent successfully", "message_id": message.sid}
        
    except Exception as e:
        logger.error(f"Send OTP error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send OTP: {str(e)}")

@api_router.post("/auth/verify-otp")
async def verify_otp(request: OTPVerificationRequest):
    """Verify OTP sent via Twilio"""
    try:
        if request.phone not in otp_storage:
            raise HTTPException(status_code=400, detail="OTP not found or expired")
        
        stored_otp_data = otp_storage[request.phone]
        
        # Check if OTP has expired
        if datetime.now(timezone.utc) > stored_otp_data["expires_at"]:
            del otp_storage[request.phone]
            raise HTTPException(status_code=400, detail="OTP expired")
        
        # Check attempt limit
        if stored_otp_data["attempts"] >= 3:
            del otp_storage[request.phone]
            raise HTTPException(status_code=400, detail="Too many attempts")
        
        # Verify OTP
        if stored_otp_data["otp"] != request.token:
            stored_otp_data["attempts"] += 1
            raise HTTPException(status_code=400, detail="Invalid OTP")
        
        # OTP is valid, mark phone as verified but keep OTP for registration
        stored_otp_data["verified"] = True
        stored_otp_data["verified_at"] = datetime.now(timezone.utc)
        
        return {"message": "OTP verified successfully", "verified": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verify OTP error: {e}")
        raise HTTPException(status_code=400, detail="OTP verification failed")

@api_router.post("/auth/register-with-otp")
async def register_with_otp(request: RegisterRequest):
    """Register user after OTP verification"""
    try:
        # Check if phone was verified via OTP
        if request.phone not in otp_storage:
            raise HTTPException(status_code=400, detail="Phone not verified. Please verify OTP first.")
        
        stored_otp_data = otp_storage[request.phone]
        
        # Check if OTP was verified
        if not stored_otp_data.get("verified", False):
            raise HTTPException(status_code=400, detail="Phone not verified. Please verify OTP first.")
        
        # Check if verification is still valid (within 10 minutes)
        if datetime.now(timezone.utc) > stored_otp_data["verified_at"] + timedelta(minutes=10):
            del otp_storage[request.phone]
            raise HTTPException(status_code=400, detail="OTP verification expired. Please verify again.")
        
        # Check if user already exists
        existing_user = supabase.table("profiles").select("id").eq("phone", request.phone).execute()
        if existing_user.data:
            del otp_storage[request.phone]
            raise HTTPException(status_code=400, detail="User already exists with this phone number")
        
        # Generate a unique user ID
        user_id = str(uuid.uuid4())
        
        # Create profile in database with full schema
        profile_data = {
            "id": user_id,
            "username": request.username,
            "phone": request.phone,
            "full_name": request.fullName,
            "password_hash": hash_password(request.password),
            "verified": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Add optional fields
        if hasattr(request, 'email') and request.email:
            profile_data["email"] = request.email
        if hasattr(request, 'bio') and request.bio:
            profile_data["bio"] = request.bio
        if hasattr(request, 'location') and request.location:
            profile_data["location"] = request.location
        if hasattr(request, 'website') and request.website:
            profile_data["website"] = request.website
        
        profile_response = supabase.table("profiles").insert(profile_data).execute()
        
        if not profile_response.data:
            raise HTTPException(status_code=500, detail="Failed to create user profile")
        
        # Clean up OTP storage
        del otp_storage[request.phone]
        
        return {
            "message": "User registered successfully",
            "user": {
                "id": user_id,
                "username": request.username,
                "phone": request.phone,
                "full_name": request.fullName
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Register with OTP error: {e}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

# Battle endpoints (legacy reference kept under -legacy paths to avoid conflicts)
@api_router.post("/battles-legacy", response_model=Battle)
async def create_battle(
    battle_data: CreateBattleRequest,
    current_user: UserProfile = Depends(get_current_user)
):
    try:
        end_time = datetime.now(timezone.utc) + timedelta(hours=battle_data.duration_hours) if battle_data.duration_hours else None
        
        battle_record = {
            "id": str(uuid.uuid4()),
            "creator_id": current_user.id,
            "title": battle_data.title,
            "description": battle_data.description,
            "option_a": battle_data.option_a,
            "option_b": battle_data.option_b,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "end_time": end_time.isoformat() if end_time else None
        }
        
        response = supabase.table("battles").insert(battle_record).execute()
        
        if response.data:
            return Battle(**response.data[0])
        else:
            raise HTTPException(status_code=400, detail="Failed to create battle")
            
    except Exception as e:
        logger.error(f"Error creating battle: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/battles-legacy", response_model=List[Battle])
async def get_battles(skip: int = 0, limit: int = 20):
    try:
        response = supabase.table("battles").select("*").eq("is_active", True).order("created_at", desc=True).range(skip, skip + limit - 1).execute()
        
        return [Battle(**battle) for battle in response.data]
        
    except Exception as e:
        logger.error(f"Error fetching battles: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/battles-legacy/{battle_id}", response_model=Battle)
async def get_battle(battle_id: str):
    try:
        response = supabase.table("battles").select("*").eq("id", battle_id).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Battle not found")
            
        return Battle(**response.data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching battle: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/battles-legacy/{battle_id}/vote", response_model=VoteResponse)
async def vote_on_battle(
    battle_id: str,
    vote_data: VoteRequest,
    current_user: UserProfile = Depends(get_current_user)
):
    try:
        # Check if battle exists and is active
        battle_response = supabase.table("battles").select("*").eq("id", battle_id).eq("is_active", True).single().execute()
        
        if not battle_response.data:
            raise HTTPException(status_code=404, detail="Battle not found or inactive")
        
        battle = battle_response.data
        
        # Check if battle has ended
        if battle.get("end_time"):
            end_time = datetime.fromisoformat(battle["end_time"].replace('Z', '+00:00'))
            if datetime.now(timezone.utc) > end_time.replace(tzinfo=None):
                raise HTTPException(status_code=400, detail="Battle has ended")
        
        # Create or update vote
        vote_record = {
            "battle_id": battle_id,
            "user_id": current_user.id,
            "choice": vote_data.choice,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Use upsert to handle vote changes
        response = supabase.table("votes").upsert(vote_record).execute()
        
        if response.data:
            vote_response = VoteResponse(**response.data[0])
            
            # Get updated results and broadcast to connected users
            results = await get_battle_results_internal(battle_id)
            await manager.broadcast_to_battle(battle_id, {
                "type": "vote_update",
                "data": {
                    "battle_id": battle_id,
                    "results": results,
                    "latest_vote": {
                        "user_id": current_user.id,
                        "choice": vote_data.choice
                    }
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
            return vote_response
        else:
            raise HTTPException(status_code=400, detail="Failed to record vote")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording vote: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/battles/{battle_id}/results", response_model=BattleResultsResponse)
async def get_battle_results(battle_id: str):
    return await get_battle_results_internal(battle_id)

async def get_battle_results_internal(battle_id: str) -> BattleResultsResponse:
    try:
        # Get all votes for the battle
        votes_response = supabase.table("votes").select("choice").eq("battle_id", battle_id).execute()
        
        votes = votes_response.data
        total_votes = len(votes)
        option_a_votes = len([v for v in votes if v["choice"] == "A"])
        option_b_votes = len([v for v in votes if v["choice"] == "B"])
        
        option_a_percentage = (option_a_votes / total_votes * 100) if total_votes > 0 else 0
        option_b_percentage = (option_b_votes / total_votes * 100) if total_votes > 0 else 0
        
        return BattleResultsResponse(
            battle_id=battle_id,
            total_votes=total_votes,
            option_a_votes=option_a_votes,
            option_b_votes=option_b_votes,
            option_a_percentage=round(option_a_percentage, 1),
            option_b_percentage=round(option_b_percentage, 1)
        )
        
    except Exception as e:
        logger.error(f"Error getting battle results: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket endpoint for real-time battle updates
@api_router.websocket("/ws/battles/{battle_id}")
async def websocket_endpoint(websocket: WebSocket, battle_id: str):
    # Simple auth check - in production, implement proper WebSocket auth
    user_id = "anonymous"  # Replace with proper user identification
    
    await manager.connect(websocket, battle_id, user_id)
    
    try:
        # Send current battle state
        results = await get_battle_results_internal(battle_id)
        await websocket.send_text(json.dumps({
            "type": "battle_state",
            "data": results.dict(),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }))
        
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, battle_id, user_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, battle_id, user_id)

# User profile endpoints
@api_router.get("/profile", response_model=UserProfile)
async def get_profile(current_user: UserProfile = Depends(get_current_user)):
    return current_user

# ==================== PRIVATE BATTLE COMMENTS ====================

@api_router.post("/battles/{battle_id}/private-comments")
async def send_private_comment(battle_id: str, payload: PrivateCommentCreate, current_user: dict = Depends(get_current_user)):
    """Send a private comment to the battle creator. Max 5 per user per 24h."""
    try:
        # Get battle to identify creator
        battle_resp = supabase.table("battles").select("creator_id").eq("id", battle_id).single().execute()
        if not battle_resp.data:
            raise HTTPException(status_code=404, detail="Battle not found")
        creator_id = battle_resp.data.get("creator_id")
        if not creator_id:
            raise HTTPException(status_code=400, detail="Battle has no creator")

        # Rate limit: 5 comments / 24h per user per battle
        since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        try:
            recent = supabase.table("private_battle_comments").select("id", count="exact").eq("battle_id", battle_id).eq("author_id", current_user["id"]).gte("created_at", since).execute()
            # Some drivers return count on the result; default 0
            rate_count = getattr(recent, 'count', None)
            if rate_count is None:
                rate_count = len(recent.data or [])
            if rate_count >= 5:
                raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")
        except HTTPException:
            raise
        except Exception:
            # If counting not supported, allow but proceed
            pass

        record = {
            "battle_id": battle_id,
            "author_id": current_user["id"],
            "creator_id": creator_id,
            "content": payload.content,
            "reactions": payload.reactions or [],
            "is_read": False,
            "is_reported": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        try:
            resp = supabase.table("private_battle_comments").insert(record).execute()
        except Exception as e:
            # Likely missing table; guide caller gracefully
            logger.error(f"Private comment insert failed: {e}")
            raise HTTPException(status_code=500, detail="Private comments not enabled. Apply DB migration.")

        # Notify creator if notifications table exists
        try:
            supabase.table("notifications").insert({
                "user_id": creator_id,
                "title": "Private comment on your battle",
                "message": payload.content[:140],
                "type": "private_comment",
                "reference_id": battle_id,
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }).execute()
        except Exception:
            pass

        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending private comment: {e}")
        raise HTTPException(status_code=500, detail="Failed to send private comment")

@api_router.get("/battles/{battle_id}/private-comments")
async def list_private_comments(battle_id: str, filter: str = "all", current_user: dict = Depends(get_current_user)):
    """List private comments for a battle (creator only). filter=all|unread|reported"""
    try:
        battle_resp = supabase.table("battles").select("creator_id").eq("id", battle_id).single().execute()
        if not battle_resp.data:
            raise HTTPException(status_code=404, detail="Battle not found")
        if battle_resp.data.get("creator_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not allowed")
        query = supabase.table("private_battle_comments").select("*").eq("battle_id", battle_id).order("created_at", desc=True)
        if filter == "unread":
            query = query.eq("is_read", False)
        elif filter == "reported":
            query = query.eq("is_reported", True)
        resp = query.execute()
        return {"comments": resp.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing private comments: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch comments")

@api_router.post("/private-comments/{comment_id}/mark-read")
async def mark_private_comment_read(comment_id: str, current_user: dict = Depends(get_current_user)):
    try:
        # Ensure current user owns the comment (as creator)
        resp = supabase.table("private_battle_comments").select("*").eq("id", comment_id).single().execute()
        data = resp.data
        if not data:
            raise HTTPException(status_code=404, detail="Not found")
        battle = supabase.table("battles").select("creator_id").eq("id", data["battle_id"]).single().execute()
        if battle.data.get("creator_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not allowed")
        supabase.table("private_battle_comments").update({"is_read": True}).eq("id", comment_id).execute()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking read: {e}")
        raise HTTPException(status_code=500, detail="Failed to update comment")

@api_router.post("/private-comments/{comment_id}/report")
async def report_private_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
    try:
        # Creator or any authenticated user can report
        supabase.table("private_battle_comments").update({"is_reported": True}).eq("id", comment_id).execute()
        return {"success": True}
    except Exception as e:
        logger.error(f"Error reporting comment: {e}")
        raise HTTPException(status_code=500, detail="Failed to report comment")

@api_router.delete("/private-comments/{comment_id}")
async def delete_private_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
    try:
        # Only battle creator may delete
        resp = supabase.table("private_battle_comments").select("*").eq("id", comment_id).single().execute()
        data = resp.data
        if not data:
            raise HTTPException(status_code=404, detail="Not found")
        battle = supabase.table("battles").select("creator_id").eq("id", data["battle_id"]).single().execute()
        if battle.data.get("creator_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not allowed")
        supabase.table("private_battle_comments").delete().eq("id", comment_id).execute()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting comment: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete comment")

@api_router.put("/profile")
async def update_profile(update: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    try:
        data = {}
        for field in ["username", "full_name", "bio", "location", "website", "avatar_url"]:
            value = getattr(update, field)
            if value is not None:
                data[field] = value
        if not data:
            return {"message": "No changes"}
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        supabase.table("profiles").update(data).eq("id", current_user["id"]).execute()
        # Return updated profile
        resp = supabase.table("profiles").select("*").eq("id", current_user["id"]).single().execute()
        return {"profile": resp.data}
    except Exception as e:
        logger.error(f"Error updating profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# ==================== BATTLE ENDPOINTS ====================

@api_router.get("/battles")
async def get_battles(skip: int = 0, limit: int = 20, status: str = None):
    """Get battles with pagination and filtering. Falls back if 'status' column doesn't exist."""
    try:
        # Preferred shape with rich relations (if available)
        query = supabase.table("battles").select("*")
        # Try status if provided; some schemas may not have this column
        if status:
            try:
                query = query.eq("status", status)
            except Exception:
                # Ignore filter if unsupported
                pass
        query = query.order("created_at", desc=True).range(skip, skip + limit - 1)
        response = query.execute()
        return {"battles": response.data, "has_more": len(response.data) == limit}
    except Exception as e:
        logger.error(f"Error fetching battles: {e}")
        # Fallback to is_active-based filtering if supported
        try:
            response = (
                supabase
                .table("battles")
                .select("*")
                .eq("is_active", True)
                .order("created_at", desc=True)
                .range(skip, skip + limit - 1)
                .execute()
            )
            return {"battles": response.data, "has_more": len(response.data) == limit}
        except Exception as e2:
            logger.error(f"Battles fallback failed: {e2}")
            raise HTTPException(status_code=500, detail="Failed to fetch battles")

@api_router.post("/battles")
async def create_battle(request: Request, current_user: dict = Depends(get_current_user)):
    """Create a new battle from flexible payload posted by the client."""
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            battle_data = await request.json()
        except Exception:
            battle_data = {}
        media_urls = (battle_data.get("media_urls") or []) if isinstance(battle_data, dict) else []
        # Map flexible payload to minimal schema columns
        record = {
            "id": str(uuid.uuid4()),
            "creator_id": current_user["id"],
            "title": (battle_data.get("title") or "Untitled Battle").strip(),
            "description": battle_data.get("description"),
            "option_a": battle_data.get("option_a") or "Option A",
            "option_b": battle_data.get("option_b") or "Option B",
            "image_a_url": media_urls[0] if len(media_urls) > 0 else None,
            "image_b_url": media_urls[1] if len(media_urls) > 1 else None,
            "is_active": True,
            "created_at": now_iso
        }
        response = supabase.table("battles").insert(record).execute()
        return {"battle": response.data[0]}
    except Exception as e:
        logger.error(f"Error creating battle: {e}")
        raise HTTPException(status_code=500, detail="Failed to create battle")

# ============= User Battle Flow (Invites/Acceptance) =============

@api_router.post("/battles/user")
async def create_user_battle(payload: UserBattleCreate, current_user: dict = Depends(get_current_user)):
    """Create a user battle in INVITED state and notify invitees. Accept window = now + 2h."""
    try:
        now = datetime.now(timezone.utc)
        record = {
            "id": str(uuid.uuid4()),
            "creator_id": current_user["id"],
            "title": payload.title,
            "description": payload.description,
            # satisfy NOT NULL constraints in existing schema
            "option_a": "Option A",
            "option_b": "Option B",
            "type": "USER",
            "mode": payload.mode,
            "status": "INVITED",
            "accept_deadline": (now + timedelta(hours=2)).isoformat(),
            "participant_ids": [current_user["id"]],
            "invited_user_ids": payload.invited_user_ids,
            "accepted_user_ids": [],
            "is_active": True,
            "created_at": now.isoformat()
        }
        try:
            resp = supabase_admin.table("battles").insert(record).execute()
        except Exception as e:
            logger.error(f"User battle insert failed: {e}")
            raise HTTPException(status_code=500, detail="User battle flow not enabled. Run DB migration.")

        # Notify invitees
        creator_name = tag_from_user(current_user)
        for uid in payload.invited_user_ids:
            notify_user(uid, f"{creator_name} challenged you.", "Accept within 2 hours to join.", ntype="challenge_sent", reference_id=record["id"]) 
        return {"battle": resp.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user battle: {e}")
        raise HTTPException(status_code=500, detail="Failed to create user battle")

def _load_acceptance_lists(battle_id: str):
    b = supabase.table("battles").select("creator_id, mode, status, accept_deadline, invited_user_ids, accepted_user_ids").eq("id", battle_id).single().execute()
    if not b.data:
        raise HTTPException(status_code=404, detail="Battle not found")
    data = b.data
    return data

def _threshold_met(mode: str, accepted_count: int) -> bool:
    return (mode == '1v1' and accepted_count >= 1) or (mode == 'multi' and accepted_count >= 2)

@api_router.post("/battles/{battle_id}/accept")
async def accept_battle(battle_id: str, current_user: dict = Depends(get_current_user)):
    try:
        data = _load_acceptance_lists(battle_id)
        # deadline check
        if data.get("accept_deadline"):
            if datetime.now(timezone.utc) > datetime.fromisoformat(data["accept_deadline"].replace('Z','+00:00')):
                supabase.table("battles").update({"status": "CANCELLED"}).eq("id", battle_id).execute()
                notify_user(data["creator_id"], "Battle cancelled.", "Acceptance requirement not met in 2 hours.", ntype="battle_result", reference_id=battle_id)
                raise HTTPException(status_code=400, detail="Acceptance window expired")
        invited = set((data.get("invited_user_ids") or []))
        accepted = set((data.get("accepted_user_ids") or []))
        uid = current_user["id"]
        if uid not in invited:
            raise HTTPException(status_code=403, detail="Not invited")
        if uid in accepted:
            return {"accepted": True}
        accepted.add(uid)
        supabase_admin.table("battles").update({"accepted_user_ids": list(accepted), "status": "INVITED"}).eq("id", battle_id).execute()

        # Notify creator and accepted participants
        accepter = tag_from_user(current_user)
        notify_user(data["creator_id"], f"{accepter} accepted your battle.", "Upload your photo to start.", ntype="challenge_accepted", reference_id=battle_id)
        for aid in accepted:
            if aid != data["creator_id"] and aid != uid:
                notify_user(aid, f"{accepter} joined the battle.", "Upload your photo to start.", ntype="challenge_accepted", reference_id=battle_id)

        # Threshold check
        if _threshold_met(data.get("mode"), len(accepted)):
            supabase_admin.table("battles").update({"status": "UPLOADING"}).eq("id", battle_id).execute()
            # Inform participants to upload
            participants = list(accepted) + [data["creator_id"]]
            for pid in participants:
                notify_user(pid, "Battle is ready to upload.", "Upload your image to begin.", ntype="battle_started", reference_id=battle_id)
        return {"accepted": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error accepting battle: {e}")
        raise HTTPException(status_code=500, detail="Failed to accept battle")

@api_router.post("/battles/{battle_id}/decline")
async def decline_battle(battle_id: str, current_user: dict = Depends(get_current_user)):
    try:
        data = _load_acceptance_lists(battle_id)
        invited = set((data.get("invited_user_ids") or []))
        if current_user["id"] not in invited:
            raise HTTPException(status_code=403, detail="Not invited")
        # No DB change needed for decline in MVP
        return {"declined": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error declining battle: {e}")
        raise HTTPException(status_code=500, detail="Failed to decline battle")

@api_router.post("/battles/{battle_id}/upload")
async def upload_battle_submission(battle_id: str, payload: dict, current_user: dict = Depends(get_current_user)):
    """Upload media for a battle (creator or accepted participants only). Starts battle when all required uploads present."""
    try:
        data = _load_acceptance_lists(battle_id)
        creator_id = data["creator_id"]
        accepted = set((data.get("accepted_user_ids") or []))
        uid = current_user["id"]
        if uid != creator_id and uid not in accepted:
            raise HTTPException(status_code=403, detail="Not allowed to upload")
        media_url = payload.get("media_url")
        if not media_url:
            raise HTTPException(status_code=400, detail="media_url required")
        supabase_admin.table("battle_submissions").upsert({
            "battle_id": battle_id,
            "user_id": uid,
            "media_url": media_url,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        
        # Check if all required uploads present
        required = len(accepted) + 1  # creator + accepted
        subs = supabase.table("battle_submissions").select("id,user_id").eq("battle_id", battle_id).execute()
        unique_uploaders = len({s.get('user_id') for s in (subs.data or [])})
        if unique_uploaders >= required:
            # Start battle
            supabase_admin.table("battles").update({
                "status": "LIVE",
                "start_time": datetime.now(timezone.utc).isoformat(),
                "end_time": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
            }).eq("id", battle_id).execute()
            for pid in list(accepted) + [creator_id]:
                notify_user(pid, "Battle is LIVE for 24 hours.", "Share to get votes!", ntype="battle_started", reference_id=battle_id)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading submission: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload")

def _user_can_view_battle(battle: dict, user_id: str) -> bool:
    """Allow viewing live battles for everyone; restrict draft states to involved users."""
    status = (battle.get("status") or "").upper()
    if status in {"LIVE", "ENDED"}:
        return True

    allowed_ids = {battle.get("creator_id")}
    for key in ("participant_ids", "invited_user_ids", "accepted_user_ids"):
        ids = battle.get(key) or []
        if isinstance(ids, list):
            allowed_ids.update(i for i in ids if i)

    return user_id in allowed_ids


@api_router.get("/battles/{battle_id}")
async def get_battle(battle_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific battle by ID"""
    try:
        response = supabase_admin.table("battles").select("""
            *,
            creator:profiles!battles_creator_id_fkey(*),
            participants:profiles!battle_participants(*),
            votes:votes(*)
        """).eq("id", battle_id).single().execute()

        battle = response.data
        if not battle:
            raise HTTPException(status_code=404, detail="Battle not found")

        user_id = current_user.get("id")
        if not user_id or not _user_can_view_battle(battle, user_id):
            raise HTTPException(status_code=403, detail="Not authorized to view this battle")

        return {"battle": battle}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching battle: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch battle")

@api_router.post("/battles/{battle_id}/vote")
async def vote_battle(battle_id: str, vote_data: dict, current_user: dict = Depends(get_current_user)):
    """Vote on a battle"""
    try:
        # Check if user already voted
        existing_vote = supabase.table("votes").select("*").eq("battle_id", battle_id).eq("user_id", current_user["id"]).execute()
        
        if existing_vote.data:
            raise HTTPException(status_code=400, detail="User has already voted on this battle")
        
        # Create vote
        vote_data.update({
            "battle_id": battle_id,
            "user_id": current_user["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        response = supabase.table("votes").insert(vote_data).execute()
        
        # Update battle vote counts
        battle = supabase.table("battles").select("vote_counts").eq("id", battle_id).single().execute()
        current_counts = battle.data.get("vote_counts", {})
        choice = vote_data["choice"]
        current_counts[choice] = current_counts.get(choice, 0) + 1
        
        supabase.table("battles").update({"vote_counts": current_counts}).eq("id", battle_id).execute()
        # Notify creator of a new vote (best-effort)
        try:
            battle_info = supabase.table("battles").select("creator_id").eq("id", battle_id).single().execute()
            creator_id = battle_info.data.get("creator_id") if battle_info.data else None
            if creator_id and creator_id != current_user["id"]:
                voter = tag_from_user(current_user)
                notify_user(creator_id, f"{voter} voted in your battle.", ntype="vote", reference_id=battle_id)
        except Exception:
            pass

        return {"vote": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error voting on battle: {e}")
        raise HTTPException(status_code=500, detail="Failed to vote on battle")

# ==================== POST ENDPOINTS ====================

@api_router.get("/posts")
async def get_posts(skip: int = 0, limit: int = 20):
    """Get posts with pagination"""
    try:
        response = supabase.table("posts").select("""
            *,
            author:profiles!posts_author_id_fkey(*),
            likes:likes(*),
            comments:comments(*)
        """).order("created_at", desc=True).range(skip, skip + limit - 1).execute()
        
        return {"posts": response.data, "has_more": len(response.data) == limit}
    except Exception as e:
        # Graceful fallback if posts table or relations don't exist yet
        err_text = str(e)
        if "Could not find the table 'public.posts'" in err_text or "PGRST205" in err_text:
            logger.warning("Posts table not found. Returning empty feed.")
            return {"posts": [], "has_more": False}
        logger.error(f"Error fetching posts: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch posts")

@api_router.post("/posts")
async def create_post(post_data: dict, current_user: dict = Depends(get_current_user)):
    """Create a new post"""
    try:
        post_data["author_id"] = current_user["id"]
        post_data["created_at"] = datetime.now(timezone.utc).isoformat()
        
        response = supabase.table("posts").insert(post_data).execute()
        return {"post": response.data[0]}
    except Exception as e:
        logger.error(f"Error creating post: {e}")
        raise HTTPException(status_code=500, detail="Failed to create post")

@api_router.post("/posts/{post_id}/like")
async def like_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Like or unlike a post"""
    try:
        # Check if already liked
        existing_like = supabase.table("likes").select("*").eq("post_id", post_id).eq("user_id", current_user["id"]).execute()
        
        if existing_like.data:
            # Unlike
            supabase.table("likes").delete().eq("post_id", post_id).eq("user_id", current_user["id"]).execute()
            return {"liked": False}
        else:
            # Like
            like_data = {
                "post_id": post_id,
                "user_id": current_user["id"],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            supabase.table("likes").insert(like_data).execute()
            return {"liked": True}
    except Exception as e:
        logger.error(f"Error liking post: {e}")
        raise HTTPException(status_code=500, detail="Failed to like post")

@api_router.post("/posts/{post_id}/reply")
async def reply_to_post(post_id: str, reply_data: dict, current_user: dict = Depends(get_current_user)):
    """Reply to a post"""
    try:
        # Use the database function to create a reply
        result = supabase.rpc('create_post_reply', {
            'parent_post_id': post_id,
            'reply_content': reply_data['content'],
            'reply_media_urls': reply_data.get('media_urls', []),
            'reply_hashtags': reply_data.get('hashtags', [])
        }).execute()
        # Notify post author (best-effort)
        try:
            post = supabase.table("posts").select("author_id").eq("id", post_id).single().execute()
            author_id = post.data.get("author_id") if post.data else None
            if author_id and author_id != current_user["id"]:
                sender = tag_from_user(current_user)
                snippet = (reply_data.get('content') or '')[:60]
                notify_user(author_id, f"{sender} commented on your post:", snippet, ntype="comment", reference_id=post_id)
        except Exception:
            pass
        return {"reply_id": result.data}
    except Exception as e:
        logger.error(f"Error replying to post: {e}")
        raise HTTPException(status_code=500, detail="Failed to reply to post")

@api_router.post("/posts/{post_id}/quote")
async def quote_post(post_id: str, quote_data: dict, current_user: dict = Depends(get_current_user)):
    """Quote a post"""
    try:
        # Use the database function to create a quote
        result = supabase.rpc('create_post_quote', {
            'quoted_post_id': post_id,
            'quote_content': quote_data['content'],
            'quote_media_urls': quote_data.get('media_urls', []),
            'quote_hashtags': quote_data.get('hashtags', [])
        }).execute()
        # Notify post author (best-effort)
        try:
            post = supabase.table("posts").select("author_id").eq("id", post_id).single().execute()
            author_id = post.data.get("author_id") if post.data else None
            if author_id and author_id != current_user["id"]:
                sender = tag_from_user(current_user)
                snippet = (quote_data.get('content') or '')[:60]
                notify_user(author_id, f"{sender} quoted your post:", snippet, ntype="comment", reference_id=post_id)
        except Exception:
            pass
        return {"quote_id": result.data}
    except Exception as e:
        logger.error(f"Error quoting post: {e}")
        raise HTTPException(status_code=500, detail="Failed to quote post")

@api_router.post("/posts/{post_id}/repost")
async def repost(post_id: str, current_user: dict = Depends(get_current_user)):
    """Repost a post"""
    try:
        # Use the database function to create a repost
        result = supabase.rpc('create_post_repost', {
            'original_post_id': post_id
        }).execute()
        # Notify post author (best-effort)
        try:
            post = supabase.table("posts").select("author_id").eq("id", post_id).single().execute()
            author_id = post.data.get("author_id") if post.data else None
            if author_id and author_id != current_user["id"]:
                sender = tag_from_user(current_user)
                notify_user(author_id, f"{sender} reposted your post.", ntype="engagement", reference_id=post_id)
        except Exception:
            pass
        return {"repost_id": result.data}
    except Exception as e:
        logger.error(f"Error reposting: {e}")
        raise HTTPException(status_code=500, detail="Failed to repost")

@api_router.get("/posts/{post_id}/thread")
async def get_post_thread(post_id: str):
    """Get the thread of replies for a post"""
    try:
        result = supabase.rpc('get_post_thread', {'post_uuid': post_id}).execute()
        return {"thread": result.data}
    except Exception as e:
        logger.error(f"Error fetching post thread: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch post thread")

@api_router.get("/posts/{post_id}/quotes")
async def get_post_quotes(post_id: str):
    """Get quotes of a post"""
    try:
        result = supabase.rpc('get_post_quotes', {'post_uuid': post_id}).execute()
        return {"quotes": result.data}
    except Exception as e:
        logger.error(f"Error fetching post quotes: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch post quotes")

@api_router.get("/posts/{post_id}/mentions")
async def get_post_mentions(post_id: str):
    """Get mentions of a post"""
    try:
        result = supabase.rpc('get_post_mentions', {'post_uuid': post_id}).execute()
        return {"mentions": result.data}
    except Exception as e:
        logger.error(f"Error fetching post mentions: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch post mentions")

@api_router.get("/posts/feed/{user_id}")
async def get_user_feed(user_id: str, skip: int = 0, limit: int = 20):
    """Get enhanced post feed for a user"""
    try:
        result = supabase.rpc('get_enhanced_post_feed', {
            'user_id': user_id,
            'limit_count': limit,
            'offset_count': skip
        }).execute()
        return {"posts": result.data, "has_more": len(result.data) == limit}
    except Exception as e:
        # Function may not exist yet in schema; return empty feed gracefully
        err_text = str(e)
        if "function" in err_text.lower() or "rpc" in err_text.lower():
            logger.warning("get_enhanced_post_feed RPC not found. Returning empty feed.")
            return {"posts": [], "has_more": False}
        logger.error(f"Error fetching user feed: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch user feed")

# ==================== USER ENDPOINTS ====================

@api_router.get("/users")
async def get_users(skip: int = 0, limit: int = 20, search: str = None):
    """Get users with search and pagination"""
    try:
        query = supabase.table("profiles").select("*")
        
        if search:
            query = query.or_(f"username.ilike.%{search}%,full_name.ilike.%{search}%")
            
        query = query.order("created_at", desc=True).range(skip, skip + limit - 1)
        response = query.execute()
        
        return {"users": response.data, "has_more": len(response.data) == limit}
    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch users")

@api_router.get("/users/{user_id}")
async def get_user(user_id: str):
    """Get a specific user by ID"""
    try:
        response = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
        return {"user": response.data}
    except Exception as e:
        logger.error(f"Error fetching user: {e}")
        raise HTTPException(status_code=404, detail="User not found")

@api_router.get("/users/by-username/{username}")
async def get_user_by_username(username: str):
    """Get a specific user by username"""
    try:
        response = supabase.table("profiles").select("*").eq("username", username).single().execute()
        return {"user": response.data}
    except Exception as e:
        logger.error(f"Error fetching user by username: {e}")
        raise HTTPException(status_code=404, detail="User not found")

@api_router.get("/users/{user_id}/follow_counts")
async def get_follow_counts(user_id: str):
    """Get followers and following counts for a user"""
    try:
        followers = supabase.table("user_follows").select("id", count="exact").eq("following_id", user_id).execute()
        following = supabase.table("user_follows").select("id", count="exact").eq("follower_id", user_id).execute()
        return {"followers": followers.count or 0, "following": following.count or 0}
    except Exception as e:
        logger.error(f"Error fetching follow counts: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch follow counts")


@api_router.get("/users/{user_id}/followers")
async def list_followers(user_id: str):
    """Return basic profile information for users following the given user."""
    try:
        response = (
            supabase
            .table("user_follows")
            .select("follower:profiles!user_follows_follower_id_fkey(id,username,full_name,avatar_url,bio)")
            .eq("following_id", user_id)
            .execute()
        )
        followers = []
        for row in response.data or []:
            follower = row.get("follower")
            if isinstance(follower, list):
                follower = follower[0] if follower else None
            if follower:
                followers.append(follower)
        return {"followers": followers}
    except Exception as e:
        logger.error(f"Error fetching followers: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch followers")


@api_router.get("/users/{user_id}/following")
async def list_following(user_id: str):
    """Return basic profile information for users the given user is following."""
    try:
        response = (
            supabase
            .table("user_follows")
            .select("following:profiles!user_follows_following_id_fkey(id,username,full_name,avatar_url,bio)")
            .eq("follower_id", user_id)
            .execute()
        )
        following = []
        for row in response.data or []:
            followee = row.get("following")
            if isinstance(followee, list):
                followee = followee[0] if followee else None
            if followee:
                following.append(followee)
        return {"following": following}
    except Exception as e:
        logger.error(f"Error fetching following: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch following")

@api_router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Follow or unfollow a user"""
    try:
        # Check if already following (correct table: user_follows)
        existing_follow = (
            supabase
            .table("user_follows")
            .select("*")
            .eq("follower_id", current_user["id"]) 
            .eq("following_id", user_id)
            .execute()
        )
        
        if existing_follow.data:
            # Unfollow
            supabase.table("user_follows").delete().eq("follower_id", current_user["id"]).eq("following_id", user_id).execute()
            return {"following": False}
        else:
            # Follow
            follow_data = {
                "follower_id": current_user["id"],
                "following_id": user_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            supabase.table("user_follows").insert(follow_data).execute()
            # Notify followed user
            try:
                follower_tag = tag_from_user(current_user)
                notify_user(user_id, f"{follower_tag} started following you.", ntype="follow", reference_id=current_user["id"]) 
            except Exception:
                pass
            return {"following": True}
    except Exception as e:
        logger.error(f"Error following user: {e}")
        raise HTTPException(status_code=500, detail="Failed to follow user")

# ==================== CHAT ENDPOINTS ====================

@api_router.get("/chats")
async def get_chats(current_user: dict = Depends(get_current_user)):
    """Get user's chats (uses chat_rooms table)."""
    try:
        user_id = current_user["id"]

        try:
            base_response = (
                supabase_admin
                .table("chat_rooms")
                .select("*")
                .or_(f"created_by.eq.{user_id},room_type.eq.public")
                .order("created_at", desc=True)
                .execute()
            )
        except Exception as e:
            msg = str(e)
            if "public.chats" in msg or "public.chat_rooms" in msg or "PGRST205" in msg:
                logger.warning("Chats schema not found; returning empty list")
                return {"chats": []}
            raise

        rooms_map: Dict[str, dict] = {}
        for room in base_response.data or []:
            if room.get("id"):
                rooms_map[room["id"]] = room

        direct_response = (
            supabase_admin
            .table("chat_rooms")
            .select("*")
            .eq("room_type", "direct")
            .execute()
        )
        for room in direct_response.data or []:
            if room.get("id"):
                rooms_map[room["id"]] = room

        rooms: List[dict] = []
        peer_ids: Set[str] = set()

        for room in list(rooms_map.values()):
            room_type = (room.get("room_type") or "").lower()
            if room_type == "direct":
                metadata = _parse_dm_metadata(room.get("description"))
                participants = metadata.get("participants") if isinstance(metadata.get("participants"), list) else []
                if not participants and isinstance(room.get("name"), str) and room["name"].startswith(DM_NAME_PREFIX):
                    name_part = room["name"][len(DM_NAME_PREFIX):]
                    candidate = name_part.split(":")
                    if len(candidate) == 2:
                        participants = candidate
                if user_id not in participants:
                    continue
                other_id = next((pid for pid in participants if pid != user_id), None)
                if not other_id:
                    continue
                metadata = _ensure_dm_metadata(room, user_id, other_id)
                room["description"] = json.dumps(metadata)
                room["peer_user_id"] = other_id
                peer_ids.add(other_id)
                rooms.append(room)
            else:
                if room_type == "public" or room.get("created_by") == user_id:
                    rooms.append(room)

        if peer_ids:
            profiles_resp = (
                supabase_admin
                .table("profiles")
                .select("id,username,full_name,avatar_url")
                .in_("id", list(peer_ids))
                .execute()
            )
            profile_map = {profile["id"]: profile for profile in (profiles_resp.data or []) if profile.get("id")}
            for room in rooms:
                if (room.get("room_type") or "").lower() == "direct":
                    peer_profile = profile_map.get(room.get("peer_user_id"))
                    if peer_profile:
                        room["peer_username"] = peer_profile.get("username")
                        room["peer_display_name"] = peer_profile.get("full_name") or peer_profile.get("username")
                        room["peer_avatar"] = peer_profile.get("avatar_url")

        rooms.sort(key=lambda r: r.get("created_at") or "", reverse=True)
        return {"chats": rooms}
    except Exception as e:
        logger.error(f"Error fetching chats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch chats")


@api_router.post("/chats/direct")
async def create_direct_chat(payload: DirectChatRequest, current_user: dict = Depends(get_current_user)):
    """Create (or fetch) a direct chat between the current user and a recipient."""
    try:
        user_id = current_user["id"]
        recipient_id = payload.recipient_id

        if recipient_id == user_id:
            raise HTTPException(status_code=400, detail="Cannot start a chat with yourself")

        # Validate recipient exists
        recipient_resp = (
            supabase_admin
            .table("profiles")
            .select("id,username,full_name,avatar_url")
            .eq("id", recipient_id)
            .single()
            .execute()
        )
        recipient_profile = recipient_resp.data
        if not recipient_profile:
            raise HTTPException(status_code=404, detail="Recipient not found")

        dm_name = _canonical_dm_name(user_id, recipient_id)

        existing = (
            supabase_admin
            .table("chat_rooms")
            .select("*")
            .eq("room_type", "direct")
            .eq("name", dm_name)
            .limit(1)
            .execute()
        )

        if existing.data:
            chat = existing.data[0]
        else:
            metadata = {
                "participants": sorted([user_id, recipient_id]),
                "initiator": user_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            insert_resp = (
                supabase_admin
                .table("chat_rooms")
                .insert({
                    "name": dm_name,
                    "description": json.dumps(metadata),
                    "room_type": "direct",
                    "created_by": user_id,
                    "is_active": True
                })
                .execute()
            )
            if not insert_resp.data:
                raise HTTPException(status_code=500, detail="Failed to create chat")
            chat = insert_resp.data[0]

        metadata = _ensure_dm_metadata(chat, user_id, recipient_id)
        chat["description"] = json.dumps(metadata)
        chat["peer_user_id"] = recipient_id
        chat["peer_username"] = recipient_profile.get("username")
        chat["peer_display_name"] = recipient_profile.get("full_name") or recipient_profile.get("username")
        chat["peer_avatar"] = recipient_profile.get("avatar_url")

        return {"chat": chat}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating direct chat: {e}")
        raise HTTPException(status_code=500, detail="Failed to create chat")


@api_router.get("/chats/suggestions")
async def get_chat_suggestions(limit: int = 8, current_user: dict = Depends(get_current_user)):
    """Suggest mutual followers who are not already active chat partners."""
    try:
        if limit <= 0:
            return {"suggestions": []}

        user_id = current_user.get("id")
        if not user_id:
            return {"suggestions": []}

        following_resp = supabase_admin.table("user_follows").select("following_id").eq("follower_id", user_id).execute()
        followers_resp = supabase_admin.table("user_follows").select("follower_id").eq("following_id", user_id).execute()

        following_ids = {row.get("following_id") for row in (following_resp.data or []) if row.get("following_id")}
        follower_ids = {row.get("follower_id") for row in (followers_resp.data or []) if row.get("follower_id")}

        candidate_ids = [uid for uid in following_ids & follower_ids if uid and uid != user_id]
        if not candidate_ids:
            return {"suggestions": []}

        # Exclude users already present in the user's chat rooms
        try:
            rooms_resp = (
                supabase_admin
                .table("chat_rooms")
                .select("id")
                .or_(f"created_by.eq.{user_id},room_type.eq.public")
                .execute()
            )
            room_ids = [room.get("id") for room in (rooms_resp.data or []) if room.get("id")]
        except Exception:
            room_ids = []

        engaged_user_ids = set()
        if room_ids:
            try:
                messages_resp = (
                    supabase_admin
                    .table("chat_messages")
                    .select("user_id,room_id")
                    .in_("room_id", room_ids)
                    .neq("user_id", user_id)
                    .execute()
                )
                engaged_user_ids = {msg.get("user_id") for msg in (messages_resp.data or []) if msg.get("user_id")}
            except Exception:
                engaged_user_ids = set()

        filtered_ids = [uid for uid in candidate_ids if uid not in engaged_user_ids]
        if not filtered_ids:
            return {"suggestions": []}

        limited_ids = filtered_ids[:limit]

        profiles_resp = (
            supabase_admin
            .table("profiles")
            .select("id,username,full_name,avatar_url,bio")
            .in_("id", limited_ids)
            .execute()
        )

        profile_map = {profile["id"]: profile for profile in (profiles_resp.data or []) if profile.get("id")}
        suggestions = []
        for uid in limited_ids:
            profile = profile_map.get(uid)
            if profile:
                suggestions.append({
                    "id": profile.get("id"),
                    "username": profile.get("username"),
                    "full_name": profile.get("full_name"),
                    "avatar_url": profile.get("avatar_url"),
                    "bio": profile.get("bio"),
                })

        return {"suggestions": suggestions}
    except Exception as e:
        logger.error(f"Error fetching chat suggestions: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch chat suggestions")

@api_router.get("/chats/{chat_id}/messages")
async def get_messages(chat_id: str, skip: int = 0, limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Get messages for a chat (uses chat_messages table)."""
    try:
        chat_resp = (
            supabase_admin
            .table("chat_rooms")
            .select("id,room_type,name,description,created_by")
            .eq("id", chat_id)
            .single()
            .execute()
        )
        chat = chat_resp.data
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        user_id = current_user["id"]
        room_type = (chat.get("room_type") or "").lower()
        if room_type == "direct":
            metadata = _parse_dm_metadata(chat.get("description"))
            participants = metadata.get("participants") if isinstance(metadata.get("participants"), list) else []
            if not participants and isinstance(chat.get("name"), str) and chat["name"].startswith(DM_NAME_PREFIX):
                name_part = chat["name"][len(DM_NAME_PREFIX):]
                candidate = name_part.split(":")
                if len(candidate) == 2:
                    participants = candidate
            if user_id not in participants:
                raise HTTPException(status_code=403, detail="Not authorized to view this chat")
        elif room_type != "public" and chat.get("created_by") != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this chat")

        response = (
            supabase_admin
            .table("chat_messages")
            .select("*")
            .eq("room_id", chat_id)
            .order("created_at", desc=True)
            .range(skip, skip + limit - 1)
            .execute()
        )

        messages = response.data or []
        for msg in messages:
            if "content" not in msg:
                msg["content"] = msg.get("message")

        return {"messages": messages, "has_more": len(messages) == limit}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch messages")


@api_router.post("/chats/{chat_id}/messages")
async def send_message(chat_id: str, message_data: dict, current_user: dict = Depends(get_current_user)):
    """Send a message to a chat (uses chat_messages)."""
    try:
        chat_resp = (
            supabase_admin
            .table("chat_rooms")
            .select("id,room_type,name,description,created_by")
            .eq("id", chat_id)
            .single()
            .execute()
        )
        chat = chat_resp.data
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        user_id = current_user["id"]
        room_type = (chat.get("room_type") or "").lower()
        if room_type == "direct":
            metadata = _parse_dm_metadata(chat.get("description"))
            participants = metadata.get("participants") if isinstance(metadata.get("participants"), list) else []
            if not participants and isinstance(chat.get("name"), str) and chat["name"].startswith(DM_NAME_PREFIX):
                name_part = chat["name"][len(DM_NAME_PREFIX):]
                candidate = name_part.split(":")
                if len(candidate) == 2:
                    participants = candidate
            if user_id not in participants:
                raise HTTPException(status_code=403, detail="Not authorized to send messages to this chat")
        elif room_type != "public" and chat.get("created_by") != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to send messages to this chat")

        payload = {
            "room_id": chat_id,
            "user_id": user_id,
            "message": message_data.get("content") or message_data.get("message") or "",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        if not payload["message"]:
            raise HTTPException(status_code=400, detail="content required")

        response = supabase_admin.table("chat_messages").insert(payload).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Message not persisted")
        inserted = response.data[0]
        if "content" not in inserted:
            inserted["content"] = inserted.get("message")
        return {"message": inserted}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail="Failed to send message")

# ==================== NOTIFICATION ENDPOINTS ====================

@api_router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user), category: Optional[str] = None):
    """Get user's notifications. Optional category filter: battles|feedback|social|system|transactional"""
    try:
        q = supabase.table("notifications").select("*").eq("user_id", current_user["id"]).order("created_at", desc=True)
        if category == "feedback":
            q = q.eq("type", "private_comment")
        elif category == "social":
            q = q.in_("type", ["follow", "comment", "mention", "engagement"])  # in_ available in postgrest-py
        elif category == "battles":
            q = q.in_("type", ["challenge_sent", "challenge_accepted", "battle_started", "battle_result", "vote"]) 
        elif category == "system":
            q = q.eq("type", "system")
        elif category == "transactional":
            q = q.eq("type", "payment")
        response = q.execute()
        return {"notifications": response.data}
    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch notifications")

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a notification as read"""
    try:
        supabase.table("notifications").update({"is_read": True}).eq("id", notification_id).eq("user_id", current_user["id"]).execute()
        return {"success": True}
    except Exception as e:
        logger.error(f"Error marking notification as read: {e}")
        raise HTTPException(status_code=500, detail="Failed to mark notification as read")

@api_router.post("/notifications/mark-all-read")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    try:
        supabase.table("notifications").update({"is_read": True}).eq("user_id", current_user["id"]).execute()
        return {"success": True}
    except Exception as e:
        logger.error(f"Error mark all read: {e}")
        raise HTTPException(status_code=500, detail="Failed to mark notifications as read")

@api_router.post("/notifications/system")
async def system_notification(payload: dict, current_user: dict = Depends(get_current_user)):
    """Broadcast a system notification (requires service/admin). For MVP no strict admin check."""
    try:
        title = payload.get("title") or "System"
        message = payload.get("message") or ""
        # Send to all active users (best-effort, limited to recent for MVP)
        users = supabase.table("profiles").select("id").eq("is_active", True).limit(2000).execute()
        for u in users.data or []:
            notify_user(u["id"], title, message, ntype="system")
        return {"success": True, "count": len(users.data or [])}
    except Exception as e:
        logger.error(f"Error broadcasting system notification: {e}")
        raise HTTPException(status_code=500, detail="Failed to send system notification")

# Include all routes after definitions
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
