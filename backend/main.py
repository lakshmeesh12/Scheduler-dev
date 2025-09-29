from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from login import LoginHandler
from calendar_ops import CalendarHandler
from event import EventScheduler
from pymongo import MongoClient
from pydantic import BaseModel
from typing import Optional, List, Dict
import pytz
import uuid
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from typing import Any, Dict, List, Optional
from fastapi import File, UploadFile
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from campaign_tracker import CampaignTracker as CampaignManager
from campaign_tracker import CampaignTracker, ClientTracker, ClientResponse, CampaignCreate, CampaignResponse, ManagerCampaignCreate, ManagerCampaignResponse, CampaignManager, TalentAcquisitionTeamMember, CampaignDetailsUpdate
from agent import Agent
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd


app = FastAPI()

agent = Agent()
login_handler = LoginHandler()
calendar_handler = CalendarHandler()
event_scheduler = EventScheduler()
campaign_tracker = CampaignTracker()
client_tracker = ClientTracker()
campaign_manager = CampaignManager()
mongo_client = MongoClient("mongodb://localhost:27017")
db = mongo_client["calendar_app"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Predefined time slots for UI time picker (every 30 minutes)
TIME_SLOTS = [f"{hour:02d}:{minute:02d}" for hour in range(24) for minute in [0, 30]]

class EventCreate(BaseModel):
    subject: str
    start: dict
    end: dict
    location: Optional[dict] = None

class UserIdentifier(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    given_name: Optional[str] = None

class WorkingHours(BaseModel):
    start_time: str
    end_time: str
    timezone: str

class PanelSelection(BaseModel):
    user_ids: List[str]
    created_by: str

class InterviewDetails(BaseModel):
    title: str
    description: str
    duration: int
    date: str
    preferred_timezone: str
    location: str
    meeting_type: Optional[str] = None


@app.get("/")
async def home():
    return {"message": "Welcome! Go to /login to sign in with Microsoft."}

@app.get("/login")
async def login():
    try:
        return await login_handler.initiate_login()
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/callback")
async def callback(request: Request):
    try:
        return await login_handler.handle_callback(request)
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/calendar")
async def get_calendar(user: UserIdentifier):
    try:
        events = await calendar_handler.read_calendar(user.dict(exclude_unset=True))
        return JSONResponse(events)
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/calendar/event")
async def create_calendar_event(user_id: str, event: EventCreate):
    try:
        event_data = event.dict(exclude_unset=True)
        result = await calendar_handler.create_event(user_id, event_data)
        return JSONResponse(result)
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/users")
async def get_all_users():
    try:
        users = list(db.users.find(
            {},
            {
                "_id": 0,
                "user_id": 1,
                "display_name": 1,
                "email": 1,
                "given_name": 1,
                "surname": 1,
                "job_title": 1
            }
        ))
        if not users:
            raise HTTPException(status_code=404, detail="No users found")
        return JSONResponse({"users": users})
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/user/settings/{user_id}")
async def set_user_settings(user_id: str, settings: WorkingHours):
    try:
        if settings.timezone not in pytz.all_timezones:
            raise HTTPException(status_code=400, detail="Invalid timezone")

        if settings.start_time not in TIME_SLOTS or settings.end_time not in TIME_SLOTS:
            raise HTTPException(status_code=400, detail="Invalid start_time or end_time. Must be in 30-minute increments (e.g., '09:00', '17:30').")

        user_doc = db.users.find_one({"user_id": user_id})
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")

        db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "working_hours": {
                    "start_time": settings.start_time,
                    "end_time": settings.end_time
                },
                "timezone": settings.timezone
            }}
        )
        return JSONResponse({"message": "User settings updated successfully"})
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/timezones")
async def get_timezones():
    try:
        return JSONResponse({"timezones": pytz.all_timezones})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/time-slots")
async def get_time_slots():
    try:
        return JSONResponse({"time_slots": TIME_SLOTS})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/panel-selection")
async def save_panel_selection(selection: PanelSelection):
    try:
        if not selection.user_ids:
            raise HTTPException(status_code=400, detail="At least one user_id is required")

        users = list(db.users.find(
            {"user_id": {"$in": selection.user_ids}},
            {"_id": 0, "user_id": 1}
        ))
        if len(users) != len(selection.user_ids):
            raise HTTPException(status_code=404, detail="One or more users not found")

        if not db.users.find_one({"user_id": selection.created_by}):
            raise HTTPException(status_code=404, detail="Creator user not found")

        session_id = str(uuid.uuid4())
        db.panel_selections.insert_one({
            "session_id": session_id,
            "user_ids": selection.user_ids,
            "created_by": selection.created_by,
            "created_at": datetime.utcnow()
        })

        return JSONResponse({"session_id": session_id})
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/interview-details/{session_id}")
async def save_interview_details(session_id: str, details: InterviewDetails):
    try:
        selection = db.panel_selections.find_one({"session_id": session_id})
        if not selection:
            raise HTTPException(status_code=404, detail="Session not found")

        if not details.title.strip():
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        if not details.description.strip():
            raise HTTPException(status_code=400, detail="Description cannot be empty")

        if details.preferred_timezone not in pytz.all_timezones:
            raise HTTPException(status_code=400, detail="Invalid preferred timezone")

        try:
            datetime.strptime(details.date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

        if details.duration <= 0:
            raise HTTPException(status_code=400, detail="Duration must be positive")

        db.panel_selections.update_one(
            {"session_id": session_id},
            {"$set": {
                "interview_details": details.dict(),
                "updated_at": datetime.utcnow()
            }}
        )

        return JSONResponse({"message": "Interview details saved successfully"})
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    
# main.py
class CustomSlot(BaseModel):
    start: str  # ISO format in preferred timezone, e.g., '2025-10-01T12:45:00'
    end: str

@app.get("/panel-events/{session_id}")
async def get_panel_events(session_id: str):
    try:
        selection = db.panel_selections.find_one({"session_id": session_id})
        if not selection:
            raise HTTPException(status_code=404, detail="Session not found")

        if "interview_details" not in selection:
            raise HTTPException(status_code=400, detail="Interview details not set")

        user_ids = selection["user_ids"]
        details = selection["interview_details"]
        date = details["date"]
        preferred_timezone = details["preferred_timezone"]

        result = await calendar_handler.get_panel_events(user_ids, date, preferred_timezone)
        
        return JSONResponse(result)
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/check-custom-slot/{session_id}")
async def check_custom_slot(session_id: str, custom_slot: CustomSlot, override: bool = False):
    try:
        selection = db.panel_selections.find_one({"session_id": session_id})
        if not selection:
            raise HTTPException(status_code=404, detail="Session not found")

        if "interview_details" not in selection:
            raise HTTPException(status_code=400, detail="Interview details not set")

        user_ids = selection["user_ids"]
        details = selection["interview_details"]
        preferred_timezone = details["preferred_timezone"]
        interview_date = details["date"]

        result = await calendar_handler.check_custom_slot(user_ids, custom_slot.start, custom_slot.end, preferred_timezone, interview_date, override)
        
        return JSONResponse(result)
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/available-slots/{session_id}")
async def get_available_slots(session_id: str):
    try:
        selection = db.panel_selections.find_one({"session_id": session_id})
        if not selection:
            raise HTTPException(status_code=404, detail="Session not found")

        if "interview_details" not in selection:
            raise HTTPException(status_code=400, detail="Interview details not set")

        user_ids = selection["user_ids"]
        details = selection["interview_details"]
        date = details["date"]
        duration = details["duration"]
        preferred_timezone = details["preferred_timezone"]

        slots = await calendar_handler.get_available_slots(user_ids, date, duration, preferred_timezone)
        
        return JSONResponse({
            "slots": slots,
            "metadata": {
                "total_slots": len(slots),
                "date": date,
                "duration_minutes": duration,
                "timezone": preferred_timezone,
                "panel_members": len(user_ids),
                "note": "Slots are filtered by common working hours and working days from Microsoft Graph"
            }
        })
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/all-available-slots/{session_id}")
async def get_all_available_slots(session_id: str):
    try:
        selection = db.panel_selections.find_one({"session_id": session_id})
        if not selection:
            raise HTTPException(status_code=404, detail="Session not found")

        if "interview_details" not in selection:
            raise HTTPException(status_code=400, detail="Interview details not set")

        user_ids = selection["user_ids"]
        details = selection["interview_details"]
        date = details["date"]
        duration = details["duration"]
        preferred_timezone = details["preferred_timezone"]

        slots = await calendar_handler.get_all_available_slots(user_ids, date, duration, preferred_timezone)
        
        return JSONResponse({
            "slots": slots,
            "metadata": {
                "total_slots": len(slots),
                "date": date,
                "duration_minutes": duration,
                "timezone": preferred_timezone,
                "panel_members": len(user_ids)
            }
        })
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    
# main.py
@app.post("/validate-custom-slot/{session_id}")
async def validate_custom_slot(session_id: str, custom_slot: dict):
    try:
        selection = db.panel_selections.find_one({"session_id": session_id})
        if not selection:
            raise HTTPException(status_code=404, detail="Session not found")

        if "interview_details" not in selection:
            raise HTTPException(status_code=400, detail="Interview details not set")

        user_ids = selection["user_ids"]
        details = selection["interview_details"]
        duration = details["duration"]
        preferred_timezone = details["preferred_timezone"]

        # Validate custom slot inputs
        start_time_str = custom_slot.get("start_time")
        date = custom_slot.get("date")
        if not start_time_str or not date:
            raise HTTPException(status_code=400, detail="Start time and date are required")

        try:
            start_time = datetime.strptime(f"{date} {start_time_str}", "%Y-%m-%d %H:%M")
            start_time = pytz.timezone(preferred_timezone).localize(start_time)
            end_time = start_time + timedelta(minutes=duration)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date or time format. Use YYYY-MM-DD and HH:MM")

        is_available = await calendar_handler.is_slot_available(user_ids, start_time, end_time, preferred_timezone)

        return JSONResponse({
            "is_available": is_available,
            "start": start_time.strftime("%Y-%m-%d %H:%M"),
            "end": end_time.strftime("%Y-%m-%d %H:%M"),
            "timezone": preferred_timezone
        })
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

class ScheduleEventRequest(BaseModel):
    slot: Dict[str, str]
    mail_template: Dict[str, str]
    candidate_email: Optional[str] = None
    candidate_name: Optional[str] = None
    recent_designation: Optional[str] = None
    to_emails: list[str]
    cc_emails: list[str]
    campaign_id: Optional[str] = None  # Add campaign_id to the request model

@app.post("/schedule-event/{session_id}")
async def schedule_event(session_id: str, request: ScheduleEventRequest):
    try:
        result = await event_scheduler.schedule_event(
            session_id,
            request.slot,
            request.mail_template,
            request.candidate_email,
            request.candidate_name,
            request.recent_designation,
            request.campaign_id,
            request.to_emails,
            request.cc_emails
        )
        return JSONResponse(result)
    except HTTPException as e:
        if e.status_code == 403:
            return JSONResponse(
                {"error": f"Permission error: {e.detail}"},
                status_code=403
            )
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)

