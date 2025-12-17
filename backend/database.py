from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "engageai")

client: AsyncIOMotorClient = None
db = None

async def connect_db():
    global client, db
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        # Verify connection
        await client.admin.command('ping')
        print(f"Connected to MongoDB at {MONGO_URL}")
        # Create indexes
        await create_indexes()
    except ConnectionFailure as e:
        print(f"Failed to connect to MongoDB: {e}")
        raise

async def close_db():
    global client
    if client:
        client.close()
        print("MongoDB connection closed")

async def create_indexes():
    """Create database indexes for performance"""
    global db
    if db is None:
        return
    
    # Users indexes
    await db.users.create_index("email", unique=True, sparse=True)
    
    # Agents indexes
    await db.agents.create_index("category")
    await db.agents.create_index("tier")
    await db.agents.create_index("status")
    
    # Workflows indexes
    await db.workflows.create_index("userId")
    await db.workflows.create_index("status")
    
    # Prospects indexes
    await db.prospects.create_index("userId")
    await db.prospects.create_index("companyId")
    await db.prospects.create_index("status")
    
    # Companies indexes
    await db.companies.create_index("domain", unique=True, sparse=True)
    
    print("Database indexes created")

def get_db():
    return db
