import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';

/**
 * Hook pour détecter si on est en mode démo (URL commence par /demo)
 */
export function useDemoMode() {
  const location = useLocation();
  const isDemo = useMemo(() => location.pathname.startsWith('/demo'), [location.pathname]);
  return isDemo;
}

/**
 * Base path pour les routes home selon le mode (démo ou authentifié).
 * À utiliser pour tous les liens et navigate() dans les pages partagées démo/home.
 */
export function useDemoBasePath() {
  const isDemo = useDemoMode();
  return useMemo(() => (isDemo ? '/demo/home' : '/home'), [isDemo]);
}

/**
 * Clé localStorage pour les données démo
 */
const DEMO_STORAGE_KEY = 'demo_data';

/**
 * Récupère les données démo depuis localStorage
 */
export function getDemoData() {
  try {
    const stored = localStorage.getItem(DEMO_STORAGE_KEY);
    return stored ? JSON.parse(stored) : getDefaultDemoData();
  } catch {
    return getDefaultDemoData();
  }
}

/**
 * Sauvegarde les données démo dans localStorage
 */
export function saveDemoData(data) {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des données démo:', error);
  }
}

/** 5 jauges perso + 3 jauges pro préconfigurées pour la démo */
const DEMO_GAUGES_PERSO = [
  { id: 101, name: 'Rhétorique', type: 'perso', expectedMinutes: 30, actualMinutes: 15 },
  { id: 102, name: 'Histoire', type: 'perso', expectedMinutes: 45, actualMinutes: 30 },
  { id: 103, name: 'Psychologie', type: 'perso', expectedMinutes: 20, actualMinutes: 20 },
  { id: 104, name: 'Sociologie', type: 'perso', expectedMinutes: 25, actualMinutes: 10 },
  { id: 105, name: 'Développement web', type: 'perso', expectedMinutes: 60, actualMinutes: 45 },
];
const DEMO_GAUGES_PRO = [
  { id: 201, name: 'Rapport', type: 'pro', expectedMinutes: 90, actualMinutes: 60 },
  { id: 202, name: 'Connaissance', type: 'pro', expectedMinutes: 45, actualMinutes: 25 },
  { id: 203, name: 'Articles rédigés', type: 'pro', expectedMinutes: 60, actualMinutes: 20 },
];
const DEMO_DOMAIN_GAUGES = [...DEMO_GAUGES_PERSO, ...DEMO_GAUGES_PRO];

/** Jours de la semaine (aligné sur domainApi) pour minutes_per_day */
const DEMO_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Jours du week-end : objectif réduit pour que jour vs semaine donne des % différents (stroke-dasharray qui bouge) */
const DEMO_WEEKEND_DAYS = new Set(['saturday', 'sunday']);
const DEMO_WEEKEND_RATIO = 0.6; // 60 % du temps en week-end

/**
 * Construit la liste des domaines démo à partir des jauges (même ids) pour la page Domaines.
 * Objectifs variables selon le jour (weekend à 60 %) pour que les cercles jour/semaine aient des pourcentages différents.
 */
function buildDemoDomainsFromGauges(gauges = DEMO_DOMAIN_GAUGES) {
  if (!Array.isArray(gauges) || gauges.length === 0) return [];
  return gauges.map((g) => {
    const base = g.expectedMinutes ?? 0;
    const minutes_per_day = Object.fromEntries(
      DEMO_DAYS.map((d) => [
        d,
        DEMO_WEEKEND_DAYS.has(d) ? Math.round(base * DEMO_WEEKEND_RATIO) : base,
      ])
    );
    return {
      id: g.id,
      name: g.name,
      type: g.type || 'perso',
      minutes_per_day,
    };
  });
}

/** Liste des 5 domaines perso + 3 pro pour la démo (référencés par les stats/gauges). */
export function getDefaultDemoDomains() {
  return buildDemoDomainsFromGauges(DEMO_DOMAIN_GAUGES);
}

/**
 * Retourne les données par défaut pour la démo
 */
