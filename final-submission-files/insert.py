import argparse
import re
import sqlite3
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
BIBLE_HUB_DIR = PROJECT_ROOT / 'translations' / 'biblehub'
DATABASE_PATH = PROJECT_ROOT / 'test-biblelite.db'

BIBLE_HUB_SOURCE_NAME = 'Bible Hub'
BIBLE_HUB_SOURCE_URL = 'https://biblehub.com/downloads.htm'
BIBLE_HUB_SOURCE_NOTES = (
    'Every translation is trimmed to the 66-book Protestant canon '
    'and remapped to KJV versification.'
)

# Keyed by file name without .txt; file headers are inconsistent, so names live here.
TRANSLATIONS = {
    "akjv": {
        "name": "American King James Version",
        "type": "formal-equivalence",
        "url": "https://openbible.com/textfiles/akjv.txt",
    },
    "asv": {
        "name": "American Standard Version",
        "type": "formal-equivalence",
        "url": "https://openbible.com/textfiles/asv.txt",
    },
    "bab": {
        "name": "Berean Annotated Bible",
        "type": "formal-equivalence",
        "url": "https://annotatedbible.com/bab.txt",
    },
    "blb": {
        "name": "Berean Literal Bible",
        "type": "formal-equivalence",
        "url": "https://literalbible.com/blb.txt",
    },
    "brb": {
        "name": "Berean Reader's Bible",
        "type": "formal-equivalence",
        "url": "https://readersbible.com/brb.txt",
    },
    "bsb": {
        "name": "Berean Standard Bible",
        "type": "formal-equivalence",
        "url": "https://bereanbible.com/bsb.txt",
    },
    "dbt": {
        "name": "Darby Bible Translation",
        "type": "formal-equivalence",
        "url": "https://openbible.com/textfiles/dbt.txt",
    },
    "erv": {
        "name": "English Revised Version",
        "type": "formal-equivalence",
        "url": "https://openbible.com/textfiles/erv.txt",
    },
    "jps": {
        "name": "JPS Tanakh 1917 / Weymouth New Testament",
        "type": "combined",
        "url": "https://openbible.com/textfiles/jps.txt",
    },
    "kjv": {
        "name": "King James Version",
        "type": "formal-equivalence",
        "url": "https://openbible.com/textfiles/kjv.txt",
    },
    "msb": {
        "name": "Majority Standard Bible",
        "type": "formal-equivalence",
        "url": "https://majoritybible.com/msb.txt",
    },
    "slt": {
        "name": "Smith's Literal Translation",
        "type": "formal-equivalence",
        "url": "https://openbible.com/textfiles/slt.txt",
    },
    "wbt": {
        "name": "Webster's Bible Translation",
        "type": "formal-equivalence",
        "url": "https://openbible.com/textfiles/wbt.txt",
    },
    "web": {
        "name": "World English Bible",
        "type": "formal-equivalence",
        "url": "https://openbible.com/textfiles/web.txt",
    },
    "ylt": {
        "name": "Young's Literal Translation",
        "type": "formal-equivalence",
        "url": "https://openbible.com/textfiles/ylt.txt",
    },
}

# Catholic Bibles (73 books) that Bible Hub cut down to 66; skipped, not imported.
# The scraper still downloads them, so they are excluded here rather than deleted.
EXCLUDED_TRANSLATIONS = {"cpdv", "drb"}

# Matches the start of a verse line, e.g. "Genesis 1:1<tab>".
VERSE_LINE_PATTERN = re.compile(r"^.+ \d+:\d+\t")

