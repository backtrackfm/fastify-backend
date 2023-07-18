import { FastifyInstance, RouteOptions } from "fastify";

async function routes(fastify: FastifyInstance, options: RouteOptions) {
  // GET A USER FROM THE DATABASE BY ID
  fastify.get("/", async (request, reply) => {
    const params = request.params;

    // const user = await db.user.findFirst({ where: { id: request.params.id } });
    reply.code(200).send("Hello World!");
  });
}

module.exports = routes;
