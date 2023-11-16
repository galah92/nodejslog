import express from "express";
import { logger, loggerMiddleware } from "./logger";
import { getUser } from "./db";

const app = express();

app.use(loggerMiddleware);

app.get("/", (_req, res) => {
  logger.info("Hello World!");
  res.send("Hello World!");
});

app.get("/users/:id", (req, res) => {
  // throw new Error("Something went wrong");
  const id = Number(req.params.id);
  const user = getUser(id);
  if (!user) {
    res.sendStatus(404);
    return;
  }
  logger.info({ user }, `Found user with id ${id}`);
  res.send(user);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info({ port }, 'Listening');
});
