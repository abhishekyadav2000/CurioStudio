import type { ImportResult } from "./types";

export type { ProjectMetadata, ImportResult, GitHubRepoMetadata } from "./types";

async function githubFetch(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "CurioStudio",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return fetch(`https://api.github.com${path}`, { headers, next: { revalidate: 300 } });
}

export async function importGitHubRepo(owner: string, repo: string): Promise<ImportResult> {
  const [repoRes, readmeRes] = await Promise.all([
    githubFetch(`/repos/${owner}/${repo}`),
    githubFetch(`/repos/${owner}/${repo}/readme`),
  ]);

  if (!repoRes.ok) {
    const err = await repoRes.text();
    throw new Error(`GitHub API error (${repoRes.status}): ${err}`);
  }

  const data = await repoRes.json();
  let readme: string | null = null;
  if (readmeRes.ok) {
    const readmeData = await readmeRes.json();
    readme = Buffer.from(readmeData.content, "base64").toString("utf-8");
  }

  const techStack = detectTechStack(readme, data.language);

  return {
    metadata: {
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      owner: data.owner?.login ?? owner,
      stars: data.stargazers_count ?? 0,
      language: data.language,
      license: data.license?.spdx_id ?? null,
      lastCommit: data.pushed_at ?? null,
      readme,
      openIssues: data.open_issues_count ?? 0,
      defaultBranch: data.default_branch ?? "main",
      topics: data.topics ?? [],
      homepage: data.homepage || null,
      cloneUrl: data.clone_url,
    },
    techStack,
    raw: data,
  };
}

function detectTechStack(readme: string | null, primaryLanguage: string | null): string[] {
  const stack = new Set<string>();
  if (primaryLanguage) stack.add(primaryLanguage);

  const text = (readme ?? "").toLowerCase();
  const indicators: [RegExp, string][] = [
    [/next\.?js|nextjs/, "Next.js"],
    [/react/, "React"],
    [/vue\.?js/, "Vue.js"],
    [/svelte/, "Svelte"],
    [/python|pip install|requirements\.txt/, "Python"],
    [/node\.?js|npm install|yarn/, "Node.js"],
    [/docker/, "Docker"],
    [/kubernetes|k8s/, "Kubernetes"],
    [/rust|cargo/, "Rust"],
    [/go\b|golang/, "Go"],
    [/fastapi/, "FastAPI"],
    [/django/, "Django"],
    [/flask/, "Flask"],
    [/pytorch|torch/, "PyTorch"],
    [/tensorflow/, "TensorFlow"],
    [/hugging\s*face|transformers/, "Hugging Face"],
    [/gradio/, "Gradio"],
    [/langchain/, "LangChain"],
    [/supabase/, "Supabase"],
    [/postgres/, "PostgreSQL"],
    [/mongodb/, "MongoDB"],
    [/redis/, "Redis"],
    [/tailwind/, "Tailwind CSS"],
    [/typescript/, "TypeScript"],
  ];

  for (const [pattern, label] of indicators) {
    if (pattern.test(text)) stack.add(label);
  }
  return Array.from(stack);
}

