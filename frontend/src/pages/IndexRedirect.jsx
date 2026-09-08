import { Suspense } from 'react';
import LandingLayout from '../components/landing/LandingLayout';
import lazyRoute from '../lib/lazyRoute';

const LandingPage = lazyRoute(() => import('../pages/landing/LandingPage'));

/**
 * À la racine / : affiche toujours la landing page
 */
function IndexRedirect() {
  return (
    <LandingLayout>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[var(--om-bg)]" />}>
        <LandingPage />
      </Suspense>
    </LandingLayout>
  );
}

export default IndexRedirect;
