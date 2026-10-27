"""Run kit generation and QA without altering the input kit."""
from pathlib import Path
import shutil, subprocess, sys, tempfile
root=Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='mrs-english-data-') as tmp:
    kit=Path(tmp)/'Mrs-English-Production-Kit'
    kit.mkdir()
    for name in ['authoring','questions','docs','qa','assets']:
        shutil.copytree(root/name,kit/name,ignore=shutil.ignore_patterns('__pycache__'))
    for name in ['validate_kit.py','schema_validate.py','build_questions.py','make_schemas.py','validate_kit.py','schema_validate.py']:
        print('Run',name,flush=True)
        subprocess.run([sys.executable,'authoring/'+name],cwd=kit,check=True)
