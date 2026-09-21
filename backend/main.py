"""
AgentBlazer Club — Backend API
Department of CS&E, St Joseph Engineering College (SJEC)

Architecture: yearly-cycle membership model (Part A redesign)
- Faculty assigns President/Secretary; no self-application flow
- President/Secretary invite members (single or bulk CSV/Excel)
- Members must change password on first login
- Dashboard lives at /dashboard/, public site at /
"""

import os
import re
import csv
import io
import uuid
import string
import secrets
import datetime
import html as html_module
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request, Header, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from supabase import create_client, Client
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles

# Optional Excel support
try:
    import openpyxl
    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False

from email_service import (
    email_configured,
    send_welcome_credentials,
    send_announcement_notification,
    send_discussion_reply_notification,
)

logger = logging.getLogger(__name__)

# ----------------------------------------------------------------
# ENVIRONMENT
# ----------------------------------------------------------------
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL             = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY        = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_ANON_KEY in backend/.env")

# ----------------------------------------------------------------
# APP + MIDDLEWARE
# ----------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="AgentBlazer Club API", version="3.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ----------------------------------------------------------------
# SUPABASE CLIENTS
# ----------------------------------------------------------------
anon_client: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def get_admin_client() -> Client:
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Server misconfigured: missing service role key.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# ----------------------------------------------------------------
# ROLE HIERARCHY
# ----------------------------------------------------------------
ROLE_LEVELS: Dict[str, int] = {
    "hod": 6, "faculty": 5, "president": 4, "secretary": 3,
    "event_manager": 2, "tech_lead": 1, "member": 0, "alumni": 0,
}

# ----------------------------------------------------------------
# SHARED HELPERS
# ----------------------------------------------------------------

def sanitize(text: Optional[str], max_len: int = 2000) -> str:
    if not text:
        return ""
    clean = re.sub(r"<[^>]*?>", "", str(text))
    return html_module.escape(clean.strip())[:max_len]

