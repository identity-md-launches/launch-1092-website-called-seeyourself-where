import { createServer } from "node:http";
import { createProvider, createStudio } from "./studio.mjs";

const provider = createProvider({
  base: process.env.STUDIO_PROVIDER_URL,
  key: process.env.STUDIO_PROVIDER_KEY,
});
const origin = process.env.STUDIO_PUBLIC_ORIGIN;
if (!origin)
  throw Error(
    "Set STUDIO_PUBLIC_ORIGIN to the exact site origin, such as http://localhost:4173 for local use.",
  );
const server = createServer(createStudio({ provider, origin }));
server.requestTimeout = 90000;
server.headersTimeout = 15000;
server.listen(Number(process.env.STUDIO_PORT || 8787), "127.0.0.1", () =>
  console.log(
    "Studio API listening on localhost. Live processing:",
    !!provider,
  ),
);