function getDefaultDemoData() {
  return {
    domains: getDefaultDemoDomains(),
    stats: {
      day: {
        apprentissage: {
          persoMinutesProgress: 120,
          persoMinutesTarget: 180,
          proMinutesProgress: 105,
          proMinutesTarget: 195,
          totalMinutesProgress: 225,
          totalMinutesTarget: 375,
          domainGauges: DEMO_DOMAIN_GAUGES,
        },
        routines: {
          done: 3,
          total: 5,
        },
      },
      week: {
        apprentissage: {
          persoMinutesProgress: 280,
          persoMinutesTarget: 420,
          proMinutesProgress: 180,
          proMinutesTarget: 630,
          totalMinutesProgress: 460,
          totalMinutesTarget: 1050,
          domainGauges: DEMO_DOMAIN_GAUGES,
        },
        routines: {
          done: 18,
          total: 35,
        },
      },
    },
    todos: {
      active: [
        {
          id: 1,
          name: 'Réviser les flashcards JavaScript',
          tag: 'absolue',
          progress: 60,
        },
        {
          id: 2,
          name: 'Compléter le chapitre React',
          tag: 'important',
          progress: 40,
        },
        {
          id: 3,
          name: 'Créer une nouvelle routine matinale',
          tag: 'à faire',
          progress: 0,
        },
      ],
      historique: [],
    },
    routinesByDay: {
      0: [
        { id: 301, label: 'Réveil 7h' },
        { id: 302, label: 'Sport 20 min' },
        { id: 303, label: 'Lecture 15 min' },
        { id: 311, label: 'Planifier la semaine' },
      ],
      1: [
        { id: 304, label: 'Méditation 5 min' },
        { id: 305, label: 'Révision flashcards' },
        { id: 312, label: 'Réveil 6h30' },
        { id: 313, label: 'Lecture 20 min' },
      ],
      2: [
        { id: 306, label: 'Étude 1h' },
        { id: 314, label: 'Réveil 7h' },
        { id: 315, label: 'Sport 25 min' },
      ],
      3: [
        { id: 307, label: 'Lecture 30 min' },
        { id: 316, label: 'Méditation 10 min' },
        { id: 317, label: 'Révision flashcards' },
      ],
      4: [
        { id: 308, label: 'Sport 30 min' },
        { id: 318, label: 'Réveil 7h' },
        { id: 319, label: 'Étude 45 min' },
      ],
      5: [
        { id: 309, label: 'Réveil 8h' },
        { id: 320, label: 'Lecture 20 min' },
        { id: 321, label: 'Repos / balade' },
      ],
      6: [
        { id: 310, label: 'Repos' },
        { id: 322, label: 'Réveil 9h' },
        { id: 323, label: 'Lecture 30 min' },
      ],
    },
    routineDoneByDate: {},
    /** Snapshots (total, done) par date pour les jours passés ; conservés même si on supprime/modifie les routines */
    calendarSnapshotByDate: {},
    learningDailyProgressByDate: {},
    markdownDomains: getDefaultMarkdownDomains(),
    flashcardDecks: getDefaultFlashcardDecks(),
    flashcardChapters: getDefaultFlashcardChapters(),
    flashcardCards: getDefaultFlashcardCards(),
    debates: getDefaultDemoDebates(),
  };
}

/**
 * Deux débats de démonstration, chacun avec un sous-débat et quelques
 * arguments déjà captés — pour montrer l'outil sans partir d'une page vide.
 */
