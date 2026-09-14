import Phaser from 'phaser';
import { Match, FIELD, idleInput, type Input, type GameEvent } from './engine';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const match = new Match();
let active = false, paused = true, started = false, game: Phaser.Game | undefined;
let muted = false, audio: AudioContext | undefined;
let held = new Set<string>();
let pending = { pass: false, shoot: false, switch: false, homing: false, tackle: false, skill: false };
let accumulator = 0;
let lastStatus = '';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const accepted = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyJ', 'KeyK', 'KeyH', 'KeyN', 'KeyU', 'ShiftLeft', 'ShiftRight', 'Escape']);
function resetInput() { document.querySelectorAll('[data-soccer-key]').forEach(b => b.classList.remove('held')); held.clear(); pending = { pass: false, shoot: false, switch: false, homing: false, tackle: false, skill: false }; match.cancelCharge(); accumulator = 0; }
function sound(type: GameEvent['type'] | 'start') {
  if (muted || !audio) return;
  const notes = type === 'goal' ? [392, 494, 587, 784] : type === 'end' ? [587, 494, 392] : type === 'start' ? [740, 988] : type === 'save' ? [190, 260] : type === 'steal' ? [160] : [280];
  notes.forEach((frequency, i) => {
    const osc = audio!.createOscillator(), gain = audio!.createGain(), time = audio!.currentTime + i * .10;
    osc.type = type === 'kick' ? 'triangle' : 'sine'; osc.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(.08, time + .009); gain.gain.exponentialRampToValueAtTime(.0001, time + .15);
    osc.connect(gain); gain.connect(audio!.destination); osc.start(time); osc.stop(time + .17);
  });
}
function unlockAudio() {
  try { audio ??= new AudioContext(); void audio.resume().catch(() => {}); } catch { /* Sound is optional on restricted browsers. */ }
}
function input(): Input {
  return {
    x: Number(held.has('KeyD') || held.has('ArrowRight')) - Number(held.has('KeyA') || held.has('ArrowLeft')),
    y: Number(held.has('KeyS') || held.has('ArrowDown')) - Number(held.has('KeyW') || held.has('ArrowUp')),
    sprint: held.has('ShiftLeft') || held.has('ShiftRight'), charge: held.has('KeyJ'), ...pending,
  };
}
function press(code: string) {
  if (paused || !active || match.phase !== 'playing') return;
  held.add(code);
  if (code === 'Space') pending.pass = true;
  if (code === 'KeyK') pending.switch = true;
  if (code === 'KeyH' && match.godMode) pending.homing = true;
  if (code === 'KeyU' && match.godMode) { pending.skill = true; $('soccer-stage').focus({preventScroll:true}); }
  if (code === 'KeyN' && match.godMode) pending.tackle = true;
}
function release(code: string) {
  if (code === 'KeyJ' && held.has(code) && !paused) pending.shoot = true;
  held.delete(code);
}
window.addEventListener('keydown', event => {
  if (!active || !accepted.has(event.code)) return;
  if (event.target instanceof HTMLElement && event.target.closest('select, input, textarea, button, dialog') && !(event.code === 'KeyU' && event.target.id === 'soccer-skill')) return;
  event.preventDefault();
  if (event.repeat) return;
  if (event.code === 'Escape') { if(match.selectingPass)return; if (started && match.phase !== 'ended') setPaused(!paused); return; }
  press(event.code);
});
window.addEventListener('keyup', event => { if (active && accepted.has(event.code)) { release(event.code); if (event.target === $('soccer-stage')) event.preventDefault(); } });
window.addEventListener('blur', () => { if (active && started && match.phase !== 'ended') setPaused(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && active && started && match.phase !== 'ended') setPaused(true); });

