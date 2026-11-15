#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DB="$SCRIPT_DIR/biblelite.db"
DATA_DIR="$SCRIPT_DIR/data"
BIBLE_FILES=("$DATA_DIR"/*.txt)

for required_command in sqlite3 python3; do
    if ! command -v "$required_command" >/dev/null 2>&1; then
        echo "Error: required command '$required_command' was not found." >&2
        exit 1
    fi
done

for file in setup.sql insert.py; do
    if [[ ! -f "$file" ]]; then
        echo "Error: required file '$file' was not found." >&2
        exit 1
    fi
done

if [[ ! -d "$DATA_DIR" ]]; then
    echo "Error: data directory '$DATA_DIR' was not found." >&2
    exit 1
fi

if [[ ! -f "${BIBLE_FILES[0]}" ]]; then
    echo "Error: no .txt Bible data files were found in '$DATA_DIR'." >&2
    exit 1
fi

echo "Recreating database..."
rm -f "$DB"
sqlite3 -bail "$DB" < setup.sql
for file in "${BIBLE_FILES[@]}"; do
    python3 insert.py --database "$DB" --file "$file" --yes
done

echo "Database setup complete: $DB"
