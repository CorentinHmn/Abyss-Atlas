import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="relative w-full overflow-x-auto rounded-lg border border-line bg-surface">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}
export const Th = ({ className, ...props }: ComponentProps<"th">) => (
  <th className={cn("border-b border-line px-3 py-2 text-left text-xs font-semibold text-muted", className)} {...props} />
);
export const Td = ({ className, ...props }: ComponentProps<"td">) => (
  <td className={cn("border-b border-line/60 px-3 py-2 align-middle", className)} {...props} />
);
