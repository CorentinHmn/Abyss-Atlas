import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ControlTopBar } from "@/components/shell/control-top-bar";
import { getViewer } from "@/lib/session";

/** CT-001: operators only; anyone else gets "not found". */
export default async function ControlLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (!viewer.isOperator) notFound();
  return (
    <div className="flex min-h-dvh flex-col">
      <ControlTopBar email={viewer.email} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
