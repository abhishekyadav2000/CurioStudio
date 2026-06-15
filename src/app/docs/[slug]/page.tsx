import { AppShell } from "@/components/app-shell";
import { DocsPageClient } from "@/components/docs-page";

export default async function DocSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <AppShell>
      <DocsPageClient initialSlug={slug} />
    </AppShell>
  );
}
