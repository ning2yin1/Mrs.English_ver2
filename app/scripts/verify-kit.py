"""Verify original kit bytes, accepting only the proven Git CRLF→LF conversion."""
from pathlib import Path
import hashlib, json
root=Path(__file__).resolve().parents[2]
exact=[]; normalized=[]; errors=[]
for row in (root/'MANIFEST.sha256').read_text().splitlines():
    expected, name=row.split('  ',1); p=root/name
    if not p.is_file(): errors.append({'file':name,'reason':'missing'}); continue
    data=p.read_bytes()
    if hashlib.sha256(data).hexdigest()==expected: exact.append(name)
    elif b'\0' not in data and hashlib.sha256(data.replace(b'\r\n',b'\n').replace(b'\n',b'\r\n')).hexdigest()==expected: normalized.append(name)
    else: errors.append({'file':name,'reason':'content mismatch'})
print(json.dumps({'exact':len(exact),'gitLineEndingOnly':len(normalized),'errors':errors},ensure_ascii=False))
raise SystemExit(bool(errors))
