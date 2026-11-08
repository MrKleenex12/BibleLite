export default function userRoutes(fastify, { db }) {
    const selectUsers = db.prepare(`
        SELECT id, firstName, lastName FROM users;
    `);

    fastify.get('/', (req, reply) => {
        const users = selectUsers.all();
        reply.send({ users });
    });
}
