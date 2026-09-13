'use strict';
const {SIZE,winningLine,chooseMove,masterSearch}=FiveEngine;
const $=id=>document.getElementById(id);
let board=Array(SIZE*SIZE).fill(null),history=[],moveStates=[],godMod=false,xUsed=0,turn='X',mode='local',difficulty='medium',started=false,finished=false,thinking=false,timer=null,searchVersion=0,win=[],score={local:{X:0,O:0,draws:0},ai:{X:0,O:0,draws:0},cvc:{X:0,O:0,draws:0}},result=null;
const cells=board.map((_,i)=>{const button=document.createElement('button');button.className='cell';button.setAttribute('aria-label',`Row ${Math.floor(i/SIZE)+1}, column ${i%SIZE+1}, empty`);button.addEventListener('click',()=>{if(!thinking&&mode!=='cvc')place(i)});button.addEventListener('keydown',e=>{const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-SIZE,ArrowDown:SIZE};if(!(e.key in offsets))return;e.preventDefault();let next=i+offsets[e.key];while(next>=0&&next<board.length){if(!cells[next].disabled){cells[next].focus();break}next+=offsets[e.key];}});$('board').appendChild(button);return button;});
function render(){$('god-mod').hidden=mode==='cvc';$('god-mod').disabled=finished||xUsed>0;$('god-mod').setAttribute('aria-pressed',String(godMod));$('god-mod').textContent=godMod?'God mod · ON':'God mod · OFF';$('god-mod').classList.toggle('enabled',godMod);$('difficulty-control').hidden=mode==='local';$('start-game').hidden=mode!=='cvc';$('start-game').disabled=started||finished;$('start-game').textContent=finished?'Round complete':started?'Match in progress…':'Start game';cells.forEach((cell,i)=>{cell.textContent=board[i]==='X'?'×':board[i]==='O'?'○':'';cell.className=`cell ${board[i]==='O'?'o':''} ${history.at(-1)===i?'last':''} ${win.includes(i)?'win':''}`;cell.disabled=!!board[i]||finished||thinking||mode==='cvc';cell.dataset.preview=turn==='X'?'×':'○';cell.setAttribute('aria-label',`Row ${Math.floor(i/SIZE)+1}, column ${i%SIZE+1}, ${board[i]||'empty'}${win.includes(i)?', winning line':''}`);});$('status').textContent=finished?(result==='draw'?'A full board. An even match.':`${mode==='cvc'?'Computer '+result:result=== 'O'&&mode==='ai'?'Computer':result} wins. A beautiful line!`):mode==='cvc'&&!started?'Ready? Press Start game.':thinking?(mode==='cvc'?`Computer ${turn} is thinking…`:'Computer is thinking…'):godMod&&mode!=='cvc'&&turn==='X'?`X, place mark ${xUsed+1} of 2.`:`${turn}, your move.`;$('status-dot').style.background=turn==='X'?'#d5ef8c':'#eea390';$('move-count').textContent=`MOVE ${String(history.length).padStart(2,'0')}`;$('player-x').classList.toggle('active',!finished&&turn==='X');$('player-o').classList.toggle('active',!finished&&turn==='O');$('score-x').textContent=score[mode].X;$('score-o').textContent=score[mode].O;$('draws').textContent=`${score[mode].draws} draws`;$('name-o').textContent=mode==='cvc'?'Computer O':mode==='ai'?'Computer':'Player two';$('name-x').textContent=mode==='cvc'?'Computer X':mode==='ai'?'You':'Player one';$('undo').disabled=history.length===0||mode==='cvc';$('turn-note').textContent=finished?'Another round? X goes first.':mode==='cvc'?'Both computers use the selected difficulty.':mode==='ai'?'You play X. Take your time.':'Pass the board. Play your best.';for(const m of ['local','ai','cvc']){$(`${m}-mode`).classList.toggle('selected',mode===m);$(`${m}-mode`).setAttribute('aria-pressed',String(mode===m));}}
function place(i){if(finished||board[i]||i==null)return;moveStates.push({turn,xUsed});board[i]=turn;history.push(i);win=winningLine(board,i);if(win.length){finished=true;result=turn;score[mode][turn]++;}else if(history.length===board.length){finished=true;result='draw';score[mode].draws++;}else if(turn==='X'&&godMod&&mode!=='cvc'&&xUsed===0){xUsed=1;}else{turn=turn==='X'?'O':'X';xUsed=0;}if(!finished&&((mode==='ai'&&turn==='O')||(mode==='cvc'&&started))){thinking=true;scheduleComputer();}render();}
function scheduleComputer(){
 const version=++searchVersion;
 timer=setTimeout(()=>{
  if(version!==searchVersion)return;
  // Engines evaluate O as their own side; swap marks when Computer X plays.
  const position=turn==='X'?board.map(mark=>mark==='X'?'O':mark==='O'?'X':null):board.slice();
  if(difficulty!=='master'){const move=chooseMove(position,difficulty);thinking=false;timer=null;place(move);return;}
  const search=masterSearch(position);
  function advance(){
   if(version!==searchVersion)return;
   const until=Date.now()+12;let step;
   do{step=search.next();}while(!step.done&&Date.now()<until);
   if(step.done){thinking=false;timer=null;place(step.value);}
   else timer=setTimeout(advance,0);
  }
  advance();
 },350);
}
function newRound(){started=false;searchVersion++;clearTimeout(timer);timer=null;thinking=false;board.fill(null);history=[];moveStates=[];xUsed=0;turn='X';finished=false;win=[];result=null;render();}
function confirmAction(text,action){$('confirm-text').textContent=text;$('confirm-action').onclick=()=>{$('confirm-dialog').close();action()};$('confirm-dialog').showModal();}
$('difficulty').onchange=()=>{difficulty=$('difficulty').value;$('difficulty-hint').textContent={easy:'Spots immediate wins and blocks. A gentle challenge.',medium:'Blocks threats and plans its reply.',hard:'Searches several moves ahead and sets up double threats.',master:'Our strongest opponent. Deep search and forcing threats. Thinks for up to ~2 seconds.'}[difficulty];};
$('god-mod').onclick=()=>{if(mode==='cvc'||finished||xUsed>0)return;godMod=!godMod;render();};
$('start-game').onclick=()=>{if(mode!=='cvc'||started||finished)return;started=true;thinking=true;scheduleComputer();render();};
$('cancel-action').onclick=()=>$('confirm-dialog').close();
$('new-game').onclick=()=>history.length&&!finished?confirmAction('This clears the current board. Your session scores will stay.',newRound):newRound();
for(const next of ['local','ai','cvc'])$(`${next}-mode`).onclick=()=>{if(next===mode)return;const apply=()=>{mode=next;newRound()};if(history.length&&!finished)confirmAction('Switching modes starts a new round. Each mode keeps its own scores.',apply);else apply();};
$('undo').onclick=()=>{if(!history.length||mode==='cvc')return;searchVersion++;clearTimeout(timer);timer=null;thinking=false;if(finished){if(result==='draw')score[mode].draws--;else score[mode][result]--;}function removeLast(){const index=history.pop(),mark=board[index];board[index]=null;const previous=moveStates.pop();turn=previous?.turn||mark;xUsed=previous?.xUsed||0;return mark;}
const removed=removeLast();
if(mode==='ai'&&removed==='O'&&history.length){removeLast();while(xUsed>0&&history.length)removeLast();}
finished=false;result=null;win=[];render();};
$('reset-score').onclick=()=>confirmAction('Clear scores in all modes and start a new round?',()=>{score={local:{X:0,O:0,draws:0},ai:{X:0,O:0,draws:0},cvc:{X:0,O:0,draws:0}};newRound();});
render();
