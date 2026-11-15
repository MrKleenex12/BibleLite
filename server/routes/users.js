import schemas from '../schema.js';

const DEMO_EMAIL = 'transaction-demo@example.com';

export default function userRoutes(fastify, { db }) {
    const selectUsers = db.prepare('SELECT id, firstName, lastName, email FROM users;');
    const selectUserByEmail = db.prepare(`
        SELECT id, firstName, lastName, email, passwordHash
        FROM users
        WHERE email = ?;
    `);
    const insertUser = db.prepare(`
        INSERT INTO users(firstName, lastName, email, passwordHash)
        VALUES(?, ?, ?, ?)
        RETURNING id, firstName, lastName, email;
    `);
    const insertDemoUser = db.prepare(`
        INSERT INTO users(firstName, lastName, email, passwordHash)
        VALUES('Transaction', 'Demo', ?, NULL)
        ON CONFLICT(email) DO NOTHING;
    `);

    fastify.get('/', (request, reply) => {
        reply.send({ users: selectUsers.all() });
    });

    fastify.post('/', { schema: schemas.userCreate }, (request, reply) => {
        const { firstName, lastName, email } = request.body;
        try {
            const user = insertUser.get(firstName.trim(), lastName.trim(), email.trim(), null);
            return reply.code(201).send({ user });
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return reply.code(409).send({ error: 'User with that email already exists' });
            }
            throw error;
        }
    });

    fastify.post('/signup', { schema: schemas.userSignup }, (request, reply) => {
        const { firstName, lastName, password } = request.body;
        const email = request.body.email.trim().toLowerCase();
        const normalizedFirstName = firstName.trim();
        const normalizedLastName = lastName.trim();

        if (!normalizedFirstName || !normalizedLastName) {
            return reply.code(400).send({ error: 'Enter your first and last name' });
        }
        if (email === DEMO_EMAIL) {
            return reply.code(409).send({ error: 'That email address is reserved for the demo account' });
        }
        if (selectUserByEmail.get(email)) {
            return reply.code(409).send({ error: 'An account with that email already exists' });
        }

        try {
            const user = insertUser.get(normalizedFirstName, normalizedLastName, email, password);
            return reply.code(201).send({ user });
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return reply.code(409).send({ error: 'An account with that email already exists' });
            }
            throw error;
        }
    });

    fastify.post('/login', { schema: schemas.userLogin }, (request, reply) => {
        const user = selectUserByEmail.get(request.body.email.trim().toLowerCase());
        if (!user || user.passwordHash !== request.body.password) {
            return reply.code(401).send({ error: 'Email or password is incorrect' });
        }

        const { passwordHash, ...publicUser } = user;
        return reply.send({ user: publicUser });
    });

    fastify.post('/demo', (request, reply) => {
        const createOrGetDemoUser = db.transaction(() => {
            insertDemoUser.run(DEMO_EMAIL);
            return selectUserByEmail.get(DEMO_EMAIL);
        });
        const user = createOrGetDemoUser();

        if (!user || user.passwordHash !== null) {
            return reply.code(409).send({ error: 'The demo account is unavailable' });
        }

        const { passwordHash, ...publicUser } = user;
        return reply.send({ user: publicUser });
    });

    fastify.patch('/id/:userId', { schema: schemas.userId }, (request, reply) => {
        const allowedFields = ['firstName', 'lastName', 'email'];
        const body = request.body ?? {};
        const fields = allowedFields.filter((field) => Object.hasOwn(body, field));

        if (fields.length === 0) {
            return reply.code(400).send({ error: 'Provide at least one field to update' });
        }

        const assignments = fields.map((field) => `${field} = ?`).join(', ');
        const values = fields.map((field) => body[field]);
        values.push(request.params.userId);

        const result = db.prepare(`UPDATE users SET ${assignments} WHERE id = ?`).run(...values);
        if (result.changes === 0) {
            return reply.code(404).send({ error: 'User not found' });
        }
        return reply.send({ updated: true });
    });

    fastify.delete('/id/:userId', { schema: schemas.userId }, (request, reply) => {
        const result = db.prepare('DELETE FROM users WHERE id = ?').run(request.params.userId);
        if (result.changes === 0) {
            return reply.code(404).send({ error: 'User not found' });
        }
        return reply.send({ deleted: result.changes });
    });
}
