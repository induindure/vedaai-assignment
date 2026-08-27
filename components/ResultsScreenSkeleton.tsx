/** Placeholder shown for one frame while ResultsScreen mounts, so a heavy first paint (many
 * question cards, a large decoded answer-sheet image) never reads as a blank flash. */
export default function ResultsScreenSkeleton() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
        <div className="h-9 w-9 animate-pulse rounded-full bg-neutral-100" />
        <div className="h-9 w-36 animate-pulse rounded-full bg-neutral-100" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-4 lg:flex-row lg:p-6">
        <div className="flex min-h-0 flex-1 flex-col lg:w-[45%] lg:flex-none">
          <div className="h-5 w-52 animate-pulse rounded bg-neutral-200" />
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl border border-neutral-100 bg-white" />
            ))}
          </div>
        </div>

        <div className="hidden min-h-0 flex-1 flex-col lg:flex lg:w-[55%] lg:flex-none">
          <div className="h-5 w-28 animate-pulse rounded bg-neutral-200" />
          <div className="mt-4 flex-1 animate-pulse rounded-2xl bg-neutral-100" />
        </div>
      </div>
    </div>
  );
}
