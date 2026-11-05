import Fastify from "fastify";

// Create Fastify server instance
const fastify = Fastify({
    logger: true // turn logger on
});

fastify.get('/', (request, reply) => {
    reply.send({ hello: 'world' });
});

fastify.listen({ port: 8000 }, (err, address) => {
    if(err) {
        fastify.log.error(err);
        process.exit(1); // Node.js global
    }
});