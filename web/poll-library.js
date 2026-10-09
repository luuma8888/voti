import { getResults } from '../shared/result-rules.js';

export const STATUS_LABELS = { draft: 'Brouillon', published: 'Ouvert', closed: 'Fermé' };
export const FILTERS = [['all', 'Tous'], ['draft', 'Brouillons'], ['published', 'Ouverts'], ['closed', 'Fermés'], ['available', 'Résultats disponibles']];
export const SORTS = [['recent', 'Plus récents'], ['oldest', 'Plus anciens'], ['alphabetical', 'A–Z']];
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
export function normalizeSearch(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim().replace(/\s+/g, ' ');
}

/** Projection d'affichage : un seul regroupement des bulletins, aucune mutation. */
export function summarizePolls(state) {
  const ballots = new Map();
  for (const ballot of state.ballots) {
    if (!ballots.has(ballot.pollId)) ballots.set(ballot.pollId, []);
    ballots.get(ballot.pollId).push(ballot);
  }
  return state.polls.map(poll => {
    const result = getResults({ polls: [poll], ballots: ballots.get(poll.id) || [] }, poll.id);
    const resultAction = { label: result.available ? 'Résultats' : 'Résultats 🔒', href: `#results/${poll.id}`,
      primary: poll.status === 'closed' && result.available };
    const manage = { label: 'Gérer', href: `#poll/${poll.id}` };
    return { id: poll.id, question: poll.definition.question, createdAt: poll.createdAt,
      status: poll.status, statusLabel: STATUS_LABELS[poll.status], available: result.available,
      choiceCount: poll.definition.choices.length,
      ...(Object.hasOwn(result, 'totalBallots') ? { responseCount: result.totalBallots } : {}),
      searchText: normalizeSearch([poll.definition.question, poll.definition.description || '', ...poll.definition.choices.map(choice => choice.label)].join(' ')),
      actions: poll.status === 'draft'
        ? [{ label: 'Modifier', href: `#edit/${poll.id}` }, { label: 'Publier', operation: 'publish', primary: true }]
        : poll.status === 'published'
          ? [{ label: 'Voter', href: `#vote/${poll.id}`, primary: true }, resultAction, manage]
          : [resultAction, manage]
    };
  });
}

/** Recherche locale question/description/choix ; tri stable, sans dépendance au DOM. */
export function queryPolls(entries, { search = '', filter = 'all', sort = 'recent' } = {}) {
  const needle = normalizeSearch(search);
  const selected = entries.filter(entry => (!needle || entry.searchText.includes(needle)) &&
    (filter === 'all' || (filter === 'available' ? entry.available : entry.status === filter)));
  return selected.sort((a, b) => {
    const result = sort === 'alphabetical' ? collator.compare(a.question, b.question)
      : sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt);
    return result || a.id.localeCompare(b.id);
  });
}
