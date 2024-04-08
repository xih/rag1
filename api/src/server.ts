import express from "express";
import { takeNotes } from "index.js";

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
    console.log("helllo");
    console.log(req.body);
    const { paperUrl, name, pagesToDelete } = req.body;

    const notes = await takeNotes({ paperUrl, name, pagesToDelete });

    res.status(200).send(notes);
    return;
  });

  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
}

main();
