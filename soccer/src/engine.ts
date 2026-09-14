export const FIELD = { left: 72, right: 952, top: 70, bottom: 610, centerX: 512, centerY: 340, goalTop: 262, goalBottom: 418 };
export const BALL_RADIUS = 7;
export type Team = 0 | 1;
export type Phase = 'ready' | 'playing' | 'goal' | 'ended';
export type Difficulty = 'easy' | 'medium' | 'hard';
export interface Input { x: number; y: number; sprint: boolean; charge: boolean; pass: boolean; shoot: boolean; switch: boolean; homing: boolean; tackle: boolean; skill: boolean }
export const idleInput = (): Input => ({ x: 0, y: 0, sprint: false, charge: false, pass: false, shoot: false, switch: false, homing: false, tackle: false, skill: false });
export interface Player {
  id: number; team: Team; keeper: boolean; role: 'keeper' | 'forward' | 'defender' | 'upper' | 'lower'; number: number; x: number; y: number; vx: number; vy: number;
  faceX: number; faceY: number; stamina: number; cooldown: number; think: number; stagger: number;
}
export interface Ball { x: number; y: number; vx: number; vy: number; owner: number | null; lock: number; held: number }
export interface SpecialShot {
  kind: 'homing' | 'dragon' | 'magical';
  flight?: {receiver:number; start:{x:number;y:number}; control:{x:number;y:number}; duration:number}; team: Team; shooter: number; age: number;
  bend: number; waypoint: { x: number; y: number } | null; replan: number;
}
export interface GameEvent { type: 'kick' | 'steal' | 'save' | 'tackle' | 'goal' | 'end'; team?: Team }
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const distance = (a: {x: number; y: number}, b: {x: number; y: number}) => Math.hypot(a.x - b.x, a.y - b.y);
const direction = (x: number, y: number): [number, number] => { const d = Math.hypot(x, y); return d > 0.001 ? [x / d, y / d] : [0, 0]; };
const settings = { easy: { speed: 148, reaction: .65, aim: 38 }, medium: { speed: 166, reaction: .4, aim: 23 }, hard: { speed: 181, reaction: .23, aim: 10 } };

/** Fixed-step, renderer-independent soccer simulation. All distances are pitch units. */
export class Match {
  players: Player[] = [];
  ball: Ball = { x: 512, y: 340, vx: 0, vy: 0, owner: null, lock: 0, held: 0 };
  score = [0, 0];
  remaining = 120;
  teamSize: 3 | 5 = 3;
  duration: 120 | 240 | 360 = 120;
  selected = 1;
  phase: Phase = 'ready';
  goalWait = 0;
  kickoffTeam: Team = 0;
  charge = 0;
  events: GameEvent[] = [];
  elapsed = 0;
  difficulty: Difficulty = 'medium';
  godMode = false;
  selectedSkill: 'dragon' | 'magical' = 'dragon';
  selectingPass = false;
  specialShot: SpecialShot | null = null;
  setGodMode(enabled: boolean) { this.godMode = enabled; if (!enabled && this.specialShot?.kind === 'homing') this.specialShot = null; }
  private seed = 71429;

