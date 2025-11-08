import "dotenv/config";
import serverless from "serverless-http";
import { createServer } from "../server/index.ts";

console.log("[api/index.js] Loading serverless function");
console.log(
  "[api/index.js] UPNSHARE_API_TOKEN:",
  process.env.UPNSHARE_API_TOKEN
    ? process.env.UPNSHARE_API_TOKEN.substring(0, 5) + "..."
    : "NOT SET",
);

const app = createServer();
export default serverless(app);
