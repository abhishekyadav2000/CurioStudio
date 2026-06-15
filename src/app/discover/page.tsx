import { AppShell } from "@/components/app-shell";
import { DiscoverPage } from "@/components/discover-page";
import { QueueProcessor } from "@/components/queue-processor";

export default function Discover() {
  return (
    <AppShell noScroll>
      <DiscoverPage />
      <QueueProcessor />
    </AppShell>
  );
}