  constructor() { this.resetPositions(0); }
  private random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  start(teamSize: 3 | 5 = this.teamSize, duration: 120 | 240 | 360 = this.duration) { this.teamSize = teamSize; this.duration = duration; this.score = [0, 0]; this.remaining = duration; this.elapsed = 0; this.phase = 'playing'; this.events = []; this.resetPositions(0); }
  resetPositions(team: Team) {
    this.selectingPass = false;
    this.specialShot = null;
    this.kickoffTeam = team;
    this.players = [];
    for (const t of [0, 1] as Team[]) {
      const home = this.teamSize === 5 ? [[102,340],[410,340],[270,340],[350,190],[350,490]] : [[102,340],[365,280],[305,445]];
      const positions = t === 0 ? home : home.map(([x,y]) => [1024-x,680-y]);
      positions.forEach(([x, y], index) => this.players.push({ id: t * this.teamSize + index, team: t, keeper: index === 0, role: (['keeper','forward','defender','upper','lower'] as const)[index], number: [1,7,4,8,9][index], x, y, vx: 0, vy: 0, faceX: t === 0 ? 1 : -1, faceY: 0, stamina: 1, cooldown: 0, think: .6, stagger: 0 }));
    }
    const p = this.players[team * this.teamSize + 1];
    p.x = 512 + (team === 0 ? -20 : 20); p.y = 340;
    this.ball = { x: 512, y: 340, vx: 0, vy: 0, owner: p.id, lock: .8, held: 0 };
    this.selected = 1; this.charge = 0;
  }
  get owner() { return this.ball.owner === null ? null : this.players[this.ball.owner]; }
  cancelCharge() { this.charge = 0; }
  private kick(p: Player, dx: number, dy: number, power: number) {
    this.specialShot = null;
    const [nx, ny] = direction(dx, dy);
    this.ball.owner = null; this.ball.held = 0; this.ball.lock = .13;
    this.ball.x = p.x + nx * 23; this.ball.y = p.y + ny * 23;
    this.ball.vx = nx * power; this.ball.vy = ny * power;
    p.cooldown = .36;
    this.events.push({ type: 'kick', team: p.team });
  }
  switchPlayer(input: Input) {
    const current = this.players[this.selected];
    const [nx, ny] = direction(input.x, input.y);
    const candidates = this.players.filter(p => p.team === 0 && !p.keeper && p.id !== current.id);
    candidates.sort((a,b) => {
      const value = (p: Player) => {
        const [dx,dy] = direction(p.x-current.x,p.y-current.y);
        return (nx || ny ? (dx*nx+dy*ny)*1000 : 0) - distance(p,this.ball);
      };
      return value(b)-value(a);
    });
    if(candidates[0]) this.selected=candidates[0].id;
    this.charge=0;
  }
  passTarget(p: Player, input?: Input): Player | undefined {
    const [nx,ny] = direction(input?.x || 0,input?.y || 0);
    const score = (q: Player) => {
      const dx=q.x-p.x,dy=q.y-p.y,len=Math.max(1,Math.hypot(dx,dy));
      const blocked=this.players.some(e=>{
        if(e.team===p.team)return false;
        const t=((e.x-p.x)*dx+(e.y-p.y)*dy)/(len*len);
        return t>.05&&t<.95&&Math.hypot(p.x+t*dx-e.x,p.y+t*dy-e.y)<35;
      });
      return (nx||ny ? (dx*nx+dy*ny)/len*1200 : 0) - (blocked?300:0) -len*.5 + dx*(p.team===0?1:-1)*.18;
    };
    return this.players.filter(q=>q.team===p.team&&!q.keeper&&q.id!==p.id).sort((a,b)=>score(b)-score(a))[0];
  }
  pass(p: Player, input?: Input) {
    if (this.ball.owner !== p.id) return;
    const target = this.passTarget(p,input);
    if (!target) return;
    const lead = Math.min(distance(p, target) / 460, .55);
    this.kick(p, target.x + target.vx * lead - p.x, target.y + target.vy * lead - p.y, clamp(distance(p, target) * .65 + 300, 360, 610));
    if (p.team === 0) this.selected = target.id;
    this.charge = 0;
  }
  shoot(p: Player, input?: Input) {
    if (this.ball.owner !== p.id) return;
    const goalX = p.team === 0 ? FIELD.right + 20 : FIELD.left - 20;
    let dx = goalX - p.x, dy = 340 - p.y;
    if (input) {
      if (Math.hypot(input.x, input.y) > .1) {
        const [nx, ny] = direction(input.x, input.y), [gx, gy] = direction(dx, dy);
        // A small aim assist, while preserving deliberate shots in any direction.
        [dx, dy] = [nx * .85 + gx * .15, ny * .85 + gy * .15];
      }
      const [nx, ny] = direction(dx, dy), error = (this.random() - .5) * .075 * this.charge;
      this.kick(p, nx * Math.cos(error) - ny * Math.sin(error), nx * Math.sin(error) + ny * Math.cos(error), 440 + 400 * this.charge);
    } else {
      const keeper = this.players.find(q => q.team !== p.team && q.keeper)!;
      dy = (keeper.y >= 340 ? 285 : 395) + (this.random() - .5) * settings[this.difficulty].aim - p.y;
      this.kick(p, dx, dy, p.keeper ? 440 : 660);
    }
    this.charge = 0;
  }
  specialKick(p: Player) {
    if (!this.godMode || this.phase !== 'playing' || p.team !== 0 || p.id !== this.selected || this.ball.owner !== p.id) return;
    this.kick(p, 1, 0, 660);
    this.specialShot = { kind: 'homing', team: p.team, shooter: p.id, age: 0, bend: this.random() < .5 ? -1 : 1, waypoint: null, replan: 0 };
    this.charge = 0;
  }
  useSkill(p: Player, input: Input) {
    if (!this.godMode || this.phase !== 'playing' || p.team !== 0 || p.id !== this.selected || this.ball.owner !== p.id) return;
    if(this.selectedSkill === 'magical'){ this.selectingPass = true; this.charge = 0; return; }
    const dx = input.x || input.y ? input.x : FIELD.right + 20 - p.x;
    const dy = input.x || input.y ? input.y : FIELD.centerY - p.y;
    this.kick(p, dx, dy, 1150);
    // Start at the player's feet: sweep the entire launch path rather than skipping nearby opponents.
    this.ball.x = p.x; this.ball.y = p.y;
    this.specialShot = {kind:'dragon',team:p.team,shooter:p.id,age:0,bend:0,waypoint:null,replan:0};
    this.charge = 0;
  }
  choosePassReceiver(id: number): boolean {
    const p=this.owner, receiver=this.players[id];
    if(!this.selectingPass || !p || !receiver || receiver.team!==p.team || receiver.keeper || receiver===p) return false;
    const start={x:this.ball.x,y:this.ball.y}, dx=receiver.x-start.x,dy=receiver.y-start.y;
    const length=Math.max(1,Math.hypot(dx,dy)), bow=clamp(length*.45,65,180);
    const middle={x:(start.x+receiver.x)/2,y:(start.y+receiver.y)/2};
    const candidates=[-1,1].map(side=>({x:clamp(middle.x-dy/length*bow*side,90,934),y:clamp(middle.y+dx/length*bow*side,90,590)}));
    const control=candidates.sort((a,b)=>distance(b,middle)-distance(a,middle))[0];
    this.kick(p,dx,dy,600);this.ball.x=start.x;this.ball.y=start.y;
    this.specialShot={kind:'magical',team:p.team,shooter:p.id,age:0,bend:0,waypoint:null,replan:0,flight:{receiver:id,start,control,duration:clamp(length/520,.5,1.6)}};
    this.selectingPass=false;return true;
  }
  tackle(p: Player) {
    if (!this.godMode || this.phase !== 'playing' || p.team !== 0 || p.id !== this.selected) return;
    // No accuracy roll or tackle cooldown: every press with an opponent in reach succeeds.
    const target = this.players.filter(q => q.team !== p.team && distance(p, q) <= 62)
      .sort((a, b) => Number(b.id === this.ball.owner) - Number(a.id === this.ball.owner) || distance(p, a) - distance(p, b))[0];
    if (!target) return;
    let [nx, ny] = direction(target.x - p.x, target.y - p.y);
    if (!nx && !ny) [nx, ny] = [p.faceX || 1, p.faceY];
    target.stagger = 1.1; target.cooldown = 1.35;
    target.vx = nx * 210; target.vy = ny * 210;
    if (this.ball.owner === target.id) {
      this.specialShot = null; this.ball.owner = null; this.ball.held = 0;
      this.ball.x = target.x; this.ball.y = target.y;
      this.ball.vx = nx * 480; this.ball.vy = ny * 480;
      this.ball.lock = .28;
      // Give the loose ball room to escape, including when it rebounds near a board.
      for (const q of this.players) q.cooldown = Math.max(q.cooldown, .28);
    }
    this.events.push({ type: 'tackle', team: p.team });
  }
  /** A small visibility graph routes the homing ball through open space, including around the keeper. */
  private homingWaypoint(shot: SpecialShot): { x: number; y: number } {
    const b = this.ball;
    const obstacles = this.players.filter(p => p.id !== shot.shooter).map(p => ({
      x: p.x + p.vx * .06, y: p.y + p.vy * .06, radius: p.keeper ? 44 : 36,
    }));
    const goals = [280, 310, 370, 400].map(y => ({ x: FIELD.right + 14, y }));
    const nodes = [{ x: b.x, y: b.y }, ...goals];
    for (const o of obstacles) for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, x = o.x + Math.cos(a) * (o.radius + 20), y = o.y + Math.sin(a) * (o.radius + 20);
      if (x > FIELD.left + 10 && x < FIELD.right - 10 && y > FIELD.top + 12 && y < FIELD.bottom - 12) nodes.push({ x, y });
    }
    const clear = (a: {x: number; y: number}, z: {x: number; y: number}) => {
      const dx = z.x - a.x, dy = z.y - a.y, length2 = dx * dx + dy * dy;
      // The final approach must enter between the posts rather than clipping a side board.
      const edge = FIELD.right - BALL_RADIUS;
      if ((a.x <= edge && z.x > edge) || (z.x <= edge && a.x > edge)) {
        const crossingY = a.y + dy * (edge - a.x) / dx;
        if (crossingY <= FIELD.goalTop + BALL_RADIUS + 3 || crossingY >= FIELD.goalBottom - BALL_RADIUS - 3) return false;
      }
      return obstacles.every(o => {
        const t = clamp(((o.x - a.x) * dx + (o.y - a.y) * dy) / Math.max(1, length2), 0, 1);
        // If a defender has just moved into the safety margin, permit a path escaping it.
        if (a === nodes[0] && distance(a, o) < o.radius && (a.x - o.x) * dx + (a.y - o.y) * dy > 0) return true;
        return Math.hypot(a.x + dx * t - o.x, a.y + dy * t - o.y) >= o.radius;
      });
    };
    const cost = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set<number>(); cost[0] = 0;
    for (let k = 0; k < nodes.length; k++) {
      let u = -1;
      for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (u < 0 || cost[i] < cost[u])) u = i;
      if (u < 0 || !Number.isFinite(cost[u])) break;
      if (u >= 1 && u <= 4) { while (previous[u] > 0) u = previous[u]; return nodes[u]; }
      visited.add(u);
      for (let v = 1; v < nodes.length; v++) {
        const next = cost[u] + distance(nodes[u], nodes[v]);
        if (!visited.has(v) && next < cost[v] && clear(nodes[u], nodes[v])) { cost[v] = next; previous[v] = u; }
      }
    }
    // In a crowd, try the open side of the nearest opponent before replanning.
    const closest = obstacles.sort((a, z) => distance(a, b) - distance(z, b))[0];
    return closest && distance(closest, b) < 100 ? { x: clamp(b.x + (b.x - closest.x) * 2, 85, 940), y: clamp(b.y + (b.y - closest.y || shot.bend * 30) * 2, 85, 595) } : goals[shot.bend < 0 ? 0 : 3];
  }
  private guideSpecial(dt: number) {
    const shot = this.specialShot;
    if (!shot) return;
    if (shot.kind === 'magical' && shot.flight) {
      shot.age+=dt;
      const f=shot.flight, receiver=this.players[f.receiver],t=Math.min(1,shot.age/f.duration),u=1-t;
      const x=u*u*f.start.x+2*u*t*f.control.x+t*t*receiver.x;
      const y=u*u*f.start.y+2*u*t*f.control.y+t*t*receiver.y;
      this.ball.vx=(x-this.ball.x)/dt;this.ball.vy=(y-this.ball.y)/dt;return;
    }
    if (shot.kind === 'dragon') return;
    shot.age += dt;
    if (!this.godMode || this.ball.owner !== null || shot.age > 5) { this.specialShot = null; return; }
    shot.replan -= dt;
    if (!shot.waypoint || shot.replan <= 0 || distance(this.ball, shot.waypoint) < 18) { shot.waypoint = this.homingWaypoint(shot); shot.replan = .07; }
    const [nx, ny] = direction(shot.waypoint.x - this.ball.x, shot.waypoint.y - this.ball.y);
    this.ball.vx = nx * 660; this.ball.vy = ny * 660;
  }
  private steer(p: Player, dx: number, dy: number, speed: number, dt: number) {
    const [nx, ny] = direction(dx, dy);
    const blend = 1 - Math.exp(-12 * dt);
    p.vx += (nx * speed - p.vx) * blend; p.vy += (ny * speed - p.vy) * blend;
    if (Math.hypot(nx, ny) > .1) { p.faceX = nx; p.faceY = ny; }
    p.x = clamp(p.x + p.vx * dt, FIELD.left + 15, FIELD.right - 15);
    p.y = clamp(p.y + p.vy * dt, FIELD.top + 15, FIELD.bottom - 15);
  }
  private ai(p: Player, dt: number) {
    const owner = this.owner, attacking = owner?.team === p.team, dir = p.team === 0 ? 1 : -1;
    let tx = p.x, ty = p.y, speed = p.team === 0 ? 166 : settings[this.difficulty].speed;
    p.think -= dt;
    if (p.keeper) {
      const homeX = p.team === 0 ? 105 : 919;
      tx = homeX;
      ty = clamp(340 + (this.ball.y - 340) * .7, FIELD.goalTop + 10, FIELD.goalBottom - 10);
      if (!owner && Math.abs(this.ball.x - homeX) < 95) { tx = clamp(this.ball.x, homeX - 24, homeX + 24); ty = clamp(this.ball.y, 242, 438); }
      speed = p.team === 0 ? 205 : settings[this.difficulty].speed + 32;
      if (owner === p && this.ball.held > .7) this.pass(p);
    } else if (owner === p) {
      tx = p.team === 0 ? 894 : 130; ty = 340 + (p.y > 340 ? 25 : -25);
      if (p.think <= 0) {
        p.think = settings[this.difficulty].reaction;
        const enemies = this.players.filter(q => q.team !== p.team && !q.keeper);
        const near = enemies.some(q => distance(p, q) < 65);
        if (Math.abs(tx - p.x) < 270 && Math.abs(p.y - 340) < 175) this.shoot(p);
        else if (near && this.ball.held > .65) this.pass(p);
      }
    } else if (this.teamSize === 5) {
      const teammates=this.players.filter(q=>q.team===p.team&&!q.keeper);
      const chaser=[...teammates].sort((a,b)=>distance(a,this.ball)-distance(b,this.ball))[0];
      const localBall=p.team===0?this.ball.x:1024-this.ball.x;
      let localX=300;
      if(attacking) {
        localX=p.role==='defender'?clamp(localBall-155,200,580):p.role==='forward'?clamp(localBall+140,440,855):clamp(localBall+45,300,805);
        ty=p.role==='upper'?175:p.role==='lower'?505:340;
      } else if(chaser===p) {
        localX=p.team===0?this.ball.x+this.ball.vx*.12:1024-(this.ball.x+this.ball.vx*.12);
        ty=this.ball.y+this.ball.vy*.12;
      } else {
        localX=p.role==='defender'?clamp(localBall-170,160,380):p.role==='forward'?clamp(localBall-80,290,590):clamp(localBall-110,220,590);
        ty=p.role==='upper'?235:p.role==='lower'?445:340;
        if(owner && p.role!=='defender') {
          const threats=this.players.filter(q=>q.team!==p.team&&!q.keeper&&q!==owner).sort((a,b)=>a.y-b.y);
          const threat=p.role==='upper'?threats[0]:p.role==='lower'?threats.at(-1):undefined;
          if(threat) { ty=clamp(threat.y,135,545); localX=clamp((p.team===0?threat.x:1024-threat.x)-45,200,600); }
        }
      }
      tx=p.team===0?localX:1024-localX;
      // Keep support players separated and let them make room for the human-controlled player.
      if(chaser!==p || attacking) for(const q of teammates) if(q!==p&&distance(p,q)<85) {
        const [sx,sy]=direction(p.x-q.x,p.y-q.y);tx+=sx*40;ty+=sy*40;
      }
    } else if (attacking) {
      tx = clamp(owner!.x + dir * 115, 175, 849);
      ty = owner!.y < 340 ? 445 : 235;
    } else {
      const chasers = this.players.filter(q => q.team === p.team && !q.keeper).sort((a, b) => distance(a, this.ball) - distance(b, this.ball));
      if (chasers[0] === p) { tx = this.ball.x + this.ball.vx * .12; ty = this.ball.y + this.ball.vy * .12; }
      else { tx = clamp(this.ball.x - dir * 125, 170, 854); ty = 340 + (this.ball.y - 340) * .45; }
    }
    const d = Math.hypot(tx - p.x, ty - p.y);
    this.steer(p, tx - p.x, ty - p.y, Math.min(speed, d * 5), dt);
  }
  step(dt: number, input: Input) {
    this.events = [];
    if (this.selectingPass || this.phase === 'ready' || this.phase === 'ended') return;
    dt = clamp(dt, 0, 1 / 30);
    if (this.phase === 'goal') {
      this.goalWait -= dt;
      if (this.goalWait <= 0) { this.resetPositions(this.kickoffTeam); this.phase = 'playing'; }
      return;
    }
    this.elapsed += dt; this.remaining = Math.max(0, this.remaining - dt);
    if (this.remaining <= 0) { this.phase = 'ended'; this.specialShot = null; this.charge = 0; this.events.push({ type: 'end' }); return; }
    if (input.switch) this.switchPlayer(input);
    const controlled = this.players[this.selected];
    if (input.charge && this.ball.owner === controlled.id) this.charge = Math.min(1, this.charge + dt / .85);
    if (input.pass) this.pass(controlled, input);
    else if (input.skill) this.useSkill(controlled, input);
    else if (input.homing && this.godMode) this.specialKick(controlled);
    else if (input.tackle && this.godMode) this.tackle(controlled);
    else if (input.shoot) this.shoot(controlled, input);
    if(this.selectingPass)return;
    if (this.ball.owner !== this.selected) this.charge = 0;
    for (const p of this.players) {
      if(this.specialShot?.flight?.receiver === p.id){p.vx=0;p.vy=0;continue;}
      p.cooldown = Math.max(0, p.cooldown - dt);
      if (p.stagger > 0) {
        p.stagger = Math.max(0, p.stagger - dt);
        p.x = clamp(p.x + p.vx * dt, 87, 937); p.y = clamp(p.y + p.vy * dt, 85, 595);
        p.vx *= Math.exp(-7 * dt); p.vy *= Math.exp(-7 * dt);
        continue;
      }
      if (p.id === this.selected) {
        const moving = Math.hypot(input.x, input.y) > .1;
        const sprint = input.sprint && moving && p.stamina > .02;
        p.stamina = clamp(p.stamina + (sprint ? -.27 : .18) * dt, 0, 1);
        this.steer(p, input.x, input.y, (sprint ? 274 : 190) * (this.charge > 0 ? .67 : 1), dt);
      } else { p.stamina = Math.min(1, p.stamina + dt * .18); this.ai(p, dt); }
    }
    // Resolve player overlap, including keepers, without imparting explosive velocities.
    for (let i = 0; i < this.players.length; i++) for (let j = i + 1; j < this.players.length; j++) {
      const a = this.players[i], b = this.players[j], d = distance(a, b);
      if (d < 27) {
        const [nx, ny] = d < .001 ? [1, 0] : direction(a.x - b.x, a.y - b.y), overlap = (27 - d) * .5;
        a.x = clamp(a.x + nx * overlap, 87, 937); a.y = clamp(a.y + ny * overlap, 85, 595);
        b.x = clamp(b.x - nx * overlap, 87, 937); b.y = clamp(b.y - ny * overlap, 85, 595);
      }
    }
    this.ball.lock = Math.max(0, this.ball.lock - dt);
    const owner = this.owner;
    if (owner) {
      this.ball.held += dt;
      const reach = Math.hypot(owner.vx, owner.vy) > 220 ? 30 : 19;
      this.ball.x += (owner.x + owner.faceX * reach - this.ball.x) * (1 - Math.exp(-22 * dt));
      this.ball.y += (owner.y + owner.faceY * reach - this.ball.y) * (1 - Math.exp(-22 * dt));
      this.ball.vx = owner.vx; this.ball.vy = owner.vy;
      if (this.ball.lock <= 0) {
        const thief = this.players.find(p => p.team !== owner.team && p.cooldown <= 0 && distance(p, this.ball) < 25 && ((p.x - owner.x) * owner.faceX + (p.y - owner.y) * owner.faceY > -3));
        if (thief) {
          this.ball.owner = null; this.ball.lock = .12;
          this.ball.vx = (thief.team === 0 ? 1 : -1) * 155; this.ball.vy = (this.ball.y - thief.y) * 5;
          owner.cooldown = .5; thief.cooldown = .12;
          this.events.push({ type: 'steal', team: thief.team });
        }
      }
    } else {
      this.guideSpecial(dt);
      // Small substeps prevent fast shots skipping thin posts, boards, or goalkeeper contacts.
      const pieces = Math.max(1, Math.ceil(Math.hypot(this.ball.vx, this.ball.vy) * dt / 5));
      for (let i = 0; i < pieces; i++) {
        this.ball.x += this.ball.vx * dt / pieces; this.ball.y += this.ball.vy * dt / pieces;
        if (this.bounds()) return;
        this.collectBall();
        if (this.ball.owner !== null) break;
      }
      const drag = this.specialShot && this.specialShot.kind !== 'homing' ? 1 : Math.exp(-.48 * dt); this.ball.vx *= drag; this.ball.vy *= drag;
    }
    if (this.bounds()) return;
  }
  private collectBall() {
    if(this.specialShot?.kind === 'magical' && this.specialShot.flight) {
      const receiver=this.players[this.specialShot.flight.receiver];
      if(this.specialShot.age>=this.specialShot.flight.duration && distance(receiver,this.ball)<23){
        this.ball.owner=receiver.id;this.ball.lock=.5;this.ball.held=0;this.ball.vx=0;this.ball.vy=0;
        receiver.stagger=0;receiver.cooldown=0;this.selected=receiver.id;this.specialShot=null;return;
      }
    }
    if (this.specialShot?.kind === 'dragon' || this.specialShot?.kind === 'magical') {
      const shot = this.specialShot;
      const [nx,ny] = direction(-this.ball.vy,this.ball.vx);
      for (const p of this.players) {
        if (p.team === shot.team || distance(p,this.ball) > (p.keeper ? 29 : 25)) continue;
        const side = (p.x-this.ball.x)*nx+(p.y-this.ball.y)*ny >= 0 ? 1 : -1;
        p.x = clamp(p.x+nx*side*34,87,937); p.y = clamp(p.y+ny*side*34,85,595);
        p.vx = nx*side*290; p.vy = ny*side*290;
        p.stagger = 1.2; p.cooldown = 1.45;
      }
      return;
    }
    for (const p of [...this.players].sort((a, b) => distance(a, this.ball) - distance(b, this.ball))) {
      const speed = Math.hypot(this.ball.vx, this.ball.vy);
      if (p.cooldown > 0 || distance(p, this.ball) > (p.keeper ? 26 : 22)) continue;
      // Keepers may block even during the short release lock; field players cannot re-catch a kick instantly.
      if (!p.keeper && this.ball.lock > 0) continue;
      this.specialShot = null;
      if (speed < 390 || p.keeper) {
        this.ball.owner = p.id; this.ball.lock = .42; this.ball.held = 0;
        this.ball.vx = 0; this.ball.vy = 0;
        if (p.team === 0 && !p.keeper) this.selected = p.id;
        if (p.keeper) this.events.push({ type: 'save', team: p.team });
      } else {
        const [nx, ny] = direction(this.ball.x - p.x, this.ball.y - p.y);
        this.ball.x = p.x + nx * 25; this.ball.y = p.y + ny * 25;
        this.ball.vx = nx * speed * .42; this.ball.vy = ny * speed * .42;
        p.cooldown = .15;
      }
      break;
    }
  }
  private bounds(): boolean {
    const b = this.ball, r = BALL_RADIUS;
    const mouth = b.y > FIELD.goalTop + r && b.y < FIELD.goalBottom - r;
    if (mouth && (b.x - r > FIELD.right || b.x + r < FIELD.left)) {
      const scoring: Team = b.x > 512 ? 0 : 1;
      this.score[scoring]++; this.kickoffTeam = scoring === 0 ? 1 : 0;
      this.specialShot = null;
      this.phase = 'goal'; this.goalWait = 2.3; this.charge = 0;
      this.ball.owner = null; this.ball.vx = 0; this.ball.vy = 0;
      this.events.push({ type: 'goal', team: scoring }); return true;
    }
    if (b.y < FIELD.top + r) { this.specialShot = null; b.y = FIELD.top + r; b.vy = Math.abs(b.vy) * .8; }
    if (b.y > FIELD.bottom - r) { this.specialShot = null; b.y = FIELD.bottom - r; b.vy = -Math.abs(b.vy) * .8; }
    if (!mouth) {
      if (b.x < FIELD.left + r) { this.specialShot = null; b.x = FIELD.left + r; b.vx = Math.abs(b.vx) * .8; }
      if (b.x > FIELD.right - r) { this.specialShot = null; b.x = FIELD.right - r; b.vx = -Math.abs(b.vx) * .8; }
    }
    return false;
  }
}
