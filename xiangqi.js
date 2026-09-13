'use strict';
const xq=(()=>{const E=XiangqiEngine,$=id=>document.getElementById(id),labels={rK:'帥',rA:'仕',rE:'相',rH:'馬',rR:'車',rC:'炮',rP:'兵',bK:'將',bA:'士',bE:'象',bH:'馬',bR:'車',bC:'砲',bP:'卒'},names={K:'General',A:'Advisor',E:'Elephant',H:'Horse',R:'Chariot',C:'Cannon',P:'Soldier'};
 let board=E.initial(),side='r',selected=null,moves=[],history=[],ended=false,message='',version=0,timer=null,active=false,positions=[],quiet=0;
 const key=()=>board.map(p=>p||'..').join('')+side;positions=[key()];
 const buttons=board.map((_,i)=>{const b=document.createElement('button');b.className='xq-cell';b.onclick=()=>click(i);$('xq-board').appendChild(b);return b;});
 function render(){$('xq-result').hidden=!ended;$('xq-result-text').textContent=ended?message:'';const check=E.inCheck(board,side);$('xq-status').textContent=ended?message:side==='b'?'Black is thinking…':check?'You are in check. Protect your general.':selected===null?'Your move. Select a red piece.':`Choose a highlighted destination.`;buttons.forEach((b,i)=>{const p=board[i],target=moves.some(m=>m.to===i);b.innerHTML=p?`<span class="xq-piece ${p[0]==='r'?'red':'black'}">${labels[p]}<small>${names[p[1]]}</small></span>`:target?'<span class="xq-dot"></span>':'';b.className=`xq-cell ${selected===i?'selected':''} ${target?'target':''} ${history.length&&(history.at(-1).move.from===i||history.at(-1).move.to===i)?'last':''}`;b.disabled=ended||side==='b';b.setAttribute('aria-label',`Row ${Math.floor(i/9)+1}, column ${i%9+1}, ${p?(p[0]==='r'?'Red ':'Black ')+names[p[1]]:'empty'}${target?', legal destination':''}`);});$('xq-undo').disabled=!history.length;$('xq-count').textContent=`MOVE ${history.length}`;}
 function click(i){if(ended||side!=='r')return;const move=moves.find(m=>m.to===i);if(move){play(move);return;}selected=board[i]?.[0]==='r'?i:null;moves=selected===null?[]:E.legal(board,'r').filter(m=>m.from===i);render();}
 function play(move){history.push({board:board.slice(),side,quiet,move});const captured=board[move.to];quiet=captured?0:quiet+1;board[move.to]=board[move.from];board[move.from]=null;side=E.other(side);selected=null;moves=[];positions.push(key());settle();render();if(!ended&&side==='b'&&active)schedule();}
 function settle(){
  const red=board.includes('rK'),black=board.includes('bK');
  if(!red||!black){ended=true;message=black?'Computer wins — your general was captured.':'You win — Black’s general was captured.';}
  else if(!E.legal(board,side).length){ended=true;message=`${side==='b'?'You win':'Computer wins'} — ${E.inCheck(board,side)?'checkmate':'no legal moves'}.`;}
  else if(positions.filter(p=>p===key()).length>=3||quiet>=120){ended=true;message='Draw — repetition or 120 moves without a capture.';}
  if(ended){cancel();selected=null;moves=[];}
  return ended;
 }
 function cancel(){version++;clearTimeout(timer);timer=null;}
 function schedule(){
  cancel();if(settle()){render();return;}const token=version;
  function finish(move){
   if(token!==version||!active||ended)return;
   timer=null;if(settle()){render();return;}
   const available=E.legal(board,side);
   // A failed or empty search is not a game result. Use a legal fallback.
   const valid=move&&available.find(m=>m.from===move.from&&m.to===move.to);
   play(valid||available[0]);
  }
  timer=setTimeout(()=>{
   if(token!==version||!active)return;
   let search;
   try{search=E.search(board,'b',$('xq-level').value);}catch(error){console.error('Chinese chess search failed',error);finish(null);return;}
   function advance(){
    if(token!==version||!active)return;
    try{const until=Date.now()+12;let s;do{s=search.next();}while(!s.done&&Date.now()<until);
     if(s.done)finish(s.value);else timer=setTimeout(advance,0);
    }catch(error){console.error('Chinese chess search failed',error);finish(null);}
   }
   advance();
  },300);
 }
 function reset(){cancel();board=E.initial();side='r';history=[];positions=[key()];quiet=0;ended=false;selected=null;moves=[];render();}
 $('xq-play-again').onclick=reset;
 $('xq-new').onclick=()=>{if(history.length&&!ended){$('xq-dialog').showModal();}else reset();};$('xq-cancel').onclick=()=>$('xq-dialog').close();$('xq-confirm').onclick=()=>{$('xq-dialog').close();reset();};
 $('xq-undo').onclick=()=>{if(!history.length)return;cancel();let prev=history.pop();positions.pop();if(prev.side==='b'&&history.length){prev=history.pop();positions.pop();}board=prev.board;side=prev.side;quiet=prev.quiet;ended=false;selected=null;moves=[];render();};
 render();return {activate(value){active=value;if(!active)cancel();else if(side==='b'&&!ended)schedule();}};
})();
// Keep each game mounted so its match survives navigation. Pause outgoing AI work.
let activeGame='gomoku';
for(const game of ['gomoku','xiangqi','soccer'])document.getElementById('tab-'+game).onclick=()=>{
 if(activeGame===game)return;
 activeGame=game;
 for(const id of ['gomoku','xiangqi','soccer']){
  document.getElementById(id+'-main').hidden=id!==game;
  const b=document.getElementById('tab-'+id);
  b.classList.toggle('selected',id===game);b.setAttribute('aria-selected',String(id===game));
 }
 if(game!=='gomoku'){searchVersion++;clearTimeout(timer);timer=null;}
 xq.activate(game==='xiangqi');
 if(game==='gomoku'&&thinking&&!finished)scheduleComputer();
 globalThis.soccer?.activate(game==='soccer');
 document.title=game==='soccer'?'Soccer — The Neighborhood Cup':game==='xiangqi'?'Chinese chess — Offline games':'Five — Offline games';
};
