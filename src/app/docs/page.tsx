import { AppShell } from "@/components/app-shell";
import { DocsPageClient } from "@/components/docs-page";

export default function DocsPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  return (
    <AppShell>
      <DocsPageWrapper searchParams={searchParams} />
    </AppShell>
  );
}

async function DocsPageWrapper({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  return <DocsPageClient initialSlug={slug} />;
}
