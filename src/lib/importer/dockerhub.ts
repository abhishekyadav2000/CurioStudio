import type { ImportResult } from "./types";

const USER_AGENT = "CurioStudio/1.0";

export async function importDockerHub(namespace: string, name: string): Promise<ImportResult> {
  const res = await fetch(`https://hub.docker.com/v2/repositories/${namespace}/${name}/`, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Docker Hub API ${res.status}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const fullName = `${namespace}/${name}`;
  const stars = typeof data.star_count === "number" ? data.star_count : 0;
  const pulls = typeof data.pull_count === "number" ? data.pull_count : 0;
  const description = typeof data.description === "string" ? data.description : null;

  let tags: string[] = [];
  try {
    const tagsRes = await fetch(
      `https://hub.docker.com/v2/repositories/${namespace}/${name}/tags?page_size=5&ordering=-last_updated`,
      { headers: { "User-Agent": USER_AGENT }, cache: "no-store" }
    );
    if (tagsRes.ok) {
      const tagData = (await tagsRes.json()) as { results?: { name: string }[] };
      tags = (tagData.results ?? []).map((t) => t.name);
    }
  } catch {
    // optional
  }

  const readme = [
    `# Docker image: ${fullName}`,
    "",
    description ?? "",
    "",
    `Pull: docker pull ${fullName}`,
    tags.length ? `Recent tags: ${tags.join(", ")}` : "",
    "",
    "Note: Sandbox simulates docker pull — no container is run without E2B + explicit docker support.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    metadata: {
      name,
      fullName,
      description,
      owner: namespace,
      stars,
      language: "Docker",
      license: null,
      lastCommit: typeof data.last_updated === "string" ? data.last_updated : null,
      readme,
      openIssues: 0,
      defaultBranch: tags[0] ?? "latest",
      topics: ["docker", "container"],
      homepage: `https://hub.docker.com/r/${fullName}`,
      cloneUrl: "",
      sourceKind: "docker",
    },
    techStack: ["Docker", pulls > 1_000_000 ? "Popular" : "Container"].filter(Boolean),
    raw: { ...data, recentTags: tags, pullCount: pulls },
  };
}
