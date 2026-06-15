import { AppShell } from "@/components/app-shell";
import { WorkflowsPageClient } from "@/components/workflows-page";

export default function WorkflowsPage() {
  return (
    <AppShell>
      <WorkflowsPageClient />
    </AppShell>
  );
}