# OSIS ids in canonical order; the first 39 are Old Testament, the last 27 New Testament.
BOOK_CODES = [
    "Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth", "1Sam", "2Sam",
    "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra", "Neh", "Esth", "Job", "Ps", "Prov",
    "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek", "Dan", "Hos", "Joel", "Amos",
    "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal",
    "Matt", "Mark", "Luke", "John", "Acts", "Rom", "1Cor", "2Cor", "Gal", "Eph",
    "Phil", "Col", "1Thess", "2Thess", "1Tim", "2Tim", "Titus", "Phlm", "Heb", "Jas",
    "1Pet", "2Pet", "1John", "2John", "3John", "Jude", "Rev",
]
# KJV chapter counts, in the same canonical order as BOOK_CODES.
BOOK_CHAPTER_COUNTS = [
    50, 40, 27, 36, 34, 24, 21, 4, 31, 24,
    22, 25, 29, 36, 10, 13, 10, 42, 150, 31,
    12, 8, 66, 52, 5, 48, 12, 14, 3, 9,
    1, 4, 7, 3, 3, 3, 2, 14, 4,
    28, 16, 24, 21, 28, 16, 16, 13, 6, 6,
    4, 4, 5, 3, 6, 4, 3, 1, 13, 5,
    5, 3, 5, 1, 1, 1, 22,
]
OLD_TESTAMENT_BOOK_COUNT = 39


# --- File reading and parsing ---

def look_up_translation(file_path):
    """Return (abbreviation, details) for a file, or raise if it isn't in TRANSLATIONS."""

    # The file name ("kjv.txt") is the key, since header lines can't be trusted.
    file_key = file_path.stem.lower()
    details = TRANSLATIONS.get(file_key)

    # Fail loudly so a new file gets a proper name and type instead of a guess.
    if details is None:
        raise ValueError(f"{file_path.name} is not in TRANSLATIONS; add its name, type and url.")

    return file_key.upper(), details


def read_verse_lines(file_path):
    """Return the file's lines from the first verse line on, or [] if it has none."""

    # utf-8-sig strips the invisible BOM some files start with.
    with file_path.open("r", encoding="utf-8-sig") as file:
        lines = file.read().splitlines()

    # Headers are 2 or 3 lines depending on the file, so skip by shape, not count.
    for index, line in enumerate(lines):
        if VERSE_LINE_PATTERN.match(line):
            return lines[index:]

    # Empty list, not an error: the caller skips files with nothing to import.
    return []


def parse_verse_line(line, file_name):
    """Split one line into (book_name, chapter_num, verse_num, content)."""

    # "1 Samuel 3:10<tab>text": split at the first colon, then the last space,
    # so book names that contain spaces stay whole.
    left, right = line.split(":", 1)
    book_name, chapter_text = (part.strip() for part in left.rsplit(" ", 1))

    # Right side is "<verse><tab><text>"; some translations omit the text for certain verses.
    verse_parts = right.split(maxsplit=1)
    if not verse_parts:
        raise ValueError(f"Missing verse number in {file_name}: {line.rstrip()}")

    verse_text = verse_parts[0]
    content = verse_parts[1].strip() if len(verse_parts) > 1 else ""

    return book_name, int(chapter_text), int(verse_text), content


def parse_verse_lines(verse_lines, file_name):
    """Parse every verse line into (book_name, chapter_num, verse_num, content) tuples."""

    return [parse_verse_line(line, file_name) for line in verse_lines]


def count_chapters_per_book(parsed_verses):
    """Return a dict mapping each book name to its highest chapter number, in file order."""

    # Dicts keep insertion order, so keys also record the book order of the file.
    chapter_counts = {}

    # The highest chapter number seen for a book is its chapter count.
    for book_name, chapter_num, _verse_num, _content in parsed_verses:
        current_max = chapter_counts.get(book_name, 0)
        chapter_counts[book_name] = max(current_max, chapter_num)

    return chapter_counts


def read_book_names_in_order(file_path):
    """Return the book names in a translation file, in the order they first appear."""

    verse_lines = read_verse_lines(file_path)
    parsed_verses = parse_verse_lines(verse_lines, file_path.name)
    chapter_counts = count_chapters_per_book(parsed_verses)

    return list(chapter_counts)


