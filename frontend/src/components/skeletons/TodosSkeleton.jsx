function TodosSkeleton() {
  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-2xl mx-auto animate-pulse">
      <div className="h-8 bg-[var(--om-track)] rounded w-32 mx-auto mb-6" />
      <div className="space-y-3 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-[var(--om-track)] rounded-2xl" />
        ))}
      </div>
      <div className="border-t border-[var(--om-line)] pt-6">
        <div className="h-4 bg-[var(--om-track)] rounded w-24 mb-3" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-[var(--om-track)] rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="mt-8 pt-6 border-t border-[var(--om-line)]">
        <div className="flex gap-2">
          <div className="flex-1 h-10 bg-[var(--om-track)] rounded-[10px]" />
          <div className="w-24 h-10 bg-[var(--om-track)] rounded-[10px]" />
          <div className="w-20 h-10 bg-[var(--om-track)] rounded-[10px]" />
        </div>
      </div>
    </div>
  );
}

export default TodosSkeleton;
