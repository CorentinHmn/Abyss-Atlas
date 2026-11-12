/**
 * Monaco bundled with the app (no CDN: nothing is loaded from a third party, docs/04-architecture.md), with only the
 * YAML and SQL languages.
 */
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor";
import "monaco-editor/languages/definitions/yaml/register";
import "monaco-editor/languages/definitions/sql/register";

declare global {
  interface Window {
    MonacoEnvironment?: { getWorker: (workerId: string, label: string) => Worker };
  }
}

window.MonacoEnvironment = {
  getWorker: () => new Worker(new URL("./editor.worker.ts", import.meta.url), { type: "module" }),
};
loader.config({ monaco });

// The editor sits on the app's surfaces (globals.css), in both color schemes.
monaco.editor.defineTheme("atlas-light", { base: "vs", inherit: true, rules: [], colors: { "editor.background": "#ffffff", "editorGutter.background": "#ffffff" } });
monaco.editor.defineTheme("atlas-dark", { base: "vs-dark", inherit: true, rules: [], colors: { "editor.background": "#161d25", "editorGutter.background": "#161d25" } });

export { monaco };