def parse_auth_header(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")
    return authorization.removeprefix("Bearer ").strip()

def _get_caller_profile(access_token: str) -> Dict[str, Any]:
    admin = get_admin_client()
    try:
        user_resp = admin.auth.get_user(access_token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail="Invalid session token.")
        uid = user_resp.user.id
        email = user_resp.user.email or ""
        res = (
            admin.table("profiles")
            .select("id, full_name, role, role_level, auto_managed, is_active, must_change_password, joining_year, expected_graduation_year")
            .eq("id", uid)
            .maybe_single()
            .execute()
        )
        if res.data:
            p = dict(res.data)
            p["email"] = email
            return p
        return {
            "id": uid, "full_name": email, "role": "member",
            "role_level": 0, "email": email, "auto_managed": True,
            "is_active": False, "must_change_password": True,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Auth failed: {exc}")

def require_role(access_token: str, min_level: int) -> Dict[str, Any]:
    caller = _get_caller_profile(access_token)
    if not caller.get("is_active", False):
        raise HTTPException(status_code=403, detail="Account is inactive.")
    if caller.get("role_level", 0) < min_level:
        raise HTTPException(status_code=403, detail="Insufficient privileges.")
    return caller

def gen_temp_password(length: int = 14) -> str:
    """Generates a temp password meeting strength rules: upper+lower+digit+special."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        pw = "".join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.isupper() for c in pw)
                and any(c.islower() for c in pw)
                and any(c.isdigit() for c in pw)
                and any(c in "!@#$%^&*" for c in pw)):
            return pw

# ----------------------------------------------------------------
# FILE UPLOAD SECURITY
# ----------------------------------------------------------------
ALLOWED_IMG_EXT  = {".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_IMG_MIME = {"image/png", "image/jpeg", "image/webp"}
MAX_FILE_SIZE    = 2 * 1024 * 1024  # 2 MB

def validate_magic_bytes(content: bytes, ext: str) -> bool:
    if ext in (".jpg", ".jpeg"):
        return content.startswith(b"\xff\xd8\xff")
    if ext == ".png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if ext == ".webp":
        return content.startswith(b"RIFF") and len(content) >= 12 and content[8:12] == b"WEBP"
    return False

# ================================================================
# PUBLIC ENDPOINTS
# ================================================================

@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.datetime.utcnow().isoformat()}

@app.get("/api/config")
def get_config():
    return {"supabaseUrl": SUPABASE_URL, "supabaseAnonKey": SUPABASE_ANON_KEY}

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
@app.get("/api/content")
def get_content():
    try:
        result = anon_client.table("site_content").select("payload").eq("id", 1).maybe_single().execute()
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
    require_role(token, 2)
    admin = get_admin_client()
    try:
        admin.table("site_content").upsert({"id": 1, "payload": body.model_dump()}).execute()
        return {"status": "saved"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not save: {exc}")

# ================================================================
# AUTH
# ================================================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def pw_len(cls, v: str) -> str:
        if len(v) < 6 or len(v) > 128:
            raise ValueError("Password length must be 6–128 characters.")
        return v

@app.post("/api/login")
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest):
    try:
        result = anon_client.auth.sign_in_with_password({"email": body.email, "password": body.password})
    except Exception:
        raise HTTPException(status_code=401, detail="Entered password and email mismatch.")

    if not result or not result.session:
        raise HTTPException(status_code=401, detail="Entered password and email mismatch.")

    # Check account state
    admin = get_admin_client()
    try:
        p = admin.table("profiles").select("is_active, must_change_password, role_level").eq("id", result.user.id).maybe_single().execute()
        if p.data:
            if not p.data.get("is_active", True):
                raise HTTPException(status_code=403, detail="Account is inactive. Contact club administration.")
    except HTTPException:
        raise
    except Exception:
        pass

    must_change = False
    try:
        if p.data:
            must_change = bool(p.data.get("must_change_password", False))
    except Exception:
        pass

    return {
        "access_token":    result.session.access_token,
        "refresh_token":   result.session.refresh_token,
        "expires_at":      result.session.expires_at,
        "user_id":         result.user.id,
        "must_change_password": must_change,
    }

class ChangePasswordRequest(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def pw_strength(cls, v: str) -> str:
        errors = []
        if len(v) < 8:            errors.append("at least 8 characters")
        if not any(c.isupper() for c in v): errors.append("one uppercase letter")
        if not any(c.islower() for c in v): errors.append("one lowercase letter")
        if not any(c.isdigit() for c in v): errors.append("one number")
        if not any(c in "!@#$%^&*()_+-=[]{}|;':\",./<>?" for c in v):
            errors.append("one special character")
        if errors:
            raise ValueError("Password must contain: " + ", ".join(errors) + ".")
        if len(v) > 128:
            raise ValueError("Password too long (max 128).")
        return v

@app.post("/api/change-password")
@limiter.limit("10/minute")
def change_password(request: Request, body: ChangePasswordRequest, authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    caller = _get_caller_profile(token)
    admin = get_admin_client()
    try:
        admin.auth.admin.update_user_by_id(caller["id"], {"password": body.new_password})
        admin.table("profiles").update({
            "must_change_password": False,
            "updated_at": datetime.datetime.utcnow().isoformat(),
        }).eq("id", caller["id"]).execute()
        admin.table("audit_log").insert({
            "table_name": "profiles", "row_id": caller["id"],
            "action": "PASSWORD_CHANGED", "changed_by": caller["id"],
        }).execute()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Password change failed: {exc}")
    return {"status": "changed"}

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

@app.post("/api/forgot-password")
@limiter.limit("5/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest):
    """Triggers Supabase built-in password reset email."""
    try:
        anon_client.auth.reset_password_email(body.email)
    except Exception:
        pass  # Always return 200 — don't reveal whether email exists
    return {"status": "sent", "message": "If that email has an account, a reset link has been sent."}

@app.get("/api/profile")
def get_profile(authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    return _get_caller_profile(token)

# ================================================================
# MEMBER MANAGEMENT (new yearly-cycle flow)
# ================================================================

@app.get("/api/members")
def get_all_members(authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    require_role(token, 3)  # Secretary and above
    admin = get_admin_client()
    try:
        res = admin.table("profiles").select("*").order("role_level", desc=True).order("created_at", desc=True).execute()
        users_map: Dict[str, str] = {}
        try:
            for u in admin.auth.admin.list_users():
                users_map[u.id] = u.email or ""
        except Exception:
            pass
        members = []
        for p in (res.data or []):
            pc = dict(p)
            pc["email"] = users_map.get(p["id"], p.get("email", ""))
            members.append(pc)
        return members
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not load members: {exc}")

class InviteMemberRequest(BaseModel):
    email: EmailStr
    full_name: str
    role: Optional[str] = "member"
    joining_year: Optional[int] = None
    expected_graduation_year: Optional[int] = None
    send_email_credentials: bool = True

@app.post("/api/members/invite")
@limiter.limit("20/minute")
def invite_member(request: Request, body: InviteMemberRequest, authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    caller = require_role(token, 3)  # Secretary (3) and above can invite

    new_role = body.role.lower().strip() if body.role else "member"
    if new_role not in ROLE_LEVELS:
        new_role = "member"

    # Only President (4)+ can assign roles above member
    if ROLE_LEVELS[new_role] > 1 and caller["role_level"] < 4:
        raise HTTPException(status_code=403, detail="Secretary can only invite members at member/tech_lead level.")

    # Enforce single-president / single-secretary constraint at API level too
    # (DB partial unique index is the hard enforcement; this gives a friendly error)
    admin = get_admin_client()
    if new_role in ("president", "secretary"):
        existing = admin.table("profiles").select("id").eq("role", new_role).eq("is_active", True).execute()
        if existing.data:
            raise HTTPException(
                status_code=409,
                detail=f"An active {new_role.capitalize()} already exists. Deactivate the current one first.",
            )

    temp_pw = gen_temp_password()
    joining_year = body.joining_year or datetime.date.today().year
    grad_year = body.expected_graduation_year or (joining_year + 4)

    try:
        auth_user = admin.auth.admin.create_user({
            "email": body.email,
            "password": temp_pw,
            "email_confirm": True,
            "user_metadata": {"full_name": body.full_name},
        })
        new_uid = auth_user.user.id
    except Exception as exc:
        msg = str(exc).lower()
        if "already" in msg or "exists" in msg:
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
        raise HTTPException(status_code=400, detail=f"Could not create account: {exc}")

    try:
        admin.table("profiles").upsert({
            "id": new_uid,
            "full_name": sanitize(body.full_name),
            "email": body.email,
            "role": new_role,
            "role_level": ROLE_LEVELS[new_role],
            "joining_year": joining_year,
            "current_academic_year": datetime.date.today().year,
            "expected_graduation_year": grad_year,
            "must_change_password": True,
            "auto_managed": True,
            "is_active": True,
            "created_at": datetime.datetime.utcnow().isoformat(),
            "updated_at": datetime.datetime.utcnow().isoformat(),
        }).execute()
    except Exception as exc:
        logger.error("Profile upsert failed for %s: %s", new_uid, exc)

    # Notification prefs row
    try:
        admin.table("notification_preferences").insert({"user_id": new_uid}).execute()
    except Exception:
        pass

    admin.table("audit_log").insert({
        "table_name": "profiles", "row_id": str(new_uid),
        "action": "MEMBER_INVITED", "changed_by": caller["id"],
        "diff": {"email": body.email, "role": new_role, "invited_by": caller.get("full_name")},
    }).execute()

    email_sent, manual_text = send_welcome_credentials(body.email, body.full_name, temp_pw)

    return {
        "status": "invited",
        "user_id": new_uid,
        "email": body.email,
        "role": new_role,
        "temp_password": temp_pw if not email_sent else None,
        "manual_credentials": manual_text if not email_sent else None,
        "email_sent": email_sent,
        "email_configured": email_configured(),
    }

@app.post("/api/members/bulk-invite")
@limiter.limit("5/minute")
async def bulk_invite(
    request: Request,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
):
    """
    Accepts CSV or Excel (.xlsx) file with columns:
      full_name, email, role (optional), joining_year (optional), expected_graduation_year (optional)

    Validates the entire file first — no accounts created until all rows pass.
    Returns row-level errors if validation fails.
    """
    token = parse_auth_header(authorization)
    caller = require_role(token, 4)  # President and above only

    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".csv", ".xlsx"):
        raise HTTPException(status_code=400, detail="Only .csv or .xlsx files are accepted.")

    content = await file.read()
    if len(content) > 1 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 1 MB).")

    # ---- Parse rows ----
    rows: List[Dict] = []
    try:
        if ext == ".csv":
            text = content.decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(text))
            rows = [dict(r) for r in reader]
        else:
            if not OPENPYXL_AVAILABLE:
                raise HTTPException(status_code=400, detail="Excel support not installed. Use CSV instead.")
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            ws = wb.active
            headers = [str(c.value or "").strip().lower() for c in next(ws.iter_rows(min_row=1, max_row=1))]
            for row in ws.iter_rows(min_row=2, values_only=True):
                rows.append(dict(zip(headers, [str(v or "").strip() for v in row])))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {exc}")

    if not rows:
        raise HTTPException(status_code=400, detail="File contains no data rows.")

    # ---- Normalise header names (case-insensitive) ----
    def pick(row: Dict, *keys) -> str:
        for k in keys:
            for rk in row:
                if rk.strip().lower() == k:
                    return str(row[rk]).strip()
        return ""

    # ---- Validate all rows first ----
    email_re = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    seen_emails: set = set()
    validation_errors: List[Dict] = []

    for i, row in enumerate(rows, start=2):  # row 2 = first data row
        full_name = pick(row, "full_name", "name", "fullname")
        email     = pick(row, "email", "e-mail").lower()
        role      = pick(row, "role") or "member"

        if not full_name:
            validation_errors.append({"row": i, "error": "full_name is required."})
        if not email:
            validation_errors.append({"row": i, "error": "email is required."})
        elif not email_re.match(email):
            validation_errors.append({"row": i, "error": f"Invalid email format: {email}"})
        elif email in seen_emails:
            validation_errors.append({"row": i, "error": f"Duplicate email in file: {email}"})
        else:
            seen_emails.add(email)

        if role not in ROLE_LEVELS:
            validation_errors.append({"row": i, "error": f"Unknown role '{role}'. Valid: {', '.join(ROLE_LEVELS)}"})

    if validation_errors:
        return {"status": "validation_failed", "errors": validation_errors, "created": 0}

    # ---- Create accounts ----
    admin = get_admin_client()
    results: List[Dict] = []
    created = 0
    failed  = 0

    for i, row in enumerate(rows, start=2):
        full_name   = pick(row, "full_name", "name", "fullname")
        email       = pick(row, "email", "e-mail").lower()
        role        = pick(row, "role") or "member"
        joining_str = pick(row, "joining_year", "joiningyear", "join_year")
        grad_str    = pick(row, "expected_graduation_year", "grad_year", "graduationyear")

        joining_year = int(joining_str) if joining_str.isdigit() else datetime.date.today().year
        grad_year    = int(grad_str) if grad_str.isdigit() else joining_year + 4
        temp_pw      = gen_temp_password()

        try:
            auth_user = admin.auth.admin.create_user({
                "email": email,
                "password": temp_pw,
                "email_confirm": True,
                "user_metadata": {"full_name": full_name},
            })
            new_uid = auth_user.user.id

            admin.table("profiles").upsert({
                "id": new_uid,
                "full_name": sanitize(full_name),
                "email": email,
                "role": role,
                "role_level": ROLE_LEVELS.get(role, 0),
                "joining_year": joining_year,
                "current_academic_year": datetime.date.today().year,
                "expected_graduation_year": grad_year,
                "must_change_password": True,
                "auto_managed": True,
                "is_active": True,
                "created_at": datetime.datetime.utcnow().isoformat(),
                "updated_at": datetime.datetime.utcnow().isoformat(),
            }).execute()

            try:
                admin.table("notification_preferences").insert({"user_id": new_uid}).execute()
            except Exception:
                pass

            email_sent, manual_text = send_welcome_credentials(email, full_name, temp_pw)
            results.append({
                "row": i, "email": email, "status": "created",
                "temp_password": temp_pw if not email_sent else None,
                "email_sent": email_sent,
            })
            created += 1
        except Exception as exc:
            results.append({"row": i, "email": email, "status": "failed", "error": str(exc)})
            failed += 1

    admin.table("audit_log").insert({
        "table_name": "profiles", "action": "BULK_INVITE",
        "changed_by": caller["id"],
        "diff": {"created": created, "failed": failed, "total": len(rows)},
    }).execute()

    return {
        "status": "completed",
        "created": created,
        "failed": failed,
        "results": results,
        "email_configured": email_configured(),
    }

class DeactivateMemberRequest(BaseModel):
    user_id: str
    reason: Optional[str] = "deactivated_by_admin"

@app.post("/api/members/deactivate")
def deactivate_member(body: DeactivateMemberRequest, authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    caller = require_role(token, 4)  # President (4) and Faculty/HOD (5/6)

    if caller["id"] == body.user_id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account.")

    admin = get_admin_client()
    target = admin.table("profiles").select("role_level, full_name").eq("id", body.user_id).maybe_single().execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="User not found.")

    target_level = target.data.get("role_level", 0)
    if caller["role_level"] <= target_level:
        raise HTTPException(status_code=403, detail="Cannot deactivate a member at or above your own role level.")

    try:
        admin.table("profiles").update({
            "is_active": False,
            "auto_managed": False,
            "updated_at": datetime.datetime.utcnow().isoformat(),
        }).eq("id", body.user_id).execute()
        admin.table("audit_log").insert({
            "table_name": "profiles", "row_id": body.user_id,
            "action": "MEMBER_DEACTIVATED", "changed_by": caller["id"],
            "diff": {"reason": sanitize(body.reason), "by": caller.get("full_name")},
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Deactivation failed: {exc}")

    return {"status": "deactivated", "user_id": body.user_id}

class RoleChangeRequest(BaseModel):
    target_user_id: str
    new_role: str

@app.post("/api/update-role")
def update_role(body: RoleChangeRequest, authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    caller = require_role(token, 4)

    if caller["id"] == body.target_user_id:
        raise HTTPException(status_code=400, detail="Cannot change your own role.")

    new_role = body.new_role.lower().strip()
    if new_role not in ROLE_LEVELS:
        raise HTTPException(status_code=400, detail=f"Unknown role: {new_role}")

    new_level = ROLE_LEVELS[new_role]
    caller_level = caller["role_level"]

    # President (4) can only manage levels 1–3
    if caller_level == 4 and (new_level >= 4):
        raise HTTPException(status_code=403, detail="President can only assign roles up to Secretary level.")

    admin = get_admin_client()

    # Enforce single-president / single-secretary
    if new_role in ("president", "secretary"):
        existing = admin.table("profiles").select("id").eq("role", new_role).eq("is_active", True).execute()
        existing_ids = [r["id"] for r in (existing.data or []) if r["id"] != body.target_user_id]
        if existing_ids:
            raise HTTPException(
                status_code=409,
                detail=f"An active {new_role.capitalize()} already exists. Deactivate them first.",
            )

    target = admin.table("profiles").select("role, role_level, full_name").eq("id", body.target_user_id).maybe_single().execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="Target user not found.")

    old_level = target.data.get("role_level", 0)
    if caller_level <= old_level and caller_level < 5:
        raise HTTPException(status_code=403, detail="Cannot modify a member at or above your role level.")

    try:
        admin.table("profiles").update({
            "role": new_role,
            "role_level": new_level,
            "auto_managed": False,
            "updated_at": datetime.datetime.utcnow().isoformat(),
        }).eq("id", body.target_user_id).execute()
        admin.table("audit_log").insert({
            "table_name": "profiles", "row_id": body.target_user_id,
            "action": "ROLE_CHANGED", "changed_by": caller["id"],
            "diff": {"old_role": target.data.get("role"), "new_role": new_role},
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Role update failed: {exc}")

    return {"status": "updated", "new_role": new_role, "new_role_level": new_level}

# ================================================================
# ANNOUNCEMENTS
# ================================================================

@app.get("/api/announcements")
def get_announcements(pinned_only: bool = False):
    """Public endpoint — returns published announcements."""
    try:
        q = anon_client.table("announcements").select("*").eq("is_published", True)
        if pinned_only:
            q = q.eq("is_pinned", True)
        q = q.order("is_pinned", desc=True).order("published_at", desc=True)
        res = q.execute()
        return res.data or []
    except Exception:
        return []

class AnnouncementBody(BaseModel):
    title: str
    body: str
    category: Optional[str] = "general"
    is_published: bool = False
    is_pinned: bool = False

@app.post("/api/announcements")
def create_announcement(body: AnnouncementBody, authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    caller = require_role(token, 2)  # Event Manager and above
    admin = get_admin_client()
    try:
        row = {
            "title":       sanitize(body.title, 200),
            "body":        sanitize(body.body, 5000),
            "category":    body.category if body.category in (
                "general","competition","registration","workshop","achievement","notice"
            ) else "general",
            "is_published": body.is_published,
            "is_pinned":    body.is_pinned,
            "published_at": datetime.datetime.utcnow().isoformat() if body.is_published else None,
            "created_by":   caller["id"],
        }
        res = admin.table("announcements").insert(row).execute()
        return res.data[0] if res.data else {"status": "created"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not create announcement: {exc}")

@app.patch("/api/announcements/{ann_id}")
def update_announcement(ann_id: str, body: AnnouncementBody, authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    require_role(token, 2)
    admin = get_admin_client()
    try:
        updates: Dict[str, Any] = {
            "title":        sanitize(body.title, 200),
            "body":         sanitize(body.body, 5000),
            "category":     body.category if body.category in (
                "general","competition","registration","workshop","achievement","notice"
            ) else "general",
            "is_published": body.is_published,
            "is_pinned":    body.is_pinned,
        }
        if body.is_published:
            updates["published_at"] = datetime.datetime.utcnow().isoformat()
        admin.table("announcements").update(updates).eq("id", ann_id).execute()
        return {"status": "updated"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Update failed: {exc}")

@app.delete("/api/announcements/{ann_id}")
def delete_announcement(ann_id: str, authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    require_role(token, 3)  # Secretary and above to delete
    admin = get_admin_client()
    try:
        admin.table("announcements").delete().eq("id", ann_id).execute()
        return {"status": "deleted"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Delete failed: {exc}")

# ================================================================
# SUBSCRIBERS
# ================================================================

class SubscribeRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None

@app.post("/api/subscribers")
@limiter.limit("10/minute")
def subscribe(request: Request, body: SubscribeRequest):
    admin = get_admin_client()
    try:
        admin.table("subscribers").upsert({
            "email": body.email,
            "name": sanitize(body.name or "", 100),
            "status": "active",
        }, on_conflict="email").execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Subscription failed: {exc}")
    return {"status": "subscribed"}

@app.get("/api/subscribers")
def get_subscribers(authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    require_role(token, 3)
    admin = get_admin_client()
    try:
        res = admin.table("subscribers").select("*").order("created_at", desc=True).execute()
        return res.data or []
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not load subscribers: {exc}")

# ================================================================
# DISCUSSIONS
# ================================================================

class ThreadBody(BaseModel):
    title: str
    body: str
    category: Optional[str] = "general"

@app.get("/api/discussions")
def get_threads(authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    require_role(token, 0)
    admin = get_admin_client()
    try:
        res = (
            admin.table("discussion_threads")
            .select("*, profiles(full_name)")
            .order("is_pinned", desc=True)
            .order("last_reply_at", desc=True, nullsfirst=False)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not load threads: {exc}")

@app.post("/api/discussions")
def create_thread(body: ThreadBody, authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    caller = require_role(token, 0)
    admin = get_admin_client()
    valid_cats = {"general","events","projects","recruitment","technical"}
    try:
        res = admin.table("discussion_threads").insert({
            "title":      sanitize(body.title, 200),
            "body":       sanitize(body.body, 10000),
            "category":   body.category if body.category in valid_cats else "general",
            "created_by": caller["id"],
        }).execute()
        return res.data[0] if res.data else {"status": "created"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not create thread: {exc}")

class ReplyBody(BaseModel):
    body: str

@app.get("/api/discussions/{thread_id}/replies")
def get_replies(thread_id: str, authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    require_role(token, 0)
    admin = get_admin_client()
    try:
        res = (
            admin.table("discussion_replies")
            .select("*, profiles(full_name)")
            .eq("thread_id", thread_id)
            .order("created_at", asc=True)
            .execute()
        )
        # Mark as read
        caller = _get_caller_profile(token)
        try:
            admin.table("unread_markers").upsert(
                {"user_id": caller["id"], "thread_id": thread_id, "last_read": datetime.datetime.utcnow().isoformat()},
                on_conflict="user_id,thread_id",
            ).execute()
        except Exception:
            pass
        return res.data or []
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not load replies: {exc}")

@app.post("/api/discussions/{thread_id}/replies")
def post_reply(thread_id: str, body: ReplyBody, authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    caller = require_role(token, 0)
    admin = get_admin_client()
    try:
        res = admin.table("discussion_replies").insert({
            "thread_id":  thread_id,
            "body":       sanitize(body.body, 5000),
            "created_by": caller["id"],
        }).execute()

        # Fetch thread for notification
        t = admin.table("discussion_threads").select("title, created_by").eq("id", thread_id).maybe_single().execute()
        if t.data and t.data["created_by"] != caller["id"]:
            owner_id = t.data["created_by"]
            prefs = admin.table("notification_preferences").select("email_on_reply").eq("user_id", owner_id).maybe_single().execute()
            if prefs.data and prefs.data.get("email_on_reply", True):
                owner_profile = admin.table("profiles").select("full_name").eq("id", owner_id).maybe_single().execute()
                owner_email_res = admin.auth.admin.get_user_by_id(owner_id)
                if owner_email_res and owner_email_res.user:
                    send_discussion_reply_notification(
                        owner_email_res.user.email,
                        caller.get("full_name", "A member"),
                        t.data["title"],
                        body.body[:300],
                    )

        return res.data[0] if res.data else {"status": "posted"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not post reply: {exc}")

@app.get("/api/unread")
def get_unread_counts(authorization: Optional[str] = Header(default=None)):
    """Returns thread IDs that have replies newer than the user's last_read marker."""
    token = parse_auth_header(authorization)
    caller = _get_caller_profile(token)
    admin = get_admin_client()
    try:
        # Threads with replies newer than last_read (or no marker at all)
        markers = admin.table("unread_markers").select("thread_id, last_read").eq("user_id", caller["id"]).execute()
        read_map = {m["thread_id"]: m["last_read"] for m in (markers.data or [])}

        threads = admin.table("discussion_threads").select("id, last_reply_at, reply_count").execute()
        unread = []
        for t in (threads.data or []):
            if not t.get("last_reply_at"):
                continue
            last_read = read_map.get(t["id"])
            if not last_read or t["last_reply_at"] > last_read:
                unread.append(t["id"])
        return {"unread_thread_ids": unread, "count": len(unread)}
    except Exception:
        return {"unread_thread_ids": [], "count": 0}

# ================================================================
# NOTIFICATION PREFERENCES
# ================================================================

class NotifPrefsBody(BaseModel):
    email_on_reply:         Optional[bool] = None
    email_on_new_thread:    Optional[bool] = None
    email_on_announcements: Optional[bool] = None

@app.get("/api/notifications/prefs")
def get_notif_prefs(authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    caller = _get_caller_profile(token)
    admin = get_admin_client()
    res = admin.table("notification_preferences").select("*").eq("user_id", caller["id"]).maybe_single().execute()
    if res.data:
        return res.data
    # Return defaults
    return {"user_id": caller["id"], "email_on_reply": True, "email_on_new_thread": False, "email_on_announcements": True}

@app.post("/api/notifications/prefs")
def save_notif_prefs(body: NotifPrefsBody, authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    caller = _get_caller_profile(token)
    admin = get_admin_client()
    updates: Dict[str, Any] = {"user_id": caller["id"]}
    if body.email_on_reply         is not None: updates["email_on_reply"]         = body.email_on_reply
    if body.email_on_new_thread    is not None: updates["email_on_new_thread"]    = body.email_on_new_thread
    if body.email_on_announcements is not None: updates["email_on_announcements"] = body.email_on_announcements
    try:
        admin.table("notification_preferences").upsert(updates, on_conflict="user_id").execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not save preferences: {exc}")
    return {"status": "saved"}

# ================================================================
# CONTACT FORM (unchanged, kept from existing)
# ================================================================

class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    subject: Optional[str] = ""
    message: str
    b_hp_check: Optional[str] = None

@app.post("/api/contact")
@limiter.limit("20/minute")
def submit_contact(request: Request, body: ContactRequest):
    if body.b_hp_check and body.b_hp_check.strip():
        raise HTTPException(status_code=400, detail="Spam rejected.")
    name = sanitize(body.name)
    msg  = sanitize(body.message, 2000)
    subj = sanitize(body.subject or "", 150)
    if not name or not msg:
        raise HTTPException(status_code=400, detail="Name and message are required.")
    admin = get_admin_client()
    try:
        admin.table("contact_submissions").insert({
            "name": name, "email": body.email,
            "subject": subj, "message": msg,
            "status": "new",
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not record: {exc}")
    return {"status": "received", "message": "Thank you! Your enquiry has been delivered."}

@app.get("/api/contact-submissions")
def get_submissions(authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    require_role(token, 3)
    admin = get_admin_client()
    try:
        res = admin.table("contact_submissions").select("*").order("created_at", desc=True).execute()
        return res.data or []
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not load: {exc}")

# ================================================================
# SECURE FILE UPLOAD
# ================================================================

@app.post("/api/upload")
@limiter.limit("10/minute")
async def upload_image(request: Request, file: UploadFile = File(...), authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    require_role(token, 2)

    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_IMG_EXT:
        raise HTTPException(status_code=400, detail=f"Extension '{ext}' not allowed.")

    content_type = file.content_type or ""
    if content_type not in ALLOWED_IMG_MIME:
        raise HTTPException(status_code=400, detail=f"MIME type '{content_type}' not allowed.")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 2 MB limit.")
    if len(content) < 16:
        raise HTTPException(status_code=400, detail="File appears empty or corrupted.")
    if not validate_magic_bytes(content, ext):
        raise HTTPException(status_code=400, detail="File signature mismatch.")

    secure_name = f"{uuid.uuid4().hex}{ext}"
    admin = get_admin_client()
    try:
        admin.storage.from_("club-media").upload(
            path=secure_name, file=content,
            file_options={"content-type": content_type, "cache-control": "3600", "upsert": "true"},
        )
        url = admin.storage.from_("club-media").get_public_url(secure_name)
        return {"status": "uploaded", "filename": secure_name, "url": url, "size": len(content)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {exc}")

# ================================================================
# ALUMNI ROLLOVER CRON (protected — requires HOD/Faculty token)
# ================================================================

@app.post("/api/cron/alumni-rollover")
def run_alumni_rollover(authorization: Optional[str] = Header(default=None)):
    token = parse_auth_header(authorization)
    require_role(token, 5)  # Faculty or HOD only
    admin = get_admin_client()
    today = datetime.date.today()
    try:
        profiles = admin.table("profiles").select("id, expected_graduation_year, role").eq("auto_managed", True).execute()
        to_promote = [
            p["id"] for p in (profiles.data or [])
            if p.get("expected_graduation_year")
            and today >= datetime.date(p["expected_graduation_year"], 7, 1)
            and p.get("role") != "alumni"
        ]
        for uid in to_promote:
            admin.table("profiles").update({
                "role": "alumni", "role_level": 0,
                "is_active": False,
                "updated_at": datetime.datetime.utcnow().isoformat(),
            }).eq("id", uid).execute()
        if to_promote:
            admin.table("audit_log").insert({
                "table_name": "profiles", "action": "ALUMNI_ROLLOVER",
                "diff": {"affected_count": len(to_promote)},
            }).execute()
        return {"status": "success", "affected_count": len(to_promote)}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Rollover error: {exc}")

# ================================================================
# STATIC FILES — public site at /, dashboard at /dashboard/
# ================================================================
_base = os.path.dirname(__file__)
_frontend_path  = os.path.join(_base, "..", "frontend")
_dashboard_path = os.path.join(_base, "..", "dashboard")

app.mount("/dashboard", StaticFiles(directory=_dashboard_path, html=True), name="dashboard")
app.mount("/",          StaticFiles(directory=_frontend_path,  html=True), name="frontend")
