import { FastifyReply } from "fastify";

type StdErrorType = {
  details?: unknown; // Posibility to provide further details
  code: 400 | 500; // Sorry!
  type: "not-found" | "conflict" | "validation" | "unknown";
};

export type StdReply = {
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

// Generated via chatgpt
export function isStdReply(obj: unknown): obj is StdReply {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const stdReply = obj as StdReply;
  return (
    (stdReply.data === undefined || typeof stdReply.data === "object") &&
    (stdReply.error === undefined || isStdError(stdReply.error)) &&
    (stdReply.clientMessage === undefined ||
      typeof stdReply.clientMessage === "string")
  );
}

// Type guard for StdErrorType
function isStdError(obj: unknown): obj is StdErrorType {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const stdError = obj as StdErrorType;
  return (
    typeof stdError.code === "number" &&
    (stdError.code === 400 || stdError.code === 500) &&
    typeof stdError.type === "string" &&
    ["not-found", "conflict", "validation", "unknown"].includes(stdError.type)
  );
}

export const stdNoAuth: StdReply = {
  error: {
    code: 400,
    type: "validation",
  },
  clientMessage: "You must be signed in",
};
