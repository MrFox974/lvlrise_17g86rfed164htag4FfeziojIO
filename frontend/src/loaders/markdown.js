import { fetchDomains, fetchSections } from '../utils/markdownApi';

/** Page liste domaines : uniquement les domaines */
export const markdownHomeLoader = async () => {
  try {
    const domains = await fetchDomains();
    return { domains };
  } catch (error) {
    console.error('Erreur dans markdownHomeLoader:', error);
    console.error('Détails de l\'erreur:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw new Response('Erreur lors du chargement des domaines', {
      status: error.response?.status || 500,
      statusText: error.response?.statusText || 'Internal Server Error',
    });
  }
};

/** Page domaine : le domaine avec ses chapitres (pour l’affichage) */
export const markdownDomainLoader = async ({ params }) => {
  try {
    const domains = await fetchDomains();
    const domainId = params.domainId;
    const domain = domains.find((d) => String(d.id) === String(domainId));
    if (!domainId) {
      return { domain: null };
    }
    return { domain: domain || null };
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('Erreur dans markdownDomainLoader:', error);
    throw new Response('Erreur lors du chargement', {
      status: error.response?.status || 500,
      statusText: error.response?.statusText || 'Internal Server Error',
    });
  }
};

/** Page chapitre : le domaine et le chapitre (avec sections) */
export const markdownChapterLoader = async ({ params }) => {
  try {
    const domains = await fetchDomains();
    const domainId = params.domainId;
    const chapterId = params.chapterId;
    const domain = domains.find((d) => String(d.id) === String(domainId));
    const chapter = domain?.chapters?.find((c) => String(c.id) === String(chapterId));
    return { domain: domain || null, chapter: chapter || null };
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('Erreur dans markdownChapterLoader:', error);
    throw new Response('Erreur lors du chargement', {
      status: error.response?.status || 500,
      statusText: error.response?.statusText || 'Internal Server Error',
    });
  }
};

/** Ancien loader (sections + filtres) – conservé pour compat si besoin */
export const markdownLoader = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const domainId = url.searchParams.get('domain_id');
    const chapterId = url.searchParams.get('chapter_id');
    const sort = url.searchParams.get('sort') || 'created_at';
    const order = url.searchParams.get('order') || 'desc';

    const [domains, sections] = await Promise.all([
      fetchDomains(),
      fetchSections({
        domain_id: domainId || undefined,
        chapter_id: chapterId || undefined,
        sort,
        order,
      }),
    ]);

    return { domains, sections, filters: { domainId, chapterId, sort, order } };
  } catch (error) {
    console.error('Erreur dans markdownLoader:', error);
    throw new Response('Erreur lors du chargement', {
      status: error.response?.status || 500,
      statusText: error.response?.statusText || 'Internal Server Error',
    });
  }
};
