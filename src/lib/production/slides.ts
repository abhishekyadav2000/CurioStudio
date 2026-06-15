import type { PresentationSlide } from "@/lib/content";

export function slidesToMarkdown(slides: PresentationSlide[]): string {
  return slides
    .map(
      (s, i) =>
        `## Slide ${i + 1}: ${s.title}\n\n${s.body}\n\n> Speaker notes: ${s.speakerNotes}\n\n---\n`
    )
    .join("\n");
}