class EventTrackerResponse(BaseModel):
    status: Optional[str] = None
    candidate: Optional[Dict[str, str]] = None  # {name, email}
    position: Optional[str] = None
    scheduled_time: Optional[Dict[str, Any]] = None  # {date, start_time, duration}
    virtual: Optional[bool] = None
    candidate_response: Optional[Dict[str, Any]] = None  # {name, email, response, response_time}
    panel_response_status: Optional[Dict[str, Any]] = None  # {summary: {accepted, declined, tentative, pending}, responses: [{name, email, role, response, response_time}]}

@app.get("/event-tracker/{session_id}", response_model=EventTrackerResponse)
async def track_event(session_id: str):
    try:
        result = await event_scheduler.track_event(session_id)
        return JSONResponse(result)
    except HTTPException as e:
        if e.status_code == 403:
            return JSONResponse(
                {"error": f"Permission error: {e.detail}"},
                status_code=403
            )
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)
    
class EventUpdateRequest(BaseModel):
    remove_emails: List[str]
    add_emails: List[str]

@app.post("/event-update/{session_id}", response_model=EventTrackerResponse)
async def update_event(session_id: str, request: EventUpdateRequest):
    try:
        result = await event_scheduler.update_event(session_id, request.remove_emails, request.add_emails)
        return JSONResponse(result)
    except HTTPException as e:
        if e.status_code == 403:
            return JSONResponse(
                {"error": f"Permission error: {e.detail}"},
                status_code=403
            )
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)


class SchedulerResponse(BaseModel):
    interviews: List[Dict[str, Any]]  # List of interview details
    statistics: Dict[str, int]        # {total, scheduled, pending, completed}

    class Interview(BaseModel):
        session_id: str
        candidate: Dict[str, str]     # {email, name, recent_designation, profile_id}
        event_start_time: str
        panel_emails: List[str]

@app.get("/scheduler", response_model=SchedulerResponse)
async def scheduler():
    try:
        result = await event_scheduler.scheduler()
        return JSONResponse(result)
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)
    
@app.post("/api/new-client", response_model=ClientResponse)
async def create_client(
    companyName: str = Form(...),
    location: str = Form(...),
    industry: str = Form(...),
    description: str = Form(...),
    logo: Optional[UploadFile] = File(None)
):
    logger.info(f"Received create client request: companyName={companyName}, location={location}, industry={industry}, description={description}")
    if logo:
        logger.info(f"Logo file received: filename={logo.filename}, size={logo.size}")
    else:
        logger.info("No logo file received")
    try:
        result = await client_tracker.create_client(companyName, location, industry, description, logo)
        logger.info(f"Client created successfully: {result.id}")
        return JSONResponse(result.dict())
    except HTTPException as e:
        logger.error(f"HTTP error: {e.detail}")
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        logger.error(f"Server error: {str(e)}")
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)

@app.get("/api/all-clients", response_model=List[ClientResponse])
async def get_all_clients():
    logger.info("Received get all clients request")
    try:
        result = await client_tracker.get_all_clients()
        logger.info(f"Returning {len(result)} clients")
        return JSONResponse([client.dict() for client in result])
    except HTTPException as e:
        logger.error(f"HTTP error: {e.detail}")
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        logger.error(f"Server error: {str(e)}")
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)

@app.get("/api/client/{client_id}", response_model=ClientResponse)
async def get_client(client_id: str):
    try:
        result = await client_tracker.get_client(client_id)
        return JSONResponse(result.dict())
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)
#to create a new job

@app.post("/api/new-campaign", response_model=CampaignResponse)
async def create_campaign(campaign: CampaignCreate):
    try:
        result = await campaign_tracker.create_campaign(campaign)  # Changed to campaign_tracker
        return JSONResponse(result.dict())
    except HTTPException as e:
        logger.error(f"Create campaign error: {e.detail}")
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        logger.error(f"Server error in create_campaign: {str(e)}")
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)
from typing import List
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=4)  # Adjust based on system resources

@app.post("/api/bulk-campaigns", response_model=List[CampaignResponse])
async def create_bulk_campaigns(files: List[UploadFile] = File(...), client_id: str = Form(...), campaign_id: str = Form(...), created_by: str = Form(...)):
    """Process multiple files in parallel to create campaigns."""
    try:
        logger.info(f"Received {len(files)} files: {[file.filename for file in files]}")
        allowed_extensions = ["pdf", "docx"]
        file_contents = []
        CHUNK_SIZE = 1024 * 1024  # 1MB chunks
        for file in files:
            if not file.filename:
                raise HTTPException(status_code=400, detail="No filename provided for one or more files")
            file_ext = file.filename.split(".")[-1].lower()
            if file_ext not in allowed_extensions:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file format: {file_ext}. Supported formats: {allowed_extensions}"
                )
            content = bytearray()
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                content.extend(chunk)
            file_contents.append((content, file_ext))
            logger.debug(f"Read {len(content)} bytes from {file.filename}")

        # Process files in parallel
        tasks = [
            campaign_tracker.create_bulk_campaigns(content, file_ext, client_id, campaign_id, created_by)
            for content, file_ext in file_contents
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Flatten results and handle exceptions
        flat_results = []
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Error processing file: {str(result)}")
                continue
            flat_results.extend(result)

        if not flat_results:
            logger.error("No campaigns created due to errors in all files")
            raise HTTPException(status_code=400, detail="No campaigns created due to errors in file processing")

        logger.info(f"Created {len(flat_results)} campaigns successfully")
        return JSONResponse([result.dict() for result in flat_results])
    
    except HTTPException as e:
        logger.error(f"Bulk campaign creation error: {e.detail}")
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        logger.error(f"Server error in create_bulk_campaigns: {str(e)}")
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)

@app.on_event("shutdown")
def shutdown_event():
    logger.info("Shutting down application and cleaning up resources")
    

#to update the talent aquisation team
@app.put("/api/campaign/{campaign_id}/team", response_model=CampaignResponse)
async def update_campaign_team(campaign_id: str, talentAcquisitionTeam: List[TalentAcquisitionTeamMember]):
    try:
        logger.info(f"Updating talent acquisition team for campaign_id: {campaign_id}")
        result = await campaign_tracker.update_campaign_team(campaign_id, talentAcquisitionTeam)
        logger.info(f"Successfully updated team for campaign_id: {campaign_id}")
        return JSONResponse(result.dict())
    except HTTPException as e:
        logger.error(f"Update campaign team error: {e.detail}")
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        logger.error(f"Server error in update_campaign_team: {str(e)}")
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)
    
