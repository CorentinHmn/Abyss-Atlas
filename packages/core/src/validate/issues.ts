/** Validation issues (docs/05-modules/validation.md §1). */

export type Severity = "error" | "warning" | "info";

export interface Issue {
  /** `VAL-xxx`, see docs/05-modules/validation.md. */
  code: string;
  severity: Severity;
  message: string;
  /** Path of the file, relative to the project root. */
  file: string;
  /** Position in the file, as a path of keys (e.g. `columns.country_code.from.oracle`). Empty for the whole file. */
  at: string;
}

export class IssueList {
  readonly items: Issue[] = [];

  add(code: string, severity: Severity, file: string, at: string, message: string): void {
    this.items.push({ code, severity, file, at, message });
  }

  error(code: string, file: string, at: string, message: string): void {
    this.add(code, "error", file, at, message);
  }

  warning(code: string, file: string, at: string, message: string): void {
    this.add(code, "warning", file, at, message);
  }

  /** VAL-001: sorted by file, then position, then code, so two runs give the same report. */
  sorted(): Issue[] {
    return [...this.items].sort(
      (a, b) => a.file.localeCompare(b.file) || a.at.localeCompare(b.at, undefined, { numeric: true }) || a.code.localeCompare(b.code),
    );
  }
}

export function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((part, index) => (typeof part === "number" ? `[${part}]` : `${index === 0 ? "" : "."}${String(part)}`))
    .join("");
}
