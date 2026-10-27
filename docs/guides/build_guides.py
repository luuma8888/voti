#!/usr/bin/env python3
"""Génère localement les trois guides depuis leurs Markdown, sans accès réseau."""
from short_layout import polish_short
from pathlib import Path
import re, subprocess, json, html, hashlib, argparse, importlib.metadata
from lxml import html as LH, etree
from weasyprint import HTML, default_url_fetcher
from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, TextStringObject, DictionaryObject, ArrayObject, NumberObject

HERE=Path(__file__).resolve().parent
DOCS=HERE.parent
HEAD='601aeb04c171fae6b4f4928d694f9ce8c4ddf190'
DATE='26 octobre 2026'
DOCSPECS=[('VOTI_DEMARRAGE_RAPIDE','Démarrage rapide Voti','quick'),('VOTI_GUIDE','Guide Voti — Comprendre et utiliser','guide'),('VOTI_AIDE_DEPANNAGE','Aide & dépannage Voti','help')]
INK='#25334b';ACCENT='#684397';PALE='#f1ecf7';LINE='#b8b0c5'

def svg_start(title,desc,w,h):
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc"><title id="title">{html.escape(title)}</title><desc id="desc">{html.escape(desc)}</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="{ACCENT}"/></marker></defs><g font-family="DejaVu Sans,sans-serif" fill="{INK}">'
def box(x,y,w,h,lines,accent=False,fs=20):
 a=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="{PALE if accent else "#fff"}" stroke="{ACCENT if accent else LINE}" stroke-width="2"/>'
 for i,t in enumerate(lines):
  yy=y+h/2+(i-(len(lines)-1)/2)*25+7
  a+=f'<text x="{x+w/2}" y="{yy}" text-anchor="middle" font-size="{fs}">{html.escape(t)}</text>'
 return a
