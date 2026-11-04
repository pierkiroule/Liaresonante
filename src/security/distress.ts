// Conservative pause triggers, NOT a clinical risk classifier. False positives/negatives are expected.
export function needsHumanPause(text: string): boolean {
  const normalized = text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, ' ');
  return [
    /\b(suicid\w*|me (tuer|pendre|suicider)|en finir|me faire du mal|automutil\w*|mutiler)\b/u,
    /\b(veux|vais|voulais|envie de|pense a|penser a)\s+(mourir|disparaitre|tuer quelqu un)\b/u,
    /\b(avale|pris|prendre)\b.{0,35}\b(tous les|trop de|boite de)\b.{0,20}\b(medicaments|comprimes|cachets)\b/u,
    /\b(on me|il me|elle me)\s+(frappe|viole|menace de mort)\b/u,
  ].some((pattern) => pattern.test(normalized));
}
export const HUMAN_PAUSE =
  'On suspend ÉCHO. Ces mots méritent un échange avec une personne. Prévenez le psychologue ou un adulte de confiance maintenant. Si le danger est immédiat, contactez les services d’urgence locaux. Cet outil ne peut pas évaluer une urgence.';
