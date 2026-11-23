// Builds the installable web app into site/ for GitHub Pages.
// Unlike the artifact build, React is bundled in so the app works fully offline.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from "node:fs";

rmSync("site", { recursive: true, force: true });
mkdirSync("site/icons", { recursive: true });
mkdirSync(".build", { recursive: true });

execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.cjs", "-i", "src/styles.css", "-o", ".build/pages.css", "--minify"], { stdio: "inherit" });

await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  outfile: ".build/pages.js",
  jsx: "transform",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});

const css = readFileSync(".build/pages.css", "utf8");
const js = readFileSync(".build/pages.js", "utf8").replace(/<\/script/gi, "<\\/script");
const html = readFileSync("web/index.template.html", "utf8")
  .replace("/*CSS*/", () => css)
  .replace("/*JS*/", () => js);
writeFileSync("site/index.html", html);

const buildId = Date.now().toString(36);
writeFileSync("site/sw.js", readFileSync("web/sw.js", "utf8").replace("__BUILD__", buildId));
cpSync("web/manifest.webmanifest", "site/manifest.webmanifest");
cpSync("web/icons", "site/icons", { recursive: true });
writeFileSync("site/.nojekyll", "");
console.log(`site/index.html  ${(html.length / 1024).toFixed(1)} KB  (build ${buildId})`);
