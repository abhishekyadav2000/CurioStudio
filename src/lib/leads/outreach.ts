import { prisma } from "@/lib/db";
import { generateText } from "@/lib/llm";

export interface OutreachDraftResult {
  id: string;
  subject: string;
  body: string;
}

export async function generateOutreachDraft(params: {
  jobLeadId?: string;
  contactId?: string;
}): Promise<OutreachDraftResult> {
  const { jobLeadId, contactId } = params;
  if (!jobLeadId && !contactId) throw new Error("jobLeadId or contactId required");

  let lead = jobLeadId
    ? await prisma.jobLead.findUnique({
        where: { id: jobLeadId },
        include: { company: { include: { contacts: { take: 5 } } } },
      })
    : null;

  const contact = contactId
    ? await prisma.contact.findUnique({ where: { id: contactId }, include: { company: true } })
    : lead?.company?.contacts[0]
      ? await prisma.contact.findUnique({
          where: { id: lead.company.contacts[0].id },
          include: { company: true },
        })
      : null;

  if (!lead && contact) {
    lead = await prisma.jobLead.findFirst({
      where: { companyId: contact.companyId, status: { in: ["NEW", "RESEARCHING", "READY_OUTREACH"] } },
      orderBy: { capturedAt: "desc" },
      include: { company: { include: { contacts: { take: 5 } } } },
    });
  }

  const companyName =
    lead?.companyName ?? lead?.company?.name ?? contact?.company?.name ?? "the team";
  const role = lead?.title ?? "an open role";
  const research = lead?.researchSummary ?? lead?.description?.slice(0, 1500) ?? "";

  const prompt = `Write a professional outreach email for a technical content creator applying to or networking about a role.

Company: ${companyName}
Role: ${role}
${contact ? `Contact: ${contact.name}${contact.title ? ` (${contact.title})` : ""}` : ""}

Research brief:
${research.slice(0, 2000)}

Return ONLY valid JSON with keys "subject" and "body".
The email should be concise (under 200 words), specific to the role, and mention relevant technical content / OSS expertise without being generic.`;

  const generated = await generateText(
    [
      { role: "system", content: "You write concise, high-converting BD outreach emails for technical professionals." },
      { role: "user", content: prompt },
    ],
    "refine"
  );

  let subject = `Interest in ${role} at ${companyName}`;
  let body = generated ?? "";

  if (generated) {
    try {
      const parsed = JSON.parse(generated) as { subject?: string; body?: string };
      if (parsed.subject) subject = parsed.subject;
      if (parsed.body) body = parsed.body;
    } catch {
      body = generated;
    }
  }

  if (!body) {
    body = `Hi${contact?.name ? ` ${contact.name.split(" ")[0]}` : ""},

I came across the ${role} opening at ${companyName} and wanted to reach out directly. I create technical content focused on developer tools and open source — recently covering projects in a similar space to what you're building.

I'd love to learn more about the team's priorities and share how my background could add value.

Best regards`;
  }

  const draft = await prisma.outreachDraft.create({
    data: {
      jobLeadId: lead?.id,
      contactId: contact?.id,
      subject,
      body,
      status: "DRAFT",
    },
  });

  return { id: draft.id, subject: draft.subject, body: draft.body };
}
