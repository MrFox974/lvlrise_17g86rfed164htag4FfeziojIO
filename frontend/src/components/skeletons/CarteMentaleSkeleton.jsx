function CarteMentaleSkeleton() {
  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 animate-pulse">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="h-6 bg-[var(--om-track)] rounded w-28" />
          <div className="h-10 w-32 bg-[var(--om-track)] rounded-2xl" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-[var(--om-line)] p-4">
              <div className="h-5 bg-[var(--om-track)] rounded w-3/4 mb-2" />
              <div className="h-4 bg-[var(--om-track)] rounded w-full opacity-60" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-[var(--om-line)] p-6">
          <div className="h-6 bg-[var(--om-track)] rounded w-40 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-[var(--om-track)] rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CarteMentaleSkeleton;
