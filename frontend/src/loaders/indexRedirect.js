import { getOnboardingStatus } from '../utils/onboardingApi';

/**
 * Loader pour IndexRedirect : détermine où rediriger l'utilisateur connecté.
 * @returns {{ needsOnboarding: boolean, isGenerating: boolean } | null}
 */
export const indexRedirectLoader = async () => {
  try {
    const data = await getOnboardingStatus();
    return data;
  } catch (err) {
    console.error('indexRedirectLoader:', err);
    return { needsOnboarding: true, isGenerating: false };
  }
};
