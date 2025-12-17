from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

from database import get_db
from models.user import User, UserCreate, UserLogin, Token

load_dotenv()

router = APIRouter()
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = os.environ.get("JWT_SECRET", "engageai-secret-key")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        db = get_db()
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    db = get_db()
    
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    now = datetime.now(timezone.utc)
    user_id = str(uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "password": get_password_hash(user_data.password),
        "firstName": user_data.firstName,
        "lastName": user_data.lastName,
        "companyName": user_data.companyName,
        "role": "user",
        "onboardingCompleted": False,
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat()
    }
    
    await db.users.insert_one(user)
    
    # Generate token
    access_token = create_access_token({"sub": user_id})
    
    # Return without password
    user_response = {k: v for k, v in user.items() if k != "password"}
    return Token(access_token=access_token, user=User(**user_response))

@router.post("/login", response_model=Token)
async def login(login_data: UserLogin):
    db = get_db()
    
    # Find user
    user = await db.users.find_one({"email": login_data.email})
    if not user or not verify_password(login_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Generate token
    access_token = create_access_token({"sub": user["id"]})
    
    # Return without password
    user_response = {k: v for k, v in user.items() if k not in ["password", "_id"]}
    return Token(access_token=access_token, user=User(**user_response))

@router.get("/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    return User(**current_user)

@router.put("/me")
async def update_me(updates: dict, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    # Filter allowed updates
    allowed_fields = ["firstName", "lastName", "companyName"]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    filtered_updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": filtered_updates}
    )
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return updated_user