#to update th job details

@app.put("/api/campaign/{campaign_id}/details", response_model=CampaignResponse)
async def update_campaign_details(campaign_id: str, details: CampaignDetailsUpdate):
    try:
        logger.info(f"Updating campaign details for campaign_id: {campaign_id}")
        result = await campaign_tracker.update_campaign_details(campaign_id, details)
        logger.info(f"Successfully updated details for campaign_id: {campaign_id}")
        return JSONResponse(result.dict())
    except HTTPException as e:
        logger.error(f"Update campaign details error: {e.detail}")
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        logger.error(f"Server error in update_campaign_details: {str(e)}")
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)
# class CampaignResponse(BaseModel):
#     id: str
#     title: str
#     description: str
#     contactPerson: str
#     contactNumber: str
#     location: str
#     startDate: str
#     client_id: str
@app.get("/api/all-campaigns", response_model=List[CampaignResponse])
async def get_all_campaigns(client_id: str, campaign_id: str, request: Request = None):
    try:
        # Log raw query parameters for debugging
        logger.info(f"Raw query params: {request.query_params}")
        logger.info(f"Parsed client_id: {client_id}, campaign_id: {campaign_id}")
        
        # Validate client_id
        if not client_id or client_id.lower() == "none":
            logger.error("Client ID is missing or invalid")
            raise HTTPException(status_code=400, detail="Client ID is required")
        
        # Validate campaign_id
        if not campaign_id or campaign_id.lower() == "none":
            logger.error("Campaign ID is missing or invalid")
            raise HTTPException(status_code=400, detail="Campaign ID is required")
        
        result = await campaign_tracker.get_all_campaigns(client_id, campaign_id)
        logger.info(f"Retrieved {len(result)} jobs for client_id: {client_id}, campaign_id: {campaign_id}")
        return JSONResponse([campaign.dict() for campaign in result])
    except HTTPException as e:
        logger.error(f"Get all campaigns error: {e.detail}")
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        logger.error(f"Server error in get_all_campaigns: {str(e)}")
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)
@app.get("/api/campaign/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: str):
    try:
        logger.info(f"Fetching job with campaign_id: {campaign_id}")
        result = await campaign_tracker.get_campaign(campaign_id)  # Changed to campaign_tracker
        return JSONResponse(result.dict())
    except HTTPException as e:
        logger.error(f"Get campaign error: {e.detail}")
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        logger.error(f"Server error in get_campaign: {str(e)}")
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)

@app.post("/api/create-campaign", response_model=ManagerCampaignResponse)
async def create_manager_campaign(campaign: ManagerCampaignCreate):
    try:
        result = await campaign_manager.create_manager_campaign(campaign)
        return JSONResponse(result.dict())
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)

@app.get("/api/get-campaigns", response_model=List[ManagerCampaignResponse])
async def get_all_manager_campaigns(client_id: Optional[str] = None):
    try:
        result = await campaign_manager.get_all_manager_campaigns(client_id)
        return JSONResponse([campaign.dict() for campaign in result])
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)

@app.get("/api/each-campaign/{campaign_id}", response_model=ManagerCampaignResponse)
async def get_manager_campaign(campaign_id: str):
    try:
        logger.info(f"Fetching manager campaign with ID: {campaign_id}")
        result = await campaign_manager.get_manager_campaign(campaign_id)
        if not result:
            logger.error(f"Campaign not found for ID: {campaign_id}")
            raise HTTPException(status_code=404, detail="Campaign not found")
        logger.info(f"Successfully fetched campaign: {result.dict()}")
        return JSONResponse(result.dict())
    except HTTPException as e:
        logger.error(f"Get manager campaign error: {e.detail}")
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        logger.error(f"Server error in get_manager_campaign: {str(e)}")
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)
# Pydantic models for validation

from bson import ObjectId

rounds_collection = db["interview_rounds"]
campaign_tracker_collection = db["campaign-tracker"]

class PanelMember(BaseModel):
    user_id: str
    display_name: str
    email: str
    role: Optional[str] = None
    avatar: Optional[str] = None

class InterviewDetails(BaseModel):
    title: str
    description: str
    duration: int
    date: Optional[datetime] = None
    location: str
    meetingType: str
    preferred_timezone: str

class TimeSlot(BaseModel):
    id: str
    start: str
    end: str
    date: str
    available: bool
    availableMembers: List[str]

class InterviewRoundData(BaseModel):
    id: str
    roundNumber: int
    status: str
    panel: List[PanelMember]
    details: Optional[InterviewDetails] = None
    selectedTimeSlot: Optional[TimeSlot] = None
    schedulingOption: Optional[str] = None
    candidateId: str
    campaignId: str
    clientId: str
    sessionId: Optional[str] = None
    createdAt: datetime = datetime.utcnow()
    name: str

class CandidateRounds(BaseModel):
    candidateId: str
    campaignId: str
    clientId: str
    rounds: List[InterviewRoundData]

