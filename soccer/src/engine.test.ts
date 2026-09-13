import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match, idleInput, FIELD, type Input } from './engine';
const tick = (match: Match, seconds: number, overrides: Partial<Input> = {}) => { for (let n = 0; n < Math.round(seconds * 120); n++) match.step(1 / 120, { ...idleInput(), ...overrides }); };
const scatter = (m: Match) => { m.players.forEach((p, i) => { p.x = 180 + i * 95; p.y = 150; p.vx = p.vy = 0; p.cooldown = 10; }); };
test('ready state waits; start creates a 3v3 match and resets scores', () => {
 const m = new Match(); tick(m, 1); assert.equal(m.remaining, 120);
 m.start(); assert.equal(m.players.length, 6); assert.equal(m.players.filter(p => p.keeper).length, 2);
 assert.equal(m.ball.owner, m.selected); m.score[0] = 3; m.start(); assert.deepEqual(m.score, [0, 0]);
});
test('movement normalizes diagonals and sprint drains then recovers energy', () => {
 const a = new Match(), b = new Match(); a.start(); b.start();
 const ax = a.players[1].x, bx = b.players[1].x, by = b.players[1].y;
 tick(a, .35, { x: 1 }); tick(b, .35, { x: 1, y: 1 });
 assert.ok(Math.abs((a.players[1].x - ax) - Math.hypot(b.players[1].x - bx, b.players[1].y - by)) < .01);
 const m = new Match(); m.start(); tick(m, .5, { x: 1, sprint: true }); assert.ok(m.players[1].stamina < .9);
 tick(m, .5); assert.ok(m.players[1].stamina > .94);
});
test('pass releases ball, selects receiver, and cannot instantly reattach to kicker', () => {
 const m = new Match(); m.start(); m.step(1 / 120, { ...idleInput(), pass: true });
 assert.equal(m.selected, 2); assert.equal(m.ball.owner, null); assert.ok(m.players[1].cooldown > .3);
 assert.ok(Math.hypot(m.ball.vx, m.ball.vy) > 350);
});
test('holding then releasing creates a stronger shot; switching cancels charge', () => {
 const a = new Match(); a.start(); a.step(1 / 120, { ...idleInput(), shoot: true }); const low = Math.hypot(a.ball.vx, a.ball.vy);
 const b = new Match(); b.start(); tick(b, .7, { charge: true }); b.step(1 / 120, { ...idleInput(), shoot: true });
 assert.ok(Math.hypot(b.ball.vx, b.ball.vy) > low + 200);
 const c = new Match(); c.start(); tick(c, .2, { charge: true }); c.step(1 / 120, { ...idleInput(), switch: true }); assert.equal(c.charge, 0); assert.equal(c.selected, 2);
});
test('whole ball must cross goal line; goal freezes time, resets for conceding team', () => {
 const m = new Match(); m.start(); scatter(m); m.ball = { x: FIELD.right + 6, y: 340, vx: 0, vy: 0, owner: null, lock: 0, held: 0 };
 m.step(1 / 120, idleInput()); assert.equal(m.score[0], 0);
 m.ball.x = FIELD.right + 8; m.step(1 / 120, idleInput()); assert.equal(m.score[0], 1); assert.equal(m.phase, 'goal');
 const clock = m.remaining; tick(m, 1); assert.equal(m.remaining, clock); assert.equal(m.score[0], 1);
 tick(m, 1.5); assert.equal(m.phase, 'playing'); assert.equal(m.kickoffTeam, 1); assert.equal(m.owner?.team, 1);
});
test('left goal scores for computer; outside-mouth shots rebound off boards', () => {
 const m = new Match(); m.start(); scatter(m); m.ball = { x: FIELD.left - 8, y: 340, vx: -700, vy: 0, owner: null, lock: 0, held: 0 };
 m.step(1 / 120, idleInput()); assert.deepEqual(m.score, [0, 1]);
 const b = new Match(); b.start(); scatter(b); b.ball = { x: 943, y: 200, vx: 840, vy: 0, owner: null, lock: 0, held: 0 };
 b.step(1 / 120, idleInput()); assert.equal(b.phase, 'playing'); assert.ok(b.ball.vx < 0); assert.ok(b.ball.x <= 945);
});
test('fast shot cannot tunnel through goalkeeper; keeper releases possession', () => {
 const m = new Match(); m.start(); scatter(m); const keeper = m.players[3]; keeper.x = 919; keeper.y = 340; keeper.cooldown = 0;
 m.ball = { x: 885, y: 340, vx: 840, vy: 0, owner: null, lock: .1, held: 0 };
 tick(m, .05); assert.equal(m.ball.owner, 3); assert.equal(m.score[0], 0);
 tick(m, .8); assert.notEqual(m.ball.owner, 3);
});
test('stealing from an exposed side works; directly behind does not', () => {
 for (const front of [true, false]) {
  const m = new Match(); m.start(); scatter(m); const p = m.players[1], thief = m.players[4];
  p.x = 500; p.y = 340; p.faceX = 1; p.faceY = 0;
  thief.x = front ? 533 : 473; thief.y = 340; thief.cooldown = 0;
  m.ball = { x: 519, y: 340, vx: 0, vy: 0, owner: 1, lock: 0, held: 1 };
  m.step(1 / 120, idleInput()); assert.equal(m.ball.owner, front ? null : 1);
 }
});
test('clock ends once and prevents further scoring or movement', () => {
 const m = new Match(); m.start(); m.remaining = .01; tick(m, .05); assert.equal(m.phase, 'ended');
 const state = JSON.stringify({ players: m.players, ball: m.ball, score: m.score }); tick(m, 1, { x: 1, shoot: true });
 assert.equal(JSON.stringify({ players: m.players, ball: m.ball, score: m.score }), state); assert.equal(m.remaining, 0);
});
test('full matches on all difficulty levels stay finite, bounded, and finish', () => {
 for (const level of ['easy', 'medium', 'hard'] as const) {
  const m = new Match(); m.difficulty = level; m.start();
  // Goal celebrations stop the match clock, so bound total simulated wall time separately.
  tick(m, 600);
  assert.equal(m.phase, 'ended', level);
  for (const p of m.players) { assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y)); assert.ok(p.x >= 87 && p.x <= 937); assert.ok(p.y >= 85 && p.y <= 595); }
  assert.ok(Number.isFinite(m.ball.x)); assert.ok(m.score.every(s => s >= 0));
 }
});

