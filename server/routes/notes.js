import schemas from '../schema.js';

export default function noteRoutes(fastify, { db }) {
    // Grab all notes from a user, group verses by note in array of json objs
    const userNotes = db.prepare(`
        SELECT
            n.id,
            n.content,
            n.createdAt,
            json_group_array(
                json_object(
                    'id', v.id,
                    'content', v.content,
                    'chapterNum', v.chapterNum,
                    'verseNum', v.verseNum
                )
            ) AS verses
        FROM notes AS n
        JOIN note_verses AS nv ON nv.noteId = n.id 
        JOIN verses as v ON nv.verseId = v.id
        WHERE n.userId = ?
        GROUP BY n.id, n.content, n.createdAt
        ORDER BY n.createdAt DESC;
    `);

    fastify.get('/user/:id',
    { schema: schemas.user },
    (req, reply) => {
        const id = req.params.id;

        const notes = userNotes.all(id).map(note => ({
            ...note,
            verses: JSON.parse(note.verses)
        }));

        reply.code(200).send({ notes });
    });
};