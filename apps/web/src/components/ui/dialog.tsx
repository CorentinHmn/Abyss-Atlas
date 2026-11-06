"use client";

import { X } from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

export function DialogContent({
  title,
  description,
  closeLabel,
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Content> & { title: ReactNode; description?: ReactNode; closeLabel: string }) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-40 bg-ink/40" />
      <Primitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-line bg-surface p-6 shadow-xl",
          className,
        )}
        {...(description ? {} : { "aria-describedby": undefined })}
        {...props}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Primitive.Title className="text-lg font-bold">{title}</Primitive.Title>
            {description ? <Primitive.Description className="text-sm text-muted">{description}</Primitive.Description> : null}
          </div>
          <Primitive.Close className="rounded-md p-1 text-muted hover:text-ink" aria-label={closeLabel}>
            <X className="h-4 w-4" aria-hidden />
          </Primitive.Close>
        </div>
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  );
}
