import type { ImportResult } from "./types";
import type { ParsedUrl } from "./detect-source";

const USER_AGENT = "CurioStudio/1.0";

export async function importHuggingFace(url: string, parsed: ParsedUrl): Promise<ImportResult> {
  const pathMatch = url.match(/huggingface\.co\/(spaces|models|datasets)\/([^/]+)\/([^/?#]+)/i);
  const kind = pathMatch?.[1] ?? "spaces";
  const owner = pathMatch?.[2] ?? parsed.owner ?? "";
  const name = pathMatch?.[3] ?? parsed.repo ?? "";
  const id = `${owner}/${name}`;

  const apiUrl = `https://huggingface.co/api/${kind}/${id}`;
  const res = await fetch(apiUrl, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`HF API ${res.status}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  let readme: string | null = null;

  try {
    const readmeRes = await fetch(`https://huggingface.co/${kind}/${id}/raw/README.md`, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
    });
    if (readmeRes.ok) readme = await readmeRes.text();
  } catch {
    // optional
  }

  const likes = typeof data.likes === "number" ? data.likes : 0;
  const sdk = typeof data.sdk === "string" ? data.sdk : null;
  const pipelineTag = typeof data.pipeline_tag === "string" ? data.pipeline_tag : null;
  const tags = Array.isArray(data.tags) ? (data.tags as string[]) : [];

  const techStack = new Set<string>(["Hugging Face"]);
  if (sdk) techStack.add(sdk);
  if (pipelineTag) techStack.add(pipelineTag);
  if (readme?.toLowerCase().includes("gradio")) techStack.add("Gradio");
  if (readme?.toLowerCase().includes("transformers")) techStack.add("Transformers");

  return {
    metadata: {
      name,
      fullName: `${kind}/${id}`,
      description: typeof data.cardData === "object" && data.cardData && "content" in (data.cardData as object)
        ? String((data.cardData as { content?: string }).content ?? "").slice(0, 500) || `${kind} on Hugging Face`
        : `${kind} on Hugging Face — ${pipelineTag ?? sdk ?? "AI demo"}`,
      owner,
      stars: likes,
      language: pipelineTag ?? sdk,
      license: tags.find((t) => t.startsWith("license:"))?.replace("license:", "") ?? null,
      lastCommit: typeof data.lastModified === "string" ? data.lastModified : null,
      readme,
      openIssues: 0,
      defaultBranch: "main",
      topics: tags.slice(0, 10),
      homepage: url,
      cloneUrl: "",
      sourceKind: kind,
    },
    techStack: Array.from(techStack),
    raw: data,
  };
}
