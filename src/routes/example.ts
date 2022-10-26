import { FastifyInstance, RouteOptions } from "fastify";

async function routes(fastify: FastifyInstance, options: RouteOptions) {
  fastify.get("/", async function (request, reply) {
    reply.code(404).send({ hello: "world" });
  });

  fastify.get("/bye", async function (request, reply) {
    return { bye: "good bye" };
  });
}

module.exports = routes;