def arrow(x1,y1,x2,y2):return f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{ACCENT}" stroke-width="2.5" fill="none" marker-end="url(#arrow)"/>'
def diagrams():
 s=svg_start('S1 — Organisation de Voti','Un Espace rassemble membres, groupes et sondages. Chaque membre possède une Carte. Les groupes rassemblent des membres et servent à cibler les sondages.',700,245)
 s+=box(255,8,190,45,['Espace'],True,22)
 for xx in [115,350,585]:s+=arrow(350,53,xx,91)
 for x,t in [(10,'Membres'),(245,'Groupes'),(480,'Sondages')]:s+=box(x,95,210,49,[t])
 s+=arrow(245,119,222,119)+arrow(455,119,478,119)
 s+=arrow(115,144,115,181)+box(10,185,210,48,['Cartes Voti'])
 s+='<text x="260" y="185" font-size="18">Groupes : rassemblent des membres.</text><text x="260" y="216" font-size="18">Sondages : tout l’Espace ou des groupes.</text></g></svg>'
 (HERE/'diagrams/S1.svg').write_text(s)
 s=svg_start('S2 — Du sondage au vote','Créateur ou Administrateur publie. Le Participant présente sa Carte, choisit, confirme. Le vote est enregistré. Les résultats suivent les règles choisies.',700,350)
 labels=['Créateur / Administrateur publie','Participant présente sa Carte Voti','Choisit sa réponse','Confirme son choix','Vote enregistré','Résultats selon les règles']
 for i,t in enumerate(labels):
  y=6+i*58;s+=box(55,y,590,43,[t],i in [0,5],20)
  if i<5:s+=arrow(350,y+43,350,y+56)
 s+='</g></svg>';(HERE/'diagrams/S2.svg').write_text(s)
 s=svg_start('S3 — Trois rôles fonctionnels','Administrateur : prépare et gère. Créateur : crée et suit les sondages autorisés. Participant : répond et consulte selon ses droits. Aucun âge ou métier ne définit ces rôles.',700,204)
 for i,(role,lines)in enumerate([('Administrateur',['Prépare et gère l’Espace']),('Créateur',['Crée et suit les sondages autorisés']),('Participant',['Répond et consulte selon ses droits'])]):
  y=6+i*68;s+=box(5,y,220,54,[role],True,20)+arrow(225,y+27,260,y+27)+box(265,y,430,54,lines,False,18)
 s+='</g></svg>';(HERE/'diagrams/S3.svg').write_text(s)
 s=svg_start('S4 — Pourquoi attendre les résultats ?','Minimum atteint plus condition choisie satisfaite plus personne autorisée : résultats disponibles. Les trois conditions sont nécessaires.',700,181)
 for x,lines in [(5,['Minimum','atteint']),(245,['Condition choisie','satisfaite']),(485,['Personne','autorisée'])]:s+=box(x,5,210,66,lines,False,18)
 for x in [230,470]:s+=f'<text x="{x}" y="48" text-anchor="middle" font-size="27">+</text>'
 s+=arrow(350,78,350,113)+box(150,118,400,53,['Résultats disponibles'],True,22)
 s+='</g></svg>';(HERE/'diagrams/S4.svg').write_text(s)

def local_only(url):
 if not (url.startswith('file:')or url.startswith('data:')):raise ValueError('Ressource non locale interdite : '+url)
 return default_url_fetcher(url)

def normalise_source(text,kind):
 text=re.sub(r'(<a id="[^"]+"></a>)\n(#+ )',r'\1\n\n\2',text)
 if kind=='guide':
  text=re.split(r'### Référence et (?:montage|export) de cette édition',text)[0].rstrip().rstrip('-').rstrip()
  text=re.sub(r'> \*\*C39 — capture humaine.*?(?=\n\*\*Installer)', '<!-- C39/C40 : vues natives à ajouter ultérieurement si disponibles ; procédure textuelle complète ci-dessus. -->\n',text,flags=re.S)
 return text

def body_for(name,title,kind):
 source=normalise_source((DOCS/(name+'.md')).read_text(),kind)
 body=subprocess.run(['pandoc','--from=markdown+raw_html','--to=html5','--wrap=none'],input=source,text=True,capture_output=True,check=True).stdout
 tree=LH.fragment_fromstring(body,create_parent='main')
 # Rattacher les ancres aux titres, sans paragraphes vides qui créeraient des
 # blancs ou sépareraient le titre de sa procédure.
 for p in list(tree.xpath('.//p')):
  if p.text_content().strip():continue
  anchors=p.xpath('./a[@id]')
  nxt=p.getnext()
  if len(anchors)==1 and nxt is not None and nxt.tag in ['h1','h2','h3','h4']:
   nxt.set('id',anchors[0].get('id'));p.getparent().remove(p)
 # Les reprises de listes après une capture gardent leur numérotation PDF.
 for ol in tree.xpath('.//ol[@start]'):
  ol.set('style','counter-reset:list-item '+str(int(ol.get('start'))-1)+';')
 # Les identifiants restent stables pour les liens intra- et interdocuments.
 for a in tree.xpath('.//a[@href]'):
  href=a.get('href');a.set('href',re.sub(r'^(VOTI_[A-Z_]+)\.md',r'\1.pdf',href))
 for image in tree.xpath('.//img'):
  src=image.get('src','');image.set('src','../'+src)
  image.set('loading','eager')
 # Mermaid éditorial devient un SVG local, sans bibliothèque distante.
 n=0
 for pre in list(tree.xpath('.//pre')):
  if 'flowchart' not in pre.text_content():continue
  id_=[1,3,2,4][n] if kind=='guide' else 1;n+=1
  fig=LH.fragment_fromstring(f'<figure class="diagram schema-{id_}"><img src="diagrams/S{id_}.svg" alt="Schéma S{id_}"/></figure>');pre.getparent().replace(pre,fig)
 # Pandoc crée déjà des figures ; conserver les légendes utiles à l’impression.
 for fig in tree.xpath('.//figure[not(contains(@class,"diagram"))]'):
  fig.set('class','screenshot')
  im=fig.find('.//img');src=im.get('src','')if im is not None else ''
  m=re.search(r'/([0-9]{2})-',src)
  if m:fig.set('data-capture','C'+m[1]);fig.set('class','screenshot cap-'+m[1]+(' mobile'if m[1]in['22','34','35','36','37']else''))
  nxt=fig.getnext()
  if nxt is not None and nxt.tag=='p' and nxt.find('em')is not None:
   cap=fig.find('figcaption')
   if cap is not None:fig.remove(cap)
   nxt.tag='figcaption';fig.append(nxt)
 # Captures sans figure (compatibilité de versions Pandoc).
 for p in list(tree.xpath('.//p[img]')):
  p.tag='figure';p.set('class','screenshot')
 # Sélection imprimée : supprimer seulement des illustrations redondantes,
 # jamais le texte des procédures. La sélection complète reste dans la source.
 if kind=='guide':
  omit={'C08','C11','C15','C20','C21','C34','C37'}
  for fig in list(tree.xpath('.//figure[@data-capture]')):
   if fig.get('data-capture') in omit:fig.getparent().remove(fig)
 # Cadrages de publication, sans modifier les masters ni leur masque.
 if kind in ['quick','guide']:
  for im in tree.xpath('.//figure//img'):
   if '14-carte-exemple.png' in im.get('src','') or kind=='quick' and '31-suivi-attente-resultats.png' in im.get('src','') or kind=='guide' and '30-editer-sondage-reglages.png' in im.get('src',''):
    im.set('src','crops/'+Path(im.get('src')).name)
    if kind=='guide' and '30-editer' in im.get('src',''):im.set('alt','Barre des modifications non enregistrées : Annuler et Enregistrer les règles.')
  caps=tree.xpath('.//figure[@data-capture="C31"]/figcaption')
  if caps and kind=='quick':
   caps[0].clear();caps[0].text='État du sondage, compteur et fermeture restent repérables en haut de la gestion.'
 # Deux captures mobiles peuvent partager une rangée de lecture, sans colonne de texte.
 pair_ids=[['C35','C36']] if kind in ['quick','guide'] else []
 for pair in pair_ids:
  figs=[tree.xpath('.//figure[@data-capture="'+id_+'"]') for id_ in pair]
  if all(figs):
   first,second=figs[0][0],figs[1][0];row=LH.Element('div',{'class':'screen-pair'})
   second.addnext(row)
   row.append(first);row.append(second)
 # Procédures : un repère discret dans D2.
 for h in tree.xpath('.//h3'):
  text=h.text_content()
  if re.match(r'P\d\d [—-]',text):
   h.text=re.sub(r'^P(\d\d) [—-] ',r'P\1 · ',text)
  if kind=='quick':h.text=re.sub(r'^S\d [—-] ','',text)
 for h in tree.xpath('.//h2'):
  if kind=='quick':h.text=re.sub(r'^Page \d [—-] ','',h.text_content())
 # Enlever les IDs de capture des légendes visibles (leurs noms de fichier les conservent).
 for cap in tree.xpath('.//figcaption'):
  for el in cap.iter():
   if el.text:el.text=re.sub(r'^C\d\d [—-] ','',el.text)
 # Pas de titres isolés au pied d’une page.
 for bq in tree.xpath('.//blockquote'):
  bq.set('class','notice '+('attention'if 'Attention' in bq.text_content()else'info'))
 if kind=='guide':
  # Transformer le sommaire en une page claire ; les chapitres continuent ensuite.
  h=next(h for h in tree.xpath('.//h2')if 'Trouver rapidement' in h.text_content());h.set('class','toc-title');ul=h.getnext();ul.set('class','toc')
  p=ul.getnext()
  if p is not None:p.set('class','toc-note')
  # D1/D3 restent faciles à retrouver depuis le guide maître.
  p.addnext(LH.fragment_fromstring('<p class="related">Pour commencer : <a href="VOTI_DEMARRAGE_RAPIDE.pdf">Démarrage rapide</a> · Un problème : <a href="VOTI_AIDE_DEPANNAGE.pdf">Aide &amp; dépannage</a></p>'))
 if kind=='guide':
  for h in tree.xpath('.//h2'):
   if h.text_content()=='Repères de procédures':
    ul=h.getnext();h.getparent().remove(h);ul.getparent().remove(ul)
 # Un titre par page de démarrage ; le h1 occupe seulement la première.
 htmlbody=''.join(etree.tostring(x,encoding='unicode',method='html')for x in tree)
 if kind in ['quick','help']:
  chunks=re.split(r'<div class="page-break"[^>]*>\s*</div>',htmlbody)
  htmlbody=''.join(f'<section class="sheet sheet-{i+1}">{chunk}</section>'for i,chunk in enumerate(chunks))
 return polish_short(htmlbody,kind)

def fix_pdf_links(path):
 reader=PdfReader(path);writer=PdfWriter();writer.clone_document_from_reader(reader)
 for page in writer.pages:
  for ref in page.get('/Annots',[]):
   a=ref.get_object().get('/A')
   if not a or a.get('/S')!='/URI':continue
   uri=str(a.get('/URI',''));m=re.search(r'(VOTI_[A-Z_]+\.pdf)(?:#(.*))?$',uri)
   if m:
    a.clear();a.update({NameObject('/S'):NameObject('/GoToR'),NameObject('/F'):TextStringObject(m[1]),NameObject('/D'):TextStringObject(m[2]) if m[2] else ArrayObject([NumberObject(0),NameObject('/Fit')])})
 writer.write(path)

def build(only=None):
 diagrams()
 (HERE/'crops').mkdir(exist_ok=True)
 for name,rect in [('14-carte-exemple.png',(12,168,652,601)),('31-suivi-attente-resultats.png',(0,130,1057,425)),('30-editer-sondage-reglages.png',(12,12,813,84))]:
  Image.open(DOCS/'guide-assets'/name).crop(rect).save(HERE/'crops'/name)
 old=json.loads((HERE/'build-manifest.json').read_text()) if (HERE/'build-manifest.json').exists() else {}
 log=[]
 for name,title,kind in DOCSPECS:
  if only and kind not in only:
   log.append(next(d for d in old['documents'] if d['name']==name));continue
  body=body_for(name,title,kind)
  doc=f'<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>{html.escape(title)}</title><meta name="author" content="Voti"><meta name="description" content="Documentation Voti, édition du {DATE}"><link rel="stylesheet" href="guides.css"></head><body class="{kind}" data-title="{html.escape(title)}"><header class="running-title">{html.escape(title)}</header><main>{body}</main></body></html>'
  h=HERE/(name+'.html');h.write_text(doc)
  rendered=HTML(filename=str(h),url_fetcher=local_only).render()
  out=HERE/(name+'.pdf');rendered.write_pdf(str(out));fix_pdf_links(out)
  pages=[]
  for i,page in enumerate(rendered.pages):
   captures=[]
   def walk(box):
    el=getattr(box,'element',None)
    if el is not None and el.tag=='figure'and el.get('data-capture'):
     val={'id':el.get('data-capture'),'x':round(box.position_x,1),'y':round(box.position_y,1),'w':round(box.width,1),'h':round(box.height,1)}
     if val not in captures:captures.append(val)
    for child in box.all_children():walk(child)
   walk(page._page_box);pages.append({'page':i+1,'captures':captures})
  images=[]
  for im in LH.fromstring(doc).xpath('.//figure//img'):
   f=(HERE/im.get('src')).resolve()
   images.append({'path':im.get('src'),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
  log.append({'source':str((DOCS/(name+'.md')).relative_to(DOCS)), 'sourceSha256':hashlib.sha256((DOCS/(name+'.md')).read_bytes()).hexdigest(),'images':images,'name':name,'title':title,'pages':len(rendered.pages),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'layout':pages})
 (HERE/'build-manifest.json').write_text(json.dumps({'reference':HEAD,'date':DATE,'tools':{'weasyprint':importlib.metadata.version('weasyprint'),'pypdf':importlib.metadata.version('pypdf'),'pandoc':subprocess.check_output(['pandoc','--version'],text=True).splitlines()[0]},'documents':log},ensure_ascii=False,indent=2)+'\n')
 for d in log:print(d['name'],d['pages'],'pages',d['bytes'],'octets')
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--only',nargs='+',choices=['quick','guide','help'])
 build(parser.parse_args().only)
