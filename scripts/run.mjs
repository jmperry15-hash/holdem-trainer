// Bundles scripts/<name>.ts for Node and runs it: node scripts/run.mjs verify-eval
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
const name = process.argv[2];
await build({ entryPoints: [`scripts/${name}.ts`], bundle: true, platform: "node", outfile: `.build/${name}.cjs`, logLevel: "warning" });
execFileSync("node", [`.build/${name}.cjs`, ...process.argv.slice(3)], { stdio: "inherit" });
