"""
AgentBlazer Club — backend (unified monolith)
FastAPI serves the static frontend and exposes /api/* endpoints for auth,
public content, and privileged admin actions. Deployed on Render.
"""

import os
import json
from pathlib import Path
from typing import Any, Dict, Optional
from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from supabase import create_client, Client
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")

# Explicitly load the .env file sitting in the same 'backend' folder as main.py
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_ANON_KEY in backend/.env!")

# service_role key is ONLY loaded here, server-side, for admin-only actions
# (e.g. inviting new officers). It must NEVER be sent to the browser.
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Comma-separated list in .env, e.g.:
# ALLOWED_ORIGINS=https://agentblazer-club.onrender.com,http://localhost:5500
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]

# This client uses the anon key — same privileges a browser would have,
# so RLS still applies to every call made through it.
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="AgentBlazer Club API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


# ----------------------------------------------------------------
# Public config — anon key is DESIGNED to be public (RLS protects the
# data behind it), so serving it here just avoids needing a frontend
# .env / build step for a plain static site.
# ----------------------------------------------------------------
@app.get("/api/config")
def get_public_config():
    return {"supabaseUrl": SUPABASE_URL, "supabaseAnonKey": SUPABASE_ANON_KEY}


# ----------------------------------------------------------------
# Health check
# ----------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"status": "ok"}


# ----------------------------------------------------------------
# Content — public GET returns site content (events, team, etc.)
# stored in a single Supabase row in the `site_content` table.
# Authenticated POST lets the admin dashboard save changes server-side
# so content survives across browsers/devices (not just localStorage).
#
# Supabase table: site_content
#   id         integer  primary key (always 1 — single-row store)
#   payload    jsonb    the full content object
#   updated_at timestamptz default now()
#
# RLS: SELECT is public (anon key). INSERT/UPDATE requires auth.
# ----------------------------------------------------------------
CONTENT_TABLE = "site_content"
CONTENT_ROW_ID = 1


@app.get("/api/content")
def get_content():
    """Return the current site content (events, team, guests, faculty)."""
    try:
        result = (
            supabase.table(CONTENT_TABLE)
            .select("payload")
            .eq("id", CONTENT_ROW_ID)
            .maybe_single()
            .execute()
        )
        if result.data:
            return result.data["payload"]
    except Exception:
        pass
    # Row not yet created — return empty structure; frontend falls back to defaults
    return {"events": [], "officers": [], "committee": [], "faculty": [], "guests": []}


class ContentPayload(BaseModel):
    events: list = []
    officers: list = []
    committee: list = []
    faculty: list = []
    guests: list = []


@app.post("/api/content")
@limiter.limit("30/minute")
def save_content(
    request: Request,
    body: ContentPayload,
    authorization: Optional[str] = Header(default=None),
):
    """Save site content. Requires a valid Supabase session (role_level >= 2)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing session token.")
    access_token = authorization.removeprefix("Bearer ").strip()

    caller = _get_caller_profile(access_token)
    if not caller or caller.get("role_level", 0) < 2:
        raise HTTPException(status_code=403, detail="Not authorized to update content.")

    payload = body.model_dump()
    try:
        supabase.table(CONTENT_TABLE).upsert(
            {"id": CONTENT_ROW_ID, "payload": payload}
        ).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not save content: {exc}")

    return {"status": "saved"}


# ----------------------------------------------------------------
# Profile — returns the caller's role and role_level so the frontend
# can gate UI sections without trusting client-side data.
# ----------------------------------------------------------------
@app.get("/api/profile")
def get_profile(authorization: Optional[str] = Header(default=None)):
    """Return the authenticated user's profile (role, role_level, name)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing session token.")
    access_token = authorization.removeprefix("Bearer ").strip()
    try:
        caller = _get_caller_profile(access_token)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid session.")
    return caller


# ----------------------------------------------------------------
# Login — rate limited, proxies to Supabase Auth
# ----------------------------------------------------------------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password too short.")
        if len(v) > 128:
            raise ValueError("Password too long.")
        return v


@app.post("/api/login")
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest):
    try:
        result = supabase.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except Exception:
        # Deliberately generic: don't reveal whether the email exists
        # or the password was wrong — either leaks info to an attacker.
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not result.session:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return {
        "access_token": result.session.access_token,
        "refresh_token": result.session.refresh_token,
        "expires_at": result.session.expires_at,
        "user_id": result.user.id,
    }


# ----------------------------------------------------------------
# Example of a genuinely backend-only action: inviting a new officer.
# Requires the service_role key, so it can NEVER be done from the
# browser directly. Verifies the caller's own role first by checking
# their access token against Supabase, then checks their profile role
# server-side before using the privileged client.
# ----------------------------------------------------------------
class InviteRequest(BaseModel):
    email: EmailStr
    full_name: str


def _get_caller_profile(access_token: str):
    """Validates the caller's token and returns their profile row."""
    user_resp = supabase.auth.get_user(access_token)
    if not user_resp or not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid session.")
    profile = (
        supabase.table("profiles")
        .select("role, role_level, full_name")
        .eq("id", user_resp.user.id)
        .single()
        .execute()
    )
    return profile.data


@app.post("/api/invite-officer")
@limiter.limit("5/minute")
def invite_officer(
    request: Request,
    body: InviteRequest,
    authorization: Optional[str] = Header(default=None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing session token.")
    access_token = authorization.removeprefix("Bearer ").strip()

    caller = _get_caller_profile(access_token)
    if not caller or caller["role_level"] < 4:  # president and above only
        raise HTTPException(status_code=403, detail="Not authorized to invite officers.")

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Server misconfigured: missing service role key.")

    admin_client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    try:
        created = admin_client.auth.admin.create_user(
            {
                "email": body.email,
                "email_confirm": True,
                "user_metadata": {"full_name": body.full_name},
            }
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not create user: {exc}")

    return {"status": "invited", "user_id": created.user.id}

app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")