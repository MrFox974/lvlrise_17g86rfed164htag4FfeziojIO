import { RouterProvider } from 'react-router-dom';
import { Suspense } from 'react';
import { router } from './router';

function App() {
  return (
    <Suspense 
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border border-[var(--om-accent)] border-t-transparent mx-auto mb-4"></div>
            <p className="text-[var(--om-muted)]">Chargement...</p>
          </div>
        </div>
      }
    >
      
      <RouterProvider router={router} />
    </Suspense>
  );
}

export default App;
