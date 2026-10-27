import pathlib,json,re,collections,math,hashlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1];K=ROOT if ROOT.name=='Mrs-English-Production-Kit' else ROOT/'Mrs-English-Production-Kit';Q=K/'questions'
def load(p):return json.loads((K/p).read_text(encoding='utf-8-sig'))
examples=load('questions/examples.json');questions=load('questions/questions.json');curriculum=load('questions/curriculum.json');tts=load('questions/tts-manifest.json');cards=load('assets/catalogs/cards.json');bgs=load('assets/catalogs/backgrounds.json');inv=load('assets/catalogs/assets-inventory.json')
checks=[];errors=[];missing=collections.Counter()
def check(condition,label):
 checks.append(label)
 if not condition:errors.append(label)
check(len(examples)==600,'600 examples');check(len(questions)==1800,'1800 questions');check(len(curriculum)==60,'60 grammar lessons');check(len(tts)==600,'600 TTS rows')
check(len({x['id'] for x in examples})==600,'unique example IDs');check(len({x['english'] for x in examples})==600,'600 distinct English sentences');check(len({x['id'] for x in questions})==1800,'unique question IDs')
check(collections.Counter(x['grammarId'] for x in examples)=={g['id']:10 for g in curriculum},'each grammar exactly ten')
emap={x['id']:x for x in examples};tmap={x['id']:x for x in tts}
for e in examples:
 eid=e['id'];s=e['english'];focus=e['grammarFocus'];easy=e['easy'];normal=e['normal'];hard=e['hard']
 check(bool(e['translationJa'] and e['sentenceExplanationJa'] and e['glossary']),eid+' editorial fields')
 check(s[focus['start']:focus['endExclusive']]==focus['text'],eid+' focus offsets')
 check(easy['prompt'].replace('___',easy['blank']['answer'])==s,eid+' blank round trip')
 check(len(easy['options'])==4 and len({o['text'] for o in easy['options']})==4,eid+' four distinct options')
 check(sum(o['isCorrect'] for o in easy['options'])==1,eid+' single declared correct option')
 check(next(o['text'] for o in easy['options'] if o['id']==easy['correctOptionId'])==focus['text'],eid+' correct choice')
 for d in ['normal','hard']:
  data=e[d];blocks={b['id']:b['text'] for b in data['blocks']};order=data['correctOrder']
  check(len(blocks)==len(data['blocks']),eid+d+' unique blocks')
  check(' '.join(blocks[b] for b in order)==s,eid+d+' answer reconstructs English')
  check(len(order)==len(set(order)),eid+d+' each block at most once')
  check(all(b in blocks for a in data['acceptedOrders'] for b in a),eid+d+' valid accepted IDs')
 check(normal['correctOrder']==hard['correctOrder'],eid+' same canonical blocks across normal and hard')
 check(len(hard['distractorBlocks'])>=5,eid+' five or more hard distractors')
 correcttext={b['text'].strip('.,?!').lower() for b in normal['blocks']}
 check(not any(b['text'].strip('.,?!').lower() in correcttext for b in hard['distractorBlocks']),eid+' no hard decoy identical to required block')
 check(tmap[e['audio']['id']]['text']==s,eid+' TTS equals canonical')
 covered={x['expression'].lower() for x in e['glossary'] if x['kind']=='word'}
 for tok in re.findall(r"[A-Za-z]+(?:[-'][A-Za-z]+)*|\d+",s):
  if tok.lower() not in covered:missing[tok.lower()]+=1
for q in questions:
 e=emap[q['exampleId']];check(q['canonicalEnglish']==e['english'],q['id']+' shared sentence');check(q['translationJa']==e['translationJa'],q['id']+' shared translation')
 basis=len(re.findall(r"[A-Za-z]+(?:[-'][A-Za-z]+)*|\d+",e['english'])) if q['difficulty']=='EASY' else len(e['normal']['blocks'])
 sec=10 if basis<=4 else 15 if basis<=6 else 20 if basis<=8 else 25 if basis<=10 else 30
 check(q['timeBasis']==basis and q['baseTimeSeconds']==sec,q['id']+' correct timer basis')
