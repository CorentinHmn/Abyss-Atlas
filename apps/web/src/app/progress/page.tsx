import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { PHASES, phaseStatus, UPDATED_ON, WAITING_FOR_YOU, type Status } from "@/progress/roadmap";

const STATUS_STYLE: Record<Status, string> = {
  done: "bg-success/15 text-success",
  in_progress: "bg-warning/15 text-warning",
  waiting_for_you: "bg-info/15 text-info",
  not_started: "bg-line/40 text-muted",
};

const STATUS_DOT: Record<Status, string> = {
  done: "bg-success",
  in_progress: "bg-warning",
  waiting_for_you: "bg-info",
  not_started: "bg-line",
};

export default async function ProgressPage() {
  // SCR-900: the founder (operator) only; customers never see the roadmap.
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (!viewer.isOperator) notFound();
  const t = await getTranslations("Progress");
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const current = PHASES.find((phase) => phaseStatus(phase) !== "done");

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          {t("back")}
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-muted">{t("subtitle", { date: UPDATED_ON })}</p>
        {commit ? <p className="font-mono text-xs text-muted">{t("deployed", { commit })}</p> : null}
      </header>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label={t("title")}>
        {PHASES.map((phase) => {
          const status = phaseStatus(phase);
          const done = phase.criteria.filter((criterion) => criterion.status === "done").length;
          return (
            <li key={phase.id} className={`rounded-lg border p-3 ${phase === current ? "border-brand" : "border-line"}`}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
                <span className="font-mono text-xs text-muted">{phase.id}</span>
              </div>
              <p className="mt-1 text-sm font-semibold">{phase.name}</p>
              <div className="mt-2 h-1.5 rounded-full bg-line/50">
                <div className={`h-1.5 rounded-full ${STATUS_DOT[status]}`} style={{ width: `${(done / phase.criteria.length) * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">{t("criteria", { done, total: phase.criteria.length })}</p>
            </li>
          );
        })}
      </ol>

      <section className="flex flex-col gap-3 rounded-lg border border-info/40 bg-info/5 p-5">
        <h2 className="text-lg font-bold">{t("waitingTitle")}</h2>
        <p className="text-sm text-muted">{t("waitingIntro")}</p>
        <ul className="flex flex-col gap-2">
          {WAITING_FOR_YOU.map((item) => (
            <li key={item.unblocks} className="flex flex-wrap items-baseline justify-between gap-2">
              <span>{item.label}</span>
              <span className="font-mono text-xs text-info">{t("unblocks", { id: item.unblocks })}</span>
            </li>
          ))}
        </ul>
      </section>

      {PHASES.map((phase) => {
        const status = phaseStatus(phase);
        return (
          <section key={phase.id} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold">
                <span className="font-mono text-muted">{phase.id}</span> {phase.name}
              </h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>{t(`status.${status}`)}</span>
              {phase === current ? <span className="text-xs font-semibold text-brand">{t("current")}</span> : null}
            </div>
            <p className="text-sm text-muted">
              {phase.goal} {t("estimate", { estimate: phase.estimate })}
            </p>
            <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
              {phase.criteria.map((criterion) => (
                <li key={criterion.id} className="flex flex-col gap-1 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs text-muted">{criterion.id}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[criterion.status]}`}>{t(`status.${criterion.status}`)}</span>
                  </div>
                  <p className="font-medium">{criterion.label}</p>
                  {criterion.note ? <p className="text-sm text-muted">{criterion.note}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
