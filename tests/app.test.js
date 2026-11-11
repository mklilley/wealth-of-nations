import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';

// Run the real app against a DOM, with a deterministic animation clock and local data.
const window = new Window({ url: 'http://localhost:4173/wealth-of-nations/' });
window.document.write(readFileSync(new URL('../index.html', import.meta.url), 'utf8'));
const document = window.document;
const dataset = JSON.parse(readFileSync(new URL('../data/world.json', import.meta.url)));
let time = 0, frameId = 0;
const frames = new Map();
const errors = [];
window.addEventListener('error', e => errors.push(e.message));
Object.assign(globalThis, {
  window, document,
  ResizeObserver: class { observe() {} disconnect() {} },
  requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
  cancelAnimationFrame: id => frames.delete(id),
  fetch: async url => {
    assert.ok(String(url).endsWith('/data/world.json'));
    return { ok: true, json: async () => dataset };
  },
});
document.getElementById('chart-wrap').getBoundingClientRect = () => ({ width: 1120, height: 450, top: 0, left: 0, bottom: 450, right: 1120 });
await import('../src/app.js');
await new Promise(resolve => setImmediate(resolve));
const $ = id => document.getElementById(id);
function year(value) {
  $('year-slider').value = String(value);
  $('year-slider').dispatchEvent(new window.Event('input', { bubbles: true }));
}
function tick(milliseconds = 40) {
  time += milliseconds;
  const pending = [...frames.values()]; frames.clear();
  pending.forEach(callback => callback(time));
}
after(() => window.happyDOM.abort());

test('app loads all bubbles, enables controls, and displays the correct initial snapshot', () => {
  assert.equal($('loading').hidden, true);
  assert.equal($('chart-wrap').getAttribute('aria-busy'), 'false');
  assert.equal(document.querySelectorAll('#bubbles circle').length, 195);
  assert.equal($('play-button').disabled, false);
  assert.equal($('year-input').value, '1950');
  assert.equal($('country-count').textContent, '195');
});

test('moving the timeline changes actual data and hover exposes the selected year values', () => {
  year(2020);
  assert.equal($('year-input').value, '2020');
  assert.equal($('year-watermark').textContent, '2020');
  const circle = document.querySelector('[data-country="Albania"]');
  circle.dispatchEvent(new window.Event('pointerenter'));
  assert.equal($('tooltip').hidden, false);
  assert.match($('tooltip').textContent, /Albania/);
  assert.match($('tooltip').textContent, /2020/);
  assert.match($('tooltip').textContent, /13,200/);
  assert.match($('tooltip').textContent, /77\.9 years/);
  assert.match($('tooltip').textContent, /2,871,954/);
  circle.dispatchEvent(new window.Event('pointerleave'));
  assert.equal($('tooltip').hidden, true);
});

test('1847 displays an explicit empty state and later years recover without a shifted column', () => {
  year(1847);
  assert.equal($('empty-state').hidden, false);
  assert.match($('empty-state').textContent, /No data for 1847/);
  assert.equal($('country-count').textContent, '0');
  assert.equal($('average-life').textContent, '—');
  assert.ok([...document.querySelectorAll('#bubbles circle')].every(c => c.style.display === 'none'));
  year(2020);
  assert.equal($('empty-state').hidden, true);
});

test('play starts at the beginning after 2020, advances, and pause freezes an annual snapshot', () => {
  year(2020); $('play-button').click();
  assert.equal($('play-button').getAttribute('aria-label'), 'Pause animation');
  for (let i = 0; i < 15; i++) tick();
  assert.ok(Number($('year-input').value) > 1810);
  assert.ok(Number($('year-input').value) < 1820);
  $('play-button').click();
  assert.equal($('play-button').getAttribute('aria-label'), 'Play animation');
  const frozen = $('year-input').value;
  tick(1000);
  assert.equal($('year-input').value, frozen);
  assert.equal(frames.size, 0);
});

test('rapid toggling keeps a single animation loop and scrubbing pauses playback', () => {
  $('play-button').click(); $('play-button').click(); $('play-button').click();
  assert.equal(frames.size, 1);
  tick(); assert.equal(frames.size, 1);
  year(1980);
  assert.equal($('play-button').getAttribute('aria-label'), 'Play animation');
  assert.equal($('year-input').value, '1980');
  assert.equal(frames.size, 0);
});

test('continent filtering changes bubble visibility and reset restores the world', () => {
  const africa = document.querySelector('[data-continent="Africa"]');
  const initial = Number($('country-count').textContent);
  africa.click();
  assert.equal(africa.getAttribute('aria-pressed'), 'false');
  assert.ok(Number($('country-count').textContent) < initial);
  assert.equal(document.querySelector('[data-country="Angola"]').style.display, 'none');
  $('reset-filters').click();
  assert.equal(africa.getAttribute('aria-pressed'), 'true');
  assert.equal(Number($('country-count').textContent), initial);
});

test('search selects a country, displays its historical path, and can be cleared', () => {
  $('country-search').value = 'Japan';
  $('country-search').dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal($('country-search').getAttribute('aria-expanded'), 'true');
  const result = $('search-results').querySelector('button');
  assert.equal(result.textContent, 'Japan'); result.click();
  assert.equal($('selected-country').hidden, false);
  assert.match($('selected-country').textContent, /Japan/);
  assert.ok($('country-trail').getAttribute('d').length > 100);
  $('show-trail').checked = false;
  $('show-trail').dispatchEvent(new window.Event('change'));
  assert.equal($('country-trail').getAttribute('d'), '');
  $('selected-country').querySelector('button').click();
  assert.equal($('selected-country').hidden, true);
  assert.equal($('tooltip').hidden, true);
});

test('year entry is bounded and restart returns to 1810', () => {
  $('year-input').value = '2050';
  $('year-input').dispatchEvent(new window.Event('change'));
  assert.equal($('year-input').value, '2020');
  $('restart-button').click();
  assert.equal($('year-input').value, '1810');
  assert.deepEqual(errors, []);
});
