import { detectSource } from "./detect-source";
import type { ImportResult, ProjectMetadata } from "./types";
import { importGitHubRepo } from "./github";
import { importHuggingFace } from "./huggingface";
import { importDockerHub } from "./dockerhub";
import { importKaggle } from "./kaggle";
import { importGitLabRepo } from "./gitlab";

export type { ProjectMetadata, ImportResult, GitHubRepoMetadata } from "./types";
export { importGitHubRepo } from "./github";

export async function importProject(url: string): Promise<{
  parsed: ReturnType<typeof detectSource>;
  result: ImportResult | null;
}> {
  const parsed = detectSource(url);

  try {
    switch (parsed.source) {
      case "GITHUB":
        if (parsed.owner && parsed.repo) {
          const result = await importGitHubRepo(parsed.owner, parsed.repo);
          return { parsed, result };
        }
        break;
      case "GITLAB":
        if (parsed.owner && parsed.repo) {
          const result = await importGitLabRepo(parsed.owner, parsed.repo, parsed.rawUrl);
          return { parsed, result };
        }
        break;
      case "HUGGINGFACE":
        if (parsed.owner && parsed.repo) {
          const result = await importHuggingFace(url, parsed);
          return { parsed, result };
        }
        break;
      case "DOCKER_HUB":
        if (parsed.owner && parsed.repo) {
          const result = await importDockerHub(parsed.owner, parsed.repo);
          return { parsed, result };
        }
        break;
      case "KAGGLE":
        if (parsed.owner && parsed.repo) {
          const result = await importKaggle(url, parsed);
          return { parsed, result };
        }
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    throw new Error(`${parsed.source} import failed: ${message}`);
  }

  return { parsed, result: null };
}

export function metadataSummary(metadata: ProjectMetadata): string {
  const parts = [metadata.description ?? ""];
  if (metadata.readme) parts.push(metadata.readme.slice(0, 4000));
  return parts.filter(Boolean).join("\n\n");
}
