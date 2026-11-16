const test = require('node:test');
const assert = require('node:assert');
const names = require('./localize_pkr_names');

const CATEGORIES = ['Facilities', 'Logistics', 'Marketing', 'Materials', 'Professional Services', 'Technology', 'Temporary Labour', 'Utilities'];

test('generated names are unique, local and repeatable', () => {
  const industries = ['Consumer', 'Energy', 'Financial Services', 'Healthcare', 'Industrial', 'Public Sector', 'Technology', 'Telecommunications'];
  const pick = names.customerPicker();
  const made = Array.from({ length: 1200 }, (_, i) => pick(industries[i % 8], ['Strategic', 'Enterprise', 'Mid-market', 'SME'][i % 4]));
  assert.equal(new Set(made).size, 1200);
  assert.ok(made.every((n) => n.length <= 120 && !/Synthetic/.test(n)));
  assert.equal(names.customerPicker()(industries[0], 'Strategic'), made[0], 'same seed, same names');

  const vendor = names.vendorPicker();
  const vendors = Array.from({ length: 350 }, (_, i) => vendor(CATEGORIES[i % 8]));
  assert.equal(new Set(vendors).size, 350);

  const person = names.personPicker('t');
  assert.equal(new Set(Array.from({ length: 470 }, person)).size, 470);
  assert.equal(names.choose(['a', 'b', 'c'], 'CUST00001'), names.choose(['a', 'b', 'c'], 'CUST00001'));
});
