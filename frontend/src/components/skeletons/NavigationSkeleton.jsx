/**
 * Skeleton affiché pendant la navigation (loader en cours).
 * Utilise le code couleur de l'application pour rester cohérent.
 */
function NavigationSkeleton() {
  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 animate-pulse min-h-[50vh]">
      <div className="max-w-4xl mx-auto">
        <div className="h-8 bg-[var(--om-track)] rounded-[10px] w-48 mb-8" />
        <div className="space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-4 bg-[var(--om-track)] rounded w-full" />
              <div className="h-4 bg-[var(--om-track)] rounded w-5/6 opacity-80" />
              <div className="h-4 bg-[var(--om-track)] rounded w-4/5 opacity-60" />
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--om-accent)] animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-[var(--om-accent)] animate-pulse [animation-delay:0.2s]" />
          <div className="w-2 h-2 rounded-full bg-[var(--om-accent)] animate-pulse [animation-delay:0.4s]" />
        </div>
      </div>
    </div>
  );
}

export default NavigationSkeleton;