# --- User prompts ---

def confirm_import_with_user(file_name, translation_name, translation_abbr):
    """Show the translation details and return True if the user wants to import it."""

    while True:
        print(
            f"\nFile: {file_name}"
            f"\nTranslation: {translation_name}"
            f"\nAbbreviation: {translation_abbr}"
        )

        choice = input("Continue reading and importing this file? [y/n]: ").strip().lower()

        if choice in ("y", "n"):
            return choice == "y"

        print("Please enter y or n.")


# --- Database access ---

def books_table_is_empty(c):
    """Return True if the books table has no rows."""

    c.execute("SELECT COUNT(*) FROM books")
    book_count = c.fetchone()[0]

    return book_count == 0


def seed_books(c, book_names):
    """Insert the 66 books with their OSIS code, testament, and KJV chapter count."""

    # Metadata is matched to names by position, so the counts must line up exactly.
    if len(book_names) != len(BOOK_CODES) or len(BOOK_CODES) != len(BOOK_CHAPTER_COUNTS):
        raise ValueError(f"Expected {len(BOOK_CODES)} books but found {len(book_names)}.")

    book_rows = []

    for index, book_name in enumerate(book_names):
        code = BOOK_CODES[index]
        testament = "OT" if index < OLD_TESTAMENT_BOOK_COUNT else "NT"
        chapter_count = BOOK_CHAPTER_COUNTS[index]
        book_rows.append((code, book_name, testament, chapter_count))

    c.executemany(
        "INSERT INTO books (code, name, testament, chapterCount) VALUES (?, ?, ?, ?)",
        book_rows,
    )


def load_book_ids(c):
    """Return a dict mapping each book name to its id."""

    # Loaded once so each verse is a dict lookup instead of a query.
    c.execute("SELECT name, id FROM books")

    return dict(c.fetchall())


def get_or_create_source_id(c, source_name, source_url, source_notes):
    """Return the id of the named source, inserting it first if it doesn't exist."""

    # Reuse the row from an earlier run so re-imports don't duplicate the source.
    c.execute("SELECT id FROM sources WHERE name = ?", (source_name,))
    existing_row = c.fetchone()

    if existing_row is not None:
        return existing_row[0]

    c.execute(
        "INSERT INTO sources (name, url, notes) VALUES (?, ?, ?)",
        (source_name, source_url, source_notes),
    )

    return c.lastrowid


def insert_translation(c, translation_abbr, details, source_id):
    """Insert a translation row and return its new id."""

    c.execute(
        "INSERT INTO translations "
        "(name, abbreviation, type, sourceId, sourceUrl) "
        "VALUES (?, ?, ?, ?, ?)",
        (details["name"], translation_abbr, details["type"], source_id, details["url"]),
    )

    # lastrowid is the id SQLite just assigned; the verses reference it.
    return c.lastrowid


def insert_verses(c, verse_rows):
    """Insert all collected verse rows in one batch."""

    # executemany sends ~31,000 rows in one call, far faster than a loop of execute.
    c.executemany(
        "INSERT INTO verses "
        "(bookId, translationId, chapterNum, verseNum, content, wordCount) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        verse_rows,
    )


# --- Import orchestration ---

def look_up_book_id(book_ids, book_name, file_name):
    """Return the id for a book name, or raise if the books table doesn't have it."""

    book_id = book_ids.get(book_name)

    # A name mismatch (e.g. "Psalm" vs "Psalms") stops the import instead of dropping verses.
    if book_id is None:
        raise ValueError(f"Unknown book '{book_name}' in {file_name}.")

    return book_id


