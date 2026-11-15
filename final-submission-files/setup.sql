-- BibleLite schema; every translation uses the 66-book Protestant canon.
-- Create the db with: sqlite3 biblelite.db < setup.sql
-- Every connection must run PRAGMA foreign_keys = ON; for REFERENCES to be enforced.

PRAGMA foreign_keys = ON;

-- --- Users ---

CREATE TABLE users(
    id INTEGER PRIMARY KEY,
    firstName text NOT NULL,
    lastName text NOT NULL,
    -- NOCASE so Ann@x.com and ann@x.com are one account.
    email text NOT NULL UNIQUE COLLATE NOCASE
    CHECK (
        length(email) <= 254
        AND email = trim(email)
        AND email NOT LIKE '% %'
        AND email LIKE '%_@_%.%_'
        AND email NOT LIKE '%@%@%'
    ),
    passwordHash text
);

-- --- Books ---

-- The 66 canonical books, shared by every translation; code uses OSIS ids (Gen, 1Sam, Rev).
CREATE TABLE books(
    id INTEGER PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    testament text NOT NULL CHECK (testament IN ('OT', 'NT')),
    chapterCount INTEGER NOT NULL CHECK (chapterCount > 0)
);

-- --- Sources and translations ---

CREATE TABLE sources(
    id INTEGER PRIMARY KEY,
    name text NOT NULL UNIQUE,
    url text,
    notes text
);

CREATE TABLE translations(
    id INTEGER PRIMARY KEY,
    name text NOT NULL,
    abbreviation text,
    type text
        CHECK (type IN ('formal-equivalence', 'dynamic-equivalence', 'paraphrase', 'interlinear', 'combined')),
    sourceId INTEGER NOT NULL REFERENCES sources(id),
    sourceUrl text,
    -- Per source, so re-importing a file fails instead of duplicating every verse.
    UNIQUE (sourceId, abbreviation)
);

-- --- Verses ---

-- Chapter and verse live here instead of a chapters table, so loading a chapter needs no join.
CREATE TABLE verses(
    id INTEGER PRIMARY KEY,
    translationId INTEGER NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
    bookId INTEGER NOT NULL REFERENCES books(id),
    chapterNum INTEGER NOT NULL CHECK (chapterNum > 0),
    verseNum INTEGER NOT NULL CHECK (verseNum > 0),
    content text NOT NULL,
    wordCount INTEGER NOT NULL CHECK (wordCount > 0),
    UNIQUE (translationId, bookId, chapterNum, verseNum)
);

-- --- Highlights and notes ---

CREATE TABLE highlights(
    id INTEGER PRIMARY KEY,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Lowercase only, so the same color never counts as two values in GROUP BY.
    color text NOT NULL CHECK (
        color GLOB '#*'
        AND length(color) IN (7, 9)
        AND substr(color, 2) NOT GLOB '*[^0-9a-f]*'
    ),
    createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE highlight_verses(
    highlightId INTEGER NOT NULL REFERENCES highlights(id) ON DELETE CASCADE,
    verseId INTEGER NOT NULL REFERENCES verses(id),
    isActive INTEGER NOT NULL DEFAULT 1 CHECK (isActive IN (0, 1)),
    PRIMARY KEY (highlightId, verseId)
);

-- The PK only serves lookups by highlightId; this serves "highlights on these verses".
CREATE INDEX highlight_verses_verse ON highlight_verses(verseId);
CREATE INDEX IF NOT EXISTS idx_highlights_user_color
ON highlights(userId, color);

CREATE TABLE notes(
    id INTEGER PRIMARY KEY,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content text NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE note_verses(
    noteId INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    verseId INTEGER NOT NULL REFERENCES verses(id),
    PRIMARY KEY (noteId, verseId)
);

CREATE INDEX note_verses_verse ON note_verses(verseId);

CREATE VIEW IF NOT EXISTS highlight_report AS
SELECT
  h.userId,
  b.name AS book,
  h.color,
  COUNT(DISTINCT h.id) AS highlight_count,
  COUNT(*) AS verse_count
FROM highlights h
JOIN highlight_verses hv ON hv.highlightId = h.id
JOIN verses v ON v.id = hv.verseId
JOIN books b ON b.id = v.bookId
GROUP BY h.userId, b.id, b.name, h.color;
