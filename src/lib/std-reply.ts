import { FastifyReply } from "fastify";

type StdErrorType = {
  details?: unknown; // Posibility to provide further details
  code: 400 | 500; // Sorry!
  type: "conflict" | "validation" | "unknown";
};

type StdReply = {
  data?: unknown;
  error?: StdErrorType;
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
      error: {
        details: data.error.details,
        type: data.error.type,
      },
    });
  }

  return fastifyReply.code(200).send({
    data: data.data ?? null,
    clientMessage: data.clientMessage ?? null,
  });
}
