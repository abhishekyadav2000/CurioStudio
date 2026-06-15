import { NextRequest, NextResponse } from "next/server";
import {
  fetchResearchProject,
  getResearchDocumentMarkdown,
  researchExportFilename,
} from "@/lib/research-document";
import { generateResearchPdf } from "@/lib/research-document/pdf";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  const project = await fetchResearchProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const result = await getResearchDocumentMarkdown(id, { refresh });
  if (!result) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const pdf = await generateResearchPdf(result.project, result.markdown);
  const filename = researchExportFilename(result.project, "pdf");

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": refresh ? "no-store" : "private, max-age=3600",
    },
  });
}
