import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Alert({ className, tone = "danger", ...props }: ComponentProps<"p"> & { tone?: "danger" | "success" | "info" }) {
  const styles = { danger: "border-danger/40 bg-danger/5 text-danger", success: "border-success/40 bg-success/5 text-success", info: "border-info/40 bg-info/5 text-ink" };
  return <p role={tone === "danger" ? "alert" : "status"} className={cn("rounded-md border px-3 py-2 text-sm", styles[tone], className)} {...props} />;
}
