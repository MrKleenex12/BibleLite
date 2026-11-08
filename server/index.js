import Fastify from "fastify";
import Database from "better-sqlite3";
import schemas from "./schema.js";

const db = new Database('../biblelite.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Prepared statements ---

// Prepared once at startup so a typo in the SQL crashes the server immediately.
const selectTranslations = db.prepare(`SELECT id, abbreviation FROM translations;`);
const selectedChapter = db.prepare(`
    SELECT id, verseNum, content, wordCount
    FROM verses
    WHERE translationId = ?
    AND bookId = ?
    AND chapterNum = ?;
`);
const selectBooks = db.prepare(`
    SELECT id, code, name, testament, chapterCount
    FROM books
    ORDER BY id;
`);
const selectUsers = db.prepare(`SELECT id, firstName, lastName FROM users;`);
const searchVerses = db.prepare(`
    SELECT v.id, t.abbreviation, b.name AS book, v.chapterNum, v.verseNum, v.content
    FROM verses v
    JOIN translations t ON t.id = v.translationId
    JOIN books b ON b.id = v.bookId
    WHERE v.translationId = ?
    AND v.content LIKE ? ESCAPE '\\'
    ORDER BY v.bookId, v.chapterNum, v.verseNum
    LIMIT ?;
`);
const compareChapter = db.prepare(`
    SELECT v.verseNum, t.abbreviation, v.content
    FROM verses v
    JOIN translations t ON t.id = v.translationId
    WHERE v.bookId = ?
    AND v.chapterNum = ?
    ORDER BY v.verseNum, t.abbreviation;
`);
const userHighlights = db.prepare(`
    SELECT h.id AS highlightId, h.color, h.createdAt,
           v.id AS verseId, t.abbreviation, b.name AS book, v.chapterNum, v.verseNum, v.content
    FROM highlights h
    JOIN highlight_verses hv ON hv.highlightId = h.id
    JOIN verses v ON v.id = hv.verseId
    JOIN translations t ON t.id = v.translationId
    JOIN books b ON b.id = v.bookId
    WHERE h.userId = ?
    ORDER BY h.createdAt DESC, v.bookId, v.chapterNum, v.verseNum;
`);

const insertHighlight = db.prepare(`
    INSERT into highlights(userId, color) VALUES(?, ?);
`);

const insertHighlightVerse = db.prepare(`
    INSERT INTO highlight_verses(highlightId, verseId) VALUES(?, ?);
`);

const createHighlightWithVerses = db.transaction((userId, color, verseIds) => {
    const result = insertHighlight.run(userId, color);
    const highlightId = result.lastInsertRowid;

    for(const id of verseIds) {
        insertHighlightVerse.run(highlightId, id);
    }

    return highlightId;
});

// Create Fastify server instance
const fastify = Fastify({
    logger: true // turn logger on
});

fastify.get('/', (req, reply) => {
    reply.send({ hello: 'world' });
});

fastify.get('/translations', (req, reply) => {
    const translations = selectTranslations.all();
    if(translations.length === 0) {
        return reply.code(404).send({ error: 'Translations not found' });
    }
    reply.code(200).send({ translations });
});

// Get all verses from a specific translation, book, chapter
fastify.get('/translation/:t_id/book/:b_id/chapter/:c_num', 
    {schema: schemas.chapter},
    (req, reply) => {
        const {t_id, b_id, c_num} = req.params;
        const verses = selectedChapter.all(t_id, b_id, c_num);

        if (verses.length === 0) {
            return reply.code(404).send({ error: 'Chapter not found' });
        }
        reply.code(200).send({ verses });
    }
);

// List the 66 books so the front end can build a book picker
fastify.get('/books', (req, reply) => {
    const books = selectBooks.all();
    reply.send({ books });
});

// List users so the front end can pick one (there is no login)
fastify.get('/users', (req, reply) => {
    const users = selectUsers.all();
    reply.send({ users });
});

// Search one translation for verses containing a word or phrase
fastify.get('/search',
    {schema: schemas.search},
    (req, reply) => {
        const { q, t_id, limit } = req.query;

        // Escape LIKE wildcards so a typed % or _ matches itself instead of anything.
        const escapedQuery = q.replace(/[\\%_]/g, '\\$&');
        const pattern = '%' + escapedQuery + '%';

        const verses = searchVerses.all(t_id, pattern, limit);
        reply.send({ verses });
    }
);

// Compare every translation of one chapter; rows are grouped by verseNum on the front end
fastify.get('/compare/book/:b_id/chapter/:c_num',
    {schema: schemas.compare},
    (req, reply) => {
        const { b_id, c_num } = req.params;
        const rows = compareChapter.all(b_id, c_num);

        if (rows.length === 0) {
            return reply.code(404).send({ error: 'Chapter not found' });
        }
        reply.send({ rows });
    }
);

// Get all highlights for a user
fastify.get('/user/:id/highlights',
    { schema: schemas.user },
    (req, reply) => {
        const highlights = userHighlights.all(req.params.id);
        reply.send({ highlights });
    }
);

// Create one highlight
fastify.post('/user/:u_id/highlights/color/:hexcode',
    { schema: schemas.highlights },
    (req, reply) => {
        const { u_id, hexcode } = req.params;
        const { verseIds } = req.body;

        // Validate hexcode into # + 6 digits
        const digits = hexcode.startsWith('#') ? hexcode.slice(1) : hexcode;
        const rgb = digits.length <= 4
            ? [...digits.slice(0, 3)].map((digit) => digit + digit).join('')
            : digits.slice(0, 6);
        const color = `#${rgb.toLowerCase()}`;

        // Undo any part unless it all completes
        const highlightId = createHighlightWithVerses(
            u_id,
            color,
            [...new Set(verseIds)]
        );
        
        reply.code(201).send({ highlightId });
});

fastify.listen({ port: 8000 }, (err, address) => {
    if(err) {
        fastify.log.error(err);
        process.exit(1); // Node.js global
    }
});