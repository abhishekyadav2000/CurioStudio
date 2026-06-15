import { prisma } from "@/lib/db";
import { generateText } from "@/lib/llm";
import type { OutreachBatchStatus } from "@prisma/client";

export interface OutreachBatchItem {
  contactId?: string;
  leadId?: string;
  contactName?: string;
  contactEmail?: string;
  contactTitle?: string;
  companyName?: string;
  roleTitle?: string;
  talkingPoints: string[];
}

export interface OutreachBatchView {
  id: string;
  name: string;
  status: OutreachBatchStatus;
  scheduledFor: Date | null;
  meetingDate: Date | null;
  meetingAttendees: string[];
  notes: string | null;
  projectId: string | null;
  items: OutreachBatchItem[];
  createdAt: Date;
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

async function generateTalkingPoints(
  companyName: string,
  roleTitle: string,
  research?: string | null
): Promise<string[]> {
  const prompt = `Generate 4 concise talking points for outreach about the ${roleTitle} role at ${companyName}.
Context: ${(research ?? "").slice(0, 1500)}
Return ONLY a JSON array of 4 short strings (each under 20 words).`;

  const generated = await generateText(
    [
      { role: "system", content: "You help technical professionals prepare for outreach meetings." },
      { role: "user", content: prompt },
    ],
    "refine"
  );

  if (generated) {
    try {
      const parsed = JSON.parse(generated) as string[];
      if (Array.isArray(parsed) && parsed.length) return parsed.slice(0, 6).map(String);
    } catch {
      // fall through
    }
  }

  return [
    `Interest in ${roleTitle} and how your content aligns with ${companyName}'s technical audience`,
    `Recent work covering tools and practices relevant to their stack`,
    `Questions about team priorities and what success looks like in the first 90 days`,
    `Offer to share a relevant demo or content piece tailored to their product`,
  ];
}

export async function buildBatchItems(
  contactIds: string[],
  leadIds: string[]
): Promise<OutreachBatchItem[]> {
  const items: OutreachBatchItem[] = [];
  const seen = new Set<string>();

  for (const leadId of leadIds) {
    const lead = await prisma.jobLead.findUnique({
      where: { id: leadId },
      include: { company: true },
    });
    if (!lead) continue;

    const talkingPoints = await generateTalkingPoints(
      lead.companyName ?? lead.company?.name ?? "the company",
      lead.title,
      lead.researchSummary ?? lead.description
    );

    const key = `lead:${leadId}`;
    if (!seen.has(key)) {
      seen.add(key);
      items.push({
        leadId,
        companyName: lead.companyName ?? lead.company?.name ?? undefined,
        roleTitle: lead.title,
        talkingPoints,
      });
    }
  }

  for (const contactId of contactIds) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { company: true },
    });
    if (!contact) continue;

    const lead = await prisma.jobLead.findFirst({
      where: { companyId: contact.companyId, status: { not: "ARCHIVED" } },
      orderBy: { relevanceScore: "desc" },
    });

    const talkingPoints = await generateTalkingPoints(
      contact.company.name,
      lead?.title ?? "open roles",
      lead?.researchSummary ?? lead?.description
    );

    const key = `contact:${contactId}`;
    if (!seen.has(key)) {
      seen.add(key);
      items.push({
        contactId,
        leadId: lead?.id,
        contactName: contact.name,
        contactEmail: contact.email ?? undefined,
        contactTitle: contact.title ?? undefined,
        companyName: contact.company.name,
        roleTitle: lead?.title,
        talkingPoints,
      });
    }
  }

  return items;
}

export async function createOutreachBatch(params: {
  name: string;
  contactIds: string[];
  leadIds: string[];
  scheduledFor?: Date;
  meetingDate?: Date;
  meetingAttendees?: string[];
  notes?: string;
}): Promise<OutreachBatchView> {
  const items = await buildBatchItems(params.contactIds, params.leadIds);
  const talkingPoints = items.flatMap((i) => i.talkingPoints);

  const batch = await prisma.outreachBatch.create({
    data: {
      name: params.name,
      targetContactIds: JSON.stringify(params.contactIds),
      targetLeadIds: JSON.stringify(params.leadIds),
      scheduledFor: params.scheduledFor,
      meetingDate: params.meetingDate,
      meetingAttendees: params.meetingAttendees ? JSON.stringify(params.meetingAttendees) : null,
      notes: params.notes,
      talkingPoints: JSON.stringify(talkingPoints),
      status: "DRAFT",
    },
  });

  return hydrateBatch(batch, items);
}

