/* Pure game rules; shared by the browser and Node tests. */
(function(root){
'use strict';
const SIZE=15,DIRS=[[1,0],[0,1],[1,1],[1,-1]];
function winningLine(board,index){
 const player=board[index];if(!player)return [];
 const row=Math.floor(index/SIZE),col=index%SIZE;
 for(const [dr,dc] of DIRS){const line=[index];for(const sign of [-1,1]){let r=row+dr*sign,c=col+dc*sign;while(r>=0&&r<SIZE&&c>=0&&c<SIZE&&board[r*SIZE+c]===player){line.push(r*SIZE+c);r+=dr*sign;c+=dc*sign;}}if(line.length>=5)return line;}return [];
}
function candidates(board){const result=new Set();board.forEach((v,i)=>{if(!v)return;const r=Math.floor(i/SIZE),c=i%SIZE;for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){const nr=r+dr,nc=c+dc;if(nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&!board[nr*SIZE+nc])result.add(nr*SIZE+nc);}});return result.size?[...result]:board.every(v=>!v)?[112]:[];}
function strength(board,index,player){let score=0;const r=Math.floor(index/SIZE),c=index%SIZE;for(const [dr,dc] of DIRS){let count=1,open=0;for(const sign of [-1,1]){let nr=r+dr*sign,nc=c+dc*sign;while(nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&board[nr*SIZE+nc]===player){count++;nr+=dr*sign;nc+=dc*sign;}if(nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&!board[nr*SIZE+nc])open++;}if(count>=5)score+=1000000;else if(open)score+=([0,2,20,250,5000][count]||0)*(open===2?4:1);}return score;}
// Every five-cell window includes broken lines as well as contiguous threats.
const windows=[];
for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)for(const [dr,dc] of DIRS){
 const er=r+dr*4,ec=c+dc*4;
 if(er>=0&&er<SIZE&&ec>=0&&ec<SIZE)windows.push(Array.from({length:5},(_,n)=>(r+dr*n)*SIZE+c+dc*n));
}
function immediateWins(board,player){
 const moves=new Set();
 for(const line of windows){let own=0,empty=-1,blocked=false;
  for(const i of line){if(board[i]===player)own++;else if(board[i]){blocked=true;break;}else empty=i;}
  if(!blocked&&own===4)moves.add(empty);
 }return [...moves];
}
function evaluate(board){
 const weights=[0,2,18,180,12000,10000000];let value=0;
 for(const line of windows){let x=0,o=0;for(const i of line){if(board[i]==='X')x++;else if(board[i]==='O')o++;}
  if(!x)value+=weights[o];if(!o)value-=weights[x];
 }return value;
}
function ranked(board,player,limit){const other=player==='O'?'X':'O';return candidates(board).map(i=>({i,
 value:strength(board,i,player)+strength(board,i,other)*1.15-(Math.abs(Math.floor(i/SIZE)-7)+Math.abs(i%SIZE-7))*.1
})).sort((a,b)=>b.value-a.value).slice(0,limit).map(m=>m.i);}
function chooseMove(board,difficulty='medium'){
 if(difficulty==='master'){const search=masterSearch(board);let step;do{step=search.next();}while(!step.done);return step.value;}
 // Work on a copy so even interrupted searches cannot alter the live game.
 board=board.slice();
 const wins=immediateWins(board,'O');if(wins.length)return wins[0];
 const blocks=immediateWins(board,'X');if(blocks.length)return blocks[0];
 const moves=ranked(board,'O',difficulty==='hard'?18:12);if(!moves.length)return null;
 if(difficulty==='easy')return moves[0];
 const deadline=Date.now()+(difficulty==='hard'?250:100);
 // A fork offers two distinct winning squares: a single reply cannot block both.
 for(const i of moves){board[i]='O';const fork=immediateWins(board,'O').length>1;board[i]=null;if(fork)return i;}
 let nodes=0;
 function search(depth,player,alpha,beta){
  if(Date.now()>deadline||++nodes>2500)throw 'budget';
  const own=immediateWins(board,player),other=player==='O'?'X':'O';
  if(own.length)return (player==='O'?1:-1)*(10000000+depth);
  const threats=immediateWins(board,other);
  if(threats.length>1)return (player==='O'?-1:1)*(10000000+depth);
  if(depth===0)return evaluate(board);
  const options=threats.length?threats:ranked(board,player,8);
  if(!options.length)return 0;
  let best=player==='O'?-Infinity:Infinity;
  for(const i of options){board[i]=player;let value;
   try{value=search(depth-1,other,alpha,beta);}finally{board[i]=null;}
   if(player==='O'){best=Math.max(best,value);alpha=Math.max(alpha,best);}else{best=Math.min(best,value);beta=Math.min(beta,best);}
   if(beta<=alpha)break;
  }return best;
 }
 // Keep the last completed search, rather than favoring a partially searched move.
 let choice=moves[0];
 for(let depth=1;depth<=(difficulty==='hard'?3:1);depth++){
  let best=-Infinity,next=choice;
  try{for(const i of moves){board[i]='O';let value;
   try{value=search(depth,'X',-Infinity,Infinity);}finally{board[i]=null;}
   if(value>best){best=value;next=i;}
  }}catch(error){if(error!=='budget')throw error;break;}
  choice=next;
 }
 return choice;
}
// Master uses cooperative search: the browser can process Undo and New round
// between batches. No network or worker is required, including file:// play.
const cellWindows=Array.from({length:SIZE*SIZE},()=>[]);
windows.forEach(line=>line.forEach(i=>cellWindows[i].push(line)));
function potential(board,index,player){
 const ends=new Set();let score=0;
 for(const line of cellWindows[index]){let count=1,blocked=false;const empty=[];
  for(const i of line){if(i===index)continue;if(board[i]===player)count++;else if(board[i]){blocked=true;break;}else empty.push(i);}
  if(blocked)continue;
  score+=[0,1,12,160,8000,10000000][count];
  if(count===4)ends.add(empty[0]);
 }
 return {score,fork:ends.size>1};
}
function masterMoves(board,player,limit){
 const enemy=player==='O'?'X':'O';
 const own=immediateWins(board,player);if(own.length)return own;
 const forced=immediateWins(board,enemy);if(forced.length)return forced;
 const choices=candidates(board).map(i=>{const attack=potential(board,i,player),defense=potential(board,i,enemy);
  return {i,tactical:attack.fork||defense.fork,value:(attack.fork?4000000:0)+(defense.fork?2000000:0)+attack.score+defense.score*1.1+strength(board,i,player)*.2};
 }).sort((a,b)=>b.value-a.value);
 // Retain every direct fork and fork defense, regardless of branch limit.
 return choices.filter((m,n)=>n<limit||m.tactical).map(m=>m.i);
}
function* masterSearch(position){
 const board=position.slice(),MATE=100000000,deadline=Date.now()+1800,STOP=Symbol('budget');
 let nodes=0;const cache=new Map();
 const wins=immediateWins(board,'O');if(wins.length)return wins[0];
 const blocks=immediateWins(board,'X');if(blocks.length)return blocks[0];
 let roots=masterMoves(board,'O',28);if(!roots.length)return null;
 for(const i of roots)if(potential(board,i,'O').fork)return i;
 let choice=roots[0];
 function* search(depth,player,alpha,beta,extensions,ply){
  if(++nodes%32===0){yield;if(Date.now()>=deadline)throw STOP;}
  const sign=player==='O'?1:-1,enemy=player==='O'?'X':'O';
  if(immediateWins(board,player).length)return MATE-ply;
  const threats=immediateWins(board,enemy);
  if(threats.length>1)return -MATE+ply+1;
  if(depth<=0&&(!threats.length||extensions===0))return sign*evaluate(board);
  const key=player+':'+depth+':'+extensions+':'+ply+':'+board.map(v=>v||'.').join('');
  const entry=cache.get(key);if(entry!==undefined)return entry;
  const moves=threats.length?threats:masterMoves(board,player,depth>=3?14:10);
  if(!moves.length)return 0;
  let best=-Infinity,exact=true;const originalAlpha=alpha;
  for(const i of moves){board[i]=player;let value;
   try{value=-(yield* search(depth-1,enemy,-beta,-alpha,depth<=0?extensions-1:extensions,ply+1));}finally{board[i]=null;}
   best=Math.max(best,value);alpha=Math.max(alpha,value);
   if(alpha>=beta){exact=false;break;}
  }
  if(exact&&best>originalAlpha&&cache.size<30000)cache.set(key,best);
  return best;
 }
 // Completed shallow iterations give a dependable fallback if deeper work expires.
 for(let depth=1;depth<=8;depth++){
  const results=[];let alpha=-Infinity;
  try{for(const i of roots){yield;if(Date.now()>=deadline)throw STOP;
   board[i]='O';let value;
   try{value=-(yield* search(depth-1,'X',-Infinity,-alpha,4,1));}finally{board[i]=null;}
   results.push({i,value});alpha=Math.max(alpha,value);
  }}catch(error){if(error!==STOP)throw error;break;}
  results.sort((a,b)=>b.value-a.value);choice=results[0].i;roots=results.map(m=>m.i);
  if(results[0].value>MATE-100)break;
 }
 return choice;
}
const api={SIZE,winningLine,chooseMove,masterSearch};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FiveEngine=api;
})(typeof window!=='undefined'?window:globalThis);
