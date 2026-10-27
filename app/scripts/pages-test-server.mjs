import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const prefix = "/Mrs.English_ver2/";
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".css": "text/css",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".wav": "audio/wav",
};
createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (!pathname.startsWith(prefix)) throw Error();
    pathname = pathname.slice(prefix.length) || "index.html";
    const file = path.resolve("dist", pathname);
    if (!file.startsWith(path.resolve("dist") + "/")) throw Error();
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(4174, "127.0.0.1");
