/** Publish only an encrypted app bundle. Never upload dist/ to a public host. */
import { readFile, readdir, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  randomBytes,
  pbkdf2Sync,
  createCipheriv,
  createHash,
} from "node:crypto";
import { gzipSync } from "node:zlib";
const passphrase = process.env.SITE_PASSPHRASE;
if (!passphrase || passphrase.trim().length < 16)
  throw Error(
    "Set SITE_PASSPHRASE to a private passphrase of at least 16 characters in the hosting/Actions secret settings. Never put it in source code.",
  );
const files = [];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (p !== "dist/sw.js") files.push(p);
  }
}
await walk("dist");
const salt = randomBytes(32),
  key = pbkdf2Sync(passphrase, salt, 600000, 32, "sha256");
const hash = (b) => createHash("sha256").update(b).digest("hex");
function encrypt(plain) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  return {
    iv: iv.toString("base64"),
    data: Buffer.concat([
      cipher.update(plain),
      cipher.final(),
      cipher.getAuthTag(),
    ]),
  };
}
await rm("sealed", { recursive: true, force: true });
await mkdir("sealed");
const entries = [];
for (const file of files) {
  const data = await readFile(file),
    encrypted = encrypt(gzipSync(data)),
    id = hash(encrypted.data),
    parts = [];
  for (
    let offset = 0, i = 0;
    offset < encrypted.data.length;
    offset += 8 * 1024 * 1024, i++
  ) {
    const name = "payload-" + id + "-" + i + ".bin";
    parts.push(name);
    await writeFile(
      "sealed/" + name,
      encrypted.data.subarray(offset, offset + 8 * 1024 * 1024),
    );
  }
  entries.push({
    path: file.slice(5),
    hash: hash(data),
    iv: encrypted.iv,
    parts,
  });
}
const manifest = encrypt(Buffer.from(JSON.stringify(entries))),
  version = hash(manifest.data).slice(0, 20),
  manifestName = "manifest-" + version + ".bin";
await writeFile("sealed/" + manifestName, manifest.data);
key.fill(0);
await writeFile(
  "sealed/vault-meta.json",
  JSON.stringify({
    version,
    salt: salt.toString("base64"),
    iv: manifest.iv,
    iterations: 600000,
    manifest: manifestName,
  }),
);
await writeFile(
  "sealed/index.html",
  `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#08162c"><title>Mrs. English · Private</title><style>*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at top,#213c7b,#08162c);color:white;font:16px -apple-system,sans-serif;min-height:100dvh;display:grid;place-items:center;padding:24px}main{max-width:500px;width:100%;border:1px solid #7defff;border-bottom:3px solid #ff009e;padding:28px;background:#102544}small{color:#8ceeff;letter-spacing:3px}h1{font-size:34px}p{font-size:14px;line-height:1.7;color:#c4d6e4}label{display:block;margin-bottom:12px}input{display:block;width:100%;font:inherit;border:1px solid #8ceeff;background:#08162c;color:#fff;padding:12px;margin:8px 0}button{min-height:46px;width:100%;font:inherit;font-weight:bold;background:#efffff;color:#142050;border:0;border-bottom:3px solid #ff009e;padding:10px}button:disabled{opacity:.5}#status{white-space:pre-wrap}</style><main><small>PRIVATE PLAYROOM</small><h1>Mrs. English</h1><p>好きが、英語の力になる。<br>個人用の合言葉で、アプリと素材を解除します。</p><form id="form"><label>合言葉<input id="pass" type="password" autocomplete="current-password" required minlength="16"></label><button id="open">解除してはじめる</button></form><p id="status" role="status">初回は全教材・写真を保存するため、通信が必要です。解除後はこの端末でオフライン利用できます。</p><p>合言葉は送信せず、この端末内で復号に使用します。共有端末では使用しないでください。</p></main><script type="module" src="./unlock.js"></script></html>`,
);
await writeFile(
  "sealed/unlock.js",
  `const form=document.querySelector('#form'),button=document.querySelector('#open'),status=document.querySelector('#status');let worker;const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});await navigator.serviceWorker.ready;worker=registration.active??navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener('message',e=>{if(e.data.type==='cache-progress')status.textContent='素材を確認しています '+e.data.done+'/'+e.data.total;if(e.data.type==='unlocked'){document.querySelector('#pass').value='';location.replace('./')}if(e.data.type==='unlock-error'){status.textContent=e.data.message;button.disabled=false}});form.addEventListener('submit',async e=>{e.preventDefault();button.disabled=true;status.textContent='暗号化されたアプリを読み込み、端末内で解除しています…';worker=registration.active??navigator.serviceWorker.controller;worker.postMessage({type:'unlock',passphrase:document.querySelector('#pass').value})});`,
);
const worker = await readFile(
  new URL("private-worker.js", import.meta.url),
  "utf8",
);
await writeFile("sealed/sw.js", worker.replace("__VERSION__", version));
await writeFile(
  "sealed/_headers",
  "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n/sw.js\n  Cache-Control: no-cache\n/vault-meta.json\n  Cache-Control: no-cache\n/vault.bin\n  Cache-Control: no-cache\n",
);
await writeFile("sealed/.nojekyll", "");
console.log(
  "Private deployment prepared:",
  files.length,
  "encrypted files; upload ONLY app/sealed/ (never app/dist/).",
);
