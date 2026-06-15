import PDFDocument from "pdfkit";
import { readFile } from "fs/promises";
import { getScreenshotAbsolutePath, parseScreenshots } from "@/lib/production/uploads";
import type { ResearchProject } from "./index";

type PDFDoc = InstanceType<typeof PDFDocument>;

const PAGE_WIDTH = 612;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function stripMarkdownInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^#+\s*/gm, "");
}

function renderMarkdownBlock(doc: PDFDoc, markdown: string): void {
  const lines = markdown.split("\n");
  let inCode = false;
  let codeBuffer: string[] = [];

  const flushCode = () => {
    if (!codeBuffer.length) return;
    doc.font("Courier").fontSize(8).fillColor("#333");
    doc.text(codeBuffer.join("\n"), { width: CONTENT_WIDTH });
    doc.fillColor("#000").font("Helvetica").fontSize(10);
    codeBuffer = [];
    doc.moveDown(0.3);
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith("```")) {
      if (inCode) {
        inCode = false;
        flushCode();
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(raw);
      continue;
    }

    if (!line.trim()) {
      doc.moveDown(0.4);
      continue;
    }

    if (line.startsWith("# ")) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(16).text(stripMarkdownInline(line.slice(2)), { width: CONTENT_WIDTH });
      doc.font("Helvetica").fontSize(10);
      doc.moveDown(0.3);
      continue;
    }

    if (line.startsWith("## ")) {
      doc.moveDown(0.4);
      doc.font("Helvetica-Bold").fontSize(13).fillColor("#1a1a1a").text(stripMarkdownInline(line.slice(3)), {
        width: CONTENT_WIDTH,
      });
      doc.font("Helvetica").fontSize(10).fillColor("#000");
      doc.moveDown(0.2);
      continue;
    }

    if (line.startsWith("### ")) {
      doc.font("Helvetica-Bold").fontSize(11).text(stripMarkdownInline(line.slice(4)), { width: CONTENT_WIDTH });
      doc.font("Helvetica").fontSize(10);
      continue;
    }

    if (line.startsWith("|")) {
      doc.font("Helvetica").fontSize(9).text(stripMarkdownInline(line.replace(/\|/g, " · ")), { width: CONTENT_WIDTH });
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      doc.font("Helvetica").fontSize(10).text(`• ${stripMarkdownInline(line.slice(2))}`, {
        width: CONTENT_WIDTH,
        indent: 12,
      });
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      doc.font("Helvetica").fontSize(10).text(stripMarkdownInline(line), { width: CONTENT_WIDTH, indent: 12 });
      continue;
    }

    if (line.startsWith("---")) {
      doc.moveDown(0.3);
      doc
        .moveTo(MARGIN, doc.y)
        .lineTo(PAGE_WIDTH - MARGIN, doc.y)
        .strokeColor("#cccccc")
        .stroke();
      doc.strokeColor("#000");
      doc.moveDown(0.3);
      continue;
    }

    if (line.startsWith("![")) {
      continue;
    }

    doc.font("Helvetica").fontSize(10).text(stripMarkdownInline(line), { width: CONTENT_WIDTH });
  }

  if (inCode && codeBuffer.length) flushCode();
}

export async function generateResearchPdf(
  project: ResearchProject,
  markdown: string
): Promise<Buffer> {
  const screenshots = parseScreenshots(project.screenshots);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: "LETTER", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(22).text(project.name ?? "Project Research", {
      align: "center",
      width: CONTENT_WIDTH,
    });
    doc.moveDown(0.5);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#555555")
      .text("CurioStudio Research Document · NotebookLM Brief", { align: "center", width: CONTENT_WIDTH });
    doc.text(new Date().toLocaleString(), { align: "center", width: CONTENT_WIDTH });
    doc.fillColor("#000000");
    doc.addPage();

    renderMarkdownBlock(doc, markdown);

    void embedScreenshots(doc, screenshots)
      .then(() => doc.end())
      .catch(reject);
  });
}

async function embedScreenshots(
  doc: PDFDoc,
  screenshots: ReturnType<typeof parseScreenshots>
): Promise<void> {
  if (!screenshots.length) return;

  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(14).text("Appendix: Screenshots", { width: CONTENT_WIDTH });
  doc.moveDown(0.5);

  for (const shot of screenshots) {
    try {
      const abs = getScreenshotAbsolutePath(shot.path);
      const img = await readFile(abs);
      if (doc.y > 650) doc.addPage();
      doc.font("Helvetica-Bold").fontSize(10).text(shot.filename, { width: CONTENT_WIDTH });
      doc.moveDown(0.2);
      doc.image(img, { fit: [CONTENT_WIDTH, 320], align: "center" });
      doc.moveDown(0.6);
    } catch {
      doc.font("Helvetica-Oblique").fontSize(9).fillColor("#666666").text(`(Missing file: ${shot.path})`);
      doc.fillColor("#000000").font("Helvetica");
      doc.moveDown(0.3);
    }
  }
}
