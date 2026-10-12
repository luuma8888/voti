/** Tests sérialisables du composant réel embarqué, sans opération métier. */
export async function browserDialogScenario() {
  const { confirmAction } = await import('voti/web/confirmation.js');
  let checks = 0;
  const assert = (value, message) => { if (!value) throw new Error(message); checks++; };
  const originalTheme = document.documentElement.dataset.theme;
  const before = ['voti.local.v1', 'voti.remote.v1'].map(key => localStorage.getItem(key));
  const context = document.createElement('section'); context.className = 'card';
  const trigger = document.createElement('button'); trigger.textContent = 'Test confirmation';
  context.append(trigger); document.body.append(context);
  const open = danger => confirmAction({ trigger, danger, title: danger ? 'Supprimer définitivement ?' : 'Fermer ce sondage ?',
    description: 'Texte de test : aucune donnée ne sera changée.', actionLabel: danger ? 'Supprimer définitivement' : 'Fermer le sondage' });
  try {
    for (const theme of ['pop', 'nature', 'douceur', 'dark', 'minimal']) {
      document.documentElement.dataset.theme = theme;
      for (const accent of ['mint', 'lavender', 'peach']) {
        context.dataset.accent = accent;
        for (const danger of [false, true]) {
          trigger.focus(); let actions = 0;
          const pending = open(danger); pending.then(yes => { if (yes) actions++; });
          const dialog = document.querySelector('.confirmation-dialog');
          const cancel = dialog.querySelector('[data-confirmation=cancel]'), accept = dialog.querySelector('[data-confirmation=accept]');
          assert(dialog instanceof HTMLDialogElement && dialog.matches(':modal') && dialog.getAttribute('aria-modal') === 'true', 'Dialogue réellement modal');
          assert(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent.includes(danger ? 'Supprimer' : 'Fermer'), 'Titre associé');
          assert(document.getElementById(dialog.getAttribute('aria-describedby')).textContent.includes('aucune donnée'), 'Explication associée');
          assert(document.activeElement === cancel && actions === 0, 'Focus sûr et aucune action à ouverture');
          trigger.focus(); assert(document.activeElement === cancel, 'Arrière-plan inerte même au focus programmatique');
          assert(dialog.dataset.accent === accent && getComputedStyle(dialog).getPropertyValue('--accent') === getComputedStyle(context).getPropertyValue('--accent'), 'Accent du contexte');
          const rect = dialog.getBoundingClientRect();
          assert(rect.left >= 0 && rect.right <= innerWidth && dialog.scrollWidth <= dialog.clientWidth && document.documentElement.scrollWidth <= innerWidth, 'Dialogue sans débordement '+theme+'/'+innerWidth);
          assert(cancel.getBoundingClientRect().height >= 44 && accept.getBoundingClientRect().height >= 44, 'Cibles tactiles');
          assert(getComputedStyle(dialog).backgroundColor === getComputedStyle(context).backgroundColor && getComputedStyle(dialog, '::backdrop').backgroundColor !== 'rgba(0, 0, 0, 0)', 'Surface thème et fond modal');
          assert(accept.textContent === (danger ? 'Supprimer définitivement' : 'Fermer le sondage') && accept.classList.contains(danger ? 'danger' : 'primary'), 'Action explicite et danger');
          assert(await open(danger) === false && document.querySelectorAll('.confirmation-dialog').length === 1, 'Deuxième demande refusée sans remplacer le dialogue');
          cancel.click(); assert(await pending === false && actions === 0 && document.activeElement === trigger, 'Annulation souris et retour focus');
          const confirmed = open(danger); confirmed.then(yes => { if (yes) actions++; });
          const action = document.querySelector('[data-confirmation=accept]'); action.click(); action.click();
          assert(await confirmed === true && actions === 1 && !document.querySelector('.confirmation-dialog'), 'Une seule action après double clic explicite');
        }
      }
    }
    delete context.dataset.accent;
    let pending = confirmAction({ trigger, title: '<img src=x onerror="window.votiDialogXss=true">', description: '<script>texte</script>', actionLabel: 'Confirmer' });
    assert(!document.querySelector('.confirmation-dialog img,.confirmation-dialog script') && !window.votiDialogXss, 'Textes du dialogue jamais interprétés');
    document.querySelector('.confirmation-dialog').close('true');
    assert(await pending === false, 'close externe ne signifie jamais confirmer');
    pending = open(true); document.querySelector('.confirmation-dialog').remove();
    assert(await pending === false, 'Retrait externe annule');
    pending = open(true); trigger.remove(); assert(await pending === false, 'Rendu retirant le déclencheur annule');
    context.append(trigger);
    const nativeShow = HTMLDialogElement.prototype.showModal;
    try {
      HTMLDialogElement.prototype.showModal = undefined;
      assert(await open(true) === false && !document.querySelector('.confirmation-dialog'), 'Navigateur non compatible : aucune action sans confirmation');
      HTMLDialogElement.prototype.showModal = () => { throw new Error('Test de refus du navigateur'); };
      assert(await open(true) === false && !document.querySelector('.confirmation-dialog'), 'Ouverture refusée : annulation et nettoyage');
    } finally { HTMLDialogElement.prototype.showModal = nativeShow; }
    assert(before.every((value, index) => value === localStorage.getItem(['voti.local.v1', 'voti.remote.v1'][index])), 'Tests du composant sans mutation des données');
  } finally {
    context.remove(); document.documentElement.dataset.theme = originalTheme;
  }
  return checks;
}

