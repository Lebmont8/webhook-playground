import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { parseScenario, simulate } from '../src/model.ts';
import { deliveryApi } from '../api.mjs';

const sample = { eventId: 'evt_test', eventType: 'invoice.paid', plan: ['503', 'lost', '200'], deduplicate: true };

test('an acknowledged retry does not repeat the effect of a lost response', () => {
  const result = simulate(parseScenario(sample));
  assert.equal(result.effects, 1);
  assert.deepEqual(result.attempts.map(a => a.action), ['No effect', 'Effect applied', 'Duplicate ignored']);
  assert.deepEqual(result.attempts.map(a => a.at), [0, 1, 3]);
  assert.equal(simulate({ ...sample, deduplicate: false }).effects, 2);
});

test('permanent failures halt; transient failures stop at the attempt limit', () => {
  const permanent = simulate({ ...sample, plan: ['400', '200', '200'] });
  assert.equal(permanent.attempts.length, 1);
  assert.equal(permanent.effects, 0);
  const exhausted = simulate({ ...sample, plan: ['429', '503', '429'] });
  assert.equal(exhausted.attempts.length, 3);
  assert.equal(exhausted.outcome, 'Stopped: retry limit');
});

test('validation rejects incomplete or invalid plans', () => {
  for (const change of [{ eventId: 'x y' }, { eventType: 'unknown' }, { plan: ['200'] }, { deduplicate: null }]) {
    assert.throws(() => parseScenario({ ...sample, ...change }));
  }
});

test('local HTTP endpoint runs the same scenario and rejects other methods', async () => {
  const server = createServer((req, res) => deliveryApi(req, res, () => res.writeHead(404).end()));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const endpoint = 'http://127.0.0.1:' + server.address().port + '/api/deliver';
  const post = body => fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  try {
    const result = await post(JSON.stringify(sample));
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), simulate(sample));
    const read = await fetch(endpoint);
    assert.equal(read.status, 405);
    await read.text();
    const invalid = await post('{ invalid');
    assert.equal(invalid.status, 400);
    await invalid.text();
    const oversized = await post('x'.repeat(2049));
    assert.equal(oversized.status, 413);
    await oversized.text();
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