async function hydrateBatch(
  batch: {
    id: string;
    name: string;
    status: OutreachBatchStatus;
    scheduledFor: Date | null;
    meetingDate: Date | null;
    meetingAttendees: string | null;
    notes: string | null;
    projectId: string | null;
    targetContactIds: string;
    targetLeadIds: string;
    createdAt: Date;
  },
  items?: OutreachBatchItem[]
): Promise<OutreachBatchView> {
  const contactIds = parseJsonArray(batch.targetContactIds);
  const leadIds = parseJsonArray(batch.targetLeadIds);
  const resolvedItems = items ?? (await buildBatchItems(contactIds, leadIds));

  return {
    id: batch.id,
    name: batch.name,
    status: batch.status,
    scheduledFor: batch.scheduledFor,
    meetingDate: batch.meetingDate,
    meetingAttendees: parseJsonArray(batch.meetingAttendees),
    notes: batch.notes,
    projectId: batch.projectId,
    items: resolvedItems,
    createdAt: batch.createdAt,
  };
}

export async function listOutreachBatches(): Promise<OutreachBatchView[]> {
  const batches = await prisma.outreachBatch.findMany({ orderBy: { createdAt: "desc" } });
  return Promise.all(batches.map((b) => hydrateBatch(b)));
}

export async function getOutreachBatch(id: string): Promise<OutreachBatchView | null> {
  const batch = await prisma.outreachBatch.findUnique({ where: { id } });
  if (!batch) return null;
  return hydrateBatch(batch);
}

export async function linkBatchToProject(batchId: string, projectId: string): Promise<OutreachBatchView> {
  const batch = await prisma.outreachBatch.update({
    where: { id: batchId },
    data: { projectId, status: "IN_PROGRESS" },
  });
  return hydrateBatch(batch);
}

export async function updateOutreachBatch(
  id: string,
  data: Partial<{
    name: string;
    status: OutreachBatchStatus;
    scheduledFor: Date | null;
    meetingDate: Date | null;
    meetingAttendees: string[];
    notes: string;
    projectId: string;
  }>
): Promise<OutreachBatchView> {
  const batch = await prisma.outreachBatch.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.scheduledFor !== undefined ? { scheduledFor: data.scheduledFor } : {}),
      ...(data.meetingDate !== undefined ? { meetingDate: data.meetingDate } : {}),
      ...(data.meetingAttendees !== undefined
        ? { meetingAttendees: JSON.stringify(data.meetingAttendees) }
        : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
    },
  });
  return hydrateBatch(batch);
}

/** Create a Studio project prefilled with outreach angle. */
export async function createContentProjectForBatch(batchId: string): Promise<{ projectId: string; batch: OutreachBatchView }> {
  const batch = await getOutreachBatch(batchId);
  if (!batch) throw new Error("Batch not found");

  const firstItem = batch.items[0];
  const title = firstItem?.roleTitle
    ? `Outreach: ${firstItem.roleTitle} @ ${firstItem.companyName ?? "Target"}`
    : batch.name;

  const description = [
    `Outreach batch: ${batch.name}`,
    firstItem?.companyName ? `Company: ${firstItem.companyName}` : "",
    firstItem?.roleTitle ? `Role: ${firstItem.roleTitle}` : "",
    "",
    "Talking points:",
    ...batch.items.flatMap((i) => i.talkingPoints).slice(0, 8).map((t) => `• ${t}`),
  ]
    .filter(Boolean)
    .join("\n");

  const project = await prisma.project.create({
    data: {
      url: `outreach://${batchId}`,
      source: "OTHER",
      status: "FOUND",
      name: title,
      description,
      tags: JSON.stringify(["outreach", "insider-tracker"]),
    },
  });

  const updated = await updateOutreachBatch(batchId, { projectId: project.id, status: "IN_PROGRESS" });
  return { projectId: project.id, batch: updated };
}
