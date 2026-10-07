from pathlib import Path
import sys,json,subprocess,wave,math,re,hashlib
ROOT=Path(__file__).parent
sys.path.insert(0,str(Path('C:/Github/ProcureFlow-App/output/video/supplier-stock/work/deps')))
import imageio_ffmpeg
from PIL import Image
FEATURES=[('.', 'ProcureFlow_Supplier_Pack_Quantities')]
FF=imageio_ffmpeg.get_ffmpeg_exe()

def run(cmd,cwd=None):
    p=subprocess.run(cmd,cwd=cwd,capture_output=True,text=True,encoding='utf-8')
    if p.returncode:raise RuntimeError(p.stderr[-3000:])
    return p

def stamp(seconds,ass=False):
    units=100 if ass else 1000;n=round(seconds*units)
    h=n//(3600*units);m=n//(60*units)%60;s=n//units%60;f=n%units
    return f'{h}:{m:02}:{s:02}.{f:02}' if ass else f'{h:02}:{m:02}:{s:02},{f:03}'

ASSHEAD=['[Script Info]','ScriptType: v4.00+','PlayResX: 1920','PlayResY: 1080','WrapStyle: 0','[V4+ Styles]','Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding','Style: Default,Segoe UI,34,&H00FFFFFF,&H00FFFFFF,&H002F2510,&H002F2510,0,0,0,0,100,100,0,0,1,1,0,2,160,160,108,1','[Events]','Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text']

