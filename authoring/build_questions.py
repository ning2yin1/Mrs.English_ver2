import pathlib,re,json,random,hashlib,collections,math,shutil
SOURCE=pathlib.Path(__file__).resolve().parent
ROOT=SOURCE.parent; KIT=ROOT if ROOT.name=='Mrs-English-Production-Kit' else ROOT/'Mrs-English-Production-Kit'; Q=KIT/'questions'
def save(path,x):
 path=pathlib.Path(path);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
verbs={}
for row in '''listen listens listened listening
practice practices practiced practicing
sing sings sang singing
keep keeps kept keeping
laugh laughs laughed laughing
share shares shared sharing
buy buys bought buying
read reads read reading
love loves loved loving
save saves saved saving
walk walks walked walking
like likes liked liking
play plays played playing
watch watches watched watching
study studies studied studying
sell sells sold selling
go goes went going
know knows knew knowing
carry carries carried carrying
need needs needed needing
start starts started starting
call calls called calling
dance dances danced dancing
wait waits waited waiting
open opens opened opening
enjoy enjoys enjoyed enjoying
see sees saw seeing
lose loses lost losing
find finds found finding
take takes took taking
meet meets met meeting
give gives gave giving
eat eats ate eating
charge charges charged charging
get gets got getting
join joins joined joining
learn learns learned learning
leave leaves left leaving
hear hears heard hearing
reach reaches reached reaching
review reviews reviewed reviewing
wave waves waved waving
write writes wrote writing
drink drinks drank drinking
sit sits sat sitting
spend spends spent spending
talk talks talked talking
tell tells told telling
visit visits visited visiting
collect collects collected collecting
help helps helped helping
come comes came coming
remember remembers remembered remembering
stand stands stood standing
be is was being
win wins won winning
rain rains rained raining
want wants wanted wanting
agree agrees agreed agreeing
have has had having
sleep sleeps slept sleeping
make makes made making
build builds built building
love loves loved loving'''.splitlines():
 forms=row.split();
 for form in forms: verbs[form]=forms
