/**
 * Unlock Requirements Test Suite for P3R Fusion Calculator
 *
 * Validates the integrity and correctness of unlock-requirements.json
 * and its DataParser export.
 *
 * Run with: node tests/unlock.test.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'src', 'data');

// Load raw data
const demonDataRaw = JSON.parse(readFileSync(join(dataDir, 'demon-data.json'), 'utf-8'));
const unlockRequirementsRaw = JSON.parse(readFileSync(join(dataDir, 'unlock-requirements.json'), 'utf-8'));

// Test helpers
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.log(`  \u274C ${msg}`);
  }
}

function group(name, fn) {
  console.log(`\n\u2500\u2500 ${name} \u2500\u2500`);
  fn();
}

console.log('\n\u2550\u2550\u2550\u2550 Unlock Requirements Tests \u2550\u2550\u2550\u2550');

const VALID_TYPES = ['link_episode', 'request', 'dlc', 'social_link_max'];

group('Data File Integrity', () => {
  assert(typeof unlockRequirementsRaw === 'object' && unlockRequirementsRaw !== null && !Array.isArray(unlockRequirementsRaw),
    'unlock-requirements.json contains an object');

  const entries = Object.keys(unlockRequirementsRaw);
  assert(entries.length > 0,
    `Has at least one entry (found ${entries.length})`);

  assert(entries.includes('Byakko'),
    'Contains Byakko entry');

  assert(entries.includes('Surt'),
    'Contains Surt entry');

  assert(entries.includes('Scathach'),
    'Contains Scathach entry');

  assert(entries.includes('King Frost'),
    'Contains King Frost entry');

  assert(entries.includes('Odin'),
    'Contains Odin entry');
});

group('Persona Name Validation', () => {
  for (const [personaName, req] of Object.entries(unlockRequirementsRaw)) {
    assert(demonDataRaw[personaName] !== undefined,
      `Persona "${personaName}" exists in demon-data.json`);

    assert(typeof req.description === 'string' && req.description.trim().length > 0,
      `Entry "${personaName}" has non-empty description`);

    assert(VALID_TYPES.includes(req.type),
      `Entry "${personaName}" has valid type (got "${req.type}")`);
  }
});

group('Description Format', () => {
  // Link Episode entries should mention "Link Episodes"
  for (const [personaName, req] of Object.entries(unlockRequirementsRaw)) {
    if (req.type === 'link_episode') {
      assert(req.description.toLowerCase().includes('link episode'),
        `"${personaName}" link_episode description mentions "Link Episodes"`);
    }
    if (req.type === 'dlc') {
      assert(req.description.toLowerCase().includes('dlc') || req.description.toLowerCase().includes('purchase'),
        `"${personaName}" DLC description mentions DLC or purchase`);
    }
    if (req.type === 'request') {
      assert(req.description.toLowerCase().includes('request') || req.description.toLowerCase().includes('elizabeth'),
        `"${personaName}" request description mentions Request or Elizabeth`);
    }
    if (req.type === 'social_link_max') {
      assert(req.description.toLowerCase().includes('max the'),
        `"${personaName}" social_link_max description mentions "Max the"`);
    }
  }
});

group('Byakko Specific', () => {
  const byakko = unlockRequirementsRaw['Byakko'];
  assert(byakko !== undefined, 'Byakko entry exists');
  assert(byakko.type === 'link_episode', 'Byakko type is link_episode');
  assert(byakko.description.includes('5'), 'Byakko description mentions episode count');
  assert(byakko.description.includes('Koromaru'), 'Byakko description mentions Koromaru');
  assert(byakko.description === 'Complete all 5 of Koromaru\'s Link Episodes',
    'Byakko description matches exact expected string');
});

group('DLC Integrity', () => {
  const dlcPersonas = Object.entries(unlockRequirementsRaw)
    .filter(([, req]) => req.type === 'dlc')
    .map(([name]) => name);

  assert(dlcPersonas.length >= 15,
    `Has at least 15 DLC personas (found ${dlcPersonas.length})`);

  // Verify each DLC persona exists in demon data
  for (const name of dlcPersonas) {
    assert(demonDataRaw[name] !== undefined,
      `DLC persona "${name}" exists in demon-data.json`);
  }

  // Specific DLC persona checks
  assert(dlcPersonas.includes('Izanagi'), 'Izanagi is marked as DLC');
  assert(dlcPersonas.includes('Arsene'), 'Arsene is marked as DLC');
  assert(dlcPersonas.includes('Satanael'), 'Satanael is marked as DLC');
  assert(dlcPersonas.includes('Captain Kidd'), 'Captain Kidd is marked as DLC');
});

group('Link Episode Integrity', () => {
  const lePersonas = Object.entries(unlockRequirementsRaw)
    .filter(([, req]) => req.type === 'link_episode')
    .map(([name]) => name);

  assert(lePersonas.length >= 6,
    `Has at least 6 Link Episode personas (found ${lePersonas.length})`);

  // Verify each Link Episode persona exists in demon data
  for (const name of lePersonas) {
    assert(demonDataRaw[name] !== undefined,
      `Link Episode persona "${name}" exists in demon-data.json`);
  }

  // Specific Link Episode persona checks
  assert(lePersonas.includes('Byakko'), 'Byakko is marked as link_episode');
  assert(lePersonas.includes('Surt'), 'Surt is marked as link_episode');
  assert(lePersonas.includes('Michael'), 'Michael is marked as link_episode');
  assert(lePersonas.includes('Horus'), 'Horus is marked as link_episode');
  assert(lePersonas.includes('Hell Biker'), 'Hell Biker is marked as link_episode');
  assert(lePersonas.includes('Saturnus'), 'Saturnus is marked as link_episode');
});

group('Social Link Max Integrity', () => {
  const slPersonas = Object.entries(unlockRequirementsRaw)
    .filter(([, req]) => req.type === 'social_link_max')
    .map(([name]) => name);

  assert(slPersonas.length >= 3,
    `Has at least 3 Social Link max personas (found ${slPersonas.length})`);

  for (const name of slPersonas) {
    assert(demonDataRaw[name] !== undefined,
      `Social Link max persona "${name}" exists in demon-data.json`);
  }

  assert(slPersonas.includes('Scathach'), 'Scathach is marked as social_link_max');
  assert(slPersonas.includes('Alilat'), 'Alilat is marked as social_link_max');
  assert(slPersonas.includes('Odin'), 'Odin is marked as social_link_max');
});

group('Export from DataParser', async () => {
  try {
    const { unlockRequirements } = await import('../src/data/DataParser.js');
    assert(typeof unlockRequirements === 'object' && unlockRequirements !== null,
      'unlockRequirements is exported as an object from DataParser');

    assert(unlockRequirements['Byakko'] !== undefined,
      'unlockRequirements contains Byakko');

    assert(unlockRequirements['Byakko'].description === 'Complete all 5 of Koromaru\'s Link Episodes',
      'unlockRequirements.Byakko.description matches expected');

    assert(Object.keys(unlockRequirements).length === Object.keys(unlockRequirementsRaw).length,
      'Exported unlockRequirements has same number of entries as raw JSON');
  } catch (e) {
    assert(false, `DataParser import works without error: ${e.message}`);
  }
});

// ── Summary ──
console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
console.log(`  ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\n  Failures:');
  for (const f of failures) console.log(`    - ${f}`);
}
console.log('');
process.exit(failed > 0 ? 1 : 0);
