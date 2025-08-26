from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient
from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.models import PointStruct
from typing import List, Dict, Any, Optional
import openai
import numpy as np
import asyncio
import logging
import os
import uuid
from bson import ObjectId
from dotenv import load_dotenv
import json
import re
from datetime import datetime

load_dotenv()

# Configuration
MONGO_URI = "mongodb://localhost:27017"
MONGO_DB = "calendar_app"
QDRANT_HOST = "localhost"
QDRANT_PORT = 6333
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
COLLECTION_NAME = "calendar_vectors"
CURRENT_DATE = datetime.now().strftime("%B %d, %Y")

# Initialize clients
mongo_client = MongoClient(MONGO_URI)
db = mongo_client[MONGO_DB]
qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
openai.api_key = OPENAI_API_KEY

# FastAPI app
app = FastAPI(title="Campaign Management Chat API", version="1.0.0")

# Pydantic models
class SyncRequest(BaseModel):
    collections: Optional[List[str]] = None

class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    response: str
    context_used: int
    collections_involved: List[str]

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Patterns for potential IDs
UUID_PATTERN = re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$', re.I)
OID_PATTERN = re.compile(r'^[a-f0-9]{24}$', re.I)

def is_potential_id(value: str) -> bool:
    """Check if a string looks like a UUID or ObjectId"""
    return bool(UUID_PATTERN.match(value) or OID_PATTERN.match(value))

def extract_potential_ids(doc: Dict) -> set:
    """Recursively extract all potential IDs from a document"""
    ids = set()
    def recurse(d):
        if isinstance(d, dict):
            for k, v in d.items():
                # Look for fields that likely contain IDs
                if k.endswith('_id') or k.endswith('_ids') or k == '_id':
                    if isinstance(v, str) and is_potential_id(v):
                        ids.add(v)
                    elif isinstance(v, list):
                        for item in v:
                            if isinstance(item, str) and is_potential_id(item):
                                ids.add(item)
                recurse(v)
        elif isinstance(d, list):
            for item in d:
                recurse(item)
        elif isinstance(d, str) and is_potential_id(d):
            ids.add(d)
    recurse(doc)
    return ids

