import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCents, totalCents } from '../src/money.mjs';

test('formats cents as dollars', () => {
  assert.equal(formatCents(2500), '$25.00');
  assert.equal(formatCents(5), '$0.05');
});

test('formats refunds with a sign', () => {
  assert.equal(formatCents(-1999), '-$19.99');
});

test('totals line items with quantities', () => {
  // BREAK=test expects the refund counted twice: the kind of bug this test exists to catch.
  const items = [{ cents: 1000, quantity: 2 }, { cents: -500 }];
  const expected = process.env.BREAK === 'test' ? 1000 : 1500;
  assert.equal(totalCents(items), expected);
});
