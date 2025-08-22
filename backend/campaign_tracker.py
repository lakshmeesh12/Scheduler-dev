# campaign_tracker.py

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

# Set up logging
logger = logging.getLogger(__name__)

class TalentAcquisitionTeamMember(BaseModel):
    name: str
    email: str
    role: Literal["Recruiter", "Hiring Manager", "Coordinator"]

class CampaignCreate(BaseModel):
    jobTitle: str
    description: str
    experienceLevel: Literal["Junior", "Mid-level", "Senior"]
    positions: int
    location: str
    department: str
    jobType: Literal["Full-time", "Part-time", "Contract"]
    startDate: str
    client_id: str
    created_by: str
    talentAcquisitionTeam: List[TalentAcquisitionTeamMember]  # Add talentAcquisitionTeam

class CampaignResponse(BaseModel):
    id: str
    jobTitle: str
    department: str
    positions: int
    status: Literal["Active", "Completed", "On Hold"]
    startDate: str
    location: str
    candidatesApplied: int
    candidatesHired: int
    currentRound: str
    description: str
    experienceLevel: Literal["Junior", "Mid-level", "Senior"]
    jobType: Literal["Full-time", "Part-time", "Contract"]
    client_id: str
    created_by: str
    created_by_name: str
    talentAcquisitionTeam: List[TalentAcquisitionTeamMember]  # Add talentAcquisitionTeam
    endDate: Optional[str] = None
    Interview: Optional[List[Dict[str, Any]]] = None

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

class CampaignTracker:
    def __init__(self):
        self.mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        self.client = MongoClient(self.mongo_uri)
        self.db = self.client["calendar_app"]
        self.campaign_collection = self.db["campaign-tracker"]
        self.client_collection = self.db["clients"]
        self.users_collection = self.db["users"]

    def _convert_objectid_to_str(self, data: Any) -> Any:
        """Recursively convert ObjectId to string in a MongoDB document."""
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
        logger.info(f"Creating campaign with created_by: {campaign.created_by}")

        # Validate input fields
        if not campaign.jobTitle.strip():
            logger.error("Job Title is required")
            raise HTTPException(status_code=400, detail="Job Title is required")
        if not campaign.description.strip():
            logger.error("Description is required")
            raise HTTPException(status_code=400, detail="Description is required")
        if not campaign.location.strip():
            logger.error("Location is required")
            raise HTTPException(status_code=400, detail="Location is required")
        if campaign.positions < 1:
            logger.error("At least one position is required")
            raise HTTPException(status_code=400, detail="At least one position is required")
        # Validate client_id exists
        if not self.client_collection.find_one({"_id": campaign.client_id}):
            logger.error(f"Client not found: {campaign.client_id}")
            raise HTTPException(status_code=404, detail="Client not found")
        # Validate talentAcquisitionTeam emails
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        for member in campaign.talentAcquisitionTeam:
            if not re.match(email_regex, member.email):
                logger.error(f"Invalid email for team member: {member.email}")
                raise HTTPException(status_code=400, detail=f"Invalid email format for team member: {member.email}")

        # Fetch user details for created_by
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

        # Create campaign data
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
            "experienceLevel": campaign.experienceLevel,
            "jobType": campaign.jobType,
            "client_id": campaign.client_id,
            "created_by": campaign.created_by,
            "created_by_name": created_by_name,
            "talentAcquisitionTeam": [member.dict() for member in campaign.talentAcquisitionTeam],
            "created_at": datetime.utcnow()
        }

        # Insert campaign into collection
        result = self.campaign_collection.insert_one(campaign_data)
        if not result.inserted_id:
            logger.error("Failed to create campaign")
            raise HTTPException(status_code=500, detail="Failed to create campaign")

        logger.info(f"Campaign created successfully with id: {campaign_id}")
        return CampaignResponse(
            id=campaign_id,
            jobTitle=campaign.jobTitle,  # Use = instead of :
            department=campaign.department,
            positions=campaign.positions,
            status="Active",
            startDate=campaign.startDate,
            location=campaign.location,
            candidatesApplied=0,
            candidatesHired=0,
            currentRound="Screening",
            description=campaign.description,
            experienceLevel=campaign.experienceLevel,
            jobType=campaign.jobType,
            client_id=campaign.client_id,
            created_by=campaign.created_by,
            created_by_name=created_by_name,
            talentAcquisitionTeam=campaign.talentAcquisitionTeam,
            endDate=None,
            Interview=[]
        )

    async def get_all_campaigns(self, client_id: Optional[str] = None) -> List[CampaignResponse]:
        query = {"client_id": client_id} if client_id else {}
        campaigns = list(self.campaign_collection.find(query))
        return [
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
                experienceLevel=campaign["experienceLevel"],
                jobType=campaign["jobType"],
                client_id=campaign["client_id"],
                created_by=campaign["created_by"],
                created_by_name=campaign["created_by_name"],
                talentAcquisitionTeam=campaign["talentAcquisitionTeam"],  # Include in response
                endDate=campaign.get("endDate"),
                Interview=self._convert_objectid_to_str(campaign.get("Interview", []))
            ) for campaign in campaigns
        ]

    async def get_campaign(self, campaign_id: str) -> CampaignResponse:
        campaign = self.campaign_collection.find_one({"_id": campaign_id})
        if not campaign:
            logger.error(f"Campaign not found: {campaign_id}")
            raise HTTPException(status_code=404, detail="Campaign not found")

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
            experienceLevel=campaign["experienceLevel"],
            jobType=campaign["jobType"],
            client_id=campaign["client_id"],
            created_by=campaign["created_by"],
            created_by_name=campaign["created_by_name"],
            talentAcquisitionTeam=campaign["talentAcquisitionTeam"],  # Include in response
            endDate=campaign.get("endDate"),
            Interview=self._convert_objectid_to_str(campaign.get("Interview", []))
        )

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ClientResponse(BaseModel):
    id: str
    companyName: str
    location: str
    industry: str
    description: str
    logoPath: Optional[str] = None

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