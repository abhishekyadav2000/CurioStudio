import type { DiscoveryItem } from "./types";

const USER_AGENT = "CurioStudio/1.0";

/** Popular dev-tool images — metadata fetched live from Docker Hub API */
const POPULAR_REPOS = [
  "library/python",
  "library/node",
  "library/nginx",
  "library/postgres",
  "library/redis",
  "library/mongo",
  "library/ubuntu",
  "grafana/grafana",
  "prom/prometheus",
  "hashicorp/terraform",
  "traefik/traefik",
  "portainer/portainer-ce",
  "minio/minio",
  "ollama/ollama",
  "langfuse/langfuse",
  "qdrant/qdrant",
  "chromadb/chroma",
  "apache/kafka",
  "elastic/elasticsearch",
  "jupyter/scipy-notebook",
  "nvidia/cuda",
  "mcr.microsoft.com/devcontainers/javascript-node",
  "ghcr.io/open-webui/open-webui",
  "linuxserver/code-server",
  "dpage/pgadmin4",
];

interface DockerRepoResponse {
  namespace?: string;
  name: string;
  description?: string;
  star_count?: number;
  pull_count?: number;
  user?: string;
}

export async function fetchDockerHubPopular(): Promise<DiscoveryItem[]> {
  const results = await Promise.all(
    POPULAR_REPOS.map(async (fullName, index) => {
      const [namespace, name] = splitRepo(fullName);
      try {
        const res = await fetch(
          `https://hub.docker.com/v2/repositories/${namespace}/${name}/`,
          { headers: { "User-Agent": USER_AGENT }, cache: "no-store" }
        );
        if (!res.ok) return null;
        const data = (await res.json()) as DockerRepoResponse;
        return toItem(namespace, name, data, index + 1);
      } catch {
        return toItem(namespace, name, { name, description: "Docker image" }, index + 1);
      }
    })
  );

  return results
    .filter((item): item is DiscoveryItem => item !== null)
    .sort((a, b) => {
      const aStars = parseInt(a.metricValue?.replace(/,/g, "") ?? "0", 10);
      const bStars = parseInt(b.metricValue?.replace(/,/g, "") ?? "0", 10);
      return bStars - aStars;
    })
    .map((item, i) => ({ ...item, rank: i + 1 }));
}

function splitRepo(fullName: string): [string, string] {
  if (fullName.includes("/")) {
    const idx = fullName.indexOf("/");
    return [fullName.slice(0, idx), fullName.slice(idx + 1)];
  }
  return ["library", fullName];
}

function toItem(
  namespace: string,
  name: string,
  data: DockerRepoResponse,
  rank: number
): DiscoveryItem {
  const owner = data.namespace ?? data.user ?? namespace;
  const fullName = `${owner}/${name}`;
  const stars = data.star_count ?? 0;
  const pulls = data.pull_count ?? 0;

  return {
    source: "DOCKER_HUB",
    owner,
    repo: name,
    fullName,
    url: `https://hub.docker.com/r/${fullName}`,
    description: data.description?.trim() || `Docker image ${fullName}`,
    language: "Docker",
    taskType: "container",
    starsToday: null,
    metricLabel: pulls > 0 ? "pulls" : "stars",
    metricValue: (pulls > 0 ? pulls : stars).toLocaleString(),
    rank,
  };
}
