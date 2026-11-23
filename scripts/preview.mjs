import { readFileSync, writeFileSync } from "node:fs";
const body = readFileSync("dist/holdem-trainer.html", "utf8");
writeFileSync(".build/index.html", `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font-size:14px}[hidden]{display:none!important}</style></head><body>${body}</body></html>`);
