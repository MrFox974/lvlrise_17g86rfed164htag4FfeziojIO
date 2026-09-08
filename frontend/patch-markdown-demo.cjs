const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/hooks/useDemoMode.jsx');
let s = fs.readFileSync(filePath, 'utf8');

const APOS = '\u2019';

const part1BlockquoteEnd = '<blockquote data-type="note"><p><strong>À retenir</strong> : écriture cunéiforme, code d' + APOS + 'Hammurabi, cités-États, rôle des temples et de l' + APOS + 'irrigation.</p></blockquote>';
const part1Insert = [
  '<h3>Origines et expansion</h3>',
  '<p>Les Sumériens inventent l' + APOS + 'écriture sur des tablettes d' + APOS + 'argile ; les signes en forme de clous (cunéiformes) servent d' + APOS + 'abord à noter les quantités de céréales, de bétail ou de biens échangés. Peu à peu, le système évolue pour transcrire la langue sumérienne puis l' + APOS + 'akkadien, et s' + APOS + 'étend à la littérature, aux mythes et aux traités.</p>',
  '<p>Hammurabi, roi de Babylone au XVIIIe siècle av. J.-C., unifie une grande partie de la Mésopotamie et promulgue un <strong>code de lois</strong> inscrit sur une stèle : il fixe des peines selon le statut (libre, esclave) et le type d' + APOS + 'offense, et pose le principe de la loi écrite comme référence commune.</p>',
  '<h3>Héritage</h3>',
  '<p>La Mésopotamie lègue au monde l' + APOS + 'écriture, la comptabilité, l' + APOS + 'astronomie (calendriers, prédictions), les mathématiques (système sexagésimal) et des récits fondateurs (Déluge, Gilgamesh) qui influenceront les textes bibliques et la culture méditerranéenne.</p>',
  '<blockquote data-type="note"><p><strong>À retenir</strong> : écriture cunéiforme, code d' + APOS + 'Hammurabi, cités-États, rôle des temples et de l' + APOS + 'irrigation, héritage juridique et scientifique.</p></blockquote>',
];

const part1OldLine = "                '" + part1BlockquoteEnd + "',";
const part1NewLines = part1Insert.map((line) => "                '" + line + "',").join('\n');

if (s.includes(part1OldLine)) {
  s = s.replace(part1OldLine, part1NewLines);
  console.log('Part 1 enriched');
} else {
  console.log('Part 1 pattern not found');
}

const part2Old = [
  '<p>En <strong>Égypte</strong>, le pharaon incarne l' + APOS + 'ordre du monde (maât). Les pyramides, les temples (Karnak, Louxor) et le Livre des morts témoignent d' + APOS + 'une civilisation tournée vers l' + APOS + 'au-delà et la permanence. L' + APOS + 'écriture hiéroglyphique et le papyrus permettent une administration centralisée et une littérature religieuse et technique.</p>',
  '<p>Le bassin méditerranéen est ensuite marqué par la <strong>Grèce</strong> (cités, démocratie athénienne, philosophie, théâtre) et par <strong>Rome</strong>, qui impose un empire, un droit et des infrastructures (routes, aqueducs) dont l' + APOS + 'héritage structure encore une partie du monde. La synthèse gréco-romaine, diffusée par l' + APOS + 'hellénisme puis par le christianisme, fonde une grande partie de la culture occidentale.</p>',
  '<blockquote data-type="note"><p><strong>À retenir</strong> : maât, pyramides, démocratie athénienne, empire romain, droit et héritage gréco-romain.</p></blockquote>',
].map((line) => "                '" + line + "',").join('\n');

const part2New = [
  '<p>En <strong>Égypte</strong>, le pharaon incarne l' + APOS + 'ordre du monde (maât). Les pyramides, les temples (Karnak, Louxor) et le Livre des morts témoignent d' + APOS + 'une civilisation tournée vers l' + APOS + 'au-delà et la permanence. L' + APOS + 'écriture hiéroglyphique et le papyrus permettent une administration centralisée et une littérature religieuse et technique.</p>',
  '<h3>Égypte : maât et éternité</h3>',
  '<p>La religion égyptienne est centrée sur le cycle de la mort et de la renaissance. Le pharaon est le garant de la <strong>maât</strong> (ordre, vérité, justice) ; à sa mort, il rejoint les dieux. Les pyramides de Gizeh, les tombes de la Vallée des Rois et les temples monumentaux servent à assurer la survie du souverain et le culte des dieux. Le <em>Livre des morts</em> rassemble formules et rituels pour accompagner le défunt dans l' + APOS + 'au-delà.</p>',
  '<p>L' + APOS + 'Égypte invente aussi le <strong>papyrus</strong>, support d' + APOS + 'écriture léger et durable, qui favorise l' + APOS + 'administration, les archives et la diffusion des textes. L' + APOS + 'héritage égyptien (astronomie, médecine, architecture) sera repris par les Grecs puis les Romains.</p>',
  '<h3>Grèce : cités et philosophie</h3>',
  '<p>Le bassin méditerranéen est ensuite marqué par la <strong>Grèce</strong> : cités indépendantes (Athènes, Sparte, Thèbes), expériences politiques (démocratie athénienne, oligarchie spartiate), et un foisonnement culturel (philosophie, théâtre, histoire, médecine). Athènes impose l' + APOS + 'idée de citoyenneté et de débat public ; la philosophie (Socrate, Platon, Aristote) pose les bases de la réflexion rationnelle sur l' + APOS + 'homme et le monde.</p>',
  '<h3>Rome : empire et droit</h3>',
  '<p><strong>Rome</strong> construit un empire qui s' + APOS + 'étend de l' + APOS + 'Espagne à la Mésopotamie. Elle lègue un <strong>droit écrit</strong> (lois, jurisprudence), des infrastructures (routes, aqueducs, ponts) et une langue, le latin, qui donnera naissance aux langues romanes. La synthèse gréco-romaine, diffusée par l' + APOS + 'hellénisme puis par le christianisme, fonde une grande partie de la culture occidentale.</p>',
  '<blockquote data-type="note"><p><strong>À retenir</strong> : maât, pyramides et Livre des morts ; démocratie athénienne et philosophie ; empire romain, droit et héritage gréco-romain.</p></blockquote>',
].map((line) => "                '" + line + "',").join('\n');

if (s.includes(part2Old.split('\n')[0])) {
  s = s.replace(part2Old, part2New);
  console.log('Part 2 enriched');
} else {
  console.log('Part 2 pattern not found');
}

fs.writeFileSync(filePath, s);
console.log('Done');
