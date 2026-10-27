"""Composition des guides courts depuis les textes et captures validés."""
import re
from lxml import html, etree


def element(tag, cls=None, text=None):
    node = html.Element(tag, {'class': cls} if cls else {})
    node.text = text
    return node


def move_group(parent, nodes, cls):
    box = element('div', cls)
    parent.insert(parent.index(nodes[0]), box)
    for node in nodes:
        box.append(node)
    return box


def content_after(parent, heading, stop_tags=('h3',)):
    nodes = [heading]
    nxt = heading.getnext()
    while nxt is not None and nxt.tag not in stop_tags:
        nodes.append(nxt)
        nxt = nxt.getnext()
    return nodes


def split_troubleshoot(card):
    """Trois lignes label/contenu ; mots et liens de la source conservés."""
    labels = {'Vérifie :': ('trouble-check', 'VÉRIFIE'),
              'À faire :': ('trouble-action', 'À FAIRE'),
              'Si ça bloque encore :': ('trouble-help', 'SI ÇA BLOQUE ENCORE')}
    for p in list(card.xpath('./p')):
        pieces = []
        current = element('p')
        current.text = p.text
        for child in list(p):
            label = labels.get(child.text_content().strip()) if child.tag == 'strong' else None
            if label and (len(current) or (current.text or '').strip()):
                pieces.append(current)
                current = element('p')
            if label:
                current.set('class', label[0])
                child.set('class', 'troubleshoot-label')
                if label[0]=='trouble-help': child.text='Si ça bloque :'
                # Libellé court demandé ; le contenu et les renvois restent intacts.
            current.append(child)
        if len(current) or (current.text or '').strip():
            pieces.append(current)
        idx = card.index(p)
        card.remove(p)
        for i, piece in enumerate(pieces):
            if piece.get('class'):
                row = element('div', 'diagnostic-row ' + piece.get('class'))
                label = piece[0]
                body = element('div', 'diagnostic-copy')
                body.text = label.tail
                label.tail = None
                piece.remove(label)
                for child in list(piece):
                    body.append(child)
                row.append(label)
                row.append(body)
                card.insert(idx+i, row)
            else:
                card.insert(idx+i, piece)


def sensitive_actions(notice):
    """Cinq lignes explicites ; mêmes conséquences que le texte validé."""
    notice.clear()
    notice.set('class', 'sensitive-actions')
    notice.append(element('h3', text='Ces actions ne signifient pas la même chose'))
    actions = [
        ('Révoquer une Carte', 'Coupe son accès.'),
        ('Révoquer un membre', 'Retire son droit de participer.'),
        ('Révoquer un accès de gestion', 'Retire ses droits.'),
        ('Archiver un Espace', 'Conserve l’historique, sans restauration dans l’interface.'),
        ('Supprimer un sondage', 'Retire ses données en ligne, pas les PDF distribués.'),
    ]
    for title, desc in actions:
        row = element('p')
        label = etree.SubElement(row, 'strong'); label.text = title
        label.tail = ' — ' + desc
        notice.append(row)
    p = element('p', 'sensitive-note', 'Les votes passés restent lors des révocations. ')
    link = etree.SubElement(p, 'a', href='VOTI_GUIDE.pdf#avance')
    link.text = 'Conséquences détaillées'; notice.append(p)