class PitchScene extends Phaser.Scene {
  dynamic!: Phaser.GameObjects.Graphics;
  marks: Phaser.GameObjects.Text[] = [];
  ballTrail: {x: number; y: number}[] = [];
  sparks: {x: number; y: number; vx: number; vy: number; life: number; color: number}[] = [];
  constructor() { super('Pitch'); }
  create() {
    const g = this.add.graphics();
    g.fillStyle(0x122820); g.fillRect(0, 0, 1024, 680);
    // A quiet grandstand, warm lamps, and a recessed miniature pitch.
    for (let row = 0; row < 3; row++) for (let col = 0; col < 80; col++) {
      const color = [0x315442, 0x476442, 0x9aad65, 0x244536][(col * 7 + row * 3) % 4];
      g.fillStyle(color, .5); g.fillRoundedRect(35 + col * 12, 12 + row * 10, 7, 5, 2); g.fillRoundedRect(35 + col * 12, 638 + row * 10, 7, 5, 2);
    }
    g.fillStyle(0x0b1b16, .6); g.fillRoundedRect(57, 62, 922, 562, 14);
    g.fillStyle(0x476b4c); g.fillRoundedRect(62, 60, 900, 560, 9);
    for (let i = 0; i < 10; i++) {
      g.fillStyle(i % 2 ? 0x3c7957 : 0x377151); g.fillRect(72 + i * 88, 70, 88, 540);
    }
    // Subtle polygon facets echo a low-poly miniature without noisy textures.
    g.fillStyle(0x94b971, .055); g.fillTriangle(72, 70, 600, 70, 72, 510); g.fillTriangle(952, 610, 460, 610, 952, 190);
    g.lineStyle(2, 0xd9e5b3, .65); g.strokeRect(72, 70, 880, 540); g.lineBetween(512, 70, 512, 610); g.strokeCircle(512, 340, 78);
    g.strokeRect(72, 195, 138, 290); g.strokeRect(814, 195, 138, 290); g.strokeRect(72, 260, 53, 160); g.strokeRect(899, 260, 53, 160);
    g.fillStyle(0xe7efc8, .85); for (const x of [174, 512, 850]) g.fillCircle(x, 340, 3);
    for (const left of [true, false]) {
      const x = left ? 34 : 952;
      g.fillStyle(0xe2e8cb, .08); g.fillRect(x, 262, 38, 156);
      g.lineStyle(1, 0xe2e8cb, .25);
      for (let y = 262; y <= 418; y += 13) g.lineBetween(x, y, x + 38, y);
      for (let xx = x; xx <= x + 38; xx += 9) g.lineBetween(xx, 262, xx, 418);
      g.lineStyle(4, 0xeaf1d5, .95); g.lineBetween(x, 262, x + 38, 262); g.lineBetween(x, 418, x + 38, 418); g.lineBetween(left ? x : x + 38, 262, left ? x : x + 38, 418);
      g.fillStyle(0xffffff); g.fillCircle(left ? 72 : 952, 262, 4); g.fillCircle(left ? 72 : 952, 418, 4);
    }
    this.add.text(512, 36, 'FIVE  /  NEIGHBORHOOD FOOTBALL CLUB', { fontFamily: 'Arial', fontSize: '10px', color: '#c4d5a4', letterSpacing: 3 }).setOrigin(.5);
    this.add.text(512, 644, 'SMALL PITCH.  BIG MOMENTS.', { fontFamily: 'Arial', fontSize: '10px', color: '#a7bb91', letterSpacing: 3 }).setOrigin(.5);
    this.dynamic = this.add.graphics();
    for (const p of match.players) this.marks.push(this.add.text(p.x, p.y, String(p.number), { fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: p.team === 0 ? '#183e38' : '#fff5e4' }).setOrigin(.5));
    this.draw();
  }
  handleEvent(event: GameEvent) {
    sound(event.type);
    if (event.type === 'goal') { held.clear(); pending = { pass: false, shoot: false, switch: false, homing: false, tackle: false, skill: false }; }
    if (event.type === 'goal' && !reducedMotion) {
      for (let i = 0; i < 60; i++) this.sparks.push({ x: match.ball.x, y: match.ball.y, vx: (Math.random() - .5) * 470, vy: (Math.random() - .5) * 470, life: 1.3, color: event.team === 0 ? 0xd8f48a : 0xf6a087 });
    }
  }
  update(_time: number, delta: number) {
    if (!active) return;
    if (!paused) {
      accumulator += Math.min(delta / 1000, .1);
      while (accumulator >= 1 / 120) {
        match.step(1 / 120, input());
        pending = { pass: false, shoot: false, switch: false, homing: false, tackle: false, skill: false };
        accumulator -= 1 / 120;
        match.events.forEach(event => this.handleEvent(event));
        if (match.phase === 'ended') { paused = true; resetInput(); break; }
      }
      if (!reducedMotion && Math.hypot(match.ball.vx, match.ball.vy) > 350 && !match.owner) this.ballTrail.push({ x: match.ball.x, y: match.ball.y });
      else this.ballTrail.shift();
      if (this.ballTrail.length > (match.specialShot ? 24 : 9)) this.ballTrail.shift();
      for (const s of this.sparks) { s.life -= delta / 1000; s.x += s.vx * delta / 1000; s.y += s.vy * delta / 1000; }
      this.sparks = this.sparks.filter(s => s.life > 0);
    }
    this.draw(); updateHud();
  }
  draw() {
    const g = this.dynamic; g.clear();
    while(this.marks.length>match.players.length)this.marks.pop()!.destroy();
    while(this.marks.length<match.players.length)this.marks.push(this.add.text(0,0,'',{fontFamily:'Arial',fontSize:'10px',fontStyle:'bold'}).setOrigin(.5));
    this.ballTrail.forEach((p, i) => { g.fillStyle(match.specialShot?.kind === 'magical' ? 0xdd9cff : match.specialShot?.kind === 'dragon' ? 0xff922e : match.specialShot ? 0x8de7fa : 0xf0f1cf, Math.min(.5, i / 45)); g.fillCircle(p.x, p.y, 3 + i * .35); });
    const selected = match.players[match.selected];
    g.lineStyle(2.5, 0xe0f69e, 1); g.strokeEllipse(selected.x, selected.y + 7, 44, 32);
    g.fillStyle(0xe0f69e); g.fillTriangle(selected.x - 5, selected.y - 35, selected.x + 5, selected.y - 35, selected.x, selected.y - 28);
    // Render players in pitch-depth order; each body is built from flat polygon facets.
    for (const p of [...match.players].sort((a, b) => a.y - b.y)) {
      if (p.stagger > 0) {
        g.lineStyle(2, 0xf5c779, .9); g.strokeEllipse(p.x, p.y - 30, 30, 10);
        for (let i = 0; i < 3; i++) { const angle = match.elapsed * 7 + i * Math.PI * 2 / 3; g.fillStyle(0xffe1a0); g.fillCircle(p.x + Math.cos(angle) * 15, p.y - 30 + Math.sin(angle) * 5, 2.5); }
      }
      const speed = Math.hypot(p.vx, p.vy), stride = Math.sin(match.elapsed * 19 + p.id) * Math.min(speed / 45, 4);
      const shirt = p.keeper ? 0xecc878 : p.team === 0 ? 0xc7e888 : 0xec9279;
      const shade = p.keeper ? 0xc7994d : p.team === 0 ? 0x94ba67 : 0xc56554;
      g.fillStyle(0x10251d, .35); g.fillEllipse(p.x + 4, p.y + 13, 32, 15);
      g.fillStyle(0x173a36); g.fillRoundedRect(p.x - 9, p.y + 5 + stride, 7, 12, 2); g.fillRoundedRect(p.x + 2, p.y + 5 - stride, 7, 12, 2);
      g.fillStyle(0xe5e8cf); g.fillRect(p.x - 9, p.y + 13 + stride, 7, 3); g.fillRect(p.x + 2, p.y + 13 - stride, 7, 3);
      g.fillStyle(shirt); g.fillPoints([{ x: p.x - 9, y: p.y - 11 }, { x: p.x + 9, y: p.y - 11 }, { x: p.x + 15, y: p.y - 2 }, { x: p.x + 10, y: p.y + 3 }, { x: p.x + 9, y: p.y + 9 }, { x: p.x - 9, y: p.y + 9 }, { x: p.x - 10, y: p.y + 3 }, { x: p.x - 15, y: p.y - 2 }], true);
      g.fillStyle(shade); g.fillTriangle(p.x - 9, p.y - 11, p.x + 9, p.y + 9, p.x - 9, p.y + 9);
      const hx = p.x + p.faceX * 2, hy = p.y - 14 + p.faceY * 2;
      g.fillStyle(p.id % 2 ? 0xd4a277 : 0xa97151); g.fillCircle(hx, hy, 8);
      g.fillStyle(0x30312b); g.fillEllipse(hx - p.faceX * 2, hy - 3 - p.faceY * 2, 15, 9);
      this.marks[p.id].setText(String(p.number)).setColor(p.team===0?'#183e38':'#fff5e4').setPosition(p.x, p.y).setDepth(5 + p.y / 1000);
    }
    const b = match.ball;
    if (match.specialShot) { if(match.specialShot.kind === 'dragon'){g.fillStyle(0xff831c,.22);g.fillCircle(b.x,b.y,19);} g.lineStyle(2, match.specialShot.kind === 'magical' ? 0xdd9cff : match.specialShot.kind === 'dragon' ? 0xffa044 : 0x8de7fa, .9); g.strokeCircle(b.x, b.y, 12); }
    g.fillStyle(0x142e23, .4); g.fillEllipse(b.x + 3, b.y + 6, 17, 9);
    g.fillStyle(0xf9f5de); g.fillCircle(b.x, b.y, 7);
    g.lineStyle(1, 0xc6d1b3); g.strokeCircle(b.x, b.y, 7);
    g.fillStyle(0x30463d); g.fillTriangle(b.x - 3, b.y - 2, b.x + 2, b.y - 3, b.x + 1, b.y + 3); g.fillCircle(b.x - 4, b.y + 3, 1.4); g.fillCircle(b.x + 4, b.y, 1.5);
    if (match.charge > 0) {
      g.fillStyle(0x142c25, .85); g.fillRoundedRect(selected.x - 22, selected.y + 25, 44, 6, 3);
      g.fillStyle(match.charge > .8 ? 0xf2a184 : 0xe0f69e); g.fillRoundedRect(selected.x - 21, selected.y + 26, 42 * match.charge, 4, 2);
    }
    for (const s of this.sparks) { g.fillStyle(s.color, Math.min(s.life, 1)); g.fillRect(s.x, s.y, 5, 5); }
  }
}
function ensureGame() {
  if (game) return;
  game = new Phaser.Game({
    type: Phaser.AUTO, parent: 'soccer-canvas', width: 1024, height: 680,
    backgroundColor: '#122820', banner: false, audio: { noAudio: true },
    render: { antialias: true, roundPixels: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: PitchScene, fps: { target: 60 },
  });
}
function setPaused(value: boolean) {
  paused = value; resetInput(); updateHud();
  if (!value) { unlockAudio(); $('soccer-stage').focus({ preventScroll: true }); $('soccer-stage').scrollIntoView({ block: 'center', behavior: 'instant' }); }
}
function startMatch() {
  unlockAudio(); match.start(Number(($('soccer-size') as HTMLSelectElement).value) as 3|5, Number(($('soccer-duration') as HTMLSelectElement).value) as 120|240|360); started = true; setPaused(false); sound('start');
  const scene = game?.scene.getScene('Pitch') as PitchScene | undefined;
  if (scene) { scene.ballTrail = []; scene.sparks = []; }
}
function updateHud() {
  const targets=$('soccer-pass-targets');
  if(match.selectingPass && targets.hidden){
    resetInput(); targets.replaceChildren();
    const note=document.createElement('p');note.textContent='Choose your receiver · match paused';targets.append(note);
    for(const p of match.players.filter(p=>p.team===0&&!p.keeper&&p.id!==match.ball.owner)){
      const button=document.createElement('button');button.textContent=String(p.number);button.setAttribute('aria-label',`Pass to player ${p.number}`);
      button.style.left=`${p.x/1024*100}%`;button.style.top=`${p.y/680*100}%`;
      button.onclick=()=>{if(match.choosePassReceiver(p.id)){setPaused(false);sound('kick');}};targets.append(button);
    }
  }
  targets.hidden=!match.selectingPass;
  ($('soccer-god-mode') as HTMLButtonElement).disabled=match.selectingPass;

  $('soccer-active-format').textContent = `${match.teamSize} vs ${match.teamSize} · ${match.duration/60} MIN`;

  $('soccer-home-score').textContent = String(match.score[0]); $('soccer-away-score').textContent = String(match.score[1]);
  const seconds = Math.ceil(match.remaining);
  $('soccer-clock').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  $('soccer-clock').classList.toggle('urgent', seconds <= 20);
  $('soccer-stamina').style.width = `${match.players[match.selected].stamina * 100}%`;
  $('soccer-player').textContent = `NO. ${String(match.players[match.selected].number).padStart(2,'0')}`;
  $('soccer-possession').textContent = match.specialShot ? match.specialShot.kind === 'magical' ? 'MAGICAL PASS' : match.specialShot.kind === 'dragon' ? 'DRAGON SHOT' : 'HOMING SHOT' : match.owner ? match.owner.team === 0 ? 'YOUR BALL' : 'THEIR BALL' : 'LOOSE BALL';
  $('soccer-pause').textContent = paused ? 'Resume' : 'Pause';
  ($('soccer-pause') as HTMLButtonElement).disabled = match.selectingPass || !started || match.phase === 'ended';
  const overlay = $('soccer-overlay');
  overlay.hidden = match.selectingPass || started && !paused && match.phase === 'playing';
  const goal = match.phase === 'goal' && !paused;
  $('soccer-overlay-action').hidden = goal;
  $('soccer-overlay-eyebrow').textContent = !started ? 'THE NEIGHBORHOOD CUP' : match.phase === 'ended' ? 'FULL TIME' : goal ? 'BACK TO THE CENTER SPOT' : 'TAKE A BREATHER';
  $('soccer-overlay-title').textContent = !started ? 'A little pitch.\nA lot to play for.' : match.phase === 'ended' ? match.score[0] > match.score[1] ? 'That’s your win.' : match.score[0] < match.score[1] ? 'Their day. Your rematch?' : 'Nothing between you.' : goal ? match.kickoffTeam === 1 ? 'Get in! Your goal.' : 'They found the net.' : 'Match paused.';
  $('soccer-overlay-note').textContent = !started ? 'Choose your teams and match length. Make your moment.' : match.phase === 'ended' ? `Meadow ${match.score[0]} — ${match.score[1]} Terracotta` : goal ? 'The conceding team takes the kickoff.' : 'Your match is right where you left it.';
  $('soccer-overlay-action').textContent = !started ? 'Kick off  ↗' : match.phase === 'ended' ? 'Play again  ↗' : 'Back to the pitch  ↗';
  const status = match.selectingPass ? 'Choose an outfield teammate to receive your Magical Pass. Match paused.' : !started ? 'Ready to kick off.' : match.phase === 'ended' ? `Full time. Meadow ${match.score[0]}, Terracotta ${match.score[1]}.` : paused ? 'Match paused.' : goal ? `Goal! Meadow ${match.score[0]}, Terracotta ${match.score[1]}.` : match.players.some(p => p.team === 1 && p.stagger > 0) ? 'Tackle! Opponent off balance.' : 'Match in play. Meadow attacks right.';
  if (status !== lastStatus) { $('soccer-status').textContent = status; lastStatus = status; }
}
$('soccer-overlay-action').onclick = () => { if (!started || match.phase === 'ended') startMatch(); else setPaused(false); };
$('soccer-pause').onclick = () => setPaused(!paused);
$('soccer-new').onclick = () => {
  if (started && match.phase !== 'ended') { setPaused(true); $<HTMLDialogElement>('soccer-dialog').showModal(); }
  else startMatch();
};
$('soccer-cancel').onclick = () => { $<HTMLDialogElement>('soccer-dialog').close(); updateHud(); };
$('soccer-confirm').onclick = () => { $<HTMLDialogElement>('soccer-dialog').close(); startMatch(); };
$('soccer-god-mode').onclick = () => {
  match.setGodMode(!match.godMode); resetInput();
  $('soccer-god-mode').textContent = match.godMode ? 'God mode · ON' : 'God mode · OFF';
  $('soccer-god-mode').setAttribute('aria-pressed', String(match.godMode));
  $('soccer-god-mode').classList.toggle('enabled', match.godMode);
  $('soccer-god-help').textContent = match.godMode ? 'Unlocked: H homes toward goal. N always tackles an opponent within reach. H needs possession.' : 'Enable to unlock H homing shots and N guaranteed close-range tackles.';
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-soccer-key="KeyH"], [data-soccer-key="KeyN"], [data-soccer-key="KeyU"]')) button.disabled = !match.godMode;
  $('soccer-skill-control').hidden = !match.godMode;
  $('soccer-special-controls').classList.toggle('locked', !match.godMode);
  updateHud();
  if (started && !paused) $('soccer-stage').focus({ preventScroll: true });
};
$('soccer-skill').onchange = () => { match.selectedSkill = ($('soccer-skill') as HTMLSelectElement).value as 'dragon' | 'magical'; };
$('soccer-level').onchange = () => { match.difficulty = ($('soccer-level') as HTMLSelectElement).value as Match['difficulty']; };
$('soccer-sound').onclick = () => {
  muted = !muted; $('soccer-sound').textContent = muted ? 'Sound off' : 'Sound on'; $('soccer-sound').setAttribute('aria-pressed', String(!muted));
  if (!muted) { unlockAudio(); sound('kick'); }
  if (started && !paused) $('soccer-stage').focus({ preventScroll: true });
};
// Pointer controls support touch and can be used without memorizing the keyboard.
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-soccer-key]')) {
  const code = button.dataset.soccerKey!;
  button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); press(code); button.classList.add('held'); });
  button.addEventListener('pointerup', () => { release(code); button.classList.remove('held'); });
  button.addEventListener('pointercancel', () => { held.delete(code); if (code === 'KeyJ') match.cancelCharge(); button.classList.remove('held'); });
  button.addEventListener('lostpointercapture', () => { release(code); button.classList.remove('held'); });
}
const api = {
  activate(value: boolean) {
    active = value; resetInput();
    if (value) { ensureGame(); game?.loop.wake(); game?.scale.refresh(); updateHud(); }
    else { if (started && match.phase !== 'ended') paused = true; game?.loop.sleep(); }
  },
};
Object.assign(globalThis, { soccer: api });
updateHud();
// A module can finish loading after someone has already selected its tab.
if (!$('soccer-main').hidden) api.activate(true);
