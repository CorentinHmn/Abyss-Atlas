"use client";

import dynamic from "next/dynamic";
import type { CodeEditorProps } from "./code-editor";

export type { Marker } from "./code-editor";

/** Monaco runs in the browser only, loaded when a YAML or SQL tab opens. */
export const CodeEditor = dynamic<CodeEditorProps>(() => import("./code-editor"), {
  ssr: false,
  loading: () => <div className="h-[60vh] animate-pulse rounded-md border border-line bg-surface" />,
});

/** Two versions of a YAML file compared (VER-021). */
export const CodeDiff = dynamic<import("./code-diff").CodeDiffProps>(() => import("./code-diff"), {
  ssr: false,
  loading: () => <div className="h-[50vh] animate-pulse rounded-md border border-line bg-surface" />,
});
