'use strict';
const assert=require('node:assert/strict');
const {SIZE,winningLine,chooseMove}=require('./engine.js');
const empty=()=>Array(SIZE*SIZE).fill(null);
for(const step of [1,15,16,14]){const b=empty(),start=step===14?14:0;for(let n=0;n<4;n++)b[start+n*step]='X';assert.equal(winningLine(b,start).length,0);b[start+4*step]='X';assert.equal(winningLine(b,start+2*step).length,5);b[start+5*step]='X';assert.equal(winningLine(b,start).length,6);}
let b=empty();[13,14,15,16,17].forEach(i=>b[i]='X');assert.equal(winningLine(b,15).length,0,'Rows cannot wrap');
b=empty();[30,31,33,34].forEach(i=>b[i]='X');assert.equal(winningLine(b,30).length,0,'Gaps break a line');
b=empty();[0,1,2,3].forEach(i=>b[i]='X');assert.equal(chooseMove(b),4,'Block immediate loss');assert.equal(b[4],null,'AI evaluation must leave board unchanged');
[30,31,32,33].forEach(i=>b[i]='O');assert.equal(chooseMove(b),34,'Take win before blocking');
assert.equal(chooseMove(empty()),112,'Open at center');assert.equal(chooseMove(Array(225).fill('X')),null,'No move on full board');
console.log('Passed: four directions, overlines, gaps, row boundaries, AI blocking, winning, opening, full board.');
// Exercise the UI controller with a minimal DOM and controlled computer timer.
const vm=require('node:vm'),fs=require('node:fs');
const nodes=new Map();function node(){return {textContent:'',disabled:false,style:{},dataset:{},children:[],classList:{toggle(){}},setAttribute(){},addEventListener(){},appendChild(child){this.children.push(child)},showModal(){},close(){}};}
let pending;const context={FiveEngine:require('./engine.js'),document:{getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},createElement:node},setTimeout(fn){pending=fn;return 1},clearTimeout(){pending=null}};
vm.createContext(context);vm.runInContext(fs.readFileSync('game.js','utf8'),context);
vm.runInContext('place(0);place(15);place(1);place(16);place(2);place(17);place(3);place(18);place(4);',context);
assert.match(nodes.get('status').textContent,/X wins/);assert.equal(nodes.get('score-x').textContent,1);
nodes.get('undo').onclick();assert.equal(nodes.get('score-x').textContent,0);assert.equal(nodes.get('status').textContent,'X, your move.');
vm.runInContext("newRound();mode='ai';place(112)",context);assert.match(nodes.get('status').textContent,/thinking/);pending();assert.equal(nodes.get('move-count').textContent,'MOVE 02');nodes.get('undo').onclick();assert.equal(nodes.get('move-count').textContent,'MOVE 00');
vm.runInContext('place(112)',context);nodes.get('undo').onclick();assert.equal(pending,null);assert.equal(nodes.get('move-count').textContent,'MOVE 00');
console.log('Passed: winning UI, score rollback, computer turn, paired undo, cancellation during thinking.');
for(const level of ['easy','medium','hard']){
 for(const step of [1,15,16,14]){
  const position=empty(),start=step===14?14:0;
  [0,1,3,4].forEach(n=>position[start+n*step]='X');
  assert.equal(chooseMove(position,level),start+2*step,`${level}: block broken four in direction ${step}`);
 }
}
for(const player of ['O','X']){
 const position=empty();[110,111,97,127].forEach(i=>position[i]=player);
 const before=position.slice();
 assert.equal(chooseMove(position,'hard'),112,`${player}: create or prevent crossing double threat`);
 assert.deepEqual(position,before,'Search preserves live board');
}
vm.runInContext('newRound()',context);nodes.get('local-mode').onclick();assert.equal(nodes.get('difficulty-control').hidden,true);nodes.get('ai-mode').onclick();assert.equal(nodes.get('difficulty-control').hidden,false);nodes.get('difficulty').value='hard';nodes.get('difficulty').onchange();assert.match(nodes.get('difficulty-hint').textContent,/several moves/);
console.log('Passed: all difficulty levels block broken lines, hard creates/prevents forks, difficulty controls.');
// Master tactics: rotate and reflect crossing threats to avoid directional bias.
function transform(i,rotation,mirror){let r=Math.floor(i/15),c=i%15;if(mirror)c=14-c;for(let n=0;n<rotation;n++){const old=r;r=c;c=14-old;}return r*15+c;}
for(let rotation=0;rotation<4;rotation++)for(const mirror of [false,true]){
 const position=empty();[110,111,97,127].forEach(i=>position[transform(i,rotation,mirror)]='O');
 assert.equal(chooseMove(position,'master'),112,'Master creates rotated double threat');
}
for(const step of [1,15,16,14]){
 const position=empty(),start=step===14?14:0;[0,1,3,4].forEach(n=>position[start+n*step]='X');
 assert.equal(chooseMove(position,'master'),start+2*step,'Master blocks gapped four');
}
let masterPosition=empty();[109,110,111,67,82,97].forEach(i=>masterPosition[i]='X');[108,52].forEach(i=>masterPosition[i]='O');
const defense=chooseMove(masterPosition,'master');assert.ok([112,113,127].includes(defense),'Master prevents crossing four fork');
masterPosition=empty();[105,106,108,109].forEach(i=>masterPosition[i]='O');[0,1,2,3].forEach(i=>masterPosition[i]='X');
assert.equal(chooseMove(masterPosition,'master'),107,'Master wins before defending');
assert.equal(chooseMove(Array(225).fill('X'),'master'),null);
const copy=masterPosition.slice();chooseMove(masterPosition,'master');assert.deepEqual(masterPosition,copy);
// Cooperative search cancellation must discard callbacks that were already queued.
vm.runInContext("newRound();mode='ai';difficulty='master';place(112)",context);
pending();const stale=pending;nodes.get('undo').onclick();stale();assert.equal(nodes.get('move-count').textContent,'MOVE 00');
vm.runInContext('place(112)',context);pending();const staleRound=pending;vm.runInContext('newRound()',context);staleRound();assert.equal(nodes.get('move-count').textContent,'MOVE 00');
nodes.get('difficulty').value='master';nodes.get('difficulty').onchange();assert.match(nodes.get('difficulty-hint').textContent,/strongest/);
console.log('Passed: Master symmetry, broken threats, forks, win priority, full board, immutability, interrupted search.');
vm.runInContext("newRound();mode='ai';difficulty='master';place(112)",context);
let callbacks=0;const started=Date.now();
while(nodes.get('move-count').textContent==='MOVE 01'&&callbacks++<10000)pending();
assert.equal(nodes.get('move-count').textContent,'MOVE 02','Master completes a legal response');
assert.ok(Date.now()-started<5000,'Master respects bounded thinking time');
assert.ok(callbacks>1,'Master yields control during search');
console.log('Passed: Master completes a turn with cooperative, bounded search.');
vm.runInContext('newRound()',context);nodes.get('cvc-mode').onclick();
assert.equal(nodes.get('start-game').hidden,false);assert.equal(pending,null,'Mode waits for Start');
assert.match(nodes.get('status').textContent,/Press Start/);
nodes.get('difficulty').value='easy';nodes.get('difficulty').onchange();nodes.get('start-game').onclick();
const opening=pending;nodes.get('start-game').onclick();assert.equal(pending,opening,'Repeated Start cannot duplicate a turn');
pending();assert.equal(nodes.get('move-count').textContent,'MOVE 01');pending();assert.equal(nodes.get('move-count').textContent,'MOVE 02');
const abandoned=pending;vm.runInContext('newRound()',context);abandoned();assert.equal(nodes.get('move-count').textContent,'MOVE 00');assert.equal(nodes.get('start-game').disabled,false);
// Computer X must attack as X, not accidentally optimize for O.
vm.runInContext("[0,1,2,3].forEach(i=>board[i]='X');history=[0,15,1,16,2,17,3,18];[15,16,17,18].forEach(i=>board[i]='O');turn='X';",context);
nodes.get('start-game').onclick();pending();assert.match(nodes.get('status').textContent,/Computer X wins/);assert.equal(nodes.get('score-x').textContent,1);assert.equal(nodes.get('start-game').disabled,true);
vm.runInContext('newRound()',context);nodes.get('start-game').onclick();let moves=0;
while(!vm.runInContext('finished',context)&&moves++<225)pending();
assert.equal(vm.runInContext('finished',context),true,'Computer match finishes automatically');assert.equal(vm.runInContext('timer',context),null,'No next turn after game ends');
vm.runInContext('newRound()',context);nodes.get('local-mode').onclick();assert.equal(nodes.get('start-game').hidden,true);
console.log('Passed: Computer vs Computer waits for Start, alternates, cancels, plays X correctly, and finishes a full match.');
vm.runInContext("newRound();mode='ai';difficulty='easy'",context);nodes.get('god-mod').onclick();
vm.runInContext('place(0)',context);assert.equal(pending,null,'No computer reply after first cheat X');assert.match(nodes.get('status').textContent,/mark 2 of 2/);
nodes.get('god-mod').onclick();assert.equal(vm.runInContext('godMod',context),true,'Cannot toggle midway through double turn');
vm.runInContext('place(0)',context);assert.equal(nodes.get('move-count').textContent,'MOVE 01','Occupied square does not consume mark');
nodes.get('undo').onclick();assert.match(nodes.get('status').textContent,/mark 1 of 2/);
vm.runInContext('place(0);place(1)',context);assert.ok(pending);pending();assert.equal(nodes.get('move-count').textContent,'MOVE 03');assert.match(nodes.get('status').textContent,/mark 1 of 2/);
nodes.get('undo').onclick();assert.equal(nodes.get('move-count').textContent,'MOVE 00','Undo removes both X marks and computer reply');
vm.runInContext("newRound();mode='local';[0,1,2,3].forEach(i=>board[i]='X');place(4)",context);assert.match(nodes.get('status').textContent,/X wins/);assert.equal(pending,null,'First mark can end match');
vm.runInContext("newRound();mode='cvc';place(0)",context);assert.equal(vm.runInContext('turn',context),'O','Cheat never applies to computer X');assert.equal(nodes.get('god-mod').hidden,true);
console.log('Passed: God mod two marks, occupied cells, toggle guard, undo, first-mark victory, and computer-only exclusion.');

