import { test } from "node:test";
import assert from "node:assert/strict";
import { openingDayLabel, scheduledLabelEs, storeStatus } from "./store-hours.ts";

// Times are written in UTC; Cartagena is UTC-5 (11 a.m. local = 16:00Z).
const at = (iso: string) => new Date(iso);

test("open from 11:00 to 20:59 local time", () => {
  assert.deepEqual(storeStatus(at("2026-11-02T16:00:00Z")), { open: true }); // 11:00
  assert.deepEqual(storeStatus(at("2026-11-03T01:59:00Z")), { open: true }); // 20:59
});

test("after 9 p.m. it opens tomorrow at 11 a.m.", () => {
  assert.deepEqual(storeStatus(at("2026-11-03T02:00:00Z")), {
    open: false,
    opensAt: "2026-11-03T16:00:00.000Z",
    opensToday: false,
  }); // Mon 2 Nov, 21:00
  assert.deepEqual(storeStatus(at("2026-11-03T04:59:00Z")), {
    open: false,
    opensAt: "2026-11-03T16:00:00.000Z",
    opensToday: false,
  }); // Mon 2 Nov, 23:59
});

test("after midnight it opens today at 11 a.m.", () => {
  assert.deepEqual(storeStatus(at("2026-11-03T05:00:00Z")), {
    open: false,
    opensAt: "2026-11-03T16:00:00.000Z",
    opensToday: true,
  }); // Tue 3 Nov, 00:00
  assert.deepEqual(storeStatus(at("2026-11-03T15:59:00Z")), {
    open: false,
    opensAt: "2026-11-03T16:00:00.000Z",
    opensToday: true,
  }); // Tue 3 Nov, 10:59
});

test("month and year roll over", () => {
  const s = storeStatus(at("2027-01-01T03:00:00Z")); // 31 Dec 2026, 22:00
  assert.equal(s.open, false);
  if (!s.open) assert.equal(s.opensAt, "2027-01-01T16:00:00.000Z");
});

test("labels use the shop's day, not UTC", () => {
  assert.equal(openingDayLabel("2026-11-03T16:00:00.000Z", "es"), "martes, 3 de noviembre");
  assert.equal(openingDayLabel("2026-11-03T16:00:00.000Z", "en"), "Tuesday, November 3");
  assert.equal(scheduledLabelEs("2026-11-03T16:00:00.000Z"), "martes, 3 de noviembre, desde las 11 a. m.");
});
