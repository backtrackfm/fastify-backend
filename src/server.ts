import fastify from "fastify";
import * as dotenv from "dotenv";

const app = fastify();
dotenv.config();

const port = Number(process.env.PORT || 4000);

app.listen({ port, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  console.log(`🛠 Server listening at ${address}`);
});
