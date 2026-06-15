import { ProjectSource } from "@prisma/client";

export interface ParsedUrl {
  source: ProjectSource;
  owner?: string;
  repo?: string;
  fullName?: string;
  rawUrl: string;
}

const PATTERNS: { source: ProjectSource; regex: RegExp; parse: (m: RegExpMatchArray) => Partial<ParsedUrl> }[] = [
  {
    source: "GITHUB",
    regex: /github\.com\/([^/]+)\/([^/?#]+)/i,
    parse: (m) => ({ owner: m[1], repo: m[2].replace(/\.git$/, ""), fullName: `${m[1]}/${m[2].replace(/\.git$/, "")}` }),
  },
  {
    source: "GITLAB",
    regex: /gitlab\.com\/([^/]+(?:\/[^/]+)*)\/([^/?#]+)/i,
    parse: (m) => ({ owner: m[1], repo: m[2].replace(/\.git$/, ""), fullName: `${m[1]}/${m[2].replace(/\.git$/, "")}` }),
  },
  {
    source: "BITBUCKET",
    regex: /bitbucket\.org\/([^/]+)\/([^/?#]+)/i,
    parse: (m) => ({ owner: m[1], repo: m[2].replace(/\.git$/, ""), fullName: `${m[1]}/${m[2].replace(/\.git$/, "")}` }),
  },
  {
    source: "HUGGINGFACE",
    regex: /huggingface\.co\/(spaces|models|datasets)\/([^/]+)\/([^/?#]+)/i,
    parse: (m) => ({ owner: m[2], repo: m[3], fullName: `${m[1]}/${m[2]}/${m[3]}` }),
  },
  {
    source: "KAGGLE",
    regex: /kaggle\.com\/(code|datasets)\/([^/]+)\/([^/?#]+)/i,
    parse: (m) => ({ owner: m[2], repo: m[3], fullName: `${m[1]}/${m[2]}/${m[3]}` }),
  },
  {
    source: "DOCKER_HUB",
    regex: /hub\.docker\.com\/r\/([^/]+)\/([^/?#]+)/i,
    parse: (m) => ({ owner: m[1], repo: m[2], fullName: `${m[1]}/${m[2]}` }),
  },
];

export function detectSource(url: string): ParsedUrl {
  const trimmed = url.trim();
  for (const { source, regex, parse } of PATTERNS) {
    const match = trimmed.match(regex);
    if (match) {
      return { source, rawUrl: trimmed, ...parse(match) };
    }
  }
  // Docker image shorthand: owner/repo
  if (/^[\w.-]+\/[\w.-]+(?::[\w.-]+)?$/.test(trimmed) && !trimmed.includes("://")) {
    const [owner, repo] = trimmed.split(/[:/]/);
    return { source: "DOCKER_HUB", owner, repo, fullName: trimmed, rawUrl: trimmed };
  }
  return { source: "OTHER", rawUrl: trimmed };
}

export function isSupportedMvp(parsed: ParsedUrl): boolean {
  return ["GITHUB", "GITLAB", "HUGGINGFACE", "DOCKER_HUB", "KAGGLE"].includes(parsed.source);
}

export function sourceLabel(source: ProjectSource): string {
  const labels: Record<ProjectSource, string> = {
    GITHUB: "GitHub",
    GITLAB: "GitLab",
    BITBUCKET: "Bitbucket",
    DOCKER_HUB: "Docker Hub",
    KAGGLE: "Kaggle",
    HUGGINGFACE: "Hugging Face",
    PAPERS_WITH_CODE: "Papers with Code",
    OTHER: "Other",
  };
  return labels[source];
}
