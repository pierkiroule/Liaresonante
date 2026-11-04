"""Reproducible source + production archive, without node_modules or local data."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED, ZipInfo

root = Path(__file__).resolve().parents[1]
excluded = {'.git','node_modules','release','coverage','.openai','exports','__pycache__'}
output = root/'release'/'ECHO-local-GitHub.zip'
if not (root/'dist'/'index.html').is_file():
    raise SystemExit('Run npm run build before packaging.')
output.parent.mkdir(exist_ok=True)
count=0
with ZipFile(output,'w',ZIP_DEFLATED,compresslevel=9) as archive:
    for file in sorted(root.rglob('*')):
        parts=file.relative_to(root).parts
        if not file.is_file() or any(part in excluded for part in parts): continue
        if file.suffix=='.tsbuildinfo' or file.name.startswith('.env'): continue
        info=ZipInfo('echo/'+file.relative_to(root).as_posix(),date_time=(2026,11,4,0,0,0))
        info.compress_type=ZIP_DEFLATED
        info.external_attr=0o100644 << 16
        archive.writestr(info,file.read_bytes(),compresslevel=9)
        count+=1
print(f'{output} ({count} files, {output.stat().st_size:,} bytes)')
