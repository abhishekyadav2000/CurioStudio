import type { ImportResult } from "./types";

const USER_AGENT = "CurioStudio/1.0";

function encodeGitLabPath(path: string): string {
  return encodeURIComponent(path).replace(/%2F/g, "%2F");
}

export async function importGitLabRepo(
  ownerPath: string,
  repo: string,
  rawUrl: string
): Promise<ImportResult> {
  const fullPath = ownerPath.includes("/") ? `${ownerPath}/${repo}` : `${ownerPath}/${repo}`;
  const projectPath = encodeGitLabPath(fullPath);

  const res = await fetch(`https://gitlab.com/api/v4/projects/${projectPath}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`GitLab API ${res.status}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  let readme: string | null = null;

  try {
    const readmeRes = await fetch(
      `https://gitlab.com/api/v4/projects/${projectPath}/repository/files/README.md/raw?ref=${data.default_branch ?? "main"}`,
      { headers: { "User-Agent": USER_AGENT }, cache: "no-store" }
    );
    if (readmeRes.ok) readme = await readmeRes.text();
  } catch {
    // optional
  }

  const topics = Array.isArray(data.topics) ? (data.topics as string[]) : [];
  const techStack = detectTechStack(readme, typeof data.default_branch === "string" ? null : null);
  if (typeof data.topics === "object" && Array.isArray(data.topics)) {
    for (const t of data.topics as string[]) techStack.push(t);
  }

  return {
    metadata: {
      name: String(data.name ?? repo),
      fullName: String(data.path_with_namespace ?? fullPath),
      description: typeof data.description === "string" ? data.description : null,
      owner: ownerPath,
      stars: typeof data.star_count === "number" ? data.star_count : 0,
      language: topics[0] ?? null,
      license: null,
      lastCommit: typeof data.last_activity_at === "string" ? data.last_activity_at : null,
      readme,
      openIssues: typeof data.open_issues_count === "number" ? data.open_issues_count : 0,
      defaultBranch: String(data.default_branch ?? "main"),
      topics,
      homepage: typeof data.web_url === "string" ? data.web_url : rawUrl,
      cloneUrl: typeof data.http_url_to_repo === "string" ? data.http_url_to_repo : "",
      sourceKind: "gitlab",
    },
    techStack: Array.from(new Set(techStack)),
    raw: data,
  };
}

function detectTechStack(readme: string | null, _primary: string | null): string[] {
  const stack = new Set<string>();
  const text = (readme ?? "").toLowerCase();
  const indicators: [RegExp, string][] = [
    [/docker/, "Docker"],
    [/python/, "Python"],
    [/node\.?js|npm/, "Node.js"],
    [/react/, "React"],
    [/kubernetes|k8s/, "Kubernetes"],
  ];
  for (const [pattern, label] of indicators) {
    if (pattern.test(text)) stack.add(label);
  }
  return Array.from(stack);
}
