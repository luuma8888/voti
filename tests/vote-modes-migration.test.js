import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {createPoll} from '../shared/poll-engine.js';
import {emptyState} from '../shared/model.js';
test('Migration 0006 : ancienne définition et bulletin Single préservés, ancien INSERT compatible',()=>{
 const poll=createPoll(emptyState(),{question:'Historique fictif',choices:['Oui','Non']}).polls[0];delete poll.definition.mode;
 execFileSync('python3',['-c',`
import sqlite3,json,pathlib,sys
p=json.loads(sys.stdin.read()); db=sqlite3.connect(':memory:')
for f in sorted(pathlib.Path('relay/cloudflare/migrations').glob('*.sql')):
 if f.name.startswith('0006'):break
 db.executescript(f.read_text())
db.execute("INSERT INTO polls(poll_id,status,definition,style,access_rules,result_rules,semantic_hash,capability_hash,created_at) VALUES(?,'published',?,?,?,?,?,?,1)",(p['id'],json.dumps(p['definition']),json.dumps(p['style']),json.dumps(p['accessRules']),json.dumps(p['resultRules']),'a'*64,'b'*64))
c=p['definition']['choices'][0]['id']
db.execute('INSERT INTO ballots(poll_id,action_id,choice_id) VALUES(?,?,?)',(p['id'],'action-fictive',c))
before=db.execute('SELECT * FROM polls').fetchall();ballots=db.execute('SELECT * FROM ballots').fetchall()
db.executescript(pathlib.Path('relay/cloudflare/migrations/0006_vote_modes.sql').read_text())
assert db.execute('SELECT * FROM polls').fetchall()==before
assert [r[:-1] for r in db.execute('SELECT * FROM ballots')]==ballots
assert all(r[-1] is None for r in db.execute('SELECT * FROM ballots'))
db.execute('INSERT INTO ballots(poll_id,action_id,choice_id) VALUES(?,?,?)',(p['id'],'autre-action-fictive',c))
try:
 db.execute('INSERT INTO ballots(poll_id,action_id,choice_id,selection_json) VALUES(?,?,?,?)',(p['id'],'refuse-fictif',c,json.dumps([c])))
 raise AssertionError('Single doit refuser le nouveau bulletin')
except sqlite3.IntegrityError:pass
`],{input:JSON.stringify(poll),stdio:['pipe','pipe','pipe']});
});
