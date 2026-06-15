import { AppShell } from "@/components/app-shell";
import { DashboardSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <AppShell>
      <DashboardSkeleton />
    </AppShell>
  );
}
