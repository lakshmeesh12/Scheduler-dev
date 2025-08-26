import logging
from fastapi import HTTPException
from pymongo import MongoClient
from datetime import datetime, timedelta
import pytz
from typing import List, Dict, Any, Optional
import re
from calendar_ops import CalendarHandler
import base64
import os
import json

mongo_client = MongoClient("mongodb://localhost:27017")
db = mongo_client["calendar_app"]
calendar_handler = CalendarHandler()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EventScheduler:
    def __init__(self):
        self.calendar_handler = CalendarHandler()

    async def schedule_event(
        self,
        session_id: str,
        slot: Dict[str, str],
        mail_template: Dict[str, str],
        candidate_email: Optional[str] = None,
        candidate_name: Optional[str] = None,
        recent_designation: Optional[str] = None,
        campaign_id: Optional[str] = None,
        to_emails: Optional[List[str]] = None,
        cc_emails: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Schedule an Outlook event with a Teams meeting link.
        
        Args:
            session_id: ID of the panel selection session
            slot: Selected time slot with start and end times (either HH:MM:SS or ISO datetime)
            mail_template: Contains subject and body for the event
            candidate_email: Optional email of the candidate to include as an attendee
            candidate_name: Optional name of the candidate
            recent_designation: Optional designation of the candidate
            campaign_id: Optional campaign ID to associate with the event
            to_emails: List of To recipient emails (not used in this implementation)
            cc_emails: List of CC recipient emails to include as optional attendees
        """
        try:
            logger.info(f"Starting event scheduling for session_id: {session_id}, campaign_id: {campaign_id}, cc_emails: {cc_emails}")
            
            # Validate session
            session = db.panel_selections.find_one({"session_id": session_id})
            if not session:
                logger.error(f"Session not found: {session_id}")
                raise HTTPException(status_code=404, detail="Session not found")
            
            if "interview_details" not in session:
                logger.error(f"Interview details not set for session: {session_id}")
                raise HTTPException(status_code=400, detail="Interview details not set")

            # Get user details for panel members and organizer
            user_ids = session["user_ids"]
            created_by = session["created_by"]
            logger.info(f"Fetching users for user_ids: {user_ids}, created_by: {created_by}")
            
            users = list(db.users.find(
                {"user_id": {"$in": user_ids + [created_by]}},
                {"user_id": 1, "email": 1, "display_name": 1, "access_token": 1, "expires_in": 1, "last_login": 1}
            ))
            
            logger.info(f"Found {len(users)} users: {[u['user_id'] for u in users]}")
            if len(users) != len(user_ids) + 1:
                logger.error(f"One or more users not found. Expected {len(user_ids) + 1}, got {len(users)}")
                raise HTTPException(status_code=404, detail="One or more users not found")

            # Separate organizer and attendees
            organizer = next((u for u in users if u["user_id"] == created_by), None)
            logger.info(f"Organizer: {organizer}")
            attendees = [u for u in users if u["user_id"] != created_by]
            logger.info(f"Panel attendees: {[attendee['email'] for attendee in attendees]}")
            
            if not organizer or not organizer.get("email"):
                logger.error(f"Organizer not found or missing email for created_by: {created_by}")
                raise HTTPException(status_code=404, detail="Organizer email not found")

            # Check access token validity
            if not organizer.get("access_token"):
                logger.error(f"No access token found for organizer: {created_by}")
                raise HTTPException(status_code=401, detail="No access token for organizer. Please re-authenticate.")
            
            # Check token expiration
            last_login = organizer.get("last_login")
            expires_in = organizer.get("expires_in", 0)
            if last_login and expires_in:
                expiration_time = last_login + timedelta(seconds=expires_in)
                if datetime.utcnow() > expiration_time:
                    logger.error(f"Access token expired for user: {created_by}")
                    raise HTTPException(status_code=401, detail="Access token expired. Please re-authenticate via /login.")

            # Check if organizer is a personal account
            personal_domains = ["outlook.com", "hotmail.com", "live.com"]
            is_personal_account = any(domain in organizer["email"].lower() for domain in personal_domains)
            if is_personal_account:
                logger.warning(f"Organizer {organizer['email']} is a personal account. Teams meeting link may not be generated.")

            # Validate candidate_email if provided
            if candidate_email:
                email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
                if not re.match(email_regex, candidate_email):
                    logger.error(f"Invalid candidate email: {candidate_email}")
                    raise HTTPException(status_code=400, detail="Invalid candidate email format")

            # Validate cc_emails if provided
            if cc_emails:
                email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
                invalid_emails = [email for email in cc_emails if not re.match(email_regex, email)]
                if invalid_emails:
                    logger.error(f"Invalid CC emails: {invalid_emails}")
                    raise HTTPException(status_code=400, detail=f"Invalid CC email format: {invalid_emails}")
                logger.info(f"Validated CC emails: {cc_emails}")
            else:
                logger.info("No CC emails provided in the request")

            # Get interview details
            interview_details = session["interview_details"]
            timezone = interview_details["preferred_timezone"]
            logger.info(f"Interview details - timezone: {timezone}, title: {interview_details['title']}")
            
            # Validate timezone
            if timezone not in pytz.all_timezones:
                logger.error(f"Invalid timezone: {timezone}")
                raise HTTPException(status_code=400, detail="Invalid timezone")

            # Parse slot times as local times in preferred_timezone
            try:
                slot_date = interview_details["date"]  # e.g., "2025-08-23"
                # Check if slot times are in ISO datetime format or time-only
                start_time_input = slot["start"]
                end_time_input = slot["end"]
                
                # Try parsing as ISO datetime (e.g., "2025-08-23T04:00:00Z")
                try:
                    start_time_dt = datetime.fromisoformat(start_time_input.replace("Z", "+00:00"))
                    start_time_str = start_time_dt.strftime("%H:%M:%S")
                except ValueError:
                    # Assume time-only format (e.g., "04:00:00")
                    start_time_str = start_time_input
                try:
                    end_time_dt = datetime.fromisoformat(end_time_input.replace("Z", "+00:00"))
                    end_time_str = end_time_dt.strftime("%H:%M:%S")
                except ValueError:
                    # Assume time-only format (e.g., "05:00:00")
                    end_time_str = end_time_input
                
                # Combine with interview_details.date to create naive datetime
                start_time_str = f"{slot_date}T{start_time_str}"  # e.g., "2025-08-23T04:00:00"
                end_time_str = f"{slot_date}T{end_time_str}"      # e.g., "2025-08-23T05:00:00"
                
                # Parse as naive datetime
                start_time_naive = datetime.strptime(start_time_str, "%Y-%m-%dT%H:%M:%S")
                end_time_naive = datetime.strptime(end_time_str, "%Y-%m-%dT%H:%M:%S")
                
                # Localize to preferred_timezone
                preferred_tz = pytz.timezone(timezone)
                start_time_local = preferred_tz.localize(start_time_naive)
                end_time_local = preferred_tz.localize(end_time_naive)
                
                # Convert to UTC for Graph API
                start_time_utc = start_time_local.astimezone(pytz.UTC)
                end_time_utc = end_time_local.astimezone(pytz.UTC)
                
                logger.info(f"Parsed slot times in {timezone} - start: {start_time_local.isoformat()}, end: {end_time_local.isoformat()}")
                logger.info(f"Converted to UTC for Graph API - start: {start_time_utc.isoformat()}, end: {end_time_utc.isoformat()}")
            except (KeyError, ValueError) as e:
                logger.error(f"Invalid slot format: {str(e)}")
                raise HTTPException(status_code=400, detail="Invalid slot format. Must include start and end in HH:MM:SS or ISO datetime format (e.g., 2025-08-23T04:00:00Z)")

            # Load and encode logo as base64
            logo_base64 = ""
            logo_path = r"C:\Users\Quadrant\AM\Schedule\backend\images\Logo.webp"
            try:
                if os.path.exists(logo_path):
                    with open(logo_path, "rb") as logo_file:
                        logo_data = logo_file.read()
                        logo_base64 = base64.b64encode(logo_data).decode('utf-8')
                        logger.info("Logo loaded and encoded successfully")
                else:
                    logger.warning(f"Logo file not found at: {logo_path}")
            except Exception as e:
                logger.error(f"Error loading logo: {str(e)}")

            # Prepare professional email template with embedded logo
            logo_src = f"data:image/webp;base64,{logo_base64}" if logo_base64 else ""
            
            # Include CC recipients in the email greeting
            all_attendees = attendees
            if candidate_email:
                all_attendees.append({"email": candidate_email, "display_name": candidate_name or candidate_email})
            if cc_emails:
                all_attendees.extend([{"email": email, "display_name": email} for email in cc_emails])
            logger.info(f"All attendees for email greeting: {[attendee['email'] for attendee in all_attendees]}")
            
            default_body = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: Arial, sans-serif; color: #333333; line-height: 1.6; margin: 0; padding: 0; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; }}
                    .header {{ text-align: center; padding-bottom: 20px; }}
                    .header img {{ max-width: 150px; height: auto; }}
                    .content {{ padding: 20px; background-color: #f9f9f9; border-radius: 5px; }}
                    .details {{ margin: 20px 0; }}
                    .details p {{ margin: 5px 0; }}
                    .footer {{ text-align: center; font-size: 12px; color: #777777; margin-top: 20px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        {f'<img src="{logo_src}" alt="Quadrant Technologies Logo">' if logo_base64 else '<h2>Quadrant Technologies</h2>'}
                    </div>
                    <div class="content">
                        <h2>{interview_details['title']}</h2>
                        <p>Dear {', '.join([attendee.get('display_name', attendee['email']) for attendee in all_attendees])},</p>
                        <p>You are invited to an interview scheduled as follows:</p>
                        <div class="details">
                            <p><strong>Title:</strong> {interview_details['title']}</p>
                            <p><strong>Date:</strong> {slot_date}</p>
                            <p><strong>Time:</strong> {start_time_local.strftime('%H:%M')} - {end_time_local.strftime('%H:%M')} ({timezone})</p>
                            <p><strong>Location:</strong> {interview_details.get('location', 'Microsoft Teams Meeting')}</p>
                            <p><strong>Description:</strong> {interview_details.get('description', 'No additional details provided.')}</p>
                        </div>
                        <p>A Microsoft Teams meeting link will be provided below.</p>
                    </div>
                    <div class="footer">
                        <p>Quadrant Technologies | Empowering Your Future</p>
                        <p>&copy; {datetime.utcnow().year} Quadrant Technologies. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """

            # Validate mail_template body if provided
            body_content = mail_template.get("body", default_body)
            if mail_template.get("body") and not body_content.strip().startswith("<!DOCTYPE html"):
                logger.warning("Provided mail_template body is not HTML. Using default template.")
                body_content = default_body

            # Prepare event data
            event_data = {
                "subject": mail_template.get("subject", interview_details["title"]),
                "body": {
                    "contentType": "HTML",
                    "content": body_content
                },
                "start": {
                    "dateTime": start_time_utc.isoformat(),
                    "timeZone": timezone
                },
                "end": {
                    "dateTime": end_time_utc.isoformat(),
                    "timeZone": timezone
                },
                "attendees": [
                    {
                        "emailAddress": {
                            "address": attendee["email"],
                            "name": attendee.get("display_name", attendee["email"])
                        },
                        "type": "required"
                    } for attendee in attendees
                ],
                "isOnlineMeeting": True,
                "onlineMeetingProvider": "teamsForBusiness",
                "location": {
                    "displayName": interview_details.get("location", "Microsoft Teams Meeting")
                }
            }

            # Add candidate to attendees if provided, avoiding duplicates
            if candidate_email:
                if not any(att["emailAddress"]["address"] == candidate_email for att in event_data["attendees"]):
                    event_data["attendees"].append({
                        "emailAddress": {
                            "address": candidate_email,
                            "name": candidate_name or candidate_email
                        },
                        "type": "required"
                    })
                    logger.info(f"Added candidate email to attendees: {candidate_email}")
                else:
                    logger.info(f"Candidate email {candidate_email} already in attendees, skipping")

            # Add CC emails as optional attendees, avoiding duplicates
            if cc_emails:
                existing_emails = {att["emailAddress"]["address"] for att in event_data["attendees"]}
                for email in cc_emails:
                    if email not in existing_emails:
                        event_data["attendees"].append({
                            "emailAddress": {
                                "address": email,
                                "name": email
                            },
                            "type": "optional"
                        })
                        existing_emails.add(email)
                logger.info(f"Added CC emails to attendees: {cc_emails}")
            else:
                logger.info("No CC emails added to attendees")

            logger.info(f"Final event_data attendees: {[attendee['emailAddress']['address'] for attendee in event_data['attendees']]}")
            logger.debug(f"Full event_data payload: {json.dumps(event_data, indent=2)}")

            # Create event using calendar_handler
            logger.info(f"Creating event for user: {created_by}")
            try:
                result = await self.calendar_handler.create_event(created_by, event_data)
                logger.info(f"Event created successfully, event_id: {result.get('id')}, result: {result}")
                logger.info(f"Graph API response attendees: {[attendee['emailAddress']['address'] for attendee in result.get('attendees', [])]}")
            except Exception as e:
                logger.error(f"Graph API error: {str(e)}")
                if "403" in str(e):
                    raise HTTPException(
                        status_code=403,
                        detail="Failed to create event due to insufficient permissions. Ensure OnlineMeetings.ReadWrite scope is granted and re-authenticate via /login."
                    )
                raise

            # Store event details in the session with campaign_id
            if candidate_email:
                rms_db = MongoClient("mongodb://localhost:27017")["rms"]
                candidate_profile = rms_db.profiles.find_one(
                    {"email": candidate_email},
                    {"name": 1, "work_history": 1, "profile_id": 1}
                )
                if candidate_profile:
                    candidate_name = candidate_profile.get("name", candidate_email)
                    candidate_id = candidate_profile.get("profile_id", None)
                    work_history = candidate_profile.get("work_history", [])
                    recent_designation = work_history[0].get("designation", "Unknown") if work_history else "Unknown"
                    logger.info(f"Fetched candidate: {candidate_name}, candidate_id: {candidate_id}, designation: {recent_designation} for email: {candidate_email}")
                else:
                    logger.warning(f"No profile found for candidate email: {candidate_email}")
                    candidate_name = candidate_email
                    candidate_id = None
                    recent_designation = "Unknown"
            else:
                candidate_id = None

            # Store event details in the session with campaign_id
            panel_emails = [attendee["email"] for attendee in attendees]
            updated_session = {
                "scheduled_event": {
                    "event_id": result.get("id"),
                    "start": slot["start"],
                    "end": slot["end"],
                    "candidate": {
                        "email": candidate_email,
                        "name": candidate_name,
                        "candidate_id": candidate_id,
                        "recent_designation": recent_designation
                    },
                    "panel_emails": panel_emails,
                    "cc_emails": cc_emails or [],
                    "created_at": datetime.utcnow()
                },
                "campaign_id": campaign_id
            }
            db.panel_selections.update_one(
                {"session_id": session_id},
                {"$set": updated_session}
            )

            # Copy the entire panel_selections record to campaign-tracker collection
            if campaign_id:
                session_record = db.panel_selections.find_one({"session_id": session_id})
                if session_record:
                    db['campaign-tracker'].update_one(
                        {"_id": campaign_id},
                        {
                            "$push": {
                                "Interview": session_record
                            },
                            "$set": {
                                "updated_at": datetime.utcnow()
                            }
                        },
                        upsert=True
                    )
                    logger.info(f"Copied panel_selections record to campaign-tracker for campaign_id: {campaign_id}")
                else:
                    logger.error(f"Failed to find panel_selections record for session_id: {session_id} after update")

            # Handle teams_link
            teams_link = None
            if result.get("onlineMeeting"):
                teams_link = result["onlineMeeting"].get("joinUrl")
                logger.info(f"Teams link: {teams_link}")
            elif is_personal_account:
                logger.warning(f"No Teams link generated for personal account: {organizer['email']}")
                return {
                    "message": "Event scheduled successfully, but no Teams link generated due to personal account limitations",
                    "event_id": result.get("id"),
                    "teams_link": None
                }

            return {
                "message": "Event scheduled successfully",
                "event_id": result.get("id"),
                "teams_link": teams_link
            }

        except HTTPException as e:
            logger.error(f"HTTPException: {str(e.detail)}, status_code: {e.status_code}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    async def track_event(self, session_id: str) -> Dict[str, Any]:
        """
        Track a scheduled event for a given session, including attendee responses and event details.
        
        Args:
            session_id: ID of the panel selection session
        
        Returns:
            Dictionary containing event details and attendee responses for UI rendering
        """
        try:
            logger.info(f"Tracking event for session_id: {session_id}")
            
            # Validate session
            session = db.panel_selections.find_one({"session_id": session_id})
            if not session:
                logger.error(f"Session not found: {session_id}")
                raise HTTPException(status_code=404, detail="Session not found")
            
            if "scheduled_event" not in session or not session["scheduled_event"].get("event_id"):
                logger.error(f"No scheduled event found for session: {session_id}")
                raise HTTPException(status_code=404, detail="No scheduled event found for this session")

            # Get event details from session
            event_id = session["scheduled_event"]["event_id"]
            created_by = session["created_by"]
            candidate_info = session["scheduled_event"].get("candidate", {})
            candidate_email = candidate_info.get("email", "Unknown")
            candidate_name = candidate_info.get("name", candidate_email or "Unknown")
            recent_designation = candidate_info.get("recent_designation", "Unknown")
            panel_emails = session["scheduled_event"].get("panel_emails", [])
            interview_details = session.get("interview_details", {})
            logger.info(f"Fetching event details for event_id: {event_id}, created_by: {created_by}, candidate: {candidate_name} ({candidate_email})")
            # Get organizer details
            organizer = db.users.find_one(
                {"user_id": created_by},
                {"user_id": 1, "email": 1, "display_name": 1, "access_token": 1, "expires_in": 1, "last_login": 1}
            )
            if not organizer or not organizer.get("email"):
                logger.error(f"Organizer not found or missing email for created_by: {created_by}")
                raise HTTPException(status_code=404, detail="Organizer not found")

            # Check access token validity
            if not organizer.get("access_token"):
                logger.error(f"No access token found for organizer: {created_by}")
                raise HTTPException(status_code=401, detail="No access token for organizer. Please re-authenticate.")
            
            # Check token expiration
            last_login = organizer.get("last_login")
            expires_in = organizer.get("expires_in", 0)
            if last_login and expires_in:
                expiration_time = last_login + timedelta(seconds=expires_in)
                if datetime.utcnow() > expiration_time:
                    logger.error(f"Access token expired for user: {created_by}")
                    raise HTTPException(status_code=401, detail="Access token expired. Please re-authenticate via /login.")

            # Check if organizer is a personal account
            personal_domains = ["outlook.com", "hotmail.com", "live.com"]
            is_personal_account = any(domain in organizer["email"].lower() for domain in personal_domains)
            if is_personal_account:
                logger.warning(f"Organizer {organizer['email']} is a personal account. Teams meeting link may not be available.")

            # Fetch candidate name from rms.profiles
            candidate_name = candidate_email or "Unknown"
            if candidate_email:
                rms_db = MongoClient("mongodb://localhost:27017")["rms"]
                candidate_profile = rms_db.profiles.find_one({"email": candidate_email}, {"name": 1})
                if candidate_profile and candidate_profile.get("name"):
                    candidate_name = candidate_profile["name"]
                    logger.info(f"Fetched candidate name: {candidate_name} for email: {candidate_email}")
                else:
                    logger.warning(f"No profile found for candidate email: {candidate_email}")

            # Fetch event details from Microsoft Graph API
            logger.info(f"Fetching event from Graph API for event_id: {event_id}")
            try:
                event = await calendar_handler.get_event(created_by, event_id)
                logger.info(f"Event retrieved successfully, event_id: {event_id}, event: {event}")
            except Exception as e:
                logger.error(f"Graph API error fetching event: {str(e)}")
                if "403" in str(e):
                    raise HTTPException(
                        status_code=403,
                        detail="Failed to fetch event due to insufficient permissions. Ensure Calendars.ReadWrite scope is granted and re-authenticate via /login."
                    )
                if "404" in str(e):
                    raise HTTPException(status_code=404, detail="Event not found in calendar")
                raise

            # Extract event details
            subject = event.get("subject")
            start = event.get("start", {})
            end = event.get("end", {})
            teams_link = event.get("onlineMeeting", {}).get("joinUrl") if event.get("onlineMeeting") else None
            is_cancelled = event.get("isCancelled", False)
            status = "CANCELLED" if is_cancelled else "SCHEDULED"

            # Format times using scheduled_event
            try:
                # Parse scheduled_event.start and end (in UTC) and format directly
                start_dt = datetime.fromisoformat(session["scheduled_event"]["start"].replace("Z", "+00:00"))
                end_dt = datetime.fromisoformat(session["scheduled_event"]["end"].replace("Z", "+00:00"))
                date = start_dt.strftime("%B %d, %Y")  # e.g., "August 25, 2025"
                start_time = start_dt.strftime("%I:%M:%S %p")  # e.g., "02:30:00 PM"
                duration = int((end_dt - start_dt).total_seconds() / 60)  # Duration in minutes
            except (ValueError, AttributeError) as e:
                logger.error(f"Error parsing event times: {str(e)}")
                date = interview_details.get("date", "Unknown")
                start_time = "Unknown"
                duration = interview_details.get("duration", 0)

            # Fetch panel member roles from calendar_app.users
            users_db = db.users  # calendar_app.users
            panel_roles = {}
            for email in panel_emails:
                user = users_db.find_one({"email": email}, {"job_title": 1})
                panel_roles[email] = user.get("job_title", "Panel Member") if user else "Panel Member"
                logger.info(f"Fetched job_title: {panel_roles[email]} for email: {email}")

            # Extract candidate and panel responses
            candidate_response = {}
            panel_responses = []
            panel_summary = {"accepted": 0, "declined": 0, "tentative": 0, "pending": 0}
            
            for attendee in event.get("attendees", []):
                email_address = attendee.get("emailAddress", {})
                email = email_address.get("address")
                response = attendee.get("status", {}).get("response", "none").lower()
                response_time = attendee.get("status", {}).get("time")
                
                # Format response_time
                formatted_response_time = None
                if response_time:
                    try:
                        response_dt = datetime.fromisoformat(response_time.replace("Z", "+00:00"))
                        formatted_response_time = response_dt.strftime("%B %d, %Y, %I:%M %p")
                    except ValueError:
                        formatted_response_time = "Unknown"

                # Determine if attendee is candidate or panel member
                if email == candidate_email:
                    candidate_response = {
                        "name": candidate_name,
                        "email": email,
                        "response": response.capitalize(),
                        "response_time": formatted_response_time
                    }
                elif email in panel_emails:
                    panel_responses.append({
                        "name": email_address.get("name", email),
                        "email": email,
                        "role": panel_roles.get(email, "Panel Member"),
                        "response": response.capitalize(),
                        "response_time": formatted_response_time
                    })
                    # Update panel summary
                    if response == "accepted":
                        panel_summary["accepted"] += 1
                    elif response == "declined":
                        panel_summary["declined"] += 1
                    elif response == "tentative":
                        panel_summary["tentative"] += 1
                    else:
                        panel_summary["pending"] += 1

            return {
                "status": status,
                "candidate": {
                    "name": candidate_name,
                    "email": candidate_email,
                    "recent_designation": recent_designation
                },
                "position": interview_details.get("title", subject or "Unknown"),
                "scheduled_time": {
                    "date": date,
                    "start_time": start_time,
                    "duration": duration
                },
                "virtual": bool(teams_link),
                "candidate_response": candidate_response,
                "panel_response_status": {
                    "summary": panel_summary,
                    "responses": panel_responses
                }
            }
        except HTTPException as e:
            logger.error(f"HTTPException: {str(e.detail)}, status_code: {e.status_code}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
        
    async def update_event(self, session_id: str, remove_emails: List[str], add_emails: List[str]) -> Dict[str, Any]:
        """
        Update an existing event by removing and adding invitees, and update panel_emails in the database.
        
        Args:
            session_id: ID of the panel selection session
            remove_emails: List of panel member emails to remove
            add_emails: List of new panel member emails to add
        
        Returns:
            Dictionary containing updated event details in the same format as track_event
        """
        try:
            logger.info(f"Updating event for session_id: {session_id}, remove_emails: {remove_emails}, add_emails: {add_emails}")
            
            # Validate session
            session = db.panel_selections.find_one({"session_id": session_id})
            if not session:
                logger.error(f"Session not found: {session_id}")
                raise HTTPException(status_code=404, detail="Session not found")
            
            if "scheduled_event" not in session or not session["scheduled_event"].get("event_id"):
                logger.error(f"No scheduled event found for session: {session_id}")
                raise HTTPException(status_code=404, detail="No scheduled event found for this session")

            # Get event details from session
            event_id = session["scheduled_event"]["event_id"]
            created_by = session["created_by"]
            candidate_email = session["scheduled_event"].get("candidate_email")
            panel_emails = session["scheduled_event"].get("panel_emails", [])
            interview_details = session.get("interview_details", {})
            logger.info(f"Updating event_id: {event_id}, created_by: {created_by}")

            # Get organizer details
            organizer = db.users.find_one(
                {"user_id": created_by},
                {"user_id": 1, "email": 1, "display_name": 1, "access_token": 1, "expires_in": 1, "last_login": 1}
            )
            if not organizer or not organizer.get("email"):
                logger.error(f"Organizer not found or missing email for created_by: {created_by}")
                raise HTTPException(status_code=404, detail="Organizer not found")

            # Check access token validity
            if not organizer.get("access_token"):
                logger.error(f"No access token found for organizer: {created_by}")
                raise HTTPException(status_code=401, detail="No access token for organizer. Please re-authenticate.")
            
            # Check token expiration
            last_login = organizer.get("last_login")
            expires_in = organizer.get("expires_in", 0)
            if last_login and expires_in:
                expiration_time = last_login + timedelta(seconds=expires_in)
                if datetime.utcnow() > expiration_time:
                    logger.error(f"Access token expired for user: {created_by}")
                    raise HTTPException(status_code=401, detail="Access token expired. Please re-authenticate via /login.")

            # Check if organizer is a personal account
            personal_domains = ["outlook.com", "hotmail.com", "live.com"]
            is_personal_account = any(domain in organizer["email"].lower() for domain in personal_domains)
            if is_personal_account:
                logger.warning(f"Organizer {organizer['email']} is a personal account. Teams meeting link may not be available.")

            # Fetch current event details from Microsoft Graph API
            logger.info(f"Fetching event from Graph API for event_id: {event_id}")
            try:
                event = await calendar_handler.get_event(created_by, event_id)
                logger.info(f"Event retrieved successfully, event_id: {event_id}")
            except Exception as e:
                logger.error(f"Graph API error fetching event: {str(e)}")
                if "403" in str(e):
                    raise HTTPException(
                        status_code=403,
                        detail="Failed to fetch event due to insufficient permissions. Ensure Calendars.ReadWrite scope is granted and re-authenticate via /login."
                    )
                if "404" in str(e):
                    raise HTTPException(status_code=404, detail="Event not found in calendar")
                raise

            # Update attendees list
            current_attendees = event.get("attendees", [])
            updated_attendees = []
            
            # Keep candidate and non-removed panel members
            for attendee in current_attendees:
                email = attendee.get("emailAddress", {}).get("address")
                if email == candidate_email or email not in remove_emails:
                    updated_attendees.append(attendee)
            
            # Add new panel members
            for email in add_emails:
                if email not in [att.get("emailAddress", {}).get("address") for att in updated_attendees]:
                    updated_attendees.append({
                        "emailAddress": {
                            "address": email,
                            "name": email  # Name will be updated by Graph API or UI
                        },
                        "type": "required"
                    })

            # Update event in Microsoft Graph API
            logger.info(f"Updating event with new attendees: {[att['emailAddress']['address'] for att in updated_attendees]}")
            try:
                updated_event = calendar_handler.update_event(
                    user_id=created_by,
                    event_id=event_id,
                    event_data={"attendees": updated_attendees}
                )
                logger.info(f"Event updated successfully, event_id: {event_id}")
            except Exception as e:
                logger.error(f"Graph API error updating event: {str(e)}")
                if "403" in str(e):
                    raise HTTPException(
                        status_code=403,
                        detail="Failed to update event due to insufficient permissions. Ensure Calendars.ReadWrite scope is granted and re-authenticate via /login."
                    )
                raise

            # Update panel_emails in panel_selections
            new_panel_emails = [email for email in panel_emails if email not in remove_emails] + [
                email for email in add_emails if email not in panel_emails
            ]
            db.panel_selections.update_one(
                {"session_id": session_id},
                {"$set": {"scheduled_event.panel_emails": new_panel_emails}}
            )
            logger.info(f"Updated panel_emails in panel_selections: {new_panel_emails}")

            # Fetch candidate name from rms.profiles
            candidate_name = candidate_email or "Unknown"
            if candidate_email:
                rms_db = MongoClient("mongodb://localhost:27017")["rms"]
                candidate_profile = rms_db.profiles.find_one({"email": candidate_email}, {"name": 1})
                if candidate_profile and candidate_profile.get("name"):
                    candidate_name = candidate_profile["name"]
                    logger.info(f"Fetched candidate name: {candidate_name} for email: {candidate_email}")
                else:
                    logger.warning(f"No profile found for candidate email: {candidate_email}")

            # Extract updated event details
            subject = updated_event.get("subject")
            start = updated_event.get("start", {})
            end = updated_event.get("end", {})
            teams_link = updated_event.get("onlineMeeting", {}).get("joinUrl") if updated_event.get("onlineMeeting") else None
            is_cancelled = updated_event.get("isCancelled", False)
            status = "CANCELLED" if is_cancelled else "SCHEDULED"

            # Format times using scheduled_event
            try:
                start_dt = datetime.fromisoformat(session["scheduled_event"]["start"].replace("Z", "+00:00"))
                end_dt = datetime.fromisoformat(session["scheduled_event"]["end"].replace("Z", "+00:00"))
                date = start_dt.strftime("%B %d, %Y")  # e.g., "August 25, 2025"
                start_time = start_dt.strftime("%I:%M:%S %p")  # e.g., "02:30:00 PM"
                duration = int((end_dt - start_dt).total_seconds() / 60)  # Duration in minutes
            except (ValueError, AttributeError) as e:
                logger.error(f"Error parsing event times: {str(e)}")
                date = interview_details.get("date", "Unknown")
                start_time = "Unknown"
                duration = interview_details.get("duration", 0)

            # Fetch panel member roles from calendar_app.users
            users_db = db.users
            panel_roles = {}
            for email in new_panel_emails:
                user = users_db.find_one({"email": email}, {"job_title": 1})
                panel_roles[email] = user.get("job_title", "Panel Member") if user else "Panel Member"
                logger.info(f"Fetched job_title: {panel_roles[email]} for email: {email}")

            # Extract candidate and panel responses
            candidate_response = {}
            panel_responses = []
            panel_summary = {"accepted": 0, "declined": 0, "tentative": 0, "pending": 0}
            
            for attendee in updated_event.get("attendees", []):
                email_address = attendee.get("emailAddress", {})
                email = email_address.get("address")
                response = attendee.get("status", {}).get("response", "none").lower()
                response_time = attendee.get("status", {}).get("time")
                
                # Format response_time
                formatted_response_time = None
                if response_time:
                    try:
                        response_dt = datetime.fromisoformat(response_time.replace("Z", "+00:00"))
                        formatted_response_time = response_dt.strftime("%B %d, %Y, %I:%M %p")
                    except ValueError:
                        formatted_response_time = "Unknown"

                # Determine if attendee is candidate or panel member
                if email == candidate_email:
                    candidate_response = {
                        "name": candidate_name,
                        "email": email,
                        "response": response.capitalize(),
                        "response_time": formatted_response_time
                    }
                elif email in new_panel_emails:
                    panel_responses.append({
                        "name": email_address.get("name", email),
                        "email": email,
                        "role": panel_roles.get(email, "Panel Member"),
                        "response": response.capitalize(),
                        "response_time": formatted_response_time
                    })
                    # Update panel summary
                    if response == "accepted":
                        panel_summary["accepted"] += 1
                    elif response == "declined":
                        panel_summary["declined"] += 1
                    elif response == "tentative":
                        panel_summary["tentative"] += 1
                    else:
                        panel_summary["pending"] += 1

            return {
                "status": status,
                "candidate": {
                    "name": candidate_name,
                    "email": candidate_email or "Unknown"
                },
                "position": interview_details.get("title", subject or "Unknown"),
                "scheduled_time": {
                    "date": date,
                    "start_time": start_time,
                    "duration": duration
                },
                "virtual": bool(teams_link),
                "candidate_response": candidate_response,
                "panel_response_status": {
                    "summary": panel_summary,
                    "responses": panel_responses
                }
            }

        except HTTPException as e:
            logger.error(f"HTTPException: {str(e.detail)}, status_code: {e.status_code}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    async def scheduler(self) -> Dict[str, Any]:
        """
        Retrieve all scheduled interviews with candidate details and statistics.
        
        Returns:
            Dictionary containing a list of interviews and statistics.
        """
        try:
            logger.info("Fetching all scheduled interviews from panel_selections")
            
            # Connect to rms.profiles
            rms_db = MongoClient("mongodb://localhost:27017")["rms"]
            
            # Query all sessions with scheduled_event
            sessions = db.panel_selections.find({"scheduled_event": {"$exists": True, "$ne": None}})
            interviews = []
            total = 0
            scheduled = 0
            pending = 0
            completed = 0
            
            # Current timestamp in UTC
            current_time = datetime.now(pytz.UTC)
            logger.info(f"Current UTC timestamp: {current_time.isoformat()}")
            
            for session in sessions:
                scheduled_event = session.get("scheduled_event", {})
                if not scheduled_event.get("event_id"):
                    logger.warning(f"Skipping session {session['session_id']} with no event_id")
                    continue
                    
                total += 1
                candidate_email = scheduled_event.get("candidate_email", "Unknown")
                panel_emails = scheduled_event.get("panel_emails", [])
                
                # Format start time
                try:
                    start_dt = datetime.fromisoformat(scheduled_event["start"].replace("Z", "+00:00"))
                    event_start_time = start_dt.strftime("%I:%M:%S %p")  # e.g., "07:00:00 PM"
                    # Determine status
                    if start_dt > current_time:
                        scheduled += 1
                        pending += 1
                    else:
                        completed += 1
                except (ValueError, KeyError) as e:
                    logger.error(f"Error parsing start time for session {session['session_id']}: {str(e)}")
                    event_start_time = "Unknown"
                
                # Fetch candidate details from rms.profiles
                candidate_name = candidate_email
                recent_designation = "Unknown"
                profile_id = "Unknown"
                if candidate_email:
                    candidate_profile = rms_db.profiles.find_one(
                        {"email": candidate_email},
                        {"name": 1, "work_history": 1, "profile_id": 1}
                    )
                    if candidate_profile:
                        candidate_name = candidate_profile.get("name", candidate_email)
                        profile_id = candidate_profile.get("profile_id", "Unknown")
                        work_history = candidate_profile.get("work_history", [])
                        # Use designation from work_history[0] if available
                        if work_history and len(work_history) > 0:
                            recent_designation = work_history[0].get("designation", "Unknown")
                        logger.info(f"Fetched candidate: {candidate_name}, designation: {recent_designation}, profile_id: {profile_id} for email: {candidate_email}")
                    else:
                        logger.warning(f"No profile found for candidate email: {candidate_email}")
                
                interviews.append({
                    "session_id": session["session_id"],
                    "candidate": {
                        "email": candidate_email,
                        "name": candidate_name,
                        "recent_designation": recent_designation,
                        "profile_id": profile_id
                    },
                    "event_start_time": event_start_time,
                    "panel_emails": panel_emails
                })
            
            return {
                "interviews": interviews,
                "statistics": {
                    "total": total,
                    "scheduled": scheduled,
                    "pending": pending,
                    "completed": completed
                }
            }
        
        except Exception as e:
            logger.error(f"Unexpected error in scheduler: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))