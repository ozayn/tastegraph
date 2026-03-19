# IMDb exports

Place local IMDb export files here (e.g. `ratings.csv`, `watchlist.csv`, `favorite_people.csv`).

**Do not commit** raw personal data—CSV exports in this folder are gitignored.

## Title metadata

`title_metadata.template.csv` shows the expected columns for enrichment input. Copy to `title_metadata.csv` and fill. Do not commit filled metadata CSVs if they contain personal or generated working data.

## Favorite people

`favorite_people.csv.example` shows the simple format (name,role). Copy to `favorite_people.csv` and fill. Also supports IMDb-style people export CSV directly.
