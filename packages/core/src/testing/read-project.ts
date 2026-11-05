/** Test helper: reads a project folder into spec files (Node.js only, never shipped in the core). */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type { SpecFile } from "../spec/load";

export const REFERENCE_PROJECT = resolve(import.meta.dirname, "../../../../examples/reference");

export function readProject(root: string): SpecFile[] {
  const files: SpecFile[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else files.push({ path: relative(root, full).split(sep).join("/"), content: readFileSync(full, "utf8") });
    }
  };
  walk(root);
  return files;
}
