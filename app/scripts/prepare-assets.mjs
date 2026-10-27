import { mkdir, cp, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
const root = path.resolve("..");
await mkdir("public", { recursive: true });
for (const p of [
  "assets/original",
  "assets/new/native",
  "assets/new/sfx",
  "assets/fonts",
])
  await cp(path.join(root, p), path.join("public", p), { recursive: true });
async function optimize(dir) {
  for (const f of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) {
      await optimize(p);
      continue;
    }
    if (!/\.(jpg|png)$/i.test(p)) continue;
    const max = p.includes("backgrounds")
      ? 1920
      : p.includes("cards")
        ? 900
        : p.includes("card-frame")
          ? 600
          : 1200;
    const im = sharp(p).rotate().resize({
      width: max,
      height: max,
      fit: "inside",
      withoutEnlargement: true,
    });
    const data = await (
      /\.jpg$/i.test(p)
        ? im.jpeg({ quality: 86, mozjpeg: true })
        : im.png({ compressionLevel: 9 })
    ).toBuffer();
    await writeFile(p, data);
  }
}
await optimize("public/assets/original");
await mkdir("public/assets/thumbs", { recursive: true });
for (const file of ["cards", "backgrounds"]) {
  const rows = JSON.parse(
    await (
      await import("node:fs/promises")
    ).readFile(path.join(root, "assets/catalogs/" + file + ".json"), "utf8"),
  );
  for (const row of rows)
    await sharp(path.join(root, row.photoPath ?? row.path))
      .rotate()
      .resize({ width: 320, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile("public/assets/thumbs/" + row.id + ".jpg");
}
await mkdir("public/icons", { recursive: true });
const icon = path.join(root, "assets/original/assets/logo/icon-192.png");
for (const [file, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
])
  await sharp(icon)
    .resize(size, size, { fit: "contain", background: "#08162c" })
    .png()
    .toFile("public/icons/" + file);
await writeFile(
  "public/manifest.webmanifest",
  JSON.stringify(
    {
      name: "Mrs. English",
      short_name: "Mrs. English",
      id: "./",
      start_url: "./",
      scope: "./",
      display: "standalone",
      orientation: "landscape",
      lang: "ja",
      background_color: "#08162c",
      theme_color: "#08162c",
      icons: [
        { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
        {
          src: "icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
      ],
    },
    null,
    2,
  ),
);
console.log("Runtime assets prepared; source originals unchanged.");
