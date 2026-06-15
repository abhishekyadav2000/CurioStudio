import { NextRequest, NextResponse } from "next/server";
import { getJobPreferences, saveJobPreferences, rescoreAllOpenLeads } from "@/lib/leads";
import { extractTextFromPdf, parseResumeText } from "@/lib/leads/resume";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    const textField = formData.get("text");
    if (typeof textField === "string" && textField.trim().length > 50) {
      const extracted = await parseResumeText(textField.trim());
      const current = await getJobPreferences();
      const merged = {
        ...current,
        keywords: [...new Set([...current.keywords, ...(extracted.keywords ?? [])])],
        targetRoles: [...new Set([...current.targetRoles, ...(extracted.targetRoles ?? [])])],
        preferencesSet: true,
      };
      await saveJobPreferences(merged);
      await rescoreAllOpenLeads(merged);
      return NextResponse.json({ ok: true, preferences: merged, extractedKeywords: extracted.keywords });
    }
    return NextResponse.json({ error: "Upload a .txt or .pdf resume, or paste text" }, { status: 400 });
  }

  const name = file instanceof File ? file.name : "resume";
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = name.toLowerCase().split(".").pop();

  let text = "";
  if (ext === "pdf") {
    text = await extractTextFromPdf(buffer);
  } else if (ext === "txt" || ext === "text") {
    text = buffer.toString("utf-8");
  } else {
    return NextResponse.json({ error: "Only .txt and .pdf files are supported" }, { status: 400 });
  }

  if (text.trim().length < 50) {
    return NextResponse.json({ error: "Could not extract enough text from resume" }, { status: 400 });
  }

  const extracted = await parseResumeText(text);
  const current = await getJobPreferences();
  const merged = {
    ...current,
    keywords: [...new Set([...current.keywords, ...(extracted.keywords ?? [])])],
    targetRoles: [...new Set([...current.targetRoles, ...(extracted.targetRoles ?? [])])],
    preferencesSet: true,
  };
  await saveJobPreferences(merged);
  await rescoreAllOpenLeads(merged);

  return NextResponse.json({
    ok: true,
    preferences: merged,
    extractedKeywords: extracted.keywords,
    extractedRoles: extracted.targetRoles,
  });
}
