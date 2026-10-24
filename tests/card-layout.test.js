import test from 'node:test';import assert from 'node:assert/strict';
import {CARD_LAYOUT,cardLayout,fitCardText} from '../web/card-layout.js';
const model={credential:'voti-member-v1.'+'a'.repeat(64),memberVisual:{},groups:[{}]},url='https://luuma8888.github.io/voti/';
test('Géométrie commune : QR physiquement agrandi, modules entiers et zones sans collision',()=>{
 const l=cardLayout(model,url),old=Math.floor(400/l.qr.matrix.size)*l.qr.matrix.size;
 assert(l.qr.size>old);assert.equal(l.qr.size%l.qr.matrix.size,0);assert(l.qr.scale>=4);assert(l.qr.size/2480*210>35);
 assert(l.member.height/(l.height-l.header.y-l.header.height)>=.65);assert(l.member.width>=320);assert(l.member.x+l.member.width<l.groups.x);assert(l.groups.x+l.groups.width<l.qr.x);assert(l.qr.y+l.qr.size<l.footer.y);assert.equal(l.groupIcon,62);
 assert.equal(cardLayout({...model,memberVisual:null,groups:[]},url).qr.x,(1120-l.qr.size)/2);
 assert.equal(cardLayout({...model,groups:[]},url).member.width,430);assert.equal(CARD_LAYOUT.width,1120);assert.equal(CARD_LAYOUT.height,760);
});
test('Les textes longs sont contenus dans la hauteur de leur zone commune',()=>{
 const ctx={font:'',measureText(s){return{width:s.length*parseFloat(this.font.replace('bold ',''))*.6};}};
 const t=fitCardText(ctx,'Un pseudonyme fictif vraiment très long avec accents éè et 🌈',1040,{font:64,min:44,bold:true,height:106});assert(t.lines.length<=2);assert(t.lines.length*t.lineHeight<=106);
});
