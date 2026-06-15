export interface ProjectMetadata {
  name: string;
  fullName: string;
  description: string | null;
  owner: string;
  stars: number;
  language: string | null;
  license: string | null;
  lastCommit: string | null;
  readme: string | null;
  openIssues: number;
  defaultBranch: string;
  topics: string[];
  homepage: string | null;
  cloneUrl: string;
  sourceKind?: string;
}

export interface ImportResult {
  metadata: ProjectMetadata;
  techStack: string[];
  raw: Record<string, unknown>;
}

/** @deprecated Use ProjectMetadata */
export type GitHubRepoMetadata = ProjectMetadata;
