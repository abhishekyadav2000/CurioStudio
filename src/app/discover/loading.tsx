import { AppShell } from "@/components/app-shell";
import { DiscoverSkeleton } from "@/components/page-skeleton";

export default function DiscoverLoading() {
  return (
    <AppShell>
      <DiscoverSkeleton />
    </AppShell>
  );
}