def serialize_document(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Convert MongoDB document to JSON-serializable format"""
    serialized = {}
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            serialized[key] = str(value)
        elif isinstance(value, datetime):
            serialized[key] = value.isoformat()
        elif isinstance(value, dict):
            serialized[key] = serialize_document(value)
        elif isinstance(value, list):
            serialized[key] = [
                serialize_document(item) if isinstance(item, dict) 
                else str(item) if isinstance(item, ObjectId) 
                else item.isoformat() if isinstance(item, datetime)
                else item for item in value
            ]
        else:
            serialized[key] = value
    return serialized

def document_to_text(doc: Dict[str, Any]) -> str:
    """Convert document to text for embedding, with better field prioritization"""
    priority_fields = ['title', 'name', 'description', 'jobTitle', 'companyName', 'status']
    text_parts = []
    
    # Add priority fields first
    for field in priority_fields:
        if field in doc and doc[field]:
            text_parts.append(f"{field}: {str(doc[field])}")
    
    # Add other fields (excluding _id and already processed priority fields)
    for key, value in doc.items():
        if key not in ['_id'] + priority_fields and value is not None:
            if isinstance(value, (str, int, float, bool)):
                text_parts.append(f"{key}: {str(value)}")
            elif isinstance(value, list) and value:
                text_parts.append(f"{key}: {', '.join(str(v) for v in value[:5])}")  # Limit list items
            elif isinstance(value, dict) and value:
                # For nested objects, include key fields
                nested_text = []
                for nk, nv in value.items():
                    if isinstance(nv, (str, int, float, bool)):
                        nested_text.append(f"{nk}: {str(nv)}")
                if nested_text:
                    text_parts.append(f"{key}: {', '.join(nested_text[:3])}")
    
    return " | ".join(text_parts)

def init_qdrant_collection():
    """Initialize or recreate Qdrant collection"""
    try:
        if qdrant_client.collection_exists(collection_name=COLLECTION_NAME):
            qdrant_client.delete_collection(collection_name=COLLECTION_NAME)
        
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(size=1536, distance=models.Distance.COSINE),
        )
        logger.info(f"Created Qdrant collection: {COLLECTION_NAME}")
    except Exception as e:
        logger.error(f"Error creating Qdrant collection: {str(e)}")
        raise

async def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate embeddings using OpenAI's text-embedding-3-small"""
    try:
        response = openai.embeddings.create(
            input=texts,
            model="text-embedding-3-small"
        )
        return [embedding.embedding for embedding in response.data]
    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        raise

def find_related_documents(ids: set, max_depth: int = 2) -> List[Dict]:
    """Find related documents by following ID references with depth limit"""
    related_docs = []
    processed_ids = set()
    current_ids = ids.copy()
    
    for depth in range(max_depth):
        if not current_ids:
            break
            
        next_level_ids = set()
        
        for doc_id in current_ids:
            if doc_id in processed_ids:
                continue
                
            processed_ids.add(doc_id)
            
            # Try to find document in any collection
            for coll_name in db.list_collection_names():
                doc = None
                try:
                    # Try as ObjectId first
                    if OID_PATTERN.match(doc_id):
                        doc = db[coll_name].find_one({"_id": ObjectId(doc_id)})
                    else:
                        # Try as string _id
                        doc = db[coll_name].find_one({"_id": doc_id})
                        
                    # Also try finding by other ID fields
                    if not doc:
                        id_fields = [f for f in db[coll_name].find_one() or {} if f.endswith('_id')]
                        for field in id_fields:
                            doc = db[coll_name].find_one({field: doc_id})
                            if doc:
                                break
                                
                except Exception as e:
                    logger.debug(f"Error searching for {doc_id} in {coll_name}: {e}")
                    continue
                
                if doc:
                    serialized_doc = serialize_document(doc)
                    related_docs.append({
                        "collection": coll_name, 
                        "document": serialized_doc,
                        "depth": depth
                    })
                    
                    # Extract IDs for next level
                    if depth < max_depth - 1:
                        next_level_ids.update(extract_potential_ids(serialized_doc))
                    break
        
        current_ids = next_level_ids - processed_ids
    
    return related_docs

@app.post("/sync-data")
async def sync_data(request: SyncRequest):
    """Sync MongoDB collections to Qdrant vector database"""
    try:
        collections = request.collections if request.collections else db.list_collection_names()
        init_qdrant_collection()
        
        total_documents = 0
        
        for collection_name in collections:
            collection = db[collection_name]
            documents = list(collection.find())
            
            if not documents:
                logger.info(f"No documents found in collection: {collection_name}")
                continue

            # Generate embeddings
            texts = [document_to_text(doc) for doc in documents]
            embeddings = await generate_embeddings(texts)
            serialized_docs = [serialize_document(doc) for doc in documents]
            
            # Create Qdrant points
            points = [
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embedding,
                    payload={
                        "collection": collection_name, 
                        "document": serialized_doc,
                        "mongodb_id": str(doc["_id"]),
                        "text_representation": text
                    }
                )
                for doc, serialized_doc, embedding, text in zip(documents, serialized_docs, embeddings, texts)
            ]
            
            # Upsert to Qdrant
            qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)
            total_documents += len(documents)
            logger.info(f"Synced {len(documents)} documents from {collection_name}")

        return {
            "status": "success", 
            "message": f"Synced {total_documents} documents from {len(collections)} collections",
            "collections": collections,
            "total_documents": total_documents
        }
        
    except Exception as e:
        logger.error(f"Error syncing data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Enhanced chat endpoint with relationship-aware context building"""
    try:
        # Generate embedding for query
        query_embedding = await generate_embeddings([request.query])
        
        # Search in Qdrant with higher limit for better coverage
        search_result = qdrant_client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_embedding[0],
            limit=15,
            score_threshold=0.3  # Filter out very low relevance results
        )
        
        if not search_result:
            return ChatResponse(
                response="I couldn't find relevant information for your query. Please try rephrasing or check if the data has been synced.",
                context_used=0,
                collections_involved=[]
            )
        
        # Extract IDs from search results
        all_ids = set()
        initial_docs = []
        
        for hit in search_result:
            doc_payload = hit.payload['document']
            initial_docs.append({
                "collection": hit.payload['collection'],
                "document": doc_payload,
                "score": hit.score,
                "depth": 0
            })
            all_ids.update(extract_potential_ids(doc_payload))
        
        # Find related documents through ID relationships
        related_docs = find_related_documents(all_ids, max_depth=2)
        
        # Combine and deduplicate documents
        all_context_docs = initial_docs + related_docs
        unique_docs = {}
        
        for doc_info in all_context_docs:
            doc_id = doc_info['document'].get('_id', 'unknown')
            collection = doc_info['collection']
            key = f"{collection}:{doc_id}"
            
            # Keep the one with higher score or lower depth
            if key not in unique_docs or (
                doc_info.get('score', 0) > unique_docs[key].get('score', 0) or
                doc_info.get('depth', 999) < unique_docs[key].get('depth', 999)
            ):
                unique_docs[key] = doc_info
        
        # Prepare context
        context_docs = list(unique_docs.values())
        collections_involved = list(set(doc['collection'] for doc in context_docs))
        
        # Sort by relevance (score desc, depth asc)
        context_docs.sort(key=lambda x: (-x.get('score', 0), x.get('depth', 999)))
        
        # Limit context size to prevent token overflow
        context_docs = context_docs[:20]
        
        # Build context string
        context_data = [{"collection": doc['collection'], "document": doc['document']} for doc in context_docs]
        context_str = json.dumps(context_data, indent=2)
        
        # Enhanced system prompt
        system_prompt = f"""You are an AI assistant for a campaign management and recruitment scheduling system. Today's date is {CURRENT_DATE}.

You have access to data from multiple interconnected collections:
- campaign-tracker: Job postings and recruitment campaigns
- campaign_manager: Campaign management details
- clients: Company/client information
- interview-rounds: Interview scheduling and rounds
- panel-selections: Interview panel selections
- users: User profiles and authentication data

Key relationships:
- Fields ending with '_id' (like client_id, campaign_id, user_id) reference the '_id' field in related collections
- Array fields like 'user_ids' contain multiple ID references
- Some collections use UUID format IDs, others use MongoDB ObjectIds

Instructions:
1. Analyze the query to understand what information is being requested
2. Use the provided context to give accurate, comprehensive answers
3. When discussing relationships, mention the connected entities (e.g., "Campaign X for Client Y")
4. For scheduling queries, pay attention to dates, times, and availability
5. For status queries, provide current states and any recent changes
6. Be specific with names, dates, and numbers when available
7. If information spans multiple collections, synthesize it coherently

Respond naturally and conversationally while being precise and informative."""

        # Generate response
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Context Data:\n{context_str}\n\nUser Query: {request.query}"}
            ],
            temperature=0.1,  # Lower temperature for more consistent responses
            max_tokens=1000
        )
        
        return ChatResponse(
            response=response.choices[0].message.content,
            context_used=len(context_docs),
            collections_involved=collections_involved
        )
        
    except Exception as e:
        logger.error(f"Error processing chat request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat processing error: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check MongoDB connection
        db.command('ping')
        
        # Check Qdrant connection
        qdrant_client.get_collections()
        
        # Check if collection exists
        collection_exists = qdrant_client.collection_exists(collection_name=COLLECTION_NAME)
        
        return {
            "status": "healthy",
            "mongodb": "connected",
            "qdrant": "connected",
            "vector_collection_exists": collection_exists,
            "current_date": CURRENT_DATE
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

@app.get("/collections")
async def list_collections():
    """List available MongoDB collections"""
    try:
        collections = db.list_collection_names()
        collection_stats = {}
        
        for coll_name in collections:
            count = db[coll_name].count_documents({})
            collection_stats[coll_name] = count
            
        return {
            "collections": collections,
            "document_counts": collection_stats,
            "total_collections": len(collections)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")