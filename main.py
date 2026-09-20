from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler


# --------------------------------------------------
# APP SETUP
# --------------------------------------------------

app = FastAPI(title="BuildBlazer")

BASE_DIR = Path(__file__).resolve().parent


# --------------------------------------------------
# RATE LIMITING
# --------------------------------------------------

limiter = Limiter(key_func=get_remote_address)

app.state.limiter = limiter

app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler
)


# --------------------------------------------------
# FRONTEND PAGES
# --------------------------------------------------

@app.get("/")
async def home():
    return FileResponse(BASE_DIR / "index.html")


@app.get("/login")
async def login():
    return FileResponse(BASE_DIR / "login.html")


@app.get("/admin")
async def admin():
    return FileResponse(BASE_DIR / "admin.html")


@app.get("/signup")
async def signup():
    return FileResponse(BASE_DIR / "signup.html")


@app.get("/faculty")
async def faculty():
    return FileResponse(BASE_DIR / "faculty.html")


# --------------------------------------------------
# TEST API
# --------------------------------------------------

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "message": "BuildBlazer backend is running"
    }


# --------------------------------------------------
# RATE-LIMITED API EXAMPLES
# --------------------------------------------------

@app.post("/api/login")
@limiter.limit("5/minute")
async def login_api(request: Request):
    return {
        "message": "Login API reached"
    }


@app.post("/api/signup")
@limiter.limit("3/minute")
async def signup_api(request: Request):
    return {
        "message": "Signup API reached"
    }


@app.get("/api/data")
@limiter.limit("30/minute")
async def get_data(request: Request):
    return {
        "message": "Data returned successfully"
    }


# --------------------------------------------------
# STATIC FILES
# --------------------------------------------------

# Explicitly serve assets
app.mount(
    "/assets",
    StaticFiles(directory=BASE_DIR / "assets"),
    name="assets"
)


# Serve CSS, JS, HTML, etc. from the project root.
# KEEP THIS LAST because "/" matches everything.
app.mount(
    "/",
    StaticFiles(
        directory=BASE_DIR,
        html=True
    ),
    name="frontend"
)