"use client";

import { useEffect, useRef } from "react";

export function useModalBackClose(opts: {
  open: boolean;
  onRequestClose: () => boolean;
}) {
  const pushedRef = useRef(false);
  const suppressPopRef = useRef(false);
  const openRef = useRef(opts.open);
  const onRequestCloseRef = useRef(opts.onRequestClose);

  useEffect(() => {
    openRef.current = opts.open;
    onRequestCloseRef.current = opts.onRequestClose;
  }, [opts.open, opts.onRequestClose]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (opts.open && !pushedRef.current) {
      window.history.pushState({ __modalBack: true }, "");
      pushedRef.current = true;
      return;
    }
    if (!opts.open && pushedRef.current) {
      suppressPopRef.current = true;
      window.history.back();
    }
  }, [opts.open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPopState = () => {
      if (suppressPopRef.current) {
        suppressPopRef.current = false;
        pushedRef.current = false;
        return;
      }
      if (!openRef.current) {
        pushedRef.current = false;
        return;
      }
      const closed = onRequestCloseRef.current();
      if (closed) {
        pushedRef.current = false;
        return;
      }
      window.history.pushState({ __modalBack: true }, "");
      pushedRef.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);
}
