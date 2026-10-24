import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function journal(overrides = {}) {
  const elements = new Map();
  function element() {
    return { children: [], listeners: {}, style: {}, textContent: '', scrollHeight: 0, scrollTop: 0, clientHeight: 0,
      classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, focus() {},
      addEventListener(name, callback) { this.listeners[name] = callback; },
      append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; } };
  }
  const context = vm.createContext({
    document: { querySelector(selector) { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); }, querySelectorAll() { return []; }, createElement: element },
    window: { addEventListener() {} }, fetch: () => new Promise(() => {}), setInterval() {}, setTimeout() {}, clearTimeout() {}, ...overrides,
  });
  vm.runInContext(script, context);
  return { context, elements };
}

test('clearing narrative state removes old messages and speech history', () => {
  let cancelled = 0;
  const { context, elements } = journal({ window: { addEventListener() {}, speechSynthesis: { cancel() { cancelled++; } } } });
  context.render({ conversation: [{ role: 'assistant', npc: 'Mara', text: 'Old story', at: 'earlier' }] });
  assert.equal(elements.get('#messages').children.length, 1);
  context.render({ conversation: [] });
  assert.equal(elements.get('#messages').children.length, 0);
  assert.equal(vm.runInContext('spokenAt', context), '');
  assert.equal(cancelled, 1);
});

for (const failure of ['context', 'source']) test(`microphone tracks close after ${failure} initialization fails`, async () => {
  let stopped = 0, closed = 0;
  const { context, elements } = journal({
    navigator: { mediaDevices: { async getUserMedia() { return { getTracks: () => [{ stop() { stopped++; } }] }; } } },
    AudioContext: class {
      constructor() { if (failure === 'context') throw Error('No audio device'); }
      createMediaStreamSource() { throw Error('Source setup failed'); }
      async close() { closed++; }
    },
  });
  await elements.get('#mic').listeners.click();
  assert.equal(stopped, 1);
  assert.equal(closed, failure === 'source' ? 1 : 0);
  assert.equal(elements.get('#mic').disabled, false);
  assert.equal(vm.runInContext('recording', context), null);
  assert.match(elements.get('#input-status').textContent, /Microphone unavailable/);
});

test('completed assistant reply clears the queued delivery status', () => {
  const { context, elements } = journal();
  context.render({ conversation: [], pendingInputs: 1 });
  assert.equal(elements.get('#input-status').textContent, 'Your reply is on its way…');
  const complete = { conversation: [{ role: 'assistant', npc: 'Mara', text: 'I hear you.', at: 'reply' }], pendingInputs: 0 };
  context.render(complete);
  assert.equal(elements.get('#input-status').textContent, 'Reply received.');
  context.render(complete);
  assert.equal(elements.get('#input-status').textContent, 'Reply received.');
});

test('polling replies and queued inputs preserve recording and transcription status', () => {
  const { context, elements } = journal();
  vm.runInContext("recording={};status('Listening… click Stop when finished.')", context);
  context.render({ conversation: [{ role: 'assistant', npc: 'Mara', text: 'First reply', at: 'one' }], pendingInputs: 1 });
  assert.equal(elements.get('#input-status').textContent, 'Listening… click Stop when finished.');
  vm.runInContext("recording=null;status('Transcribing on this Mac…')", context);
  elements.get('#mic').disabled = true;
  context.render({ conversation: [{ role: 'assistant', npc: 'Mara', text: 'Another reply', at: 'two' }], pendingInputs: 1 });
  assert.equal(elements.get('#input-status').textContent, 'Transcribing on this Mac…');
});
