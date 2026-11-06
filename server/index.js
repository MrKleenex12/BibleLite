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
    SELECT id, verse_num, content, word_count
    FROM verses
    WHERE translation_id = ?
    AND book_id = ?
    AND chapter_num = ?;
`);
const selectBooks = db.prepare(`
    SELECT id, code, name, testament, chapter_count
    FROM books
    ORDER BY id;
`);
const selectColors = db.prepare(`SELECT hex, name FROM highlight_colors;`);
const selectUsers = db.prepare(`SELECT id, first_name, last_name FROM users;`);
const searchVerses = db.prepare(`
    SELECT v.id, t.abbreviation, b.name AS book, v.chapter_num, v.verse_num, v.content
    FROM verses v
    JOIN translations t ON t.id = v.translation_id
    JOIN books b ON b.id = v.book_id
    WHERE v.translation_id = ?
    AND v.content LIKE ? ESCAPE '\\'
    ORDER BY v.book_id, v.chapter_num, v.verse_num
    LIMIT ?;
`);
const compareChapter = db.prepare(`
    SELECT v.verse_num, t.abbreviation, v.content
    FROM verses v
    JOIN translations t ON t.id = v.translation_id
    WHERE v.book_id = ?
    AND v.chapter_num = ?
    ORDER BY v.verse_num, t.abbreviation;
`);
const userHighlights = db.prepare(`
    SELECT h.id AS highlight_id, h.color, c.name AS color_name, h.created_at,
           v.id AS verse_id, t.abbreviation, b.name AS book, v.chapter_num, v.verse_num, v.content
    FROM highlights h
    JOIN highlight_colors c ON c.hex = h.color
    JOIN highlight_verses hv ON hv.highlight_id = h.id
    JOIN verses v ON v.id = hv.verse_id
    JOIN translations t ON t.id = v.translation_id
    JOIN books b ON b.id = v.book_id
    WHERE h.user_id = ?
    ORDER BY h.created_at DESC, v.book_id, v.chapter_num, v.verse_num;
`);

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

// List the highlight palette so the front end can build color swatches
fastify.get('/colors', (req, reply) => {
    const colors = selectColors.all();
    reply.send({ colors });
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

// Compare every translation of one chapter; rows are grouped by verse_num on the front end
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
    {schema: schemas.user},
    (req, reply) => {
        const highlights = userHighlights.all(req.params.id);
        reply.send({ highlights });
    }
);

fastify.listen({ port: 8000 }, (err, address) => {
    if(err) {
        fastify.log.error(err);
        process.exit(1); // Node.js global
    }
});