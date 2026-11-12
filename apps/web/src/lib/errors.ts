/**
 * Database functions raise messages that carry the requirement they enforce (e.g. "… (ADM-011)."). They are turned
 * into message keys of the `Errors` namespace, so that users read plain words (UX-004).
 */
export type ErrorKey =
  | "noCredit"
  | "emailUnavailable"
  | "lastAdmin"
  | "notYourself"
  | "creditsBelowAccounts"
  | "minimumCredit"
  | "deletionPending"
  | "alreadyHasAccounts"
  | "forbidden"
  | "expiredLink"
  | "archived"
  | "idTaken"
  | "invalidId"
  | "fileUnreadable"
  | "domainCode"
  | "noSteward"
  | "domainInUse"
  | "notAnAccount"
  | "unknownDomain"
  | "invalid"
  | "nameTaken"
  | "unavailable";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: ErrorKey } | null;

const BY_REQUIREMENT: [string, ErrorKey][] = [
  ["ADM-011", "noCredit"],
  ["ADM-013", "emailUnavailable"],
  ["ADM-016", "lastAdmin"],
  ["ADM-017", "notYourself"],
  ["CT-013", "creditsBelowAccounts"],
  ["CT-011", "minimumCredit"],
  ["ADM-042", "archived"],
  ["MM-025", "domainInUse"],
  ["MM-022", "notAnAccount"],
  ["MM-021", "noSteward"],
  ["MM-020", "domainCode"],
];

export function errorKey(error: { code?: string; message?: string } | null | undefined): ErrorKey {
  if (!error) return "unavailable";
  const message = error.message ?? "";
  if (error.code === "23505" && message.includes("VER-031")) return "nameTaken";
  for (const [requirement, key] of BY_REQUIREMENT) if (message.includes(requirement)) return key;
  if (message.includes("Cancel the deletion request first")) return "deletionPending";
  if (message.includes("already has accounts")) return "alreadyHasAccounts";
  if (error.code === "42501") return "forbidden";
  if (error.code === "P0001" || error.code === "P0002" || error.code === "22P02" || error.code === "23514") return "invalid";
  return "unavailable";
}

export const failure = (error: ErrorKey): ActionResult => ({ ok: false, error });
