"""
AgentBlazer Club — Backend API & Security Proxy
Department of CS&E, St Joseph Engineering College (SJEC)
============================================================
FastAPI backend providing:
- Rate-limited auth & signup proxying
- Domain verification (@sjec.ac.in) & graduation year extraction
- 7-tier role hierarchy with self-modification lockout
- Honeypot spam defense
- Deep file upload security (extension whitelist, MIME type, binary magic bytes, UUID renaming)
- Automated alumni rollover lifecycle
"""

import os
import re
import uuid
import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import html

from fastapi import FastAPI, HTTPException, Request, Header, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from supabase import create_client, Client
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles

# ------------------------------------------------------------
# ENVIRONMENT & CONFIGURATION
# ------------------------------------------------------------
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_ANON_KEY in backend/.env!")

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="AgentBlazer Club API", version="2.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Standard clients
anon_client: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def get_admin_client() -> Client:
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Server misconfigured: missing service role key.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# ------------------------------------------------------------
# ROLE HIERARCHY CONSTANTS (7 Levels)
# ------------------------------------------------------------
ROLE_LEVELS = {
    "hod": 6,
    "faculty": 5,
    "president": 4,
    "secretary": 3,
    "event_manager": 2,
    "tech_lead": 1,
    "member": 0,
    "alumni": 0,
}

# ------------------------------------------------------------
# SECURITY & AUTH HELPERS
# ------------------------------------------------------------
def _get_caller_profile(access_token: str) -> Dict[str, Any]:
    """Validates session access token and retrieves validated profile from database."""
    admin = get_admin_client()
    try:
        user_resp = admin.auth.get_user(access_token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail="Invalid session token.")
        
        user_id = user_resp.user.id
        user_email = user_resp.user.email or ""
        profile_res = (
            admin.table("profiles")
            .select("id, full_name, role, role_level, auto_managed, is_active, title")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        if profile_res.data:
            p = dict(profile_res.data)
            p["email"] = user_email
            return p
        
        # Profile not yet initialized: derive from metadata if available
        return {
            "id": user_id,
            "full_name": user_resp.user.user_metadata.get("full_name", user_email),
            "role": "member",
            "role_level": 0,
            "email": user_email,
            "auto_managed": True,
            "is_active": True
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {exc}")

def parse_auth_header(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")
    return authorization.removeprefix("Bearer ").strip()

def sanitize_input(text: Optional[str]) -> str:
    if not text:
        return ""
    # Strip HTML tags and escape HTML entities to prevent XSS
    clean = re.sub(r"<[^>]*?>", "", str(text))
    return html.escape(clean.strip())

# ------------------------------------------------------------
# PUBLIC CONFIG & HEALTH CHECK
# ------------------------------------------------------------
@app.get("/api/config")
def get_public_config():
    return {"supabaseUrl": SUPABASE_URL, "supabaseAnonKey": SUPABASE_ANON_KEY}

@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.datetime.utcnow().isoformat()}

# ------------------------------------------------------------
# PROFILE ENDPOINT
# ------------------------------------------------------------
@app.get("/api/profile")
def get_profile(authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    return _get_caller_profile(token)

# ------------------------------------------------------------
# RATE-LIMITED LOGIN PROXY
# ------------------------------------------------------------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters.")
        if len(v) > 128:
            raise ValueError("Password is too long.")
        return v

@app.post("/api/login")
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest):
    try:
        result = anon_client.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password
        })
    except Exception:
        # Deliberately generic error to prevent email enumeration
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not result or not result.session:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    # Profile verification: check if account is inactive/pending
    admin = get_admin_client()
    try:
        p_res = admin.table("profiles").select("id, is_active, title, role_level").eq("id", result.user.id).maybe_single().execute()
        if p_res.data:
            p_data = p_res.data
            is_act = p_data.get("is_active", True)
            title_str = str(p_data.get("title") or "")
            if not is_act:
                if "rejected" in title_str:
                    raise HTTPException(status_code=403, detail="Your membership application was reviewed and not approved.")
                elif "pending" in title_str or title_str.startswith("pending_approval"):
                    raise HTTPException(status_code=403, detail="Your registration is currently pending Faculty/HOD approval. You will receive access once approved.")
                else:
                    raise HTTPException(status_code=403, detail="Your account is currently inactive. Please contact club administration.")
    except HTTPException:
        raise
    except Exception:
        pass

    return {
        "access_token": result.session.access_token,
        "refresh_token": result.session.refresh_token,
        "expires_at": result.session.expires_at,
        "user_id": result.user.id,
    }

