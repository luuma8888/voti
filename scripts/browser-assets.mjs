/** Exécuté dans la page de test isolée, en file:// puis via /voti/. */
export async function browserAssetScenario() {
  const { IndexedDBAssetAdapter } = await import('voti/web/asset-storage.js');
  const { processImage, verifyDecodedAsset } = await import('voti/web/image-processing.js');
  const { contentId } = await import('voti/shared/assets.js');
  const { parseBackup, exportBackup } = await import('voti/shared/backup.js');
  const { emptyState } = await import('voti/shared/model.js');
  const { Repository, LocalStorageAdapter } = await import('voti/web/storage.js');
  const key = 'voti.local.v1';
  const adapter = new IndexedDBAssetAdapter(), repository = new Repository(new LocalStorageAdapter(localStorage), navigator.locks, adapter);
  let checks = 0;
  const assert = (value, message) => { if (!value) throw new Error(message); checks++; };
  const until = async (predicate, message) => {
    const deadline = performance.now() + 10000;
    while (!predicate()) { if (performance.now() > deadline) throw new Error('Images : '+message); await new Promise(requestAnimationFrame); }
  };
  const reject = async (task, message) => { let failed = false; try { await task(); } catch { failed = true; } assert(failed, message); };
  const text = () => document.getElementById('app').textContent;
  const stored = () => JSON.parse(localStorage.getItem(key));
  const click = label => {
    const node = [...document.querySelectorAll('#app button,#app a')].find(item => item.textContent === label);
    if (!node) throw new Error('Action images absente : '+label); node.click(); return node;
  };
  const go = async (hash, expected) => { location.hash = hash; await until(() => text().includes(expected), hash); };
  const seed = async raw => {
    if (raw === null) localStorage.removeItem(key); else localStorage.setItem(key, raw);
    window.dispatchEvent(new StorageEvent('storage', { key }));
    await go('#home', raw && JSON.parse(raw).polls.length ? 'sondages' : 'Votre premier sondage');
    await until(() => document.querySelector('[data-testid="poll-search"]'), 'accueil');
  };
  const makeFile = async (type, width = 2400, height = 1200, color = '#684397') => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); context.fillStyle = color; context.fillRect(0, 0, width, height);
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, width/4, height/3);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, type, .9));
    canvas.width = 1; canvas.height = 1;
    return new File([blob], 'test.'+type.split('/')[1], { type });
  };
  const upload = async (label, file) => {
    const group = document.querySelector(`.image-picker[aria-label="${label}"]`), input = group.querySelector('input');
    const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles:true }));
    await until(() => !input.disabled && group.textContent.includes('Image prête'), 'traitement '+label);
    await until(() => group.querySelector('img')?.naturalWidth > 0, 'aperçu '+label);
  };
  const fillQuestion = value => { const input = document.querySelector('#app textarea'); input.value = value; input.dispatchEvent(new Event('input')); };
  const finishEdit = async (create = false) => {
    click('Continuer'); click('Continuer'); click('Continuer');
    click(create ? 'Créer le brouillon' : 'Enregistrer les modifications');
    await until(() => location.hash.startsWith('#poll/') && text().includes('Modifier l’apparence'), 'sondage enregistré');
  };
  await seed(JSON.stringify(emptyState()));
  await repository.recoverAssets();
  assert(document.querySelector('.brand').textContent.trim() === 'Voti' && document.querySelector('.brand-icon').alt === '', 'Logo décoratif avec texte HTML Voti');
  await until(() => document.querySelector('.brand-icon').naturalWidth === 512, 'logo embarqué');
  assert(document.querySelector('.brand-icon').getBoundingClientRect().height === 32, 'Logo compact');
  assert(document.querySelectorAll('#app .mascot').length === 1 && document.querySelector('#app .mascot').getBoundingClientRect().height <= 90, 'Mascotte ponctuelle dans bibliothèque vide');
  assert(!!document.querySelector('.main-nav a[href="#new"]') && !document.querySelector('#app .mascot').closest('button,a'), 'Mascotte décorative non bloquante');
  assert((await adapter.listMetadata()).length === 0, 'Branding absent d’IndexedDB');

  const files = [];
  for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
    const file = await makeFile(mime); files.push(file);
    const poll = await processImage(file, 'poll'), choice = await processImage(file, 'choice');
    assert(poll.width === 1600 && poll.height === 800 && poll.byteLength <= 1_000_000, mime+' réduit pour sondage');
    assert(choice.width === 1000 && choice.height === 500 && choice.byteLength <= 600_000, mime+' réduit pour choix');
    await verifyDecodedAsset(choice); assert(['image/webp','image/png'].includes(choice.mimeType), 'Réencodage décodable '+mime);
  }
  // JPEG EXIF orientation 6 : la sortie doit être portrait et dépourvue de métadonnées.
  const jpeg = new Uint8Array(await files[0].arrayBuffer());
  const exif = Uint8Array.from([0xff,0xe1,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);
  const oriented = await processImage(new Blob([jpeg.slice(0,2), exif, jpeg.slice(2)], { type:'image/jpeg' }), 'choice');
  assert(oriented.width === 500 && oriented.height === 1000, 'Orientation EXIF normalisée');
  for (const [body, mime] of [['<svg xmlns="http://www.w3.org/2000/svg"/>','image/svg+xml'], ['GIF89a00000000000000','image/gif'], ['broken image','image/png']]) {
    await reject(() => processImage(new Blob([body], { type:mime }), 'poll'), 'Format interdit/corrompu refusé '+mime);
  }
  await reject(() => processImage(new Blob([new Uint8Array(20_000_001)], { type:'image/png' }), 'poll'), 'Entrée trop volumineuse refusée');
  // Signature/dimensions plausibles mais flux compressé invalide : le vrai décodeur refuse.
  const bytes = new Uint8Array(await files[1].arrayBuffer());
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const view = new DataView(bytes.buffer), size = view.getUint32(offset);
    if (String.fromCharCode(...bytes.slice(offset+4,offset+8)) === 'IDAT') { bytes.fill(0, offset+8, offset+8+size); break; }
    offset += size + 12;
  }
  await reject(() => processImage(new Blob([bytes], { type:'image/png' }), 'poll'), 'Flux compressé invalide refusé au décodage');
  const oversized = new Uint8Array(await files[1].arrayBuffer()); new DataView(oversized.buffer).setUint32(16, 30000);
  await reject(() => processImage(new Blob([oversized], { type:'image/png' }), 'poll'), 'Dimensions dangereuses refusées avant décodage');

  const sample = await processImage(files[0], 'poll');
  await adapter.put(sample);
  assert(await adapter.has(sample.id) && (await adapter.get(sample.id)).blob.size === sample.byteLength, 'IndexedDB réel put/get/has');
  assert((await adapter.listMetadata()).length === 1 && !('blob' in (await adapter.listMetadata())[0]), 'IndexedDB métadonnées');
  await adapter.put(sample); assert((await adapter.listMetadata()).length === 1, 'ID immuable et écriture idempotente');
  await adapter.delete(sample.id); assert(!await adapter.has(sample.id), 'IndexedDB delete');
  const aborting = new IndexedDBAssetAdapter();
  await reject(() => aborting.transaction('readwrite', (store, _result, abort) => { store.add(sample); abort(new Error('échec injecté')); }), 'Transaction IndexedDB avortée');
  assert(!await adapter.has(sample.id), 'Abort réel : aucun asset partiel');
  const quotaFactory = { open() { const request = {}; queueMicrotask(() => { request.error = new DOMException('plein','QuotaExceededError'); request.onerror(); }); return request; } };
  let quotaMessage = '';
  try { await new IndexedDBAssetAdapter(quotaFactory).put(sample); } catch (error) { quotaMessage = error.message; }
  assert(quotaMessage.includes('Quota'), 'Message quota explicite');

  await go('#new', 'Que veux-tu demander'); fillQuestion('Sondage illustré');
  await upload('Image du sondage', files[0]);
  assert((await adapter.listMetadata()).length === 0, 'Image en édition seulement en mémoire');
  click('Continuer');
  const choices = [...document.querySelectorAll('#app input[type=text]')];
  for (const [i,input] of choices.entries()) { input.value = ['Premier choix','Second choix'][i]; input.dispatchEvent(new Event('input')); }
  await upload('Image de la réponse 1', files[1]);
  click('Continuer'); click('Continuer'); click('Créer le brouillon');
  await until(() => stored().polls.length === 1 && location.hash.startsWith('#poll/'), 'création illustrée');
  const id = stored().polls[0].id, first = stored().polls[0].definition.pollImageAssetId;
  assert(stored().schemaVersion === 2 && !!stored().polls[0].definition.choices[0].imageRef, 'Références sémantiques v2');
  assert(!/base64|data:image|byteLength/.test(localStorage.getItem(key)), 'Aucun blob/base64 en localStorage');
  await go('#home', 'Mes sondages');
  await until(() => document.querySelector('.image-thumbnail img')?.naturalWidth > 0, 'vignette');
  assert(document.querySelector('.image-thumbnail').getBoundingClientRect().width === 56 && document.querySelectorAll('#app .mascot').length === 0, 'Vignette compacte, mascotte absente de la liste');
  await go('#edit/'+id, 'Que veux-tu demander');
  await upload('Image du sondage', await makeFile('image/webp', 900, 600, '#137680'));
  await finishEdit();
  assert(stored().polls[0].definition.pollImageAssetId !== first && !await adapter.has(first), 'Remplacement enregistré et ancien asset nettoyé');
  const replaced = stored().polls[0].definition.pollImageAssetId;
  await go('#edit/'+id, 'Que veux-tu demander');
  document.querySelector('.image-picker button.quiet').click(); await finishEdit();
  assert(stored().polls[0].definition.pollImageAssetId === null && !await adapter.has(replaced), 'Retrait enregistré et nettoyage');
  await go('#edit/'+id, 'Que veux-tu demander'); await upload('Image du sondage', files[2]); await finishEdit();
  click('Publier dans ce navigateur'); await until(() => stored().polls[0].status === 'published', 'publication');
  await go('#vote/'+id, 'Choisis une réponse');
  await until(() => [...document.querySelectorAll('#app .user-image img')].every(img=>img.naturalWidth>0), 'images du vote');
  assert(document.querySelectorAll('.vote-choice').length === 2 && document.querySelector('.vote-choice').textContent.includes('Premier choix'), 'Choix avec image et texte');
  // Le choix reste activable même si le chargement de son illustration échoue.
  const choiceImg = document.querySelector('.vote-choice img'); choiceImg.dispatchEvent(new Event('error'));
  assert(!document.querySelector('.vote-choice input').disabled && document.querySelector('.image-fallback:not([hidden])'), 'Échec image : vote textuel disponible');
  document.querySelector('.vote-choice input').click(); click('Continuer'); click('Oui, je confirme');
  await until(() => text().includes('Ton vote a bien été enregistré'), 'vote illustré');
  assert(stored().ballots.length === 1 && !!stored().polls[0].definitionHash, 'Premier vote verrouille images et définition');
  await go('#edit/'+id, 'ne peut plus être modifié');
  assert(!document.querySelector('.image-picker'), 'Aucun remplacement d’image après verrouillage');

  await go('#backup', 'Sauvegarde & transfert');
  document.querySelector('#app details').open = true;
  await until(() => document.querySelector('#app textarea').value.includes('base64'), 'backup contenant les assets');
  const raw = document.querySelector('#app textarea').value;
  const parsed = await parseBackup(raw, verifyDecodedAsset);
  assert(parsed.assets.length === 2 && parsed.state.ballots.length === 1, 'Sauvegarde unique sondage, choix, bulletin et assets');
  const malformed = JSON.parse(raw); malformed.assets[0].base64 = 'AAAA';
  const before = localStorage.getItem(key);
  const importInput = document.querySelector('#app input[type=file]');
  const transfer = new DataTransfer(); transfer.items.add(new File([JSON.stringify(malformed)], 'bad.json', { type:'application/json' })); importInput.files=transfer.files; importInput.dispatchEvent(new Event('change'));
  await until(() => !document.getElementById('message').hidden, 'erreur import');
  assert(localStorage.getItem(key) === before, 'Import corrompu sans état partiel');

  // Corruption avec identité binaire recalculée : le décodage, pas seulement le hash, doit refuser.
  const broken = JSON.parse(raw), entry = broken.assets[0];
  const binary = Uint8Array.from(atob(entry.base64), character=>character.charCodeAt(0));
  binary.fill(0, Math.min(40, binary.length-1));
  const oldId = entry.id; entry.id = await contentId(binary);
  let encoded=''; for (const byte of binary) encoded += String.fromCharCode(byte); entry.base64 = btoa(encoded);
  if (broken.state.polls[0].definition.pollImageAssetId === oldId) broken.state.polls[0].definition.pollImageAssetId = entry.id;
  // Déjà refusé par l'empreinte verrouillée ou le validateur binaire : aucun contournement possible.
  await reject(() => parseBackup(JSON.stringify(broken), verifyDecodedAsset), 'Asset corrompu même avec hash binaire recalculé refusé');

  await seed(JSON.stringify(emptyState())); await repository.recoverAssets();
  await go('#backup', 'Sauvegarde & transfert');
  const restore = document.querySelector('#app input[type=file]'), good = new DataTransfer(); good.items.add(new File([raw], 'backup.json', { type:'application/json' })); restore.files=good.files; restore.dispatchEvent(new Event('change'));
  await until(() => document.getElementById('notice').textContent.includes('Sauvegarde importée'), 'restauration complète');
  assert(stored().ballots.length === 1 && (await adapter.listMetadata()).length === 2, 'Import réel publie état et blobs cohérents');
  assert(JSON.parse(await exportBackup(stored(), adapter)).assets.length === 2, 'Restauration réexportable');
  await go('#home', 'Mes sondages');
  await until(() => document.querySelector('.image-thumbnail img')?.naturalWidth > 0, 'image restaurée');
  for (const theme of ['pop','nature','douceur','dark','minimal']) {
    document.documentElement.dataset.theme = theme;
    assert(document.documentElement.scrollWidth <= innerWidth, 'Images et thème sans débordement '+theme);
    const backdrop = getComputedStyle(document.body, '::before');
    assert(theme === 'pop' ? backdrop.backgroundImage.includes('data:image/webp') && Number(backdrop.opacity) <= .12 : backdrop.content === 'none', 'Fond discret réservé à Pop '+theme);
    assert(getComputedStyle(document.querySelector('main')).backgroundColor.startsWith('rgb('), 'Surface opaque protégeant les contrastes '+theme);
  }
  document.documentElement.dataset.theme = localStorage.getItem('voti.theme') || 'pop';
  assert(document.querySelector('.poll-row').getBoundingClientRect().height < 260, 'Ligne illustrée compacte à 360 px');
  return checks;
}
