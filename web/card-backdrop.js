import {CARD_LAYOUT} from './card-layout.js';
/** Décor partagé écran/PDF. Cache d'images publiques uniquement, jamais de carte. */
const pictures=new Map();
const PARAMETERS={pop:[.12,.15],nature:[.10,.20],douceur:[.09,.22],dark:[.09,.40],minimal:[.055,.30]};
export function groupBackdrop(groups,theme,enabled=true){
 const visuals=[...new Map(groups.filter(g=>g.visual).map(g=>[g.visual.id,g.visual])).values()].slice(0,4),n=visuals.length;
 const W=CARD_LAYOUT.width,H=CARD_LAYOUT.height,y=CARD_LAYOUT.member.y-10,w=CARD_LAYOUT.qr.x+18,h=CARD_LAYOUT.footer.y-y-8;
 const tiles=n===1?[[0,0,W,H]]:n===2?[[0,y,w,h/2],[0,y+h/2,w,h/2]]:n===3?[[0,y,w,h/3],[0,y+h/3,w,h/3],[0,y+2*h/3,w,h/3]]:n===4?[[0,y,w/2,h/2],[w/2,y,w/2,h/2],[0,y+h/2,w/2,h/2],[w/2,y+h/2,w/2,h/2]]:[];
 const [intensity,tint]=PARAMETERS[theme]??PARAMETERS.pop;
 return{enabled,visuals,visualIds:visuals.map(v=>v.id),tiles,layout:n===1?'single':n===4?'grid-2x2':`bands-${n}`,intensity,tint,theme,overlap:80};
}
async function load(path){
 if(!pictures.has(path)){const promise=new Promise((yes,no)=>{const img=new Image();img.dataset.cardBackdrop='true';img.onload=()=>yes(img);img.onerror=()=>{pictures.delete(path);no(new Error('Décor intégré indisponible.'));};img.src=path;});pictures.set(path,promise);if(pictures.size>16)pictures.delete(pictures.keys().next().value);}
 return pictures.get(path);
}
const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function fadeEdges(ctx,rect,padding){
 ctx.globalCompositeOperation='destination-in';
 for(const horizontal of [true,false]){const start=horizontal?rect.x:rect.y,len=horizontal?rect.width:rect.height,g=horizontal?ctx.createLinearGradient(start,0,start+len,0):ctx.createLinearGradient(0,start,0,start+len);g.addColorStop(0,'transparent');g.addColorStop(padding/len,'#000');g.addColorStop(1-padding/len,'#000');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(0,0,CARD_LAYOUT.width,CARD_LAYOUT.height);}ctx.globalCompositeOperation='source-over';
}
export async function paintGroupBackdrop(target,model,layout){
 target.width=layout.width;target.height=layout.height;const final=target.getContext('2d'),b=model.groupBackdrop;
 if(!b?.enabled||!b.visuals.length)return target;
 const texture=canvas(layout.width,layout.height),ctx=texture.getContext('2d'),images=await Promise.all(b.visuals.map(v=>load(v.large)));
 for(let i=0;i<images.length;i++){
  const img=images[i],[x,y,w,h]=b.tiles[i],p=images.length===1?0:b.overlap,rect={x:x-p,y:y-p,width:w+2*p,height:h+2*p},tile=canvas(layout.width,layout.height),t=tile.getContext('2d'),scale=Math.max(rect.width/img.naturalWidth,rect.height/img.naturalHeight),sw=rect.width/scale,sh=rect.height/scale;
  t.drawImage(img,(img.naturalWidth-sw)/2,(img.naturalHeight-sh)/2,sw,sh,rect.x,rect.y,rect.width,rect.height);if(p)fadeEdges(t,rect,p);ctx.drawImage(tile,0,0);tile.width=tile.height=1;
 }
 ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=b.tint;ctx.fillStyle=model.colors.background;ctx.fillRect(0,0,layout.width,layout.height);ctx.globalAlpha=1;
 ctx.globalCompositeOperation='destination-in';const gradient=ctx.createLinearGradient(0,0,0,layout.height);for(const [at,a]of [[0,0],[.28,.25],[.48,1],[.84,.85],[1,0]])gradient.addColorStop(at,`rgba(0,0,0,${a})`);ctx.fillStyle=gradient;ctx.fillRect(0,0,layout.width,layout.height);
 // Décor continu sous les textes ; seuls le bandeau et le QR ont un fond opaque.
 final.save();final.beginPath();final.roundRect(0,0,layout.width,layout.height,26);final.clip();final.globalAlpha=b.intensity;final.drawImage(texture,0,0);final.globalAlpha=1;
 // Réserve QR élargie : blanc opaque avant même de peindre le QR au premier plan.
 const q=CARD_LAYOUT.qr;final.clearRect(q.x,q.y,q.width,q.height);final.fillStyle='#fff';final.fillRect(q.x,q.y,q.width,q.height);final.restore();texture.width=texture.height=1;return target;
}
export async function groupBackdropCanvas(model,layout){const c=canvas(layout.width,layout.height);return paintGroupBackdrop(c,model,layout);}
