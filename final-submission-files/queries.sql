PRAGMA foreign_keys = ON;

-- 1. Filtering and Sorting
-- Query KJV Psalm 117 (only 2 verses)
SELECT
    id,
    translationId,
    bookId,
    chapterNum,
    verseNum,
    substr(content, 1, 30) AS contentPreview,
    wordCount
FROM verses
WHERE
    translationId = (SELECT id FROM translations WHERE abbreviation = 'KJV')
    AND bookId = 19
    AND chapterNum = 117;

-- 2. INNER JOIN
-- Show KJV Psalm 117 verses with their book names.
SELECT
    b.name AS book,
    v.chapterNum,
    v.verseNum,
    substr(v.content, 1, 30) AS contentPreview
FROM verses v
INNER JOIN books b ON b.id = v.bookId
WHERE v.translationId = (SELECT id FROM translations WHERE abbreviation = 'KJV')
    AND b.id = 19
    AND v.chapterNum = 117
ORDER BY v.verseNum;

-- 3. LEFT JOIN
-- Show every book and its KJV verse count for chapter 150.
-- Books without a chapter 150 remain in the result with a count of 0.
SELECT
    b.name AS book,
    COUNT(v.id) AS verseCount
FROM books b
LEFT JOIN verses v
    ON v.bookId = b.id
    AND v.translationId = (SELECT id FROM translations WHERE abbreviation = 'KJV')
    AND v.chapterNum = 150
GROUP BY b.id, b.name
ORDER BY b.id;

-- 4. Three-Table Join
-- Compare KJV verse totals across books.
SELECT
    t.abbreviation AS translation,
    b.name AS book,
    COUNT(v.id) AS verseCount
FROM translations t
INNER JOIN verses v ON v.translationId = t.id
INNER JOIN books b ON b.id = v.bookId
WHERE t.abbreviation = 'KJV'
GROUP BY t.id, b.id
ORDER BY b.id;

-- 5. Aggregate Query
-- Query verse counts for each chapter in KJV 2 John (1 chapter with 13 verses)
SELECT
    chapterNum,
    COUNT(*) AS verseCount
FROM verses
WHERE
    translationId = (SELECT id FROM translations WHERE abbreviation = 'KJV')
    AND bookId = 63
GROUP BY chapterNum;

-- 6. GROUP BY and HAVING   
-- Query chapters with verse count >= 20 in KJV James 5
SELECT
    chapterNum,
    COUNT(*) AS verseCount
FROM verses
WHERE translationId = (SELECT id FROM translations WHERE abbreviation = 'KJV')
    AND bookId = 59
GROUP BY chapterNum
HAVING verseCount >= 20;

-- 7. Subquery
-- Query count of chapters with verse count >= 20 in KJV James 5
SELECT COUNT(*) AS chapterCount
FROM (
    SELECT chapterNum
    FROM verses
    WHERE translationId = (SELECT id FROM translations WHERE abbreviation = 'KJV')
        AND bookId = 59
    GROUP BY chapterNum
    HAVING COUNT (*) >= 20
);
    
-- 8. Set Operation
-- Find KJV verses containing either "love" or "charity".
SELECT b.name AS book, v.chapterNum, v.verseNum, substr(v.content, 1, 30) AS contentPreview
FROM verses v
INNER JOIN books b ON b.id = v.bookId
WHERE v.translationId = (SELECT id FROM translations WHERE abbreviation = 'KJV')
    AND v.content LIKE '%love%'
UNION
SELECT b.name AS book, v.chapterNum, v.verseNum, substr(v.content, 1, 30) AS contentPreview
FROM verses v
INNER JOIN books b ON b.id = v.bookId
WHERE v.translationId = (SELECT id FROM translations WHERE abbreviation = 'KJV')
    AND v.content LIKE '%charity%'
ORDER BY book, chapterNum, verseNum;

-- 9. View
-- Summarize verse counts once, then reuse the view for chapter-level questions.
CREATE VIEW IF NOT EXISTS chapter_verse_counts AS
SELECT
    t.id AS translationId,
    t.abbreviation AS translation,
    b.id AS bookId,
    b.name AS book,
    v.chapterNum,
    COUNT(*) AS verseCount
FROM verses v
INNER JOIN translations t ON t.id = v.translationId
INNER JOIN books b ON b.id = v.bookId
GROUP BY t.id, b.id, v.chapterNum;

-- Use the view to find KJV James chapters with at least 20 verses.
SELECT chapterNum, verseCount
FROM chapter_verse_counts
WHERE translationId = (SELECT id FROM translations WHERE abbreviation = 'KJV')
    AND bookId = 59
    AND verseCount >= 20
ORDER BY chapterNum;

-- Keep verse text previews short when browsing verses.
DROP VIEW IF EXISTS verse_content_previews;
CREATE VIEW verse_content_previews AS
SELECT
    translationId,
    bookId,
    chapterNum,
    verseNum,
    substr(content, 1, 30) AS contentPreview
FROM verses;

-- Use the view to preview the first five verses of KJV James 1.
SELECT verseNum, contentPreview
FROM verse_content_previews
WHERE translationId = (SELECT id FROM translations WHERE abbreviation = 'KJV')
    AND bookId = 59
    AND chapterNum = 1
ORDER BY verseNum
LIMIT 5;