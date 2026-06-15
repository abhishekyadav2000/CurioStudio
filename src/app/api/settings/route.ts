import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  checkOllamaHealth,
  hasOpenAI,
  hasAnthropic,
  pickBestOllamaModel,
  getConfiguredPort,
  OLLAMA_RECOMMENDATIONS,
} from "@/lib/llm";

export async function GET() {
  let settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  if (!settings) {
    settings = await prisma.appSettings.create({ data: { id: "default" } });
  }

  const ollama = await checkOllamaHealth(settings.ollamaBaseUrl);
  const recommendedModel = ollama.models.length
    ? pickBestOllamaModel(ollama.models, "script")
    : settings.ollamaModel;

  return NextResponse.json({
    settings,
    ollama,
    recommendedModel,
    recommendations: OLLAMA_RECOMMENDATIONS,
    connectors: {
      openai: hasOpenAI(),
      anthropic: hasAnthropic(),
      e2b: Boolean(process.env.E2B_API_KEY),
      github: Boolean(process.env.GITHUB_TOKEN),
      youtubeOAuth: Boolean(process.env.GOOGLE_CLIENT_ID),
    },
    health: {
      port: getConfiguredPort(),
    },
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();

  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...body },
    update: body,
  });

  const ollama = await checkOllamaHealth(settings.ollamaBaseUrl);
  const recommendedModel = ollama.models.length
    ? pickBestOllamaModel(ollama.models, "script")
    : settings.ollamaModel;

  return NextResponse.json({
    settings,
    ollama,
    recommendedModel,
    recommendations: OLLAMA_RECOMMENDATIONS,
    connectors: {
      openai: hasOpenAI(),
      anthropic: hasAnthropic(),
      e2b: Boolean(process.env.E2B_API_KEY),
      github: Boolean(process.env.GITHUB_TOKEN),
      youtubeOAuth: Boolean(process.env.GOOGLE_CLIENT_ID),
    },
  });
}
