"use client";

import { useMemo } from "react";

export interface InviteLink {
  readonly code: string;
  readonly url: string;
}

// TODO(phase-4.1): real backend issues per-user invite codes via Supabase
export function useInviteLink(code: string = "INV-DEMO01"): InviteLink {
  return useMemo(() => {
    const origin =
      typeof window !== "undefined" && window.location
        ? window.location.origin
        : "https://insome.app";
    return {
      code,
      url: `${origin}/?ref=${code}`,
    };
  }, [code]);
}
