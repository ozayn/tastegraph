"""Verify database connection."""

from sqlalchemy import text

from app.core.database import engine


def main() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Database connection OK")
    except Exception as e:
        print(f"Database connection failed: {e}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