# Replace the save_interview_round endpoint with the following:
@app.post("/interview-rounds/")
def save_interview_round(round: InterviewRoundData):
    print("Backend: Received request to save interview round:", round.dict())
    try:
        round_dict = round.dict()
        print("Backend: Storing candidateId as string:", round_dict["candidateId"])
        print("Backend: Storing campaignId as string:", round_dict["campaignId"])
        print("Backend: Storing clientId as string:", round_dict["clientId"])
        print("Backend: Storing sessionId as string:", round_dict["sessionId"])
        print("Backend: Storing round id:", round_dict["id"])
        
        # Save to interview_rounds collection
        query = {
            "candidateId": round_dict["candidateId"],
            "campaignId": round_dict["campaignId"],
            "clientId": round_dict["clientId"]
        }
        existing_doc = rounds_collection.find_one(query)
        
        if existing_doc:
            rounds = existing_doc.get("rounds", [])
            round_index = next((i for i, r in enumerate(rounds) if r["id"] == round_dict["id"]), -1)
            if round_index >= 0:
                rounds[round_index] = round_dict
                rounds_collection.update_one(query, {"$set": {"rounds": rounds}})
                print("Backend: Round updated successfully in interview_rounds with ID:", round_dict["id"])
            else:
                rounds.append(round_dict)
                rounds_collection.update_one(query, {"$set": {"rounds": rounds}})
                print("Backend: Round appended successfully in interview_rounds with ID:", round_dict["id"])
        else:
            new_doc = {
                "candidateId": round_dict["candidateId"],
                "campaignId": round_dict["campaignId"],
                "clientId": round_dict["clientId"],
                "rounds": [round_dict]
            }
            rounds_collection.insert_one(new_doc)
            print("Backend: New document created in interview_rounds with round ID:", round_dict["id"])
        
        # Save to campaign-tracker collection in Interview Round field
        campaign_query = {
            "client_id": round_dict["clientId"],
            "Interview.campaign_id": round_dict["campaignId"]
        }
        existing_campaign_doc = campaign_tracker_collection.find_one(campaign_query)
        
        if existing_campaign_doc:
            campaign_rounds = existing_campaign_doc.get("Interview Round", [])
            round_index = next((i for i, r in enumerate(campaign_rounds) if r["id"] == round_dict["id"] and r["candidateId"] == round_dict["candidateId"]), -1)
            if round_index >= 0:
                campaign_rounds[round_index] = round_dict
                campaign_tracker_collection.update_one(campaign_query, {"$set": {"Interview Round": campaign_rounds}})
                print("Backend: Round updated successfully in campaign-tracker Interview Round with ID:", round_dict["id"], "for candidateId:", round_dict["candidateId"])
            else:
                campaign_rounds.append(round_dict)
                campaign_tracker_collection.update_one(campaign_query, {"$set": {"Interview Round": campaign_rounds}})
                print("Backend: Round appended successfully in campaign-tracker Interview Round with ID:", round_dict["id"], "for candidateId:", round_dict["candidateId"])
        else:
            print("Backend: No campaign-tracker document found for campaign_id:", round_dict["campaignId"], "client_id:", round_dict["clientId"], "in Interview array")
            raise HTTPException(status_code=404, detail="Campaign document not found in campaign-tracker")
        
        return {"message": "Interview round saved successfully", "id": round_dict["id"]}
    except Exception as e:
        print("Backend: Unexpected error saving interview round:", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to save interview round: {str(e)}")
@app.get("/interview-rounds/{candidate_id}/{campaign_id}/{client_id}")
def get_interview_rounds(candidate_id: str, campaign_id: str, client_id: str):
    print("Backend: Fetching interview rounds for candidate_id:", candidate_id, "campaign_id:", campaign_id, "client_id:", client_id)
    try:
        query = {"candidateId": candidate_id, "campaignId": campaign_id, "clientId": client_id}
        doc = rounds_collection.find_one(query)
        if not doc:
            print("Backend: No rounds found for the given candidate, campaign, and client")
            return []
        rounds = doc.get("rounds", [])
        print("Backend: Found rounds:", rounds)
        for round in rounds:
            round["id"] = round["id"]
            round["candidateId"] = str(round["candidateId"])
            round["campaignId"] = str(round["campaignId"])
            round["clientId"] = str(round["clientId"])
            if round.get("sessionId"):
                round["sessionId"] = str(round["sessionId"])
        return rounds
    except Exception as e:
        print("Backend: Error fetching interview rounds:", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to fetch interview rounds: {str(e)}")
    
class SyncRequest(BaseModel):
    collections: Optional[List[str]] = None

class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    response: str
    context_used: int
    collections_involved: List[str]

@app.post("/sync-data")
async def sync_data(request: SyncRequest):
    """Sync MongoDB collections to Qdrant vector database"""
    try:
        return await agent.sync_data(request.collections)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Enhanced chat endpoint with relationship-aware context building"""
    try:
        result = await agent.chat(request.query)
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat processing error: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        return await agent.health_check()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

@app.get("/collections")
async def list_collections():
    """List available MongoDB collections"""
    try:
        return await agent.list_collections()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))    
    
import pandas as pd
import io

# Expected columns in the Excel/CSV file
EXPECTED_COLUMNS = [
    "S.no", "Candidate Name", "Mobile Number", "Email Id", "Total Experience",
    "Company", "CTC", "ECTC", "Offer in Hand", "Notice", "Current Location",
    "Preferred Location", "Availability for interview"
]

@app.post("/import-excel/{campaign_id}")
async def import_excel(campaign_id: str, file: UploadFile = File(...)):
    try:
        # Validate file type
        if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
            raise HTTPException(status_code=400, detail="Only Excel (.xlsx, .xls) or CSV (.csv) files are allowed")

        # Read file content
        content = await file.read()
        file_content = io.BytesIO(content)

        # Read Excel or CSV
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file_content)
        else:
            df = pd.read_excel(file_content)

        # Validate columns
        if not all(col in df.columns for col in EXPECTED_COLUMNS):
            raise HTTPException(status_code=400, detail="File does not match the required template")

        # Prepare data for MongoDB
        records = []
        for _, row in df.iterrows():
            candidate_data = {
                "candidate_id": str(uuid.uuid4()),
                "campaign_id": campaign_id,
                "s_no": row.get("S.no"),
                "candidate_name": row.get("Candidate Name"),
                "mobile_number": row.get("Mobile Number"),
                "email_id": row.get("Email Id"),
                "total_experience": row.get("Total Experience"),
                "company": row.get("Company"),
                "ctc": row.get("CTC"),
                "ectc": row.get("ECTC"),
                "offer_in_hand": row.get("Offer in Hand"),
                "notice": row.get("Notice"),
                "current_location": row.get("Current Location"),
                "preferred_location": row.get("Preferred Location"),
                "availability_for_interview": row.get("Availability for interview"),
                "created_at": datetime.now(pytz.UTC)
            }
            records.append(candidate_data)

        # Insert into MongoDB
        if records:
            result = db["excel_imports"].insert_many(records)
            return JSONResponse(
                status_code=200,
                content={
                    "message": "File imported successfully",
                    "inserted_count": len(result.inserted_ids),
                    "campaign_id": campaign_id
                }
            )
        else:
            raise HTTPException(status_code=400, detail="No valid records found in the file")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.get("/retrieve-excel/{campaign_id}")
async def retrieve_excel(campaign_id: str):
    try:
        # Query MongoDB for records matching the campaign_id
        records = list(db["excel_imports"].find({"campaign_id": campaign_id}, {"_id": 0}))  # Exclude MongoDB _id field
        
        # Convert datetime fields to ISO strings for JSON serialization
        for record in records:
            if "created_at" in record and isinstance(record["created_at"], datetime):
                record["created_at"] = record["created_at"].isoformat()
        
        if not records:
            return JSONResponse(
                status_code=200,
                content={
                    "message": "No records found for the given campaign ID",
                    "campaign_id": campaign_id,
                    "records": []
                }
            )

        return JSONResponse(
            status_code=200,
            content={
                "message": "Records retrieved successfully",
                "campaign_id": campaign_id,
                "records": records,
                "record_count": len(records)
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving records: {str(e)}")
    
@app.get("/candidate/{candidate_id}")
async def fetch_candidate(candidate_id: str):
    try:
        if not candidate_id:
            return JSONResponse(content={"message": "Please enter valid candidate id"}, status_code=400)

        candidate = await db['excel_imports'].find_one({"candidate_id": candidate_id}, {"_id": 0})
        if not candidate:
            return JSONResponse(content={"message": "Candidate not found.\nPlease enter valid candidate id"}, status_code=400)
        
        if 'created_at' in candidate and isinstance(candidate['created_at'], datetime):
            candidate['created_at'] = candidate['created_at'].isoformat()
        
        return JSONResponse(content={"message": "Successfully fetched candidate.", "body": candidate}, status_code=200)
    except Exception as err:
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        message = f"{fname} : Line no {exc_tb.tb_lineno} - {exc_type} : {err}"
        logger.error(message)
        return JSONResponse(content={"message": "Error fetching candidate"}, status_code=500)

class ColumnSelection(BaseModel):
    session_id: str
    columns: List[str]

# In-memory cache for storing DataFrames
file_cache = {}

# Cleanup old cache entries (older than 1 hour)
def cleanup_cache():
    current_time = datetime.utcnow()
    expired_keys = [key for key, (df, timestamp) in file_cache.items() if current_time - timestamp > timedelta(hours=1)]
    for key in expired_keys:
        del file_cache[key]   
@app.post("/upload-file/columns")
async def get_file_columns(file: UploadFile = File(...)):
    try:
        # Check file extension
        if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
            raise HTTPException(status_code=400, detail="Only Excel (.xlsx, .xls) or CSV (.csv) files are supported")

        # Read file based on extension
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file.file)
        else:
            df = pd.read_excel(file.file)

        # Get column names
        columns = df.columns.tolist()

        # Generate session ID and store DataFrame in cache
        session_id = str(uuid.uuid4())
        file_cache[session_id] = (df, datetime.utcnow())

        # Clean up old cache entries
        cleanup_cache()

        return JSONResponse({"session_id": session_id, "columns": columns})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/fetch-column-data")
async def fetch_column_data(selection: ColumnSelection):
    try:
        # Check if session_id exists in cache
        if selection.session_id not in file_cache:
            raise HTTPException(status_code=404, detail="Session not found or expired")

        # Get DataFrame from cache
        df, _ = file_cache[selection.session_id]

        # Validate selected columns
        invalid_columns = [col for col in selection.columns if col not in df.columns]
        if invalid_columns:
            raise HTTPException(status_code=400, detail=f"Invalid column names: {invalid_columns}")

        # Get data for selected columns
        selected_data = df[selection.columns].to_dict(orient="records")

        # Clean up old cache entries
        cleanup_cache()

        return JSONResponse({"data": selected_data})
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    
class DriveDetails(BaseModel):
    clientId: str
    title: str
    description: str

class ScheduleDrivesRequest(BaseModel):
    drive_details: DriveDetails
    slot: Dict[str, str]  # {date: "YYYY-MM-DD", start_time: "HH:MM", end_time: "HH:MM"}
    mail_template: Dict[str, str]  # {subject: str, body: str}
    to_emails: List[str]
    cc_emails: Optional[List[str]] = None
    timezone: str
    campaign_id: Optional[str] = None

@app.post("/schedule-drives/{session_id}")
async def schedule_drives(session_id: str, request: ScheduleDrivesRequest):
    try:
        result = await event_scheduler.schedule_drives(
            session_id,
            request.drive_details.dict(),
            request.slot,
            request.mail_template,
            request.to_emails,
            request.cc_emails,
            request.timezone,
            request.campaign_id
        )
        return JSONResponse(result)
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)
    
# Pydantic model for drive response
class DriveResponse(BaseModel):
    id: str
    client_id: str
    title: str
    description: str
    date: str
    start_time: str
    end_time: str
    timezone: str
    to_emails: List[str]
    cc_emails: List[str]
    event_id: str
    campaign_id: Optional[str]
    created_at: str

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str
        }

# Endpoint to retrieve all drives by client_id
@app.get("/drives/{client_id}", response_model=List[DriveResponse])
def get_drives_by_client(client_id: str):
    drives_collection = db["drives"]
    drives = list(drives_collection.find({"client_id": client_id}))
    
    if not drives:
        raise HTTPException(status_code=404, detail="No drives found for the given client ID")
    
    # Convert MongoDB documents to response model
    return [
        DriveResponse(
            id=str(drive["_id"]),
            client_id=drive["client_id"],
            title=drive["title"],
            description=drive["description"],
            date=drive["date"],
            start_time=drive["start_time"],
            end_time=drive["end_time"],
            timezone=drive["timezone"],
            to_emails=drive["to_emails"],
            cc_emails=drive["cc_emails"],
            event_id=drive["event_id"],
            campaign_id=drive.get("campaign_id"),
            created_at=drive["created_at"].isoformat()
        )
        for drive in drives
    ]
    
class Employee(BaseModel):
    name: str
    title: str

@app.get("/employees", response_model=List[Employee])
async def get_employees():
    """
    Retrieve a list of employees with their names and titles from the profiles collection.
    
    Returns:
        List of employees with name and title (designation from work_history[0])
    """
    logger = logging.getLogger(__name__)
    
    try:
        # Use the provided mongo_db configuration
        collection = mongo_db["profiles"]
        
        # Query all active profiles and select only name and work_history
        profiles = collection.find({"active": True}, {"name": 1, "work_history": 1, "_id": 0})
        
        employees = []
        async for profile in profiles:
            # Extract designation from work_history[0] if it exists
            title = (
                profile["work_history"][0]["designation"]
                if "work_history" in profile and profile["work_history"] and len(profile["work_history"]) > 0
                else "Unknown"
            )
            employees.append({
                "name": profile.get("name", "Unknown"),
                "title": title
            })
        
        if not employees:
            logger.info("No active employees found in profiles collection")
            return []
        
        logger.info(f"Retrieved {len(employees)} employees")
        return employees
    
    except Exception as err:
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        message = f"{fname} : Line no {exc_tb.tb_lineno} - {exc_type} : {err}"
        logger.error(f"Failed to retrieve employees: {message}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving employees: {str(err)}"
        )


    
#Bharadwaj

import ast
import asyncio
from datetime import datetime, timezone
import os
import json
import logging
import re
import sys
import time
import tempfile
import traceback
from typing import Any, Dict, List, Optional, Callable, Tuple
from uuid import uuid4
from functools import lru_cache
import hashlib
from io import BytesIO
import aiofiles
import concurrent
from bson import ObjectId
import httpx
import pandas as pd
from pydantic import BaseModel
import uvicorn
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile, BackgroundTasks, Query, status
from db.milvus.config import create_dataset, process_skills, vector_store
from resume_processor import Resume
from utils.chatgpt import run_chatgpt, emb_text
from db.mongo.config import db as mongo_db
from utils.parser import DocumentParser
from utils.helper import compute_duration
from process import AggregatedScore, GenericSkillMatcher, JDProcessor, JobDescription, MatchingResponse, ResumeProcessor, SkillMatchDetails, SkillPriority, create_skill_matcher, get_skill_match_details, process_all_files, process_file
from utils.prompt_templates.chunking_template import ChunkingPromptTemplate
from utils.prompt_templates.job_description_template import JobDescriptionTemplate
from utils.prompt_templates.search_preprocessing_template import SearchProcessTemplate
from utils.prompt_templates.search_route_template import QueryRoutePromptTemplate


load_dotenv("./.env")
os.environ['HUGGINGFACE_HUB_DISABLE_SYMLINKS'] = '1'


SERVER_TIMEOUT = int(os.getenv("SERVER_TIMEOUT", 10 * 60 * 1000))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", 10 * 60 * 1000)) 

CURRENT_DIR = os.getcwd().replace("\\", "/")
log_path = os.path.join(CURRENT_DIR, "logs")
print("log path:", log_path)
Path(log_path).mkdir(parents=True, exist_ok=True)

log_filename = os.path.join(log_path, "rms.log")
print("log filename:", log_filename)

logger = logging.getLogger("api_logger")
logger.setLevel(logging.INFO)

file_handler = logging.FileHandler(log_filename)
file_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/ping")
def ping():
    return {"message": "pong"}

processor = Resume()

async def process_resumes_background(file_paths: List[Tuple[bytes: str]], job_id: str,  uploaded_files_info: List[Dict]):
    """Background task to process resumes"""
    try:
        logger.info(f"Starting background processing of {len(file_paths)} files")
        # Parse files
        parser = DocumentParser(max_workers=16, batch_size=5)
        parse_result = await parser.parse_bytes(file_paths)
        if not parse_result:
            logger.error("Failed to parse files")
            return {}
        
        logger.info("Successfully parsed files")

        file_results = parse_result['stats']

        if file_results.get("failed_files"):
            logger.warning(f"Failed to read {file_results['failure_count']} files: {file_results['failed_files']}")
        
        successful_files = file_results['parsed_content']
        if not successful_files:
            logger.error("No files were successfully read")
            return
        
        logger.info(f"Successfully loaded {len(successful_files)} parsed files")
        
        # Process chunking
        chunked = []
        start_time = time.time()

        chunked = await process_all_files(successful_files)
        
        end_time = time.time()
        duration = end_time - start_time
        logger.info(f"Total processing time for {len(successful_files)} resumes: {int(duration)} seconds")
        
        if chunked:
            try:
                for rec in chunked:
                    rec['job_id'] = job_id

                logger.info("inserting profiles in database...")
                inserted = await mongo_db['profiles'].insert_many(chunked)
                logger.info(f"Successfully inserted {len(inserted.inserted_ids)} profiles into database")

                logger.info("Inseting profiles into Milvus database...")
                df = pd.DataFrame(chunked)
                dataset = await create_dataset(chunked)
                insertion = vector_store.add_documents(dataset, partition_key_field=job_id)
                if insertion:
                    logger.info("Successfully inserted data into milvus")
            except Exception as err:
                exc_type, exc_obj, exc_tb = sys.exc_info()
                fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
                message = f"{fname} : Line no {exc_tb.tb_lineno} - {exc_type} : {err} ::"
                logger.error(f"Failed to insert profiles into database: {message}")
        else:
            logger.warning("No profiles were successfully processed")
        
    except Exception as err:
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        message = f"{fname} : Line no {exc_tb.tb_lineno} - {exc_type} : {err}"
        logger.error(f"Background processing failed: {message}")
    finally:
        # Cleanup temporary files
        logger.info("Cleanup completed")

class UploadResponse(BaseModel):
    message: str
    session_id: str
    matching_results: dict
 
@app.post("/upload-resumes-v2")
async def upload_resumes(
    files: List[UploadFile] = File(...),
    job_id: str = None
):
    """
    Upload and process multiple resume files (PDF or DOCX) synchronously
   
    Args:
        files: List of uploaded files
   
    Returns:
        JSON response with processing results
    """
   
    # Input validation
    if not files:
        raise HTTPException(
            status_code=400,
            detail="No files provided"
        )
   
    if len(files) > processor.MAX_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Too many files. Maximum allowed: {processor.MAX_FILES}"
        )
   
    # Validate each file
    validation_errors = []
    valid_files = []
   
    for file in files:
        validation_result = processor.validate_file(file)
        if not validation_result["valid"]:
            validation_errors.append({
                "filename": file.filename,
                "error": validation_result["error"]
            })
        else:
            valid_files.append(file)
   
    if validation_errors:
        return JSONResponse(
            content={
                "message": "Some files failed validation",
                "errors": validation_errors,
                "valid_files_count": len(valid_files)
            },
            status_code=400
        )
   
    if not valid_files:
        raise HTTPException(
            status_code=400,
            detail="No valid files to process"
        )
   
    try:
        # Save uploaded files
        saved_files = []
        uploaded_files_info = []
       
        for file in valid_files:
            content = await file.read()
            saved_path = "resumes/" + file.filename
            saved_files.append((file.filename, content))
            checksum = hashlib.sha256(content).hexdigest()
            uploaded_files_info.append(
                {
                    "file_name": file.filename,
                    "file_path": saved_path,
                    "file_content": content,
                    "file_hash": checksum,
                    "file_type": file.content_type
                }
            )
       
        if not saved_files:
            raise HTTPException(
                status_code=500,
                detail="Failed to save any files"
            )
       
        # Process resumes synchronously
        logger.info(f"Starting processing of {len(saved_files)} files")
        result = await processor.process_resumes(saved_files)
        
        dataset = await create_dataset(result['success_data'])
        insertion = vector_store.add_documents(dataset, partition=job_id)
        if insertion:
            logger.info("Inseted data to Milvus")

        # Convert datetime and ObjectId objects to strings in the result
        for profile in result["stats"]["parsed_content"].values():
            if "processed_at" in profile and isinstance(profile["processed_at"], datetime):
                profile["processed_at"] = profile["processed_at"].isoformat()
            if "_id" in profile and isinstance(profile["_id"], ObjectId):
                profile["_id"] = str(profile["_id"])
       
        response_data = {
            "message": result["message"],
            "stats": result["stats"],
            "session_id": str(hashlib.md5(str(saved_files).encode()).hexdigest()),
            "matching_results": result["stats"]["parsed_content"]
        }
       
        return JSONResponse(
            content=response_data,
            status_code=200
        )
   
    except Exception as err:
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        message = f"{fname} : Line no {exc_tb.tb_lineno} - {exc_type} : {err}"
        logger.error(f"Failed to process resumes: {message}")
       
        raise HTTPException(
            status_code=500,
            detail=f"Error processing resumes: {str(err)}"
        )
 

@app.post("/upload-resumes")
async def upload_resumes(
    background_tasks: BackgroundTasks,
    job_id: str,
    files: List[UploadFile] = File(...)
):
    """
    Upload and process multiple resume files (PDF or DOCX)
    
    Args:
        background_tasks: FastAPI background tasks
        files: List of uploaded files
    
    Returns:
        JSON response with status and message
    """
    
    # Input validation
    if not files:
        raise HTTPException(
            status_code=400, 
            detail="No files provided"
        )
    
    if len(files) > processor.MAX_FILES:
        raise HTTPException(
            status_code=400, 
            detail=f"Too many files. Maximum allowed: {processor.MAX_FILES}"
        )
    
    # Validate each file
    validation_errors = []
    valid_files = []
    
    for file in files:
        validation_result = processor.validate_file(file)
        if not validation_result["valid"]:
            validation_errors.append({
                "filename": file.filename,
                "error": validation_result["error"]
            })
        else:
            valid_files.append(file)
    
    if validation_errors:
        return JSONResponse(
            content={
                "message": "Some files failed validation",
                "errors": validation_errors,
                "valid_files_count": len(valid_files)
            },
            status_code=400
        )
    
    if not valid_files:
        raise HTTPException(
            status_code=400,
            detail="No valid files to process"
        )
    
    try:
        # Save uploaded files
        saved_files = []
        save_errors = []
        uploaded_files_info = []
        
        for file in valid_files:
            content = await file.read()
            # saved_path = await upload_file_to_s3(file_path+file_name, "upload_resume", user_id)
            saved_path = "resumes/"+ file.filename
            saved_files.append((content, file.filename))
            checksum = hashlib.sha256(content).hexdigest()
            uploaded_files_info.append(
                {
                    "file_name": file.filename,
                    "file_path": saved_path,
                    "file_content": content,
                    "file_hash": checksum,
                    "file_type": file.content_type
                }
            )
        
        if not saved_files:
            raise HTTPException(
                status_code=500,
                detail="Failed to save any files"
            )
        
        # Add background task for processing
        background_tasks.add_task(
            process_resumes_background,
            saved_files,
            job_id,
            uploaded_files_info
        )
        
        logger.info(f"Started background processing for {len(saved_files)} files")
        
        response_data = {
            "message": "Files uploaded successfully. Processing started in background.",
            "uploaded_files_count": len(saved_files),
            "status": "PROCESSING"
        }
        
        if save_errors:
            response_data["save_errors"] = save_errors
        
        return JSONResponse(
            content=response_data,
            status_code=202
        )
    
    except Exception as err:
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        message = f"{fname} : Line no {exc_tb.tb_lineno} - {exc_type} : {err}"
        logger.error(f"Failed to process resumes: {str(message)}")
        
        # Cleanup any saved files on error
        if 'saved_files' in locals():
            processor.cleanup_files(saved_files)
        
        raise HTTPException(
            status_code=500,
            detail=f"Error processing resumes: {str(err)}"
        )


@app.get("/fetch-job-titles/{job_id}")
async def fetch_job_titles(job_id: str):
    try:
        job_titles = await mongo_db['profiles'].find(
            {"job_id": job_id}, 
            {"_id": 0, "job_title": 1}
        ).to_list()

        job_titles = [x for x in job_titles if x]

        message = "Successfully fetched job_titles!" if job_titles else "No Job Titles found!"    
        logger.info(message)
        return JSONResponse(content={"message": message, "body": job_titles}, status_code=200)
    except Exception as err:
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        message = f"{fname} : Line no {exc_tb.tb_lineno} - {exc_type} : {err}"
        logger.error(f"failed to fetch job titiles: {message}")
        return JSONResponse(content={"message": "failed to fetch job titiles", "body": []}, status_code=500)


@app.get("/fetch-certifications/{job_id}")
async def fetch_certs(job_id: str):
    try:
        certs = []
        async for rec in mongo_db['profiles'].find({"job_id": job_id}, {"_id": 0, "certifications": 1}):
            if isinstance(rec, list):
                certs.extend(rec)
            elif isinstance(rec, str):
                certs.append(rec)

        message = "Successfully fetched certs!" if certs else "No Job Titles found!"    
        logger.info(message)
        return JSONResponse(content={"message": message, "body": certs}, status_code=200)
    except Exception as err:
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        message = f"{fname} : Line no {exc_tb.tb_lineno} - {exc_type} : {err}"
        logger.error(f"failed to fetch job titiles: {message}")
        return JSONResponse(content={"message": "failed to fetch job titiles", "body": []}, status_code=500)


@app.get("/fetch-skills/{job_id}")
async def fetch_skills(job_id: str):
    try:
        skills = await mongo_db['profiles'].find(
            {"job_id": job_id}, 
            {"_id": 0, "primary_skills": 1, "secondary_skills": 1}
        ).to_list()

        skill_list = set()
        for category, subskill in skills['primary_skills'].items():
            for x,y in subskill.items():
                skill_list.update(y)
        
        for category, subskill in skills['secondary_skills'].items():
            for x,y in subskill.items():
                skill_list.update(y)

        message = "Successfully fetched skills!" if skill_list else "No Job Titles found!"    
        logger.info(message)
        return JSONResponse(content={"message": message, "body": list(skill_list)}, status_code=200)
    except Exception as err:
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        message = f"{fname} : Line no {exc_tb.tb_lineno} - {exc_type} : {err}"
        logger.error(f"failed to fetch job titiles: {message}")
        return JSONResponse(content={"message": "failed to fetch job titiles", "body": []}, status_code=500)


@app.get("/profiles")
async def get_profiles():
    try:
        profiles = await mongo_db['profiles'].find({}, {"_id": 0, "profile_id": 1}).to_list()
        profiles = [f['profile_id'] for f in profiles]
        logger.info("fetched profiles")

        return JSONResponse(
            content={
                "message": "Successfully fetched profiles!", 
                "body": {"profiles": profiles}}, 
            status_code=200
        )
    except Exception as err:
        message = f"Unable to fetch profiles {err}"
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        message = f"{fname} : Line no {exc_tb.tb_lineno} - {exc_type} : {err}"
        logger.error(message)
        return JSONResponse(content={"message": message, "body": {}}, status_code=500)


@app.get("/upload-status/{profile_id}")
async def get_upload_status(profile_id: str):
    """
    Check the status of a specific profile processing
    
    Args:
        profile_id: UUID of the profile to check
    
    Returns:
        JSON response with profile status
    """
    try:
        profile = await mongo_db['profiles'].find_one({"profile_id": profile_id})
        if profile:
            return JSONResponse(
                content={
                    "status": "completed",
                    "profile_id": profile_id,
                    "processed_at": profile.get("processed_at")
                },
                status_code=200
            )
        else:
            return JSONResponse(
                content={
                    "status": "not_found_or_processing",
                    "profile_id": profile_id
                },
                status_code=404
            )
    except Exception as e:
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        message = f"{fname} : Line no {exc_tb.tb_lineno} - {exc_type} : {e}"
        logger.error(f"Error checking status for profile {profile_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error checking profile status"
        )


@app.post("/jd")
async def upload_jd(
    job_description: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    try:
        jd_text = job_description or ""
        if file:
            temp_dir = tempfile.TemporaryDirectory()
            contents = await file.read()
            filename = file.filename.lower()

            with open(temp_dir+filename, "w") as f:
                f.write(contents)

            if filename.endswith('.txt'):
                file_text = contents.decode('utf-8')
            elif filename.endswith('.pdf') or filename.endswith('.docx'):
                file_text = await parse_files(temp_dir+filename)
            else:
                return JSONResponse(content={"message": "Unsupported file type"}, status_code=400)

            os.remove(temp_dir+filename)
            filename = filename.split(".")[0] + "doctags.txt"

            with open("temp/"+filename, "r", encoding="utf-8") as f:
                jd_data = f.read()
            jd_text += "\n" + jd_data 

        if jd_text:
            prompt = JobDescriptionTemplate(jd_text)
            system_prompt = "You are expert in extracting content from job description"
            jd = await run_chatgpt(prompt.prompt, system_prompt, 0.5)
            jd = json.loads(jd.replace("```", '').lstrip("python\n"))
            logger.info("Contents extracted from job description")
            jd.update({"job_description": jd_text, "job_id": str(uuid4())})
            inserted = await mongo_db['job'].insert_one(jd)
            logger.info("jd info inserted in database")
            return JSONResponse(content={"message":"Successfully uploaded Job Desciption"}, status_code=200)
        logger.info("No job description found")
        return JSONResponse(content={"message": "No job description found!"}, status_code=200)
    
    except Exception as err:
        logger.error(f"Error processing JD  {err}")
        return JSONResponse(content={"message": "Error processing Job Description"}, status_code=500)


@app.post("/find-match")
async def get_matching_resumes(
    job_description: str = Form(None),
    job_id: Optional[str] = None
):
    """
    Find matching resumes for a specific job with aggregated scoring
    
    Formula: (score1 + (0.5 * score2) + (0.5 * score3) + score4) / 3 + additional_score
    Where:
    - score1: primary_skills vs primary_skills
    - score2: primary_skills vs secondary_skills  
    - score3: secondary_skills vs primary_skills
    - score4: secondary_skills vs secondary_skills
    """
    start_time = datetime.now()
    
    try:
        # Validate job_id format
        if not job_description:
            raise HTTPException(status_code=400, detail="job description is required and cannot be empty")
        data = []
        jd_text = job_description or ""
        # if file.filename:
        #     temp_dir = tempfile.gettempdir().replace(r"\\","/")
        #     contents = await file.read()
        #     filename = file.filename
        #     temp_file = os.path.join(temp_dir, filename)
        #     with open(temp_file, "wb") as f:
        #         f.write(contents)

        #     if filename.endswith('.txt'):
        #         file_stats = contents.decode('utf-8')
        #     elif filename.endswith('.pdf') or filename.endswith('.docx'):
        #         parser = DocumentParser(max_workers=1, batch_size=1)
        #         file_stats = await parser.parse_bytes(contents)
        #         file_data = file_stats['stats']['parsed_content']
                
        #         for k,v in file_data.items():
        #             await process_file(k, v, data)
        #     else:
        #         return JSONResponse(content={"message": "Unsupported file type"}, status_code=400)

        #     os.remove(temp_file)
        #     filename = filename.split(".")[0] + "doctags.txt"

        #     with open("temp/"+filename, "r", encoding="utf-8") as f:
        #         jd_data = f.read()
        #     jd_text += "\n" + jd_data 

        jd = {}
        if jd_text:
            prompt = JobDescriptionTemplate(jd_text)
            system_prompt = "You are expert in extracting content from job description"
            jd = await run_chatgpt(prompt.prompt, system_prompt, 0.4)
            jd = json.loads(jd.replace("```", '').lstrip("python\n"))
            logger.info("Contents extracted from job description")
            print(jd.keys())
            additional_info = "\n".join(jd["other_specifications"]) if jd.get("other_specifications") else job_description
            print(additional_info)
            
            # prompt = QueryRoutePromptTemplate(additional_info)
            # response = await run_chatgpt(prompt.user_prompt, prompt.system_prompt, 0.4)
            # expr = json.loads(response)
            # expr = expr['expr']
            # print(expr)

        # Initialize matcher and results
        matcher = GenericSkillMatcher()
        matches = []

        # Validate job description structure
        required_job_fields = ['job_title', 'primary_skills', 'secondary_skills']
        missing_job_fields = [field for field in required_job_fields if field not in jd]
        if missing_job_fields:
            raise HTTPException(
                status_code=400, 
                detail=f"Job description missing required fields: {missing_job_fields}"
            )
        
        job_title = jd.get('job_title', '')
        if job_title:
            logger.info(f"Processing job: {job_title}")
        else:
            logger.info("No job title available")

        # Fetch matching resumes
        resumes_cursor = mongo_db['profiles'].find({
            "active": True
        }, {"_id": 0})
        resumes = await resumes_cursor.to_list(length=None)
        
        if not resumes:
            logger.warning(f"No active resumes found for job_title: {job_title}")
            return MatchingResponse(
                jd_text=jd_text,
                job_title=job_title,
                total_resumes_processed=0,
                matching_results=[],
                timestamp=start_time,
                execution_time_ms=0.0
            )
        
        expr = f"namespace=={job_id}" if job_id else ""

        result = vector_store.similarity_search_with_relevance_scores(
            query=additional_info,
            partition_name=job_id,
            expr=expr,
            k=20,
        )

        res = {}

        for rec, score in result:
            key = rec.metadata['profile_id']
            res.update({key: score})

        # Process each resume
        for resume in resumes:
            try:
                # Validate resume structure
                required_resume_fields = ['name', 'primary_skills', 'secondary_skills']
                missing_resume_fields = [field for field in required_resume_fields if field not in resume]
                if missing_resume_fields:
                    logger.warning(f"Resume {resume.get('profile_id', 'unknown')} missing fields: {missing_resume_fields}")
                    continue
                
                # Calculate individual scores
                score1 = matcher.calculate_skill_match_score(
                    resume['primary_skills'], jd['primary_skills']
                )['overall_score']
                
                score2 = matcher.calculate_skill_match_score(
                    resume['primary_skills'], jd['secondary_skills']
                )['overall_score']
                
                score3 = matcher.calculate_skill_match_score(
                    resume['secondary_skills'], jd['primary_skills']
                )['overall_score']
                
                score4 = matcher.calculate_skill_match_score(
                    resume['secondary_skills'], jd['secondary_skills']
                )['overall_score']

                # additional fields score
                profile_id = resume.get("profile_id")
                add_score = res.get(profile_id, 0)
                
                # Calculate aggregated score using the specified formula
                aggregated_score = ((0.8 * score1) + (0.15 * score2) + (0.025 * score3) + (0.025 * score4))
                aggregated_score = (0.7 * aggregated_score) + (0.3 * add_score)
                aggregated_score = min(1, aggregated_score)
                
                # Get detailed skill matching for primary vs primary and secondary vs secondary
                primary_vs_primary = get_skill_match_details(
                    resume['primary_skills'], jd['primary_skills'], matcher
                )
                
                secondary_vs_secondary = get_skill_match_details(
                    resume['secondary_skills'], jd['secondary_skills'], matcher
                )
                
                # Create result object
                result = AggregatedScore(
                    resume_name=resume['name'],
                    profile_id=str(resume.get('profile_id', '')),
                    aggregated_score=round(aggregated_score, 2),
                    score_breakdown={
                        'primary_vs_primary': min(1,round(score1, 2)),
                        'primary_vs_secondary': min(1, round(score2, 2)),
                        'secondary_vs_primary': min(1, round(score3, 2)),
                        'secondary_vs_secondary': min(1, round(score4, 2))
                    },
                    vector_score=round(add_score, 2),
                    primary_vs_primary=primary_vs_primary,
                    secondary_vs_secondary=secondary_vs_secondary
                )
                
                matches.append(result)
                
            except Exception as resume_error:
                logger.error(f"Error processing resume {resume.get('profile_id', 'unknown')}: {resume_error}")
                continue
        
        # Sort by aggregated score (descending) and assign ranks
        matches = [x for x in matches if x.aggregated_score>0.2]
        matches.sort(key=lambda x: x.aggregated_score, reverse=True)
        for i, match in enumerate(matches, 1):
            match.rank = i
        
        # Calculate execution time
        end_time = datetime.now()
        execution_time_ms = (end_time - start_time).total_seconds() * 1000
        
        logger.info(f"Processed {len(matches)} resumes for {job_title} job in {execution_time_ms:.2f}ms")
        
        return MatchingResponse(
            jd_text=jd_text,
            job_title=job_title,
            total_resumes_processed=len(matches),
            matching_results=matches,
            timestamp=start_time,
            execution_time_ms=round(execution_time_ms, 2)
        )
        
    except HTTPException:
        raise
    except Exception as err:
        print(err)
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        message = f"{fname} : Line no {exc_tb.tb_lineno} - {exc_type} : {err}"
        logger.error(f"Unexpected error in get_matching_resumes: {message}")
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error: {str(err)}"
        )


@app.get("/profile/{profile_id}")
async def fetch_profile(profile_id: str):
    try:
        if not profile_id:
            return JSONResponse(content={"message": "Please enter valid profile id"}, status_code=400)

        profile = await mongo_db['profiles'].find_one({"profile_id": profile_id}, {"_id": 0})
        if not profile:
            return JSONResponse(content={"message": "Profile not found.\nPlease enter valid profile id"}, status_code=400)
        profile['processed_at'] = str(profile['processed_at'])
        return JSONResponse(content={"message": "Successfully fetched profile.", "body": profile}, status_code=200)
    except Exception as err:
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        message = f"{fname} : Line no {exc_tb.tb_lineno} - {exc_type} : {err}"
        logger.error(message)
        return JSONResponse(content={"message": "Error fetching profile"}, status_code=500)    


@app.get("/resume/{resume_id}/score/{job_description_id}")
async def get_resume_score(
    resume_id: str,
    job_description_id: str,
    skill_priorities: Optional[SkillPriority] = None
):
    """
    Get detailed skill matching score for a specific resume against a job description
    """
    try:
        # Validate ObjectId formats
        if not ObjectId.is_valid(resume_id):
            raise HTTPException(status_code=400, detail="Invalid resume_id format")
        if not ObjectId.is_valid(job_description_id):
            raise HTTPException(status_code=400, detail="Invalid job_description_id format")
        
        # Fetch resume and job description
        resume = db_manager.get_resume_by_id(resume_id)
        job_description = db_manager.get_job_description(job_description_id)
        
        # Validate skills fields
        if 'skills' not in resume:
            raise HTTPException(status_code=400, detail="Resume missing 'skills' field")
        if 'skills' not in job_description:
            raise HTTPException(status_code=400, detail="Job description missing 'skills' field")
        
        # Create skill matcher and calculate score
        matcher = create_skill_matcher(job_description, skill_priorities)
        score_result = matcher.calculate_skill_match_score(
            resume['skills'], 
            job_description['skills']
        )
        
        return {
            "resume_id": resume_id,
            "job_description_id": job_description_id,
            "scoring_details": score_result,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating resume score: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


class SearchObj(BaseModel):
    search_query: Optional[str] = ""
    filters: Optional[Dict]
    page_size: Optional[int] = 10
    page_number: Optional[int] = 1

# search based on employees
@app.post("/ai/query-match")
async def search_profiles(
    body: SearchObj, 
    ):
    """
    The `search_profiles` function retrieves profiles based on a search query, filters, and pagination
    parameters, utilizing sparse and dense embeddings for search retrieval.
    
    :param search_query: The `search_query` parameter is a required string input that represents the
    search term used for vector search. It is used to search for profiles based on the provided query
    :type search_query: str
    :param filters: The `filters` parameter in the `search_profiles` function is used to provide
    additional filtering criteria for the search operation. It is a JSON field where you can specify
    specific conditions or constraints that the search results must satisfy. These filters can be used
    to narrow down the search results based on various attributes or
    :type filters: Optional[str]
    :param top_k: The `top_k` parameter specifies the number of top profiles to be fetched in the search
    results. In the provided code snippet, the default value for `top_k` is set to 3, meaning that by
    default, the search operation will return the top 3 matching profiles. This parameter can
    :type top_k: Optional[int]
    :param page_size: The `page_size` parameter in the `search_profiles` function specifies the number
    of records per page to be displayed in the search results. In the provided code snippet, the default
    value for `page_size` is set to 5, meaning that by default, the search results will display 5
    :type page_size: Optional[int]
    :param page_number: The `page_number` parameter in the `search_profiles` function represents the
    page number of the current result set. It is used for pagination to determine which page of results
    to fetch. The default value for `page_number` is set to 1, meaning that by default, the function
    will return
    :type page_number: Optional[int]
    :return: The `search_profiles` function returns a JSONResponse containing information about the
    matching records found based on the search query and filters provided. The response includes a
    message indicating the number of matching records found, the actual records retrieved, the total
    count of results, the page size, and the page number.
    """
    try:
        data = body.model_dump()
        search_query = data['search_query']
        filters = data.get('filters', {})
        client_id = data.get("client_id")
        page_size = data.get('page_size', 10)
        page_number = data.get('page_number', 1)

        # with open("./search_config.json", "r") as fc:
        #     config = json.load(fc)
        expr = f"namespace=={client_id}" if client_id else ""
        f = lambda x: f"%' OR content like '%".join(x).lstrip("%' OR ")+"%'"
        qfilters = filters if filters else {}
        if qfilters:
            for k,v in qfilters.items():
                if k=="experience":
                    v = re.sub("[^0-9]+", " ", v).strip()
                    if len(v)==2:
                        mn, mx = v.split()
                        expr += f" and (total_experience<={mx} and total_experience>={mn})"
                    elif len(v)==1:
                        expr += f" and total_experience>={v}"

                elif k=="job_title":
                    expr  += f" and (job_title=='{v}')"
                
                elif k=="certifications":
                    v = [""] + v
                    v = f(v)
                    expr += f" and ({v})"
                
                elif k=="skills":
                    v = [""] + v
                    v = f(v)
                    expr += f" and ({v})"

        search_query = search_query.strip("\n").strip()
        search_query = re.sub(r"[^A-Za-z0-9]+", " ", search_query)
        add_filters = []
        if not (search_query or qfilters):
            logger.info("Please Enter query or value in filter to search!")
            result = {}
            n = 0
            return JSONResponse(
                content={
                    "message": f"Please Enter query or value in filter to search!",
                    "body":result,
                    "result_count": n,
                    "page_size": page_size,
                    "page_number": page_number
                },
                status_code=200
            )

        if search_query:
            template = SearchProcessTemplate(search_query)
            add_filters = await run_chatgpt(template.user_prompt, template.system_prompt, 0.3)
            print("additional filters", add_filters)

        if type(add_filters)==str:
            add_filters = add_filters.lstrip("```json\n").lstrip("```python").rstrip("```")
            add_filters = ast.literal_eval(add_filters)
            
        # template = QueryRoutePromptTemplate(search_query, qfilters)
        # response = await run_chatgpt(template.user_prompt, template.system_prompt, 0.45)
        # response = response.strip("```json\n")
        # response = response.strip("```python")
        # response = response.strip("```")
        # filters = json.loads(response)

        ref_search = re.sub(r"[^A-Za-z0-9]+", " ", search_query).lower()
        expr = f"{expr.lstrip(' and ')}"
        expr = re.sub(r'[$#*&+]', "", expr).lower()

        logger.info(expr)
        logger.info("Filters generated ...")  

        offset = (page_number - 1) * page_size
        limit = page_size
        
        logger.info("Loading search...")

        score_threshold = 0.4
        if not expr:
            score_threshold = 0.6
        print(expr)
        if (ref_search or expr):
            result = vector_store.similarity_search_with_relevance_scores(
                query=ref_search,
                k=100,
                score_threshold=score_threshold,
                expr=expr
            )
        
        else:
            result = []
         
        results = {}

        for rec, score in result:
            key = rec.metadata['profile_id']
            content = rec.page_content
            total_experience = rec.metadata['total_experience']
            job_title = rec.metadata['job_title']
            if key not in results:
                results[key] = {
                    "name": rec.metadata['name'],
                    "score":score, 
                    "content": content, 
                    "total_experience": total_experience,
                    "job_title": job_title,
                    "profile_id": rec.metadata['profile_id']
                }
            else:
                results[key]['name'] = rec.metadat['name']
                results[key]['profile_id'] = rec.metadata['profile_id']
                results[key]['score'] = max(score, results[key]['score'])
                results[key]['total_experience'] = rec.metadata['total_experience']
                results[key]['content'] = content
                results[key]['job_title'] = job_title

        profile_ids = [rec for rec in results]

        find_params = {
            "profile_id": {
                "$in": profile_ids
            }
        }
        
        result = {k: results[k] for k in profile_ids}
            
        logger.info("fetched users data.")
        profile_ids = list(result.keys())
        project_params = {"_id": 0, "profile_id": 1, "primary_skills": 1, "secondary_skills": 1}

        async for rec in mongo_db['profiles'].find(find_params, project_params):
            results[rec['profile_id']]['primary_skills'] = rec['primary_skills']
            results[rec['profile_id']]['secondary_skills'] = rec['secondary_skills']
        
        n = len(result)
        
        if result:
            logger.info(f"fetched records from mongodb")
            result = sorted(result.values(), key=lambda x: -x['score'])
            result = result[offset: offset+limit]
            print(result)

        logger.info(f"Found {n} matching records!")

        return JSONResponse(
            content={
                "message": f"Found {n} matching records!",
                "body":result,
                "result_count": n,
                "page_size": page_size,
                "page_number": page_number
            },
            status_code=200
        )

    except Exception as err:
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        message = f"{fname} : Line no {exc_tb.tb_lineno} - {exc_type} : {err}"
        logger.error(f"Search failed: {message}")
        traceback_details = traceback.extract_tb(exc_tb)
        # Print the formatted stack trace
        print("Exception occurred:")
        for filename, lineno, function, text in traceback_details:
            print(f"  File: {filename}, line {lineno}, in {function}")
            print(f"    {text}")
        # logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail="Search operation failed")



if __name__ == "__main__":
    server_timeout_seconds = SERVER_TIMEOUT / 1000

    uvicorn.run(
        app, 
        host='0.0.0.0', 
        port=6000,
        timeout_keep_alive=int(server_timeout_seconds)
    )
