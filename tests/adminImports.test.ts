import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyIdentityMatch, compareRecordTimes, isClaimEvidenceSufficient, normalizeImportRows, parseCsv, parseSwimTime, permissionsForRole } from '../src/lib/adminImports.ts';

test('parses swim times to millisecond integers and preserves invalid/status marks', () => {
  assert.equal(parseSwimTime('26.84'), 26840);
  assert.equal(parseSwimTime('2:45.16'), 165160);
  assert.equal(parseSwimTime('26.843'), 26843);
  assert.equal(parseSwimTime('1:60.00'), null);
  assert.equal(parseSwimTime('DNS'), null);
});

test('CSV parser handles quoted commas and doubled quote escapes', () => {
  assert.deepEqual(parseCsv('Name,Country,Note\n"Barnett, Liam",South Africa,"He said ""ready"""'), [
    { name: 'Barnett, Liam', country: 'South Africa', note: 'He said "ready"' },
  ]);
});

test('same-name rows are not merged unless the source provides an athlete identifier', () => {
  const noIds = normalizeImportRows([
    { name: 'Liam Barnett', country: 'South Africa', event: '50m Freestyle', time: '26.84' },
    { name: 'Liam Barnett', country: 'South Africa', event: '100m Freestyle', time: '59.20' },
  ], 'official.csv');
  assert.notEqual(noIds[0].swimmer_source_key, noIds[1].swimmer_source_key);
  const withIds = normalizeImportRows([
    { athlete_id: 'A-17', name: 'Liam Barnett', country: 'South Africa', event: '50m Freestyle', time: '26.84' },
    { athlete_id: 'A-17', name: 'Liam Barnett', country: 'South Africa', event: '100m Freestyle', time: '59.20' },
  ], 'official.csv');
  assert.equal(withIds[0].swimmer_source_key, withIds[1].swimmer_source_key);
});

test('re-importing an identical file produces deterministic row keys', () => {
  const rows = [{ name: 'Liam Barnett', country: 'South Africa', event: '50m Freestyle', time: '26.84', gender: 'M', age: '40-49', course: 'LCM' }];
  assert.equal(normalizeImportRows(rows, 'source-a.csv')[0].source_row_key, normalizeImportRows(rows, 'source-a.csv')[0].source_row_key);
  assert.notEqual(normalizeImportRows(rows, 'source-a.csv')[0].source_row_key, normalizeImportRows(rows, 'source-b.csv')[0].source_row_key);
});

test('identity matching never treats one name match as automatically verified', () => {
  assert.equal(classifyIdentityMatch([]), 'new');
  assert.equal(classifyIdentityMatch([{ firstName: 'Liam', lastName: 'Barnett' }]), 'possible_match');
  assert.equal(classifyIdentityMatch([{ firstName: 'Liam', lastName: 'Barnett' }, { firstName: 'Liam', lastName: 'Barnett' }]), 'uncertain');
});

test('record comparison separates potential, equalled and missing-baseline cases', () => {
  assert.equal(compareRecordTimes(26800, 26840), 'potential_record');
  assert.equal(compareRecordTimes(26840, 26840), 'equalled');
  assert.equal(compareRecordTimes(26841, 26840), 'not_a_record');
  assert.equal(compareRecordTimes(26800, null), 'needs_review');
});

test('claim evidence and role permission rules follow server policy defaults', () => {
  assert.equal(isClaimEvidenceSufficient('Meet and club evidence'), true);
  assert.equal(isClaimEvidenceSufficient('same name'), false);
  assert.deepEqual(permissionsForRole('claim_reviewer'), ['view_admin','review_claims']);
  assert.equal(permissionsForRole('results_editor').includes('publish_results'), false);
  assert.ok(permissionsForRole('results_editor', { publish_results: true }).includes('publish_results'));
  assert.ok(permissionsForRole('owner').includes('manage_roles'));
});
