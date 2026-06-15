import { prisma } from "@/lib/db";
import { generateText } from "@/lib/llm";

export interface RepurposePost {
  platform: string;
  title: string;
  body: string;
}

export async function generateRepurposePosts(projectId: string): Promise<RepurposePost[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { content: true, scorecard: true },
  });

  if (!project?.content) {
    return [
      { platform: "LinkedIn", title: "No content", body: "Generate script first in Studio." },
    ];
  }

  const c = project.content;
  const base = `
Project: ${project.name}
Hook: ${c.hook ?? ""}
Script excerpt: ${(c.script5min ?? c.script10min ?? "").slice(0, 1500)}
Description: ${c.description ?? ""}
`;

  try {
    const prompt = `From this video content, generate exactly 5 short social posts as JSON array:
[{ "platform": "LinkedIn"|"Twitter"|"Shorts"|"Newsletter"|"Blog", "title": "...", "body": "..." }]
Keep each body under 280 chars except Newsletter (2 sentences) and Blog (1 paragraph).

Content:
${base}`;

    const raw = await generateText([{ role: "user", content: prompt }], "metadata");
    const match = raw?.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]) as RepurposePost[];
      return parsed.slice(0, 5);
    }
  } catch {
    /* fallback below */
  }

  return [
    { platform: "LinkedIn", title: "Launch post", body: c.linkedinPost ?? `Reviewing ${project.name} on the channel.` },
    { platform: "Twitter", title: "Thread opener", body: (c.hook ?? project.name ?? "").slice(0, 280) },
    { platform: "Shorts", title: "Short clip", body: c.shortsScript?.slice(0, 280) ?? c.hook ?? "" },
    { platform: "Newsletter", title: "Email blurb", body: c.simpleExplanation?.slice(0, 500) ?? "" },
    { platform: "Blog", title: "Blog summary", body: c.technicalExplanation?.slice(0, 800) ?? c.description ?? "" },
  ];
}
