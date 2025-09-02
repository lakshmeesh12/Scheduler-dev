import re
import json
import uuid
import logging
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional, Set
from bson import ObjectId
from pymongo import MongoClient
from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.models import PointStruct
import openai
import numpy as np
from dotenv import load_dotenv
import os

load_dotenv()

class Agent:
    """Handles data synchronization and chat functionality for the campaign management system."""
    
    def __init__(self):
        # Configuration
        self.MONGO_URI = "mongodb://localhost:27017"
        self.MONGO_DB = "calendar_app"
        self.QDRANT_HOST = "localhost"
        self.QDRANT_PORT = 6333
        self.OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
        self.COLLECTION_NAME = "calendar_vectors"
        self.CURRENT_DATE = datetime.now().strftime("%B %d, %Y")
        
        # Initialize clients
        self.mongo_client = MongoClient(self.MONGO_URI)
        self.db = self.mongo_client[self.MONGO_DB]
        self.qdrant_client = QdrantClient(host=self.QDRANT_HOST, port=self.QDRANT_PORT)
        self.openai_client = openai.AsyncOpenAI(api_key=self.OPENAI_API_KEY)
        
        # Logging setup
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        # Patterns for potential IDs
        self.UUID_PATTERN = re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$', re.I)
        self.OID_PATTERN = re.compile(r'^[a-f0-9]{24}$', re.I)

    def is_potential_id(self, value: str) -> bool:
        """Check if a string looks like a UUID or ObjectId."""
        return bool(self.UUID_PATTERN.match(value) or self.OID_PATTERN.match(value))

    def extract_potential_ids(self, doc: Dict) -> Set[str]:
        """Recursively extract all potential IDs from a document."""
        ids = set()
        def recurse(d):
            if isinstance(d, dict):
                for k, v in d.items():
                    if k.endswith('_id') or k.endswith('_ids') or k == '_id':
                        if isinstance(v, str) and self.is_potential_id(v):
                            ids.add(v)
                        elif isinstance(v, list):
                            for item in v:
                                if isinstance(item, str) and self.is_potential_id(item):
                                    ids.add(item)
                    recurse(v)
            elif isinstance(d, list):
                for item in d:
                    recurse(item)
            elif isinstance(d, str) and self.is_potential_id(d):
                ids.add(d)
        recurse(doc)
        return ids

    def serialize_document(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Convert MongoDB document to JSON-serializable format."""
        serialized = {}
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                serialized[key] = str(value)
            elif isinstance(value, datetime):
                serialized[key] = value.isoformat()
            elif isinstance(value, dict):
                serialized[key] = self.serialize_document(value)
            elif isinstance(value, list):
                serialized[key] = [
                    self.serialize_document(item) if isinstance(item, dict)
                    else str(item) if isinstance(item, ObjectId)
                    else item.isoformat() if isinstance(item, datetime)
                    else item for item in value
                ]
            else:
                serialized[key] = value
        return serialized

    def document_to_text(self, doc: Dict[str, Any], collection_name: str = None) -> str:
        """Convert document to text for embedding with field prioritization."""
        priority_fields = [
            'title', 'name', 'description', 'jobTitle', 'companyName', 'status',
            'Interview', 'Interview Round', 'candidate', 'panel', 'details'
        ]
        text_parts = []
        
        if collection_name:
            text_parts.append(f"Collection: {collection_name}")
        
        for field in priority_fields:
            if field in doc and doc[field]:
                if field in ['Interview', 'Interview Round'] and isinstance(doc[field], list):
                    for idx, item in enumerate(doc[field], 1):
                        nested_text = []
                        if isinstance(item, dict):
                            for k, v in item.items():
                                if k in ['candidate', 'panel', 'details', 'scheduled_event']:
                                    if isinstance(v, dict):
                                        nested_text.append(self.document_to_text(v, f"{field}_{idx}"))
                                    elif isinstance(v, list):
                                        for sub_idx, sub_item in enumerate(v, 1):
                                            if isinstance(sub_item, dict):
                                                nested_text.append(self.document_to_text(sub_item, f"{field}_{idx}_{k}_{sub_idx}"))
                                    else:
                                        nested_text.append(f"{k}: {str(v)}")
                                else:
                                    nested_text.append(f"{k}: {str(v)}")
                        if nested_text:
                            text_parts.append(f"{field} {idx}: {' | '.join(nested_text)}")
                else:
                    text_parts.append(f"{field}: {str(doc[field])}")
        
        for key, value in doc.items():
            if key not in ['_id'] + priority_fields and value is not None:
                if isinstance(value, (str, int, float, bool)):
                    text_parts.append(f"{key}: {str(value)}")
                elif isinstance(value, list) and value:
                    text_parts.append(f"{key}: {', '.join(str(v) for v in value[:5])}")
                elif isinstance(value, dict) and value:
                    nested_text = []
                    for nk, nv in value.items():
                        if isinstance(nv, (str, int, float, bool)):
                            nested_text.append(f"{nk}: {str(nv)}")
                    if nested_text:
                        text_parts.append(f"{key}: {', '.join(nested_text[:3])}")
        
        return " | ".join(text_parts)

    def init_qdrant_collection(self):
        """Initialize or recreate Qdrant collection."""
        try:
            if self.qdrant_client.collection_exists(collection_name=self.COLLECTION_NAME):
                self.qdrant_client.delete_collection(collection_name=self.COLLECTION_NAME)
            
            self.qdrant_client.create_collection(
                collection_name=self.COLLECTION_NAME,
                vectors_config=models.VectorParams(size=1536, distance=models.Distance.COSINE),
            )
            self.logger.info(f"Created Qdrant collection: {self.COLLECTION_NAME}")
        except Exception as e:
            self.logger.error(f"Error creating Qdrant collection: {str(e)}")
            raise

    async def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings using OpenAI's text-embedding-3-small."""
        try:
            response = await self.openai_client.embeddings.create(
                input=texts,
                model="text-embedding-3-small"
            )
            return [embedding.embedding for embedding in response.data]
        except Exception as e:
            self.logger.error(f"Error generating embeddings: {str(e)}")
            raise

    def find_related_documents(self, ids: Set[str], max_depth: int = 3) -> List[Dict]:
        """Find related documents by following ID references with depth limit."""
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
                
                for coll_name in self.db.list_collection_names():
                    doc = None
                    try:
                        if self.OID_PATTERN.match(doc_id):
                            doc = self.db[coll_name].find_one({"_id": ObjectId(doc_id)})
                        else:
                            doc = self.db[coll_name].find_one({"_id": doc_id})
                        
                        if not doc:
                            id_fields = [f for f in self.db[coll_name].find_one() or {} if f.endswith('_id') or f.endswith('_ids')]
                            for field in id_fields:
                                if field == 'campaign_id' and coll_name in ['panel_selections', 'interview_rounds']:
                                    doc = self.db[coll_name].find_one({field: doc_id})
                                else:
                                    doc = self.db[coll_name].find_one({field: doc_id})
                                if doc:
                                    break
                    except Exception as e:
                        self.logger.debug(f"Error searching for {doc_id} in {coll_name}: {e}")
                        continue
                    
                    if doc:
                        serialized_doc = self.serialize_document(doc)
                        related_docs.append({
                            "collection": coll_name,
                            "document": serialized_doc,
                            "depth": depth,
                            "score": 0.0
                        })
                        if depth < max_depth - 1:
                            next_level_ids.update(self.extract_potential_ids(serialized_doc))
                        break
            
            current_ids = next_level_ids - processed_ids
        
        return related_docs

    async def sync_data(self, collections: Optional[List[str]] = None) -> Dict:
        """Sync MongoDB collections to Qdrant vector database."""
        try:
            collections = collections if collections else self.db.list_collection_names()
            self.init_qdrant_collection()
            
            total_documents = 0
            
            for collection_name in collections:
                collection = self.db[collection_name]
                documents = list(collection.find())
                
                if not documents:
                    self.logger.info(f"No documents found in collection: {collection_name}")
                    continue

                texts = [self.document_to_text(doc, collection_name) for doc in documents]
                embeddings = await self.generate_embeddings(texts)
                serialized_docs = [self.serialize_document(doc) for doc in documents]
                
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
                
                self.qdrant_client.upsert(collection_name=self.COLLECTION_NAME, points=points)
                total_documents += len(documents)
                self.logger.info(f"Synced {len(documents)} documents from {collection_name}")

            return {
                "status": "success",
                "message": f"Synced {total_documents} documents from {len(collections)} collections",
                "collections": collections,
                "total_documents": total_documents
            }
        except Exception as e:
            self.logger.error(f"Error syncing data: {str(e)}")
            raise

    async def chat(self, query: str) -> Dict:
        """Process chat query with relationship-aware context building for complex queries."""
        try:
            query_embedding = await self.generate_embeddings([query])
            
            search_result = self.qdrant_client.search(
                collection_name=self.COLLECTION_NAME,
                query_vector=query_embedding[0],
                limit=30,
                score_threshold=0.2
            )
            
            if not search_result:
                return {
                    "response": "I'm sorry, I couldn't find any information related to your question. Could you try asking in a different way or check if the data is up to date?",
                    "context_used": 0,
                    "collections_involved": []
                }
            
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
                all_ids.update(self.extract_potential_ids(doc_payload))
            
            related_docs = self.find_related_documents(all_ids, max_depth=3)
            all_context_docs = initial_docs + related_docs
            unique_docs = {}
            
            for doc_info in all_context_docs:
                doc_id = doc_info['document'].get('_id', 'unknown')
                collection = doc_info['collection']
                key = f"{collection}:{doc_id}"
                
                if key not in unique_docs or (
                    doc_info.get('score', 0) > unique_docs[key].get('score', 0) or
                    doc_info.get('depth', 999) < unique_docs[key].get('depth', 999)
                ):
                    unique_docs[key] = doc_info
            
            context_docs = list(unique_docs.values())
            collections_involved = list(set(doc['collection'] for doc in context_docs))
            context_docs.sort(key=lambda x: (-x.get('score', 0), x.get('depth', 999)))
            context_docs = context_docs[:30]
            
            context_data = []
            for doc in context_docs:
                collection = doc['collection']
                document = doc['document']
                context_data.append({
                    "collection": collection,
                    "document": document,
                    "relevance_score": doc.get('score', 0),
                    "depth": doc.get('depth', 0)
                })
            context_str = json.dumps(context_data, indent=2)
            
            system_prompt = f"""You are QChat, a friendly and helpful assistant for a recruitment and campaign management system, designed for non-technical users like hiring managers and recruiters. Today's date is {self.CURRENT_DATE} (05:34 PM IST).

You have access to the following data collections:
- **campaign-tracker**: Job postings, including job titles, departments, locations, and interview details for candidates.
- **campaign_manager**: Campaign details, like campaign names, contact persons, and start dates.
- **clients**: Company information, such as company names and locations.
- **interview_rounds**: Details about each interview round for candidates.
- **panel_selections**: Information about interview panels and schedules.
- **users**: Details about team members who use the system, like their names and emails.

**Key Connections**:
- **Clients** (companies) can have multiple campaigns.
- **Campaigns** (in campaign_manager) are linked to jobs (in campaign-tracker).
- **Jobs** (in campaign-tracker) include job details and lists of interviews and rounds.
- **Interviews** and **Rounds** connect to candidates, panel members (team members), and jobs.
- **Users** are team members who create jobs or serve as interviewers.
- In some places, "campaign_id" refers to a job ID (from campaign-tracker) instead of a campaign.

**Instructions**:
1. **Understand the Question**: Figure out what the user wants, like details about jobs, campaigns, interviews, or candidates. Look for names, dates, or companies mentioned.
2. **Use the Data**: Pull relevant information from the provided data. Focus on jobs (campaign-tracker) and their interview details first, as they’re the most important.
3. **Connect the Dots**:
   - Link job details to the company (client) and campaign names.
   - Match team member IDs (user_ids, created_by) to their names and emails.
   - Note that "campaign_id" in interview data refers to a job ID.
   - Use interview_rounds and panel_selections to confirm interview details.
4. **Answer Clearly for Non-Technical Users**:
   - Use simple, everyday words (e.g., "job" instead of "posting", "team member" instead of "user").
   - Avoid technical terms like "ID", "database", or "collection".
   - Break information into short, clear points with friendly headings like "About the Campaign" or "Job Details".
   - Explain things like you’re talking to someone new to hiring.
5. **Handle Complex Questions**:
   - For job questions, share the job title, location, start date, and what the job involves in simple terms.
   - For interviews, list the date, time (in 12-hour format, e.g., 12:30 PM), location, candidate name, and interviewers.
   - For candidates, mention their name, email, and which interview rounds they’ve completed.
   - Convert times to the user’s timezone (e.g., Asia/Calcutta) and use 12-hour format.
6. **Format the Response**:
   - Use Markdown with clear headings (##, ###) and bullet points for easy reading.
   - Keep each point short and simple.
   - Summarize long details (e.g., job descriptions) into a few sentences unless more detail is requested.
   - If there’s a lot of information, group it by campaign or job for clarity.
7. **Handle Problems**:
   - If no data matches, say, “I couldn’t find that information. Could you clarify or try a different question?”
   - If the question is unclear, ask gently, like, “Could you tell me a bit more about what you’re looking for?”
   - If multiple jobs or campaigns match, list them with key details to tell them apart.
   - If data is missing, mention it kindly, like, “I don’t have all the details for that job yet.”
8. **Be Friendly and Engaging**:
   - Write like you’re chatting with a colleague, using a warm and professional tone.
   - Start with a greeting, like “Hi there!” or “Happy to help!”
   - End with an offer to help more, like “Want more details about a specific job or interview? Just ask!”
   - Use phrases like “Let’s take a look” or “Here’s what I found” to keep it conversational.

**Example Response** (for reference, not hardcoded):
```markdown
Hi there! You asked about jobs for the Test Campaigns with Amazon. Let’s take a look:

## About the Campaign: Test Campaigns
- **Company**: Amazon
- **Contact**: Lakshmeesh (Phone: 9731934127)
- **Location**: Hoboken, NJ
- **Started**: August 29, 2025

## Job: AI Software Engineer
- **Location**: Bengaluru
- **Type**: Full-time
- **Level**: Junior
- **Status**: Open
- **What’s the Job?**: This role involves building AI tools and dashboards using Python and other technologies. You’ll work with a team to create smart solutions for business needs.

### Interviews for This Job
- **Interview 1: Screening** (Done)
  - **When**: September 1, 2025, 12:30 PM - 1:30 PM
  - **Where**: Microsoft Teams
  - **Candidate**: Lakshmeesh H N
  - **Interviewers**: Lakshmeesh H N, Keerthana M M
- **Interview 2: Technical** (Done)
  - **When**: September 2, 2025, 12:30 PM - 1:30 PM
  - **Where**: Microsoft Teams
  - **Candidate**: Lakshmeesh H N
  - **Interviewers**: Lakshmeesh H N, Keerthana M M

Want more details about this job or any others? Just let me know!
```

Respond to the query with a clear, friendly, and well-organized answer that non-technical users can easily understand, based on the data provided.
"""

            response = await self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Context Data:\n{context_str}\n\nUser Query: {query}"}
                ],
                temperature=0.2,
                max_tokens=4000
            )
            
            return {
                "response": response.choices[0].message.content,
                "context_used": len(context_docs),
                "collections_involved": collections_involved
            }
        except Exception as e:
            self.logger.error(f"Error processing chat request: {str(e)}")
            raise

    async def health_check(self) -> Dict:
        """Perform health check on MongoDB and Qdrant connections."""
        try:
            self.db.command('ping')
            self.qdrant_client.get_collections()
            collection_exists = self.qdrant_client.collection_exists(collection_name=self.COLLECTION_NAME)
            
            return {
                "status": "healthy",
                "mongodb": "connected",
                "qdrant": "connected",
                "vector_collection_exists": collection_exists,
                "current_date": self.CURRENT_DATE
            }
        except Exception as e:
            raise

    async def list_collections(self) -> Dict:
        """List available MongoDB collections and their document counts."""
        try:
            collections = self.db.list_collection_names()
            collection_stats = {}
            
            for coll_name in collections:
                count = self.db[coll_name].count_documents({})
                collection_stats[coll_name] = count
                
            return {
                "collections": collections,
                "document_counts": collection_stats,
                "total_collections": len(collections)
            }
        except Exception as e:
            raise