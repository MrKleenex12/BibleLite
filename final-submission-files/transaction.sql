PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- Create the demo user once, then reuse it on later runs.
INSERT INTO users (firstName, lastName, email, passwordHash)
VALUES ('Transaction', 'Demo', 'transaction-demo@example.com', NULL)
ON CONFLICT(email) DO NOTHING;

-- Create a yellow highlight for KJV James 1:1-2.
INSERT INTO highlights (userId, color)
SELECT id, '#fde047'
FROM users
WHERE email = 'transaction-demo@example.com';

-- Link the highlight to both verses. A missing verse causes a constraint error.
INSERT INTO highlight_verses (highlightId, verseId)
VALUES
    ((
        SELECT MAX(id)
        FROM highlights
        WHERE userId = (
            SELECT id FROM users WHERE email = 'transaction-demo@example.com'
        )
    ), (
        SELECT v.id
        FROM verses v
        JOIN translations t ON t.id = v.translationId
        JOIN books b ON b.id = v.bookId
        WHERE t.abbreviation = 'KJV'
            AND b.code = 'Jas'
            AND v.chapterNum = 1
            AND v.verseNum = 1
        ORDER BY t.id
        LIMIT 1
    )),
    ((
        SELECT MAX(id)
        FROM highlights
        WHERE userId = (
            SELECT id FROM users WHERE email = 'transaction-demo@example.com'
        )
    ), (
        SELECT v.id
        FROM verses v
        JOIN translations t ON t.id = v.translationId
        JOIN books b ON b.id = v.bookId
        WHERE t.abbreviation = 'KJV'
            AND b.code = 'Jas'
            AND v.chapterNum = 1
            AND v.verseNum = 2
        ORDER BY t.id
        LIMIT 1
    ));

COMMIT;

-- Example 2: create a note and attach it to the same two verses atomically.
BEGIN TRANSACTION;

INSERT INTO notes (userId, content)
SELECT id, 'Transaction example: notes on James 1:1-2.'
FROM users
WHERE email = 'transaction-demo@example.com';

INSERT INTO note_verses (noteId, verseId)
VALUES
    ((
        SELECT MAX(id)
        FROM notes
        WHERE userId = (
            SELECT id FROM users WHERE email = 'transaction-demo@example.com'
        )
    ), (
        SELECT v.id
        FROM verses v
        JOIN translations t ON t.id = v.translationId
        JOIN books b ON b.id = v.bookId
        WHERE t.abbreviation = 'KJV'
            AND b.code = 'Jas'
            AND v.chapterNum = 1
            AND v.verseNum = 1
        ORDER BY t.id
        LIMIT 1
    )),
    ((
        SELECT MAX(id)
        FROM notes
        WHERE userId = (
            SELECT id FROM users WHERE email = 'transaction-demo@example.com'
        )
    ), (
        SELECT v.id
        FROM verses v
        JOIN translations t ON t.id = v.translationId
        JOIN books b ON b.id = v.bookId
        WHERE t.abbreviation = 'KJV'
            AND b.code = 'Jas'
            AND v.chapterNum = 1
            AND v.verseNum = 2
        ORDER BY t.id
        LIMIT 1
    ));

COMMIT;

-- If a statement fails before its COMMIT, run ROLLBACK in the same connection.