def render(folder,stem):
    path=ROOT/folder;story=json.loads((path/'storyboard.json').read_text());data=json.loads((path/'narration_alignment.json').read_text())
    assert len(story)==len(data)==8
    timeline=[];srt=[];clock=0;cap=1
    for i,(scene,voice) in enumerate(zip(story,data)):
        with wave.open(voice['voice_wav'],'rb') as w:
            assert (w.getnchannels(),w.getframerate(),w.getsampwidth())==(1,48000,2)
            samples=w.readframes(w.getnframes());audio_duration=w.getnframes()/48000
        lead=.30;tail=.45
        frames=math.ceil((lead+audio_duration+tail)*24);duration=frames/24
        audio_frames=b'\x00'*round(lead*48000)*2+samples
        audio_frames+=b'\x00'*max(0,round(duration*48000)*2-len(audio_frames))
        padded=path/f'scene_{i}_padded.wav'
        with wave.open(str(padded),'wb') as w:w.setparams((1,2,48000,0,'NONE','not compressed'));w.writeframes(audio_frames)
        captions=[];ass=ASSHEAD.copy()
        for a,b,caption in voice['captions']:
            start=lead+a;end=min(duration-.08,lead+b)
            assert end>start
            ass.append(f'Dialogue: 0,{stamp(start,True)},{stamp(end,True)},Default,,0,0,0,,'+caption)
            srt.append(f'{cap}\n{stamp(clock+start)} --> {stamp(clock+end)}\n{caption}\n');cap+=1
            captions.append([start,end,caption])
        (path/f'scene_{i}.ass').write_text('\n'.join(ass),encoding='utf-8-sig')
        vf=f"scale=1920:1080,zoompan=z='1+0.012*on/{frames}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps=24,subtitles=scene_{i}.ass,fade=t=in:st=0:d=0.20,fade=t=out:st={duration-.20}:d=0.20"
        out=path/f'scene_{i}.mp4'
        if '--master-only' not in sys.argv or not out.is_file():
            run([FF,'-y','-loglevel','error','-loop','1','-framerate','24','-i',str(path/f'scene_{i}.png'),'-i',str(padded),'-vf',vf,'-t',str(duration),'-c:v','libx264','-threads','4','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000',str(out)],cwd=path)
        timeline.append({'scene':i+1,'title':scene['title'],'start':clock,'duration':duration,'captions':captions,'speech_duration':audio_duration})
        clock+=duration
        print(f'{folder}: scene {i+1}/8 rendered',flush=True)
    (path/'concat.txt').write_text('\n'.join(f"file 'scene_{i}.mp4'" for i in range(8)),encoding='utf-8')
    joined=path/'joined.mp4'
    run([FF,'-y','-loglevel','error','-f','concat','-safe','0','-i','concat.txt','-c','copy',str(joined)],cwd=path)
    analysis=run([FF,'-hide_banner','-i',str(joined),'-vn','-af','highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json','-f','null','-'])
    measurement=json.JSONDecoder().raw_decode(analysis.stderr[analysis.stderr.rfind('{'):])[0]
    filt='highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=7:linear=true:'+':'.join(f'{a}={measurement[b]}' for a,b in [('measured_I','input_i'),('measured_TP','input_tp'),('measured_LRA','input_lra'),('measured_thresh','input_thresh'),('offset','target_offset')])
    final=path/(stem+'_Explainer.mp4')
    run([FF,'-y','-loglevel','error','-i',str(joined),'-c:v','copy','-af',filt,'-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(final)])
    (path/(stem+'_Explainer.srt')).write_text('\n'.join(srt),encoding='utf-8')
    (path/'timeline.json').write_text(json.dumps(timeline,indent=2),encoding='utf-8')
    Image.open(path/'scene_0.png').save(path/(stem+'_Poster.jpg'),quality=95)
    (path/'loudness_analysis.json').write_text(json.dumps(measurement,indent=2),encoding='utf-8')
    verify(folder,stem,story,timeline,clock)

def verify(folder,stem,story,timeline,duration):
    path=ROOT/folder;video=path/(stem+'_Explainer.mp4')
    frames=imageio_ffmpeg.read_frames(str(video));meta=next(frames);frames.close()
    assert meta['size']==(1920,1080) and abs(meta['fps']-24)<.01
    assert abs(meta['duration']-duration)<.7 and 65<meta['duration']<180
    decoded=run([FF,'-v','error','-i',str(video),'-f','null','-']);assert not decoded.stderr.strip()
    loud=run([FF,'-hide_banner','-i',str(video),'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json','-f','null','-'])
    stats=json.JSONDecoder().raw_decode(loud.stderr[loud.stderr.rfind('{'):])[0];assert -17.1<float(stats['input_i'])<-14.9 and float(stats['input_tp'])<-.8,stats
    srt=(path/(stem+'_Explainer.srt')).read_text(encoding='utf-8')
    assert srt.count(' --> ')==sum(len(s['captions']) for s in timeline)
    captions=' '.join(c[2] for s in timeline for c in s['captions'])
    assert captions==' '.join(s['narration'] for s in story)
    qa=path/'qa';qa.mkdir(exist_ok=True)
    for scene in timeline:
        start,end,text=max(scene['captions'],key=lambda c:len(c[2]))
        run([FF,'-y','-loglevel','error','-ss',str(scene['start']+(start+end)/2),'-i',str(video),'-frames:v','1',str(qa/f"scene-{scene['scene']}.png")])
    manifest={'source_pdf':str(ROOT.parent/'07_ProcureFlow_Supplier_Bale_and_Carton_Quantities.pdf'),'width':1920,'height':1080,'fps':24,'duration_seconds':duration,'voice':'Qwen3-TTS / approved synthetic Australian presenter reference','reference_sha256':hashlib.sha256((Path('C:/Github/ProcureFlow-App/output/video/voice-audition/ProcureFlow_Qwen3_Narration_Sample_raw.wav')).read_bytes()).hexdigest(),'audio_processing':'Two-pass -16 LUFS / true peak -1.5 dB / 70 Hz high-pass / no time compression','captions':'Burned in plus SRT, aligned to new narration using recognised word timestamps','scenes':8,'video_sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'video_bytes':video.stat().st_size,'visual_qa':'pending'}
    (path/'video_manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    result={'status':'decode, loudness, caption completeness and timing checks passed','duration_seconds':meta['duration'],'size':meta['size'],'fps':meta['fps'],'integrated_lufs':float(stats['input_i']),'true_peak_db':float(stats['input_tp']),'captions':srt.count(' --> '),'scenes':8,'time_compression':False}
    (path/'verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps({'feature':folder,**result}),flush=True)

if __name__=='__main__':
    for folder,stem in FEATURES:
        if len(sys.argv)==1 or folder in sys.argv[1:]:render(folder,stem)
