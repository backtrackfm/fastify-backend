import { FastifyReply, FastifyRequest } from "fastify";
import { loginPageRoute } from "./consts";

// https://github.com/fastify/fastify-passport/issues/401
export async function redirectToLogin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (request.isUnauthenticated()) {
    reply.redirect(302, loginPageRoute); // or return an error. I use this to redirect to a page to log in with
  }
}
