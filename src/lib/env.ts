import { str, envsafe, port, url } from "envsafe";

export const env = envsafe({
  NODE_ENV: str({
    devDefault: "development",
    choices: ["development", "test", "production"],
  }),
  PORT: port({
    devDefault: 4000,
    desc: "The port the app is running on",
    example: 80,
  }),
  API_PREFIX: str({
    devDefault: "/api",
    desc: "The prefix for all API routes",
    example: "/api",
  }),
});
