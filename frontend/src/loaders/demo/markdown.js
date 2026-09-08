import { getDemoData, getDefaultMarkdownDomains } from '../../hooks/useDemoMode';

export const demoMarkdownHomeLoader = async () => {
  const data = getDemoData();
  const domains = data.markdownDomains ?? getDefaultMarkdownDomains();
  return { domains };
};

export const demoMarkdownDomainLoader = async ({ params }) => {
  const data = getDemoData();
  const domains = data.markdownDomains ?? getDefaultMarkdownDomains();
  const domainId = params.domainId;
  const domain = domains.find((d) => String(d.id) === String(domainId));
  return { domain: domain || null };
};

export const demoMarkdownChapterLoader = async ({ params }) => {
  const data = getDemoData();
  const domains = data.markdownDomains ?? getDefaultMarkdownDomains();
  const domainId = params.domainId;
  const chapterId = params.chapterId;
  const domain = domains.find((d) => String(d.id) === String(domainId));
  const chapter = domain?.chapters?.find((c) => String(c.id) === String(chapterId));
  return { domain: domain || null, chapter: chapter || null };
};
