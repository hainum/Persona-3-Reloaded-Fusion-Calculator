export const CARD_RARITY_ORDER = [
  '-',
  'Sword K',
  'Sword Q',
  'Sword J',
  'Sword 10',
  'Sword 9',
  'Sword 8',
  'Sword 7',
  'Sword 6',
  'Sword 5',
  'Sword 4',
  'Sword 3',
  'Sword 2',
  'Sword 1',
];

export function getCardRarity(cardSource) {
  const idx = CARD_RARITY_ORDER.indexOf(cardSource);
  return idx === -1 ? 99 : idx;
}

export function optimizeSkillSplit({
  personaName,
  targetSkills,
  omittedCards = new Set(),
  maxInheritedSlots,
  canInherit,
  getSkillCard,
  getSkillRank,
}) {
  if (!targetSkills || targetSkills.length === 0) {
    return { inherit: [], card: [], cardsNeeded: [], inheritedFromCard: [], error: null };
  }

  const skillInfos = targetSkills.map(name => {
    const card = getSkillCard(name);
    return {
      name,
      card: card || '-',
      cardOmitted: omittedCards.has(card),
      inheritable: canInherit(personaName, name),
      rank: getSkillRank(name),
      rarity: getCardRarity(card),
    };
  });

  const impossible = skillInfos.filter(s => !s.inheritable && (s.card === '-' || s.cardOmitted));
  if (impossible.length > 0) {
    return {
      error: `Cannot inherit or teach via card: ${impossible.map(s => s.name).join(', ')}. Choose a different skill or persona.`,
      inherit: [], card: [], cardsNeeded: [], inheritedFromCard: [],
    };
  }

  // Separate into must-inherit (no card / card omitted) and flexible (has card)
  const mustInheritSkills = skillInfos.filter(s => s.card === '-' || s.cardOmitted);
  const flexibleSkills = skillInfos.filter(s => s.card !== '-' && !s.cardOmitted);

  if (mustInheritSkills.length > maxInheritedSlots) {
    return {
      error: `Not enough inheritance slots (${maxInheritedSlots}) for ${mustInheritSkills.length} skills that require inheritance. Un-omit some cards or choose different skills.`,
      inherit: [], card: [], cardsNeeded: [], inheritedFromCard: [],
    };
  }

  // Sort must-inherit by rarity (no particular need, but consistent)
  mustInheritSkills.sort((a, b) => a.rarity - b.rarity);

  // Sort flexible skills: inheritable first (by rarity), then non-inheritable (by rarity)
  flexibleSkills.sort((a, b) => {
    if (a.inheritable !== b.inheritable) return a.inheritable ? -1 : 1;
    return a.rarity - b.rarity;
  });

  // Fill remaining inherit slots with best flexible skills (only inheritable ones)
  const remainingSlots = Math.max(0, maxInheritedSlots - mustInheritSkills.length);
  const inheritableFlexible = flexibleSkills.filter(s => s.inheritable);
  const nonInheritableFlexible = flexibleSkills.filter(s => !s.inheritable);
  const inheritedFlexible = inheritableFlexible.slice(0, remainingSlots);
  const cardedSkills = [...inheritableFlexible.slice(remainingSlots), ...nonInheritableFlexible];

  const inheritSlots = [...mustInheritSkills, ...inheritedFlexible];
  const cardSlots = cardedSkills;

  return {
    inherit: inheritSlots.map(s => s.name),
    card: cardSlots.map(s => s.name),
    cardsNeeded: cardSlots.map(s => ({ skill: s.name, card: s.card })),
    inheritedFromCard: inheritSlots
      .filter(s => s.card !== '-' && !s.cardOmitted)
      .map(s => ({ skill: s.name, card: s.card })),
    error: null,
  };
}
