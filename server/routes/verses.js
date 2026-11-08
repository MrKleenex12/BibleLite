import schemas from "../schema.js";

export default function verseRoutes(fastify, { db }) {
    const selectedChapter = db.prepare(`
        SELECT id, verseNum, content, wordCount
        FROM verses
        WHERE translationId = ?
        AND bookId = ?
        AND chapterNum = ?;
    `);

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

    fastify.get('/translation/:t_id/book/:b_id/chapter/:c_num',
        { schema: schemas.chapter },
        (req, reply) => {
            const { t_id, b_id, c_num } = req.params;
            const verses = selectedChapter.all(t_id, b_id, c_num);

            if (verses.length === 0) {
                return reply.code(404).send({ error: 'Chapter not found' });
            }
            reply.code(200).send({ verses });
        }
    );

    fastify.get('/search',
        { schema: schemas.search },
        (req, reply) => {
            const { q, t_id, limit } = req.query;

            const escapedQuery = q.replace(/[\\%_]/g, '\\$&');
            const pattern = '%' + escapedQuery + '%';

            const verses = searchVerses.all(t_id, pattern, limit);
            reply.send({ verses });
        }
    );
}
