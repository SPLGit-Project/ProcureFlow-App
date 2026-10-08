from pathlib import Path
import sys,json,re,difflib,os,subprocess,hashlib,wave
ROOT=Path(__file__).parent
AUDITION=Path('C:/Github/ProcureFlow-App/output/video/voice-audition')
sys.path.insert(0,str(AUDITION/'asr-deps'))
os.environ['HF_HUB_DISABLE_XET']='1'
from faster_whisper import WhisperModel
import numpy as np
sys.path.insert(0,str(Path('C:/Github/ProcureFlow-App/output/video/supplier-stock/work/deps')))
import imageio_ffmpeg
FEATURES=[('.', 'ProcureFlow_Supplier_Pack_Quantities_Explainer')]
FF=imageio_ffmpeg.get_ffmpeg_exe()

def num(n):
    small='zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
    tens='zero ten twenty thirty forty fifty sixty seventy eighty ninety'.split()
    if n<20:return small[n]
    if n<100:return tens[n//10]+(' '+small[n%10] if n%10 else '')
    if n<1000:return small[n//100]+' hundred'+(' '+num(n%100) if n%100 else '')
    if n<1000000:return num(n//1000)+' thousand'+(' '+num(n%1000) if n%1000 else '')
    return str(n)

def tokens(s):
    s=s.lower().replace('hspg02','h s p g zero two').replace('procureflow','procure flow').replace('conquer','concur').replace('t lc','t l c')
    s=re.sub(r'\btlc\s*(?:25|twenty-five)\b','t l c twenty five',s)
    for a,b in [('ncc','n c c'),('po','p o'),('pos','p os'),('pr','p r')]:s=re.sub(r'\b'+a+r'\b',b,s)
    s=re.sub(r'\d[\d,]*',lambda m:num(int(m[0].replace(',',''))),s)
    return re.findall(r"[a-z0-9]+(?:'[a-z]+)?",s)

def chunks(text):
    out=[];current=[]
    for word in text.split():
        current.append(word)
        if len(current)>=12 or (len(current)>=6 and word[-1] in '.?!;:'):
            out.append(' '.join(current));current=[]
    if current:out.append(' '.join(current))
    return out

model=None
selected=[x for x in FEATURES if len(sys.argv)==1 or x[0] in sys.argv[1:]]
for folder,stem in selected:
    path=ROOT/folder;story=json.loads((path/'storyboard.json').read_text());narration=[];reports=[]
    for pair in range(4):
        audio=path/f'pair_{pair}.wav'
        if not audio.is_file():
            if '--available' in sys.argv:break
            raise FileNotFoundError(audio)
        sha=hashlib.sha256(audio.read_bytes()).hexdigest()
        reportfile=path/f'pair_{pair}_speech_check.json'
        if reportfile.is_file() and json.loads(reportfile.read_text()).get('audio_sha256')==sha:
            report=json.loads(reportfile.read_text())
        else:
            if model is None:model=WhisperModel('base.en',device='cpu',compute_type='int8',download_root=str(AUDITION/'asr-model'),cpu_threads=4)
            pcm=subprocess.run([FF,'-v','error','-i',str(audio),'-ar','16000','-ac','1','-f','f32le','-'],capture_output=True,check=True).stdout
            segments,info=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='en',beam_size=5,word_timestamps=True)
            words=[];segments=list(segments)
            for seg in segments:
                for w in seg.words:
                    for token in tokens(w.word):words.append({'word':token,'start':w.start,'end':w.end})
            expected=[t for s in story[pair*2:pair*2+2] for t in tokens(s['narration'])]
            heard=[w['word'] for w in words]
            matching=difflib.SequenceMatcher(None,expected,heard,autojunk=False)
            diffs=[{'type':op,'expected':expected[a:b],'recognised':heard[c:d]} for op,a,b,c,d in matching.get_opcodes() if op!='equal']
            report={'audio_sha256':sha,'recogniser':'faster-whisper base.en CPU int8','expected':' '.join(s['narration'] for s in story[pair*2:pair*2+2]),'recognised':' '.join(s.text.strip() for s in segments),'matching_ratio':matching.ratio(),'differences':diffs,'words':words,'duration':len(pcm)/4/16000}
            reportfile.write_text(json.dumps(report,indent=2),encoding='utf-8')
        reports.append(report)
        print(f"{folder}: pair {pair+1} transcription match {report['matching_ratio']:.3f}",flush=True)
        if report['matching_ratio']<.86:raise RuntimeError('Narration needs content review: '+str(reportfile))
        expected=[t for s in story[pair*2:pair*2+2] for t in tokens(s['narration'])]
        heard=[w['word'] for w in report['words']];words=report['words']
        alignment={}
        for a,b,n in difflib.SequenceMatcher(None,expected,heard,autojunk=False).get_matching_blocks():
            for k in range(n):alignment[a+k]=(words[b+k]['start'],words[b+k]['end'])
        for i in range(len(expected)):
            if i in alignment:continue
            lo=max((k for k in alignment if k<i),default=-1);hi=min((k for k in alignment if k>i),default=len(expected))
            start=alignment[lo][1] if lo>=0 else 0
            end=alignment[hi][0] if hi<len(expected) else report['duration']
            span=max(0,end-start);n=hi-lo-1
            alignment[i]=(start+span*(i-lo-1)/n,start+span*(i-lo)/n)
        split=len(tokens(story[pair*2]['narration']))
        cut=(alignment[split-1][1]+alignment[split][0])/2
        assert alignment[split][0]>=alignment[split-1][1]-.05,(folder,pair,'scene boundary overlaps')
        limits=[0,cut,report['duration']]
        cursor=0
        for j,s in enumerate(story[pair*2:pair*2+2]):
            index=pair*2+j;start,end=limits[j:j+2]
            wav=path/f'scene_{index}_qwen.wav'
            subprocess.run([FF,'-y','-v','error','-i',str(audio),'-af',f'atrim=start={start}:end={end},asetpts=PTS-STARTPTS','-ar','48000','-ac','1','-c:a','pcm_s16le',str(wav)],check=True)
            captions=[]
            for caption in chunks(s['narration']):
                length=len(tokens(caption));a=max(0,alignment[cursor][0]-start);b=min(end-start,alignment[cursor+length-1][1]-start+.12)
                captions.append([a,max(a+.05,b),caption]);cursor+=length
            assert cursor==sum(len(tokens(x['narration'])) for x in story[pair*2:pair*2+j+1])
            for k in range(len(captions)-1):captions[k][1]=min(captions[k][1],max(captions[k][0]+.05,captions[k+1][0]-.02))
            narration.append({'voice_wav':str(wav),'captions':captions,'source_pair':pair,'source_start':start,'source_end':end})
    if len(narration)==8:
        (path/'narration_alignment.json').write_text(json.dumps(narration,indent=2),encoding='utf-8')
        print(folder+': eight scenes aligned',flush=True)
    else:print(folder+f': {len(narration)} available scenes checked; awaiting remainder',flush=True)
