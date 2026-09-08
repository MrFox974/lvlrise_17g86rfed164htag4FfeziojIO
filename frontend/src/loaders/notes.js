import { fetchNotes } from '../utils/noteApi';

export const notesLoader = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const sort = url.searchParams.get('sort') || 'updated_at';
    const order = url.searchParams.get('order') || 'desc';
    const notes = await fetchNotes({ sort, order });
    return { notes };
  } catch (error) {
    console.error('Erreur dans notesLoader:', error);
    throw new Response('Erreur lors du chargement des notes', {
      status: error.response?.status || 500,
      statusText: error.response?.statusText || 'Internal Server Error',
    });
  }
};
