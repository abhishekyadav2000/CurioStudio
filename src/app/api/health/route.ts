import { NextResponse } from "next/server";
import { checkOllamaHealth, checkDatabaseHealth, getConfiguredPort, getLLMConfig } from "@/lib/llm";
import { ensureSeeded } from "@/lib/seed";
import { syncNotifications } from "@/lib/system/notifications";
import { prisma } from "@/lib/db";

export async function GET() {
  await ensureSeeded();
  const port = getConfiguredPort();
  const config = await getLLMConfig();
  const [ollama, db, settings] = await Promise.all([
    checkOllamaHealth(config.ollamaBaseUrl),
    checkDatabaseHealth(),
    prisma.appSettings.findUnique({ where: { id: "default" } }),
  ]);

  syncNotifications().catch(() => {});

  const ok = db.ok;
  const cwd = process.cwd();

  return NextResponse.json({
    ok,
    port,
    ollama: {
      online: ollama.online,
      models: ollama.models,
      error: ollama.error,
      baseUrl: config.ollamaBaseUrl,
      model: config.ollamaModel,
    },
    db,
    providers: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      e2b: Boolean(process.env.E2B_API_KEY),
      github: Boolean(process.env.GITHUB_TOKEN),
    },
    watchdog: {
      enabled: settings?.healthWatchdog ?? true,
      restartHint: "Run: cd ~/CurioStudio && npm run restart",
      folderHasTrailingSpace: cwd !== cwd.trimEnd(),
      recommendedFolder: "~/CurioStudio",
    },
    timestamp: new Date().toISOString(),
  });
}