pronouns={'my':['I','me','mine'],'your':['you','yours','yourself'],'his':['he','him','himself'],'her':['she','hers','herself'],'our':['we','us','ours'],'mine':['my','me','I'],'yours':['your','you','yourself'],'hers':['her','she','herself'],'ours':['our','we','us'],'theirs':['their','they','them'],'me':['I','my','mine'],'him':['he','his','himself'],'us':['we','our','ours'],'them':['they','their','theirs'],'it':['its','itself','they']}
comparatives={'bigger':('big','biggest','more big'),'cheaper':('cheap','cheapest','cheaply'),'taller':('tall','tallest','more tall'),'longer':('long','longest','more long'),'hotter':('hot','hottest','more hot'),'better':('good','best','well'),'farther':('far','farthest','more far'),'softer':('soft','softest','softly'),'heavier':('heavy','heaviest','heavily'),'more interesting':('interesting','most interesting','interestingly')}
superlatives={'biggest':('big','bigger','most big'),'cheapest':('cheap','cheaper','cheaply'),'tallest':('tall','taller','most tall'),'longest':('long','longer','most long'),'hottest':('hot','hotter','most hot'),'best':('good','better','well'),'smallest':('small','smaller','most small'),'most exciting':('exciting','more exciting','excitingly'),'youngest':('young','younger','most young'),'most beautiful':('beautiful','more beautiful','beautifully')}
indirect={
'the hall is':['is the hall','does the hall is','the hall be'],
'the show starts':['does the show start','the show start','is the show starts'],
'this word means':['does this word mean','this word mean','is this word means'],
'she is crying':['is she crying','she are crying','does she crying'],
'I lived':['did I live','I living','I lives'],
'we first met':['did we first meet','we first meeting','we first meets'],
'you got the ticket':['did you get the ticket','you getting the ticket','you gets the ticket'],
'train we need':['train do we need','train we needs','train are we need'],
'bag this is':['bag is this','bag this are','bag does this is'],
'he has':['does he have','he have','is he has']}
adjs={'beautiful':['beautifully','beauty','beauties'],'happy':['happily','happiness','be happy'],'sleepy':['sleepily','sleepiness','be sleepy'],'good':['well','goodness','goods'],'famous':['famously','fame','be famous'],'soft':['softly','softness','be soft'],'nice':['nicely','niceness','be nice'],'tired':['tiredly','tiredness','be tired'],'quiet':['quietly','quietness','be quiet'],'interesting':['interestingly','interest','be interesting'],'clean':['cleanly','cleanliness','be clean'],'open':['openly','openness','be open'],'sad':['sadly','sadness','be sad'],'safe':['safely','safety','be safe']}
special={
'Please':['Pleases','Pleased','Pleasing'],'Do not':['Does not','Did not to','Not to'],'Let us':['Lets us','Let we','Let our'],
'Did':['Does','Do','Was'],'did not':['did not to','does not','was not'],
'must':['must to','must be','must have'],'must not':['must not to','must not be','must not have'],
'have to':['has to','have','having to'],'has to':['have to','has','haves to'],
'do not have to':['does not have to','do not has to','do not to have'],
'should':['should to','should be','should have'],'may':['may to','may be','may have'],
'Could you':['Could you to','Could you be','Could you have'],'Would you':['Would you to','Would you be','Would you have'],
'can':['can to','can be','can have'],'cannot':['can','cannot to','cannot be'],'Can':['Can to','Can be','Can have'],
'Apple':['an Apple','Apple\'s','to Apple'],
'too':['enough','to','two'],'enough':['too','very','much'],
'had':['have','has','having'],'could':['can','could to','could be'],'would':['will','would to','would be'],'were':['are','is','be'],
'for':['since','during','until'],'since':['for','during','until']}
adjbase={'big':('bigger','biggest','more big'),'bright':('brighter','brightest','brightly'),'excited':('more excited','most excited','excitedly'),'fast':('faster','fastest','more fast'),'good':('better','best','well'),'heavy':('heavier','heaviest','heavily'),'long':('longer','longest','more long'),'new':('newer','newest','newly'),'soft':('softer','softest','softly'),'well':('better','best','more well')}
participles={'singing':['sung','sings','sing'],'taken':['taking','took','takes'],'playing':['played','plays','play'],'loved':['loving','loves','love'],'waiting':['waited','waits','wait'],'written':['writing','wrote','writes'],'sleeping':['slept','sleeps','sleep'],'made':['making','makes','make'],'carrying':['carried','carries','carry'],'found':['finding','finds','find']}
def wrongs(g,target,mode,pool):
 if mode not in ['AUTO','VERB','VERBS','PAST']:
  return [x for x in pool.split('~') if x!=target][:3]
 if mode in ['VERB','VERBS','PAST']:
  f=verbs[target];return list(dict.fromkeys(x for x in f+['to '+f[0]] if x!=target))[:3]
 n=int(g)
 if n in [5,6,38]: return pronouns[target]
 if n in [18,19,25,29,30,49,59]: return special[target]
 if n==31:return list(comparatives[target])
 if n==32:return list(superlatives[target])
 if n==33:return list(adjbase[target])
 if n in [34,35,36,47]:
  tail=target[3:];v,*rest=tail.split();f=verbs.get(v,[v,v+'s',v+'ed',v+'ing']);end=(' '+' '.join(rest)) if rest else ''
  candidates=['to '+f[1]+end,'to '+f[2]+end,f[0]+end,'to '+f[3]+end] if n==36 else [f[3]+end,'to '+f[1]+end,f[0]+end,'to '+f[2]+end]
  return list(dict.fromkeys(x for x in candidates if x!=target))[:3]
 if n==37:
  f=verbs[target];return [f[0],f[1],f[2]]
 if n in [39,40]:
  if target in adjs:return adjs[target]
  if target=='Apple':return special[target]
  f=verbs[target]
  return [f[1],f[2],f[3]]
 if n==43:
  if target=='is':return ['are','am','be']
  f=verbs[target];return [f[1] if target==f[0] else f[0],f[3], 'will '+f[0]]
 if n==45:return indirect[target]
 if n in [56,57]:
  return {'who':['whose','whom','what'],'which':['who','whose','what'],'that':['what','whose','where']}[target]
 if n==58:return participles[target]
 raise ValueError((g,target))
