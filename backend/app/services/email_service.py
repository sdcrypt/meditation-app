import json
import smtplib
from email.message import EmailMessage
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import settings
from app.core.logging import get_logger


logger = get_logger(__name__)


def build_password_reset_email(reset_url: str) -> tuple[str, str, str]:
    """Build the subject, text body, and HTML body for a reset email."""
    subject = "Reset your Still password"
    text_body = (
        "We received a request to reset your Still password.\n\n"
        f"Open this link to choose a new password:\n{reset_url}\n\n"
        "This link expires in 30 minutes. If you did not request this, you can ignore this email."
    )
    html_body = f"""
    <div style="font-family:Arial,sans-serif;color:#173f3a;line-height:1.6">
      <h1 style="font-family:Georgia,serif;font-weight:500">Reset your Still password</h1>
      <p>We received a request to reset your Still password.</p>
      <p>
        <a href="{reset_url}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#23584e;color:white;text-decoration:none;font-weight:700">
          Choose a new password
        </a>
      </p>
      <p>This link expires in 30 minutes.</p>
      <p style="color:#6f8079;font-size:13px">If you did not request this, you can ignore this email.</p>
    </div>
    """
    return subject, text_body, html_body


def send_password_reset_email(to_email: str, reset_url: str) -> bool:
    """Send a password reset email with the configured email provider."""
    if settings.EMAIL_PROVIDER == "none":
        logger.info("Email provider disabled; password reset link for %s: %s", to_email, reset_url)
        return False

    subject, text_body, html_body = build_password_reset_email(reset_url)
    if settings.EMAIL_PROVIDER == "resend":
        send_with_resend(to_email, subject, text_body, html_body)
        return True
    if settings.EMAIL_PROVIDER == "smtp":
        send_with_smtp(to_email, subject, text_body, html_body)
        return True
    return False


def send_with_resend(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    """Send an email using the Resend HTTP API."""
    payload = json.dumps(
        {
            "from": settings.EMAIL_FROM,
            "to": [to_email],
            "subject": subject,
            "text": text_body,
            "html": html_body,
        }
    ).encode("utf-8")
    request = Request(
        "https://api.resend.com/emails",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=10) as response:
            if response.status >= 300:
                raise RuntimeError(f"Resend returned status {response.status}")
    except (HTTPError, URLError, TimeoutError) as error:
        raise RuntimeError("Unable to send password reset email with Resend") from error


def send_with_smtp(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    """Send an email using an SMTP server."""
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.EMAIL_FROM
    message["To"] = to_email
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USERNAME:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)
    except OSError as error:
        raise RuntimeError("Unable to send password reset email with SMTP") from error
