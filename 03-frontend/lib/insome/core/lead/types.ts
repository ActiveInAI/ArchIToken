import type { Floorplan } from "@/lib/insome/floorplan";
import type { PriceEstimate } from "../pricing/types";

export type LeadSource =
  | "home-chat"
  | "home-template"
  | "home-workspace"
  | "studio-proposal"
  | "studio-editor";

export type LeadStatus = "new" | "contacted" | "closed";

export interface LeadFormData {
  readonly name: string;
  readonly phone: string;
  readonly email?: string;
  readonly message?: string;
  readonly projectId?: string;
  readonly floorplanSnapshot?: Floorplan;
  readonly priceEstimate?: PriceEstimate;
  readonly source: LeadSource;
}

export interface LeadRecord extends LeadFormData {
  readonly id: string;
  readonly submittedAt: number;
  readonly status: LeadStatus;
}

export interface LeadProvider {
  submit(data: LeadFormData): Promise<{ id: string; submittedAt: number }>;
  list?(): Promise<ReadonlyArray<LeadRecord>>;
  clear?(): Promise<void>;
}
