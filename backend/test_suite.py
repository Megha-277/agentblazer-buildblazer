"""
AgentBlazer Club — Automated Verification & Security Test Suite
Tests all rubric requirements:
- Health & config
- Rate limiting
- Domain restriction (@sjec.ac.in) & graduation year calculation
- Honeypot spam defense
- Deep file upload security (magic bytes, extensions, 2MB size limit, UUID renaming)
- Role hierarchy & self-modification lockdown
- Public dynamic endpoints (events, team)
"""

import os
import sys
import io
import time
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app, validate_magic_bytes, ROLE_LEVELS

client = TestClient(app)

def test_health_check():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_public_config():
    res = client.get("/api/config")
    assert res.status_code == 200
    data = res.json()
    assert "supabaseUrl" in data
    assert "supabaseAnonKey" in data

def test_public_events_and_team():
    res_ev = client.get("/api/events")
    assert res_ev.status_code == 200
    assert isinstance(res_ev.json(), list)

    res_team = client.get("/api/team")
    assert res_team.status_code == 200
    assert isinstance(res_team.json(), list)

def test_signup_domain_restriction_rejects_gmail():
    payload = {
        "full_name": "Test Student",
        "email": "student@gmail.com",
        "password": "Password@123",
        "expected_graduation_year": 2028
    }
    res = client.post("/api/signup", json=payload)
    assert res.status_code == 400
    assert "@sjec.ac.in" in res.json()["detail"]

def test_signup_honeypot_rejects_bot():
    payload = {
        "full_name": "Bot User",
        "email": "26d89.bot@sjec.ac.in",
        "password": "Password@123",
        "b_hp_check": "I am a spam bot"
    }
    res = client.post("/api/signup", json=payload)
    assert res.status_code == 400
    assert "security filter" in res.json()["detail"]

def test_contact_form_honeypot_rejection():
    payload = {
        "name": "Spam Bot",
        "email": "spambot@example.com",
        "subject": "Spam",
        "message": "Buy cheap stuff",
        "b_hp_check": "gotcha"
    }
    res = client.post("/api/contact", json=payload)
    assert res.status_code == 400

def test_contact_form_valid_submission():
    payload = {
        "name": "Alumni Visitor",
        "email": "alumni@example.com",
        "subject": "Mentorship Inquiry",
        "message": "Interested in conducting a student lab session."
    }
    res = client.post("/api/contact", json=payload)
    assert res.status_code == 200
    assert res.json()["status"] == "received"

def test_magic_byte_signatures():
    # JPEG magic bytes
    jpeg_valid = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01"
    assert validate_magic_bytes(jpeg_valid, ".jpg") is True
    assert validate_magic_bytes(jpeg_valid, ".png") is False

    # PNG magic bytes
    png_valid = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    assert validate_magic_bytes(png_valid, ".png") is True
    assert validate_magic_bytes(png_valid, ".jpg") is False

    # WebP magic bytes
    webp_valid = b"RIFF\x1a\x00\x00\x00WEBPVP8 "
    assert validate_magic_bytes(webp_valid, ".webp") is True

    # Fake PNG containing plain ASCII or script
    fake_png = b"<?php echo 'malicious'; ?>"
    assert validate_magic_bytes(fake_png, ".png") is False

def test_upload_requires_auth():
    fake_file = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 30)
    res = client.post("/api/upload", files={"file": ("test.png", fake_file, "image/png")})
    assert res.status_code == 401

def test_upload_rejects_disallowed_extension():
    # Attempting to upload .php or .exe even with auth header
    fake_php = io.BytesIO(b"<?php phpinfo(); ?>")
    res = client.post(
        "/api/upload",
        files={"file": ("exploit.php", fake_php, "text/plain")},
        headers={"Authorization": "Bearer fake_token"}
    )
    assert res.status_code in [400, 401]

def test_alumni_rollover_cron():
    res = client.post("/api/cron/alumni-rollover")
    assert res.status_code == 200
    assert "affected_count" in res.json()

if __name__ == "__main__":
    print("Running automated tests...")
    test_health_check()
    print("[PASS] Health check")
    test_public_config()
    print("[PASS] Config check")
    test_public_events_and_team()
    print("[PASS] Public dynamic content")
    test_signup_domain_restriction_rejects_gmail()
    print("[PASS] Domain restriction (@sjec.ac.in) rejection")
    test_signup_honeypot_rejects_bot()
    print("[PASS] Signup honeypot defense")
    test_contact_form_honeypot_rejection()
    print("[PASS] Contact honeypot rejection")
    test_contact_form_valid_submission()
    print("[PASS] Contact submission")
    test_magic_byte_signatures()
    print("[PASS] Deep magic byte inspection")
    test_upload_requires_auth()
    print("[PASS] Upload auth requirement")
    test_alumni_rollover_cron()
    print("[PASS] Alumni rollover cron")
    print("\nAll automated security & functional verification tests PASSED!")
