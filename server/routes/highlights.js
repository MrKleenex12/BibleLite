import schemas from "../schema.js";

export default function highlightRoutes(fastify, { db }) {
    const userHighlights = db.prepare(`
        SELECT h.id AS highlightId, h.color, h.createdAt, hv.isActive,
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
        INSERT INTO highlights(userId, color) VALUES(?, ?)
        RETURNING id AS highlightId, createdAt;
    `);
    const insertHighlightVerse = db.prepare('INSERT INTO highlight_verses(highlightId, verseId) VALUES(?, ?);');
    const deleteUserHighlight = db.prepare(`
        DELETE FROM highlights
        WHERE id = ? AND userId = ?
        RETURNING id AS highlightId;
    `);
    const setHighlightVerseActive = db.prepare(`
        UPDATE highlight_verses
        SET isActive = ?
        WHERE highlightId = ? AND verseId = ?
          AND EXISTS (
              SELECT 1 FROM highlights
              WHERE highlights.id = highlight_verses.highlightId
                AND highlights.userId = ?
          )
        RETURNING highlightId, verseId;
    `);
    const userHighlightReport = db.prepare(`
        SELECT book, color, highlight_count, verse_count
        FROM highlight_report
        WHERE userId = ?
        ORDER BY book, color;
    `);

    const createHighlightWithVerses = db.transaction((userId, color, verseIds) => {
        const { highlightId, createdAt } = insertHighlight.get(userId, color);

        for (const id of verseIds) {
            insertHighlightVerse.run(highlightId, id);
        }

        return { highlightId, createdAt };
    });

    // Get a user's saved highlights and verse details.
    fastify.get('/user/:userId',
        { schema: schemas.userId },
        (req, reply) => {
            const highlights = userHighlights.all(req.params.userId);
            reply.send({ highlights });
        }
    );

    fastify.get('/user/:userId/report',
        { schema: schemas.userId },
        (req, reply) => {
            const { userId } = req.params;
            const report = userHighlightReport.all(userId);
            reply.send({ report });
        }
    );

    // Set whether a saved highlight is active on its verse.
    fastify.patch('/user/verse',
        { schema: schemas.highlightVerseState },
        (req, reply) => {
            const { userId, highlightId, verseId, isActive } = req.body;
            const updated = setHighlightVerseActive.get(
                isActive ? 1 : 0,
                highlightId,
                verseId,
                userId
            );

            if (!updated) {
                return reply.code(404).send({ error: 'Highlight verse not found' });
            }

            reply.send({ highlightId, verseId, isActive });
        }
    );

    // Delete a user's saved highlight and its verse associations.
    fastify.delete('/user/:userId/highlight/:highlightId',
        { schema: schemas.userHighlight },
        (req, reply) => {
            const { userId, highlightId } = req.params;
            const deleted = deleteUserHighlight.get(highlightId, userId);

            if (!deleted) {
                return reply.code(404).send({ error: 'Highlight not found' });
            }

            reply.send({ highlightId: deleted.highlightId });
        }
    );

    // Create a highlight for a user's selected verses.
    fastify.post('/user/:userId',
        { schema: schemas.highlights },
        (req, reply) => {
            const { userId } = req.params;
            const { color: hexcode, verseIds } = req.body;

            const digits = hexcode.startsWith('#') ? hexcode.slice(1) : hexcode;
            const rgb = digits.length <= 4
                ? [...digits.slice(0, 3)].map((digit) => digit + digit).join('')
                : digits.slice(0, 6);
            const color = `#${rgb.toLowerCase()}`;

            const highlight = createHighlightWithVerses(
                userId,
                color,
                [...new Set(verseIds)]
            );

            reply.code(201).send(highlight);
        }
    );
}
