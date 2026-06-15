import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function GET(request: NextRequest) {
  await ensureSeeded();
  const projectId = request.nextUrl.searchParams.get("projectId");

  const templates = await prisma.workflowTemplate.findMany({ orderBy: { createdAt: "asc" } });

  if (projectId) {
    const pw = await prisma.projectWorkflow.findUnique({
      where: { projectId },
      include: { template: true, project: { select: { id: true, name: true, status: true } } },
    });
    return NextResponse.json({ templates, projectWorkflow: pw });
  }

  const projectWorkflows = await prisma.projectWorkflow.findMany({
    include: {
      project: { select: { id: true, name: true, status: true } },
      template: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ templates, projectWorkflows });
}

export async function POST(request: NextRequest) {
  await ensureSeeded();
  const body = await request.json();
  const { action } = body;

  if (action === "create-template") {
    const { name, description, steps, isDefault } = body;
    const template = await prisma.workflowTemplate.create({
      data: {
        name,
        description,
        steps: typeof steps === "string" ? steps : JSON.stringify(steps),
        isDefault: isDefault ?? false,
      },
    });
    return NextResponse.json({ template });
  }

  if (action === "assign") {
    const { projectId, templateId } = body;
    const template = await prisma.workflowTemplate.findUnique({ where: { id: templateId } });
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const pw = await prisma.projectWorkflow.upsert({
      where: { projectId },
      create: {
        projectId,
        templateId,
        currentStep: 0,
        stepProgress: "{}",
      },
      update: { templateId, currentStep: 0, stepProgress: "{}" },
      include: { template: true },
    });
    return NextResponse.json({ projectWorkflow: pw });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, currentStep, stepProgress, name, description, steps } = body;

  if (id && (name || description || steps !== undefined)) {
    const template = await prisma.workflowTemplate.update({
      where: { id },
      data: {
        name,
        description,
        steps: steps !== undefined ? (typeof steps === "string" ? steps : JSON.stringify(steps)) : undefined,
      },
    });
    return NextResponse.json({ template });
  }

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const pw = await prisma.projectWorkflow.update({
    where: { id },
    data: {
      currentStep,
      stepProgress: stepProgress !== undefined ? (typeof stepProgress === "string" ? stepProgress : JSON.stringify(stepProgress)) : undefined,
    },
    include: { template: true, project: true },
  });
  return NextResponse.json({ projectWorkflow: pw });
}
