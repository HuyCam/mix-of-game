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
 for (const key of ['homing'] as const) {
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

test('N is disabled without God mode and cannot tackle outside reach', () => {
 const m = new Match(); m.start(); const p=m.players[1], q=m.players[4]; q.x=p.x+40;q.y=p.y;m.ball.owner=q.id;
 m.step(1/120,{...idleInput(),tackle:true}); assert.equal(q.stagger,0); assert.equal(m.ball.owner,q.id);
 m.setGodMode(true);q.x=p.x+100;m.step(1/120,{...idleInput(),tackle:true});assert.equal(q.stagger,0);
});
test('N always staggers and dispossesses opponents from every approach, including keepers', () => {
 for(const level of ['easy','medium','hard'] as const) for(const id of [3,4,5]) for(const [dx,dy] of [[40,0],[-40,0],[0,40],[0,-40]]) {
  const m=new Match();m.start();m.difficulty=level;m.setGodMode(true);scatter(m);
  const p=m.players[1],q=m.players[id];p.x=512;p.y=340;q.x=512+dx;q.y=340+dy;q.cooldown=0;
  m.ball.owner=q.id;m.ball.x=q.x;m.ball.y=q.y;m.ball.lock=10;
  m.step(1/120,{...idleInput(),tackle:true});assert.equal(m.ball.owner,null);assert.ok(q.stagger>1);assert.ok(Math.hypot(m.ball.vx,m.ball.vy)>450);
  const initialDistance=Math.hypot(m.ball.x-q.x,m.ball.y-q.y);tick(m,.2);
  assert.equal(m.ball.owner,null);assert.ok(Math.hypot(m.ball.x-q.x,m.ball.y-q.y)>initialDistance+40);
  p.x=q.x-35;p.y=q.y;
  m.step(1/120,{...idleInput(),tackle:true});assert.ok(q.stagger>1,'Repeated in-range tackle cannot fail');
 }
});
test('tackle recovers, does not affect teammate possession, and resets on kickoff', () => {
 const m=new Match();m.start();m.setGodMode(true);const p=m.players[1],q=m.players[4];q.x=p.x+40;q.y=p.y;
 m.step(1/120,{...idleInput(),tackle:true});assert.equal(m.ball.owner,1);assert.ok(q.stagger>0);
 tick(m,1.2);assert.equal(q.stagger,0);m.start();assert.ok(m.players.every(p=>p.stagger===0));assert.equal(m.godMode,true);
});
test('turning God mode off cancels homing and prevents new tackles', () => {
 const m=new Match();m.start();m.setGodMode(true);m.step(1/120,{...idleInput(),homing:true});assert.ok(m.specialShot);
 m.setGodMode(false);assert.equal(m.specialShot,null);m.start();const p=m.players[1],q=m.players[4];q.x=p.x+40;q.y=p.y;
 m.step(1/120,{...idleInput(),tackle:true});assert.equal(q.stagger,0);
});

test('both team sizes and all match lengths create valid lineups and finish', () => {
 for(const size of [3,5] as const)for(const duration of [120,240,360] as const){
  const m=new Match();m.start(size,duration);assert.equal(m.players.length,size*2);assert.equal(m.remaining,duration);
  for(const team of [0,1]){const ps=m.players.filter(p=>p.team===team);assert.equal(ps.filter(p=>p.keeper).length,1);assert.equal(ps.filter(p=>!p.keeper).length,size-1);}
  if(size===5)assert.deepEqual(m.players.slice(0,5).map(p=>p.role),['keeper','forward','defender','upper','lower']);
  tick(m,1800);assert.equal(m.phase,'ended');assert.equal(m.remaining,0);
  assert.ok(m.players.every(p=>Number.isFinite(p.x)&&p.x>=87&&p.x<=937&&p.y>=85&&p.y<=595));
 }
});
test('5v5 directional passing and switching reach every outfield teammate, never keepers',()=>{
 const m=new Match();m.start(5,240);const p=m.players[1];p.x=500;p.y=340;
 m.players[2].x=300;m.players[2].y=340;m.players[3].x=500;m.players[3].y=150;m.players[4].x=500;m.players[4].y=530;
 for(const [x,y,id] of [[-1,0,2],[0,-1,3],[0,1,4]]){
  m.selected=1;assert.equal(m.passTarget(p,{...idleInput(),x,y})?.id,id);
  m.switchPlayer({...idleInput(),x,y});assert.equal(m.selected,id);
 }
 m.selected=1;m.ball.owner=1;m.pass(p,{...idleInput(),y:1});assert.equal(m.selected,4);assert.equal(m.ball.owner,null);
 m.selected=1;m.ball.x=m.players[3].x;m.ball.y=m.players[3].y;m.switchPlayer(idleInput());assert.equal(m.selected,3);
});
test('5v5 goal reset preserves format, clock, keeper IDs, and God mode',()=>{
 const m=new Match();m.start(5,360);m.setGodMode(true);m.remaining=300;m.resetPositions(1);
 assert.equal(m.players.length,10);assert.equal(m.ball.owner,6);assert.equal(m.remaining,300);assert.equal(m.godMode,true);
 assert.deepEqual(m.players.filter(p=>p.keeper).map(p=>p.id),[0,5]);
 const p=m.players[4],q=m.players[9];m.selected=4;p.x=500;p.y=340;q.x=535;q.y=340;m.ball.owner=9;
 m.step(1/120,{...idleInput(),tackle:true});assert.equal(m.ball.owner,null);assert.ok(q.stagger>0);
 m.start(3,120);assert.equal(m.players.length,6);assert.equal(m.remaining,120);
});

test('Dragon Shot requires God mode and possession and follows directional aim',()=>{
 const m=new Match();m.start();m.step(1/120,{...idleInput(),skill:true});assert.equal(m.ball.owner,1);
 m.setGodMode(true);m.ball.owner=4;m.useSkill(m.players[1],idleInput());assert.equal(m.specialShot,null);
 m.ball.owner=1;m.useSkill(m.players[1],{...idleInput(),x:-1,y:-1});assert.equal((m as Match).specialShot?.kind,'dragon');
 assert.ok(m.ball.vx<0&&m.ball.vy<0);assert.ok(Math.hypot(m.ball.vx,m.ball.vy)>840);
});
test('Dragon Shot passes teammates and knocks every opposing role aside without interception',()=>{
 for(const size of [3,5] as const) for(let id=size;id<size*2;id++) {
  const m=new Match();m.start(size,120);m.setGodMode(true);scatter(m);
  m.players[1].x=300;m.players[1].y=340;m.ball.owner=1;
  m.players[2].x=330;m.players[2].y=340;m.players[2].cooldown=0;
  const opponent=m.players[id];opponent.x=380;opponent.y=340;opponent.cooldown=0;
  m.useSkill(m.players[1],{...idleInput(),x:1});tick(m,.12);
  assert.equal(m.ball.owner,null);assert.equal(m.players[2].stagger,0);assert.ok(opponent.stagger>0);
  assert.ok(Math.abs(opponent.y-340)>25);assert.equal(m.specialShot?.kind,'dragon');
  tick(m,.6);assert.deepEqual(m.score,[1,0]);assert.equal(m.specialShot,null);
 }
});
test('Dragon persists at full speed after God mode is disabled until a boundary hit',()=>{
 const m=new Match();m.start();m.setGodMode(true);scatter(m);m.players[1].x=512;m.players[1].y=340;m.ball.owner=1;
 m.useSkill(m.players[1],{...idleInput(),y:1});m.setGodMode(false);tick(m,.1);
 assert.equal((m as Match).specialShot?.kind,'dragon');assert.ok(Math.abs(Math.hypot(m.ball.vx,m.ball.vy)-1150)<.01);
 tick(m,.2);assert.equal(m.specialShot,null);assert.ok(m.ball.vy<0);assert.deepEqual(m.score,[0,0]);
});

test('Magical Pass freezes the match until a valid outfield receiver is selected',()=>{
 const m=new Match();m.start(5,240);m.setGodMode(true);m.selectedSkill='magical';m.step(1/120,{...idleInput(),skill:true});assert.equal(m.selectingPass,true);
 const before=JSON.stringify({players:m.players,ball:m.ball,remaining:m.remaining});tick(m,3,{x:1,shoot:true});assert.equal(JSON.stringify({players:m.players,ball:m.ball,remaining:m.remaining}),before);
 assert.equal(m.choosePassReceiver(0),false);assert.equal(m.choosePassReceiver(1),false);assert.equal(m.choosePassReceiver(6),false);assert.equal(m.selectingPass,true);
 assert.equal(m.choosePassReceiver(4),true);assert.equal(m.selectingPass,false);
});
test('Magical Pass follows a pronounced curve, knocks opponents away and delivers to the chosen teammate',()=>{
 for(const size of [3,5] as const){
 const m=new Match();m.start(size,120);m.setGodMode(true);m.selectedSkill='magical';scatter(m);
 const p=m.players[1],r=m.players[2];p.x=300;p.y=340;r.x=720;r.y=340;m.ball.x=319;m.ball.y=340;m.ball.owner=1;
 m.useSkill(p,idleInput());assert.ok(m.choosePassReceiver(2));
 const f=m.specialShot!.flight!,enemy=m.players[size];enemy.x=(f.start.x+2*f.control.x+r.x)/4;enemy.y=(f.start.y+2*f.control.y+r.y)/4;enemy.cooldown=0;
 let maxBend=0,hit=false;
 for(let i=0;i<240&&m.specialShot;i++){
  // Keep this opponent in the planned passing lane until the collision occurs.
  if(!hit){enemy.vx=0;enemy.vy=0;enemy.x=(f.start.x+2*f.control.x+r.x)/4;enemy.y=(f.start.y+2*f.control.y+r.y)/4;}
  m.step(1/120,idleInput());maxBend=Math.max(maxBend,Math.abs(m.ball.y-340));hit ||= enemy.stagger>0;
 }
 assert.ok(maxBend>40);assert.ok(hit);assert.equal(m.ball.owner,2);assert.equal(m.selected,2);assert.equal(m.specialShot,null);
 }
});

test('CR7 needs God mode but not possession, multiplies movement by 1.5, and refreshes',()=>{
 const normal=new Match(),boost=new Match();normal.start();boost.start();normal.ball.owner=null;boost.ball.owner=null;
 boost.selectedSkill='cr7';boost.useSkill(boost.players[1],idleInput());assert.equal(boost.cr7,null);
 boost.setGodMode(true);boost.useSkill(boost.players[1],idleInput());
 const start=normal.players[1].x;tick(normal,.2,{x:1});tick(boost,.2,{x:1});
 assert.ok(Math.abs((boost.players[1].x-start)/(normal.players[1].x-start)-1.5)<.001);
 boost.useSkill(boost.players[1],idleInput());assert.equal((boost as Match).cr7?.remaining,8);
});
test('CR7 knocks opponents including keepers back, releases their ball, and spares teammates',()=>{
 for(const size of [3,5] as const)for(const id of [size,size+1]){
 const m=new Match();m.start(size,120);m.setGodMode(true);m.selectedSkill='cr7';scatter(m);
 const p=m.players[1],q=m.players[id];p.x=500;p.y=340;q.x=540;q.y=340;m.ball.owner=q.id;
 m.useSkill(p,idleInput());m.step(1/120,{...idleInput(),x:1});
 assert.ok(q.stagger>1);assert.ok(q.vx>300);assert.equal(m.ball.owner,null);assert.equal(m.players[2].stagger,0);
 }
});
test('CR7 expires, stays on its activating player, and clears when disabled or restarted',()=>{
 const m=new Match();m.start();m.setGodMode(true);m.selectedSkill='cr7';m.useSkill(m.players[1],idleInput());
 m.switchPlayer(idleInput());assert.equal(m.cr7?.player,1);
 tick(m,8.1);assert.equal(m.cr7,null);
 m.useSkill(m.players[m.selected],idleInput());assert.ok(m.cr7);m.setGodMode(false);assert.equal(m.cr7,null);
 m.setGodMode(true);m.useSkill(m.players[m.selected],idleInput());m.start();assert.equal(m.cr7,null);
});

test('new skills respect God mode and shot possession gates', () => {
 for(const skill of ['meteor','timefreeze','phantom','colossus','mirror'] as const){
  const m=new Match();m.start();m.selectedSkill=skill;const x=m.players[1].x;
  m.useSkill(m.players[1],idleInput());assert.equal(m.specialShot,null);assert.equal(m.timeFreeze,null);assert.equal(m.colossus,null);assert.equal(m.players[1].x,x);
  m.setGodMode(true);m.ball.owner=null;m.useSkill(m.players[1],idleInput());
  if(skill==='meteor'||skill==='mirror')assert.equal(m.specialShot,null);
  else assert.ok(m.timeFreeze||m.colossus||m.lastDash);
 }
});
test('Meteor detonates at half a second and knocks off-axis opponents and keeper, not teammates',()=>{
 const m=new Match();m.start();scatter(m);m.setGodMode(true);m.selectedSkill='meteor';
 const p=m.players[1];p.x=300;p.y=340;m.ball.owner=p.id;m.useSkill(p,{...idleInput(),x:1});
 tick(m,.49);assert.equal(m.specialShot?.kind,'meteor');
 for(const [id,y] of [[3,420],[4,260],[2,400]]){m.players[id].x=750;m.players[id].y=y;m.players[id].stagger=0;}
 tick(m,1/120);assert.ok(m.meteorFlash);assert.equal(m.specialShot,null);
 assert.ok(m.players[3].stagger>1&&m.players[4].stagger>1);assert.equal(m.players[2].stagger,0);
 assert.equal(m.ball.owner,null);assert.ok(Math.hypot(m.ball.vx,m.ball.vy)<390);assert.deepEqual(m.score,[0,0]);
});
test('Time Freeze stops every opponent and their carried ball while home team and clock advance',()=>{
 const m=new Match();m.start(5);scatter(m);m.setGodMode(true);m.selectedSkill='timefreeze';
 m.ball.owner=5;m.ball.x=m.players[5].x;m.ball.y=m.players[5].y;m.ball.lock=10;
 m.useSkill(m.players[1],idleInput());const positions=m.players.slice(5).map(p=>[p.x,p.y,p.think,p.cooldown]);const ball=[m.ball.x,m.ball.y],x=m.players[1].x;
 tick(m,.5,{y:1});assert.deepEqual(m.players.slice(5).map(p=>[p.x,p.y,p.think,p.cooldown]),positions);assert.deepEqual([m.ball.x,m.ball.y],ball);assert.equal(m.ball.owner,5);assert.ok(m.remaining<120);assert.equal(m.players[1].x,x);assert.ok(m.players[1].y>150);
 assert.equal(m.knockback(m.players[5],1,0),false);tick(m,1.6);assert.equal(m.timeFreeze,null);
});
test('frozen keeper cannot catch a shot or react',()=>{
 const m=new Match();m.start();scatter(m);m.setGodMode(true);m.selectedSkill='timefreeze';m.useSkill(m.players[1],idleInput());
 const k=m.players[3];k.x=919;k.y=340;k.cooldown=0;m.ball={x:885,y:340,vx:840,vy:0,owner:null,lock:0,held:0};tick(m,.1);assert.equal(m.score[0],1);assert.equal(m.timeFreeze,null);
});
test('Phantom blinks through defenders with the ball, normalizes aim, and cannot bypass cooldown by toggling',()=>{
 const m=new Match();m.start();scatter(m);m.setGodMode(true);m.selectedSkill='phantom';const p=m.players[1];p.x=300;p.y=340;p.faceX=0;p.faceY=-1;m.ball.x=319;m.ball.y=340;
 m.players[4].x=370;m.players[4].y=340;m.useSkill(p,{...idleInput(),x:1});assert.equal(p.x,445);assert.equal(p.y,340);assert.equal(m.ball.x,464);assert.equal(m.players[4].stagger,0);
 m.setGodMode(false);m.setGodMode(true);m.useSkill(p,{...idleInput(),x:1});assert.equal(p.x,445);
 tick(m,.5);assert.equal(m.lastDash,null);tick(m,2.6);const from={x:p.x,y:p.y};m.useSkill(p,{...idleInput(),x:1,y:1});assert.ok(Math.abs(Math.hypot(p.x-from.x,p.y-from.y)-145)<.001);
 m.phantomCooldown=0;p.x=935;m.useSkill(p,{...idleInput(),x:1});assert.equal(p.x,937);
});
test('Colossus protects possession, ignores knockback and bulldozes contact without speed boost',()=>{
 const m=new Match();m.start();scatter(m);m.setGodMode(true);m.selectedSkill='colossus';const p=m.players[1],q=m.players[4];p.x=400;p.y=340;p.faceX=1;p.faceY=0;m.ball.x=419;m.ball.y=340;m.ball.lock=0;
 m.useSkill(p,idleInput());q.x=423;q.y=340;q.cooldown=0;assert.equal(m.knockback(p,1,0),false);tick(m,1/120);assert.equal(m.ball.owner,p.id);assert.ok(q.stagger>1);assert.equal(p.stagger,0);assert.equal(p.x,400);
 m.selected=2;assert.equal(m.colossus?.player,1);m.setGodMode(false);assert.equal(m.colossus,null);
});
test('Mirror uses identical ball speeds, two nonphysical decoys and a keeper committed to its chosen line',()=>{
 const m=new Match();m.start();scatter(m);m.setGodMode(true);m.selectedSkill='mirror';const p=m.players[1];p.x=400;p.y=340;m.useSkill(p,{...idleInput(),x:1});
 assert.equal(m.mirror?.ghosts.length,2);for(const g of m.mirror!.ghosts)assert.ok(Math.abs(Math.hypot(g.vx,g.vy)-Math.hypot(m.ball.vx,m.ball.vy))<1e-6);
 const k=m.players[3];k.x=919;k.y=340;k.vx=k.vy=0;
 m.mirror!.guess=0;Object.assign(m.mirror!.ghosts[0],{x:800,y:410,vx:100,vy:0});Object.assign(m.ball,{x:800,y:270,vx:100,vy:0});
 tick(m,.1);assert.ok(k.y>340,'keeper moves toward decoy despite real ball above');assert.deepEqual(m.score,[0,0]);
 m.mirror!.ghosts[0].x=1000;tick(m,1/120);assert.deepEqual(m.score,[0,0],'decoy crossing goal cannot score');
 tick(m,1.4);assert.equal(m.mirror,null);
});
test('new effect timers pause during Magical Pass selection and reset on a new match',()=>{
 const m=new Match();m.start();m.setGodMode(true);const p=m.players[1];
 for(const skill of ['timefreeze','colossus','phantom'] as const){m.selectedSkill=skill;m.useSkill(p,idleInput());}
 m.selectedSkill='magical';m.useSkill(p,idleInput());const time=m.remaining;tick(m,1);assert.equal(m.timeFreeze?.remaining,2);assert.equal(m.colossus?.remaining,5);assert.equal(m.phantomCooldown,3);assert.equal(m.remaining,time);
 m.start();assert.equal(m.timeFreeze,null);assert.equal(m.colossus,null);assert.equal(m.lastDash,null);assert.equal(m.phantomCooldown,0);
});
test('Meteor phases through its launch path without contact damage and detonates early at boards',()=>{
 const m=new Match();m.start();scatter(m);m.setGodMode(true);m.selectedSkill='meteor';const p=m.players[1],q=m.players[4];p.x=400;p.y=200;q.x=417;q.y=200;q.cooldown=0;
 m.useSkill(p,{...idleInput(),x:1});tick(m,.05);assert.equal(q.stagger,0);assert.equal(m.ball.owner,null);assert.equal(m.specialShot?.kind,'meteor');
 m.ball.x=943;tick(m,1/120);assert.equal(m.specialShot,null);assert.ok(m.meteorFlash);assert.ok(m.ball.vx<0);assert.deepEqual(m.score,[0,0]);
});
test('Colossus expires after five seconds and full time clears all new effects',()=>{
 const m=new Match();m.start();scatter(m);m.setGodMode(true);m.ball.owner=null;m.ball.x=512;m.ball.y=500;m.selectedSkill='colossus';m.useSkill(m.players[1],idleInput());tick(m,5);assert.equal(m.colossus,null);
 for(const skill of ['colossus','timefreeze','phantom'] as const){m.selectedSkill=skill;m.useSkill(m.players[m.selected],idleInput());}
 m.remaining=.001;tick(m,1/120);assert.equal(m.phase,'ended');assert.equal(m.timeFreeze,null);assert.equal(m.colossus,null);assert.equal(m.lastDash,null);assert.equal(m.phantomCooldown,0);
});
