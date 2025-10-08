from pymilvus import connections, utility
import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Milvus connection parameters
uri = os.environ['MILVUS_URI']
user = os.environ['MILVUS_USER']
password = os.environ['MILVUS_PASSWORD']
collection_name = os.environ['MILVUS_COLLECTION']
token = f"{user}:{password}"

# Connect to Milvus
connections.connect(
    uri=uri,
    user=user,
    password=password,
    token=token
)

# Check if the collection exists and drop it
if utility.has_collection(collection_name):
    utility.drop_collection(collection_name)
    logger.info(f"Collection '{collection_name}' has been deleted.")
else:
    logger.info(f"Collection '{collection_name}' does not exist.")