def normalize(s):return re.sub(r'\s+',' ',s).strip()
def read_source():
 groups=[];cur=None
 for path in sorted(SOURCE.glob('lessons-*.txt')):
  for line in path.read_text(encoding='utf8').splitlines():
   if not line:continue
   if line.startswith('@'):
    num,name,grade,rule,pool=line[1:].split('|');cur={'id':'G'+num,'nameJa':name,'suggestedGrade':int(grade),'sequence':int(num),'learningGoalJa':rule,'ruleJa':rule,'pool':pool,'examples':[],'difficultyBand':1 if int(num)<=20 else 2 if int(num)<=40 else 3};groups.append(cur)
   else:
    marked,jp=line.split('|');m=re.search(r'\[([^]]+)\]',marked);assert m
    chunks=[re.sub(r'[\[\]]','',x) for x in marked.split('/')];english=normalize(' '.join(chunks));start=normalize(marked.replace('/',' ')).index('[');target=m.group(1)
    cur['examples'].append({'chunks':chunks,'english':english,'japanese':jp,'focus':target,'start':start})
 return groups
if __name__=='__main__':
 from glossary import glossary_for
 groups=read_source();examples=[];questions=[];tts=[];teacher=[]
 for g in groups:
  num=g['id'][1:];gid=g['id'];local=[]
  for i,row in enumerate(g['examples'],1):
   eid=f'{gid}-E{i:02}';english=row['english'];target=row['focus'];start=row['start'];end=start+len(target)
   bad=wrongs(num,target,g['pool'],g['pool']);assert len(bad)==3 and len(set([target]+bad))==4,(eid,target,bad)
   # A block is an authored phrase. Identical strings are assigned independent IDs.
   blocks=[{'id':f'{eid}-B{j+1:02}','text':s,'role':'required'} for j,s in enumerate(row['chunks'])]
   order=[b['id'] for b in blocks]
   # Apostrophes, punctuation and capitalization are display data; accept text-equivalent IDs for duplicates.
   related=bad.copy();n=int(num)
   extra=['was','were','been','being'] if n<=3 or n in [15,21,22,26,27,50,51] else ['does','did','doing','done'] if n<=30 else ['to','for','since','of','being','been']
   for x in extra:
    if x.lower() not in {b['text'].strip('.,?!').lower() for b in blocks} and x.lower() not in {s.lower() for s in related}:related.append(x)
    if len(related)>=5:break
   assert len(related)>=5
   distractors=[{'id':f'{eid}-D{j+1:02}','text':s,'role':'distractor','reasonJa':'指定された和訳・学習文法と基本語順に一致しない形です。正解部分「'+target+'」と比較してください。'} for j,s in enumerate(related)]
   options=[{'id':f'{eid}-C{j+1}','text':s,'isCorrect':j==0,'explanationJa':('正解。'+g['ruleJa'] if j==0 else 'この和訳と指定の文法では「'+target+'」を使います。「'+s+'」では主語・語形・語順または意味が一致しません。')} for j,s in enumerate([target]+bad)]
   random.Random(eid).shuffle(options)
   orderguide='主語から始まる基本語順で並べてください。疑問文・命令文・感嘆文は学習した型にし、時・場所の語句は指定の末尾順に置きます。関係詞や接続詞は表示されたブロックを使います。'
   explanation=f'「{english}」は「{row["japanese"]}」という意味です。'+g['ruleJa']+f' この文の対象部分は「{target}」。まとまりは '+' → '.join(row['chunks'])+' の順です。'
   ex={'id':eid,'grammarId':gid,'grammarNameJa':g['nameJa'],'english':english,'translationJa':row['japanese'],'fictionalScenario':True,'grammarFocus':{'text':target,'start':start,'endExclusive':end,'explanationJa':g['ruleJa']},'sentenceExplanationJa':explanation,'glossary':glossary_for(english),'easy':{'prompt':english[:start]+'___'+english[end:],'blank':{'start':start,'endExclusive':end,'answer':target},'options':options,'correctOptionId':next(o['id'] for o in options if o['isCorrect'])},'normal':{'blocks':blocks,'correctOrder':order,'acceptedOrders':[order],'instructionJa':orderguide},'hard':{'blocks':blocks+distractors,'distractorBlocks':distractors,'correctOrder':order,'acceptedOrders':[order],'instructionJa':orderguide+' 不要なブロックは残してください。'},'audio':{'id':eid+'-AUDIO','text':english,'lang':'en-US','rate':0.9,'pitch':1.0,'preRecordedPath':None},'review':{'editorialScope':'和訳と指定文法を基準に執筆・見直し。並び替えは提示された句ブロックと基本語順を指定する課題。自由英作文の正誤判定ではない。'}}
   assert ex['glossary'],eid
   examples.append(ex);local.append(ex);tts.append(ex['audio'])
   for difficulty in ['EASY','NORMAL','HARD']:
    wordcount=len(re.findall(r"[A-Za-z]+(?:[-'][A-Za-z]+)*|\d+",english))
    basis=wordcount if difficulty=='EASY' else len(blocks);limit=10 if basis<=4 else 15 if basis<=6 else 20 if basis<=8 else 25 if basis<=10 else 30
    questions.append({'id':eid+'-'+difficulty,'exampleId':eid,'grammarId':gid,'difficulty':difficulty,'canonicalEnglish':english,'translationJa':row['japanese'],'answerExplanationJa':explanation,'ttsId':ex['audio']['id'],'timeBasis':basis,'baseTimeSeconds':limit,'data':ex[difficulty.lower()]})
   teacher.append(f'### {eid}\n\n{english}\n\n{row["japanese"]}\n\n{explanation}\n\nEASY: {ex["easy"]["prompt"]}\n選択肢: '+ ' / '.join(x['text'] for x in options)+f'\n正解: {target}\n\nNORMAL: '+' / '.join(row['chunks'])+'\nHARD不要: '+' / '.join(related)+'\n')
  save(Q/'by-grammar'/f'{gid}.json',{'grammarId':gid,'examples':local})
 curriculum=[]
 for g in groups:
  curriculum.append({k:v for k,v in g.items() if k not in ['examples','pool']}|{'exampleIds':[f'{g["id"]}-E{x:02}' for x in range(1,11)],'unlockedAtStart':True})
 save(Q/'curriculum.json',curriculum);save(Q/'examples.json',examples);save(Q/'questions.json',questions);save(Q/'tts-manifest.json',tts)
 (Q/'教材全600例文.md').write_text('# 600例文・問題の教員用一覧\n\nすべて学習用の創作場面です。実在人物の出来事の記録ではありません。\n\n'+'\n'.join(teacher),encoding='utf8')
 rows=['# 文法60項目\n\n学年は学習順の目安であり、特定の教科書の配当を示しません。\n','|ID|文法|目安学年|学習目標|','|---|---|---|---|']
 rows += [f'|{g["id"]}|{g["nameJa"]}|中{g["suggestedGrade"]}|{g["learningGoalJa"]}|' for g in groups]
 (KIT/'docs/02-文法60項目.md').write_text('\n'.join(rows),encoding='utf8')
 print(json.dumps({'grammars':len(groups),'examples':len(examples),'questions':len(questions)},ensure_ascii=False))
