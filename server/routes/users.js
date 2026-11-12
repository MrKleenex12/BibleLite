import schemas from '../schema.js'

export default function userRoutes(fastify, { db }) {
    const selectUsers = db.prepare('SELECT id, firstName, lastName, email FROM users;');
    const deleteUser = db.prepare('DELETE FROM users WHERE id = ?;')

    fastify.get('/', (req, reply) => {
        const users = selectUsers.all();
        reply.send({ users });
    });

    fastify.patch('/id/:userId',
        { schema: schemas.userId },
        (req, reply) => {
            const allowedFields = ['firstName', 'lastName', 'email'];
            const fields = allowedFields.filter(field => Object.hasOwn(req.body, field));

            if (fields.length === 0) {
                return reply.code(400).send({ error: 'Provide at least one field to update' });
            }

            const assignments = fields.map(field => `${field} = ?`).join(', ');
            const values = fields.map(field => req.body[field]);
            values.push(req.params.userId);

            db.prepare(`UPDATE users SET ${assignments} WHERE id = ?`).run(...values);
            
    });

    fastify.delete('/id/:userId',
        { schema: schemas.userId },
        (req, reply) => {
            const { userId } = req.params;
            const deleted = deleteUser.all(userId);

            reply.send({ deleted });
    });
}
