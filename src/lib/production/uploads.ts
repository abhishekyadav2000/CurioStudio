import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export interface ScreenshotRecord {
  id: string;
  path: string;
  filename: string;
  uploadedAt: string;
}

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

export function getProjectUploadDir(projectId: string): string {
  return path.join(UPLOADS_ROOT, projectId);
}

export async function saveScreenshot(
  projectId: string,
  file: File
): Promise<ScreenshotRecord> {
  const dir = getProjectUploadDir(projectId);
  await mkdir(dir, { recursive: true });

  const ext = path.extname(file.name) || ".png";
  const id = randomUUID();
  const filename = `${id}${ext}`;
  const fullPath = path.join(dir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);

  return {
    id,
    path: `/uploads/${projectId}/${filename}`,
    filename: file.name,
    uploadedAt: new Date().toISOString(),
  };
}

export function parseScreenshots(json: string | null | undefined): ScreenshotRecord[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as ScreenshotRecord[];
  } catch {
    return [];
  }
}

export function getScreenshotAbsolutePath(relativePath: string): string {
  // relativePath is like /uploads/projectId/file.png
  const parts = relativePath.replace(/^\//, "").split("/");
  return path.join(process.cwd(), ...parts);
}
