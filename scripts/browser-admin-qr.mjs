/** Fixtures de clés exclusivement locales. Ne retourne ni URL secrète ni clé. */
export async function adminQrScenario(key, mode) {
  let checks=0, verification=0;const assert=(v,m)=>{if(!v)throw new Error(m);checks++;};
  const wait=async predicate=>{const end=performance.now()+12000;while(!predicate()){if(performance.now()>end)throw new Error('Parcours QR admin non terminé');await new Promise(requestAnimationFrame);}};
  const raw = JSON.stringify(key), payload = btoa(raw).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const before=localStorage.getItem('voti.remote.v1'), startHash=location.hash;
  const original=window.fetch;
  window.fetch=function(input,options){
    const url=new URL(typeof input==='string'?input:input.url,location.href);
    assert(!location.hash.includes('admin/import/') && !url.pathname.includes(key.adminCapability) && !url.search.includes(key.adminCapability),'Secret retiré avant fetch et absent path/query');
    if(url.pathname.endsWith('/admin'))verification++;
    return original.call(this,input,options);
  };
  try {
    location.hash='#/admin/import/'+(mode==='invalid-payload'?'***':payload);
    await wait(()=>location.hash==='#admin-transfer' && document.getElementById('app').getAttribute('aria-busy')==='false' && document.querySelector('#app h1')?.textContent==='Clé d’administration détectée');
    assert(history.state===null && !location.href.includes(payload),'Historique/URL sans payload');
    assert(localStorage.getItem('voti.remote.v1')===before && verification===0,'Aucun import ni verify automatique');
    const accept=[...document.querySelectorAll('#app button')].find(b=>b.textContent==='Importer l’administration');
    if(['invalid-payload','invalid-version','invalid-relay','invalid-structure'].includes(mode)) {
      assert(!accept && document.getElementById('app').textContent.includes('invalide'),'Payload invalide refusé');return checks;
    }
    assert(accept && document.getElementById('app').textContent.includes('supprimer'),'Confirmation et avertissement secret');
    if(mode==='cancel') {
      [...document.querySelectorAll('#app button')].find(b=>b.textContent==='Annuler').click();
      await wait(()=>location.hash==='#home' && document.getElementById('app').getAttribute('aria-busy')==='false');
      assert(localStorage.getItem('voti.remote.v1')===before && verification===0,'Annulation sans stockage/requête');return checks;
    }
    accept.click();accept.click();
    if(mode==='wrong-capability' || mode==='deleted' || mode==='wrong-poll') {
      await wait(()=>!document.getElementById('message').hidden && !accept.disabled);
      assert(localStorage.getItem('voti.remote.v1')===before && verification===1,'Clé distante invalide : aucune écriture, une vérification');return checks;
    }
    if(mode==='conflict-cancel' || mode==='conflict-confirm') {
      await wait(()=>document.querySelector('.confirmation-dialog:modal'));
      assert(document.querySelector('.confirmation-dialog h2').textContent==='Remplacer la clé d’administration ?','Conflit réutilise dialogue v0.3E');
      assert(localStorage.getItem('voti.remote.v1')===before && verification===1,'Ancienne clé conservée avant remplacement');
      const action=document.querySelector(mode==='conflict-cancel'?'[data-confirmation=cancel]':'[data-confirmation=accept]');action.click();action.click();
      if(mode==='conflict-cancel') {await wait(()=>!accept.disabled);assert(localStorage.getItem('voti.remote.v1')===before,'Conflit annulé conserve clé');return checks;}
    }
    await wait(()=>location.hash==='#poll/'+key.pollId && document.getElementById('app').getAttribute('aria-busy')==='false' && document.querySelector(`#app a[href="#/p/${key.pollId}"]`));
    const connection=JSON.parse(localStorage.getItem('voti.remote.v1')).connections.find(c=>c.pollId===key.pollId);
    assert(connection.adminCapability===key.adminCapability,'Stockage uniquement après vérification valide');
    assert(verification===(mode==='conflict-confirm'?2:1),'Pas de double import par double clic');
    return checks;
  } finally {window.fetch=original; if(location.hash==='#admin-transfer'){location.hash='#home';await wait(()=>location.hash==='#home' && document.getElementById('app').getAttribute('aria-busy')==='false');} }
}
