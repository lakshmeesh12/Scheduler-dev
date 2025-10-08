from pymilvus import Collection, connections
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

# Load collection
collection = Collection(collection_name)
collection.load()

# Query documents
results = collection.query(
    expr="job_id == '60d35a28-ad72-4ee2-bab4-3828035bb086'",
    output_fields=["job_id", "profile_id", "content", "text"],
    limit=10
)

# Inspect fields
for result in results:
    has_text = 'text' in result
    content_snippet = result.get('content', '')[:100]
    text_snippet = result.get('text', '')[:100] if has_text else 'N/A'
    logger.info(f"Profile_id: {result['profile_id']}, Content: {content_snippet}..., Text: {text_snippet}..., Has text field: {has_text}")