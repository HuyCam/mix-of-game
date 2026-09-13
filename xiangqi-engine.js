(function(root){
'use strict';
const other=s=>s==='r'?'b':'r',inside=(r,c)=>r>=0&&r<10&&c>=0&&c<9;
function initial(){const b=Array(90).fill(null),back='RHEAKAEHR';for(let c=0;c<9;c++){b[c]='b'+back[c];b[81+c]='r'+back[c];}for(const c of [1,7]){b[18+c]='bC';b[63+c]='rC';}for(const c of [0,2,4,6,8]){b[27+c]='bP';b[54+c]='rP';}return b;}
function pseudo(b,i){const p=b[i];if(!p)return [];const side=p[0],type=p[1],r=Math.floor(i/9),c=i%9,out=[];
 const add=(nr,nc)=>{if(inside(nr,nc)&&b[nr*9+nc]?.[0]!==side)out.push(nr*9+nc);};
 const palace=(nr,nc)=>nc>=3&&nc<=5&&(side==='r'?nr>=7&&nr<=9:nr>=0&&nr<=2);
 if(type==='R'||type==='C'){for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){let screen=false;for(let nr=r+dr,nc=c+dc;inside(nr,nc);nr+=dr,nc+=dc){const t=b[nr*9+nc];if(type==='R'){if(t){add(nr,nc);break;}add(nr,nc);}else if(!screen){if(t)screen=true;else add(nr,nc);}else if(t){add(nr,nc);break;}}}}
 if(type==='H')for(const [dr,dc] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[-1,2],[1,-2],[-1,-2]]){const lr=r+(Math.abs(dr)===2?Math.sign(dr):0),lc=c+(Math.abs(dc)===2?Math.sign(dc):0);if(inside(lr,lc)&&!b[lr*9+lc])add(r+dr,c+dc);}
 if(type==='E')for(const dr of [-2,2])for(const dc of [-2,2]){const nr=r+dr,nc=c+dc;if(inside(nr,nc)&&(side==='r'?nr>=5:nr<=4)&&!b[(r+dr/2)*9+c+dc/2])add(nr,nc);}
 if(type==='A')for(const dr of [-1,1])for(const dc of [-1,1])if(palace(r+dr,c+dc))add(r+dr,c+dc);
 if(type==='K'){for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]])if(palace(r+dr,c+dc))add(r+dr,c+dc);for(const dr of [-1,1])for(let nr=r+dr;inside(nr,c);nr+=dr){const t=b[nr*9+c];if(t){if(t===other(side)+'K')add(nr,c);break;}}}
 if(type==='P'){add(r+(side==='r'?-1:1),c);if(side==='r'?r<=4:r>=5){add(r,c-1);add(r,c+1);}}
 return out;
}
function inCheck(b,side){const king=b.indexOf(side+'K');if(king<0)return true;for(let i=0;i<90;i++)if(b[i]?.[0]===other(side)&&pseudo(b,i).includes(king))return true;return false;}
function legal(b,side){const result=[];for(let from=0;from<90;from++)if(b[from]?.[0]===side)for(const to of pseudo(b,from)){const captured=b[to],piece=b[from];b[to]=piece;b[from]=null;const safe=!inCheck(b,side);b[from]=piece;b[to]=captured;if(safe)result.push({from,to});}return result;}
const values={K:100000,R:900,C:450,H:420,E:200,A:200,P:100};
function evaluation(b,side){let sum=0;for(let i=0;i<90;i++){const p=b[i];if(!p)continue;const r=Math.floor(i/9),progress=p[0]==='r'?9-r:r,center=4-Math.abs(i%9-4);let v=values[p[1]];if(p[1]==='P')v+=progress*9+(progress>=5?70+center*5:0);if(p[1]==='H'||p[1]==='R')v+=center*4+progress*2;sum+=(p[0]===side?1:-1)*v;}return sum;}
function* search(position,side,level){const b=position.slice(),settings={easy:[1,100],medium:[2,350],hard:[4,900],master:[6,2000]},[maxDepth,budget]=settings[level]||settings.medium;const end=Date.now()+budget,STOP=Symbol();let nodes=0;
 const order=moves=>moves.sort((a,z)=>(b[z.to]?values[b[z.to][1]]*10-values[b[z.from][1]]:0)-(b[a.to]?values[b[a.to][1]]*10-values[b[a.from][1]]:0));
 function* negamax(depth,s,alpha,beta,ply,extension){if(++nodes%16===0){yield;if(Date.now()>end)throw STOP;}if(!b.includes(s+'K'))return -1000000+ply;const moves=order(legal(b,s));if(!moves.length)return -1000000+ply;const check=inCheck(b,s);if(depth<=0&&(!check||!extension))return evaluation(b,s);let best=-Infinity;for(const m of moves){const captured=b[m.to];b[m.to]=b[m.from];b[m.from]=null;let v;try{v=-(yield* negamax(depth-1,other(s),-beta,-alpha,ply+1,depth<=0?extension-1:extension));}finally{b[m.from]=b[m.to];b[m.to]=captured;}best=Math.max(best,v);alpha=Math.max(alpha,v);if(alpha>=beta)break;}return best;}
 let roots=order(legal(b,side));if(!roots.length)return null;let best=roots[0];for(let depth=1;depth<=maxDepth;depth++){const scores=[];let alpha=-Infinity;try{for(const m of roots){yield;if(Date.now()>end)throw STOP;const captured=b[m.to];b[m.to]=b[m.from];b[m.from]=null;let v;try{v=-(yield* negamax(depth-1,other(side),-Infinity,-alpha,1,level==='master'?2:0));}finally{b[m.from]=b[m.to];b[m.to]=captured;}scores.push({m,v});alpha=Math.max(alpha,v);}}catch(e){if(e!==STOP)throw e;break;}scores.sort((a,z)=>z.v-a.v);best=scores[0].m;roots=scores.map(s=>s.m);if(scores[0].v>900000)break;}return best;}
const api={initial,pseudo,inCheck,legal,search,other};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.XiangqiEngine=api;
})(typeof window!=='undefined'?window:globalThis);
