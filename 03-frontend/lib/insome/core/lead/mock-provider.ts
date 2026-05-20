import type { LeadFormData, LeadProvider, LeadRecord } from "./types";

const STORAGE_KEY = "insome_demo_leads";

function makeId(): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let id = "";
  for (let i = 0; i < 12; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function loadAll(): LeadRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LeadRecord[]) : [];
  } catch {
    return [];
  }
}

function saveAll(records: LeadRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* swallow — demo-only mock provider */
  }
}

/**
 * Demo-only lead provider. Persists to localStorage + console.log.
 * TODO(phase-4.1): replace with real POST /api/leads backed by Supabase.
 */
export class MockLeadProvider implements LeadProvider {
  async submit(data: LeadFormData): Promise<{ id: string; submittedAt: number }> {
    const id = makeId();
    const submittedAt = Date.now();
    const record: LeadRecord = { ...data, id, submittedAt, status: "new" };
    const all = loadAll();
    all.push(record);
    saveAll(all);
    // eslint-disable-next-line no-console
    console.log("[insome:mock-lead] submitted", record);
    return { id, submittedAt };
  }
  async list(): Promise<ReadonlyArray<LeadRecord>> {
    return loadAll();
  }
  async clear(): Promise<void> {
    saveAll([]);
  }
}
