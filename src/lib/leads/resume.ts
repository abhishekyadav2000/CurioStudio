import { generateJSON } from "@/lib/llm";
import type { JobPreferences } from "./scoring";

const SKILL_PATTERNS = [
  /\b(?:JavaScript|TypeScript|Python|Java|Go|Rust|C\+\+|Ruby|Swift|Kotlin|Scala|PHP)\b/gi,
  /\b(?:React|Vue|Angular|Next\.?js|Node\.?js|Django|Flask|FastAPI|Spring|Rails|Express)\b/gi,
  /\b(?:AWS|GCP|Azure|Kubernetes|Docker|Terraform|CI\/CD|DevOps|MLOps)\b/gi,
  /\b(?:PostgreSQL|MySQL|MongoDB|Redis|Elasticsearch|Kafka|Spark|Airflow)\b/gi,
  /\b(?:TensorFlow|PyTorch|scikit-learn|LLM|GPT|machine learning|deep learning|NLP)\b/gi,
  /\b(?:GraphQL|REST|gRPC|microservices|API design|system design)\b/gi,
];

export function extractKeywordsFromText(text: string): string[] {
  const keywords = new Set<string>();
  for (const pattern of SKILL_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      keywords.add(match[0].trim());
    }
  }

  // Title-like phrases (2-4 capitalized words)
  const titleMatches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g) ?? [];
  for (const t of titleMatches.slice(0, 10)) {
    if (/engineer|developer|manager|architect|scientist|designer/i.test(t)) {
      keywords.add(t);
    }
  }

  return [...keywords].slice(0, 40);
}

export async function extractKeywordsWithLLM(text: string): Promise<string[]> {
  const snippet = text.slice(0, 6000);
  const result = await generateJSON<{ keywords?: string[]; targetRoles?: string[] }>(
    [
      {
        role: "system",
        content:
          "Extract job-relevant skills and target roles from a resume. Return JSON with keywords (technical skills, tools, frameworks) and targetRoles (job titles the person is suited for). Max 25 keywords, max 5 roles.",
      },
      { role: "user", content: snippet },
    ],
    "script"
  );

  const keywords = result?.keywords ?? [];
  const roles = result?.targetRoles ?? [];
  return [...new Set([...keywords, ...roles])].slice(0, 30);
}

export async function parseResumeText(rawText: string): Promise<Partial<JobPreferences>> {
  const regexKeywords = extractKeywordsFromText(rawText);
  let llmKeywords: string[] = [];
  try {
    llmKeywords = await extractKeywordsWithLLM(rawText);
  } catch {
    // LLM optional
  }

  const allKeywords = [...new Set([...regexKeywords, ...llmKeywords])];

  const targetRoles: string[] = [];
  for (const kw of allKeywords) {
    if (/engineer|developer|manager|architect|scientist|designer|devrel|pm/i.test(kw)) {
      targetRoles.push(kw);
    }
  }

  return {
    keywords: allKeywords,
    targetRoles: targetRoles.slice(0, 5),
    preferencesSet: true,
  };
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import("pdf-parse")) as unknown as (buf: Buffer) => Promise<{ text: string }>;
    const data = await pdfParse(buffer);
    return data.text ?? "";
  } catch {
    // Fallback: crude text extraction from PDF binary
    const raw = buffer.toString("latin1");
    const chunks = raw.match(/\(([^)\\]{4,200})\)/g) ?? [];
    return chunks.map((c) => c.slice(1, -1)).join(" ").slice(0, 20000);
  }
}
