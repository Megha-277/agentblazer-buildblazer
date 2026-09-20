"""
AgentBlazer Club — backend
Serves pages/static assets, exposes a rate-limited login endpoint that
proxies to Supabase Auth, and a public config endpoint so the frontend
never needs its own .env file.
"""

import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

app = FastAPI(title="AgentBlazer Club API")

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

# --------------------------------------------------
# RATE LIMITING
# --------------------------------------------------
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# --------------------------------------------------
# PUBLIC CONFIG API
# --------------------------------------------------
@app.get("/api/config")
def get_public_config():
    return {"supabaseUrl": SUPABASE_URL, "supabaseAnonKey": SUPABASE_ANON_KEY}


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------
@app.get("/api/health")
async def health():
    return {"status": "ok", "message": "BuildBlazer backend is running"}


# --------------------------------------------------
# AUTHENTICATION APIs
# --------------------------------------------------
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
        # Deliberately generic to prevent user-enumeration leaks
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not result.session:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return {
        "access_token": result.session.access_token,
        "refresh_token": result.session.refresh_token,
        "expires_at": result.session.expires_at,
        "user_id": result.user.id,
    }


# --------------------------------------------------
# ADMIN API EXAMPLE (Invite Officer)
# --------------------------------------------------
class InviteRequest(BaseModel):
    email: EmailStr
    full_name: str

def _get_caller_profile(access_token: str):
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


# --------------------------------------------------
# FRONTEND PAGE ROUTES
# --------------------------------------------------
@app.get("/")
async def serve_home():
    return FileResponse(FRONTEND_DIR / "index.html")

@app.get("/login")
async def serve_login():
    return FileResponse(FRONTEND_DIR / "login.html")

@app.get("/admin")
async def serve_admin():
    return FileResponse(FRONTEND_DIR / "admin.html")

@app.get("/faculty")
async def serve_faculty():
    return FileResponse(FRONTEND_DIR / "faculty.html")


# --------------------------------------------------
# STATIC FILES (Assets & Frontend Root)
# --------------------------------------------------
app.mount(
    "/assets",
    StaticFiles(directory=FRONTEND_DIR / "assets"),
    name="assets"
)

# Serves all other static frontend files (CSS, JS, etc.)
app.mount(
    "/",
    StaticFiles(directory=FRONTEND_DIR, html=True),
    name="frontend"
)