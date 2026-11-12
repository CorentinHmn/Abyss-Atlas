"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import { monaco } from "./monaco";

export interface Marker {
  line: number;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface CodeEditorProps {
  value: string;
  language: "yaml" | "sql";
  label: string;
  readOnly?: boolean | undefined;
  markers?: Marker[] | undefined;
  onChange?: ((value: string) => void) | undefined;
  onFocusChange?: ((focused: boolean) => void) | undefined;
  height?: string | undefined;
}

const SEVERITY = { error: monaco.MarkerSeverity.Error, warning: monaco.MarkerSeverity.Warning, info: monaco.MarkerSeverity.Info };

function useDark() {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return dark;
}

/** MAP-060, MAP-026: a YAML or SQL editor, with the problems marked on their lines. */
export default function CodeEditor({ value, language, label, readOnly, markers, onChange, onFocusChange, height = "60vh" }: CodeEditorProps) {
  const dark = useDark();
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(
      model,
      "atlas",
      (markers ?? []).map((marker) => {
        const line = Math.min(Math.max(marker.line, 1), model.getLineCount());
        return { startLineNumber: line, endLineNumber: line, startColumn: 1, endColumn: model.getLineMaxColumn(line), message: marker.message, severity: SEVERITY[marker.severity] };
      }),
    );
  }, [markers, mounted, value]);

  return (
    <div className="overflow-hidden rounded-md border border-line">
      <Editor
        height={height}
        language={language}
        value={value}
        theme={dark ? "atlas-dark" : "atlas-light"}
        onChange={(next) => onChange?.(next ?? "")}
        onMount={(editor) => {
          editorRef.current = editor;
          editor.onDidFocusEditorText(() => onFocusChange?.(true));
          editor.onDidBlurEditorText(() => onFocusChange?.(false));
          setMounted(true);
        }}
        options={{
          ariaLabel: label,
          readOnly: Boolean(readOnly),
          domReadOnly: Boolean(readOnly),
          minimap: { enabled: false },
          fontSize: 13,
          tabSize: 2,
          insertSpaces: true,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          automaticLayout: true,
          renderLineHighlight: readOnly ? "none" : "line",
        }}
      />
    </div>
  );
}