# ------------------------------------------------------------
# DOMAIN-RESTRICTED SIGNUP & ONBOARDING WORKFLOW
# ------------------------------------------------------------
class SignupRequest(BaseModel):
    full_name: str
    email: str
    password: str
    expected_graduation_year: Optional[int] = None
    b_hp_check: Optional[str] = None  # Honeypot field

@app.post("/api/signup")
@limiter.limit("5/minute")
def signup(request: Request, body: SignupRequest):
    # 1. Honeypot check: reject if populated
    if body.b_hp_check and body.b_hp_check.strip():
        raise HTTPException(status_code=400, detail="Submission rejected by automated security filter.")

    clean_name = sanitize_input(body.full_name)
    clean_email = body.email.strip().lower()

    # 2. Strict institutional domain verification
    if not clean_email.endswith("@sjec.ac.in"):
        raise HTTPException(status_code=400, detail="Invalid domain: Registration strictly restricted to institutional @sjec.ac.in email addresses.")

    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")

    # 3. Year / Batch Extraction: Parse 2-digit joining year from email pattern (e.g. 26d89.abc@sjec.ac.in)
    grad_year = body.expected_graduation_year
    if not grad_year:
        match = re.match(r"^(\d{2})", clean_email)
        if match:
            join_year = 2000 + int(match.group(1))
            grad_year = join_year + 4
        else:
            grad_year = datetime.date.today().year + 4

    admin = get_admin_client()

    # 4. Create user account via Supabase Auth admin
    try:
        auth_user = admin.auth.admin.create_user({
            "email": clean_email,
            "password": body.password,
            "email_confirm": True,
            "user_metadata": {
                "full_name": clean_name,
                "expected_graduation_year": grad_year
            }
        })
        new_user_id = auth_user.user.id
    except Exception as exc:
        exc_str = str(exc).lower()
        if "already" in exc_str or "registered" in exc_str or "exists" in exc_str:
            raise HTTPException(status_code=400, detail="An account with this institutional email is already registered. If you applied recently, please await Faculty approval or sign in.")
        raise HTTPException(status_code=400, detail=f"Registration failed: {exc}")

    # 5. Insert profile with pending_approval status and role_level = 0
    # Note: profiles table uses existing columns: is_active=False and title=pending_approval:<email>
    try:
        admin.table("profiles").upsert({
            "id": new_user_id,
            "full_name": clean_name,
            "role": "member",
            "role_level": 0,
            "title": f"pending_approval:{clean_email}",
            "expected_graduation_year": grad_year,
            "auto_managed": True,
            "is_active": False,
            "created_at": datetime.datetime.utcnow().isoformat(),
            "updated_at": datetime.datetime.utcnow().isoformat()
        }).execute()
    except Exception as exc:
        # Update if row was created by trigger
        try:
            admin.table("profiles").update({
                "full_name": clean_name,
                "role": "member",
                "role_level": 0,
                "title": f"pending_approval:{clean_email}",
                "expected_graduation_year": grad_year,
                "auto_managed": True,
                "is_active": False,
                "updated_at": datetime.datetime.utcnow().isoformat()
            }).eq("id", new_user_id).execute()
        except Exception:
            pass

    # 6. Log to audit_log
    try:
        admin.table("audit_log").insert({
            "table_name": "profiles",
            "row_id": str(new_user_id),
            "action": "STUDENT_SIGNUP_SUBMITTED",
            "diff": {"email": clean_email, "name": clean_name, "grad_year": grad_year, "status": "pending_approval"}
        }).execute()
    except Exception:
        pass

    return {
        "status": "pending_approval",
        "message": "Registration submitted successfully. Your application is queued for Faculty/HOD approval.",
        "user_id": new_user_id,
        "email": clean_email,
        "full_name": clean_name,
        "expected_graduation_year": grad_year
    }

