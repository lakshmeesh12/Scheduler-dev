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
    minExperience: int
    maxExperience: int
    positions: int
    location: str
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
    location: str
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
    def __init__(self):
        self.mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        self.client = MongoClient(self.mongo_uri)
        self.db = self.client["calendar_app"]
        self.campaign_collection = self.db["campaign-tracker"]
        self.client_collection = self.db["clients"]
        self.users_collection = self.db["users"]
        self.campaign_manager_collection = self.db["campaign_manager"]

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
        logger.info(f"Creating job with created_by: {campaign.created_by}, campaign_id: {campaign.campaign_id}")

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
        if campaign.minExperience > campaign.maxExperience:
            logger.error("Minimum experience cannot be greater than maximum experience")
            raise HTTPException(status_code=400, detail="Minimum experience cannot be greater than maximum experience")
        if not self.client_collection.find_one({"_id": campaign.client_id}):
            logger.error(f"Client not found: {campaign.client_id}")
            raise HTTPException(status_code=404, detail="Client not found")
        if not self.campaign_manager_collection.find_one({"_id": campaign.campaign_id}):
            logger.error(f"Campaign not found: {campaign.campaign_id}")
            raise HTTPException(status_code=404, detail="Campaign not found")
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        for member in campaign.talentAcquisitionTeam:
            if not re.match(email_regex, member.email):
                logger.error(f"Invalid email for team member: {member.email}")
                raise HTTPException(status_code=400, detail=f"Invalid email format for team member: {member.email}")

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

        result = self.campaign_collection.insert_one(campaign_data)
        if not result.inserted_id:
            logger.error("Failed to create job")
            raise HTTPException(status_code=500, detail="Failed to create job")

        logger.info(f"Job created successfully with id: {campaign_id}")
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
            minExperience=campaign.minExperience,
            maxExperience=campaign.maxExperience,
            jobType=campaign.jobType,
            client_id=campaign.client_id,
            campaign_id=campaign.campaign_id,
            created_by=campaign.created_by,
            created_by_name=created_by_name,
            talentAcquisitionTeam=campaign.talentAcquisitionTeam,
            endDate=None,
            Interview=[]
        )
    


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