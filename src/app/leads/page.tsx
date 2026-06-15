import { AppShell } from "@/components/app-shell";
import { LeadsPageClient } from "@/components/leads-page";

export default function LeadsPage() {
  return (
    <AppShell noScroll>
      <LeadsPageClient />
    </AppShell>
  );
}
