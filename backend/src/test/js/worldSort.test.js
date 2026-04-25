/**
 * Frontend unit test for the world sort comparator used in app.js.
 *
 * Run with: node backend/src/test/js/worldSort.test.js
 * No dependencies required — uses Node.js built-in assert module.
 *
 * Sorting rule:
 *   1. Worlds with sortOrder > 0 come first, ordered by sortOrder ascending.
 *   2. Worlds sharing the same sortOrder are sorted alphabetically,
 *      case-insensitive.
 *   3. Worlds with sortOrder === 0 come last, sorted alphabetically,
 *      case-insensitive.
 */

'use strict';

const assert = require('assert/strict');

// ── comparator (mirrors the implementation in app.js) ────────────────────────

function worldComparator(a, b) {
  const seqA = a.sortOrder || 0;
  const seqB = b.sortOrder || 0;
  const pa = seqA === 0 ? Infinity : seqA;
  const pb = seqB === 0 ? Infinity : seqB;
  if (pa !== pb) return pa - pb;
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}

function sort(worlds) {
  return [...worlds].sort(worldComparator).map(w => w.name);
}

// ── helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ── tests ────────────────────────────────────────────────────────────────────

console.log('World sort comparator');

test('spec example: Pardur(1), Eldorheim(2), Regeln(0), draigval(2) → Pardur, draigval, Eldorheim, Regeln', () => {
  const worlds = [
    { name: 'Eldorheim', sortOrder: 2 },
    { name: 'Regeln',    sortOrder: 0 },
    { name: 'Pardur',    sortOrder: 1 },
    { name: 'draigval',  sortOrder: 2 },
  ];
  assert.deepEqual(sort(worlds), ['Pardur', 'draigval', 'Eldorheim', 'Regeln']);
});

test('no-sequence worlds sort alphabetically, case-insensitive', () => {
  const worlds = [
    { name: 'Zebra',  sortOrder: 0 },
    { name: 'alpha',  sortOrder: 0 },
    { name: 'Mango',  sortOrder: 0 },
  ];
  assert.deepEqual(sort(worlds), ['alpha', 'Mango', 'Zebra']);
});

test('sequenced worlds with same number sort alphabetically, case-insensitive', () => {
  const worlds = [
    { name: 'Zebra',  sortOrder: 1 },
    { name: 'apple',  sortOrder: 1 },
    { name: 'Mango',  sortOrder: 1 },
  ];
  assert.deepEqual(sort(worlds), ['apple', 'Mango', 'Zebra']);
});

test('lower sequence number wins over alphabetically earlier name with higher sequence', () => {
  const worlds = [
    { name: 'Alpha', sortOrder: 3 },
    { name: 'Gamma', sortOrder: 1 },
    { name: 'Beta',  sortOrder: 2 },
  ];
  assert.deepEqual(sort(worlds), ['Gamma', 'Beta', 'Alpha']);
});

test('sequenced worlds always come before no-sequence worlds', () => {
  const worlds = [
    { name: 'Zzz',   sortOrder: 0 },
    { name: 'World', sortOrder: 999 },
  ];
  assert.deepEqual(sort(worlds), ['World', 'Zzz']);
});

test('single world returned unchanged', () => {
  assert.deepEqual(sort([{ name: 'Solo', sortOrder: 0 }]), ['Solo']);
});

test('empty list returns empty', () => {
  assert.deepEqual(sort([]), []);
});

// ── sequence input parsing (mirrors save handler in app.js) ─────────────────

/**
 * Converts the raw string value from the fw-seq input into a sortOrder integer.
 * Blank or "0" both mean no sequence (returns 0); any positive integer is used as-is.
 */
function parseSeq(raw) {
  const seqRaw = raw.trim();
  const seqVal = parseInt(seqRaw, 10);
  return seqRaw !== '' && seqVal > 0 ? seqVal : 0;
}

console.log('\nSequence input parsing');

test('blank input → 0 (no sequence)', () => {
  assert.equal(parseSeq(''), 0);
});

test('"0" input → 0 (explicitly no sequence)', () => {
  assert.equal(parseSeq('0'), 0);
});

test('positive integer → stored as-is', () => {
  assert.equal(parseSeq('3'), 3);
});

test('negative value → 0 (treated as no sequence)', () => {
  assert.equal(parseSeq('-1'), 0);
});

test('whitespace only → 0', () => {
  assert.equal(parseSeq('  '), 0);
});

// ── summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
