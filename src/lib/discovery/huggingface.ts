import type { DiscoveryItem } from "./types";

const USER_AGENT = "CurioStudio/1.0";

interface HfSpace {
  id: string;
  likes?: number;
  sdk?: string;
  tags?: string[];
}

interface HfModel {
  id: string;
  likes?: number;
  pipeline_tag?: string;
  library_name?: string;
  tags?: string[];
}

export async function fetchHuggingFaceTrending(
  kind: "spaces" | "models" = "spaces"
): Promise<DiscoveryItem[]> {
  const endpoint =
    kind === "models"
      ? "https://huggingface.co/api/models?sort=likes&direction=-1&limit=25"
      : "https://huggingface.co/api/spaces?sort=likes&direction=-1&limit=25";

  const res = await fetch(endpoint, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Hugging Face API error (${res.status})`);
  }

  const data = (await res.json()) as HfSpace[] | HfModel[];
  const items: DiscoveryItem[] = [];

  for (let i = 0; i < data.length; i++) {
    const entry = data[i];
    const id = entry.id;
    if (!id || !id.includes("/")) continue;

    const [owner, repo] = id.split("/");
    const likes = entry.likes ?? 0;
    const taskType =
      kind === "models"
        ? (entry as HfModel).pipeline_tag ?? (entry as HfModel).library_name ?? null
        : (entry as HfSpace).sdk ?? null;

    const url =
      kind === "models"
        ? `https://huggingface.co/models/${id}`
        : `https://huggingface.co/spaces/${id}`;

    items.push({
      source: "HUGGINGFACE",
      owner,
      repo,
      fullName: `${kind}/${id}`,
      url,
      description: buildDescription(entry, kind),
      language: taskType,
      taskType,
      starsToday: null,
      metricLabel: "likes",
      metricValue: likes.toLocaleString(),
      rank: i + 1,
    });
  }

  return items;
}

function buildDescription(entry: HfSpace | HfModel, kind: "spaces" | "models"): string {
  const tags = (entry.tags ?? []).slice(0, 5).join(", ");
  const label = kind === "models" ? "Model" : "Space";
  const task =
    kind === "models"
      ? (entry as HfModel).pipeline_tag ?? (entry as HfModel).library_name
      : (entry as HfSpace).sdk;
  const parts = [`${label} on Hugging Face`];
  if (task) parts.push(`task: ${task}`);
  if (tags) parts.push(`tags: ${tags}`);
  return parts.join(" · ");
}
