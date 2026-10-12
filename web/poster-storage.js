import { POSTER_KEY, defaultDesign, validateDesign, designRefs } from './poster-design.js';
import { ensure, object, isUuid } from '../shared/validation.js';
import { MAX_ASSET_BYTES, MAX_ASSETS } from '../shared/assets.js';

/** Les blobs affiche-only vivent dans un AssetAdapter dédié, jamais dans le
 * store métier : aucun sweep du repository ni backup ne peut les confondre. */
export class PosterRepository {
  constructor(storage,assets,locks=globalThis.navigator?.locks) { this.storage=storage;this.assets=assets;this.locks=locks;this.pending=Promise.resolve();this.warning=''; }
  read() {
    const raw=this.storage.getItem(POSTER_KEY);
    if(raw===null)return {formatVersion:1,designs:{}};
    ensure(raw.length<=1_000_000,'Stockage des affiches trop volumineux.');
    let data;try{data=JSON.parse(raw);}catch(error){throw new Error('Stockage des affiches illisible. Aucun réglage effacé.',{cause:error});}
    object(data,['formatVersion','designs'],'Affiches');
    ensure(data.formatVersion===1,'Version de stockage des affiches inconnue.');
    ensure(data.designs&&Object.getPrototypeOf(data.designs)===Object.prototype&&Object.keys(data.designs).length<=200,'Bibliothèque d’affiches invalide.');
    for(const [id,design] of Object.entries(data.designs)){ensure(isUuid(id),'Sondage d’affiche invalide.');validateDesign(design);}
    return data;
  }
  get(id) { ensure(isUuid(id),'Sondage invalide.'); return structuredClone(this.read().designs[id]||defaultDesign()); }
  exclusive(operation) {
    const task=this.pending.then(()=>{ensure(this.locks?.request,'Les affiches nécessitent les verrous locaux du navigateur.');return this.locks.request(POSTER_KEY,operation);});
    this.pending=task.catch(()=>{});return task;
  }
  async cleanup() {
    const refs=new Set(Object.values(this.read().designs).flatMap(d=>[...designRefs(d)]));
    await this.assets.collectOrphans(refs);
  }
  recover() { return this.exclusive(()=>this.cleanup()); }
  save(id,input,staged=[],expected) {
    ensure(isUuid(id),'Sondage invalide.');const design=validateDesign(input);
    return this.exclusive(async()=>{
      const data=this.read(), previous=data.designs[id]||defaultDesign();
      ensure(expected===undefined||JSON.stringify(previous)===JSON.stringify(expected),'Le design a changé dans un autre onglet. Rechargez le Studio.');
      const raw=this.storage.getItem(POSTER_KEY); data.designs[id]=design;
      ensure(Object.keys(data.designs).length<=200 && JSON.stringify(data).length<=1_000_000,'Bibliothèque d’affiches pleine : retirez un ancien design.');
      const pending=new Map(staged.map(a=>[a.id,a]));const refs=new Set(Object.values(data.designs).flatMap(d=>[...designRefs(d)]));
      ensure(refs.size<=MAX_ASSETS,'Maximum 200 images d’affiche.'); let total=0;
      for(const ref of refs){const asset=pending.get(ref)||await this.assets.get(ref);ensure(asset,'Image d’affiche absente.');total+=asset.byteLength;}
      ensure(total<=MAX_ASSET_BYTES,'Maximum 24 Mo d’images d’affiche.');
      const additions=[...pending.values()].filter(a=>refs.has(a.id)); await this.assets.putMany(additions);
      try {ensure(this.storage.getItem(POSTER_KEY)===raw,'Le stockage a changé.');this.storage.setItem(POSTER_KEY,JSON.stringify(data));}
      catch(error){try{await this.cleanup();}catch{throw new Error('Enregistrement refusé ; nettoyage à reprendre au prochain démarrage.',{cause:error});}throw error;}
      this.warning='';try{await this.cleanup();}catch{this.warning='Design enregistré. Nettoyage à reprendre au prochain démarrage.';}
      return structuredClone(design);
    });
  }
  remove(id) {
    ensure(isUuid(id),'Sondage invalide.');return this.exclusive(async()=>{const data=this.read();delete data.designs[id];this.storage.setItem(POSTER_KEY,JSON.stringify(data));await this.cleanup();});
  }
}
