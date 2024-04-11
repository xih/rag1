// create a funciton that takes in a few things

import { ChatOpenAI, OpenAI } from "@langchain/openai";
import { SupabaseDatabase } from "database.js";
import { Document } from "langchain/document";
import { formatDocumentsAsString } from "langchain/util/document";
import { ArxivPaperNote } from "notes/prompts.js";
import {
  ANSWER_QUESTION_TOOL_SCHEMA,
  QA_OVER_PAPER_PROMPT,
  answerOutputParser,
} from "./prompt.js";

async function qaModel(
  question: string,
  documents: Array<Document>,
  notes: Array<ArxivPaperNote>
) {
  // convert documents to string
  // convert notes to string
  // pipe through prompt, chat model and outputparser

  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-0125",
    temperature: 0.0,
  });

  const modelWithTool = model.bind({
    tools: [ANSWER_QUESTION_TOOL_SCHEMA],
    tool_choice: "auto",
  });

  // const output = modelAsString.generatePrompt(QA_OVER_PAPER_PROMPT);

  const chain =
    QA_OVER_PAPER_PROMPT.pipe(modelWithTool).pipe(answerOutputParser);

  const documentsAsString = formatDocumentsAsString(documents);
  const notesAsString = notes.map((note) => note.note).join("\n");

  const response = await chain.invoke({
    relevantDocuments: documentsAsString,
    notes: notesAsString,
    question: question,
  });
  return response;
}

// name of the paper - use this as metadata in the paper when we filter for embeddings
export async function qaOnPaper(question: string, paperUrl: string) {
  const database = await SupabaseDatabase.fromExistingIndex();
  const documents = await database.vectorStore.similaritySearch(question, 8, {
    url: paperUrl,
  });

  const { notes } = await database.getPaper(paperUrl);

  // next step is to construct prompts, outputParser and tooltypes and make those requests

  // TODO: ONE THING that we forgot is storing these to the database
  const answerAndQuestions = await qaModel(
    question,
    documents,
    notes as unknown as Array<ArxivPaperNote>
  );

  await Promise.all(
    answerAndQuestions.map(async (qa) =>
      database.saveQa(
        question,
        qa.answer,
        formatDocumentsAsString(documents),
        qa.followUpQuestions
      )
    )
  );

  return answerAndQuestions;
}
