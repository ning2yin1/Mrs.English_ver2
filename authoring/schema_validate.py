import pathlib,json,sys
HERE=pathlib.Path(__file__).resolve().parent
if (HERE/'qa-vendor').exists():sys.path.insert(0,str(HERE/'qa-vendor'))
from jsonschema import Draft202012Validator
from referencing import Registry,Resource
R=HERE.parent;K=R if R.name=='Mrs-English-Production-Kit' else R/'Mrs-English-Production-Kit';Q=K/'questions';S=Q/'schemas'
reg=Registry()
for f in S.glob('*.schema.json'):
 schema=json.loads(f.read_text(encoding='utf8'));resource=Resource.from_contents(schema)
 reg=reg.with_resource('https://mrs-english.local/schemas/'+f.name,resource)
reg=reg.with_resource('https://mrs-english.local/schemas/examples.schema.json',Resource.from_contents(json.loads((S/'examples.schema.json').read_text(encoding='utf8'))))
report=[]
for filename,schemafile in [('examples.json','examples.schema.json'),('questions.json','questions.schema.json'),('curriculum.json','curriculum.schema.json'),('tts-manifest.json','tts.schema.json')]:
 data=json.loads((Q/filename).read_text(encoding='utf8'));schema=json.loads((S/schemafile).read_text(encoding='utf8'))
 Draft202012Validator.check_schema(schema)
 errors=list(Draft202012Validator(schema,registry=reg).iter_errors(data))
 report.append({'file':filename,'items':len(data),'errors':[{'path':list(e.path),'message':e.message} for e in errors]})
(K/'qa/schema-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps([{'file':r['file'],'errors':len(r['errors'])} for r in report]))
sys.exit(any(r['errors'] for r in report))
