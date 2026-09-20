"""
AgentBlazer Club — backend (API only)
Frontend is deployed separately on Vercel/Netlify. This service exposes
a rate-limited login endpoint that proxies to Supabase Auth, a public
config endpoint, and privileged server-only actions.
"""

import os
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
# service_role key is ONLY loaded here, server-side, for admin-only actions
# (e.g. inviting new officers). It must NEVER be sent to the browser.
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Comma-separated list in .env, e.g.:
# ALLOWED_ORIGINS=https://agentblazer-club.vercel.app,http://localhost:5500
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "").split(",")

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
# Login — rate limited, proxies to Supabase Auth
# ----------------------------------------------------------------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


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
        .select("role, role_level")
        .eq("id", user_resp.user.id)
        .single()
        .execute()
    )
    return profile.data


@app.post("/api/invite-officer")
@limiter.limit("5/minute")
def invite_officer(request: Request, body: InviteRequest, authorization: str = ""):
    if not authorization.startswith("Bearer "):
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