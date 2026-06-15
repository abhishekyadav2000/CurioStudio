import type { LeadSource } from "@prisma/client";

export type AtsType = "greenhouse" | "lever" | "ashby" | "workday" | "custom" | "linkedin";

export interface CompanyMeta {
  careersUrl?: string;
  greenhouseSlug?: string;
  leverSlug?: string;
  ashbySlug?: string;
  githubOrg?: string;
  linkedinSearchUrl?: string;
  atsType?: AtsType;
  website?: string;
}

export interface RawLead {
  title: string;
  url: string;
  source: LeadSource;
  companyName?: string;
  location?: string;
  remote?: boolean;
  postedAt?: Date;
  description?: string;
  companyMeta?: CompanyMeta;
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
