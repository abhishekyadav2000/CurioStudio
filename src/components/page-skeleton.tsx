export function DashboardSkeleton() {
  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 animate-pulse">
      <div className="mb-8 space-y-3">
        <div className="h-4 w-32 rounded bg-card-hover" />
        <div className="h-9 w-3/4 max-w-lg rounded bg-card-hover" />
        <div className="h-4 w-2/3 max-w-md rounded bg-card-hover" />
      </div>

      <div className="h-24 rounded-2xl bg-card border border-border mb-8" />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-card border border-border" />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="h-48 rounded-xl bg-card border border-border" />
        <div className="h-48 rounded-xl bg-card border border-border" />
      </div>

      <div className="h-32 rounded-2xl bg-card border border-border mb-8" />

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-card border border-border" />
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-card border border-border" />
        ))}
      </div>
    </div>
  );
}

export function DiscoverListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-card border border-border" />
      ))}
    </div>
  );
}

export function DiscoverSkeleton() {
  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 animate-pulse">
      <div className="mb-6 space-y-2">
        <div className="h-3 w-24 rounded bg-card-hover" />
        <div className="h-8 w-48 rounded bg-card-hover" />
        <div className="h-4 w-64 rounded bg-card-hover" />
      </div>

      <div className="flex gap-2 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-20 rounded-lg bg-card border border-border" />
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-card border border-border" />
        ))}
      </div>
    </div>
  );
}
