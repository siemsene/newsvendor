import sharp from "sharp";
import { readdirSync, unlinkSync } from "fs";
import { join, basename } from "path";

const assetsDir = new URL("../src/assets/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const dragonsDir = join(assetsDir, "dragons");

const targets = [
  ...readdirSync(dragonsDir).filter((f) => f.endsWith(".png")).map((f) => join(dragonsDir, f)),
  join(assetsDir, "dragons.png"),
];

for (const src of targets) {
  const dest = src.replace(".png", ".webp");
  await sharp(src).webp({ quality: 90 }).toFile(dest);
  const { statSync } = await import("fs");
  const srcSize = statSync(src).size;
  const destSize = statSync(dest).size;
  const saving = (((srcSize - destSize) / srcSize) * 100).toFixed(1);
  console.log(`${basename(src)} → ${basename(dest)}  ${(srcSize/1024).toFixed(0)}KB → ${(destSize/1024).toFixed(0)}KB  (-${saving}%)`);
  unlinkSync(src);
}

console.log("\nDone. Original PNGs deleted.");
