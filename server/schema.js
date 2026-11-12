// --- Route schemas ---

// Holds every route schema so index.js needs only one import.
const schemas = {
    chapter: {
        params: {
            type: 'object',
            properties: {
                t_id: { type: 'integer' },
                b_id: { type: 'integer' },
                c_num: { type: 'integer' }
            }
        }
    },
    user: {
        params: {
            type: 'object',
            properties: {
                id: { type: 'integer' }
            }
        }
    },
    search: {
        querystring: {
            type: 'object',
            required: ['q', 't_id'],
            properties: {
                // Two characters minimum so a one-letter search doesn't scan every verse.
                q: { type: 'string', minLength: 2, maxLength: 100 },
                t_id: { type: 'integer' },
                limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 }
            }
        }
    },
    compare: {
        params: {
            type: 'object',
            properties: {
                b_id: { type: 'integer' },
                c_num: { type: 'integer' }
            }
        }
    },
    highlights: {
        params: {
            type: 'object',
            required: ["u_id"],
            properties: {
                u_id: { type: 'integer' }
            }
        },
        body: {
            type: 'object',
            required: ["color", "verseIds"],
            properties: {
                color: { type: 'string', pattern: '^#?(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$' },
                verseIds: {
                    type: 'array',
                    minItems: 1,
                    items: { type: 'integer', minimum: 1 }
                }
            }
        }
    }
};

export default schemas;
