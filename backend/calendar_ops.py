import requests
from pymongo import MongoClient
from msal import ConfidentialClientApplication
from fastapi import HTTPException
from datetime import datetime, timedelta
import pytz
import logging
from typing import Dict, Any
import httpx
from dotenv import load_dotenv
import os


load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CalendarHandler:
    def __init__(self):
        self.client_id = os.getenv("CLIENT_ID")
        self.client_secret = os.getenv("CLIENT_SECRET")
        self.authority = os.getenv("AUTHORITY")
        self.scopes = ["User.Read", "Calendars.ReadWrite", "Calendars.ReadWrite.Shared", "MailboxSettings.Read", "OnlineMeetings.ReadWrite"]
        self.mongo_client = MongoClient("mongodb://localhost:27017")
        self.db = self.mongo_client["calendar_app"]
        self.users_collection = self.db["users"]
        self.base_url = "https://graph.microsoft.com/v1.0"

    def get_msal_app(self):
        return ConfidentialClientApplication(
            self.client_id, authority=self.authority, client_credential=self.client_secret
        )

    def get_access_token(self, user_id: str):
        user = self.users_collection.find_one({"user_id": user_id})
        if not user or not user.get("refresh_token"):
            logger.error(f"No token found for user_id: {user_id}")
            raise HTTPException(status_code=400, detail="No token found; please login again")

        msal_app = self.get_msal_app()
        result = msal_app.acquire_token_by_refresh_token(
            user["refresh_token"], scopes=self.scopes
        )
        if "access_token" not in result:
            logger.error(f"Token refresh failed for user_id: {user_id}")
            raise HTTPException(status_code=400, detail="Token refresh failed")

        self.users_collection.update_one(
            {"user_id": user_id},
            {"$set": {
                "access_token": result.get("access_token"),
                "refresh_token": result.get("refresh_token", user["refresh_token"]),
                "expires_in": result.get("expires_in")
            }}
        )
        return result["access_token"]

    async def read_calendar(self, user_identifier: dict):
        user = self.users_collection.find_one({
            "$or": [
                {"display_name": user_identifier.get("display_name")},
                {"email": user_identifier.get("email")},
                {"given_name": user_identifier.get("given_name")}
            ]
        })
        if not user:
            logger.error("User not found")
            raise HTTPException(status_code=404, detail="User not found")

        user_id = user["user_id"]
        access_token = self.get_access_token(user_id)
        headers = {"Authorization": f"Bearer {access_token}"}
        graph_resp = requests.get("https://graph.microsoft.com/v1.0/me/events", headers=headers)
        graph_resp.raise_for_status()
        
        events = graph_resp.json().get("value", [])
        simplified = [
            {
                "id": event.get("id"),
                "subject": event.get("subject"),
                "start": event.get("start", {}).get("dateTime"),
                "end": event.get("end", {}).get("dateTime"),
                "location": event.get("location", {}).get("displayName"),
                "webLink": event.get("webLink"),
                "startTimeZone": event.get("start", {}).get("timeZone"),
                "endTimeZone": event.get("end", {}).get("timeZone")
            }
            for event in events
        ]
        return simplified

    async def get_user_timezone(self, user_id: str):
        access_token = self.get_access_token(user_id)
        headers = {"Authorization": f"Bearer {access_token}"}
        graph_resp = requests.get("https://graph.microsoft.com/v1.0/me/mailboxSettings/timeZone", headers=headers)
        graph_resp.raise_for_status()
        timezone = graph_resp.json().get("value", "UTC")
        try:
            pytz.timezone(timezone)  # Validate IANA
            return timezone
        except pytz.UnknownTimeZoneError:
            # Map common Windows timezones to IANA
            windows_to_iana = {
                "India Standard Time": "Asia/Kolkata",
                "Eastern Standard Time": "America/New_York",
                "Pacific Standard Time": "America/Los_Angeles",
                "Central Standard Time": "America/Chicago"
            }
            iana_tz = windows_to_iana.get(timezone, "UTC")
            logger.info(f"Converted Windows timezone {timezone} to IANA {iana_tz} for user {user_id}")
            return iana_tz

    async def create_event(self, user_id: str, event_data: dict):
        access_token = self.get_access_token(user_id)
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Prefer": f"outlook.timezone=\"{event_data['start']['timeZone']}\""
        }
        logger.info(f"create_event: Sending attendees to Graph API: {[{'email': att['emailAddress']['address'], 'type': att['type']} for att in event_data.get('attendees', [])]}")
        graph_resp = requests.post(
            "https://graph.microsoft.com/v1.0/me/events",
            headers=headers,
            json=event_data
        )
        graph_resp.raise_for_status()
        response = graph_resp.json()
        logger.info(f"create_event: Graph API response attendees: {[{'email': att['emailAddress']['address'], 'type': att['type']} for att in response.get('attendees', [])]}")
        return response
    
    async def get_event(self, user_id: str, event_id: str) -> dict:
        """
        Fetch event details from Microsoft Graph API for a given user and event.

        Args:
            user_id: The ID of the user whose calendar contains the event
            event_id: The ID of the event to fetch

        Returns:
            Dictionary containing the event details
        """
        try:
            access_token = self.get_access_token(user_id)
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            graph_resp = requests.get(
                f"https://graph.microsoft.com/v1.0/users/{user_id}/calendar/events/{event_id}",
                headers=headers
            )
            graph_resp.raise_for_status()
            logger.info(f"Successfully fetched event {event_id} for user {user_id}")
            return graph_resp.json()
        except requests.exceptions.HTTPError as e:
            logger.error(f"Graph API error fetching event {event_id}: {str(e)}")
            if e.response.status_code == 403:
                raise HTTPException(
                    status_code=403,
                    detail="Insufficient permissions to fetch event. Ensure Calendars.ReadWrite scope is granted."
                )
            if e.response.status_code == 404:
                raise HTTPException(status_code=404, detail="Event not found in calendar")
            raise HTTPException(status_code=500, detail=f"Failed to fetch event: {str(e)}")
        
    def update_event(self, user_id: str, event_id: str, event_data: Dict[str, Any], etag: str = None) -> Dict[str, Any]:
        """
        Update an event in Microsoft Graph API with the provided event data.
        
        Args:
            user_id: ID of the user who owns the event
            event_id: ID of the event to update
            event_data: Dictionary containing the fields to update (e.g., {"body": {...}})
            etag: Optional etag to include in the If-Match header for concurrency control
        
        Returns:
            Dictionary containing updated event details
        """
        try:
            access_token = self.get_access_token(user_id)
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            if etag:
                headers["If-Match"] = etag
            response = requests.patch(
                f"{self.base_url}/users/{user_id}/events/{event_id}",
                headers=headers,
                json=event_data
            )
            response.raise_for_status()
            logger.info(f"Successfully updated event {event_id} for user {user_id}")
            return response.json()
        except requests.exceptions.HTTPError as e:
            logger.error(f"Graph API error updating event {event_id}: {str(e)}")
            if e.response.status_code == 403:
                raise HTTPException(
                    status_code=403,
                    detail="Insufficient permissions to update event. Ensure Calendars.ReadWrite scope is granted."
                )
            raise HTTPException(status_code=e.response.status_code, detail=str(e))
        except Exception as e:
            logger.error(f"Unexpected error updating event {event_id}: {str(e)}")
            raise

    def parse_ms_datetime(self, time_str: str) -> datetime:
        """Parse Microsoft Graph dateTime string, handling UTC and microsecond precision."""
        original_str = time_str  # For logging
        if time_str.endswith('Z'):
            time_str = time_str[:-1]
        if '.' in time_str:
            base, micro = time_str.split('.', 1)
            micro = micro[:6]  # Truncate to 6 digits for Python compatibility
            time_str = base + ('.' + micro if micro else '')
        try:
            dt = datetime.fromisoformat(time_str).replace(tzinfo=pytz.UTC)
            return dt
        except ValueError as e:
            logger.error(f"Failed to parse dateTime '{original_str}': {e}")
            raise


    async def get_panel_events(self, user_ids: list, date: str, preferred_timezone: str):
        logger.info(f"Fetching panel events for user_ids: {user_ids}, date: {date}, timezone: {preferred_timezone}")
        try:
            if not user_ids:
                raise HTTPException(status_code=400, detail="No panel members provided")
            if preferred_timezone not in pytz.all_timezones:
                raise HTTPException(status_code=400, detail="Invalid preferred timezone")
            
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
            pref_tz = pytz.timezone(preferred_timezone)
            
            users = list(self.users_collection.find({"user_id": {"$in": user_ids}}))
            if len(users) != len(user_ids):
                raise HTTPException(status_code=404, detail="One or more users not found")
            
            user_events = {}
            for user in users:
                access_token = self.get_access_token(user["user_id"])
                headers = {"Authorization": f"Bearer {access_token}"}
                
                start_of_day = pref_tz.localize(datetime.combine(target_date, datetime.min.time()))
                end_of_day = start_of_day + timedelta(days=1)
                
                start_utc = start_of_day.astimezone(pytz.UTC).strftime("%Y-%m-%dT%H:%M:%S.000Z")
                end_utc = end_of_day.astimezone(pytz.UTC).strftime("%Y-%m-%dT%H:%M:%S.000Z")
                
                graph_resp = requests.get(
                    f"https://graph.microsoft.com/v1.0/me/calendarView?startDateTime={start_utc}&endDateTime={end_utc}",
                    headers=headers
                )
                graph_resp.raise_for_status()
                
                events = graph_resp.json().get("value", [])
                parsed_events = []
                for event in events:
                    try:
                        event_start = self.parse_ms_datetime(event["start"]["dateTime"])
                        event_end = self.parse_ms_datetime(event["end"]["dateTime"])
                        event_start_pref = event_start.astimezone(pref_tz)
                        event_end_pref = event_end.astimezone(pref_tz)
                        parsed_events.append({
                            "start": event_start_pref.isoformat(),
                            "end": event_end_pref.isoformat(),
                            "subject": event.get("subject", "No Subject")
                        })
                    except Exception as e:
                        logger.error(f"Error parsing event for user {user['user_id']}: {str(e)}")
                        continue
                user_events[user["user_id"]] = parsed_events
            
            # Calculate common working hours
            target_weekday = target_date.strftime("%A").lower()
            user_working_hours = {}
            for user in users:
                user_working_hours[user["user_id"]] = await self.get_user_working_hours(user["user_id"])
            
            working_day_for_all = all(target_weekday in info["working_days"] for info in user_working_hours.values())
            
            common_start_time = None
            common_end_time = None
            if working_day_for_all:
                for info in user_working_hours.values():
                    user_tz = pytz.timezone(info["timezone"])
                    u_start = user_tz.localize(datetime.combine(target_date, info["start_time"])).astimezone(pref_tz).time()
                    u_end = user_tz.localize(datetime.combine(target_date, info["end_time"])).astimezone(pref_tz).time()
                    if common_start_time is None or u_start > common_start_time:
                        common_start_time = u_start
                    if common_end_time is None or u_end < common_end_time:
                        common_end_time = u_end
            
            common_working = None
            if common_start_time and common_end_time and common_start_time < common_end_time:
                common_working = {
                    "start": common_start_time.strftime("%H:%M"),
                    "end": common_end_time.strftime("%H:%M")
                }
            
            return {
                "users": [{"user_id": u["user_id"], "display_name": u.get("display_name", u["email"])} for u in users],
                "events": user_events,
                "common_working": common_working,
                "working_day": working_day_for_all
            }
        except HTTPException as e:
            raise
        except Exception as e:
            logger.error(f"Unexpected error in get_panel_events: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    async def check_custom_slot(self, user_ids: list, start_str: str, end_str: str, preferred_timezone: str, interview_date: str, override: bool):
        logger.info(f"Checking custom slot for user_ids: {user_ids}, start: {start_str}, end: {end_str}, timezone: {preferred_timezone}, override: {override}")
        try:
            if not user_ids:
                return {"available": False, "reason": "No panel members provided"}
            if preferred_timezone not in pytz.all_timezones:
                return {"available": False, "reason": "Invalid preferred timezone"}
            
            pref_tz = pytz.timezone(preferred_timezone)
            start = pref_tz.localize(datetime.fromisoformat(start_str))
            end = pref_tz.localize(datetime.fromisoformat(end_str))
            
            target_date = start.date()
            if str(target_date) != interview_date or end.date() != target_date:
                return {"available": False, "reason": "Slot date does not match interview date"}
            if end <= start:
                return {"available": False, "reason": "End time before start time"}
            
            users = list(self.users_collection.find({"user_id": {"$in": user_ids}}))
            if len(users) != len(user_ids):
                return {"available": False, "reason": "One or more users not found"}
            
            target_weekday = target_date.strftime("%A").lower()
            user_working_hours = {}
            for user in users:
                user_working_hours[user["user_id"]] = await self.get_user_working_hours(user["user_id"])
            
            if not override:
                # Check working day
                if not all(target_weekday in info["working_days"] for info in user_working_hours.values()):
                    return {"available": False, "reason": "Not a working day for all panel members"}
                
                # Check common working hours
                common_start_time = None
                common_end_time = None
                for info in user_working_hours.values():
                    user_tz = pytz.timezone(info["timezone"])
                    u_start = user_tz.localize(datetime.combine(target_date, info["start_time"])).astimezone(pref_tz).time()
                    u_end = user_tz.localize(datetime.combine(target_date, info["end_time"])).astimezone(pref_tz).time()
                    if common_start_time is None or u_start > common_start_time:
                        common_start_time = u_start
                    if common_end_time is None or u_end < common_end_time:
                        common_end_time = u_end
                
                if common_start_time is None or common_end_time is None or common_start_time >= common_end_time:
                    return {"available": False, "reason": "No common working hours"}
                
                if start.time() < common_start_time or end.time() > common_end_time:
                    return {"available": False, "reason": "Slot outside common working hours"}
            
            # Check calendar conflicts
            conflicting = []
            for user in users:
                access_token = self.get_access_token(user["user_id"])
                headers = {"Authorization": f"Bearer {access_token}"}
                
                start_utc = start.astimezone(pytz.UTC).strftime("%Y-%m-%dT%H:%M:%S.000Z")
                end_utc = end.astimezone(pytz.UTC).strftime("%Y-%m-%dT%H:%M:%S.000Z")
                
                graph_resp = requests.get(
                    f"https://graph.microsoft.com/v1.0/me/calendarView?startDateTime={start_utc}&endDateTime={end_utc}",
                    headers=headers
                )
                graph_resp.raise_for_status()
                
                events = graph_resp.json().get("value", [])
                user_conflicts = []
                for event in events:
                    event_start = self.parse_ms_datetime(event["start"]["dateTime"]).astimezone(pref_tz)
                    event_end = self.parse_ms_datetime(event["end"]["dateTime"]).astimezone(pref_tz)
                    if start < event_end and end > event_start:
                        user_conflicts.append({
                            "subject": event.get("subject", "No Subject"),
                            "start": event_start.isoformat(),
                            "end": event_end.isoformat()
                        })
                if user_conflicts:
                    conflicting.append({"user_id": user["user_id"], "display_name": user.get("display_name", user["email"]), "conflicts": user_conflicts})
            
            if conflicting:
                return {"available": False, "reason": "Calendar conflicts", "conflicts": conflicting}
            
            return {"available": True}
        except Exception as e:
            logger.error(f"Unexpected error in check_custom_slot: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

   
    async def get_available_slots(self, user_ids: list, date: str, duration: int, preferred_timezone: str):
        """Get available slots considering working hours, working days, and calendar events in preferred timezone"""
        logger.info(f"Fetching available slots for user_ids: {user_ids}, date: {date}, duration: {duration}, timezone: {preferred_timezone}")
        try:
            # Validate inputs
            if not user_ids:
                logger.error("No panel members provided")
                raise HTTPException(status_code=400, detail="No panel members provided")
            if preferred_timezone not in pytz.all_timezones:
                logger.error(f"Invalid timezone: {preferred_timezone}")
                raise HTTPException(status_code=400, detail="Invalid preferred timezone")
            
            # Parse date and check if it's a valid working day
            try:
                target_date = datetime.strptime(date, "%Y-%m-%d").date()
                target_weekday = target_date.strftime("%A").lower()
            except ValueError:
                logger.error(f"Invalid date format: {date}")
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

            # Get user details and their working hours
            users = list(self.users_collection.find({"user_id": {"$in": user_ids}}))
            if len(users) != len(user_ids):
                logger.error("One or more users not found")
                raise HTTPException(status_code=404, detail="One or more users not found")

            # Get working hours for all users
            user_working_hours = {}
            for user in users:
                user_working_hours[user["user_id"]] = await self.get_user_working_hours(user["user_id"])

            # Check if the target day is a working day for ALL users
            working_day_for_all = True
            for user_id, working_info in user_working_hours.items():
                if target_weekday not in working_info["working_days"]:
                    logger.info(f"Date {date} ({target_weekday}) is not a working day for user {user_id}")
                    working_day_for_all = False
                    break

            if not working_day_for_all:
                logger.info(f"Date {date} is not a working day for all panel members")
                return []

            # Find common working hours across all users (in preferred timezone)
            pref_tz = pytz.timezone(preferred_timezone)
            common_start_time = None
            common_end_time = None

            for user_id, working_info in user_working_hours.items():
                user_tz = pytz.timezone(working_info["timezone"])
                user_start_dt = user_tz.localize(
                    datetime.combine(target_date, working_info["start_time"])
                ).astimezone(pref_tz)
                user_end_dt = user_tz.localize(
                    datetime.combine(target_date, working_info["end_time"])
                ).astimezone(pref_tz)
                
                logger.info(f"User {user_id} working hours in {preferred_timezone}: {user_start_dt.time()} - {user_end_dt.time()}")
                
                if common_start_time is None or user_start_dt.time() > common_start_time:
                    common_start_time = user_start_dt.time()
                if common_end_time is None or user_end_dt.time() < common_end_time:
                    common_end_time = user_end_dt.time()

            if common_start_time >= common_end_time:
                logger.info(f"No common working hours found. Common start: {common_start_time}, Common end: {common_end_time}")
                return []

            logger.info(f"Common working hours in {preferred_timezone}: {common_start_time} - {common_end_time}")

            # Generate slots within common working hours
            start_of_working_hours = pref_tz.localize(datetime.combine(target_date, common_start_time))
            end_of_working_hours = pref_tz.localize(datetime.combine(target_date, common_end_time))
            
            slots = []
            current_time = start_of_working_hours
            while current_time < end_of_working_hours:
                slot_end = current_time + timedelta(minutes=duration)
                if slot_end <= end_of_working_hours:
                    slots.append((current_time, slot_end))
                current_time += timedelta(minutes=duration)
            
            logger.info(f"Generated {len(slots)} slots within common working hours")

            # Function to parse Microsoft Graph dateTime (handles .0000000 and Z)
            def parse_ms_datetime(time_str: str) -> datetime:
                original_str = time_str  # For logging
                if time_str.endswith('Z'):
                    time_str = time_str[:-1]
                if '.' in time_str:
                    base, micro = time_str.split('.', 1)
                    micro = micro[:6]  # Truncate to 6 digits for Python compatibility
                    time_str = base + ('.' + micro if micro else '')
                try:
                    dt = datetime.fromisoformat(time_str).replace(tzinfo=pytz.UTC)
                    return dt
                except ValueError as e:
                    logger.error(f"Failed to parse dateTime '{original_str}': {e}")
                    raise

            # Fetch all events for each user
            user_events = {}
            for user in users:
                access_token = self.get_access_token(user["user_id"])
                headers = {"Authorization": f"Bearer {access_token}"}
                
                start_utc = start_of_working_hours.astimezone(pytz.UTC).strftime("%Y-%m-%dT%H:%M:%S.000Z")
                end_utc = end_of_working_hours.astimezone(pytz.UTC).strftime("%Y-%m-%dT%H:%M:%S.000Z")
                
                logger.debug(f"Fetching events for user {user['user_id']} from {start_utc} to {end_utc}")
                
                graph_resp = requests.get(
                    f"https://graph.microsoft.com/v1.0/me/calendarView?startDateTime={start_utc}&endDateTime={end_utc}",
                    headers=headers
                )
                graph_resp.raise_for_status()
                
                events = graph_resp.json().get("value", [])
                user_events[user["user_id"]] = []
                
                for event in events:
                    try:
                        event_start = parse_ms_datetime(event["start"]["dateTime"])
                        event_end = parse_ms_datetime(event["end"]["dateTime"])
                        event_start_pref = event_start.astimezone(pref_tz)
                        event_end_pref = event_end.astimezone(pref_tz)
                        
                        user_events[user["user_id"]].append({
                            "start": event_start_pref,
                            "end": event_end_pref,
                            "subject": event.get("subject", "No Subject")
                        })
                        
                        logger.info(f"Event for user {user['user_id']}: '{event.get('subject')}' from {event_start_pref.strftime('%Y-%m-%d %H:%M:%S %Z')} to {event_end_pref.strftime('%Y-%m-%d %H:%M:%S %Z')}")
                    except KeyError as e:
                        logger.error(f"Missing key in event for user {user['user_id']}: {e}")
                        continue
                    except ValueError as e:
                        logger.error(f"Invalid event time format for user {user['user_id']}: {e}")
                        continue

            # Check availability for each slot in preferred timezone
            available_slots = []
            for slot_start, slot_end in slots:
                is_available = True
                
                for user in users:
                    for event in user_events.get(user["user_id"], []):
                        if slot_start < event["end"] and slot_end > event["start"]:
                            logger.debug(f"Conflict found for user {user['user_id']} - Slot: {slot_start.strftime('%I:%M %p')}-{slot_end.strftime('%I:%M %p')} overlaps with event: '{event['subject']}'")
                            is_available = False
                            break
                    if not is_available:
                        break
                
                if is_available:
                    available_slots.append({
                        "start": slot_start.strftime("%I:%M %p"),
                        "end": slot_end.strftime("%I:%M %p"),
                        "date": slot_start.strftime("%Y-%m-%d")
                    })
                    logger.debug(f"Available slot: {slot_start.strftime('%I:%M %p')}-{slot_end.strftime('%I:%M %p')}")

            logger.info(f"Found {len(available_slots)} available slots within working hours")
            return available_slots
            
        except HTTPException as e:
            logger.error(f"HTTPException: {e.detail}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in get_available_slots: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_all_available_slots(self, user_ids: list, date: str, duration: int, preferred_timezone: str):
        """Get all available slots for the day in preferred timezone, considering calendar events"""
        logger.info(f"Fetching all available slots for user_ids: {user_ids}, date: {date}, duration: {duration}, timezone: {preferred_timezone}")
        try:
            # Validate inputs
            if not user_ids:
                logger.error("No panel members provided")
                raise HTTPException(status_code=400, detail="No panel members provided")
            if preferred_timezone not in pytz.all_timezones:
                logger.error(f"Invalid timezone: {preferred_timezone}")
                raise HTTPException(status_code=400, detail="Invalid preferred timezone")
            
            # Parse date
            try:
                target_date = datetime.strptime(date, "%Y-%m-%d").date()
            except ValueError:
                logger.error(f"Invalid date format: {date}")
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

            # Get user details
            users = list(self.users_collection.find({"user_id": {"$in": user_ids}}))
            if len(users) != len(user_ids):
                logger.error("One or more users not found")
                raise HTTPException(status_code=404, detail="One or more users not found")

            # Initialize time slots for the day in preferred timezone
            pref_tz = pytz.timezone(preferred_timezone)
            start_of_day = pref_tz.localize(datetime.combine(target_date, datetime.min.time()))
            end_of_day = start_of_day + timedelta(days=1)
            
            # Generate slots every 'duration' minutes
            slots = []
            current_time = start_of_day
            while current_time < end_of_day:
                slot_end = current_time + timedelta(minutes=duration)
                if slot_end <= end_of_day:
                    slots.append((current_time, slot_end))
                current_time += timedelta(minutes=duration)
            
            logger.info(f"Generated {len(slots)} slots for duration {duration} minutes")

            # Function to parse Microsoft Graph dateTime (handles .0000000 and Z)
            def parse_ms_datetime(time_str: str) -> datetime:
                original_str = time_str  # For logging
                if time_str.endswith('Z'):
                    time_str = time_str[:-1]
                if '.' in time_str:
                    base, micro = time_str.split('.', 1)
                    micro = micro[:6]  # Truncate to 6 digits for Python compatibility
                    time_str = base + ('.' + micro if micro else '')
                try:
                    dt = datetime.fromisoformat(time_str).replace(tzinfo=pytz.UTC)
                    return dt
                except ValueError as e:
                    logger.error(f"Failed to parse dateTime '{original_str}': {e}")
                    raise

            # Fetch all events for each user
            user_events = {}
            for user in users:
                access_token = self.get_access_token(user["user_id"])
                headers = {"Authorization": f"Bearer {access_token}"}
                
                start_utc = start_of_day.astimezone(pytz.UTC).strftime("%Y-%m-%dT%H:%M:%S.000Z")
                end_utc = end_of_day.astimezone(pytz.UTC).strftime("%Y-%m-%dT%H:%M:%S.000Z")
                
                logger.debug(f"Fetching events for user {user['user_id']} from {start_utc} to {end_utc}")
                
                graph_resp = requests.get(
                    f"https://graph.microsoft.com/v1.0/me/calendarView?startDateTime={start_utc}&endDateTime={end_utc}",
                    headers=headers
                )
                graph_resp.raise_for_status()
                
                events = graph_resp.json().get("value", [])
                user_events[user["user_id"]] = []
                
                for event in events:
                    try:
                        event_start = parse_ms_datetime(event["start"]["dateTime"])
                        event_end = parse_ms_datetime(event["end"]["dateTime"])
                        event_start_pref = event_start.astimezone(pref_tz)
                        event_end_pref = event_end.astimezone(pref_tz)
                        
                        user_events[user["user_id"]].append({
                            "start": event_start_pref,
                            "end": event_end_pref,
                            "subject": event.get("subject", "No Subject")
                        })
                        
                        logger.info(f"Event for user {user['user_id']}: '{event.get('subject')}' from {event_start_pref.strftime('%Y-%m-%d %H:%M:%S %Z')} to {event_end_pref.strftime('%Y-%m-%d %H:%M:%S %Z')}")
                    except KeyError as e:
                        logger.error(f"Missing key in event for user {user['user_id']}: {e}")
                        continue
                    except ValueError as e:
                        logger.error(f"Invalid event time format for user {user['user_id']}: {e}")
                        continue

            # Check availability for each slot in preferred timezone
            available_slots = []
            for slot_start, slot_end in slots:
                is_available = True
                
                for user in users:
                    for event in user_events.get(user["user_id"], []):
                        if slot_start < event["end"] and slot_end > event["start"]:
                            logger.debug(f"Conflict found for user {user['user_id']} - Slot: {slot_start.strftime('%I:%M %p')}-{slot_end.strftime('%I:%M %p')} overlaps with event: '{event['subject']}'")
                            is_available = False
                            break
                    if not is_available:
                        break
                
                if is_available:
                    available_slots.append({
                        "start": slot_start.strftime("%I:%M %p"),
                        "end": slot_end.strftime("%I:%M %p"),
                        "date": slot_start.strftime("%Y-%m-%d")
                    })
                    logger.debug(f"Available slot: {slot_start.strftime('%I:%M %p')}-{slot_end.strftime('%I:%M %p')}")

            logger.info(f"Found {len(available_slots)} available slots out of {len(slots)} total slots")
            return available_slots
            
        except HTTPException as e:
            logger.error(f"HTTPException: {e.detail}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in get_all_available_slots: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
        
    async def get_user_working_hours(self, user_id: str):
        """Get user's working hours and working days from Microsoft Graph API"""
        try:
            access_token = self.get_access_token(user_id)
            headers = {"Authorization": f"Bearer {access_token}"}
            
            # Get working hours from mailbox settings
            graph_resp = requests.get("https://graph.microsoft.com/v1.0/me/mailboxSettings", headers=headers)
            graph_resp.raise_for_status()
            
            mailbox_settings = graph_resp.json()
            working_hours = mailbox_settings.get("workingHours", {})
            
            # Default working hours if not set
            default_working_hours = {
                "daysOfWeek": ["monday", "tuesday", "wednesday", "thursday", "friday"],
                "startTime": "09:00:00.0000000",
                "endTime": "17:00:00.0000000",
                "timeZone": {"name": "UTC"}
            }
            
            # Extract working days (convert to lowercase for consistency)
            working_days = [day.lower() for day in working_hours.get("daysOfWeek", default_working_hours["daysOfWeek"])]
            
            # Extract working hours (format: "09:00:00.0000000")
            start_time_str = working_hours.get("startTime", default_working_hours["startTime"])
            end_time_str = working_hours.get("endTime", default_working_hours["endTime"])
            
            # Parse time strings (remove microseconds part)
            start_time = datetime.strptime(start_time_str.split('.')[0], "%H:%M:%S").time()
            end_time = datetime.strptime(end_time_str.split('.')[0], "%H:%M:%S").time()
            
            # Get timezone info
            timezone_info = working_hours.get("timeZone", {})
            user_timezone = timezone_info.get("name", "UTC")
            
            # Convert Windows timezone to IANA if needed
            windows_to_iana = {
                "India Standard Time": "Asia/Kolkata",
                "Eastern Standard Time": "America/New_York",
                "Pacific Standard Time": "America/Los_Angeles",
                "Central Standard Time": "America/Chicago",
                "Mountain Standard Time": "America/Denver",
                "Atlantic Standard Time": "America/Halifax",
                "Romance Standard Time": "Europe/Paris",
                "Central European Standard Time": "Europe/Berlin",
                "W. Europe Standard Time": "Europe/Berlin",
                "GMT Standard Time": "Europe/London",
                "Greenwich Standard Time": "Europe/London",
                "China Standard Time": "Asia/Shanghai",
                "Tokyo Standard Time": "Asia/Tokyo",
                "Korea Standard Time": "Asia/Seoul",
                "Singapore Standard Time": "Asia/Singapore",
                "AUS Eastern Standard Time": "Australia/Sydney",
                "AUS Central Standard Time": "Australia/Adelaide",
                "New Zealand Standard Time": "Pacific/Auckland",
                "Russian Standard Time": "Europe/Moscow",
                "Arab Standard Time": "Asia/Riyadh",
                "South Africa Standard Time": "Africa/Johannesburg",
                "Israel Standard Time": "Asia/Jerusalem",
                "Arabic Standard Time": "Asia/Baghdad",
                "E. Europe Standard Time": "Europe/Bucharest",
                "FLE Standard Time": "Europe/Helsinki",
                "GTB Standard Time": "Europe/Athens",
                "Middle East Standard Time": "Asia/Beirut",
                "Egypt Standard Time": "Africa/Cairo",
                "South America Standard Time": "America/Sao_Paulo",
                "Argentina Standard Time": "America/Argentina/Buenos_Aires",
                "Venezuela Standard Time": "America/Caracas",
                "SA Pacific Standard Time": "America/Bogota",
                "Central America Standard Time": "America/Guatemala",
                "Mexico Standard Time": "America/Mexico_City",
                "Canada Central Standard Time": "America/Regina",
                "US Mountain Standard Time": "America/Phoenix",
                "Pacific SA Standard Time": "America/Santiago",
                "Newfoundland Standard Time": "America/St_Johns",
                "Azores Standard Time": "Atlantic/Azores",
                "Cape Verde Standard Time": "Atlantic/Cape_Verde",
                "Morocco Standard Time": "Africa/Casablanca",
                "West Africa Standard Time": "Africa/Lagos",
                "Central Africa Standard Time": "Africa/Harare",
                "E. Africa Standard Time": "Africa/Nairobi",
                "Iran Standard Time": "Asia/Tehran",
                "Afghanistan Standard Time": "Asia/Kabul",
                "West Asia Standard Time": "Asia/Tashkent",
                "Pakistan Standard Time": "Asia/Karachi",
                "India Standard Time": "Asia/Kolkata",
                "Sri Lanka Standard Time": "Asia/Colombo",
                "Nepal Standard Time": "Asia/Kathmandu",
                "Central Asia Standard Time": "Asia/Almaty",
                "Bangladesh Standard Time": "Asia/Dhaka",
                "Myanmar Standard Time": "Asia/Yangon",
                "SE Asia Standard Time": "Asia/Bangkok",
                "N. Central Asia Standard Time": "Asia/Novosibirsk",
                "North Asia Standard Time": "Asia/Krasnoyarsk",
                "North Asia East Standard Time": "Asia/Irkutsk",
                "Yakutsk Standard Time": "Asia/Yakutsk",
                "Cen. Australia Standard Time": "Australia/Adelaide",
                "W. Australia Standard Time": "Australia/Perth",
                "Tasmania Standard Time": "Australia/Hobart",
                "Vladivostok Standard Time": "Asia/Vladivostok",
                "West Pacific Standard Time": "Pacific/Port_Moresby",
                "Central Pacific Standard Time": "Pacific/Guadalcanal",
                "Fiji Standard Time": "Pacific/Fiji",
                "Tonga Standard Time": "Pacific/Tongatapu",
                "Hawaiian Standard Time": "Pacific/Honolulu",
                "Alaskan Standard Time": "America/Anchorage",
                "UTC": "UTC"
            }
            
            # First try direct mapping
            if user_timezone in windows_to_iana:
                user_timezone = windows_to_iana[user_timezone]
            
            # Validate timezone
            try:
                pytz.timezone(user_timezone)  # Validate timezone
            except pytz.UnknownTimeZoneError:
                # Try to find a partial match or use alternative approach
                logger.warning(f"Unknown timezone {user_timezone} for user {user_id}")
                
                # Try to find similar timezone names (fallback strategy)
                potential_matches = []
                user_timezone_lower = user_timezone.lower()
                
                # Common timezone name patterns
                timezone_patterns = {
                    "romance": "Europe/Paris",
                    "central european": "Europe/Berlin",
                    "eastern": "America/New_York", 
                    "pacific": "America/Los_Angeles",
                    "mountain": "America/Denver",
                    "central": "America/Chicago",
                    "india": "Asia/Kolkata",
                    "china": "Asia/Shanghai",
                    "japan": "Asia/Tokyo",
                    "gmt": "Europe/London",
                    "utc": "UTC"
                }
                
                for pattern, iana_tz in timezone_patterns.items():
                    if pattern in user_timezone_lower:
                        potential_matches.append(iana_tz)
                        break
                
                if potential_matches:
                    user_timezone = potential_matches[0]
                    logger.info(f"Matched timezone pattern for {user_timezone_lower}, using {user_timezone}")
                else:
                    logger.warning(f"Could not find matching timezone for {user_timezone}, defaulting to UTC")
                    user_timezone = "UTC"
                
                # Final validation
                try:
                    pytz.timezone(user_timezone)
                except pytz.UnknownTimeZoneError:
                    logger.error(f"Final validation failed for {user_timezone}, forcing UTC")
                    user_timezone = "UTC"
            
            logger.info(f"User {user_id} working hours: {working_days} from {start_time} to {end_time} in timezone {user_timezone}")
            
            return {
                "working_days": working_days,
                "start_time": start_time,
                "end_time": end_time,
                "timezone": user_timezone
            }
            
        except Exception as e:
            logger.warning(f"Failed to get working hours for user {user_id}: {str(e)}. Using defaults.")
            return {
                "working_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
                "start_time": datetime.strptime("09:00:00", "%H:%M:%S").time(),
                "end_time": datetime.strptime("17:00:00", "%H:%M:%S").time(),
                "timezone": "UTC"
            }