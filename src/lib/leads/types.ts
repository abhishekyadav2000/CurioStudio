import type { LeadSource } from "@prisma/client";

export interface RawLead {
  title: string;
  url: string;
  source: LeadSource;
  companyName?: string;
  location?: string;
  remote?: boolean;
  postedAt?: Date;
  description?: string;
}

export interface RawCompanyUpdate {
  companyName: string;
  type: "JOB_POST" | "PRODUCT_LAUNCH" | "FUNDING" | "NEWS";
  title: string;
  url?: string;
  summary?: string;
}

export interface FetchResult {
  leads: RawLead[];
  updates: RawCompanyUpdate[];
}
