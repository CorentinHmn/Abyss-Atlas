import { getTranslations } from "next-intl/server";
import type { Described } from "@/lib/history";

const short = (value: unknown) => {
  if (value === undefined) return "—";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
};

/** VER-021: the changes of an object in business terms, with the old and new value of simple attributes. */
export async function ChangeList({ changes, label }: { changes: Described[]; label: string }) {
  const t = await getTranslations("History");
  if (changes.length === 0) return <p className="text-sm text-muted">{t("noDifference")}</p>;
  return (
    <ul className="flex flex-col gap-1 text-sm" aria-label={label}>
      {changes.map((change) => (
        <li key={change.what + JSON.stringify(change.values)} className="flex flex-wrap items-baseline gap-x-2">
          <span>{t(`what.${change.what}`, change.values)}</span>
          {"before" in change && (typeof change.before !== "object" || typeof change.after !== "object") && (change.before !== undefined || change.after !== undefined) ? (
            <span className="font-mono text-xs text-muted">
              {t("fromTo", { before: short(change.before), after: short(change.after) })}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** The one-line summary of a version in the timeline (VER-010). */
export async function summaryOf(changes: Described[]): Promise<string> {
  const t = await getTranslations("History");
  const parts = changes.slice(0, 3).map((change) => t(`what.${change.what}`, change.values));
  return changes.length > 3 ? t("andMore", { list: parts.join(" · "), count: changes.length - 3 }) : parts.join(" · ");
}
