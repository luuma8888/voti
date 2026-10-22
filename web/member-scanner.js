import {decodeQr} from '../vendor/scanner.js';
import {isSpaceCredential} from '../shared/spaces.js';
import {inspectImage} from '../shared/image-format.js';

export function credentialFromQr(text,kind='member'){
  const url=new URL(text,location.href),prefix=kind==='member'?'member':'invite';
  if(url.origin!==location.origin||url.pathname!==location.pathname||url.search)throw new Error('Ce QR n’est pas une carte ou invitation Voti pour ce site.');
  const match=url.hash.match(new RegExp(`^#/${prefix}/([^/]+)$`));
  if(!match||!isSpaceCredential(match[1],kind))throw new Error('Carte ou invitation Voti invalide.');return match[1];
}
/** Caméra/image traitées en mémoire, pistes arrêtées et pixels libérés à la sortie. */
export function scanMemberCard(trigger){
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='card confirmation-dialog member-scanner';
    const title=document.createElement('h2');title.id='scan-'+crypto.randomUUID();title.textContent='Présente ta Carte Voti';dialog.setAttribute('aria-labelledby',title.id);
    const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Scanne seulement ta propre carte. Elle ne sera pas conservée sur cet appareil.';
    const video=document.createElement('video');video.playsInline=true;video.muted=true;video.autoplay=true;video.hidden=true;
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});
    let stream=null,closed=false,frame=0;
    function finish(value){if(closed)return;closed=true;cancelAnimationFrame(frame);stream?.getTracks().forEach(t=>t.stop());video.srcObject=null;input.value='';canvas.width=canvas.height=1;dialog.close();dialog.remove();if(trigger?.isConnected)trigger.focus();resolve(value);}
    function decode(source,w,h){const ratio=Math.min(1,800/Math.max(w,h));canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);context.drawImage(source,0,0,canvas.width,canvas.height);const pixels=context.getImageData(0,0,canvas.width,canvas.height);const result=decodeQr(pixels.data,pixels.width,pixels.height);if(result){try{finish(credentialFromQr(result.data));}catch{status.textContent='Ce QR n’est pas une Carte Voti valide.';}}}
    const camera=document.createElement('button');camera.type='button';camera.textContent='Scanner avec la caméra';camera.addEventListener('click',async()=>{
      camera.disabled=true;try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});if(closed){stream.getTracks().forEach(t=>t.stop());return;}video.srcObject=stream;video.hidden=false;await video.play();let last=0;
        const tick=time=>{if(closed)return;if(video.videoWidth&&time-last>160){decode(video,video.videoWidth,video.videoHeight);last=time;}if(!closed)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
      }catch{stream?.getTracks().forEach(t=>t.stop());video.srcObject=null;video.hidden=true;camera.disabled=false;status.textContent='Caméra indisponible. Tu peux choisir une photo de ta carte.';}
    });
    const label=document.createElement('label');label.textContent='Ou choisir une photo de la carte';const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.id=title.id+'-file';label.htmlFor=input.id;
    input.addEventListener('change',async()=>{const file=input.files[0];if(!file)return;let bitmap;try{if(file.size>10_000_000||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error();const info=inspectImage(new Uint8Array(await file.arrayBuffer()));if(info.mimeType!==file.type||info.width*info.height>16_000_000)throw new Error();bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});if(bitmap.width*bitmap.height>16_000_000)throw new Error();if(!closed){decode(bitmap,bitmap.width,bitmap.height);if(!closed)status.textContent='Carte non reconnue. Essaie une photo nette avec le QR entier.';}}catch{if(!closed)status.textContent='Photo de carte illisible.';}finally{bitmap?.close();input.value='';}});
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Annuler';cancel.addEventListener('click',()=>finish(null));dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
    const leave=()=>finish(null);window.addEventListener('pagehide',leave,{once:true});window.addEventListener('hashchange',leave,{once:true});
    dialog.addEventListener('close',()=>{window.removeEventListener('pagehide',leave);window.removeEventListener('hashchange',leave);});
    dialog.append(title,status,video,camera,label,input,cancel);document.body.append(dialog);dialog.showModal();cancel.focus();
  });
}
