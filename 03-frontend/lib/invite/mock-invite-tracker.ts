const STORAGE_KEY = "insome_invite_log";

export interface InviteRecord {
  readonly code: string;
  readonly acceptedAt: string;
}

// TODO(phase-4.1): replace with Supabase insert + relation graph
export function trackInviteAccept(incomingCode: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list: InviteRecord[] = raw ? JSON.parse(raw) : [];
    list.push({ code: incomingCode, acceptedAt: new Date().toISOString() });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    console.log("[invite] accepted from:", incomingCode);
  } catch {
    /* swallow */
  }
}

export function readInviteLog(): ReadonlyArray<InviteRecord> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as InviteRecord[]) : [];
  } catch {
    return [];
  }
}
