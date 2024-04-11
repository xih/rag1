import express from "express";
import { takeNotes } from "notes/index.js";
import { qaOnPaper } from "./qa/index.js";

function main() {
  const app = express();

  app.use(express.json()); // have to use JSON to make the code work
  const port = process.env.PORT || 8000;

  app.get("/", (_req, res) => {
    // health check
    res.status(200).send("ok");
    console.log(_req, "request");
    console.log("hello world");
  });

  // define a post endpoint route
  app.post("/take_notes", async (req, res) => {
    const { paperUrl, name, pagesToDelete } = req.body;

    console.log(paperUrl);

    const notes = await takeNotes({ paperUrl, name, pagesToDelete });

    res.status(200).send(notes);
    return;
  });

  app.post("/qa", async (req, res) => {
    const { question, paperUrl } = req.body;

    const qa = await qaOnPaper(question, paperUrl);

    res.status(200).send(qa);
    return;
  });

  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
}

main();