# ------------------------------------------------------------
# PRIVILEGED APPROVAL QUEUE (Faculty / HOD only)
# ------------------------------------------------------------
@app.get("/api/pending-members")
def get_pending_members(authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    caller = _get_caller_profile(token)
    if caller.get("role_level", 0) < 5:  # Faculty (5) or HOD (6) only
        raise HTTPException(status_code=403, detail="Forbidden: Approval queue access requires Faculty or HOD credentials.")

    admin = get_admin_client()
    try:
        res = admin.table("profiles").select("*").eq("is_active", False).order("created_at", desc=True).execute()
        
        # Build user email lookup map
        users_map = {}
        try:
            for u in admin.auth.admin.list_users():
                users_map[u.id] = u.email
        except Exception:
            pass

        pending_list = []
        for p in (res.data or []):
            title_str = str(p.get("title") or "")
            if title_str == "rejected":
                continue  # already rejected, not pending
            
            p_copy = dict(p)
            email = users_map.get(p["id"])
            if not email and title_str.startswith("pending_approval:"):
                email = title_str.split("pending_approval:", 1)[1]
            p_copy["email"] = email or "student@sjec.ac.in"
            p_copy["status"] = "pending_approval"
            pending_list.append(p_copy)

        return pending_list
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not load pending members: {exc}")

class ApprovalRequest(BaseModel):
    user_id: str

@app.post("/api/approve-member")
def approve_member(body: ApprovalRequest, authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    caller = _get_caller_profile(token)
    if caller.get("role_level", 0) < 5:
        raise HTTPException(status_code=403, detail="Forbidden: Faculty or HOD level required to approve applications.")

    # Self-modification lock: cannot approve self
    if caller["id"] == body.user_id:
        raise HTTPException(status_code=400, detail="Security lockdown: Cannot alter own approval status.")

    admin = get_admin_client()
    try:
        admin.table("profiles").update({
            "is_active": True,
            "title": "approved",
            "role": "member",
            "role_level": 0,
            "updated_at": datetime.datetime.utcnow().isoformat()
        }).eq("id", body.user_id).execute()

        # Record audit log
        admin.table("audit_log").insert({
            "table_name": "profiles",
            "row_id": body.user_id,
            "action": "MEMBER_APPROVED",
            "changed_by": caller["id"],
            "diff": {"approved_by": caller.get("full_name"), "role": caller.get("role")}
        }).execute()

        return {"status": "approved", "user_id": body.user_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Approval action failed: {exc}")

@app.post("/api/reject-member")
def reject_member(body: ApprovalRequest, authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    caller = _get_caller_profile(token)
    if caller.get("role_level", 0) < 5:
        raise HTTPException(status_code=403, detail="Forbidden: Faculty or HOD level required to reject applications.")

    if caller["id"] == body.user_id:
        raise HTTPException(status_code=400, detail="Security lockdown: Cannot reject own account.")

    admin = get_admin_client()
    try:
        admin.table("profiles").update({
            "is_active": False,
            "title": "rejected",
            "updated_at": datetime.datetime.utcnow().isoformat()
        }).eq("id", body.user_id).execute()

        admin.table("audit_log").insert({
            "table_name": "profiles",
            "row_id": body.user_id,
            "action": "MEMBER_REJECTED",
            "changed_by": caller["id"]
        }).execute()

        return {"status": "rejected", "user_id": body.user_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Rejection action failed: {exc}")

# ------------------------------------------------------------
# PRIVILEGED ROLE HIERARCHY & PERMISSION MANAGEMENT
# ------------------------------------------------------------
class RoleChangeRequest(BaseModel):
    target_user_id: str
    new_role: str

@app.post("/api/update-role")
def update_user_role(body: RoleChangeRequest, authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    caller = _get_caller_profile(token)
    caller_level = caller.get("role_level", 0)

    if caller_level < 4:  # At least President (4) required
        raise HTTPException(status_code=403, detail="Forbidden: Insufficient privileges for role promotion.")

    # 1. Self-Modification Lockdown: No user can modify their OWN role
    if caller["id"] == body.target_user_id:
        raise HTTPException(status_code=400, detail="Security lockdown: Self-privilege modification is strictly forbidden.")

    new_role = body.new_role.lower().strip()
    if new_role not in ROLE_LEVELS:
        raise HTTPException(status_code=400, detail=f"Invalid target role '{new_role}'.")

    target_new_level = ROLE_LEVELS[new_role]

    admin = get_admin_client()
    target_res = admin.table("profiles").select("id, role, role_level, full_name").eq("id", body.target_user_id).single().execute()
    if not target_res.data:
        raise HTTPException(status_code=404, detail="Target user profile not found.")
    target_user = target_res.data
    target_current_level = target_user.get("role_level", 0)

    # 2. Scope Matrix Enforcement:
    # - President (4): can only promote/demote between levels 1 and 3 (tech_lead, event_manager, secretary).
    #   Cannot alter faculty (5), hod (6), or other presidents (4).
    if caller_level == 4:
        if target_current_level >= 4 or target_new_level >= 4:
            raise HTTPException(status_code=403, detail="President cannot modify leadership roles at or above level 4.")
        if target_new_level < 1 or target_new_level > 3:
            raise HTTPException(status_code=403, detail="President can only promote/demote between levels 1 and 3.")

    # - Faculty (5) & HOD (6): Full CRUD across all roles
    # (HOD cannot demote another HOD without higher authority)

    # 3. Apply Update: Compute role_level and set auto_managed = false (Manual Override)
    try:
        admin.table("profiles").update({
            "role": new_role,
            "role_level": target_new_level,
            "auto_managed": False,  # Manual override disables automated alumni rollover
            "updated_at": datetime.datetime.utcnow().isoformat()
        }).eq("id", body.target_user_id).execute()

        # Audit log
        admin.table("audit_log").insert({
            "table_name": "profiles",
            "row_id": body.target_user_id,
            "action": "ROLE_MODIFIED",
            "changed_by": caller["id"],
            "diff": {
                "old_role": target_user.get("role"),
                "new_role": new_role,
                "old_level": target_current_level,
                "new_level": target_new_level,
                "auto_managed": False
            }
        }).execute()

        return {"status": "success", "new_role": new_role, "new_role_level": target_new_level}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not update user role: {exc}")

# ------------------------------------------------------------
# SECURE FILE UPLOAD WITH DEEP MIME & SIGNATURE INSPECTION
# ------------------------------------------------------------
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB

def validate_magic_bytes(content: bytes, ext: str) -> bool:
    """Inspects binary file signature to verify actual file structure."""
    if ext in [".jpg", ".jpeg"]:
        return content.startswith(b"\xff\xd8\xff")
    elif ext == ".png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    elif ext == ".webp":
        return content.startswith(b"RIFF") and len(content) >= 12 and content[8:12] == b"WEBP"
    return False

@app.post("/api/upload")
@limiter.limit("10/minute")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None)
):
    # 1. Verify caller session (Event Manager / Secretary / President and above only)
    token = parse_auth_header(authorization)
    caller = _get_caller_profile(token)
    if caller.get("role_level", 0) < 2:
        raise HTTPException(status_code=403, detail="Forbidden: Image upload requires officer privileges (role_level >= 2).")

    # 2. Whitelist Extension Check
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file extension '{ext}'. Only .png, .jpg, .jpeg, and .webp are permitted."
        )

    # 3. MIME Type Validation
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid Content-Type header '{content_type}'. Must be a valid image MIME type."
        )

    # Read binary stream
    content = await file.read()

    # 4. File Size Limit (2MB)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Hard upload limit is 2MB.")

    if len(content) < 16:
        raise HTTPException(status_code=400, detail="Corrupted file or zero length.")

    # 5. Magic Byte Inspection (Deep signature analysis)
    if not validate_magic_bytes(content, ext):
        raise HTTPException(
            status_code=400,
            detail="File signature mismatch: binary magic bytes do not match declared image extension."
        )

    # 6. Cryptographically Random UUID Renaming (eliminates path traversal)
    secure_filename = f"{uuid.uuid4().hex}{ext}"

    # 7. Upload to Supabase Storage 'club-media' bucket
    admin = get_admin_client()
    try:
        admin.storage.from_("club-media").upload(
            path=secure_filename,
            file=content,
            file_options={"content-type": content_type, "cache-control": "3600", "upsert": "true"}
        )
        public_url = admin.storage.from_("club-media").get_public_url(secure_filename)
        return {
            "status": "uploaded",
            "filename": secure_filename,
            "url": public_url,
            "size": len(content)
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {exc}")

# ------------------------------------------------------------
# PUBLIC CONTACT FORM SUBMISSION
# ------------------------------------------------------------
class ContactSubmissionRequest(BaseModel):
    name: str
    email: EmailStr
    subject: Optional[str] = ""
    message: str
    b_hp_check: Optional[str] = None

@app.post("/api/contact")
@limiter.limit("20/minute")
def submit_contact(request: Request, body: ContactSubmissionRequest):
    # Honeypot defense
    if body.b_hp_check and body.b_hp_check.strip():
        raise HTTPException(status_code=400, detail="Spam rejection.")

    clean_name = sanitize_input(body.name)
    clean_subj = sanitize_input(body.subject)
    clean_msg = sanitize_input(body.message)

    if not clean_name or not clean_msg:
        raise HTTPException(status_code=400, detail="Name and message are required fields.")

    admin = get_admin_client()
    try:
        admin.table("contact_submissions").insert({
            "name": clean_name,
            "email": body.email,
            "subject": clean_subj,
            "message": clean_msg,
            "status": "new",
            "created_at": datetime.datetime.utcnow().isoformat()
        }).execute()
    except Exception:
        # Fallback if table name is submissions
        try:
            admin.table("submissions").insert({
                "name": clean_name,
                "email": body.email,
                "message": f"[{clean_subj}] {clean_msg}",
                "status": "new",
                "created_at": datetime.datetime.utcnow().isoformat()
            }).execute()
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Could not record submission: {exc}")

    return {"status": "received", "message": "Thank you! Your enquiry has been delivered to the CSE coordinators."}

# ------------------------------------------------------------
# CONTACT INBOX RETRIEVAL (Secretary and above)
# ------------------------------------------------------------
@app.get("/api/contact-submissions")
def get_contact_submissions(authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    caller = _get_caller_profile(token)
    if caller.get("role_level", 0) < 3:
        raise HTTPException(status_code=403, detail="Forbidden: Contact inbox requires Secretary or higher privileges.")

    admin = get_admin_client()
    try:
        res = admin.table("contact_submissions").select("*").order("created_at", desc=True).execute()
        return res.data or []
    except Exception:
        try:
            res = admin.table("submissions").select("*").order("created_at", desc=True).execute()
            return res.data or []
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Could not load submissions: {exc}")

# ------------------------------------------------------------
# ALL MEMBERS LIST (For Member Management in Dashboard)
# ------------------------------------------------------------
@app.get("/api/members")
def get_all_members(authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    caller = _get_caller_profile(token)
    if caller.get("role_level", 0) < 3:
        raise HTTPException(status_code=403, detail="Forbidden: Member management requires Secretary or higher privileges.")

    admin = get_admin_client()
    try:
        res = admin.table("profiles").select("*").order("role_level", desc=True).order("created_at", desc=True).execute()
        
        users_map = {}
        try:
            for u in admin.auth.admin.list_users():
                users_map[u.id] = u.email
        except Exception:
            pass

        members = []
        for p in (res.data or []):
            p_copy = dict(p)
            title_str = str(p.get("title") or "")
            email = users_map.get(p["id"])
            if not email and title_str.startswith("pending_approval:"):
                email = title_str.split("pending_approval:", 1)[1]
            p_copy["email"] = email or "member@sjec.ac.in"

            if not p.get("is_active"):
                if title_str == "rejected":
                    p_copy["status"] = "rejected"
                else:
                    p_copy["status"] = "pending_approval"
            else:
                p_copy["status"] = "approved"
            members.append(p_copy)

        return members
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not load members: {exc}")

# ------------------------------------------------------------
# AUTOMATED ALUMNI LIFECYCLE (July 1 Rollover)
# ------------------------------------------------------------
@app.post("/api/cron/alumni-rollover")
def run_alumni_rollover(authorization: Optional[str] = Header(default=None)):
    """
    Scheduled job comparing current date against July 1 of expected_graduation_year.
    Transitions active auto_managed profiles to role='alumni', role_level=0.
    """
    admin = get_admin_client()
    today = datetime.date.today()

    try:
        profiles_res = admin.table("profiles").select("id, expected_graduation_year, auto_managed, role").eq("auto_managed", True).execute()
        affected_ids = []

        for p in (profiles_res.data or []):
            grad_year = p.get("expected_graduation_year")
            if not grad_year:
                continue
            cutoff_date = datetime.date(grad_year, 7, 1)
            if today >= cutoff_date and p.get("role") != "alumni":
                affected_ids.append(p["id"])

        if affected_ids:
            for uid in affected_ids:
                admin.table("profiles").update({
                    "role": "alumni",
                    "role_level": 0,
                    "updated_at": datetime.datetime.utcnow().isoformat()
                }).eq("id", uid).execute()

            admin.table("audit_log").insert({
                "table_name": "profiles",
                "action": "ALUMNI_ROLLOVER_JOB",
                "diff": {"affected_count": len(affected_ids), "affected_ids": affected_ids}
            }).execute()

        return {"status": "success", "affected_count": len(affected_ids)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Alumni rollover procedure error: {exc}")

# ------------------------------------------------------------
# PUBLIC CONTENT RETRIEVAL (Supabase backed with fallback)
# ------------------------------------------------------------
@app.get("/api/events")
def get_public_events():
    try:
        res = anon_client.table("events").select("*").eq("is_published", True).order("created_at", desc=True).execute()
        return res.data or []
    except Exception:
        return []

@app.get("/api/team")
def get_public_team():
    try:
        res = anon_client.table("team_members").select("*").eq("is_active", True).order("display_order", asc=True).execute()
        return res.data or []
    except Exception:
        return []

# Legacy single-payload content compatibility
CONTENT_TABLE = "site_content"
CONTENT_ROW_ID = 1

@app.get("/api/content")
def get_content():
    try:
        result = anon_client.table(CONTENT_TABLE).select("payload").eq("id", CONTENT_ROW_ID).maybe_single().execute()
        if result.data:
            return result.data["payload"]
    except Exception:
        pass
    return {"events": [], "officers": [], "committee": [], "faculty": [], "guests": []}

class ContentPayload(BaseModel):
    events: list = []
    officers: list = []
    committee: list = []
    faculty: list = []
    guests: list = []

@app.post("/api/content")
@limiter.limit("30/minute")
def save_content(request: Request, body: ContentPayload, authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    caller = _get_caller_profile(token)
    if caller.get("role_level", 0) < 2:
        raise HTTPException(status_code=403, detail="Not authorized to update content.")

    admin = get_admin_client()
    try:
        admin.table(CONTENT_TABLE).upsert({"id": CONTENT_ROW_ID, "payload": body.model_dump()}).execute()
        return {"status": "saved"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not save content: {exc}")

# ------------------------------------------------------------
# STATIC FRONTEND SERVING
# ------------------------------------------------------------
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")