def polish_help(tree):
    nodes = [node for sheet in tree.xpath('./section') for node in list(sheet)]
    for child in list(tree):
        tree.remove(child)
    families, lead = {}, []
    current = card = None
    for node in nodes:
        if node.tag == 'h1':
            lead.append(node)
        elif node.tag == 'h2':
            current = element('section', 'help-section')
            families[node.text_content()] = current
            current.append(node); card = None
        elif node.tag == 'h3':
            card = element('article', 'troubleshoot-card')
            current.append(card); card.append(node)
        elif card is not None:
            card.append(node)
        elif current is not None:
            current.append(node)
        else:
            lead.append(node)
    polls = families['Sondages / Participation']
    participation = element('section', 'help-section')
    participation.append(element('h2', text='Participation'))
    polls[0].text = 'Sondages'
    for card in list(polls.xpath('./article'))[3:]:
        participation.append(card)
    families['Participation'] = participation
    # L’invitation est un problème d’accès ; le regrouper avec les membres
    # équilibre les fiches sans réduire la police ni couper une fiche.
    invitation = families['Lots de Cartes / Invitations'].xpath('./article')[-1]
    families['Membres / Groupes'].append(invitation)
    families['Membres / Groupes'][0].text = 'Membres / Groupes / Invitations'
    families['Lots de Cartes / Invitations'][0].text = 'Lots de Cartes'
    ids = [('Accès à Voti / Espaces','acces','Accès'), ('Cartes Voti','cartes','Cartes'),
           ('Membres / Groupes','membres','Membres / Groupes'),
           ('Sondages / Participation','sondages','Sondages'),
           ('Participation','participation','Participation'), ('Résultats','resultats','Résultats'),
           ('Installation / PWA','installation','Installation')]
    index = element('nav', 'help-index')
    index.append(element('h2', text='Je cherche de l’aide pour…'))
    links = element('div', 'help-index-links'); index.append(links)
    for name, id_, label in ids:
        families[name].set('id', 'help-'+id_)
        a = etree.SubElement(links, 'a', href='#help-'+id_); a.text = label
    pages = [
        ['Avant de commencer', 'Accès à Voti / Espaces'],
        ['Cartes Voti', 'Membres / Groupes'],
        ['Sondages / Participation', 'Participation'],
        ['Résultats', 'Lots de Cartes / Invitations'],
        ['Installation / PWA', 'Retrait des données', 'Besoin d’aide ?'],
    ]
    for i, names in enumerate(pages):
        sheet = element('section', f'sheet help-sheet help-sheet-{i+1}')
        tree.append(sheet)
        if i == 0:
            for node in lead: sheet.append(node)
        for name in names:
            family = families[name]
            if name == 'Avant de commencer':
                family.set('class', 'help-intro')
            elif name == 'Besoin d’aide ?':
                family.set('class', 'help-final')
            sheet.append(family)
            if name == 'Avant de commencer': sheet.append(index)
    for i, card in enumerate(tree.xpath('.//article'), 1):
        card.set('data-number', f'{i:02}')
        split_troubleshoot(card)
        if card.getparent() == families['Résultats']:
            card.set('class', 'troubleshoot-card results-card')
    for notice in tree.xpath('.//blockquote'):
        # Le cadre des actions sensibles est une unité distincte de la fiche.
        notice.getparent().addnext(notice)
        sensitive_actions(notice)