def build_verse_rows(parsed_verses, file_name, translation_id, book_ids):
    """Build verse rows from parsed verses, skipping verses with no text."""

    verse_rows = []
    skipped_count = 0

    for book_name, chapter_num, verse_num, content in parsed_verses:
        book_id = look_up_book_id(book_ids, book_name, file_name)

        # word_count must be > 0, so empty verses can't be stored.
        word_count = len(content.split())
        if word_count == 0:
            skipped_count += 1
            continue

        # Tuple order must match the column order in insert_verses.
        verse_row = (book_id, translation_id, chapter_num, verse_num, content, word_count)
        verse_rows.append(verse_row)

    # Report skips so missing verses are visible, not silent.
    if skipped_count:
        print(f"Skipped {skipped_count} verses with no text in {file_name}.")

    return verse_rows


def import_bible_hub_file(conn, file_path, book_ids, source_id, auto_confirm=False):
    """Import one translation file after the user confirms; rolls back on any error."""

    c = conn.cursor()

    if file_path.stem.lower() in EXCLUDED_TRANSLATIONS:
        print(f"\n{file_path.name} is not a 66-book canon translation; skipping.")
        return

    # Check the file first so the user is never asked about one that will be skipped.
    translation_abbr, details = look_up_translation(file_path)
    verse_lines = read_verse_lines(file_path)

    if not verse_lines:
        print(f"\n{file_path.name} has no verse-numbered lines; skipping.")
        return

    if not auto_confirm and not confirm_import_with_user(
        file_path.name, details["name"], translation_abbr
    ):
        return

    # Parse everything up front; a bad line fails here, before any database write.
    parsed_verses = parse_verse_lines(verse_lines, file_path.name)

    # One transaction per file: translation, then its verses (foreign key order).
    try:
        translation_id = insert_translation(c, translation_abbr, details, source_id)

        verse_rows = build_verse_rows(parsed_verses, file_path.name, translation_id, book_ids)
        insert_verses(c, verse_rows)

        conn.commit()
    except Exception:
        # Undo this file's partial inserts, then re-raise so the run stops visibly.
        conn.rollback()
        raise

    print(f"Imported {len(verse_rows)} verses for {details['name']}.")


def import_bible_hub(abr=None, auto_confirm=False, file_path=None, database_path=DATABASE_PATH):
    """Import all Bible Hub text files, or only the file matching abr."""

    # Sorted so runs process files in the same order every time.
    if file_path is not None:
        file_paths = [Path(file_path)]
    elif abr is None:
        file_paths = sorted(BIBLE_HUB_DIR.glob("*.txt"))
    else:
        file_paths = [BIBLE_HUB_DIR / f"{abr}.txt"]

    conn = sqlite3.connect(database_path)

    # SQLite ignores REFERENCES unless this is set on every new connection.
    conn.execute("PRAGMA foreign_keys = ON")

    try:
        c = conn.cursor()

        # First run only: every Bible Hub file has the same 66 books, so any file works.
        if books_table_is_empty(c):
            book_names = read_book_names_in_order(file_paths[0])
            seed_books(c, book_names)

        # Shared row every translation points to; committed before the per-file loop.
        source_id = get_or_create_source_id(
            c,
            BIBLE_HUB_SOURCE_NAME,
            BIBLE_HUB_SOURCE_URL,
            BIBLE_HUB_SOURCE_NOTES,
        )
        conn.commit()

        book_ids = load_book_ids(c)

        for file_path in file_paths:
            import_bible_hub_file(conn, file_path, book_ids, source_id, auto_confirm)
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import Bible Hub text files.")
    parser.add_argument(
        "--abbreviation",
        help="import only the matching translation file, e.g. kjv",
    )
    parser.add_argument(
        "--file",
        type=Path,
        help="import a specific translation file path",
    )
    parser.add_argument(
        "--database",
        type=Path,
        default=DATABASE_PATH,
        help="database path (defaults to test-biblelite.db)",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="import eligible file(s) without asking for confirmation",
    )
    args = parser.parse_args()
    import_bible_hub(
        abr=args.abbreviation,
        auto_confirm=args.yes,
        file_path=args.file,
        database_path=args.database,
    )
