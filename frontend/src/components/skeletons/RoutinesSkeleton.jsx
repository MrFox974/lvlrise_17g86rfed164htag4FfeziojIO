function RoutinesSkeleton() {
  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-2xl mx-auto animate-pulse">
      <div className="h-8 bg-[var(--om-track)] rounded w-40 mx-auto mb-4" />
      <div className="flex justify-center gap-1 mb-6">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-8 w-10 bg-[var(--om-track)] rounded-full" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-[var(--om-track)] rounded-2xl" />
        ))}
      </div>
      <div className="mt-12 pt-6 border-t border-[var(--om-line)]">
        <div className="flex gap-2">
          <div className="flex-1 h-10 bg-[var(--om-track)] rounded-[10px]" />
          <div className="w-20 h-10 bg-[var(--om-track)] rounded-[10px]" />
        </div>
      </div>
    </div>
  );
}

export default RoutinesSkeleton;
