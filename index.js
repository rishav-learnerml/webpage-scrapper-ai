import axios from "axios";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import dotenv from "dotenv";
import { ChromaClient } from "chromadb";

dotenv.config();

const openai = new OpenAI(process.env.OPENAI_API_KEY);
const chromaClient = new ChromaClient({
  path: "http://localhost:8000", //docker on 8k
});

chromaClient.heartbeat();
const WEB_COLLECTION = `WEB_SCAPED_DATA_COLLECTION-1`;

async function scrapeWebsite(url = "") {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const pageHead = $("head").html();
  const pageBody = $("body").html();

  const internalLinks = [];
  const externalLinks = [];

  $("a").each((_, el) => {
    const link = $(el).attr("href");
    if (!link || link === "/") {
      console.log("no link");
      return;
    }
    if (link.startsWith("http") || link.startsWith("https")) {
      externalLinks.push(link);
    } else {
      internalLinks.push(link);
    }
  });

  return { head: pageHead, body: pageBody, internalLinks, externalLinks };
}

async function generateVectorEmbeddings({ url, text }) {
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float",
  });

  return embedding.data[0].embedding;
}

function chunkText(text, size) {
  if (!text || typeof text !== "string") {
    return [];
  }
  if (!size || typeof size !== "number" || size <= 0) {
    return [];
  }

  const words = text.split(/\s+/); // Split text into words
  let chunks = [];
  let chunk = [];
  let tokenCount = 0;

  for (let word of words) {
    let wordTokens = word.length; // Approximate token count by word length
    if (tokenCount + wordTokens > size) {
      chunks.push(chunk.join(" "));
      chunk = [];
      tokenCount = 0;
    }
    chunk.push(word);
    tokenCount += wordTokens;
  }
  if (chunk.length > 0) {
    chunks.push(chunk.join(" "));
  }

  return chunks;
}

async function ingest(url = "") {
  console.log(`Ingesting ${url}`);
  const { head, body, internalLinks } = await scrapeWebsite(url);
  const headEmbedding = await generateVectorEmbeddings({ text: head });
  insertIntoDb({ embedding: headEmbedding, url });
  const bodyChunks = chunkText(body, 2000);
  for (const chunk of bodyChunks) {
    const bodyEmbedding = await generateVectorEmbeddings({ text: chunk });
    await insertIntoDb({ embedding: bodyEmbedding, url, head, body: chunk });
  }

  for (const link of internalLinks) {
    const _url = `${url}${link}`;
    ingest(_url);
  }

  console.log(`Ingested ${url} successfully`);
}

async function insertIntoDb({ embedding, url, body = "", head = "" }) {
  const collection = await chromaClient.getOrCreateCollection({
    name: WEB_COLLECTION,
  });

  await collection.add({
    ids: [url],
    embeddings: [embedding],
    metadatas: [{ url, body, head }],
  });
}

ingest(
  "https://www.amazon.in/?&tag=googhydrabk1-21&ref=pd_sl_5szpgfto9i_e&adgrpid=155259813593&hvpone=&hvptwo=&hvadid=674893540034&hvpos=&hvnetw=g&hvrand=16983059265241311416&hvqmt=e&hvdev=c&hvdvcmdl=&hvlocint=&hvlocphy=9299038&hvtargid=kwd-64107830&hydadcr=14452_2316413&gad_source=1"
);
