import { fetchDemoDebates, fetchDemoDebate } from '../../utils/demoApi';

export const demoDebatLoader = async ({ params }) => {
  const debates = await fetchDemoDebates();
  const debateId = params.debateId;
  if (debateId) {
    const debate = await fetchDemoDebate(debateId);
    return { debates, debate };
  }
  return { debates, debate: null };
};