export function getDefaultDemoDebates() {
  return [
    {
      id: 1,
      title: 'Le féminisme',
      question: 'Pour ou contre ?',
      desc: {
        termes: "Féminisme : mouvement pour l'égalité des droits entre femmes et hommes. À distinguer du différentialisme, qui postule des rôles distincts.",
        limites: 'Le débat porte sur la France depuis 1965. Il laisse de côté les comparaisons internationales et la représentation médiatique.',
        tensions: 'Égalité formelle contre égalité réelle ; place des quotas ; universalisme républicain face aux approches intersectionnelles.',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      general: {
        id: 11,
        title: 'Le féminisme',
        kind: 'general',
        step_done: 2,
        opinion: '',
        side: null,
        position: 0,
        arguments: [
          { id: 101, node_id: 11, side: 'pour', text: "L'écart de salaire à poste et expérience égaux reste de 4 % en France.", tags: ['Économique', 'Factuel'], source: 'INSEE — Emploi et salaires', support: 'Étude', date: '03/2024', verdict: 'verifie', note: 'Chiffre confirmé : 4,3 % en 2023, à poste comparable.', position: 0 },
          { id: 102, node_id: 11, side: 'contre', text: 'Les quotas dévaloriseraient les femmes nommées, jugées sur le genre plutôt que sur la compétence.', tags: ['Perso', 'Politique'], source: 'Tribune — Le Monde', support: 'Article de presse', date: '08/2015', verdict: 'nuance', note: 'Les travaux sur la loi Copé-Zimmermann ne montrent pas de baisse de compétence des conseils.', position: 1 },
          { id: 103, node_id: 11, side: 'pour', text: "Le congé paternité allongé fait baisser l'écart de temps parental dans les pays nordiques.", tags: ['Juridique', 'Factuel'], source: 'OCDE — Family database', support: 'Étude', date: '01/2023', verdict: null, note: '', position: 2 },
          { id: 104, node_id: 11, side: 'contre', text: "Le féminisme aurait déjà atteint ses objectifs : la loi garantit l'égalité formelle.", tags: ['Perso', 'Juridique'], source: 'Débat radio — France Culture', support: 'Podcast', date: '11/2019', verdict: 'faux', note: 'Égalité formelle ≠ égalité réelle : les écarts de pension atteignent 28 %.', position: 3 },
        ],
      },
      subs: [
        {
          id: 12,
          title: 'Le congé parental égal',
          kind: 'sub',
          step_done: 1,
          opinion: '',
          side: null,
          position: 1,
          arguments: [
            { id: 105, node_id: 12, side: 'pour', text: "Un congé identique pour les deux parents supprime l'arbitrage économique du couple.", tags: ['Économique'], source: 'Rapport IGAS', support: 'Étude', date: '06/2022', verdict: null, note: '', position: 0 },
          ],
        },
        {
          id: 13,
          title: "L'écriture inclusive",
          kind: 'sub',
          step_done: 0,
          opinion: '',
          side: null,
          position: 2,
          arguments: [],
        },
      ],
    },
    {
      id: 2,
      title: 'Le nucléaire civil',
      question: 'Solution ou impasse ?',
      desc: {
        termes: "Nucléaire civil : production d'électricité par fission. Distinguer parc existant, prolongation et réacteurs neufs.",
        limites: 'Périmètre France, horizon 2050. Hors sujet : armement et fusion.',
        tensions: 'Coût du neuf contre renouvelable pilotable ; déchets de longue durée ; souveraineté énergétique.',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      general: {
        id: 21,
        title: 'Le nucléaire civil',
        kind: 'general',
        step_done: 0,
        opinion: '',
        side: null,
        position: 0,
        arguments: [],
      },
      subs: [
        {
          id: 22,
          title: 'Le coût du démantèlement',
          kind: 'sub',
          step_done: 0,
          opinion: '',
          side: null,
          position: 1,
          arguments: [],
        },
      ],
    },
  ];
}

/**
 * Domaine Bibliothèque : Histoire du monde — 1 chapitre, 2 sous-chapitres (contenu dense).
 * Exporté pour les loaders démo qui peuvent en avoir besoin en fallback.
 */
export function getDefaultMarkdownDomains() {
  return [
    {
      id: 1,
      name: 'Histoire du monde',
      color: 'var(--om-accent)',
      chapters: [
        {
          id: 1,
          name: 'Chap 1. Les civilisations antiques : Mésopotamie, Égypte et mondes méditerranéens',
          order: 1,
          title: 'Chap 1. Les civilisations antiques : Mésopotamie, Égypte et mondes méditerranéens',
          content: [
            '<h2>Introduction au chapitre</h2>',
            '<p>Ce chapitre couvre les grandes civilisations qui ont façonné le Proche-Orient et le bassin méditerranéen de l\'Antiquité jusqu\'à la fin de l\'Empire romain d\'Occident. Comprendre ces mondes permet de saisir l\'origine de l\'écriture, des États centralisés, du droit et des formes politiques qui influencent encore nos sociétés.</p>',
            '<p>Nous verrons d\'abord la <strong>Mésopotamie</strong>, berceau de l\'écriture et des premières cités, puis l\'<strong>Égypte</strong> pharaonique et son rapport à l\'au-delà, enfin la <strong>Grèce</strong> et <strong>Rome</strong>, dont l\'héritage culturel et juridique structure une large part du monde actuel.</p>',
            '<blockquote data-type="note"><p><strong>Objectif</strong> : identifier les apports majeurs de chaque civilisation (écriture, État, religion, droit) et les liens entre elles.</p></blockquote>',
            '<h3>Contexte historique et géographique</h3>',
            '<p>Le Proche-Orient et le bassin méditerranéen constituent une zone de transition entre l\'Afrique, l\'Asie et l\'Europe. Cette position géographique stratégique a favorisé les échanges commerciaux, culturels et technologiques entre les différentes civilisations. Les fleuves (Nil, Tigre, Euphrate) ont joué un rôle fondamental dans le développement de l\'agriculture et l\'émergence des premières cités.</p>',
            '<p>L\'étude de ces civilisations révèle des patterns récurrents : l\'émergence de l\'écriture, le développement de systèmes administratifs complexes, l\'établissement de codes de lois, et la construction d\'identités collectives autour de croyances religieuses et de pratiques culturelles partagées.</p>',
            '<h3>Méthodologie et sources</h3>',
            '<p>Notre compréhension de ces civilisations repose sur plusieurs types de sources : les textes anciens (tablettes cunéiformes, papyrus égyptiens, inscriptions grecques et latines), les découvertes archéologiques (sites urbains, tombes, temples), et les témoignages des auteurs antiques qui ont documenté ces périodes.</p>',
            '<p>L\'interprétation de ces sources nécessite une approche critique, car elles reflètent souvent les perspectives des élites et peuvent être influencées par des considérations politiques ou religieuses. Néanmoins, elles nous permettent de reconstituer avec une précision remarquable l\'organisation sociale, économique et politique de ces sociétés.</p>',
            '<h3>Chronologie et périodisation</h3>',
            '<p>La période couverte s\'étend approximativement de 3500 avant notre ère (émergence de l\'écriture en Mésopotamie) jusqu\'à 476 de notre ère (chute de l\'Empire romain d\'Occident). Cette longue période peut être divisée en plusieurs phases : l\'Antiquité haute (3500-1200 av. J.-C.), l\'âge du fer et les empires (1200-500 av. J.-C.), l\'époque classique (500 av. J.-C. - 200 ap. J.-C.), et l\'Antiquité tardive (200-476 ap. J.-C.).</p>',
            '<p>Chaque phase correspond à des transformations majeures : l\'urbanisation et l\'invention de l\'écriture, l\'émergence des grands empires, la diffusion de la culture grecque (hellénisation), puis la montée de Rome et sa transformation en empire méditerranéen.</p>',
            '<h3>Thèmes transversaux</h3>',
            '<p>Plusieurs thèmes traversent l\'ensemble de ce chapitre : le rôle de l\'écriture dans la centralisation du pouvoir, l\'évolution des formes politiques (de la cité-État à l\'empire), les interactions entre religion et pouvoir, et la transmission des savoirs techniques et culturels.</p>',
            '<p>Ces thèmes permettent de comprendre comment des innovations apparues dans une région (comme l\'écriture en Mésopotamie) se sont diffusées et adaptées ailleurs, créant des réseaux d\'échanges culturels et technologiques qui ont façonné le monde antique.</p>',
            '<h3>Enjeux historiographiques</h3>',
            '<p>L\'étude de ces civilisations soulève des questions méthodologiques importantes : comment interpréter les sources fragmentaires ? Comment éviter l\'eurocentrisme tout en reconnaissant l\'importance de l\'héritage gréco-romain ? Comment intégrer les apports de l\'archéologie avec ceux des textes ?</p>',
            '<p>Ces questions nous rappellent que notre compréhension du passé évolue constamment avec les nouvelles découvertes et les nouvelles approches méthodologiques. L\'histoire de l\'Antiquité est un champ vivant, où chaque génération apporte de nouvelles perspectives.</p>',
          ].join(''),
          sections: [
            {
              id: 1,
              title: 'Part 1. Mésopotamie et invention de l’écriture',
              content: [
                '<h2>Part 1. Mésopotamie et invention de l’écriture</h2>',
                '<p>La Mésopotamie (entre le Tigre et l’Euphrate) voit naître, vers 3500 avant notre ère, les premières cités-États (Uruk, Ur, Lagash) et surtout l’<strong>écriture cunéiforme</strong>. D’abord utilisée pour la comptabilité et les listes de biens, elle devient le support des lois (code d’Hammurabi, XVIIIe siècle av. J.-C.), des récits mythologiques (épopée de Gilgamesh) et de la correspondance diplomatique.</p>',
                '<p>L’organisation politique repose sur des <strong>rois-prêtres</strong> et des temples qui centralisent les surplus agricoles. L’irrigation, les canaux et la gestion collective de l’eau structurent la société. Les conquêtes d’empires successifs (Akkadiens, Babyloniens, Assyriens) diffusent la culture mésopotamienne jusqu’en Égypte et en Anatolie.</p>',
                '<h3>Origines et expansion</h3>',
                '<p>Les Sumériens inventent l’écriture sur des tablettes d’argile ; les signes en forme de clous (cunéiformes) servent d’abord à noter les quantités de céréales, de bétail ou de biens échangés. Peu à peu, le système évolue pour transcrire la langue sumérienne puis l’akkadien, et s’étend à la littérature, aux mythes et aux traités.</p>',
                '<p>Hammurabi, roi de Babylone au XVIIIe siècle av. J.-C., unifie une grande partie de la Mésopotamie et promulgue un <strong>code de lois</strong> inscrit sur une stèle : il fixe des peines selon le statut (libre, esclave) et le type d’offense, et pose le principe de la loi écrite comme référence commune.</p>',
                '<h3>Héritage</h3>',
                '<p>La Mésopotamie lègue au monde l’écriture, la comptabilité, l’astronomie (calendriers, prédictions), les mathématiques (système sexagésimal) et des récits fondateurs (Déluge, Gilgamesh) qui influenceront les textes bibliques et la culture méditerranéenne.</p>',
                '<blockquote data-type="note"><p><strong>À retenir</strong> : écriture cunéiforme, code d’Hammurabi, cités-États, rôle des temples et de l’irrigation, héritage juridique et scientifique.</p></blockquote>',
              ].join(''),
            },
            {
              id: 2,
              title: 'Part 2. Égypte pharaonique et mondes grec et romain',
              content: [
                '<h2>Part 2. Égypte pharaonique et mondes grec et romain</h2>',
                '<p>En <strong>Égypte</strong>, le pharaon incarne l’ordre du monde (maât). Les pyramides, les temples (Karnak, Louxor) et le Livre des morts témoignent d’une civilisation tournée vers l’au-delà et la permanence. L’écriture hiéroglyphique et le papyrus permettent une administration centralisée et une littérature religieuse et technique.</p>',
                '<h3>Égypte : maât et éternité</h3>',
                '<p>La religion égyptienne est centrée sur le cycle de la mort et de la renaissance. Le pharaon est le garant de la <strong>maât</strong> (ordre, vérité, justice) ; à sa mort, il rejoint les dieux. Les pyramides de Gizeh, les tombes de la Vallée des Rois et les temples monumentaux servent à assurer la survie du souverain et le culte des dieux. Le <em>Livre des morts</em> rassemble formules et rituels pour accompagner le défunt dans l’au-delà.</p>',
                '<p>L’Égypte invente aussi le <strong>papyrus</strong>, support d’écriture léger et durable, qui favorise l’administration, les archives et la diffusion des textes. L’héritage égyptien (astronomie, médecine, architecture) sera repris par les Grecs puis les Romains.</p>',
                '<h3>Grèce : cités et philosophie</h3>',
                '<p>Le bassin méditerranéen est ensuite marqué par la <strong>Grèce</strong> : cités indépendantes (Athènes, Sparte, Thèbes), expériences politiques (démocratie athénienne, oligarchie spartiate), et un foisonnement culturel (philosophie, théâtre, histoire, médecine). Athènes impose l’idée de citoyenneté et de débat public ; la philosophie (Socrate, Platon, Aristote) pose les bases de la réflexion rationnelle sur l’homme et le monde.</p>',
                '<h3>Rome : empire et droit</h3>',
                '<p><strong>Rome</strong> construit un empire qui s’étend de l’Espagne à la Mésopotamie. Elle lègue un <strong>droit écrit</strong> (lois, jurisprudence), des infrastructures (routes, aqueducs, ponts) et une langue, le latin, qui donnera naissance aux langues romanes. La synthèse gréco-romaine, diffusée par l’hellénisme puis par le christianisme, fonde une grande partie de la culture occidentale.</p>',
                '<blockquote data-type="note"><p><strong>À retenir</strong> : maât, pyramides et Livre des morts ; démocratie athénienne et philosophie ; empire romain, droit et héritage gréco-romain.</p></blockquote>',
              ].join(''),
            },
          ],
        },
        {
          id: 2,
          name: 'Chap 2. Le Moyen Âge : féodalité, expansion de l\'Islam et renaissance carolingienne',
          order: 2,
          title: 'Chap 2. Le Moyen Âge : féodalité, expansion de l\'Islam et renaissance carolingienne',
          content: [
            '<h2>Introduction au chapitre</h2>',
            '<p>Après la chute de l\'Empire romain d\'Occident en 476, l\'Europe entre dans une période de transformation profonde : le <strong>Moyen Âge</strong>. Cette époque, souvent mal comprise, voit l\'émergence de nouvelles structures politiques, sociales et religieuses qui façonneront l\'Europe moderne. Parallèlement, l\'expansion de l\'<strong>Islam</strong> à partir du VIIe siècle crée un nouveau pôle de civilisation qui rivalise avec l\'Europe et influence durablement la Méditerranée et au-delà.</p>',
            '<p>Ce chapitre explore trois phénomènes majeurs : la <strong>féodalité</strong> comme système d\'organisation sociale et politique en Europe occidentale, l\'expansion rapide de l\'Islam qui unifie une grande partie du monde connu, et la <strong>renaissance carolingienne</strong> qui tente de restaurer l\'héritage culturel antique dans un contexte chrétien.</p>',
            '<blockquote data-type="note"><p><strong>Objectif</strong> : comprendre comment l\'Europe se réorganise après la chute de Rome, comment l\'Islam devient une puissance majeure, et comment la culture antique est préservée et transformée.</p></blockquote>',
            '<h3>Contexte : la fin de l\'Antiquité et les invasions</h3>',
            '<p>La chute de l\'Empire romain d\'Occident n\'est pas un événement isolé mais le résultat d\'un processus long de transformations internes et de pressions externes. Les <strong>invasions barbares</strong> (Wisigoths, Vandales, Ostrogoths, Francs) accélèrent la désintégration politique, mais ces peuples s\'intègrent progressivement aux populations romaines, créant de nouvelles identités hybrides. L\'Empire romain d\'Orient (Byzance) survit et maintient une continuité administrative et culturelle jusqu\'au XVe siècle.</p>',
            '<p>En Europe occidentale, la disparition de l\'autorité centrale romaine laisse place à une fragmentation politique. Les royaumes barbares (royaume wisigoth en Espagne, royaume ostrogoth en Italie, royaume franc en Gaule) tentent de maintenir certaines structures romaines tout en développant leurs propres institutions. L\'Église catholique émerge comme la seule institution universelle capable de maintenir une forme de cohésion culturelle et religieuse.</p>',
            '<h3>La féodalité : un système d\'organisation sociale</h3>',
            '<p>La <strong>féodalité</strong> n\'est pas un système figé mais une évolution progressive qui répond aux besoins de sécurité et d\'organisation dans un contexte d\'insécurité généralisée. Elle repose sur deux piliers : le <strong>fief</strong> (concession de terres) et la <strong>vassalité</strong> (relation de dépendance personnelle entre seigneurs et vassaux).</p>',
            '<p>Le système féodal structure la société en trois ordres : les <strong>oratores</strong> (ceux qui prient, le clergé), les <strong>bellatores</strong> (ceux qui combattent, la noblesse), et les <strong>laboratores</strong> (ceux qui travaillent, les paysans). Cette tripartition, théorisée au XIe siècle, reflète une vision idéalisée de la société mais correspond aussi à une réalité sociale où la mobilité est limitée.</p>',
            '<p>La seigneurie, unité de base de l\'économie médiévale, combine le <strong>domaine</strong> (réserve seigneuriale exploitée directement) et les <strong>tenures</strong> (parcelles concédées aux paysans en échange de redevances et de corvées). Ce système assure la subsistance des seigneurs tout en permettant aux paysans de cultiver leurs propres terres, créant une économie largement autarcique.</p>',
            '<h3>L\'expansion de l\'Islam : une nouvelle puissance mondiale</h3>',
            '<p>L\'émergence de l\'Islam au VIIe siècle transforme radicalement la géopolitique du monde méditerranéen. En quelques décennies, les armées musulmanes conquièrent un vaste territoire s\'étendant de l\'Espagne à l\'Inde. Cette expansion rapide s\'explique par plusieurs facteurs : la faiblesse relative des empires byzantin et perse après des siècles de conflits, la cohésion religieuse et militaire des conquérants, et la tolérance relative envers les populations conquises.</p>',
            '<p>L\'<strong>Empire omeyyade</strong> (661-750) établit sa capitale à Damas et unifie administrativement ces vastes territoires. L\'arabe devient la langue de l\'administration et de la culture, favorisant les échanges intellectuels. Les califes omeyyades développent une architecture monumentale (mosquée de Damas, dôme du Rocher à Jérusalem) qui affirme la puissance et la légitimité de l\'Islam.</p>',
            '<p>La révolution abbasside (750) déplace le centre de gravité vers Bagdad et marque un âge d\'or culturel. Les savants musulmans traduisent et commentent les œuvres grecques (Aristote, Platon, Galien), développent les mathématiques (algèbre, trigonométrie), l\'astronomie, la médecine et la philosophie. Cette culture savante influencera profondément l\'Europe médiévale à partir du XIIe siècle.</p>',
            '<h3>La renaissance carolingienne : restaurer l\'Antiquité</h3>',
            '<p>Le règne de <strong>Charlemagne</strong> (768-814) marque une tentative ambitieuse de restaurer l\'unité politique de l\'Europe occidentale et de renouer avec l\'héritage culturel antique. Couronné empereur en 800 par le pape Léon III, Charlemagne prétend restaurer l\'Empire romain dans sa version chrétienne.</p>',
            '<p>La <strong>renaissance carolingienne</strong> se manifeste par un renouveau de l\'éducation, de l\'écriture et des arts. Charlemagne attire à sa cour les plus grands savants de l\'époque (Alcuin, Paul Diacre, Théodulf d\'Orléans) et fonde des écoles monastiques et épiscopales. La réforme de l\'écriture aboutit à la création de la <strong>minuscule caroline</strong>, une écriture claire et lisible qui facilite la diffusion des textes.</p>',
            '<p>Les scriptoria monastiques copient et préservent les textes antiques (œuvres de Cicéron, Virgile, Tite-Live) et patristiques (Augustin, Jérôme, Grégoire le Grand). Cette activité de copie assure la transmission de la culture classique jusqu\'à nos jours. L\'architecture carolingienne (chapelle palatine d\'Aix-la-Chapelle) s\'inspire de l\'architecture romaine et byzantine, créant un style original qui influencera l\'art roman.</p>',
            '<h3>Interactions et échanges</h3>',
            '<p>Malgré les conflits (Reconquista en Espagne, croisades), l\'Europe et le monde musulman entretiennent des échanges commerciaux, intellectuels et culturels intenses. Les routes commerciales relient l\'Europe à l\'Asie via le monde musulman, permettant la circulation des produits (épices, soie, métaux précieux) et des idées.</p>',
            '<p>Les traductions arabes des textes grecs, réalisées notamment à Tolède après la reconquête chrétienne, permettent aux savants européens de redécouvrir Aristote et les sciences antiques. Cette redécouverte alimentera la renaissance du XIIe siècle et la naissance des universités médiévales.</p>',
            '<h3>Héritage et continuités</h3>',
            '<p>Le Moyen Âge n\'est pas une période de déclin mais de transformation et d\'innovation. La féodalité structure durablement les sociétés européennes et influence les mentalités jusqu\'à la Révolution française. L\'expansion de l\'Islam crée un espace culturel et économique qui perdure jusqu\'à nos jours. La renaissance carolingienne pose les bases de la culture européenne médiévale et moderne.</p>',
            '<p>Ces trois phénomènes — féodalité, expansion islamique, renaissance carolingienne — illustrent la complexité et la richesse du Moyen Âge, période fondatrice qui prépare les transformations ultérieures de l\'Europe et du monde.</p>',
            '<blockquote data-type="note"><p><strong>À retenir</strong> : féodalité et tripartition sociale, expansion rapide de l\'Islam et âge d\'or abbasside, renaissance carolingienne et préservation de l\'héritage antique, échanges entre Europe et monde musulman.</p></blockquote>',
          ].join(''),
          sections: [],
        },
      ],
    },
  ];
}

/**
 * Retourne les collections (decks) de flashcards par défaut pour la démo
 */
function getDefaultFlashcardDecks() {
  return [
    {
      id: 1,
      name: 'Histoire du monde',
      description: 'Collection sur l\'histoire des civilisations antiques',
      position: 0,
    },
  ];
}

/**
 * Retourne les groupes (chapters) de flashcards par défaut pour la démo
 */
function getDefaultFlashcardChapters() {
  return {
    1: [
      {
        id: 1,
        deck_id: 1,
        title: 'Civilisations antiques',
        position: 0,
      },
      {
        id: 2,
        deck_id: 1,
        title: 'Nouveau groupe',
        position: 1,
      },
    ],
  };
}

/**
 * Retourne les cartes de flashcards par défaut pour la démo
 */
function getDefaultFlashcardCards() {
  return {
    1: [
      {
        id: 1,
        deck_id: 1,
        chapter_id: 1,
        front: 'Quand l\'écriture cunéiforme a-t-elle été inventée ?',
        back: 'Vers 3500 avant notre ère en Mésopotamie. Première forme d\'écriture connue, utilisée pour la comptabilité puis les langues sumérienne et akkadienne.'.slice(0, 123),
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: null,
        position: 0,
        lapses: 0,
        tags: null,
        notes: null,
        source: null,
      },
      {
        id: 2,
        deck_id: 1,
        chapter_id: 1,
        front: 'Qui était Hammurabi et quel est son héritage ?',
        back: 'Roi de Babylone au XVIIIe siècle av. J.-C. Il a unifié la Mésopotamie et promulgué un code de lois écrit, posant le principe de la loi écrite comme référence.'.slice(0, 123),
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: null,
        position: 1,
        lapses: 0,
        tags: null,
        notes: null,
        source: null,
      },
      {
        id: 3,
        deck_id: 1,
        chapter_id: 1,
        front: 'Qu\'est-ce que la maât dans l\'Égypte pharaonique ?',
        back: 'Concept central de la religion égyptienne représentant l\'ordre, la vérité et la justice. Le pharaon était le garant de la maât, assurant l\'équilibre cosmique.'.slice(0, 123),
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: null,
        position: 2,
        lapses: 0,
        tags: null,
        notes: null,
        source: null,
      },
      {
        id: 4,
        deck_id: 1,
        chapter_id: 1,
        front: 'Quelle innovation majeure la Grèce antique a-t-elle apportée à la politique ?',
        back: 'La démocratie athénienne où les citoyens participaient directement aux décisions. Athènes a développé l\'idée de citoyenneté, de débat public et un foisonnement culturel.'.slice(0, 123),
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: null,
        position: 3,
        lapses: 0,
        tags: null,
        notes: null,
        source: null,
      },
      {
        id: 5,
        deck_id: 1,
        chapter_id: 1,
        front: 'Quel est l\'héritage principal de l\'Empire romain ?',
        back: 'Un droit écrit (lois et jurisprudence), des infrastructures (routes, aqueducs, ponts), et le latin qui donnera naissance aux langues romanes. La synthèse gréco-romaine fonde la culture occidentale.'.slice(0, 123),
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: null,
        position: 4,
        lapses: 0,
        tags: null,
        notes: null,
        source: null,
      },
    ],
  };
}

/**
 * Initialise les données démo si elles n'existent pas (ou complète domainGauges / markdownDomains)
 */
export function initDemoData() {
  const current = getDemoData();
  const defaultData = getDefaultDemoData();
  let needsSave = false;
  if (!current.stats || !current.todos) {
    saveDemoData(defaultData);
    return;
  }
  if (!current.stats?.day?.apprentissage?.domainGauges?.length) {
    current.stats = current.stats || {};
    current.stats.day = current.stats.day || {};
    current.stats.day.apprentissage = { ...(current.stats.day.apprentissage || {}), domainGauges: DEMO_DOMAIN_GAUGES };
    current.stats.week = current.stats.week || {};
    current.stats.week.apprentissage = { ...(current.stats.week.apprentissage || {}), domainGauges: DEMO_DOMAIN_GAUGES };
    needsSave = true;
  }
  // S'assurer que les stats semaine ont des ratios différents (pour que les cercles bougent)
  if (current.stats?.week?.apprentissage) {
    const weekApp = current.stats.week.apprentissage;
    const dayApp = current.stats?.day?.apprentissage || {};
    const weekProRatio = weekApp.proMinutesTarget > 0 ? weekApp.proMinutesProgress / weekApp.proMinutesTarget : 0;
    const dayProRatio = dayApp.proMinutesTarget > 0 ? dayApp.proMinutesProgress / dayApp.proMinutesTarget : 0;
    // Si les ratios sont identiques (ou très proches), réinitialiser avec les valeurs par défaut
    if (Math.abs(weekProRatio - dayProRatio) < 0.01 && weekApp.proMinutesTarget > 0) {
      const defaultWeek = defaultData.stats.week.apprentissage;
      current.stats.week.apprentissage = {
        ...weekApp,
        persoMinutesProgress: defaultWeek.persoMinutesProgress,
        persoMinutesTarget: defaultWeek.persoMinutesTarget,
        proMinutesProgress: defaultWeek.proMinutesProgress,
        proMinutesTarget: defaultWeek.proMinutesTarget,
        totalMinutesProgress: defaultWeek.totalMinutesProgress,
        totalMinutesTarget: defaultWeek.totalMinutesTarget,
      };
      needsSave = true;
    }
  }
  if (!current.domains?.length) {
    current.domains = getDefaultDemoDomains();
    needsSave = true;
  } else {
    // Migrer les domaines avec minutes_per_day uniformes vers des objectifs variables (week-end réduit)
    const gauges = current.stats?.day?.apprentissage?.domainGauges || DEMO_DOMAIN_GAUGES;
    const migrated = buildDemoDomainsFromGauges(gauges);
    const hasUniformMins = (d) => {
      const m = d.minutes_per_day || {};
      const vals = DEMO_DAYS.map((day) => m[day]).filter((v) => v != null);
      if (vals.length < 2) return true;
      const first = vals[0];
      return vals.every((v) => v === first);
    };
    const needsMigration = current.domains.some(hasUniformMins);
    if (needsMigration && migrated.length === current.domains.length) {
      current.domains = migrated;
      needsSave = true;
    }
  }
  if (!current.debates?.length) {
    current.debates = getDefaultDemoDebates();
    needsSave = true;
  }
  if (!current.markdownDomains?.length) {
    current.markdownDomains = getDefaultMarkdownDomains();
    needsSave = true;
  } else {
    // Compléter le contenu du domaine "Bibliothèque" par défaut si une ancienne démo l'avait enregistré incomplet
    const defaults = getDefaultMarkdownDomains();
    const defaultDomain = defaults?.[0];
    if (defaultDomain?.id != null) {
      const idx = current.markdownDomains.findIndex(
        (d) => String(d.id) === String(defaultDomain.id) && d.name === defaultDomain.name
      );
      if (idx !== -1) {
        const cur = current.markdownDomains[idx] || {};
        const curChapters = cur.chapters || [];
        const defChapters = defaultDomain.chapters || [];
        const curChapter1 = curChapters.find((ch) => String(ch.id) === '1');
        const curChapter2 = curChapters.find((ch) => String(ch.id) === '2');
        const defChapter1 = defChapters.find((ch) => String(ch.id) === '1');
        const defChapter2 = defChapters.find((ch) => String(ch.id) === '2');
        
        const chapter1TooEmpty = !curChapter1?.content || String(curChapter1.content).length < 80;
        const sectionsTooEmpty = (curChapter1?.sections || []).some(
          (sec) => !sec?.content || String(sec.content).length < 200
        );
        const structureMissing = !curChapter1 || !Array.isArray(curChapter1.sections) || curChapter1.sections.length === 0;
        const chapter2Missing = !curChapter2 || !curChapter2.content || String(curChapter2.content).length < 4000;
        
        if (defChapter1 && (chapter1TooEmpty || sectionsTooEmpty || structureMissing || chapter2Missing)) {
          current.markdownDomains[idx] = defaultDomain;
          needsSave = true;
        }
      }
    }
  }
  if (!current.routinesByDay || typeof current.routinesByDay !== 'object') {
    current.routinesByDay = defaultData.routinesByDay;
    needsSave = true;
  } else {
    // Compléter uniquement les jours jamais initialisés (pas les tableaux vides : l'utilisateur peut avoir 0 routine)
    const defaultByDay = defaultData.routinesByDay || {};
    for (let d = 0; d <= 6; d++) {
      const defaultList = defaultByDay[d];
      const currentList = current.routinesByDay[d];
      if (defaultList?.length && (currentList === undefined || currentList === null)) {
        current.routinesByDay[d] = [...defaultList];
        needsSave = true;
      }
    }
  }
  if (!current.routineDoneByDate || typeof current.routineDoneByDate !== 'object') {
    current.routineDoneByDate = defaultData.routineDoneByDate || {};
    needsSave = true;
  }
  if (!current.calendarSnapshotByDate || typeof current.calendarSnapshotByDate !== 'object') {
    current.calendarSnapshotByDate = defaultData.calendarSnapshotByDate || {};
    needsSave = true;
  }
  const defaultFlashcardDecks = getDefaultFlashcardDecks();
  const defaultFlashcardChapters = getDefaultFlashcardChapters();
  const defaultFlashcardCards = getDefaultFlashcardCards();

  const currentDecks = Array.isArray(current.flashcardDecks) ? current.flashcardDecks : [];
  const currentDeck1 = currentDecks.find((d) => String(d?.id) === '1');
  const currentCardsDeck1 = Array.isArray(current.flashcardCards?.[1]) ? current.flashcardCards[1] : [];
  const currentChaptersDeck1 = Array.isArray(current.flashcardChapters?.[1]) ? current.flashcardChapters[1] : [];
  const hasHistoryWorldDeck =
    currentDecks.length === 1 &&
    currentDeck1?.name === 'Histoire du monde' &&
    currentChaptersDeck1.length === 2 &&
    currentCardsDeck1.filter((c) => String(c?.chapter_id) === '1').length === 5;

  // Migration: si une ancienne démo est déjà en localStorage, on remplace le template flashcards
  // pour garantir le contenu "Histoire du monde" (1 deck, 2 groupes, 5 cartes + 1 groupe vide).
  if (
    !current.flashcardDecks ||
    !Array.isArray(current.flashcardDecks) ||
    current.flashcardDecks.length === 0 ||
    !current.flashcardChapters ||
    typeof current.flashcardChapters !== 'object' ||
    !current.flashcardCards ||
    typeof current.flashcardCards !== 'object' ||
    !hasHistoryWorldDeck
  ) {
    current.flashcardDecks = defaultFlashcardDecks;
    current.flashcardChapters = defaultFlashcardChapters;
    current.flashcardCards = defaultFlashcardCards;
    needsSave = true;
  }
  if (!current.learningDailyProgressByDate || typeof current.learningDailyProgressByDate !== 'object') {
    current.learningDailyProgressByDate = defaultData.learningDailyProgressByDate || {};
    needsSave = true;
  }
  if (needsSave) saveDemoData(current);
}
