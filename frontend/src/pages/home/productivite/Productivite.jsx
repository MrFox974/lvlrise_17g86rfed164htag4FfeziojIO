import { useNavigate, Link } from 'react-router-dom';
import { useDemoBasePath } from '../../../hooks/useDemoMode';
import { CarteMentaleIcon, NoteIcon, BibliothequeIcon } from '../../../components/ProductiviteIcons';

function getProductiviteCards(basePath) {
  return [
    {
      id: 'markdown',
      title: 'Bibliothèque',
      description: 'Notes structurées par domaines et chapitres, avec filtres et organisation avancée.',
      Icon: BibliothequeIcon,
      path: `${basePath}/productivite/markdown`,
    },
    {
      id: 'carte-mentale',
      title: 'FlashCard-A 2.0',
      description: 'Flashcards style Anki avec répétition espacée (algorithme SM-2) pour mémoriser efficacement.',
      Icon: CarteMentaleIcon,
      path: `${basePath}/productivite/carte-mentale`,
    },
    {
      id: 'notes',
      title: 'Note',
      description: 'Notes rapides et simples pour capturer vos idées.',
      Icon: NoteIcon,
      path: `${basePath}/productivite/notes`,
    },
  ];
}

function ProductiviteCard({ card, onClick }) {
  const IconComponent = card.Icon;

  return (
    <button
      type="button"
      onClick={() => onClick(card.path)}
      className="w-full text-left rounded-2xl md:rounded-[10px] border border-[var(--om-line)] bg-[var(--om-surface)] p-4 md:p-5 shadow-[var(--om-shadow)] hover:border-[var(--om-accent)]/50 hover:bg-[var(--om-accent)]/5 hover:shadow-[var(--om-shadow)] transition-all duration-200 group"
    >
      <div className="flex items-start gap-3 md:gap-3">
        <div className="flex-shrink-0 group-hover:scale-110 transition-transform">
          <IconComponent className="w-10 h-10 md:w-12 md:h-12" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base md:text-[1.05rem] font-medium text-[var(--om-text)] mb-0.5 md:mb-0">
            {card.title}
          </h3>
          <p className="text-sm md:text-[0.95rem] text-[var(--om-muted)] leading-relaxed">
            {card.description}
          </p>
        </div>
      </div>
    </button>
  );
}

function Productivite() {
  const navigate = useNavigate();
  const basePath = useDemoBasePath();
  const productiviteCards = getProductiviteCards(basePath);

  const handleCardClick = (path) => {
    navigate(path);
  };

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-2xl md:max-w-6xl mx-auto">
      <Link
        to={basePath}
        className="inline-flex items-center gap-1 text-sm md:text-base text-[var(--om-muted)] hover:text-[var(--om-accent)] mb-2 transition-colors"
      >
        ← Retour
      </Link>
      <h1 className="text-xl md:text-[1.25rem] font-medium text-[var(--om-text)] mb-2 md:mb-1 text-center">
        Productivité
      </h1>
      <p className="text-sm md:text-[15px] text-[var(--om-muted)] text-center mb-8">
        Choisissez un outil pour organiser vos idées et booster votre mémorisation.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {productiviteCards.map((card) => (
          <ProductiviteCard key={card.id} card={card} onClick={handleCardClick} />
        ))}
      </div>
    </div>
  );
}

export default Productivite;
