/* This worker is public. It contains no passphrase or plaintext application assets. */
const VERSION = "__VERSION__";
const CURRENT = "mrs-private-" + VERSION,
  GATE = "mrs-private-gate-" + VERSION,
  base = self.registration.scope;
const abs = (p) => new URL(p, base).href;
const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
self.addEventListener("install", (e) =>
  e.waitUntil(
    (async () => {
      const c = await caches.open(GATE);
      await c.addAll([base, abs("index.html"), abs("unlock.js")]);
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
async function activeCache() {
  const keys = await caches.keys();
  if (keys.includes(CURRENT)) {
    const c = await caches.open(CURRENT);
    if (await c.match(abs("__ready__"))) return c;
  }
  for (const key of keys.reverse()) {
    if (key.startsWith("mrs-private-") && !key.includes("gate")) {
      const c = await caches.open(key);
      if (await c.match(abs("__ready__"))) return c;
    }
  }
  return null;
}
const mime = (p) =>
  p.endsWith(".html")
    ? "text/html; charset=utf-8"
    : p.endsWith(".js")
      ? "text/javascript"
      : p.endsWith(".css")
        ? "text/css"
        : p.endsWith(".json") || p.endsWith(".webmanifest")
          ? "application/json"
          : p.endsWith(".svg")
            ? "image/svg+xml"
            : p.endsWith(".png")
              ? "image/png"
              : p.endsWith(".jpg")
                ? "image/jpeg"
                : p.endsWith(".wav")
                  ? "audio/wav"
                  : p.endsWith(".ttf")
                    ? "font/ttf"
                    : "application/octet-stream";
async function fetchBytes(name) {
  const response = await fetch(abs(name), { cache: "no-store" });
  if (!response.ok)
    throw Error(
      "配信ファイルを取得できません。通信または更新を確認してください",
    );
  return new Uint8Array(await response.arrayBuffer());
}
async function unlock(message, client) {
  const response = await fetch(abs("vault-meta.json"), { cache: "no-store" });
  if (!response.ok) throw Error("配信情報を取得できません");
  const meta = await response.json();
  if (meta.version !== VERSION)
    throw Error("更新があります。ページを再読み込みしてください");
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(message.passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  message.passphrase = "";
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: bytes(meta.salt),
      iterations: meta.iterations,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const manifest = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes(meta.iv) },
    key,
    await fetchBytes(meta.manifest),
  );
  const entries = JSON.parse(new TextDecoder().decode(manifest)),
    queue = [...entries],
    cache = await caches.open(CURRENT);
  let done = 0;
  async function worker() {
    while (queue.length) {
      const entry = queue.shift();
      const parts = await Promise.all(entry.parts.map(fetchBytes));
      let ciphertext;
      if (parts.length === 1) ciphertext = parts[0];
      else {
        ciphertext = new Uint8Array(
          parts.reduce((n, b) => n + b.byteLength, 0),
        );
        let offset = 0;
        for (const part of parts) {
          ciphertext.set(part, offset);
          offset += part.byteLength;
        }
      }
      const compressed = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: bytes(entry.iv) },
        key,
        ciphertext,
      );
      const data = await new Response(
        new Blob([compressed])
          .stream()
          .pipeThrough(new DecompressionStream("gzip")),
      ).arrayBuffer();
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      if (hash !== entry.hash)
        throw Error("素材の整合性を確認できませんでした");
      await cache.put(
        abs(entry.path),
        new Response(data, {
          headers: {
            "Content-Type": mime(entry.path),
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "no-referrer",
          },
        }),
      );
      client?.postMessage({
        type: "cache-progress",
        done: ++done,
        total: entries.length,
      });
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  await cache.put(abs("__ready__"), new Response("ready"));
  for (const k of await caches.keys())
    if (k.startsWith("mrs-private-") && k !== CURRENT && k !== GATE)
      await caches.delete(k);
  client?.postMessage({ type: "unlocked" });
}
self.addEventListener("message", (e) => {
  e.waitUntil(
    (async () => {
      const msg = e.data;
      if (msg === "status") {
        const c = await activeCache();
        const current = await caches.open(CURRENT);
        e.source?.postMessage({
          type: (await current.match(abs("__ready__")))
            ? "cache-ready"
            : c
              ? "cache-update"
              : "cache-pending",
        });
        e.source?.postMessage({ type: "private-host" });
        return;
      }
      if (msg === "lock") {
        for (const k of await caches.keys())
          if (k.startsWith("mrs-private-") && !k.includes("gate"))
            await caches.delete(k);
        e.source?.postMessage({ type: "locked" });
        return;
      }
      if (msg?.type !== "unlock") return;
      try {
        await unlock(msg, e.source);
      } catch (error) {
        e.source?.postMessage({
          type: "unlock-error",
          message:
            error.name === "OperationError"
              ? "合言葉が違うか、配信データが破損しています。"
              : "解除できませんでした。通信・空き容量とSafariの対応を確認してください。" +
                (error.message ?? ""),
        });
      }
    })(),
  );
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(base)) return;
  const url = new URL(e.request.url);
  if (
    url.pathname.endsWith("/sw.js") ||
    url.pathname.endsWith(".bin") ||
    url.pathname.endsWith("/vault-meta.json")
  )
    return;
  e.respondWith(
    (async () => {
      const gate = await caches.open(GATE);
      if (e.request.mode === "navigate" && url.searchParams.has("unlock"))
        return (await gate.match(abs("index.html"))) ?? fetch(e.request);
      const cache = await activeCache();
      if (cache) {
        const hit = await cache.match(e.request, { ignoreSearch: true });
        if (hit) return hit;
        if (e.request.mode === "navigate")
          return (await cache.match(abs("index.html"))) ?? fetch(e.request);
      }
      return (
        (await gate.match(e.request, { ignoreSearch: true })) ??
        fetch(e.request)
      );
    })(),
  );
});
