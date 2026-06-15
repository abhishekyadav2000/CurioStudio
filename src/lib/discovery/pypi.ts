import type { DiscoveryItem } from "./types";

/** Popular PyPI projects via the BigQuery-free RSS alternative: top downloads list page scrape fallback + known API. */
export async function fetchPyPITrending(): Promise<DiscoveryItem[]> {
  // PyPI JSON API for recent popular packages (curated list + live metadata)
  const seeds = [
    "requests",
    "numpy",
    "pandas",
    "fastapi",
    "uvicorn",
    "langchain",
    "transformers",
    "torch",
    "django",
    "flask",
    "httpx",
    "pydantic",
    "pytest",
    "black",
    "ruff",
    "polars",
    "streamlit",
    "gradio",
    "openai",
    "anthropic",
  ];

  const items: DiscoveryItem[] = [];
  let rank = 0;

  for (const name of seeds) {
    try {
      const res = await fetch(`https://pypi.org/pypi/${name}/json`, {
        headers: { Accept: "application/json", "User-Agent": "CurioStudio/1.0" },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        info?: {
          name?: string;
          summary?: string;
          project_urls?: Record<string, string>;
          home_page?: string;
        };
      };
      rank++;
      const info = data.info ?? {};
      const repoUrl =
        info.project_urls?.Source ??
        info.project_urls?.Repository ??
        info.project_urls?.Homepage ??
        info.home_page ??
        `https://pypi.org/project/${name}/`;

      items.push({
        source: "PYPI",
        owner: "pypi",
        repo: name,
        fullName: name,
        url: repoUrl.includes("github.com") ? repoUrl.replace(/\.git$/, "") : `https://pypi.org/project/${name}/`,
        description: info.summary ?? "",
        language: "Python",
        taskType: "pypi package",
        starsToday: null,
        metricLabel: "PyPI",
        metricValue: name,
        rank,
      });
    } catch {
      /* skip */
    }
    if (items.length >= 20) break;
  }

  return items;
}
