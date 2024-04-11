import axios from "axios";
import { PDFDocument } from "pdf-lib";
import { Document } from "langchain/document";
import { writeFile, unlink } from "fs/promises";
import { UnstructuredLoader } from "langchain/document_loaders/fs/unstructured";
import { formatDocumentsAsString } from "langchain/util/document";
// import { ChatOpenAI } from "langchain/chat_models/openai";
import { ChatOpenAI } from "@langchain/openai";

import {
  ArxivPaperNote2,
  NOTES_TOOL_SCHEMA,
  NOTE_PROMPT,
  outputParser,
  outputParser2,
} from "notes/prompts.js";
import { readFile } from "fs/promises";
import { traceable } from "langsmith/traceable";
import { wrapOpenAI } from "langsmith/wrappers";
import { SupabaseDatabase } from "database.js";

// run the docker image
// docker run -p 8000:8000 -d --rm --name unstructured-api downloads.unstructured.io/unstructured-io/unstructured-api:latest --port 8000 --host 0.0.0.0

async function deletePages(
  pdf: Buffer,
  pagesToDelete: number[]
): Promise<Buffer> {
  // what is the library called for parsing PDFS
  const pdfBuffer = await PDFDocument.load(pdf);
  let numToOffsetBy = 1;

  let counter = 1;

  for (const pageNum of pagesToDelete) {
    pdfBuffer.removePage(pageNum - numToOffsetBy);
    numToOffsetBy++;
    // we need a counter to know how much to offset by
    // because once we remove a page, we know how much the total amount will change
    // so we need to add one to the number to offset by
  }

  const pdfBytes = await pdfBuffer.save();
  return Buffer.from(pdfBytes);
}

async function loadPaperFromUrl(url: string): Promise<Buffer> {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
  });

  return response.data;
}

// step 3:
// use unstructure to parse our PDF
async function convertPdfToDocuments(pdf: Buffer): Promise<Array<Document>> {
  if (!process.env.UNSTRUCTURED_API_KEY) {
    throw new Error("missing UNSTRUCTURED_API_KEY key.");
    // unstructured requires a filepath to read from. If we are doing it on the edge, there's no filepath to read from
  }
  // make a random name to avoid filename collisions
  const randomName = Math.random().toString(36).substring(7);
  await writeFile(`pdfs/${randomName}.pdf`, pdf, "binary");
  // write a file with this random name and PDF
  const loader = new UnstructuredLoader(`pdfs/${randomName}.pdf`, {
    apiKey: process.env.UNSTRUCTURED_API_KEY,
    strategy: "hi_res",
    // apiUrl: "https://postcovet-ceq6kl5n.api.unstructuredapp.io", // gotta pass in the APIURL from here
    apiUrl:
      "https://postcovet-ceq6kl5n.api.unstructuredapp.io/general/v0/general", // gotta pass in the APIURL from here
    // https://stackoverflow.com/questions/77612655/what-api-key-is-required-for-unstructuredloader-in-langchains-document-loaders
    // server_url: "https://postcovet-ceq6kl5n.api.unstructuredapp.io",
  });

  const documents = await loader.load();
  await unlink(`pdfs/${randomName}.pdf`);

  return documents;
}

async function generateNotes(
  documents: Array<Document>
): Promise<Array<ArxivPaperNote2>> {
  const documentsAsString = formatDocumentsAsString(documents); // joins all the documents and formats them with a new line and returns a string
  const model = new ChatOpenAI({
    // modelName: "gpt-4-1106-preview",
    modelName: "gpt-3.5-turbo-0125",
    temperature: 0.0,
  });

  const modelWithTool = model.bind({
    tools: [NOTES_TOOL_SCHEMA],
  });

  const chain = NOTE_PROMPT.pipe(modelWithTool).pipe(outputParser);
  const response = await chain.invoke({
    paper: documentsAsString,
  });
  return response;
}

export const takeNotes = async ({
  paperUrl,
  name,
  pagesToDelete,
}: {
  paperUrl: string;
  name: string;
  pagesToDelete?: number[];
}) => {
  // instantiate our database
  // in the future, add a check that allows you to instantiate a document from an index
  // so you don't have to do it all the time
  const database = await SupabaseDatabase.fromExistingIndex();

  // if (!paperUrl.endsWith("pdf")) {
  //   throw new Error("Not a pdf");
  // }
  // let pdfBuffer = await loadPaperFromUrl(paperUrl);

  // if (pagesToDelete && pagesToDelete.length > 0) {
  //   // delete pages
  //   pdfBuffer = await deletePages(pdfBuffer, pagesToDelete);
  // }

  // // console.log(pdfBuffer, "pdfBuffer");
  // const documents = await convertPdfToDocuments(pdfBuffer);

  // console.log(documents, "documents");

  // await writeFile(`pdfs/document.json`, JSON.stringify(documents), "utf-8");

  // following 2 lines are a shortcut
  const docs = await readFile(`pdfs/document.json`, "utf-8");
  const documents: Document<Record<string, any>>[] = JSON.parse(docs);

  // convert our pdf to a documents
  const notes = await generateNotes(documents);
  // console.log(notes);
  // console.log(notes.length, "length of documents");

  const newDocs = documents.map((doc) => {
    return {
      ...doc,
      metadata: {
        ...doc.metadata,
        url: paperUrl,
      },
    };
  });

  await Promise.all([
    database.addPaper({
      paperUrl,
      name,
      paper: formatDocumentsAsString(newDocs),
      notes,
    }),
    database.vectorStore.addDocuments(newDocs),
  ]);

  return notes;

  // next step is to add embeddings to our database
  // first, wrap this into a promise.all
  // this will generate all our notes, save our embeddings and do it so we can use everything in the client
};

takeNotes({
  paperUrl: "https://arxiv.org/pdf/2404.01230.pdf",
  name: "test",
});
