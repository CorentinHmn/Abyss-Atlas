"use client";

import { type ComponentProps, useState } from "react";
import { Input } from "./input";

/**
 * A comma-separated list typed in one field. The list is applied when the field is left, so that commas and spaces
 * can be typed freely; it follows the value when it changes elsewhere (undo).
 */
export function TokenInput({ value, onCommit, ...props }: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "onBlur"> & { value: string[]; onCommit: (tokens: string[]) => void }) {
  const joined = value.join(", ");
  const [draft, setDraft] = useState(joined);
  const [shown, setShown] = useState(joined);
  if (shown !== joined) {
    setShown(joined);
    setDraft(joined);
  }
  return (
    <Input
      {...props}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const tokens = draft.split(",").map((item) => item.trim()).filter(Boolean);
        if (tokens.join(", ") !== joined) onCommit(tokens);
        else setDraft(joined);
      }}
    />
  );
}
