import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { Users, ArrowLeft } from "lucide-react";

export default function LeadsPlaceholderPage() {
  return (
    <AppShell>
      <div className="max-w-lg mx-auto p-8 text-center">
        <Users className="w-12 h-12 text-accent mx-auto mb-4 opacity-80" />
        <h1 className="text-2xl font-bold mb-2">Leads</h1>
        <p className="text-sm text-muted mb-6">
          Job lead discovery for your content business — coming soon.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </AppShell>
  );
}
