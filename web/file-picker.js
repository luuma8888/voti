const pickers=new WeakMap();
/** Input natif conservé : seul son aspect est remplacé, jamais le FileList. */
export function filePicker(input,label){
  input.hidden=false;input.id||='file-'+crypto.randomUUID();input.classList.add('file-native');
  const root=document.createElement('div');root.className='field file-picker';
  const title=document.createElement('label');title.htmlFor=input.id;title.id=input.id+'-label';title.textContent=label;
  const row=document.createElement('div');row.className='file-picker-row';const choose=document.createElement('label');choose.htmlFor=input.id;choose.className='button file-choose';
  const name=document.createElement('span');name.id=input.id+'-name';name.className='file-name';name.setAttribute('role','status');
  input.setAttribute('aria-labelledby',title.id);input.setAttribute('aria-describedby',name.id);
  const sync=()=>{const file=input.files?.[0];choose.textContent=file?'Changer de fichier':'Choisir un fichier';name.textContent=file?.name??'Aucun fichier sélectionné';};pickers.set(input,sync);input.addEventListener('change',sync);sync();
  row.append(input,choose,name);root.append(title,row);return root;
}
export function refreshFilePicker(input){pickers.get(input)?.();}
