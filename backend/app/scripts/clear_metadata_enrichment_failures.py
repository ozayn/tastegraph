"""Clear metadata_enrichment_failure rows polluted by global auth/quota errors.

Usage:
  python -m app.scripts.clear_metadata_enrichment_failures           # clear global-auth failures
  python -m app.scripts.clear_metadata_enrichment_failures --dry-run  # show what would be deleted
  python -m app.scripts.clear_metadata_enrichment_failures --id tt1234567  # delete specific id
"""

import sys

from app.core.database import SessionLocal
from app.models.metadata_enrichment_failure import MetadataEnrichmentFailure
from app.services.omdb import is_global_omdb_unavailable


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--dry-run"]

    db = SessionLocal()
    try:
        if args and args[0] == "--id" and len(args) >= 2:
            imdb_id = args[1].strip()
            row = db.get(MetadataEnrichmentFailure, imdb_id)
            if not row:
                print(f"No row found for {imdb_id}")
                return
            if dry_run:
                print(f"Would delete (dry-run): {imdb_id} — {row.last_error}")
                return
            db.delete(row)
            db.commit()
            print(f"Deleted 1 row: {imdb_id}")
            return

        rows = db.query(MetadataEnrichmentFailure).all()
        to_delete = [r for r in rows if is_global_omdb_unavailable(r.last_error)]

        if not to_delete:
            print("No metadata_enrichment_failure rows match global auth/quota errors.")
            return

        if dry_run:
            print(f"Would delete {len(to_delete)} rows (dry-run):")
            for r in to_delete[:20]:
                print(f"  {r.imdb_title_id} — {r.last_error}")
            if len(to_delete) > 20:
                print(f"  ... and {len(to_delete) - 20} more")
            return

        for r in to_delete:
            db.delete(r)
        db.commit()
        print(f"Deleted {len(to_delete)} rows (global auth/quota errors).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
