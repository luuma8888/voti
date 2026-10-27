#!/usr/bin/env python3
"""Contrôles documentaires locaux ; ne lance ni application ni requête distante."""
from pathlib import Path
import re,json,hashlib,subprocess
from collections import Counter
from build_guides import normalise_source
from lxml import etree,html
from pypdf import PdfReader
HERE=Path(__file__).resolve().parent
manifest=json.loads((HERE/'build-manifest.json').read_text())
readers={d['name']+'.pdf':PdfReader(HERE/(d['name']+'.pdf'))for d in manifest['documents']}
counts={};results=[]
for d in manifest['documents']:
 path=HERE/(d['name']+'.pdf');r=readers[path.name]
 assert hashlib.sha256(path.read_bytes()).hexdigest()==d['sha256']
 assert r.metadata.title==d['title']
 assert str(r.trailer['/Root'].get('/Lang','')).startswith('fr')
 assert len(r.pages)==d['pages']
 if 'DEMARRAGE' in d['name']:assert len(r.pages)==4
 if 'DEPANNAGE' in d['name']:assert 4<=len(r.pages)<=5
 text='\n'.join(p.extract_text()or''for p in r.pages)
 assert not re.search(r'voti-(?:member|staff|admin|invitation)-v1[.][a-f0-9]+|https?://\S*#/|\uFFFD',text)
 assert 'HUMAN CAPTURE REQUIRED' not in text and 'capture humaine à fournir'not in text
 assert not re.search(r'^\s*#{2,3}\s',text,re.M)
 for page in r.pages:
  assert abs(float(page.mediabox.width)-595.276)<1 and abs(float(page.mediabox.height)-841.89)<1
  assert len((page.extract_text()or'').split())>60
 remote=internal=web=0
 for page in r.pages:
  for ref in page.get('/Annots',[]):
   annotation=ref.get_object()
   if '/Dest' in annotation:
    dest=annotation['/Dest'];assert not isinstance(dest,str)or str(dest)in r.named_destinations;internal+=1;continue
   a=annotation.get('/A')
   if not a:continue
   if a.get('/S')=='/GoToR':
    f=str(a['/F']);assert f in readers;dest=a['/D'];assert not isinstance(dest,str)or str(dest)in readers[f].named_destinations;remote+=1
   elif a.get('/S')=='/GoTo':
    dest=a['/D'];assert not isinstance(dest,str)or str(dest)in r.named_destinations;internal+=1
   elif a.get('/S')=='/URI':assert str(a.get('/URI','')).startswith('https://');web+=1
   else:raise AssertionError('Type de lien inattendu')
 # Bords de page : vérifier le texte PDF, en plus du contrôle visuel des PNG.
 xml=subprocess.check_output(['pdftotext','-bbox',str(path),'-'])
 root=etree.fromstring(xml);ns={'h':'http://www.w3.org/1999/xhtml'}
 words=root.xpath('//h:word',namespaces=ns)
 for w in words:
  assert float(w.get('xMin'))>=25 and float(w.get('xMax'))<=571
  assert float(w.get('yMin'))>=15 and float(w.get('yMax'))<=829
 tree=html.parse(HERE/(d['name']+'.html'))
 images=tree.xpath('//figure//img');png=[im for im in images if im.get('src','').endswith('.png')]
 for im in images:assert im.get('alt') and (HERE/im.get('src')).is_file()
 for p in d['layout']:
  assert len({c['id']for c in p['captures']})<=2
 counts[d['name']]=len(png)
 if d['name']=='VOTI_GUIDE':
  assert all(f'P{i:02}'in text for i in range(1,37));assert all(f'p{i:02}'in r.named_destinations for i in range(1,37))
 if 'DEPANNAGE' in d['name']:
  items=tree.xpath('//article[contains(@class,"troubleshoot-card")]');assert len(items)==20
  raw=subprocess.check_output(['pandoc','--from=markdown+raw_html','--to=html5','--wrap=none'],input=normalise_source((HERE.parent/d['source']).read_text(),'help').encode()).decode()
  source=html.fragment_fromstring(raw,create_parent='main')
  words=lambda value:Counter(re.findall(r'\w+',value.lower()))
  labels=re.compile(r'Vérifie\s*:|À faire\s*:|Si ça bloque(?: encore)?\s*:',re.I)
  for h in source.xpath('.//h3'):
   original=h.text_content()
   nxt=h.getnext()
   while nxt is not None and nxt.tag not in ['h2','h3']:
    if nxt.tag!='blockquote':original+=' '+nxt.text_content()
    nxt=nxt.getnext()
   card=next(item for item in items if item.find('h3').text_content()==h.text_content())
   assert not (words(labels.sub('',original))-words(labels.sub('',card.text_content()))), 'Texte de fiche absent : '+h.text_content()
  nav=tree.xpath('//nav[@class="help-index"]//a');assert len(nav)==7
  assert all(a.get('href')[1:]in r.named_destinations for a in nav)
  assert len(tree.xpath('//blockquote[@class="sensitive-actions"]/p[strong]'))==5
  assert len(tree.xpath('//section[@class="help-final"]/ol/li'))==5
  expected=Counter(a.get('href').replace('.md','.pdf')for a in source.xpath('.//a[@href]'))
  actual=Counter(a.get('href')for a in tree.xpath('//a[@href]'))
  assert not (expected-actual), 'Renvoi D3 absent du montage'
  for item in items:
   assert all(item.xpath('./div[contains(@class,"'+cls+'")]') for cls in ['trouble-check','trouble-action','trouble-help'])
   title=item.find('h3').text_content()
   assert sum(' '.join(title.split()) in ' '.join((page.extract_text()or'').split()) for page in r.pages)==1
 if 'DEMARRAGE' in d['name']:
  assert len(tree.xpath('//article[@class="role-card"]'))==3
  assert len(tree.xpath('//div[@class="step-card"]'))==4
  assert len(tree.xpath('//div[contains(@class,"participant-phase-")]'))==3
  assert len(tree.xpath('//div[@class="status-card"]'))==2
  assert 'choisis « Participant suivant »' in ' '.join(text.split())
  page4=r.pages[3].extract_text();assert 'Participer avec ma Carte Voti'in page4;assert all(re.search(r'^'+str(i)+r'[.]\s*$',page4,re.M)for i in range(1,8));assert 'Accueil'in page4
 results.append({'document':path.name,'pages':len(r.pages),'texteSelectionnable':True,'A4':True,'margesTexte':True,'liensInternes':internal,'renvoisPDFRelatifs':remote,'liensWeb':web,'captures':len(png)})
for i in range(1,5):etree.parse(HERE/f'diagrams/S{i}.svg')
print(json.dumps({'status':'PASS','documents':results,'schemasSVG':4,'source':'Contrôles automatiques ; inspection visuelle distincte requise.'},ensure_ascii=False,indent=2))