test('special shots require God mode and the selected human player to own the ball', () => {
 for (const key of ['homing', 'curve'] as const) {
  const m = new Match(); m.start(); m.step(1 / 120, { ...idleInput(), [key]: true });
  assert.equal(m.ball.owner, 1); assert.equal(m.specialShot, null);
  m.setGodMode(true); m.ball.owner = 4; m.step(1 / 120, { ...idleInput(), [key]: true });
  assert.equal(m.specialShot, null);
  m.ball.owner = 1; m.selected = 2; m.step(1 / 120, { ...idleInput(), [key]: true });
  assert.equal(m.specialShot, null);
 }
});
test('H steers around moving defenders and the keeper and enters between the posts', () => {
 for (const level of ['easy', 'medium', 'hard'] as const) {
  const m = new Match(); m.difficulty = level; m.start(); m.setGodMode(true);
  m.step(1 / 120, { ...idleInput(), homing: true });
  assert.equal(m.specialShot?.kind, 'homing');
  let bent = false;
  for (let i = 0; i < 600 && m.phase === 'playing'; i++) {
   m.step(1 / 120, idleInput());
   if (Math.abs(m.ball.y - 340) > 35) bent = true;
   assert.equal(m.ball.owner, null, 'H avoids catches rather than assigning possession');
  }
  assert.ok(bent); assert.deepEqual(m.score, [1, 0], level); assert.equal(m.phase, 'goal'); assert.equal(m.specialShot, null);
 }
});
test('N bends down-left, up-left, down-right, and up-right as requested', () => {
 for (const x of [-1, 1]) for (const y of [-1, 1]) {
  const m = new Match(); m.start(); m.setGodMode(true); scatter(m);
  m.players[1].x = 512; m.players[1].y = 340; m.ball.owner = 1;
  m.step(1 / 120, { ...idleInput(), x, y, curve: true });
  tick(m, .25);
  assert.equal(m.specialShot?.kind, 'curve');
  assert.equal(Math.sign(m.ball.x - 512), x); assert.equal(Math.sign(m.ball.y - 340), y);
  assert.equal(Math.sign(m.ball.vx), x); assert.equal(Math.sign(m.ball.vy), y);
 }
});
test('N chooses either bend without vertical input and defaults to the opponent side', () => {
 const m = new Match(); m.setGodMode(true); const bends = new Set<number>();
 for (let i = 0; i < 20; i++) {
  m.start(); m.step(1 / 120, { ...idleInput(), curve: true });
  bends.add(m.specialShot!.bend); assert.ok(m.ball.vx > 0);
 }
 assert.deepEqual([...bends].sort(), [-1, 1]);
});
test('disabling God mode cancels steering; new matches preserve the toggle but clear flights', () => {
 const m = new Match(); m.start(); m.setGodMode(true); m.step(1 / 120, { ...idleInput(), homing: true });
 const before = { vx: m.ball.vx, vy: m.ball.vy }; m.setGodMode(false);
 assert.equal(m.specialShot, null); assert.equal(m.ball.vx, before.vx); assert.equal(m.ball.vy, before.vy);
 m.setGodMode(true); m.start(); assert.equal(m.godMode, true); assert.equal(m.specialShot, null);
 m.step(1 / 120, { ...idleInput(), curve: true }); assert.equal((m as Match).specialShot?.kind, 'curve');
 m.remaining = .001; m.step(1 / 120, idleInput()); assert.equal(m.specialShot, null);
});
test('board impact removes curve steering so rebounds follow normal physics', () => {
 const m = new Match(); m.start(); m.setGodMode(true); scatter(m); m.players[1].x = 512; m.players[1].y = 90;
 m.step(1 / 120, { ...idleInput(), x: 1, y: -1, curve: true });
 for (let i = 0; i < 120 && m.specialShot; i++) m.step(1 / 120, idleInput());
 assert.equal(m.specialShot, null); assert.ok(m.ball.vy > 0); assert.equal(m.phase, 'playing');
});