context.XiangqiEngine=require('./xiangqi-engine.js');
vm.runInContext(fs.readFileSync('xiangqi.js','utf8'),context);
context.document.getElementById('xq-level').value='easy';nodes.get('tab-xiangqi').onclick();
assert.equal(nodes.get('gomoku-main').hidden,true);
const chessCells=nodes.get('xq-board').children;
chessCells[54].onclick();chessCells[45].onclick();assert.match(nodes.get('xq-status').textContent,/thinking/);
pending();let chessSteps=0;while(nodes.get('xq-count').textContent==='MOVE 1'&&chessSteps++<10000)pending();
assert.equal(nodes.get('xq-count').textContent,'MOVE 2');nodes.get('xq-undo').onclick();assert.equal(nodes.get('xq-count').textContent,'MOVE 0');
chessCells[54].onclick();chessCells[45].onclick();const oldChess=pending;nodes.get('tab-gomoku').onclick();oldChess();assert.equal(nodes.get('xq-count').textContent,'MOVE 1');nodes.get('tab-xiangqi').onclick();assert.ok(pending);nodes.get('xq-undo').onclick();assert.equal(nodes.get('xq-count').textContent,'MOVE 0');
console.log('Passed: chess UI human/computer turns, undo, tabs pause stale search, and resume.');
// Soccer participates in navigation without resetting either board or running hidden AI.
let soccerActive=false;
context.soccer={activate(value){soccerActive=value}};
chessCells[54].onclick();chessCells[45].onclick();const beforeSoccer=pending;
nodes.get('tab-soccer').onclick();assert.equal(soccerActive,true);assert.equal(nodes.get('soccer-main').hidden,false);assert.equal(nodes.get('xiangqi-main').hidden,true);
beforeSoccer();assert.equal(nodes.get('xq-count').textContent,'MOVE 1','Hidden chess search remains canceled on Soccer');
nodes.get('tab-xiangqi').onclick();assert.equal(soccerActive,false);assert.ok(pending,'Chess resumes its pending reply');nodes.get('xq-undo').onclick();
nodes.get('tab-gomoku').onclick();vm.runInContext("newRound();godMod=false;mode='ai';difficulty='easy';place(112)",context);const beforeSoccerGomoku=pending;
nodes.get('tab-soccer').onclick();beforeSoccerGomoku();assert.equal(nodes.get('move-count').textContent,'MOVE 01','Hidden Gomoku does not move');
nodes.get('tab-gomoku').onclick();assert.ok(pending,'Gomoku resumes its pending reply');pending();assert.equal(nodes.get('move-count').textContent,'MOVE 02');
console.log('Passed: Soccer tab activates and pauses, preserves both board games, cancels hidden AI, and resumes replies.');
