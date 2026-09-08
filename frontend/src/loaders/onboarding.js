import { redirect } from 'react-router-dom';
import { getOnboardingStatus, getGenerationStatus } from '../utils/onboardingApi';

/**
 * Loader pour la route /onboarding : vérifie que l'onboarding n'est accessible qu'une seule fois
 * et seulement si :
 * - C'est la première connexion (aucune collection, pas de session)
 * - OU l'utilisateur a choisi "commencer rapidement" (collections créées mais onboarding_completed_at pas encore défini)
 * - OU l'utilisateur a choisi "personnaliser avec l'IA" et la génération est au minimum lancée
 * 
 * Si onboarding_completed_at est défini, l'accès est refusé (redirection vers /home).
 */
export const onboardingLoader = async () => {
  try {
    const status = await getOnboardingStatus();
    
    // Si l'onboarding est déjà terminé (onboarding_completed_at défini), rediriger vers /home
    // Le backend retourne needsOnboarding: false et isGenerating: false si onboarding_completed_at est défini
    if (!status.needsOnboarding && !status.isGenerating) {
      // Vérifier une dernière fois le statut de génération pour confirmer
      try {
        const genStatus = await getGenerationStatus();
        // Si la génération est terminée (completed: true), l'onboarding est terminé
        if (genStatus.completed) {
          return redirect('/home');
        }
      } catch (genErr) {
        // Si erreur, on considère que l'onboarding est terminé
        return redirect('/home');
      }
      return redirect('/home');
    }
    
    // Si une génération est en cours, permettre l'accès (personnalisation avec IA lancée)
    if (status.isGenerating) {
      return null; // Permettre l'accès
    }
    
    // Vérifier le statut de génération pour voir si elle a été lancée au minimum
    try {
      const genStatus = await getGenerationStatus();
      // Si la génération a été lancée (progress > 0 ou step défini), permettre l'accès
      if (genStatus.progress > 0 || genStatus.step) {
        return null; // Permettre l'accès (personnalisation avec IA lancée)
      }
    } catch (genErr) {
      // Si erreur, continuer la vérification
      console.warn('Erreur lors de la vérification du statut de génération:', genErr);
    }
    
    // Si needsOnboarding est true, c'est la première fois → permettre l'accès
    if (status.needsOnboarding) {
      return null; // Permettre l'accès (première fois)
    }
    
    // Si on arrive ici, c'est que needsOnboarding est false mais isGenerating aussi
    // et onboarding_completed_at n'est pas défini (sinon on aurait redirigé)
    // Cela signifie que l'utilisateur a des collections (commencer rapidement) mais pas de session
    // → permettre l'accès car l'onboarding n'est pas encore terminé
    return null;
  } catch (err) {
    console.error('onboardingLoader:', err);
    // En cas d'erreur, rediriger vers /home par sécurité
    return redirect('/home');
  }
};
