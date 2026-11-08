export default function bookRoutes(fastify, { db }) {
    const selectBooks = db.prepare(`
        SELECT id, code, name, testament, chapterCount
        FROM books
        ORDER BY id;
    `);

    fastify.get('/books', (req, reply) => {
        const books = selectBooks.all();
        reply.send({ books });
    });
}
