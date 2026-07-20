import json
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
    """Send a password reset email using Brevo when email is enabled."""
    if settings.EMAIL_PROVIDER == "none":
        logger.info("Email provider disabled; password reset link for %s: %s", to_email, reset_url)
        return False

    if settings.EMAIL_PROVIDER != "brevo":
        raise RuntimeError("Unsupported email provider")

    subject, text_body, html_body = build_password_reset_email(reset_url)
    send_with_brevo(to_email, subject, text_body, html_body)
    return True


def parse_sender() -> tuple[str, str]:
    """Split the configured sender into a display name and email address."""
    sender = settings.EMAIL_FROM.strip()
    if "<" in sender and sender.endswith(">"):
        name, email = sender.rsplit("<", 1)
        return name.strip().strip('"') or "Still", email[:-1].strip()
    return "Still", sender


def send_with_brevo(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    """Send an email using Brevo transactional email."""
    if not settings.BREVO_API_KEY:
        raise RuntimeError("BREVO_API_KEY is required when EMAIL_PROVIDER=brevo")

    sender_name, sender_email = parse_sender()
    payload = json.dumps(
        {
            "sender": {"name": sender_name, "email": sender_email},
            "to": [{"email": to_email}],
            "subject": subject,
            "textContent": text_body,
            "htmlContent": html_body,
        }
    ).encode("utf-8")
    request = Request(
        "https://api.brevo.com/v3/smtp/email",
        data=payload,
        method="POST",
        headers={
            "accept": "application/json",
            "api-key": settings.BREVO_API_KEY,
            "content-type": "application/json",
        },
    )

    try:
        with urlopen(request, timeout=10) as response:
            if response.status >= 300:
                raise RuntimeError(f"Brevo returned status {response.status}")
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        logger.warning("Brevo password reset email failed: status=%s body=%s", error.code, body)
        raise RuntimeError("Unable to send password reset email with Brevo") from error
    except (URLError, TimeoutError) as error:
        logger.warning("Brevo password reset email failed: %s", error)
        raise RuntimeError("Unable to send password reset email with Brevo") from error
