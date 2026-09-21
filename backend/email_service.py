"""
AgentBlazer Club — Email Service
Provider-agnostic SMTP mailer. Configured entirely via environment
variables. All email sending is optional — if SMTP credentials are
not set, callers receive a plain-text credential block to share
manually instead.
"""

import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

logger = logging.getLogger(__name__)

# ----------------------------------------------------------------
# Configuration — loaded from environment; never hardcoded
# ----------------------------------------------------------------
SMTP_HOST     = os.environ.get("SMTP_HOST", "")
SMTP_PORT     = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM     = os.environ.get("SMTP_FROM", "noreply@agentblazer.sjec.ac.in")

def email_configured() -> bool:
    """Return True only when all required SMTP env vars are set."""
    return bool(SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD)


def send_email(to: str, subject: str, html_body: str, text_body: str = "") -> bool:
    """
    Send a single email.  Returns True on success, False on failure.
    Never raises — failures are logged, not surfaced to the caller.
    """
    if not email_configured():
        logger.warning("Email not configured (SMTP_HOST/SMTP_USERNAME/SMTP_PASSWORD missing).")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = SMTP_FROM
    msg["To"]      = to

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [to], msg.as_string())
        logger.info("Email sent to %s: %s", to, subject)
        return True
    except Exception as exc:
        logger.error("Email send failed to %s: %s", to, exc)
        return False


# ----------------------------------------------------------------
# Pre-built templates
# ----------------------------------------------------------------

def send_welcome_credentials(
    to: str,
    full_name: str,
    temp_password: str,
    dashboard_url: str = "/dashboard/login.html",
) -> tuple[bool, str]:
    """
    Send member welcome email with temporary credentials.
    Returns (email_sent: bool, manual_text: str).
    manual_text is always populated so the inviter can share it
    manually if email is not configured or delivery fails.
    """
    manual_text = (
        f"Welcome to AgentBlazer Club, {full_name}!\n\n"
        f"Your temporary credentials:\n"
        f"  Email:    {to}\n"
        f"  Password: {temp_password}\n\n"
        f"Sign in at: {dashboard_url}\n"
        f"You will be required to change your password on first login.\n\n"
        f"— AgentBlazer Club, SJEC CSE"
    )

    html_body = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;
                background:#0f0f18;color:#e2e8f0;border-radius:12px;
                padding:32px;border:1px solid rgba(255,255,255,0.08)">
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;
                 background:linear-gradient(90deg,#2ee6d6,#a855f7);
                 -webkit-background-clip:text;-webkit-text-fill-color:transparent">
        Welcome to AgentBlazer Club
      </h2>
      <p style="color:#94a3b8;margin:0 0 24px;font-size:14px">
        Department of Computer Science &amp; Engineering, SJEC
      </p>

      <p style="margin:0 0 16px">Hello <strong>{full_name}</strong>,</p>
      <p style="margin:0 0 24px;color:#cbd5e1">
        Your membership account has been created. Use the temporary credentials
        below to sign in — you'll be asked to set a new password immediately.
      </p>

      <div style="background:rgba(255,255,255,0.05);border-radius:8px;
                  padding:16px 20px;margin-bottom:24px;border:1px solid rgba(255,255,255,0.1)">
        <div style="margin-bottom:8px">
          <span style="color:#94a3b8;font-size:12px;text-transform:uppercase;
                       letter-spacing:1px">Email</span><br>
          <code style="font-size:15px;color:#e2e8f0">{to}</code>
        </div>
        <div>
          <span style="color:#94a3b8;font-size:12px;text-transform:uppercase;
                       letter-spacing:1px">Temporary Password</span><br>
          <code style="font-size:15px;color:#a855f7;font-weight:700">{temp_password}</code>
        </div>
      </div>

      <a href="{dashboard_url}"
         style="display:inline-block;background:linear-gradient(90deg,#2ee6d6,#a855f7);
                color:#0f0f18;font-weight:700;padding:12px 24px;border-radius:8px;
                text-decoration:none;font-size:14px">
        Sign in to Dashboard →
      </a>

      <p style="margin:24px 0 0;font-size:12px;color:#64748b">
        This is an automated message from AgentBlazer Club, SJEC CSE.<br>
        Do not reply to this email.
      </p>
    </div>
    """

    sent = send_email(to, "Your AgentBlazer Club Dashboard Credentials", html_body, manual_text)
    return sent, manual_text


def send_announcement_notification(
    to: str,
    full_name: str,
    announcement_title: str,
    announcement_body: str,
    site_url: str = "/announcements.html",
) -> bool:
    html_body = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;
                background:#0f0f18;color:#e2e8f0;border-radius:12px;
                padding:32px;border:1px solid rgba(255,255,255,0.08)">
      <h2 style="margin:0 0 16px;color:#2ee6d6;font-size:18px">
        📢 New Announcement — AgentBlazer Club
      </h2>
      <h3 style="margin:0 0 12px;font-size:16px;font-weight:700">{announcement_title}</h3>
      <p style="color:#cbd5e1;line-height:1.6">{announcement_body[:400]}{'...' if len(announcement_body) > 400 else ''}</p>
      <a href="{site_url}"
         style="display:inline-block;margin-top:20px;background:#a855f7;
                color:#fff;padding:10px 22px;border-radius:8px;
                text-decoration:none;font-size:13px;font-weight:600">
        View on Club Website →
      </a>
      <p style="margin:20px 0 0;font-size:11px;color:#64748b">
        You're receiving this because you subscribed to AgentBlazer Club updates.
      </p>
    </div>
    """
    return send_email(to, f"[AgentBlazer] {announcement_title}", html_body)


def send_discussion_reply_notification(
    to: str,
    replier_name: str,
    thread_title: str,
    reply_preview: str,
    dashboard_url: str = "/dashboard/admin.html",
) -> bool:
    html_body = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;
                background:#0f0f18;color:#e2e8f0;border-radius:12px;
                padding:32px;border:1px solid rgba(255,255,255,0.08)">
      <h2 style="margin:0 0 16px;color:#a855f7;font-size:18px">
        💬 New Reply in Discussion
      </h2>
      <p style="margin:0 0 8px;color:#94a3b8;font-size:13px">Thread:</p>
      <h3 style="margin:0 0 16px;font-size:16px;font-weight:700">{thread_title}</h3>
      <p style="color:#cbd5e1;font-size:13px;margin:0 0 8px">
        <strong>{replier_name}</strong> replied:
      </p>
      <blockquote style="border-left:3px solid #a855f7;margin:0 0 20px;
                         padding:8px 16px;color:#94a3b8;font-style:italic;
                         background:rgba(255,255,255,0.03);border-radius:0 6px 6px 0">
        {reply_preview[:300]}{'...' if len(reply_preview) > 300 else ''}
      </blockquote>
      <a href="{dashboard_url}"
         style="display:inline-block;background:#a855f7;color:#fff;
                padding:10px 22px;border-radius:8px;text-decoration:none;
                font-size:13px;font-weight:600">
        View in Dashboard →
      </a>
      <p style="margin:20px 0 0;font-size:11px;color:#64748b">
        Manage notification preferences from your dashboard profile settings.
      </p>
    </div>
    """
    return send_email(to, f"[AgentBlazer] New reply: {thread_title}", html_body)
