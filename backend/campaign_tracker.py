from pymongo import MongoClient
from uuid import uuid4
from datetime import datetime
from typing import Optional, Literal, List, Dict, Any
from pydantic import BaseModel
from fastapi import HTTPException, UploadFile
from bson import ObjectId
import os
import shutil

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

    def _convert_objectid_to_str(self, data: Any) -> Any:
        """Recursively convert ObjectId to string in a MongoDB document."""
        if isinstance(data, ObjectId):
            return str(data)
        elif isinstance(data, list):
            return [self._convert_objectid_to_str(item) for item in data]
        elif isinstance(data, dict):
            return {key: self._convert_objectid_to_str(value) for key, value in data.items()}
        elif isinstance(data, datetime):
            return data.isoformat()  # Convert datetime to ISO string for JSON serialization
        return data

    async def create_campaign(self, campaign: CampaignCreate) -> CampaignResponse:
        if not campaign.jobTitle.strip():
            raise HTTPException(status_code=400, detail="Job Title is required")
        if not campaign.description.strip():
            raise HTTPException(status_code=400, detail="Description is required")
        if not campaign.location.strip():
            raise HTTPException(status_code=400, detail="Location is required")
        if campaign.positions < 1:
            raise HTTPException(status_code=400, detail="At least one position is required")
        # Validate client_id exists
        if not self.client_collection.find_one({"_id": campaign.client_id}):
            raise HTTPException(status_code=404, detail="Client not found")

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
            "created_at": datetime.utcnow()
        }

        result = self.campaign_collection.insert_one(campaign_data)
        if not result.inserted_id:
            raise HTTPException(status_code=500, detail="Failed to create campaign")

        return CampaignResponse(
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
            experienceLevel=campaign.experienceLevel,
            jobType=campaign.jobType,
            client_id=campaign.client_id,
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
                endDate=campaign.get("endDate"),
                Interview=self._convert_objectid_to_str(campaign.get("Interview", []))  # Convert ObjectId in Interview array
            ) for campaign in campaigns
        ]

    async def get_campaign(self, campaign_id: str) -> CampaignResponse:
        campaign = self.campaign_collection.find_one({"_id": campaign_id})
        if not campaign:
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
            endDate=campaign.get("endDate"),
            Interview=self._convert_objectid_to_str(campaign.get("Interview", []))  # Convert ObjectId in Interview array
        )

class ClientTracker:
    def __init__(self):
        self.mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        self.client = MongoClient(self.mongo_uri)
        self.db = self.client["calendar_app"]
        self.client_collection = self.db["clients"]
        self.upload_dir = r"C:\Users\Quadrant\AM\Schedule\frontend\src\assets"
        os.makedirs(self.upload_dir, exist_ok=True)

    async def create_client(
        self, 
        companyName: str, 
        location: str, 
        industry: str, 
        description: str, 
        logo: Optional[UploadFile] = None
    ) -> ClientResponse:
        if not companyName.strip():
            raise HTTPException(status_code=400, detail="Company Name is required")
        if not location.strip():
            raise HTTPException(status_code=400, detail="Location is required")
        if not industry.strip():
            raise HTTPException(status_code=400, detail="Industry is required")
        if not description.strip():
            raise HTTPException(status_code=400, detail="Description is required")

        client_id = str(uuid4())
        logo_path = None
        if logo:
            file_extension = logo.filename.split('.')[-1].lower()
            if file_extension not in ['jpeg', 'jpg', 'png']:
                raise HTTPException(status_code=400, detail="Logo must be a JPEG, JPG, or PNG file")
            logo_path = os.path.join(self.upload_dir, f"client_{client_id}.{file_extension}")
            with open(logo_path, "wb") as buffer:
                shutil.copyfileobj(logo.file, buffer)

        client_data = {
            "_id": client_id,
            "companyName": companyName,
            "location": location,
            "industry": industry,
            "description": description,
            "logoPath": logo_path,
            "created_at": datetime.utcnow()
        }

        result = self.client_collection.insert_one(client_data)
        if not result.inserted_id:
            raise HTTPException(status_code=500, detail="Failed to create client")

        return ClientResponse(
            id=client_id,
            companyName=companyName,
            location=location,
            industry=industry,
            description=description,
            logoPath=logo_path
        )

    async def get_all_clients(self) -> List[ClientResponse]:
        clients = list(self.client_collection.find())
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

    async def get_client(self, client_id: str) -> ClientResponse:
        client = self.client_collection.find_one({"_id": client_id})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

        return ClientResponse(
            id=str(client["_id"]),
            companyName=client["companyName"],
            location=client["location"],
            industry=client["industry"],
            description=client["description"],
            logoPath=client.get("logoPath")
        )