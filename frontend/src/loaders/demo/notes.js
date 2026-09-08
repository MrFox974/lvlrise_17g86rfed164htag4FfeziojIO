import { getDemoData } from '../../hooks/useDemoMode';

export const demoNotesLoader = async ({ request }) => {
  const url = new URL(request.url);
  const sort = url.searchParams.get('sort') || 'updated_at';
  const order = url.searchParams.get('order') || 'desc';
  
  const data = getDemoData();
  let notes = data.notes || [
    {
      id: 1,
      title: 'Note de démo',
      content: 'Ceci est une note de démonstration. Vous pouvez créer vos propres notes en mode démo.',
      updated_at: new Date().toISOString(),
    },
  ];

  // Tri simple
  notes = [...notes].sort((a, b) => {
    const aVal = a[sort] || '';
    const bVal = b[sort] || '';
    if (order === 'desc') {
      return bVal > aVal ? 1 : -1;
    }
    return aVal > bVal ? 1 : -1;
  });

  return { notes };
};
