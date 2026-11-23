import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";

function start(data: unknown) {
  const el = document.getElementById("root")!;
  createRoot(el).render(<App hot={(data as any) ?? undefined} />);
}

const hot = window.claude?.hot;
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? null);
