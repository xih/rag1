import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { Database } from "generated/db.js";
import { SupabaseVectorStore } from "langchain/vectorstores/supabase";
import { Document } from "langchain/document";
import { ArxivPaperNote } from "notes/prompts.js";

export const ARXIV_PAPERS_TABLE = "arxiv_papers";
export const ARXIV_EMBEDDINGS_TABLE = "arxiv_embeddings";
export const ARXIV_QA_TABLE = "arxiv_question_answering";

// after we will add new things to our table
// 1. add embeddings
// 2. retreiving embeddings
// 3. writing to our table
// 4. and so forth

export class SupabaseDatabase {
  vectorStore: SupabaseVectorStore;
  client: SupabaseClient<Database, "public", any>;

  constructor(
    client: SupabaseClient<Database, "public", any>,
    vectorStore: SupabaseVectorStore
  ) {
    this.client = client;
    this.vectorStore = vectorStore;
  }

  // for our QAroute, we need to define a function so we can get the correct responses based on the
  // index rather than the document
  static async fromExistingIndex(): Promise<SupabaseDatabase> {
    const privateKey = process.env.SUPABASE_PRIVATE_KEY;
    const supabaseURL = process.env.SUPABASE_URL;

    if (!privateKey || !supabaseURL) {
      throw new Error("Missing SUPABASE_PRIVATE_KEY or SUPABASE_URL");
    }

    const client = createClient<Database>(supabaseURL, privateKey);

    const vectorStore = await SupabaseVectorStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      {
        client: client,
        tableName: ARXIV_EMBEDDINGS_TABLE,
        queryName: "match_documents",
      }
    );

    return new this(client, vectorStore);
  }

  // create a supabase client that is correctly typed with our database
  // then instantiate our vector store
  // use supabase vector store from langchain
  static async fromDocuments(
    documents: Array<Document>
  ): Promise<SupabaseDatabase> {
    const privateKey = process.env.SUPABASE_PRIVATE_KEY;
    const supabaseURL = process.env.SUPABASE_URL;

    if (!privateKey || !supabaseURL) {
      throw new Error("Missing SUPABASE_PRIVATE_KEY or SUPABASE_URL");
    }

    const client = createClient<Database>(supabaseURL, privateKey);

    const vectorStore = await SupabaseVectorStore.fromDocuments(
      documents,
      new OpenAIEmbeddings(),
      {
        client: client,
        tableName: ARXIV_EMBEDDINGS_TABLE,
        queryName: "match_documents",
      }
    );

    return new this(client, vectorStore);
  }

  // first method we want to add is to add papers to our database
  async addPaper({
    paperUrl,
    name,
    paper,
    notes,
  }: {
    paperUrl: string;
    name: string;
    paper: string;
    notes: ArxivPaperNote[];
  }) {
    const { data, error } = await this.client
      .from(ARXIV_PAPERS_TABLE)
      .insert({
        arxiv_url: paperUrl,
        name,
        paper,
        notes,
      })
      .select();

    if (error) {
      throw new Error(`Error adding apper to the database ${error.message}`);
    }
    // console.log(`Paper added successfully`, data);

    // return data;
    // console.log(data);
  }

  // this querys the database table and finds the row where the arxiv_url matches the queried url
  //
  async getPaper(
    url: string
  ): Promise<Database["public"]["Tables"]["arxiv_papers"]["Row"]> {
    const { data, error } = await this.client
      .from(ARXIV_PAPERS_TABLE)
      .select()
      .eq("arxiv_url", url);

    if (error || !data) {
      console.error("error getting paper from database");
      throw error;
    }
    return data[0];
  }

  // save the results of our professor prompting to the database so we can cache it
  async saveQa(
    question: string,
    answer: string,
    context: string,
    followupQuestions: Array<string>
  ) {
    const { error } = await this.client.from(ARXIV_QA_TABLE).insert({
      question,
      answer,
      context,
      followup_questions: followupQuestions,
    });

    if (error) {
      console.log("error saving QA to the database");
      throw error;
    }
  }
}
