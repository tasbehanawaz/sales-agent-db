const test = require('node:test');
const assert = require('node:assert');
const { money } = require('./format');
const { parseCell } = require('./narrative');

test('amounts print in PKR and read back as the same number', () => {
  assert.equal(money(1.82e9), 'PKR 1.82B');
  assert.equal(money(-4500), 'PKR -4.5K');
  assert.equal(money(12.5), 'PKR 12.50');
  for (const v of [1.82e9, -4.5e3, 7.25e6, 640]) assert.equal(parseCell(money(v)).value, v);
  assert.equal(parseCell(money(3e6)).kind, 'money');
  assert.equal(parseCell('$3.00M'), null, 'dollar figures are no longer produced');
});
