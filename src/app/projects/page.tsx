import { AppShell } from "@/components/app-shell";
import { ProjectsPageClient } from "@/components/projects-page";
import { QueueProcessor } from "@/components/queue-processor";

export default function ProjectsPage() {
  return (
    <AppShell noScroll>
      <ProjectsPageClient />
      <QueueProcessor />
    </AppShell>
  );
}