check(len(inv)==122,'122 original images');check(len(cards)==79,'79 cards');check(len(bgs)==22,'22 home/play backgrounds')
for a in inv:
 p=K/a['path'];check(p.exists() and hashlib.sha256(p.read_bytes()).hexdigest()==a['sha256'],a['assetId']+' original hash')
 check(a['width']>0 and a['height']>0,a['assetId']+' image dimensions')
for c in cards:check((K/c['photoPath']).exists() and (K/c['framePath']).exists(),c['id']+' photo/frame link')
check(all(any(c['memberId']==m and c['rank']==r for c in cards) for m in ['motoki','hiroto','ryoka'] for r in 'CBASR'),'all member/rank pools nonempty')
def rnd(x):return math.floor(x+.5)
def score(ok,t,T):return (700+rnd(300*max(0,T-max(0,t))/T)) if ok else 0
def judge(ok,t,T):
 if not ok:return 'MISS'
 fraction=max(0,1-max(0,t)/T)
 return 'SUPER PERFECT' if fraction>=.8 else 'PERFECT' if fraction>=.4 else 'GOOD'
vectors=[(True,0,10,1000,'SUPER PERFECT'),(True,2,10,940,'SUPER PERFECT'),(True,2.001,10,940,'PERFECT'),(True,6,10,820,'PERFECT'),(True,6.001,10,820,'GOOD'),(True,10,10,700,'GOOD'),(True,50,10,700,'GOOD'),(False,0,10,0,'MISS')]
for ok,t,T,expected,j in vectors:check(score(ok,t,T)==expected and judge(ok,t,T)==j,'score boundary '+str((ok,t,T)))
star=lambda n:3 if n==10 else 2 if n>=8 else 1 if n>=6 else 0
check([star(x) for x in range(11)]==[0,0,0,0,0,0,1,1,2,2,3],'all eleven star boundaries')
pay=[0,100,300,600]
check(pay[3]-pay[1]==500 and pay[2]-pay[0]==300 and pay[3]-pay[2]==300,'star differences')
check(90+50+pay[2]==440,'nine correct first two-star reward')
rules=load('docs/game-rules.json')
for rank,v in rules['ranks'].items():
 check(v['maxBonus']*(1-1)/(v['maxLevel']-1)==0,rank+' Lv1=0')
 check(v['maxBonus']*(v['maxLevel']-1)/(v['maxLevel']-1)==v['maxBonus'],rank+' max level bonus')
check(rnd(10000*(1+.8))==18000,'max TOTAL 18000');check(sum(rules['rankWeights'].values())==100,'rank weights sum 100')
save={'checkedAt':'2026-10-27','checks':len(checks),'failed':len(errors),'errors':errors,'counts':{'grammars':len(curriculum),'examples':len(examples),'questions':len(questions),'ttsRows':len(tts),'originalAssets':len(inv),'cards':len(cards),'backgrounds':len(bgs)},'uncoveredVocabulary':dict(missing),'scope':'Structure, exact answer reconstruction, declared option uniqueness, timers, asset hashes and score/reward boundary vectors. This is not an automated proof of natural-language meaning or every possible alternative English sentence.'}
(K/'qa/validation-report.json').write_text(json.dumps(save,ensure_ascii=False,indent=2),encoding='utf8')
(K/'qa/test-vectors.json').write_text(json.dumps({'score':vectors,'starCorrectCounts':[{'correct':n,'stars':star(n)} for n in range(11)],'starRewardMatrix':[{'previous':a,'new':b,'difference':max(0,pay[b]-pay[a])} for a in range(4) for b in range(a,4)]},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'checks':len(checks),'errors':errors[:20],'uncoveredVocabulary':dict(missing)},ensure_ascii=False))
sys.exit(bool(errors or missing))
