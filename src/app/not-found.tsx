import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-muted mb-6">Page not found</p>
        <Link href="/" className="text-accent hover:underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
