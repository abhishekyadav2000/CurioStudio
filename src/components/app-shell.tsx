import { Sidebar } from "@/components/sidebar";
import { ConnectionBanner } from "@/components/connection-banner";

export function AppShell({
  children,
  noScroll,
}: {
  children: React.ReactNode;
  noScroll?: boolean;
}) {
  return (
    <div className={`flex ${noScroll ? "h-screen overflow-hidden" : "min-h-screen"}`}>
      <ConnectionBanner />
      <Sidebar />
      <main
        className={`flex-1 pt-14 lg:pt-0 ${
          noScroll ? "overflow-hidden flex flex-col min-h-0" : "overflow-auto"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
