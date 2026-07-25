from app.api.v1.reminders import send_due_reminders
from app.db.session import SessionLocal


def main() -> None:
    """Send all practice reminder emails that are currently due."""
    db = SessionLocal()
    try:
        result = send_due_reminders(db)
        print(
            "Reminder run complete: "
            f"checked={result.checked} "
            f"sent={result.sent} "
            f"skipped={result.skipped} "
            f"errors={len(result.errors)}"
        )
        for error in result.errors:
            print(f"Reminder error: {error}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
