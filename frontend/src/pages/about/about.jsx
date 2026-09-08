import { useLoaderData } from 'react-router-dom';

function About() {
  const { title = 'About' } = useLoaderData();

  return (
    <div className="p-4 md:p-4">
      <h1 className="text-xl md:text-lg font-medium mb-4 md:mb-3">{title}</h1>
      <p className="text-[var(--om-muted)] max-w-2xl">
        Page À propos. Tu peux ajouter un loader pour précharger du contenu si besoin.
      </p>
    </div>
  );
}

export default About;
