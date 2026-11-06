"use client";

import { type ComponentProps, useTransition } from "react";

/**
 * A form that sends its data to an action without being emptied afterwards: React resets a form given to the
 * `action` prop, so after an error the user had to type everything again.
 */
export function ActionForm({ action, ...props }: Omit<ComponentProps<"form">, "action" | "onSubmit"> & { action: (formData: FormData) => void }) {
  const [, startTransition] = useTransition();
  return (
    <form
      {...props}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
    />
  );
}
