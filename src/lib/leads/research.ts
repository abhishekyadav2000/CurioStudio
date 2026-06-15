import { prisma } from "@/lib/db";
import { generateText } from "@/lib/llm";
import { enrichCompany } from "./enrich";
import { findContacts, parseJobRequirements } from "./contacts";
import { fetchPage, stripHtml } from "./scrape";

export interface ResearchResult {
  jobLeadId: string;
  summary: string;
  requirements: string[];
  contactsFound: number;
}

export async function researchLead(jobLeadId: string): Promise<ResearchResult> {
  const lead = await prisma.jobLead.findUnique({
    where: { id: jobLeadId },
    include: { company: true },
  });
  if (!lead) throw new Error("Job lead not found");

  await prisma.jobLead.update({
    where: { id: jobLeadId },
    data: { status: "RESEARCHING" },
  });

  let description = lead.description ?? "";
  if (description.length < 100 && lead.url) {
    const pageHtml = await fetchPage(lead.url);
    if (pageHtml) {
      description = stripHtml(pageHtml).slice(0, 8000);
    }
  }

  const requirements = parseJobRequirements(description);

  let companyId = lead.companyId;
  if (!companyId && lead.companyName) {
    const co = await prisma.company.upsert({
      where: { name: lead.companyName },
      create: { name: lead.companyName },
      update: {},
    });
    companyId = co.id;
    await prisma.jobLead.update({ where: { id: jobLeadId }, data: { companyId } });
  }

  let contactsFound = 0;
  if (companyId) {
    try {
      await enrichCompany(companyId);
    } catch {
      // enrichment is best-effort
    }
    const contactResult = await findContacts(companyId);
    contactsFound = contactResult.total;
  }

  const company = companyId
    ? await prisma.company.findUnique({
        where: { id: companyId },
        include: { intel: { take: 5, orderBy: { capturedAt: "desc" } } },
      })
    : null;

  const intelContext = company?.intel
    .map((i) => `- ${i.type}: ${i.title}${i.summary ? ` — ${i.summary.slice(0, 120)}` : ""}`)
    .join("\n");

  const techStack = company?.techStack ? JSON.parse(company.techStack) as string[] : [];

  const prompt = `Analyze this job opening for outreach intelligence.

Company: ${lead.companyName ?? company?.name ?? "Unknown"}
Role: ${lead.title}
Location: ${lead.location ?? "Not specified"}${lead.remote ? " (Remote)" : ""}
Source: ${lead.source}

Job description:
${description.slice(0, 4000)}

${company?.description ? `Company context: ${company.description.slice(0, 500)}` : ""}
${techStack.length ? `Tech stack signals: ${techStack.join(", ")}` : ""}
${intelContext ? `Recent intel:\n${intelContext}` : ""}

Write a concise research brief covering:
1. What they want (core requirements and priorities)
2. Tech patterns and stack signals
3. Suggested outreach angle for a technical content creator / developer

Keep it under 400 words, professional tone.`;

  const llmSummary =
    (await generateText(
      [
        {
          role: "system",
          content: "You are a BD research analyst helping a technical creator identify high-quality job leads and craft outreach.",
        },
        { role: "user", content: prompt },
      ],
      "refine"
    )) ??
    `Role: ${lead.title} at ${lead.companyName ?? "unknown company"}.\n\nKey requirements:\n${requirements.slice(0, 5).map((r) => `- ${r}`).join("\n") || "- Review full job description for requirements"}\n\nOutreach angle: Reference relevant technical content experience aligned with their stack and hiring needs.`;

  await prisma.jobLead.update({
    where: { id: jobLeadId },
    data: {
      description: description || lead.description,
      requirements: JSON.stringify(requirements),
      researchSummary: llmSummary,
      enrichedAt: new Date(),
      status: "READY_OUTREACH",
    },
  });

  return {
    jobLeadId,
    summary: llmSummary,
    requirements,
    contactsFound,
  };
}
