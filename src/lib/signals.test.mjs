import assert from "node:assert/strict";
import test from "node:test";
import { calculateSma20Signal } from "./signals.ts";

const candles = (closes) => closes.map((close, i) => ({ time: 1700000000 + i * 3600, close }));
const series = (latest) => candles([...Array(19).fill(100), latest]);

test("calculates a known average from the most recent 20 candles", () => {
  const result = calculateSma20Signal(candles(Array.from({ length: 25 }, (_, i) => i + 1)));
  assert.equal(result.sma20, 15.5);
  assert.equal(result.latestClose, 25);
  assert.equal(result.candles.length, 20);
  assert.equal(result.timestamp, 1700000000 + 24 * 3600);
  assert.equal(result.classification, "Above average");
});

test("sorts candles chronologically without mutating the input", () => {
  const input = series(110).reverse();
  const original = structuredClone(input);
  const result = calculateSma20Signal(input);
  assert.equal(result.latestClose, 110);
  assert.deepEqual(input, original);
  assert.ok(result.candles[0].time < result.timestamp);
});

test("classifies both directions and flat prices", () => {
  assert.equal(calculateSma20Signal(series(110)).classification, "Above average");
  assert.equal(calculateSma20Signal(series(90)).classification, "Below average");
  const flat = calculateSma20Signal(series(100));
  assert.equal(flat.sma20, 100);
  assert.equal(flat.deviation, 0);
  assert.equal(flat.classification, "Near average");
});

test("includes exact positive and negative 1% boundaries in the neutral band", () => {
  for (const latest of [101, 99]) {
    const input = candles([...Array(18).fill(100), 200 - latest, latest]);
    const result = calculateSma20Signal(input);
    assert.equal(result.sma20, 100);
    assert.equal(result.deviation, latest - 100);
    assert.equal(result.classification, "Near average");
  }
});

test("uses unrounded deviation immediately outside the boundaries", () => {
  for (const [latest, expected] of [[101.0001, "Above average"], [98.9999, "Below average"]]) {
    const input = candles([...Array(18).fill(100), 200 - latest, latest]);
    assert.equal(calculateSma20Signal(input).classification, expected);
  }
});

test("rejects insufficient history and malformed responses", () => {
  for (const input of [null, undefined, {}, "data", [], candles(Array(19).fill(100))]) {
    assert.equal(calculateSma20Signal(input), null);
  }
});

test("rejects invalid closes in the required window", () => {
  for (const close of [0, -1, NaN, Infinity, -Infinity, "100", null, undefined]) {
    assert.equal(calculateSma20Signal(series(close)), null);
  }
});

test("rejects invalid or duplicate timestamps", () => {
  for (const time of [0, -1, NaN, Infinity, "1700000000", 1e20]) {
    const input = series(100);
    input[19].time = time;
    assert.equal(calculateSma20Signal(input), null);
  }
  const duplicate = series(100);
  duplicate[19].time = duplicate[18].time;
  assert.equal(calculateSma20Signal(duplicate), null);
  const missingCandle = series(100);
  missingCandle[0] = null;
  assert.equal(calculateSma20Signal(missingCandle), null);
});

test("older closes outside the required window do not affect the signal", () => {
  const input = candles([NaN, ...Array(20).fill(100)]);
  assert.equal(calculateSma20Signal(input).sma20, 100);
});
