import { AppShell } from "@/components/app-shell";
import { LeadsPageClient } from "@/components/leads-page";

export default function LeadsRoadmapPage() {
  return (
    <AppShell noScroll>
      <LeadsPageClient initialTab="roadmap" />
    </AppShell>
  );
}
