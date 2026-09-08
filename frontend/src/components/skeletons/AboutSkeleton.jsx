function AboutSkeleton() {
  return (
    <div className="p-4 md:p-8 animate-pulse">
      <div className="max-w-2xl mx-auto">
        <div className="h-8 bg-[var(--om-track)] rounded w-48 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-[var(--om-track)] rounded w-full" />
              <div className="h-4 bg-[var(--om-track)] rounded w-5/6 opacity-80" />
              <div className="h-4 bg-[var(--om-track)] rounded w-4/5 opacity-60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AboutSkeleton;
