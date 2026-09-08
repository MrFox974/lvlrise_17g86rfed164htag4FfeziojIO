import { useState, useCallback } from 'react';

/**
 * Hook pour gérer l'affichage du modal d'upgrade
 * @returns {Object} { showUpgradeModal, hideUpgradeModal, upgradeModalProps }
 */
export function useUpgradeModal() {
  const [upgradeModal, setUpgradeModal] = useState({
    isOpen: false,
    restriction: null,
    featureName: null,
  });

  const showUpgradeModal = useCallback((restriction, featureName = null) => {
    setUpgradeModal({
      isOpen: true,
      restriction,
      featureName,
    });
  }, []);

  const hideUpgradeModal = useCallback(() => {
    setUpgradeModal({
      isOpen: false,
      restriction: null,
      featureName: null,
    });
  }, []);

  return {
    showUpgradeModal,
    hideUpgradeModal,
    upgradeModalProps: upgradeModal,
  };
}

/**
 * Utilitaire pour détecter si une erreur est une erreur de limite de plan
 * @param {Error} error - L'erreur à vérifier
 * @returns {Object|null} { restriction, featureName } ou null si ce n'est pas une erreur de limite
 */
export function isPlanLimitError(error) {
  if (!error?.response) return null;

  const { status, data } = error.response;

  // Les erreurs de limite sont des 403 avec un objet restriction
  if (status === 403 && data?.restriction) {
    return {
      restriction: data.restriction,
      featureName: extractFeatureNameFromError(data.error || ''),
    };
  }

  return null;
}

/**
 * Extrait le nom de la fonctionnalité depuis le message d'erreur
 */
function extractFeatureNameFromError(errorMessage) {
  if (!errorMessage) return null;

  // Patterns communs dans les messages d'erreur du backend
  const patterns = [
    /limite de (.+?) atteinte/i,
    /limite atteinte pour (.+?)$/i,
    /limite de (.+?) pour votre plan/i,
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}
