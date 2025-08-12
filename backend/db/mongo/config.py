import os
from urllib.parse import quote_plus
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("./.env")

MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.environ.get("DATABASE_NAME", "rms")
USER_NAME = os.environ.get("USER_NAME", "").strip()
PASSWORD = os.environ.get("PASSWORD", "").strip()

# If credentials are provided, use them — otherwise connect without auth
if USER_NAME and PASSWORD:
    USER_NAME = quote_plus(USER_NAME)
    PASSWORD = quote_plus(PASSWORD)

    if MONGODB_URI.startswith("mongodb+srv://") or "mongodb.net" in MONGODB_URI:
        # Likely MongoDB Atlas
        mongo_client = AsyncIOMotorClient(
            f"mongodb+srv://{USER_NAME}:{PASSWORD}@{MONGODB_URI.split('://')[1]}"
        )
    else:
        # Likely local or custom host with auth
        mongo_client = AsyncIOMotorClient(
            f"mongodb://{USER_NAME}:{PASSWORD}@{MONGODB_URI}"
        )
else:
    # No credentials — connect without auth
    mongo_client = AsyncIOMotorClient(MONGODB_URI)

db = mongo_client[DATABASE_NAME]

async def mongo_session(collection_name):
    try:
        yield db[collection_name]
    finally:
        pass
