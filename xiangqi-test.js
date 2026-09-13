const assert=require('node:assert/strict'),E=require('./xiangqi-engine');
const b=()=>Array(90).fill(null);
assert.equal(E.initial().filter(Boolean).length,32);assert.equal(E.legal(E.initial(),'r').length,44);assert.equal(E.legal(E.initial(),'b').length,44);
let p=b();p[40]='rH';assert.equal(E.pseudo(p,40).length,8);p[31]='rP';assert.ok(!E.pseudo(p,40).includes(21));assert.ok(!E.pseudo(p,40).includes(23));
p=b();p[67]='rE';assert.ok(E.pseudo(p,67).includes(47));p[57]='rP';assert.ok(!E.pseudo(p,67).includes(47));p=b();p[49]='rE';assert.ok(E.pseudo(p,49).every(i=>Math.floor(i/9)>=5));
p=b();p[40]='rC';p[22]='rP';p[4]='bR';assert.ok(E.pseudo(p,40).includes(4));p[13]='bP';assert.ok(!E.pseudo(p,40).includes(4));assert.ok(E.pseudo(p,40).includes(13));p[22]=null;p[13]=null;assert.ok(!E.pseudo(p,40).includes(4));
p=b();p[54]='rP';assert.deepEqual(E.pseudo(p,54),[45]);p=b();p[36]='rP';assert.deepEqual(E.pseudo(p,36).sort((a,b)=>a-b),[27,37]);
p=b();p[85]='rK';p[4]='bK';p[49]='rR';assert.equal(E.inCheck(p,'r'),false);assert.ok(!E.legal(p,'r').some(m=>m.from===49&&m.to===48));p[49]=null;assert.equal(E.inCheck(p,'r'),true);
p=b();p[85]='rK';p[3]='bK';assert.ok(E.pseudo(p,85).every(i=>Math.floor(i/9)>=7&&i%9>=3&&i%9<=5));
// Stalemated black: red chariots cover exits but not the occupied general square.
p=b();p[4]='bK';p[84]='rK';p[18]='rR';p[14]='rR';p[12]='rR';assert.equal(E.inCheck(p,'b'),false);assert.equal(E.legal(p,'b').length,0);
for(const level of ['easy','medium','hard','master']){p=E.initial();const copy=p.slice(),it=E.search(p,'b',level);let s;do{s=it.next();}while(!s.done);assert.ok(E.legal(p,'b').some(m=>m.from===s.value.from&&m.to===s.value.to));assert.deepEqual(p,copy);}
console.log('Xiangqi passed: setup, 44 opening moves, horse legs, elephant eyes/river, cannon screens, soldiers, flying generals, palace, stalemate, all AI levels.');
