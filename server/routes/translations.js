import schemas from "../schema.js";

export default function translationRoutes(fastify, { db }) {
    const selectTranslations = db.prepare(`
        SELECT id, abbreviation FROM translations;
    `);

    const compareChapter = db.prepare(`
        SELECT v.verseNum, t.abbreviation, v.content
        FROM verses v
        JOIN translations t ON t.id = v.translationId
        WHERE v.bookId = ?
        AND v.chapterNum = ?
        ORDER BY v.verseNum, t.abbreviation;
    `);

    fastify.get('/', (req, reply) => {
        const translations = selectTranslations.all();
        if (translations.length === 0) {
            return reply.code(404).send({ error: 'Translations not found' });
        }
        reply.code(200).send({ translations });
    });

    fastify.get('/compare/book/:b_id/chapter/:c_num',
        { schema: schemas.compare },
        (req, reply) => {
            const { b_id, c_num } = req.params;
            const rows = compareChapter.all(b_id, c_num);

            if (rows.length === 0) {
                return reply.code(404).send({ error: 'Chapter not found' });
            }
            reply.send({ rows });
        }
    );
}
