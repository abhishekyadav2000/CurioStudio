import { AppShell } from "@/components/app-shell";
import { SCORECARD_TEMPLATE } from "@/lib/constants";
import { FileText, Shield, Terminal, Video } from "lucide-react";

export default function ScorecardPage() {
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-4 lg:p-8">
          <h1 className="text-3xl font-bold mb-2">Project Review Scorecard</h1>
          <p className="text-muted mb-8">
            Consistent template for every repo in your Everyday Series workflow.
          </p>

          <div className="space-y-6">
            {SCORECARD_TEMPLATE.sections.map((section) => (
              <section key={section.id} className="p-5 rounded-xl bg-card border border-border">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <SectionIcon id={section.id} />
                  {section.title}
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {section.fields.map((field) => (
                    <div
                      key={field}
                      className="p-3 rounded-lg bg-background border border-dashed border-border"
                    >
                      <p className="text-xs text-muted uppercase tracking-wide mb-1">
                        {field.replace(/([A-Z])/g, " $1").trim()}
                      </p>
                      <p className="text-sm text-muted/50 italic">Auto-filled during pipeline</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-8 p-5 rounded-xl bg-accent/5 border border-accent/20">
            <h3 className="font-semibold text-accent mb-2">How it works</h3>
            <p className="text-sm text-muted leading-relaxed">
              When you paste a GitHub URL and click &quot;Test Safely&quot;, CurioStudio automatically
              fills every scorecard section: metadata from the importer, risk data from the pre-run
              scanner, execution results from the sandbox, and content scores from the analyzer.
              You add manual notes and update status as you move toward recording and upload.
            </p>
          </div>
        </div>
    </AppShell>
  );
}

function SectionIcon({ id }: { id: string }) {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    identity: FileText,
    purpose: FileText,
    technical: Terminal,
    safety: Shield,
    execution: Terminal,
    content: Video,
  };
  const Icon = icons[id] ?? FileText;
  return <Icon className="w-5 h-5 text-accent" />;
}
