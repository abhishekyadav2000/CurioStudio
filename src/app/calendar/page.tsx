import { AppShell } from "@/components/app-shell";
import { CalendarPageClient } from "@/components/calendar-page";
import { QueueProcessor } from "@/components/queue-processor";

export default function CalendarPage() {
  return (
    <AppShell>
      <CalendarPageClient />
      <QueueProcessor />
    </AppShell>
  );
}
