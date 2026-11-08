import schemas from "../schema.js";

export default function highlightRoutes(fastify, { db }) {
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
        INSERT INTO highlights(userId, color) VALUES(?, ?);
    `);

    const insertHighlightVerse = db.prepare(`
        INSERT INTO highlight_verses(highlightId, verseId) VALUES(?, ?);
    `);

    const createHighlightWithVerses = db.transaction((userId, color, verseIds) => {
        const result = insertHighlight.run(userId, color);
        const highlightId = result.lastInsertRowid;

        for (const id of verseIds) {
            insertHighlightVerse.run(highlightId, id);
        }

        return highlightId;
    });

    fastify.get('/user/:id',
        { schema: schemas.user },
        (req, reply) => {
            const highlights = userHighlights.all(req.params.id);
            reply.send({ highlights });
        }
    );

    fastify.post('/user/:u_id/color/:hexcode',
        { schema: schemas.highlights },
        (req, reply) => {
            const { u_id, hexcode } = req.params;
            const { verseIds } = req.body;

            const digits = hexcode.startsWith('#') ? hexcode.slice(1) : hexcode;
            const rgb = digits.length <= 4
                ? [...digits.slice(0, 3)].map((digit) => digit + digit).join('')
                : digits.slice(0, 6);
            const color = `#${rgb.toLowerCase()}`;

            const highlightId = createHighlightWithVerses(
                u_id,
                color,
                [...new Set(verseIds)]
            );

            reply.code(201).send({ highlightId });
        }
    );
}
