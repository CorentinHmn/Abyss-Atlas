import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceTopBar } from "@/components/shell/workspace-top-bar";
import { getViewer } from "@/lib/session";

/** NAV-001: the workspace of customer users; an operator has none. */
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (!viewer.account) redirect(viewer.isOperator ? "/control" : "/no-access");
  return (
    <div className="flex min-h-dvh flex-col">
      <WorkspaceTopBar account={viewer.account} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
