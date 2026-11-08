import Fastify from "fastify";
import Database from "better-sqlite3";
import bookRoutes from "./routes/books.js";
import highlightRoutes from "./routes/highlights.js";
import noteRoutes from "./routes/notes.js";
import translationRoutes from "./routes/translations.js";
import userRoutes from "./routes/users.js";
import verseRoutes from "./routes/verses.js";

const db = new Database('../biblelite.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const fastify = Fastify({
    logger: true
});

fastify.get('/', (req, reply) => {
    reply.send({ hello: 'world' });
});

fastify.register(bookRoutes, { db });
fastify.register(highlightRoutes, { db });
fastify.register(noteRoutes, { db });
fastify.register(translationRoutes, { db });
fastify.register(userRoutes, { db });
fastify.register(verseRoutes, { db });

fastify.listen({ port: 8000 }, (err, address) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
});
