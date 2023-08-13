import { FastifyInstance, RouteOptions } from "fastify";

export default async function routes(
  fastify: FastifyInstance,
  options: RouteOptions
) {
  fastify.get("/", async function (request, reply) {
    reply.code(200).send({ hello: "world 1" });
  });
}
