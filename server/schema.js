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
    }
};

export default schemas;
