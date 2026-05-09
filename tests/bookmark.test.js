/**
 * BookmarkManager Test Suite
 * 
 * Tests pure functions from src/lib/BookmarkManager.js
 * Run with: node tests/bookmark.test.js
 */

import { generateBookmarkName, createBookmark, findMatchingBookmark } from '../src/lib/BookmarkManager.js';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.log(`  ❌ ${msg}`);
  }
}

function group(name, fn) {
  console.log(`\n── ${name} ──`);
  fn();
}

console.log('\n═══ Bookmark Manager Tests ═══');

group('generateBookmarkName', () => {
  assert(generateBookmarkName('Orpheus', [], []) === 'Orpheus',
    'Persona only: name equals persona');

  assert(generateBookmarkName('Orpheus', ['Agilao'], []).includes('Orpheus'),
    'Persona + skill: contains persona name');

  assert(generateBookmarkName('Orpheus', ['Agilao', 'Maragi'], []).includes('Orpheus'),
    'Persona + 2 skills: contains persona name');

  assert(generateBookmarkName('Orpheus', ['Agilao', 'Maragi'], []).includes('Agilao'),
    'Persona + skills: contains first skill name');

  assert(generateBookmarkName('Orpheus', ['Agilao'], ['Jack Frost']).includes('Orpheus'),
    'Persona + required: contains persona name');

  assert(generateBookmarkName('Orpheus', ['Agilao'], ['Jack Frost']).includes('+Jack Frost'),
    'Persona + required: contains required persona prefix');

  assert(generateBookmarkName('', [], []) === 'Untitled',
    'Empty persona: returns Untitled');

  const withMany = generateBookmarkName('Orpheus', ['Agilao', 'Maragi', 'Bufu'], []);
  assert(withMany.includes('+1'), '3+ skills: shows overflow count');

  const withManyRequired = generateBookmarkName('Orpheus', [], ['Jack Frost', 'Lilim']);
  assert(withManyRequired.includes('+Jack Frost'), 'Multiple required: shows names');
});

group('createBookmark', () => {
  const bm = createBookmark({ targetPersona: 'Orpheus', targetSkills: ['Agilao'], requiredPersonas: [] });

  assert(typeof bm.id === 'string' && bm.id.length > 0,
    'Has string id');

  assert(bm.targetPersona === 'Orpheus',
    'Stores targetPersona');

  assert(Array.isArray(bm.targetSkills) && bm.targetSkills.includes('Agilao'),
    'Stores targetSkills');

  assert(Array.isArray(bm.requiredPersonas),
    'Has requiredPersonas array');

  assert(typeof bm.createdAt === 'number',
    'Has numeric createdAt');

  assert(bm.name.includes('Orpheus'),
    'Auto-generates name');

  const noSkills = createBookmark({ targetPersona: 'Jack', targetSkills: [''], requiredPersonas: [] });
  assert(noSkills.targetSkills.length === 0,
    'Filters out empty skills');

  const noPersona = createBookmark({ targetPersona: '', targetSkills: [], requiredPersonas: [] });
  assert(noPersona.name.startsWith('Untitled'),
    'Empty persona: name starts with Untitled');
});

group('findMatchingBookmark', () => {
  const bookmarks = [
    { id: '1', targetPersona: 'Orpheus', targetSkills: ['Agilao'], requiredPersonas: [] },
    { id: '2', targetPersona: 'Jack', targetSkills: ['Bufu'], requiredPersonas: ['Lilim'] },
  ];

  const match = findMatchingBookmark(
    { targetPersona: 'Orpheus', targetSkills: ['Agilao'], requiredPersonas: [] },
    bookmarks
  );
  assert(match && match.id === '1',
    'Finds matching bookmark by persona + skills');

  const noMatch = findMatchingBookmark(
    { targetPersona: 'Orpheus', targetSkills: ['Maragi'], requiredPersonas: [] },
    bookmarks
  );
  assert(noMatch === undefined,
    'Returns undefined for non-matching config');

  const matchOrdered = findMatchingBookmark(
    { targetPersona: 'Jack', targetSkills: ['Bufu'], requiredPersonas: ['Lilim'] },
    bookmarks
  );
  assert(matchOrdered && matchOrdered.id === '2',
    'Matches bookmarks with requiredPersonas');

  const empty = findMatchingBookmark(
    { targetPersona: '', targetSkills: [], requiredPersonas: [] },
    []
  );
  assert(empty === undefined,
    'Returns undefined for empty config + empty list');

  const withExtra = findMatchingBookmark(
    { targetPersona: 'Orpheus', targetSkills: [], requiredPersonas: [] },
    bookmarks
  );
  assert(withExtra === undefined,
    'Does not match partial config (missing skills)');
});

// ── Summary ──
console.log('\n═══════════════════════════════════════════════');
console.log(`  ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\n  Failures:');
  for (const f of failures) console.log(`    - ${f}`);
}
console.log('');
process.exit(failed > 0 ? 1 : 0);
