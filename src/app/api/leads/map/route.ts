import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const companies = await prisma.company.findMany({
    where: {
      OR: [
        { jobLeads: { some: { status: { in: ["NEW", "RESEARCHING", "READY_OUTREACH"] } } } },
        { contacts: { some: {} } },
      ],
    },
    include: {
      jobLeads: {
        where: {
          status: { in: ["NEW", "RESEARCHING", "READY_OUTREACH"] },
          OR: [{ isAlive: null }, { isAlive: true }],
        },
        orderBy: { relevanceScore: "desc" },
        take: 10,
      },
      contacts: {
        orderBy: { confidence: "asc" },
        take: 15,
      },
    },
    take: 30,
  });

  const nodes: {
    id: string;
    type: "company" | "role" | "contact" | "manager";
    label: string;
    data: Record<string, unknown>;
  }[] = [];
  const edges: { id: string; source: string; target: string }[] = [];

  for (const co of companies) {
    const companyNodeId = `company-${co.id}`;
    nodes.push({
      id: companyNodeId,
      type: "company",
      label: co.name,
      data: { companyId: co.id, website: co.website, careersUrl: co.careersUrl },
    });

    for (const lead of co.jobLeads) {
      const roleNodeId = `role-${lead.id}`;
      nodes.push({
        id: roleNodeId,
        type: "role",
        label: lead.title,
        data: {
          leadId: lead.id,
          relevanceScore: lead.relevanceScore,
          isAlive: lead.isAlive,
          verifiedAt: lead.verifiedAt,
          url: lead.url,
        },
      });
      edges.push({ id: `e-${companyNodeId}-${roleNodeId}`, source: companyNodeId, target: roleNodeId });
    }

    const contactById = new Map(co.contacts.map((c) => [c.id, c]));
    for (const contact of co.contacts) {
      const contactNodeId = `contact-${contact.id}`;
      const isManager = /manager|director|head|vp|cto|recruit|talent/i.test(contact.title ?? "");
      nodes.push({
        id: contactNodeId,
        type: isManager ? "manager" : "contact",
        label: contact.name,
        data: {
          contactId: contact.id,
          title: contact.title,
          email: contact.email,
          confidence: contact.confidence,
          reportsToId: contact.reportsToId,
        },
      });
      edges.push({ id: `e-${companyNodeId}-${contactNodeId}`, source: companyNodeId, target: contactNodeId });

      if (contact.reportsToId && contactById.has(contact.reportsToId)) {
        edges.push({
          id: `e-${contactNodeId}-mgr-${contact.reportsToId}`,
          source: contactNodeId,
          target: `contact-${contact.reportsToId}`,
        });
      }
    }
  }

  return NextResponse.json({ nodes, edges });
}
