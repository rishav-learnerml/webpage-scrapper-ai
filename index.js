import axios from "axios";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI(process.env.OPENAI_API_KEY);

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

async function ingest(url='') { 
    const {head,body,internalLinks} = await scrapeWebsite(url);
    const headEmbedding = await generateVectorEmbeddings({text:head});
    const bodyEmbedding = await generateVectorEmbeddings({text:body});

    

}

scrapeWebsite(
  "https://www.amazon.in/?&tag=googhydrabk1-21&ref=pd_sl_5szpgfto9i_e&adgrpid=155259813593&hvpone=&hvptwo=&hvadid=674893540034&hvpos=&hvnetw=g&hvrand=16983059265241311416&hvqmt=e&hvdev=c&hvdvcmdl=&hvlocint=&hvlocphy=9299038&hvtargid=kwd-64107830&hydadcr=14452_2316413&gad_source=1"
).then(console.log);
