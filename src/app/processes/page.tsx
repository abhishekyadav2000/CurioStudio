import { AppShell } from "@/components/app-shell";
import { ProcessesPageClient } from "@/components/processes-page";

export default function ProcessesPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  return (
    <AppShell>
      <ProcessesPageWrapper searchParams={searchParams} />
    </AppShell>
  );
}

async function ProcessesPageWrapper({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  return <ProcessesPageClient initialSlug={slug} />;
}
