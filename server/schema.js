// --- Route schemas ---

// Holds every route schema so index.js needs only one import.
const userIdParams = {
    type: 'object',
    required: ['userId'],
    properties: {
        userId: { type: 'integer', minimum: 1 }
    }
};

const noteParams = {
    type: 'object',
    required: ['userId', 'noteId'],
    properties: {
        userId: { type: 'integer', minimum: 1 },
        noteId: { type: 'integer', minimum: 1 }
    }
};

const verseIdArray = {
    type: 'array',
    items: { type: 'integer', minimum: 1 }
};

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
    userId: {
        params: userIdParams
    },
    userCreate: {
        body: {
            type: 'object',
            required: ['firstName', 'lastName', 'email'],
            additionalProperties: false,
            properties: {
                firstName: { type: 'string', minLength: 1, maxLength: 100 },
                lastName: { type: 'string', minLength: 1, maxLength: 100 },
                email: { type: 'string', minLength: 3, maxLength: 254 }
            }
        }
    },
    userHighlight: {
        params: {
            type: 'object',
            required: ['userId', 'highlightId'],
            properties: {
                userId: { type: 'integer', minimum: 1 },
                highlightId: { type: 'integer', minimum: 1 }
            }
        }
    },
    noteCreate: {
        params: userIdParams,
        body: {
            type: 'object',
            required: ['content'],
            additionalProperties: false,
            properties: {
                content: { type: 'string' },
                verseIds: verseIdArray
            }
        }
    },
    noteUpdate: {
        params: noteParams,
        body: {
            type: 'object',
            minProperties: 1,
            additionalProperties: false,
            properties: {
                content: { type: 'string' },
                addVerseIds: verseIdArray,
                removeVerseIds: verseIdArray
            }
        }
    },
    noteDelete: {
        params: noteParams
    },
    userSignup: {
        body: {
            type: 'object',
            required: ['firstName', 'lastName', 'email', 'password'],
            additionalProperties: false,
            properties: {
                firstName: { type: 'string', minLength: 1, maxLength: 100 },
                lastName: { type: 'string', minLength: 1, maxLength: 100 },
                email: { type: 'string', minLength: 3, maxLength: 254, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
                password: { type: 'string', minLength: 1, maxLength: 128 }
            }
        }
    },
    userLogin: {
        body: {
            type: 'object',
            required: ['email', 'password'],
            additionalProperties: false,
            properties: {
                email: { type: 'string', minLength: 3, maxLength: 254, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
                password: { type: 'string', minLength: 1, maxLength: 128 }
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
        params: userIdParams,
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
    },
    highlightVerseState: {
        body: {
            type: 'object',
            required: ['userId', 'highlightId', 'verseId', 'isActive'],
            additionalProperties: false,
            properties: {
                userId: { type: 'integer', minimum: 1 },
                highlightId: { type: 'integer', minimum: 1 },
                verseId: { type: 'integer', minimum: 1 },
                isActive: { type: 'boolean' }
            }
        }
    },
};

export default schemas;
