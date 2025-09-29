from pymongo import MongoClient
from uuid import uuid4
from datetime import datetime
from typing import Optional, Literal, List, Dict, Any
from pydantic import BaseModel
from fastapi import HTTPException, UploadFile
from bson import ObjectId
import os
import shutil
import logging
import re
import os
import PyPDF2
import docx
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List
import openai
from datetime import datetime
import io
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from openai import OpenAIError
from openai import AsyncOpenAI
from docx import Document
import fitz  # PyMuPDF

openai.api_key = os.getenv("OPENAI_API_KEY")

# Set up logging
logger = logging.getLogger(__name__)

class TalentAcquisitionTeamMember(BaseModel):
    name: str
    email: str
    role: Literal["Recruiter", "Hiring Manager", "Coordinator"]

class CampaignCreate(BaseModel):
    jobTitle: str
    description: str
    minExperience: int
    maxExperience: int
    positions: int
    location: Optional[str] = None  # Changed to Optional[str] to allow None
    department: str
    jobType: Literal["Full-time", "Part-time", "Contract"]
    startDate: str
    client_id: str
    campaign_id: str
    created_by: str
    talentAcquisitionTeam: List[TalentAcquisitionTeamMember]

class CampaignResponse(BaseModel):
    id: str
    jobTitle: str
    department: str
    positions: int
    status: Literal["Active", "Completed", "On Hold"]
    startDate: str
    location: Optional[str] = None
    candidatesApplied: int
    candidatesHired: int
    currentRound: str
    description: str
    minExperience: int
    maxExperience: int
    jobType: Literal["Full-time", "Part-time", "Contract"]
    client_id: str
    campaign_id: str
    created_by: str
    created_by_name: str
    talentAcquisitionTeam: List[TalentAcquisitionTeamMember]
    endDate: Optional[str] = None
    Interview: Optional[List[Dict[str, Any]]] = None
    Interview_Round: Optional[List[Dict[str, Any]]] = None  # Added Interview_Round field

class ClientCreate(BaseModel):
    companyName: str
    location: str
    industry: str
    description: str

class ClientResponse(BaseModel):
    id: str
    companyName: str
    location: str
    industry: str
    description: str
    logoPath: Optional[str] = None

class ManagerCampaignCreate(BaseModel):
    title: str
    description: str
    contactPerson: str
    contactNumber: str
    location: str
    startDate: str
    client_id: str

class ManagerCampaignResponse(BaseModel):
    id: str
    title: str
    description: str
    contactPerson: str
    contactNumber: str
    location: str
    startDate: str
    client_id: str
    logoPath: Optional[str] = None

class CampaignDetailsUpdate(BaseModel):
    jobTitle: str
    description: str
    department: str
    location: str
    jobType: Literal["Full-time", "Part-time", "Contract"]
    positions: int
