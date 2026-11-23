// Bundles the React/TS app and Tailwind CSS into one self-contained HTML page.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

mkdirSync(".build", { recursive: true });
mkdirSync("dist", { recursive: true });

execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.cjs", "-i", "src/styles.css", "-o", ".build/app.css", "--minify"], { stdio: "inherit" });

await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  outfile: ".build/app.js",
  jsx: "transform",
  alias: {
    react: resolve("src/shims/react.cjs"),
    "react-dom/client": resolve("src/shims/react-dom-client.cjs"),
  },
  logLevel: "warning",
});

const css = readFileSync(".build/app.css", "utf8");
const js = readFileSync(".build/app.js", "utf8").replace(/<\/script/gi, "<\\/script");
const html = readFileSync("src/template.html", "utf8")
  .replace("/*CSS*/", () => css)
  .replace("/*JS*/", () => js);
writeFileSync("dist/holdem-trainer.html", html);
console.log(`dist/holdem-trainer.html  ${(html.length / 1024).toFixed(1)} KB`);
