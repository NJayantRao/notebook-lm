import express, { type Express } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";


const app: Express = express();
app.all("/api/auth/{*any}", toNodeHandler(auth));

app.use(express.json());

app.get("/", (_req, res) => {
  res.send("Hello, World!");
});

export default app;
