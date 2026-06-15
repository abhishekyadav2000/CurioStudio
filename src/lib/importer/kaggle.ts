import type { ImportResult } from "./types";
import type { ParsedUrl } from "./detect-source";

const USER_AGENT = "CurioStudio/1.0";

export async function importKaggle(url: string, parsed: ParsedUrl): Promise<ImportResult> {
  const isNotebook = url.includes("/code/") || parsed.fullName?.startsWith("code/");
  const refMatch = url.match(/kaggle\.com\/(?:code|datasets)\/([^/]+)\/([^/?#]+)/i);
  const owner = refMatch?.[1] ?? parsed.owner ?? "unknown";
  const slug = refMatch?.[2] ?? parsed.repo ?? "item";

  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  };
  if (process.env.KAGGLE_USERNAME && process.env.KAGGLE_KEY) {
    headers.Authorization = `Basic ${Buffer.from(
      `${process.env.KAGGLE_USERNAME}:${process.env.KAGGLE_KEY}`
    ).toString("base64")}`;
  }

  const listEndpoint = isNotebook
    ? `https://www.kaggle.com/api/v1/kernels/list?user=${owner}&search=${slug}&pageSize=1`
    : `https://www.kaggle.com/api/v1/datasets/list?user=${owner}&search=${slug}&pageSize=1`;

  const res = await fetch(listEndpoint, { headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Kaggle API ${res.status}`);
  }

  const list = (await res.json()) as Array<Record<string, unknown>>;
  const entry = list[0] ?? {};
  const title = String(entry.titleNullable ?? slug);
  const subtitle = String(entry.subtitleNullable ?? "");
  const votes = typeof entry.totalVotesNullable === "number" ? entry.totalVotesNullable : 0;

  const readme = [
    `# Kaggle ${isNotebook ? "Notebook" : "Dataset"}: ${title}`,
    "",
    subtitle,
    "",
    `Author: ${owner}`,
    votes ? `Community votes: ${votes}` : "",
    "",
    `URL: ${url}`,
    "",
    "Note: Kaggle content is reviewed via metadata — download/run requires Kaggle credentials.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    metadata: {
      name: title,
      fullName: `${isNotebook ? "code" : "datasets"}/${owner}/${slug}`,
      description: subtitle || title,
      owner,
      stars: votes,
      language: isNotebook ? "Notebook" : "Dataset",
      license: String(entry.licenseNameNullable ?? "") || null,
      lastCommit: null,
      readme,
      openIssues: 0,
      defaultBranch: "main",
      topics: [isNotebook ? "notebook" : "dataset"],
      homepage: url,
      cloneUrl: "",
      sourceKind: isNotebook ? "notebook" : "dataset",
    },
    techStack: ["Kaggle", isNotebook ? "Jupyter" : "Dataset"],
    raw: entry,
  };
}
