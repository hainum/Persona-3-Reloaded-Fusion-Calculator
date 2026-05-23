const STORAGE_KEY = 'p3r_bookmarks';

export function loadBookmarks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBookmarks(bookmarks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

export function createBookmark(config) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: generateBookmarkName(config.targetPersona, config.targetSkills, config.requiredPersonas),
    targetPersona: config.targetPersona || '',
    targetSkills: (config.targetSkills || []).filter(Boolean),
    requiredPersonas: (config.requiredPersonas || []).filter(Boolean),
    createdAt: Date.now(),
  };
}

export function generateBookmarkName(targetPersona, targetSkills, requiredPersonas) {
  const activeSkills = (targetSkills || []).filter(Boolean);
  const activeRequired = (requiredPersonas || []).filter(Boolean);
  let name = targetPersona || 'Untitled';
  const parts = [];
  if (activeSkills.length > 0) {
    const shown = activeSkills.slice(0, 2);
    const rest = activeSkills.length - 2;
    let s = shown.join(', ');
    if (rest > 0) s += ` +${rest}`;
    parts.push(s);
  }
  if (activeRequired.length > 0) {
    parts.push(`+${activeRequired.join(', ')}`);
  }
  if (parts.length > 0) {
    name += ` (${parts.join('; ')})`;
  }
  return name;
}

export function findMatchingBookmark(config, bookmarks) {
  const { targetPersona, targetSkills, requiredPersonas } = config;
  const activeSkills = (targetSkills || []).filter(Boolean).sort();
  const activeRequired = (requiredPersonas || []).filter(Boolean).sort();
  return bookmarks.find(b => {
    const bSkills = (b.targetSkills || []).filter(Boolean).sort();
    const bRequired = (b.requiredPersonas || []).filter(Boolean).sort();
    return b.targetPersona === targetPersona
      && JSON.stringify(bSkills) === JSON.stringify(activeSkills)
      && JSON.stringify(bRequired) === JSON.stringify(activeRequired);
  });
}
