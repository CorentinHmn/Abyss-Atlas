"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "saved" | "unsaved" | "saving" | "error";

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

/**
 * The document of one spec object in the editor (MAP-002): the object, its changes, automatic saving (MAP-070) and
 * undo / redo of the user's own changes (MAP-072). In P3 the co-editing document (Yjs, ADR 0005) replaces this
 * layer; the screens only use `doc`, `change`, `undo`, `redo` and `state`.
 */
export function useSpecDocument<T>(initial: T, save: (doc: T) => Promise<boolean>, delayMs = 1500) {
  const [history, setHistory] = useState<History<T>>({ past: [], present: initial, future: [] });
  const [state, setState] = useState<SaveState>("saved");
  const [pendingVersion, setPendingVersion] = useState(0);
  const savedVersion = useRef(0);
  const saveRef = useRef(save);
  const presentRef = useRef(initial);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(() => {
    presentRef.current = history.present;
  }, [history.present]);

  const flush = useCallback(async (version: number) => {
    setState("saving");
    const ok = await saveRef.current(presentRef.current).catch(() => false);
    savedVersion.current = Math.max(savedVersion.current, version);
    setState((current) => (current === "saving" ? (ok ? "saved" : "error") : current));
  }, []);

  // Automatic saving: a quiet period after the last change (MAP-070).
  useEffect(() => {
    if (pendingVersion === 0 || pendingVersion === savedVersion.current) return;
    const timer = setTimeout(() => void flush(pendingVersion), delayMs);
    return () => clearTimeout(timer);
  }, [pendingVersion, delayMs, flush]);

  // Unsaved changes: warn before the page closes.
  useEffect(() => {
    if (state !== "unsaved" && state !== "saving") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  const touched = useCallback(() => {
    setState("unsaved");
    setPendingVersion((version) => version + 1);
  }, []);

  /** Applies a change; `update` returns the new object (it never mutates the current one). */
  const change = useCallback(
    (update: (current: T) => T) => {
      setHistory((current) => {
        const next = update(current.present);
        if (next === current.present) return current;
        return { past: [...current.past.slice(-99), current.present], present: next, future: [] };
      });
      touched();
    },
    [touched],
  );

  const undo = useCallback(() => {
    setHistory((current) => {
      const previous = current.past.at(-1);
      return previous === undefined ? current : { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] };
    });
    touched();
  }, [touched]);

  const redo = useCallback(() => {
    setHistory((current) => {
      const [next, ...rest] = current.future;
      return next === undefined ? current : { past: [...current.past, current.present], present: next, future: rest };
    });
    touched();
  }, [touched]);

  return {
    doc: history.present,
    change,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    state,
    retry: () => void flush(pendingVersion),
  };
}
