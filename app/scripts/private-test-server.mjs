import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".bin": "application/octet-stream",
};
createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (pathname.startsWith("/Mrs.English_ver2/"))
      pathname = pathname.slice("/Mrs.English_ver2".length);
    const p = path.resolve(
      "sealed",
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!p.startsWith(path.resolve("sealed") + "/")) throw Error();
    const b = await readFile(p);
    res.writeHead(200, {
      "Content-Type": mime[path.extname(p)] ?? "application/octet-stream",
    });
    res.end(b);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(4174, "127.0.0.1");
