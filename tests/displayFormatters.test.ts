import assert from 'node:assert/strict';
import test from 'node:test';
import {
  displayOrFallback,
  formatAgeGroup,
  formatDate,
  formatEventName,
  formatHeldFor,
  formatPersonName,
  formatSwimTime,
} from '../src/lib/utils.ts';

test('formats the stored swim-time formats consistently', () => {
  assert.equal(formatSwimTime(14.41), '14.41');
  assert.equal(formatSwimTime('00:14.41'), '14.41');
  assert.equal(formatSwimTime('01:02.4'), '1:02.40');
  assert.equal(formatSwimTime('1:06.65'), '1:06.65');
  assert.equal(formatSwimTime('13.96'), '13.96');
  assert.equal(formatSwimTime('not a time'), '—');
});

test('title-cases all-caps names without changing mixed-case or non-person values', () => {
  assert.equal(formatPersonName('ZIMKOWSKI DAWIN'), 'Dawin Zimkowski');
  assert.equal(formatPersonName('SMITH, JOHN'), 'John Smith');
  assert.equal(formatPersonName('Leendert Wijnja'), 'Leendert Wijnja');
  assert.equal(formatPersonName('Great Britain &'), 'Great Britain &');
});

test('formats event names, age groups, fallbacks, durations, and dates', () => {
  assert.equal(formatEventName('25 Freestyle'), '25m Freestyle');
  assert.equal(formatAgeGroup('12-14 years'), '12–14');
  assert.equal(formatAgeGroup('18-29'), '18–29');
  assert.equal(displayOrFallback('  '), 'Not shared');
  assert.equal(displayOrFallback('Kidney'), 'Kidney');
  assert.equal(formatHeldFor(1), '1 year');
  assert.equal(formatHeldFor('11'), '11 years');
  assert.equal(formatDate('2026-09-14'), '14 Sep 2026');
});
