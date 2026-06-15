import type { DiscoveryItem } from "./types";

const USER_AGENT = "Mozilla/5.0 (compatible; CurioStudio/1.0)";

interface KaggleDataset {
  ref?: string;
  titleNullable?: string;
  subtitleNullable?: string;
  creatorNameNullable?: string;
  creatorUrlNullable?: string;
  urlNullable?: string;
  totalVotesNullable?: number;
  usabilityRatingNullable?: number;
}

interface KaggleKernel {
  ref?: string;
  titleNullable?: string;
  subtitleNullable?: string;
  author?: string;
  urlNullable?: string;
  totalVotesNullable?: number;
}

export async function fetchKaggleTrending(kind: "datasets" | "notebooks" = "datasets"): Promise<DiscoveryItem[]> {
  if (!process.env.KAGGLE_USERNAME?.trim() || !process.env.KAGGLE_KEY?.trim()) {
    return fetchKagglePublic(kind);
  }
  return fetchKaggleWithAuth(kind);
}

async function fetchKagglePublic(kind: "datasets" | "notebooks"): Promise<DiscoveryItem[]> {
  const endpoint =
    kind === "notebooks"
      ? "https://www.kaggle.com/api/v1/kernels/list?sortBy=hottest&pageSize=25"
      : "https://www.kaggle.com/api/v1/datasets/list?sortBy=hottest&pageSize=25";

  const res = await fetch(endpoint, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      Referer: "https://www.kaggle.com/datasets",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Kaggle API error (${res.status})${body ? `: ${body.slice(0, 120)}` : ""} — set KAGGLE_USERNAME/KAGGLE_KEY for authenticated access`
    );
  }

  const data = (await res.json()) as KaggleDataset[] | KaggleKernel[];
  return data.map((entry, index) => mapKaggleEntry(entry, kind, index + 1));
}

async function fetchKaggleWithAuth(kind: "datasets" | "notebooks"): Promise<DiscoveryItem[]> {
  const creds = Buffer.from(`${process.env.KAGGLE_USERNAME}:${process.env.KAGGLE_KEY}`).toString("base64");
  const path = kind === "notebooks" ? "kernels/list" : "datasets/list";
  const res = await fetch(`https://www.kaggle.com/api/v1/${path}?sortBy=hottest&size=25`, {
    headers: {
      Authorization: `Basic ${creds}`,
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Kaggle authenticated API error (${res.status})`);
  }

  const data = (await res.json()) as KaggleDataset[] | KaggleKernel[];
  return data.map((entry, index) => mapKaggleEntry(entry, kind, index + 1));
}

function mapKaggleEntry(
  entry: KaggleDataset | KaggleKernel,
  kind: "datasets" | "notebooks",
  rank: number
): DiscoveryItem {
  const ref = entry.ref ?? "";
  const [owner, repo] = ref.includes("/") ? ref.split("/") : ["kaggle", ref || `item-${rank}`];
  const title = entry.titleNullable ?? repo;
  const subtitle = entry.subtitleNullable ?? "";
  const votes = entry.totalVotesNullable;

  const url =
    entry.urlNullable ??
    (kind === "notebooks"
      ? `https://www.kaggle.com/code/${ref}`
      : `https://www.kaggle.com/datasets/${ref}`);

  return {
    source: "KAGGLE",
    owner,
    repo,
    fullName: `${kind}/${ref || title}`,
    url,
    description: subtitle || `${kind === "notebooks" ? "Notebook" : "Dataset"}: ${title}`,
    language: kind === "notebooks" ? "Notebook" : "Dataset",
    taskType: kind === "notebooks" ? "notebook" : "dataset",
    starsToday: null,
    metricLabel: votes != null ? "votes" : null,
    metricValue: votes != null ? votes.toLocaleString() : null,
    rank,
  };
}
