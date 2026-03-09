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
    await db.prospects.create_index("source")

    # Integrations indexes
    await db.user_integrations.create_index("userId", unique=True)

    # Email telemetry indexes
    await db.email_sends.create_index("userId")
    await db.email_sends.create_index("prospectId")
    await db.email_sends.create_index("provider")
    await db.email_events.create_index("sendId")
    await db.email_events.create_index("eventType")
    await db.email_events.create_index("timestamp")
    await db.email_events.create_index([("sendId", 1), ("eventType", 1), ("timestamp", -1)])
    await db.integration_telemetry.create_index("userId")
    await db.integration_telemetry.create_index("provider")
    await db.integration_telemetry.create_index("eventType")
    await db.integration_telemetry.create_index("createdAt")
    await db.integration_telemetry.create_index([("userId", 1), ("createdAt", -1)])
    await db.integration_telemetry.create_index(
        [("userId", 1), ("eventType", 1), ("createdAt", -1)]
    )
    await db.integration_telemetry.create_index(
        [("userId", 1), ("provider", 1), ("createdAt", -1)]
    )
    await db.integration_telemetry.create_index(
        [("userId", 1), ("provider", 1), ("eventType", 1), ("createdAt", -1)]
    )
    await db.integration_telemetry.create_index(
        [("userId", 1), ("governanceStatus", 1), ("createdAt", -1)]
    )
    await db.integration_telemetry.create_index(
        [("userId", 1), ("governancePacketValidationStatus", 1), ("createdAt", -1)]
    )
    await db.integration_telemetry.create_index(
        [("userId", 1), ("requestId", 1), ("createdAt", -1)]
    )
    await db.integration_telemetry.create_index(
        [("userId", 1), ("schemaVersion", 1), ("createdAt", -1)]
    )

    # Webhook idempotency dedup cache (7 days)
    await db.integration_event_dedup.create_index("id", unique=True)
    await db.integration_event_dedup.create_index("createdAt", expireAfterSeconds=604800)
    await db.integration_event_dedup.create_index([("provider", 1), ("createdAt", -1)])

    # Company research indexes
    await db.company_research.create_index("userId")
    await db.company_research.create_index("domain")
    await db.company_research.create_index("source")
    await db.company_research.create_index("createdAt")

    # Prediction feedback indexes
    await db.prediction_feedback.create_index("userId")
    await db.prediction_feedback.create_index("createdAt")
    await db.prediction_feedback.create_index("channel")
    await db.prediction_feedback.create_index("actualLabel")
    await db.prediction_feedback.create_index([("userId", 1), ("createdAt", -1)])

    # Sales campaign indexes
    await db.sales_campaigns.create_index("userId")
    await db.sales_campaigns.create_index("status")
    await db.sales_campaigns.create_index("updatedAt")
    await db.sales_campaigns.create_index([("userId", 1), ("status", 1), ("updatedAt", -1)])
    await db.sales_campaigns.create_index([("userId", 1), ("id", 1)])
    
    # Companies indexes
    await db.companies.create_index("domain", unique=True, sparse=True)
    
    print("Database indexes created")

def get_db():
    return db
