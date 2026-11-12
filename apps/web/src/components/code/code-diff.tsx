"use client";

import { DiffEditor } from "@monaco-editor/react";
import { useEffect, useState } from "react";
import "./monaco";

export interface CodeDiffProps {
  original: string;
  modified: string;
  label: string;
  height?: string | undefined;
}

/** VER-021: two versions of a file side by side (one column on a narrow screen). */
export default function CodeDiff({ original, modified, label, height = "50vh" }: CodeDiffProps) {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return (
    <div className="overflow-hidden rounded-md border border-line" role="group" aria-label={label}>
      <DiffEditor
        height={height}
        language="yaml"
        original={original}
        modified={modified}
        theme={dark ? "atlas-dark" : "atlas-light"}
        options={{ readOnly: true, originalEditable: false, minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, automaticLayout: true, wordWrap: "on" }}
      />
    </div>
  );
}
