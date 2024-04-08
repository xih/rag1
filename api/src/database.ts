import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { Database } from "generated/db.js";
import { SupabaseVectorStore } from "langchain/vectorstores/supabase";
import { Document } from "langchain/document";
import { ArxivPaperNote } from "prompts.js";

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
}
