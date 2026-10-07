"""Verify a ProcureFlow delivery manifest without publishing anything."""
from pathlib import Path
from zipfile import ZipFile
import argparse, hashlib, json, re, struct
from pypdf import PdfReader

def atoms(path):
    result=[]
    with path.open('rb') as f:
        total=path.stat().st_size
        while f.tell()<total:
            position=f.tell(); head=f.read(8)
            assert len(head)==8,'Truncated MP4 atom'
            size,kind=struct.unpack('>I4s',head)
            if size==1:size=struct.unpack('>Q',f.read(8))[0]
            if size==0:size=total-position
            assert size>=8 and position+size<=total,'Invalid MP4 atom'
            result.append(kind.decode('ascii'));f.seek(position+size)
    return result
def milliseconds(s):
    h,m,sec,ms=map(int,re.split('[:,]',s));return ((h*60+m)*60+sec)*1000+ms
def main():
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);args=p.parse_args()
    root=args.root.resolve(); manifest=json.loads((root/'delivery-manifest.json').read_text(encoding='utf-8'))
    assert manifest['release_state'] in ('HELD','RELEASED')
    kinds=set()
    for entry in manifest['files']:
        file=(root/entry['file']).resolve()
        assert file.is_relative_to(root),'File outside package'
        assert file.stat().st_size==entry['bytes'],entry['file']+' size mismatch'
        assert hashlib.sha256(file.read_bytes()).hexdigest()==entry['sha256'],entry['file']+' hash mismatch'
        kinds.add(file.suffix.lower())
        if file.suffix=='.pdf':
            doc=PdfReader(file)
            assert len(doc.pages)==manifest['guide_pages'],'Page count mismatch'
            assert all(page.extract_text().strip() for page in doc.pages),'Empty PDF page'
        if file.suffix=='.docx':
            with ZipFile(file) as z:
                assert z.testzip() is None
                assert 'word/document.xml' in z.namelist()
        if file.suffix=='.mp4':
            a=atoms(file);assert 'ftyp' in a and a.index('moov')<a.index('mdat'),'MP4 lacks faststart'
        if file.suffix=='.srt':
            cues=re.findall(r'(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})',file.read_text(encoding='utf-8-sig'))
            assert len(cues)==manifest['video']['captions']
            last=0
            for start,end in cues:
                start,end=milliseconds(start),milliseconds(end)
                assert start>=last and end>start,'Invalid/overlapping caption'
                assert end<=1000*(manifest['video']['duration_seconds']+.5)
                last=end
    assert {'.pdf','.docx','.mp4','.srt','.jpg','.txt'}<=kinds,'Missing deliverable type'
    assert manifest['qa']['all_guide_pages_reviewed'] and manifest['qa']['all_video_scenes_reviewed']
    print(json.dumps({'status':'passed','files':len(manifest['files']),'release_state':manifest['release_state'],'pages':manifest['guide_pages']}))
if __name__=='__main__':main()
