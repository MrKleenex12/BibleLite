import schemas from '../schema.js';

export default function noteRoutes(fastify, { db }) {
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
            ) FILTER (WHERE v.id IS NOT NULL) AS verses
        FROM notes AS n
        LEFT JOIN note_verses AS nv ON nv.noteId = n.id
        LEFT JOIN verses AS v ON nv.verseId = v.id
        WHERE n.userId = ?
        GROUP BY n.id, n.content, n.createdAt
        ORDER BY n.createdAt DESC;
    `);
    const userExists = db.prepare('SELECT 1 FROM users WHERE id = ?;');
    const verseExists = db.prepare('SELECT 1 FROM verses WHERE id = ?;');
    const insertNote = db.prepare(`
        INSERT INTO notes(userId, content) VALUES(?, ?)
        RETURNING id AS noteId, createdAt;
    `);
    const insertNoteVerse = db.prepare('INSERT OR IGNORE INTO note_verses(noteId, verseId) VALUES(?, ?);');
    const removeNoteVerse = db.prepare('DELETE FROM note_verses WHERE noteId = ? AND verseId = ?;');
    const selectUserNote = db.prepare('SELECT id AS noteId, content FROM notes WHERE id = ? AND userId = ?;');
    const updateNoteContent = db.prepare('UPDATE notes SET content = ? WHERE id = ? AND userId = ?;');
    const deleteUserNote = db.prepare(`
        DELETE FROM notes
        WHERE id = ? AND userId = ?
        RETURNING id AS noteId;
    `);

    const createNoteWithVerses = db.transaction((userId, content, verseIds) => {
        const missingVerseIds = verseIds.filter(id => !verseExists.get(id));
        if (missingVerseIds.length > 0) {
            return { missingVerseIds };
        }


        const { noteId, createdAt } = insertNote.get(userId, content);
        for (const verseId of verseIds) {
            insertNoteVerse.run(noteId, verseId);
        }

        return {
            note: { noteId, content, createdAt, verseIds },
            missingVerseIds: []
        };
    });

    const updateNoteWithVerses = db.transaction((userId, noteId, content, addVerseIds, removeVerseIds) => {
        const note = selectUserNote.get(noteId, userId);
        if (!note) {
            return { notFound: true };
        }

        const verseIds = [...new Set([...addVerseIds, ...removeVerseIds])];
        const missingVerseIds = verseIds.filter(id => !verseExists.get(id));
        if (missingVerseIds.length > 0) {
            return { missingVerseIds };
        }

        if (content !== undefined) {
            updateNoteContent.run(content, noteId, userId);
        }
        for (const verseId of addVerseIds) {
            insertNoteVerse.run(noteId, verseId);
        }
        for (const verseId of removeVerseIds) {
            removeNoteVerse.run(noteId, verseId);
        }

        return {
            note: { noteId, content: content ?? note.content },
            missingVerseIds: []
        };
    });

    fastify.get('/user/:userId',
        { schema: schemas.userId },
        (req, reply) => {
            const { userId } = req.params;

            const notes = userNotes.all(userId).map(note => ({
                ...note,
                verses: JSON.parse(note.verses)
            }));

            reply.code(200).send({ notes });
        }
    );

    fastify.post('/user/:userId',
        { schema: schemas.noteCreate },
        (req, reply) => {
            const { userId } = req.params;
            const { content, verseIds = [] } = req.body;

            if (!userExists.get(userId)) {
                return reply.code(404).send({ error: 'User not found' });
            }

            const uniqueVerseIds = [...new Set(verseIds)];
            const result = createNoteWithVerses(userId, content, uniqueVerseIds);
            if (result.missingVerseIds.length > 0) {
                return reply.code(404).send({
                    error: 'Verse not found',
                    verseIds: result.missingVerseIds
                });
            }

            reply.code(201).send(result.note);
        }
    );

    fastify.patch('/user/:userId/:noteId',
        { schema: schemas.noteUpdate },
        (req, reply) => {
            const { userId, noteId } = req.params;
            const {
                content,
                addVerseIds = [],
                removeVerseIds = []
            } = req.body;
            const addIds = [...new Set(addVerseIds)];
            const removeIds = [...new Set(removeVerseIds)];
            const removeIdSet = new Set(removeIds);
            const conflictingVerseIds = addIds.filter(id => removeIdSet.has(id));

            if (conflictingVerseIds.length > 0) {
                return reply.code(400).send({
                    error: 'A verse cannot be added and removed in the same request',
                    verseIds: conflictingVerseIds
                });
            }

            const result = updateNoteWithVerses(
                userId,
                noteId,
                content,
                addIds,
                removeIds
            );
            if (result.notFound) {
                return reply.code(404).send({ error: 'Note not found' });
            }
            if (result.missingVerseIds?.length > 0) {
                return reply.code(404).send({
                    error: 'Verse not found',
                    verseIds: result.missingVerseIds
                });
            }

            reply.send(result.note);
        }
    );

    fastify.delete('/user/:userId/:noteId',
        { schema: schemas.noteDelete },
        (req, reply) => {
            const { userId, noteId } = req.params;
            const deleted = deleteUserNote.get(noteId, userId);

            if (!deleted) {
                return reply.code(404).send({ error: 'Note not found' });
            }

            reply.send({ noteId: deleted.noteId });
        }
    );
}