def polish_quick(tree):
    first, second, third, fourth = tree.xpath('./section')
    table = first.find('table')
    roles = element('div', 'role-cards')
    for row in table.xpath('./tbody/tr'):
        card = element('article', 'role-card')
        for i, cell in enumerate(list(row)):
            cell.tag = 'h4' if i == 0 else 'p'
            card.append(cell)
        roles.append(card)
    first.replace(table, roles)
    h = first.xpath('./h3')[0]
    move_group(first, [h, h.getnext(), h.getnext().getnext()], 'organisation-card')
    start = next(h for h in first.xpath('./h3') if 'Commencer' in h.text_content())
    start_card = move_group(first, [start, start.getnext()], 'start-card')
    install = first.find('blockquote')
    install.set('class', 'start-card install-card')
    pair = move_group(first, [start_card, install], 'start-pair')
    # Deux blocs secondaires, pas une seconde lecture principale.
    for h in list(second.xpath('./h3')):
        match = re.match(r'(\d)[.]\s+(.*)', h.text_content())
        if not match: continue
        nodes = content_after(second, h, ('h3','figure'))
        h.clear(); h.text = match[2]
        card = move_group(second, nodes, 'step-card')
        card.set('data-number', match[1])
    last = second.xpath('./div[@class="step-card"]')[-1]
    figure = second.find('figure')
    if figure is not None:
        layout = element('div', 'card-delivery')
        last.addnext(layout); layout.append(last); layout.append(figure)
    for p in second.xpath('./p'):
        if p.text_content().startswith('Espace, membres'):
            p.set('class', 'reuse-conclusion')
    # Les phases rassemblent les mêmes paragraphes et étapes.
    intro = third.find('p')
    heading = third.find('h3'); heading.text = 'CRÉER'
    ol = third.find('ol')
    publish = element('div', 'phase-block publish-phase')
    ol.addnext(publish)
    publish.append(element('h3', text='PUBLIER'))
    pub_list = element('ol'); pub_list.set('start','5'); pub_list.set('style','counter-reset:list-item 4;')
    pub_list.append(ol[-1]); publish.append(pub_list)
    table = third.find('table')
    statuses = element('div', 'status-pair')
    heads = table.xpath('.//th'); cells = table.xpath('.//tbody/tr/td')
    for h, cell in zip(heads,cells):
        card = element('div','status-card'); title = element('h4')
        title.text = h.text_content().upper(); card.append(title)
        cell.tag='p'; card.append(cell); statuses.append(card)
    third.remove(table); publish.append(statuses)
    minimum = third.find('blockquote'); minimum.set('class','minimum-note')
    publish.append(minimum)
    create = move_group(third, [intro, heading, ol], 'phase-block create-phase')
    # Titre de phase en tête ; les trois modes restent à proximité.
    create.insert(0, heading)
    follow = next(h for h in third.xpath('./h3') if 'Suivre' in h.text_content())
    follow.text = 'SUIVRE'
    move_group(third, content_after(third,follow), 'phase-block follow-phase')
    # La page Participant devient trois phases, avec chaque capture dans le parcours.
    h = fourth.find('h3')
    if h is not None: fourth.remove(h)
    steps = [li for ol in fourth.xpath('./ol') for li in ol]
    for ol in list(fourth.xpath('./ol')): fourth.remove(ol)
    row = fourth.find('.//div[@class="screen-pair"]')
    figs = list(row) if row is not None else []
    if row is not None: fourth.remove(row)
    introduction = fourth.find('p')
    anchor = introduction
    for n, (title, indexes) in enumerate([
        ('OUVRIR ET PRÉSENTER MA CARTE',range(0,3)),
        ('CHOISIR ET CONFIRMER',range(3,6)),
        ('TERMINER',range(6,7))],1):
        phase = element('div',f'participant-phase participant-phase-{n}')
        phase.set('data-number',str(n))
        phase.append(element('h3',text=title))
        ol = element('ol'); ol.set('start',str(indexes.start+1))
        ol.set('style','counter-reset:list-item '+str(indexes.start)+';')
        for i in indexes: ol.append(steps[i])
        phase.append(ol)
        if n==2:
            layout=element('div','choice-layout'); phase.append(layout)
            layout.append(figs[0])
            right=element('div','choice-confirm'); layout.append(right)
            right.append(ol); right.append(figs[1])
        anchor.addnext(phase); anchor=phase
    reminder = next(p for p in fourth.xpath('./p') if p.text_content().startswith('À retenir'))
    box = move_group(fourth,[reminder,reminder.getnext()],'remember-zone')
    box.insert(0,element('h3',text='À RETENIR'))
    strong = reminder.find('strong'); tail = strong.tail
    reminder.remove(strong)
    reminder.text = 'Vérifie ton pseudo avant de répondre. ' + (tail or '').lstrip().replace('un seul vote','Un seul vote',1)


def polish_short(markup, kind):
    if kind not in ['quick','help']: return markup
    tree = html.fragment_fromstring(markup, create_parent='div')
    (polish_quick if kind=='quick' else polish_help)(tree)
    for node in tree.iter():
        if node.text: node.text=re.sub(r' (?=[:;?!])', '\u00a0', node.text)
        if node.tail: node.tail=re.sub(r' (?=[:;?!])', '\u00a0', node.tail)
    return ''.join(etree.tostring(n,encoding='unicode',method='html') for n in tree)
