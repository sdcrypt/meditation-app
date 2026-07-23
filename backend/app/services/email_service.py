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


def build_email_verification_email(verification_url: str) -> tuple[str, str, str]:
    """Build the subject, text body, and HTML body for a verification email."""
    subject = "Verify your Still email"
    text_body = (
        "Welcome to Still.\n\n"
        f"Open this link to verify your email address:\n{verification_url}\n\n"
        "This link expires in 24 hours. If you did not create a Still account, you can ignore this email."
    )
    html_body = f"""
    <div style="font-family:Arial,sans-serif;color:#173f3a;line-height:1.6">
      <h1 style="font-family:Georgia,serif;font-weight:500">Verify your Still email</h1>
      <p>Welcome to Still. Confirm your email address to finish setting up your account.</p>
      <p>
        <a href="{verification_url}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#23584e;color:white;text-decoration:none;font-weight:700">
          Verify email
        </a>
      </p>
      <p>This link expires in 24 hours.</p>
      <p style="color:#6f8079;font-size:13px">If you did not create a Still account, you can ignore this email.</p>
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


def send_email_verification_email(to_email: str, verification_url: str) -> bool:
    """Send an email verification message using Brevo when email is enabled."""
    if settings.EMAIL_PROVIDER == "none":
        logger.info("Email provider disabled; verification link for %s: %s", to_email, verification_url)
        return False

    if settings.EMAIL_PROVIDER != "brevo":
        raise RuntimeError("Unsupported email provider")

    subject, text_body, html_body = build_email_verification_email(verification_url)
    send_with_brevo(to_email, subject, text_body, html_body, purpose="email verification")
    return True


def parse_sender() -> tuple[str, str]:
    """Split the configured sender into a display name and email address."""
    sender = settings.EMAIL_FROM.strip()
    if "<" in sender and sender.endswith(">"):
        name, email = sender.rsplit("<", 1)
        return name.strip().strip('"') or "Still", email[:-1].strip()
    return "Still", sender


def send_with_brevo(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
    purpose: str = "password reset",
) -> None:
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
            response_body = response.read().decode("utf-8", errors="replace")
            try:
                message_id = json.loads(response_body).get("messageId")
            except json.JSONDecodeError:
                message_id = None
            logger.info("Brevo accepted %s email for %s message_id=%s", purpose, to_email, message_id)
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        logger.warning("Brevo %s email failed: status=%s body=%s", purpose, error.code, body)
        raise RuntimeError(f"Unable to send {purpose} email with Brevo") from error
    except (URLError, TimeoutError) as error:
        logger.warning("Brevo %s email failed: %s", purpose, error)
        raise RuntimeError(f"Unable to send {purpose} email with Brevo") from error
