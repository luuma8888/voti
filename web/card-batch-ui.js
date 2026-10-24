import {availableCards,clearCards,issueSelectedCards,verifyPendingCards} from './card-session.js';
import {memberCardsPdf} from './member-cards.js';
import {memberCardModel} from './member-card-model.js';
import {memberCardPreview} from './member-card-view.js';
import {THEME_OPTIONS,normalizeTheme} from './themes.js';
import {withSpaceIcon} from './space-icons.js';
import {downloadBlob} from './qr.js';
import {cardsFilename} from './space-ux.js';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function backdropToggle(value,onChange){const label=el('label',undefined,'card-backdrop-toggle'),input=el('input');input.type='checkbox';input.checked=value!==false;label.append(input,document.createTextNode('Fond illustré des groupes'));input.addEventListener('change',()=>onChange(input.checked));return label;}
function focusResult(){const result=document.querySelector('[data-batch-result]');if(result){const details=result.closest('details');if(details)details.open=true;result.tabIndex=-1;result.focus();}}
function exportOptions(ui){return ui.cardExportOptions??=({cardTheme:normalizeTheme(document.documentElement.dataset.theme),groupBackdropEnabled:true});}
function options(ui,onChange=()=>{}){
 const root=el('div',undefined,'card-export-options'),themeLabel=el('label','Thème du lot'),select=el('select');select.setAttribute('aria-label','Thème du lot');for(const t of THEME_OPTIONS){const o=el('option',t.name);o.value=t.id;select.append(o);}select.value=exportOptions(ui).cardTheme;select.addEventListener('change',()=>{exportOptions(ui).cardTheme=select.value;onChange();});themeLabel.append(select);root.append(themeLabel,backdropToggle(exportOptions(ui).groupBackdropEnabled,value=>{exportOptions(ui).groupBackdropEnabled=value;onChange();}));return root;
}
async function downloadCards(ui,data,cards){const version=ui.cardsVersion,values=cards.map(c=>({...c,...exportOptions(ui)})),pdf=await memberCardsPdf(values,location.origin+location.pathname);if(version!==ui.cardsVersion){ui.notify('Le lot a changé. Relance le téléchargement.');return;}downloadBlob(pdf,cardsFilename(data.name,null,cards.length));}
export function sessionCardsPanel(ui,data){
 if(data.access.role!=='admin')return null;const all=(ui.issued??[]).filter(c=>c.spaceId===data.spaceId),ready=availableCards(ui,data.spaceId);if(!all.length&&!(ui.cardBatchResult?.spaceId===data.spaceId&&ui.cardBatchResult?.requested))return null;
 const panel=el('section',undefined,'session-cards');panel.dataset.sessionCards='';panel.append(el('h2','Cartes disponibles dans cette session'),el('p',`${ready.length} carte(s) prête(s) à imprimer`),el('p','Ces cartes restent disponibles jusqu’au rechargement ou à la fermeture de cet onglet.','help'),options(ui,()=>update()));
 const recent=ui.cardBatchResult?.spaceId===data.spaceId?ui.cardBatchResult:null;
 if(recent){const cards=ready.filter(c=>recent.entries.some(e=>e.memberId===c.memberId&&e.version===c.version)),result=el('section',undefined,'card-batch-result');result.dataset.batchResult='';result.setAttribute('aria-live','polite');result.append(el('h3',cards.length+' nouvelle(s) carte(s) créée(s)'),el('p',`${recent.entries.length} réussite(s) · ${recent.failed.length} échec(s) · ${recent.unconfirmed.length} à vérifier · ${recent.notAttempted} non traitée(s).`, 'help'));
  if(recent.failed.some(e=>e.code==='REVISION_CONFLICT'))result.append(el('p','L’Espace a changé pendant l’opération. Actualise avant de recommencer.'));if(recent.failed.some(e=>e.code==='NOT_FOUND'))result.append(el('p','Un membre n’est plus disponible.'));if(recent.failed.length)result.append(el('p','Le lot a été interrompu. Les cartes réussies restent disponibles ; les autres membres n’ont pas été traités après cet arrêt.'));
  if(cards.length)result.append(ui.button(`PDF de ces ${cards.length} cartes`,()=>downloadCards(ui,data,cards),'primary'));panel.append(result);
 }

 const preview=el('div',undefined,'session-card-preview');preview.hidden=true;const picker=el('select');picker.setAttribute('aria-label','Carte à afficher');for(const c of ready){const o=el('option',c.displayName);o.value=c.memberId;picker.append(o);}const face=el('div');const update=()=>{if(!preview.hidden){const c=ready.find(c=>c.memberId===picker.value);face.replaceChildren(...(c?[memberCardPreview(memberCardModel({...c,...exportOptions(ui)}),location.origin+location.pathname)]:[]));}};picker.addEventListener('change',update);preview.append(picker,face);
 const actions=el('div',undefined,'actions');
 if(ready.length)actions.append(ui.button(`PDF des ${ready.length} cartes`,()=>downloadCards(ui,data,ready),'primary'),ui.button('Voir les cartes',()=>{preview.hidden=!preview.hidden;update();}));
 const pending=all.filter(c=>c.state==='unconfirmed');if(pending.length)panel.append(el('p',`${pending.length} carte(s) à vérifier après une réponse réseau incertaine. Elles sont exclues des PDF.`),ui.button('Vérifier les cartes',async()=>{const r=await verifyPendingCards(ui,data.spaceId);ui.notify(`${r.verified} carte(s) confirmée(s), ${r.refused} refusée(s).`);await ui.refresh();focusResult();}));
 actions.append(ui.button('Effacer de cette session',async b=>{if(!await ui.confirmAction({trigger:b,title:'Effacer les cartes de cet onglet ?',description:'Les cartes déjà imprimées restent valides. Seules les cartes de cet Espace sont oubliées ici. Cette action ne les révoque pas ; seuls les secrets disponibles dans cet onglet sont oubliés.',actionLabel:'Effacer de cette session'}))return;clearCards(ui,data.spaceId);await ui.refresh();}));panel.append(actions,preview);return panel;
}
export function cardSelectionControls(ui,data,redraw){
 const selected=ui.cardSelection;if(!selected?.active||selected.spaceId!==data.spaceId)return null;for(const id of selected.ids)if(!data.members.some(m=>m.member_id===id&&m.status==='active'))selected.ids.delete(id);
 const section=el('section',undefined,'card-selection-controls');section.dataset.cardSelection='';const count=el('p',undefined);count.setAttribute('role','status');const action=withSpaceIcon(ui.button('',async trigger=>{
  const members=data.members.filter(m=>selected.ids.has(m.member_id)),active=members.filter(m=>m.has_card).length;
  if(!await ui.confirmAction({trigger,title:`Créer / remplacer ${members.length} cartes ?`,description:`${members.length-active} nouvelle(s) carte(s), ${active} carte(s) existante(s) remplacée(s). Les anciennes cartes des membres concernés seront invalidées. Les nouvelles cartes pourront être téléchargées ensemble en PDF.`,actionLabel:'Créer / remplacer'}))return;
  const status=el('p','Création en cours…');status.setAttribute('role','status');section.append(status);for(const b of document.querySelectorAll('.card-selection-controls button,.space-view-controls button,.card-selection-checkbox input,.session-cards button'))b.disabled=true;
  const result=await issueSelectedCards(ui,data,[...selected.ids],(done,total)=>{status.textContent=`${done} carte(s) créée(s) sur ${total}.`;});
  for(const e of result.entries)selected.ids.delete(e.memberId);if(!selected.ids.size)selected.active=false;await ui.refresh();focusResult();
 },'primary'),'card');
 const redrawFocus=text=>{redraw();[...document.querySelectorAll('[data-card-selection] button')].find(b=>b.textContent===text)?.focus();};
 const update=()=>{count.textContent=selected.ids.size+' membre(s) sélectionné(s)';action.lastChild.textContent=`Créer / remplacer ${selected.ids.size} cartes`;action.disabled=!selected.ids.size||selected.ids.size>200||ui.issued.some(c=>c.spaceId===data.spaceId&&selected.ids.has(c.memberId)&&c.state==='unconfirmed');};
 // Texte et icône sont distincts afin de garder l'icône lors du changement du compteur.
 action.replaceChildren(action.firstChild,document.createTextNode(''));const buttons=el('div',undefined,'actions');buttons.append(ui.button('Tout sélectionner',()=>{selected.ids=new Set(data.members.filter(m=>m.status==='active').map(m=>m.member_id));redrawFocus('Tout sélectionner');}),ui.button('Tout désélectionner',()=>{selected.ids.clear();redrawFocus('Tout désélectionner');}),ui.button('Annuler le mode cartes',()=>{ui.cardSelection=null;redraw();document.querySelector('[data-manage-cards]')?.focus();}));section.append(el('h3','Gérer les cartes'),count,buttons,action);selected.update=update;update();return section;
}
export function memberCardSelection(ui,data,member){const selection=ui.cardSelection;if(!selection?.active||selection.spaceId!==data.spaceId)return null;const label=el('label',undefined,'card-selection-checkbox'),input=el('input');input.type='checkbox';input.checked=selection.ids.has(member.member_id);input.disabled=member.status!=='active';input.setAttribute('aria-label','Sélectionner '+member.display_name);label.append(input);input.addEventListener('change',()=>{if(input.checked)selection.ids.add(member.member_id);else selection.ids.delete(member.member_id);label.closest('article')?.classList.toggle('is-selected',input.checked);selection.update?.();});return label;}
