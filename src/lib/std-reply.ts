import { FastifyReply } from "fastify";

type StdReply = {
  data?: unknown;
  error?: {
    details: unknown;
    code: 400 | 500; // Sorry!
    type: "validation" | "unknown";
  };
  clientMessage?: string; // The message displayed to the client
};

// We have a standard API request -> this function sanitises it
// This is probably bad, but I'm tired of having inconsistent API errors
export function stdReply(fastifyReply: FastifyReply, data?: StdReply) {
  if (!data) {
    return fastifyReply.code(200);
  }

  if (data.error) {
    return fastifyReply.code(data.error.code).send({
      data: data.data ?? null,
      clientMessage: data.clientMessage ?? null,
      error: data.error.details,
    });
  }

  return fastifyReply.code(200).send({
    data: data.data ?? null,
    clientMessage: data.clientMessage ?? null,
  });
}
