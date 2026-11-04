"""Package sources and the public SQL CA; never credentials or operational data."""
import json, subprocess, tarfile, hashlib
from pathlib import Path
root=Path(__file__).resolve().parent.parent
source=set(p for p in subprocess.check_output(['git','ls-files'],cwd=root,text=True).splitlines()
           if p.startswith(('src/','public/','pilot-local/')) or p in ('package.json','package-lock.json'))
for p in (root/'production').iterdir():
    if p.is_file() and (p.suffix in ('.mjs','.sh','.yaml','.service','.timer','.py') or p.name=='Dockerfile'):
        source.add(p.relative_to(root).as_posix())
private=root/'secrets/chapa-production'
archive=private/'release.tar.gz'
with tarfile.open(archive,'w:gz') as tar:
    for name in sorted(source):
        tar.add(root/name,arcname=name)
    tar.add(private/'chapa-ca.crt',arcname='production/certs/chapa-ca.crt')
receipt={'revision':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),
         'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),
         'files':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in sorted(source)}}
(private/'release-receipt.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
print(json.dumps({'archive':str(archive),'sha256':receipt['archiveSha256'],'sourceFiles':len(source)}))
