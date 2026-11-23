// Renders web/icon.svg into the PNG icons the web app manifest and iOS need.
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const svg = readFileSync("web/icon.svg", "utf8");
mkdirSync("web/icons", { recursive: true });
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size }, font: { loadSystemFonts: true } }).render().asPng();
  writeFileSync(`web/icons/${name}`, png);
  console.log(name, png.length, "bytes");
}
