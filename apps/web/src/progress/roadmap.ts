/**
 * Progress of the roadmap (docs/07-roadmap.md), shown on /progress to the signed-in founder.
 * Update it with every step that changes the status of an exit criterion.
 */

export type Status = "done" | "in_progress" | "waiting_for_you" | "not_started";

export interface Criterion {
  id: string;
  label: string;
  status: Status;
  note?: string;
}

export interface Phase {
  id: string;
  name: string;
  goal: string;
  estimate: string;
  criteria: Criterion[];
}

export const UPDATED_ON = "2026-11-05";

export const PHASES: Phase[] = [
  {
    id: "P0",
    name: "Foundations",
    goal: "Deliver safely: monorepo, CI, EU hosting, sign-in, database isolation, reference project.",
    estimate: "1–2 weeks",
    criteria: [
      { id: "RM-010", label: "A page with sign-in is deployed to staging, in the EU.", status: "done", note: "Vercel (Frankfurt) + Supabase (Frankfurt). Sessions refresh automatically." },
      { id: "RM-011", label: "The RLS test harness runs in CI and fails on a table without a policy.", status: "done", note: "35 database tests: isolation between organizations, roles, suspended accounts, no operator access to customer content." },
      { id: "RM-012", label: "The reference project exists as YAML files.", status: "done", note: "SAP France, SAP Germany, Oracle EBS, MES · 30 source tables · 7 target models, 61 columns · domains SEL, MFG, GOV." },
    ],
  },
  {
    id: "P1",
    name: "Core and CLI",
    goal: "The engine, no UI: metamodel, validation, dbt and documentation generators, internal command line.",
    estimate: "4–6 weeks",
    criteria: [
      {
        id: "RM-020",
        label: "The reference project validates with no error; every validation rule has a failing example.",
        status: "done",
        note: "0 errors, 11 justified warnings. 29 deliberate faults each caught with their code. VAL-033 (cardinality vs keys) is not implemented yet: it needs a rule for the SAP client column MANDT.",
      },
      {
        id: "RM-021",
        label: "The generated dbt project compiles and runs on the fictitious reference data.",
        status: "done",
        note: "The 7 generated models run, the 63 dbt tests and the 28 expected results pass on every push (Snowflake SQL translated to DuckDB). The run on a real Snowflake account is ready and planned before the first design partner (RM-054).",
      },
      { id: "RM-022", label: "A dictionary CSV produced by the catalog query imports into dataset files.", status: "done", note: "PostgreSQL query tested on a real database; SQL Server query checked. Native types for PostgreSQL, SQL Server, SAP and Oracle." },
      { id: "RM-023", label: "Validation of the reference project takes under 1 second.", status: "done", note: "About 0.3 s with the atlas command, Node.js start included." },
      { id: "RM-061", label: "License of the format, core and command line.", status: "done", note: "Decided: proprietary, not open source (ADR 0009). The command line is an internal tool for tests and CI." },
    ],
  },
  {
    id: "P2",
    name: "SaaS minimum",
    goal: "Specify a whole model in Atlas: accounts and credits, source registry, mapping editor, history, downloads.",
    estimate: "8–10 weeks",
    criteria: [
      { id: "RM-030", label: "The founder writes the whole reference project in Atlas, without editing YAML outside it.", status: "not_started" },
      { id: "RM-031", label: "The downloaded dbt output is identical to the CLI output on the exported project.", status: "not_started" },
      { id: "RM-032", label: "RLS tests cover every app and licensing table; no cross-organization access.", status: "not_started" },
      { id: "RM-033", label: "The operator role cannot read any app table.", status: "not_started" },
    ],
  },
  {
    id: "P3",
    name: "Governance and collaboration",
    goal: "Domains and stewards, review and approval, real-time co-editing, lineage, ODCS, support.",
    estimate: "8–10 weeks",
    criteria: [
      { id: "RM-040", label: "Two people co-edit the same model; changes appear in under 300 ms.", status: "not_started" },
      { id: "RM-041", label: "Changing a rule marks the approvals that depend on it as outdated.", status: "not_started" },
      { id: "RM-042", label: "Support access opens only after a customer Admin's approval, expires and is logged.", status: "not_started" },
      { id: "RM-043", label: "The ODCS export passes the official ODCS schema validation.", status: "not_started" },
    ],
  },
  {
    id: "P4",
    name: "v1 launch",
    goal: "SSO, MFA, performance, security review, GDPR documents, prices.",
    estimate: "4–6 weeks",
    criteria: [
      { id: "RM-050", label: "Performance targets are met.", status: "not_started" },
      { id: "RM-051", label: "No high or critical finding remains open from the security review.", status: "not_started" },
      { id: "RM-052", label: "Legal documents are signed with every provider.", status: "not_started" },
      { id: "RM-053", label: "v1 is validated on the reference project and on one design partner's real project.", status: "not_started" },
      { id: "RM-054", label: "Before the first design partner, the generated dbt project runs on a Snowflake account.", status: "not_started", note: "A Snowflake trial (free, 30 days) opened for the run; everything is ready (scripts/reference-run/README.md)." },
      { id: "RM-060", label: "Final product name, trademark check, domain name.", status: "not_started", note: "Atlas is kept for now. Needed before the website teaser." },
    ],
  },
];

/** What only the founder can do, in the order it unblocks the work. */
export const WAITING_FOR_YOU: { label: string; unblocks: string }[] = [
  { label: "Review the P2 documents as they are written (administration, control tower, navigation and source registry are written; 3 open points on the source registry).", unblocks: "P2" },
];

export function phaseStatus(phase: Phase): Status {
  const statuses = phase.criteria.map((criterion) => criterion.status);
  if (statuses.every((status) => status === "done")) return "done";
  if (statuses.every((status) => status === "not_started")) return "not_started";
  return "in_progress";
}