#this calss is to create jobs and manage jobs
class CampaignTracker:
    def __init__(self, max_workers=None):  # Add max_workers parameter with default None
        self.mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        self.client = MongoClient(self.mongo_uri)
        self.db = self.client["calendar_app"]
        self.campaign_collection = self.db["campaign-tracker"]
        self.client_collection = self.db["clients"]
        self.users_collection = self.db["users"]
        self.campaign_manager_collection = self.db["campaign_manager"]
        self.executor = ThreadPoolExecutor(max_workers=max_workers or max(os.cpu_count() * 2, 4))
        self.semaphore = asyncio.Semaphore(20) # Limit concurrent tasks
        self.openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        if not os.getenv("OPENAI_API_KEY"):
            raise ValueError("OPENAI_API_KEY is required")

    def _convert_objectid_to_str(self, data: Any) -> Any:
        if isinstance(data, ObjectId):
            return str(data)
        elif isinstance(data, list):
            return [self._convert_objectid_to_str(item) for item in data]
        elif isinstance(data, dict):
            return {key: self._convert_objectid_to_str(value) for key, value in data.items()}
        elif isinstance(data, datetime):
            return data.isoformat()
        return data

    async def create_campaign(self, campaign: CampaignCreate) -> CampaignResponse:
        logger.info(f"Creating job with created_by: {campaign.created_by}, campaign_id: {campaign.campaign_id}, jobTitle: {campaign.jobTitle}")
        
        # Validate input fields
        try:
            if not isinstance(campaign.jobTitle, str) or not campaign.jobTitle.strip():
                logger.error("Job Title is invalid or empty")
                raise HTTPException(status_code=400, detail="Job Title is required and must be a non-empty string")
            if not isinstance(campaign.description, str) or not campaign.description.strip():
                logger.error("Description is invalid or empty")
                raise HTTPException(status_code=400, detail="Description is required and must be a non-empty string")
            if not isinstance(campaign.department, str) or not campaign.department.strip():
                logger.error("Department is invalid or empty")
                raise HTTPException(status_code=400, detail="Department is required and must be a non-empty string")
            if not isinstance(campaign.jobType, str) or campaign.jobType not in ["Full-time", "Part-time", "Contract"]:
                logger.error(f"Invalid jobType: {campaign.jobType}")
                raise HTTPException(status_code=400, detail="Job Type must be one of: Full-time, Part-time, Contract")
            if not isinstance(campaign.startDate, str) or not campaign.startDate.strip():
                logger.error("Start Date is invalid or empty")
                raise HTTPException(status_code=400, detail="Start Date is required and must be a non-empty string")
            if not isinstance(campaign.client_id, str) or not campaign.client_id.strip():
                logger.error("Client ID is invalid or empty")
                raise HTTPException(status_code=400, detail="Client ID is required and must be a non-empty string")
            if not isinstance(campaign.campaign_id, str) or not campaign.campaign_id.strip():
                logger.error("Campaign ID is invalid or empty")
                raise HTTPException(status_code=400, detail="Campaign ID is required and must be a non-empty string")
            if not isinstance(campaign.created_by, str) or not campaign.created_by.strip():
                logger.error("Created By is invalid or empty")
                raise HTTPException(status_code=400, detail="Created By is required and must be a non-empty string")
            if campaign.positions < 1:
                logger.error("Positions must be at least 1")
                raise HTTPException(status_code=400, detail="At least one position is required")
            if campaign.minExperience > campaign.maxExperience:
                logger.error("Minimum experience cannot be greater than maximum experience")
                raise HTTPException(status_code=400, detail="Minimum experience cannot be greater than maximum experience")
            if campaign.location is not None and (not isinstance(campaign.location, str) or not campaign.location.strip()):
                logger.error("Location is invalid")
                raise HTTPException(status_code=400, detail="Location must be a non-empty string if provided")
            
            # Validate database references
            if not self.client_collection.find_one({"_id": campaign.client_id}):
                logger.error(f"Client not found: {campaign.client_id}")
                raise HTTPException(status_code=404, detail="Client not found")
            if not self.campaign_manager_collection.find_one({"_id": campaign.campaign_id}):
                logger.error(f"Campaign not found: {campaign.campaign_id}")
                raise HTTPException(status_code=404, detail="Campaign not found")
            
            # Validate talent acquisition team emails
            email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            for member in campaign.talentAcquisitionTeam:
                if not isinstance(member.email, str) or not re.match(email_regex, member.email):
                    logger.error(f"Invalid email for team member: {member.email}")
                    raise HTTPException(status_code=400, detail=f"Invalid email format for team member: {member.email}")

            # Validate user
            user = self.users_collection.find_one(
                {"user_id": campaign.created_by},
                {"user_id": 1, "display_name": 1}
            )
            if not user:
                logger.error(f"User not found for created_by: {campaign.created_by}")
                raise HTTPException(status_code=404, detail="User not found")
            if not user.get("display_name"):
                logger.error(f"Display name not found for user: {campaign.created_by}")
                raise HTTPException(status_code=400, detail="User display name not set")

            created_by_name = user["display_name"]
            logger.info(f"Retrieved display_name: {created_by_name} for user_id: {campaign.created_by}")

            # Prepare campaign data
            campaign_id = str(uuid4())
            campaign_data = {
                "_id": campaign_id,
                "jobTitle": campaign.jobTitle,
                "department": campaign.department,
                "positions": campaign.positions,
                "status": "Active",
                "startDate": campaign.startDate,
                "location": campaign.location,
                "candidatesApplied": 0,
                "candidatesHired": 0,
                "currentRound": "Screening",
                "description": campaign.description,
                "minExperience": campaign.minExperience,
                "maxExperience": campaign.maxExperience,
                "jobType": campaign.jobType,
                "client_id": campaign.client_id,
                "campaign_id": campaign.campaign_id,
                "created_by": campaign.created_by,
                "created_by_name": created_by_name,
                "talentAcquisitionTeam": [member.dict() for member in campaign.talentAcquisitionTeam],
                "created_at": datetime.utcnow()
            }

            # Insert into database
            logger.debug(f"Inserting campaign data into database: {campaign_data}")
            result = self.campaign_collection.insert_one(campaign_data)
            if not result.inserted_id:
                logger.error("Failed to create job in database")
                raise HTTPException(status_code=500, detail="Failed to create job")

            logger.info(f"Job created successfully with id: {campaign_id}")

            # Construct response
            response_data = CampaignResponse(
                id=campaign_id,
                jobTitle=campaign.jobTitle,
                department=campaign.department,
                positions=campaign.positions,
                status="Active",
                startDate=campaign.startDate,
                location=campaign.location,
                candidatesApplied=0,
                candidatesHired=0,
                currentRound="Screening",
                description=campaign.description,
                minExperience=campaign.minExperience,
                maxExperience=campaign.maxExperience,
                jobType=campaign.jobType,
                client_id=campaign.client_id,
                campaign_id=campaign.campaign_id,
                created_by=campaign.created_by,
                created_by_name=created_by_name,
                talentAcquisitionTeam=campaign.talentAcquisitionTeam,
                endDate=None,
                Interview=[],
                Interview_Round=None
            )
            logger.debug(f"Constructed CampaignResponse: {response_data.dict()}")
            return response_data
        except Exception as e:
            logger.error(f"Error in create_campaign for jobTitle {campaign.jobTitle}: {str(e)}")
            raise

    # Rest of the code remains unchanged from previous version
    

    def _extract_text(self, content: bytes, file_extension: str) -> str:
        """Extract text from file content in a thread-safe manner."""
        try:
            text = ""
            if file_extension == "pdf":
                doc = fitz.open(stream=content, filetype="pdf")
                for page_num, page in enumerate(doc, 1):
                    extracted = page.get_text("text") or ""
                    logger.debug(f"Extracted text from PDF page {page_num}: {extracted[:100]}...")
                    text += extracted + "\n"
                doc.close()
            elif file_extension == "docx":
                doc = Document(io.BytesIO(content))
                for para in doc.paragraphs:
                    logger.debug(f"Extracted paragraph from DOCX: {para.text[:100]}...")
                    text += para.text + "\n"
            return text.strip()
        except Exception as e:
            logger.error(f"Error in _extract_text: {str(e)}")
            raise

    async def get_text(self, content: bytes, file_extension: str, filename: str = None) -> str:
        """Extract text asynchronously using ThreadPoolExecutor."""
        async with self.semaphore:
            try:
                loop = asyncio.get_event_loop()
                text = await loop.run_in_executor(self.executor, self._extract_text, content, file_extension)
                if not text:
                    logger.error(f"No text extracted from file: {filename or 'unknown'}")
                    raise HTTPException(status_code=400, detail=f"No text could be extracted from the file: {filename or 'unknown'}")
                logger.debug(f"Extracted text length: {len(text)} characters from {filename or 'unknown'}")
                return text
            except Exception as e:
                logger.error(f"Error extracting text from {filename or 'unknown'}: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error extracting text from {filename or 'unknown'}: {str(e)}")
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(OpenAIError)
    )
    async def _extract_job_details_batch(self, texts: List[str]) -> List[List[Dict]]:
        """Extract job details from a batch of texts using OpenAI API."""
        try:
            BATCH_SIZE = 10  # Process up to 10 texts per API call
            results = []
            for i in range(0, len(texts), BATCH_SIZE):
                batch_texts = texts[i:i + BATCH_SIZE]
                tasks = []
                for text in batch_texts:
                    prompt = f"""
                    Extract job details from the following text. The text may contain one or multiple job descriptions—identify and separate each distinct job based on headings, sections, or logical breaks.

                    For each job:
                    - jobTitle: Mandatory non-empty string. If not explicitly stated, infer a suitable title.
                    - description: Mandatory non-empty string. Include ALL relevant details (duties, skills, education, experience, certifications, etc.).
                    - location: Optional string or null if not found.
                    - minExperience: Optional integer (years), set to 0 if not found or invalid.
                    - maxExperience: Optional integer (years), set to 2 if not found or invalid.
                    - positions: Optional integer, set to 1 if not found or invalid.

                    Do not exclude a job if jobTitle is missing—infer it. Only exclude if there's no meaningful content.
                    Return a JSON object with a 'jobs' key containing an array of job detail objects.

                    Text:
                    {text}
                    """
                    tasks.append(
                        self.openai_client.chat.completions.create(
                            model="gpt-4o",
                            messages=[
                                {"role": "system", "content": "You are a helpful assistant that extracts structured job details from text."},
                                {"role": "user", "content": prompt}
                            ],
                            response_format={"type": "json_object"}
                        )
                    )
                responses = await asyncio.gather(*tasks, return_exceptions=True)
                for response in responses:
                    if isinstance(response, Exception):
                        logger.error(f"Error in OpenAI API call: {str(response)}")
                        results.append([])
                        continue
                    response_data = json.loads(response.choices[0].message.content)
                    jobs = response_data.get("jobs", [])
                    if not isinstance(jobs, list):
                        logger.warning(f"Open AI response 'jobs' is not a list, converting to list: {jobs}")
                        jobs = [jobs] if jobs else []
                    results.append(jobs)
            return results
        except OpenAIError as e:
            logger.error(f"OpenAI API error: {str(e)}")
            raise

    async def extract_job_details_from_file(self, content: bytes, file_extension: str) -> List[Dict]:
        """Extract job details from a single file asynchronously."""
        try:
            text = await self.get_text(content, file_extension)
            logger.debug(f"Sending request to Open AI API for job extraction")
            job_batches = await self._extract_job_details_batch([text])
            jobs = job_batches[0]  # Single file, so first batch

            valid_jobs = []
            for job in jobs:
                logger.debug(f"Processing job: {job}")
                job_title = job.get("jobTitle")
                description = job.get("description")
                if not isinstance(job_title, str) or not job_title.strip():
                    logger.warning(f"Skipping job due to invalid jobTitle: {job}")
                    continue
                if not isinstance(description, str) or not description.strip():
                    logger.warning(f"Skipping job due to invalid description: {job}")
                    continue
                valid_job = {
                    "jobTitle": job_title,
                    "description": description,
                    "location": job.get("location", None) if isinstance(job.get("location"), (str, type(None))) else None,
                    "minExperience": job.get("minExperience", 0) if isinstance(job.get("minExperience"), int) else 0,
                    "maxExperience": job.get("maxExperience", 2) if isinstance(job.get("maxExperience"), int) else 2,
                    "positions": job.get("positions", 1) if isinstance(job.get("positions"), int) else 1
                }
                logger.info(f"Valid job extracted: {valid_job}")
                valid_jobs.append(valid_job)

            if not valid_jobs:
                logger.error("No valid jobs found after processing")
                raise HTTPException(status_code=400, detail="No valid jobs with jobTitle and description found in the file")
            
            logger.info(f"Extracted {len(valid_jobs)} valid jobs from file")
            return valid_jobs
        except Exception as e:
            logger.error(f"Error extracting job details: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

    async def create_bulk_campaigns(self, content: bytes, file_extension: str, client_id: str, campaign_id: str, created_by: str) -> List[CampaignResponse]:
        """Create campaigns from a single file's job details."""
        try:
            if not isinstance(client_id, str) or not client_id.strip():
                logger.error("Invalid client_id provided")
                raise HTTPException(status_code=400, detail="Client ID is required and must be a non-empty string")
            if not isinstance(campaign_id, str) or not campaign_id.strip():
                logger.error("Invalid campaign_id provided")
                raise HTTPException(status_code=400, detail="Campaign ID is required and must be a non-empty string")
            if not isinstance(created_by, str) or not created_by.strip():
                logger.error("Invalid created_by provided")
                raise HTTPException(status_code=400, detail="Created By is required and must be a non-empty string")
            
            logger.info(f"Starting bulk campaign creation with client_id: {client_id}, campaign_id: {campaign_id}, created_by: {created_by}")
            
            job_details = await self.extract_job_details_from_file(content, file_extension)
            results = []

            async with self.semaphore:
                for job in job_details:
                    try:
                        campaign = CampaignCreate(
                            jobTitle=job["jobTitle"],
                            description=job["description"],
                            minExperience=job["minExperience"],
                            maxExperience=job["maxExperience"],
                            positions=job["positions"],
                            location=job["location"],
                            department="Engineering",
                            jobType="Full-time",
                            startDate=datetime.utcnow().strftime("%Y-%m-%d"),
                            client_id=client_id,
                            campaign_id=campaign_id,
                            created_by=created_by,
                            talentAcquisitionTeam=[]
                        )
                        logger.debug(f"Created CampaignCreate object: {campaign.dict()}")
                        result = await self.create_campaign(campaign)  # Assumes create_campaign is async
                        logger.info(f"Successfully created campaign for job: {job['jobTitle']}")
                        results.append(result)
                    except HTTPException as e:
                        logger.error(f"Failed to create campaign for job {job['jobTitle']}: {e.detail}")
                        continue
                    except Exception as e:
                        logger.error(f"Unexpected error creating campaign for job {job['jobTitle']}: {str(e)}")
                        continue
            
            if not results:
                logger.error("No campaigns created due to errors in job data")
                raise HTTPException(status_code=400, detail="No campaigns created due to errors in job data")
            
            logger.info(f"Created {len(results)} campaigns successfully")
            return results
        except Exception as e:
            logger.error(f"Error in create_bulk_campaigns: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error creating campaigns: {str(e)}")

    def __del__(self):
        """Clean up ThreadPoolExecutor."""
        self.executor.shutdown(wait=True)



    async def update_campaign_details(self, campaign_id: str, details: CampaignDetailsUpdate) -> CampaignResponse:
        logger.info(f"Updating campaign details for campaign_id: {campaign_id}")

        # Validate campaign existence
        campaign = self.campaign_collection.find_one({"_id": campaign_id})
        if not campaign:
            logger.error(f"Campaign not found: {campaign_id}")
            raise HTTPException(status_code=404, detail="Campaign not found")

        # Validate input fields
        if not details.jobTitle.strip():
            logger.error("Job Title is required")
            raise HTTPException(status_code=400, detail="Job Title is required")
        if not details.description.strip():
            logger.error("Description is required")
            raise HTTPException(status_code=400, detail="Description is required")
        if not details.department.strip():
            logger.error("Department is required")
            raise HTTPException(status_code=400, detail="Department is required")
        if not details.location.strip():
            logger.error("Location is required")
            raise HTTPException(status_code=400, detail="Location is required")
        if details.positions < 1:
            logger.error("At least one position is required")
            raise HTTPException(status_code=400, detail="At least one position is required")

        # Update campaign details
        update_data = {
            "jobTitle": details.jobTitle,
            "description": details.description,
            "department": details.department,
            "location": details.location,
            "jobType": details.jobType,
            "positions": details.positions,
            "updated_at": datetime.utcnow()
        }
        result = self.campaign_collection.update_one(
            {"_id": campaign_id},
            {"$set": update_data}
        )

        if result.modified_count == 0:
            logger.error(f"Failed to update campaign details for campaign_id: {campaign_id}")
            raise HTTPException(status_code=500, detail="Failed to update campaign details")

        # Fetch updated campaign
        updated_campaign = self.campaign_collection.find_one({"_id": campaign_id})
        logger.info(f"Campaign details updated successfully for campaign_id: {campaign_id}")

        return CampaignResponse(
            id=str(updated_campaign["_id"]),
            jobTitle=updated_campaign["jobTitle"],
            department=updated_campaign["department"],
            positions=updated_campaign["positions"],
            status=updated_campaign["status"],
            startDate=updated_campaign["startDate"],
            location=updated_campaign["location"],
            candidatesApplied=updated_campaign["candidatesApplied"],
            candidatesHired=updated_campaign["candidatesHired"],
            currentRound=updated_campaign["currentRound"],
            description=updated_campaign["description"],
            minExperience=updated_campaign["minExperience"],
            maxExperience=updated_campaign["maxExperience"],
            jobType=updated_campaign["jobType"],
            client_id=updated_campaign["client_id"],
            campaign_id=updated_campaign["campaign_id"],
            created_by=updated_campaign["created_by"],
            created_by_name=updated_campaign["created_by_name"],
            talentAcquisitionTeam=updated_campaign["talentAcquisitionTeam"],
            endDate=updated_campaign.get("endDate"),
            Interview=self._convert_objectid_to_str(updated_campaign.get("Interview", []))
        )
    async def update_campaign_team(self, campaign_id: str, talentAcquisitionTeam: List[TalentAcquisitionTeamMember]) -> CampaignResponse:
        logger.info(f"Updating talent acquisition team for campaign_id: {campaign_id}")

        # Validate campaign existence
        campaign = self.campaign_collection.find_one({"_id": campaign_id})
        if not campaign:
            logger.error(f"Campaign not found: {campaign_id}")
            raise HTTPException(status_code=404, detail="Campaign not found")

        # Validate email formats
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        for member in talentAcquisitionTeam:
            if not re.match(email_regex, member.email):
                logger.error(f"Invalid email for team member: {member.email}")
                raise HTTPException(status_code=400, detail=f"Invalid email format for team member: {member.email}")

        # Update the talent acquisition team
        update_data = {
            "talentAcquisitionTeam": [member.dict() for member in talentAcquisitionTeam],
            "updated_at": datetime.utcnow()
        }
        result = self.campaign_collection.update_one(
            {"_id": campaign_id},
            {"$set": update_data}
        )

        if result.modified_count == 0:
            logger.error(f"Failed to update talent acquisition team for campaign_id: {campaign_id}")
            raise HTTPException(status_code=500, detail="Failed to update talent acquisition team")

        # Fetch updated campaign
        updated_campaign = self.campaign_collection.find_one({"_id": campaign_id})
        logger.info(f"Talent acquisition team updated successfully for campaign_id: {campaign_id}")

        return CampaignResponse(
            id=str(updated_campaign["_id"]),
            jobTitle=updated_campaign["jobTitle"],
            department=updated_campaign["department"],
            positions=updated_campaign["positions"],
            status=updated_campaign["status"],
            startDate=updated_campaign["startDate"],
            location=updated_campaign["location"],
            candidatesApplied=updated_campaign["candidatesApplied"],
            candidatesHired=updated_campaign["candidatesHired"],
            currentRound=updated_campaign["currentRound"],
            description=updated_campaign["description"],
            minExperience=updated_campaign["minExperience"],
            maxExperience=updated_campaign["maxExperience"],
            jobType=updated_campaign["jobType"],
            client_id=updated_campaign["client_id"],
            campaign_id=updated_campaign["campaign_id"],
            created_by=updated_campaign["created_by"],
            created_by_name=updated_campaign["created_by_name"],
            talentAcquisitionTeam=talentAcquisitionTeam,
            endDate=updated_campaign.get("endDate"),
            Interview=self._convert_objectid_to_str(updated_campaign.get("Interview", []))
        )
    async def get_all_campaigns(self, client_id: str, campaign_id: Optional[str] = None) -> List[CampaignResponse]:
        if not self.client_collection.find_one({"_id": client_id}):
            logger.warning(f"Client not found for client_id: {client_id}")
            raise HTTPException(status_code=404, detail="Client not found")

        if campaign_id and not self.campaign_manager_collection.find_one({"_id": campaign_id}):
            logger.warning(f"Manager campaign not found for campaign_id: {campaign_id}")
            return []

        query = {"client_id": client_id}
        if campaign_id:
            query["campaign_id"] = campaign_id

        campaigns = list(self.campaign_collection.find(query))
        logger.info(f"Retrieved {len(campaigns)} jobs for client_id: {client_id}, campaign_id: {campaign_id}")

        if not campaigns:
            logger.info(f"No jobs found for client_id: {client_id}, campaign_id: {campaign_id}")
            return []

        result = []
        for campaign in campaigns:
            try:
                campaign["campaign_id"] = self._convert_objectid_to_str(campaign.get("campaign_id", ""))
                result.append(
                    CampaignResponse(
                        id=str(campaign["_id"]),
                        jobTitle=campaign["jobTitle"],
                        department=campaign["department"],
                        positions=campaign["positions"],
                        status=campaign["status"],
                        startDate=campaign["startDate"],
                        location=campaign["location"],
                        candidatesApplied=campaign["candidatesApplied"],
                        candidatesHired=campaign["candidatesHired"],
                        currentRound=campaign["currentRound"],
                        description=campaign["description"],
                        minExperience=campaign["minExperience"],
                        maxExperience=campaign["maxExperience"],
                        jobType=campaign["jobType"],
                        client_id=campaign["client_id"],
                        campaign_id=campaign["campaign_id"],
                        created_by=campaign["created_by"],
                        created_by_name=campaign["created_by_name"],
                        talentAcquisitionTeam=campaign["talentAcquisitionTeam"],
                        endDate=campaign.get("endDate"),
                        Interview=self._convert_objectid_to_str(campaign.get("Interview", []))
                    )
                )
            except Exception as e:
                logger.error(f"Error processing campaign {campaign.get('_id')}: {str(e)}")
                continue

        logger.info(f"Successfully processed {len(result)} campaigns for client_id: {client_id}, campaign_id: {campaign_id}")
        return result

    async def get_campaign(self, campaign_id: str) -> CampaignResponse:
        campaign = self.campaign_collection.find_one({"_id": campaign_id})
        if not campaign:
            logger.error(f"Job not found: {campaign_id}")
            raise HTTPException(status_code=404, detail="Job not found")

        return CampaignResponse(
            id=str(campaign["_id"]),
            jobTitle=campaign["jobTitle"],
            department=campaign["department"],
            positions=campaign["positions"],
            status=campaign["status"],
            startDate=campaign["startDate"],
            location=campaign["location"],
            candidatesApplied=campaign["candidatesApplied"],
            candidatesHired=campaign["candidatesHired"],
            currentRound=campaign["currentRound"],
            description=campaign["description"],
            minExperience=campaign["minExperience"],
            maxExperience=campaign["maxExperience"],
            jobType=campaign["jobType"],
            client_id=campaign["client_id"],
            campaign_id=campaign["campaign_id"],
            created_by=campaign["created_by"],
            created_by_name=campaign["created_by_name"],
            talentAcquisitionTeam=campaign["talentAcquisitionTeam"],
            endDate=campaign.get("endDate"),
            Interview=self._convert_objectid_to_str(campaign.get("Interview", [])),
            Interview_Round=self._convert_objectid_to_str(campaign.get("Interview Round", []))  # Include Interview Round
        )
# this is class is for creating a campaign , managing campaigns 

class CampaignManager:
    def __init__(self):
        self.mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        self.client = MongoClient(self.mongo_uri)
        self.db = self.client["calendar_app"]
        self.campaign_manager_collection = self.db["campaign_manager"]
        self.client_collection = self.db["clients"]

    async def create_manager_campaign(self, campaign: ManagerCampaignCreate) -> ManagerCampaignResponse:
        logger.info(f"Creating campaign for client_id: {campaign.client_id}")

        # Validate input fields
        if not campaign.title.strip():
            logger.error("Campaign title is required")
            raise HTTPException(status_code=400, detail="Campaign title is required")
        if not campaign.description.strip():
            logger.error("Description is required")
            raise HTTPException(status_code=400, detail="Description is required")
        if not campaign.contactPerson.strip():
            logger.error("Contact person is required")
            raise HTTPException(status_code=400, detail="Contact person is required")
        if not campaign.contactNumber.strip():
            logger.error("Contact number is required")
            raise HTTPException(status_code=400, detail="Contact number is required")
        if not campaign.location.strip():
            logger.error("Location is required")
            raise HTTPException(status_code=400, detail="Location is required")
        # Validate client_id exists
        if not self.client_collection.find_one({"_id": campaign.client_id}):
            logger.error(f"Client not found: {campaign.client_id}")
            raise HTTPException(status_code=404, detail="Client not found")

        # Create campaign data
        campaign_id = str(uuid4())
        campaign_data = {
            "_id": campaign_id,
            "title": campaign.title,
            "description": campaign.description,
            "contactPerson": campaign.contactPerson,
            "contactNumber": campaign.contactNumber,
            "location": campaign.location,
            "startDate": campaign.startDate,
            "client_id": campaign.client_id,
            "created_at": datetime.utcnow()
        }

        # Insert campaign into collection
        result = self.campaign_manager_collection.insert_one(campaign_data)
        if not result.inserted_id:
            logger.error("Failed to create campaign")
            raise HTTPException(status_code=500, detail="Failed to create campaign")

        logger.info(f"Campaign created successfully with id: {campaign_id}")
        return ManagerCampaignResponse(
            id=campaign_id,
            title=campaign.title,
            description=campaign.description,
            contactPerson=campaign.contactPerson,
            contactNumber=campaign.contactNumber,
            location=campaign.location,
            startDate=campaign.startDate,
            client_id=campaign.client_id
        )

    async def get_all_manager_campaigns(self, client_id: Optional[str] = None) -> List[ManagerCampaignResponse]:
        logger.info(f"Fetching campaigns with client_id: {client_id}")
        query = {"client_id": client_id} if client_id else {}
        try:
            campaigns = list(self.campaign_manager_collection.find(query))
            logger.info(f"Retrieved {len(campaigns)} campaigns from campaign_manager collection")
            if not campaigns:
                logger.warning("No campaigns found for the given query")
                return []

            result = []
            for campaign in campaigns:
                campaign_id = str(campaign["_id"])
                logger.debug(f"Processing campaign ID: {campaign_id}, client_id: {campaign['client_id']}")
                # Fetch client data to get logoPath
                client = self.client_collection.find_one({"_id": campaign["client_id"]})
                if client:
                    logo_path = client.get("logoPath")
                    logger.debug(f"Client found: {client['companyName']}, logoPath: {logo_path}")
                else:
                    logo_path = None
                    logger.warning(f"No client found for client_id: {campaign['client_id']}")
                result.append(
                    ManagerCampaignResponse(
                        id=campaign_id,
                        title=campaign["title"],
                        description=campaign["description"],
                        contactPerson=campaign["contactPerson"],
                        contactNumber=campaign["contactNumber"],
                        location=campaign["location"],
                        startDate=campaign["startDate"],
                        client_id=str(campaign["client_id"]),
                        logoPath=logo_path
                    )
                )
            logger.info(f"Successfully processed {len(result)} campaigns with logo paths")
            return result
        except Exception as e:
            logger.error(f"Error fetching campaigns: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to fetch campaigns: {str(e)}")

    async def get_manager_campaign(self, campaign_id: str) -> ManagerCampaignResponse:
        campaign = self.campaign_manager_collection.find_one({"_id": campaign_id})
        if not campaign:
            logger.error(f"Campaign not found: {campaign_id}")
            raise HTTPException(status_code=404, detail="Campaign not found")

        return ManagerCampaignResponse(
            id=str(campaign["_id"]),
            title=campaign["title"],
            description=campaign["description"],
            contactPerson=campaign["contactPerson"],
            contactNumber=campaign["contactNumber"],
            location=campaign["location"],
            startDate=campaign["startDate"],
            client_id=campaign["client_id"]
        )
# this class is for creating a client 
class ClientTracker:
    def __init__(self):
        self.mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        self.client = MongoClient(self.mongo_uri)
        self.db = self.client["calendar_app"]
        self.client_collection = self.db["clients"]
        self.upload_dir = r"C:\Users\Quadrant\AM\Schedule\frontend\src\assets\logos"
        logger.info(f"Upload directory set to: {self.upload_dir}")
        os.makedirs(self.upload_dir, exist_ok=True)

    async def create_client(
        self, 
        companyName: str, 
        location: str, 
        industry: str, 
        description: str, 
        logo: Optional[UploadFile] = None
    ) -> ClientResponse:
        logger.info(f"Creating client: {companyName}")
        if not companyName.strip():
            logger.error("Company Name is required")
            raise HTTPException(status_code=400, detail="Company Name is required")
        if not location.strip():
            logger.error("Location is required")
            raise HTTPException(status_code=400, detail="Location is required")
        if not industry.strip():
            logger.error("Industry is required")
            raise HTTPException(status_code=400, detail="Industry is required")
        if not description.strip():
            logger.error("Description is required")
            raise HTTPException(status_code=400, detail="Description is required")

        client_id = str(uuid4())
        logo_path = None
        if logo:
            logger.info(f"Logo file received: {logo.filename}")
            file_extension = logo.filename.split('.')[-1].lower()
            if file_extension not in ['jpeg', 'jpg', 'png']:
                logger.error(f"Invalid file extension: {file_extension}")
                raise HTTPException(status_code=400, detail="Logo must be a JPEG, JPG, or PNG file")
            logo_filename = f"{companyName.lower().replace(' ', '-')}-logo.{file_extension}"
            local_path = os.path.join(self.upload_dir, logo_filename)
            logo_path = f"src/assets/logos/{logo_filename}"
            try:
                logger.info(f"Saving logo to: {local_path}")
                with open(local_path, "wb") as buffer:
                    shutil.copyfileobj(logo.file, buffer)
                logger.info(f"Logo saved successfully at: {local_path}")
            except Exception as e:
                logger.error(f"Failed to save logo: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Failed to save logo: {str(e)}")
        else:
            logger.info("No logo file provided")

        client_data = {
            "_id": client_id,
            "companyName": companyName,
            "location": location,
            "industry": industry,
            "description": description,
            "logoPath": logo_path,
            "created_at": datetime.utcnow()
        }
        logger.info(f"Client data to be inserted: {client_data}")

        try:
            result = self.client_collection.insert_one(client_data)
            if not result.inserted_id:
                logger.error("Failed to insert client into MongoDB")
                raise HTTPException(status_code=500, detail="Failed to create client")
            logger.info(f"Client inserted successfully with ID: {result.inserted_id}")
        except Exception as e:
            logger.error(f"MongoDB insert error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"MongoDB error: {str(e)}")

        return ClientResponse(
            id=client_id,
            companyName=companyName,
            location=location,
            industry=industry,
            description=description,
            logoPath=logo_path
        )

    async def get_all_clients(self) -> List[ClientResponse]:
        logger.info("Fetching all clients")
        try:
            clients = list(self.client_collection.find())
            logger.info(f"Retrieved {len(clients)} clients")
            return [
                ClientResponse(
                    id=str(client["_id"]),
                    companyName=client["companyName"],
                    location=client["location"],
                    industry=client["industry"],
                    description=client["description"],
                    logoPath=client.get("logoPath")
                ) for client in clients
            ]
        except Exception as e:
            logger.error(f"Error fetching clients: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch clients: {str(e)}")

    async def get_client(self, client_id: str) -> ClientResponse:
        logger.info(f"Fetching client with ID: {client_id}")
        try:
            client = self.client_collection.find_one({"_id": client_id})
            if not client:
                logger.error(f"Client not found: {client_id}")
                raise HTTPException(status_code=404, detail="Client not found")
            logger.info(f"Client found: {client['companyName']}")
            return ClientResponse(
                id=str(client["_id"]),
                companyName=client["companyName"],
                location=client["location"],
                industry=client["industry"],
                description=client["description"],
                logoPath=client.get("logoPath")
            )
        except Exception as e:
            logger.error(f"Error fetching client {client_id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch client: {str(e)}")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)