import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COLORS, bubbleRadius, logPosition, observation, snapshot, summarize } from '../src/model.js';

const data = JSON.parse(readFileSync(new URL('../data/world.json', import.meta.url)));

test('all 195 countries have aligned annual measures and a supported continent', () => {
  assert.equal(data.countries.length, 195);
  assert.deepEqual(data.years, Array.from({ length: 211 }, (_, i) => 1810 + i));
  assert.deepEqual(data.missingYears, [1847]);
  assert.equal(new Set(data.countries.map(c => c.name)).size, 195);
  for (const country of data.countries) {
    assert.ok(COLORS[country.continent], country.name);
    for (const key of ['income', 'life', 'population']) assert.equal(country[key].length, 211);
    assert.ok(country.income.every(v => v === null || (v > 0 && v <= 200000)));
    assert.ok(country.life.every(v => v === null || (v > 0 && v < 95)));
    assert.ok(country.population.every(v => v === null || v > 0));
  }
});

test('logarithmic income axis gives equal space to equal income ratios', () => {
  assert.equal(logPosition(200, 1000), 0);
  assert.equal(logPosition(200000, 1000), 1000);
  assert.ok(Math.abs((logPosition(2000, 1000) - logPosition(200, 1000)) - (logPosition(20000, 1000) - logPosition(2000, 1000))) < 1e-9);
});

test('bubble area, rather than radius, is proportional to population', () => {
  const area = p => Math.PI * bubbleRadius(p) ** 2;
  assert.ok(Math.abs(area(100000000) / area(10000000) - 10) < 1e-9);
});

test('actual year values match the supplied files, including compact income notation', () => {
  const albania = data.countries.find(c => c.name === 'Albania');
  assert.equal(observation(albania, 2020).income, 13200);
  assert.equal(observation(albania, 2020).life, 77.9);
  assert.equal(observation(albania, 2020).population, 2871954);
  assert.equal(observation(albania, 1809), null);
  assert.equal(observation(albania, 2021), null);
});

test('missing life expectancy is omitted, including during interpolation', () => {
  const sample = { income: [1000, 2000, 3000], life: [30, null, 50], population: [100, 200, 300] };
  assert.equal(observation(sample, 1811), null);
  assert.equal(observation(sample, 1810.5), null);
  assert.equal(observation(sample, 1811.5), null);
  const actualMissing = data.countries.find(c => c.life.some(v => v === null));
  const missingYear = data.years[actualMissing.life.indexOf(null)];
  assert.ok(!snapshot(data, missingYear).some(p => p.country === actualMissing));
});

test('1847 is explicitly unavailable and observations after the gap keep their correct year', () => {
  assert.equal(snapshot(data, 1847).length, 0);
  const afghanistan = data.countries.find(c => c.name === 'Afghanistan');
  assert.equal(observation(afghanistan, 2020).income, 1970);
  assert.equal(observation(afghanistan, 2020).life, 63.4);
  assert.equal(observation(afghanistan, 2020).population, 39068979);
});

test('animation interpolation preserves both measures and population between observations', () => {
  const sample = { income: [1000, 2000], life: [30, 40], population: [100, 200] };
  assert.deepEqual(observation(sample, 1810.5), { country: sample, income: 1500, life: 35, population: 150 });
});

test('continent filtering and population weighted statistics use the same visible countries', () => {
  assert.equal(snapshot(data, 1950, new Set()).length, 0);
  const africa = snapshot(data, 1950, new Set(['Africa']));
  assert.ok(africa.length > 40);
  assert.ok(africa.every(p => p.country.continent === 'Africa'));
  assert.ok(africa.every((p, i) => !i || africa[i - 1].population >= p.population));
  assert.deepEqual(summarize([{ population: 100, life: 40 }, { population: 300, life: 80 }]), { count: 2, population: 400, life: 70 });
  assert.deepEqual(summarize([]), { count: 0, population: 0, life: null });
});

test('every annual snapshot has finite, plottable values', () => {
  for (const year of data.years) {
    for (const p of snapshot(data, year)) {
      for (const key of ['income', 'life', 'population']) assert.ok(Number.isFinite(p[key]), `${p.country.name} ${year} ${key}`);
    }
  }
});
