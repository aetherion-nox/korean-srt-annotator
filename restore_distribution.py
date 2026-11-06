from pathlib import Path
import hashlib,io,urllib.request,zipfile
ROOT=Path(__file__).resolve().parent
URL='https://github.com/aetherion-nox/korean-srt-annotator/releases/download/v1.0.24/Korean-SRT-Annotator-v1.0.24.zip'
EXPECTED='7653e358722f73ba11276ae4ae132e9671b871fd15129b10b9c60ca934c5a74b'
print('Downloading verified bundled runtime...')
data=urllib.request.urlopen(URL,timeout=180).read()
if hashlib.sha256(data).hexdigest()!=EXPECTED:raise SystemExit('Archive checksum mismatch')
with zipfile.ZipFile(io.BytesIO(data)) as archive:
 for name in archive.namelist():
  parts=Path(name).parts[1:]
  if not parts or parts[0] not in {'runtime','icons'} or '..' in parts or name.endswith('/'):continue
  target=ROOT.joinpath(*parts);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.read(name))
print('Runtime restored. Load this folder as an unpacked extension.')
