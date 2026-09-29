import { Skeleton } from './Skeleton';

export default function PageLoading() {
  return (
    <div className="min-h-[70vh] bg-[var(--paper)] px-4 py-12" aria-busy="true" aria-live="polite" aria-label="Loading page">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="bg-[var(--navy)] p-8 sm:p-12">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-5 h-10 w-2/3" />
          <Skeleton className="mt-4 h-4 w-1/2" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
      <span className="sr-only">Loading page content…</span>
    </div>
  );
}
