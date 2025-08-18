import uuid
import requests
from msal import ConfidentialClientApplication
from pymongo import MongoClient
from fastapi import Request, HTTPException
from fastapi.responses import RedirectResponse
from datetime import datetime
from dotenv import load_dotenv
import os


load_dotenv()

class LoginHandler:
    def __init__(self):
        self.client_id = os.getenv("CLIENT_ID")
        self.client_secret = os.getenv("CLIENT_SECRET")
        self.authority = os.getenv("AUTHORITY")
        self.redirect_uri = "http://localhost:8000/callback"
        #self.authority = "https://login.microsoftonline.com/common"
        self.scopes = [
            "User.Read",
            "Calendars.ReadWrite",
            "Calendars.ReadWrite.Shared",
            "MailboxSettings.Read",
            "OnlineMeetings.ReadWrite"
        ]
        self.mongo_client = MongoClient("mongodb://localhost:27017")
        self.db = self.mongo_client["calendar_app"]
        self.users_collection = self.db["users"]
        self.mongo_client = MongoClient("mongodb://localhost:27017")
        self.db = self.mongo_client["calendar_app"]
        self.users_collection = self.db["users"]

    def get_msal_app(self):
        return ConfidentialClientApplication(
            self.client_id, authority=self.authority, client_credential=self.client_secret
        )

    async def initiate_login(self):
        msal_app = self.get_msal_app()
        state = str(uuid.uuid4())
        auth_url = msal_app.get_authorization_request_url(
            scopes=self.scopes,
            state=state,
            redirect_uri=self.redirect_uri,
            prompt="select_account"  # Force account selection
        )
        response = RedirectResponse(auth_url)
        response.set_cookie("oauth_state", state, httponly=True, secure=False)  # Secure=False for localhost
        return response

    async def handle_callback(self, request: Request):
        incoming_state = request.query_params.get("state")
        stored_state = request.cookies.get("oauth_state")
        if not incoming_state or incoming_state != stored_state:
            raise HTTPException(status_code=400, detail="State mismatch")

        code = request.query_params.get("code")
        if not code:
            raise HTTPException(status_code=400, detail="No code in callback")

        msal_app = self.get_msal_app()
        result = msal_app.acquire_token_by_authorization_code(
            code=code,
            scopes=self.scopes,
            redirect_uri=self.redirect_uri,
        )
        if "access_token" not in result:
            raise HTTPException(status_code=400, detail=f"Token acquisition failed: {result.get('error_description')}")

        # Fetch user details from Microsoft Graph
        user_id = result.get("id_token_claims", {}).get("oid")
        access_token = result.get("access_token")
        headers = {"Authorization": f"Bearer {access_token}"}
        user_response = requests.get("https://graph.microsoft.com/v1.0/me", headers=headers)
        user_response.raise_for_status()
        user_data = user_response.json()

        # Store or update user tokens and details in MongoDB
        self.users_collection.update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id": user_id,
                "access_token": access_token,
                "refresh_token": result.get("refresh_token"),
                "expires_in": result.get("expires_in"),
                "display_name": user_data.get("displayName"),
                "email": user_data.get("mail") or user_data.get("userPrincipalName"),
                "given_name": user_data.get("givenName"),
                "surname": user_data.get("surname"),
                "job_title": user_data.get("jobTitle"),
                "office_location": user_data.get("officeLocation"),
                "last_login": datetime.utcnow()
            }},
            upsert=True
        )
        return RedirectResponse(url=f"http://localhost:8080/dashboard?user_id={user_id}")