/** Fixture éphémère pour le clavier CDP ; aucune globale applicative exposée. */
export async function prepareKeyboardDialog(theme) {
  const { confirmAction } = await import('voti/web/confirmation.js');
  document.documentElement.dataset.theme = theme;
  const trigger = document.createElement('button'); trigger.type = 'button'; trigger.id = 'dialog-keyboard-trigger'; trigger.textContent = 'Ouvrir la confirmation';
  trigger.dataset.actions = '0';
  trigger.addEventListener('click', () => {
    delete trigger.dataset.result;
    confirmAction({ trigger, title: 'Supprimer définitivement ?', description: 'Aucun sondage réel : test clavier et souris du dialogue.',
      actionLabel: 'Supprimer définitivement', danger: true }).then(yes => {
      trigger.dataset.result = String(yes);
      if (yes) trigger.dataset.actions = String(Number(trigger.dataset.actions) + 1);
    });
  });
  document.body.append(trigger); trigger.focus();
}

/** Véritables événements clavier/pointeur, pas uniquement KeyboardEvent synthétiques. */
export async function keyboardDialogChecks(command, evaluate, sessionId, theme) {
  let checks = 0;
  const assert = async (expression, message) => {
    if (!await evaluate(sessionId, expression)) {
      const state=await evaluate(sessionId, "({focus:document.activeElement?.id||document.activeElement?.dataset.confirmation||document.activeElement?.tagName,open:!!document.querySelector('.confirmation-dialog:modal'),result:document.querySelector('#dialog-keyboard-trigger')?.dataset.result})");
      throw new Error(message+' '+JSON.stringify(state));
    }
    checks++;
  };
  const key = async (name, code, modifiers = 0) => {
    for (const type of ['keyDown', 'keyUp']) await command('Input.dispatchKeyEvent', { type, key:name, code:name, windowsVirtualKeyCode:code, modifiers,
      ...(type==='keyDown' && name==='Enter' ? {text:'\r',unmodifiedText:'\r'} : {}) }, sessionId);
  };
  const mouse = async selector => {
    const point = await evaluate(sessionId, `(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    for (const type of ['mousePressed', 'mouseReleased']) await command('Input.dispatchMouseEvent', { type, ...point, button:'left', clickCount:1 }, sessionId);
  };
  await evaluate(sessionId, `(${prepareKeyboardDialog.toString()})(${JSON.stringify(theme)})`);
  const trigger = '#dialog-keyboard-trigger';
  await key('Enter', 13);
  await assert("document.activeElement?.dataset.confirmation==='cancel' && !!document.querySelector('.confirmation-dialog:modal')", 'Ouverture clavier, focus Annuler');
  await key('Enter', 13);
  await assert("!document.querySelector('.confirmation-dialog') && document.querySelector('#dialog-keyboard-trigger').dataset.result==='false' && document.activeElement.id==='dialog-keyboard-trigger'", 'Entrée initiale annule et restaure le focus');
  await mouse(trigger);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',autoRepeat:true},sessionId);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},sessionId);
  await assert("!!document.querySelector('.confirmation-dialog:modal') && document.activeElement.dataset.confirmation==='cancel' && document.querySelector('#dialog-keyboard-trigger').dataset.actions==='0'", 'Entrée maintenue ne déclenche aucune action');
  await key('Tab', 9);
  await assert("document.activeElement?.dataset.confirmation==='accept' && parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=3 && getComputedStyle(document.activeElement).outlineColor!==getComputedStyle(document.activeElement).color", 'Tab action et focus visible non rouge');
  await key('Tab', 9);
  await assert("document.activeElement?.dataset.confirmation==='cancel'", 'Boucle Tab');
  await key('Tab', 9, 8);
  await assert("document.activeElement?.dataset.confirmation==='accept'", 'Boucle Shift+Tab');
  const route = await evaluate(sessionId, 'location.hash');
  await mouse('.main-nav a[href="#new"]');
  await assert(`location.hash===${JSON.stringify(route)} && !!document.querySelector('.confirmation-dialog:modal')`, 'Arrière-plan non cliquable');
  await key('Escape', 27);
  await assert("!document.querySelector('.confirmation-dialog') && document.querySelector('#dialog-keyboard-trigger').dataset.result==='false' && document.activeElement.id==='dialog-keyboard-trigger'", 'Échap annule et restaure le focus');
  await mouse(trigger); await mouse('[data-confirmation=cancel]');
  await assert("document.activeElement.id==='dialog-keyboard-trigger' && document.querySelector('#dialog-keyboard-trigger').dataset.actions==='0'", 'Annulation souris sans action');
  await mouse(trigger);
  return { checks, async finish() {
    await mouse('[data-confirmation=accept]');
    await assert("!document.querySelector('.confirmation-dialog') && document.querySelector('#dialog-keyboard-trigger').dataset.actions==='1' && document.activeElement.id==='dialog-keyboard-trigger'", 'Confirmation souris unique et restauration');
    await key('Enter',13); await key('Tab',9); await key('Enter',13);
    await assert("!document.querySelector('.confirmation-dialog') && document.querySelector('#dialog-keyboard-trigger').dataset.actions==='2' && document.activeElement.id==='dialog-keyboard-trigger'", 'Action explicitement focalisée confirmable au clavier une seule fois');
    await evaluate(sessionId, "document.querySelector('#dialog-keyboard-trigger').remove()");
    return checks;
  } };
}
