from pathlib import Path
import json,sys,time,os,hashlib
ROOT=Path(__file__).parent
MODEL_ROOT=Path('C:/Github/ProcureFlow-App/output/video/qwen-voice-work')
os.environ['HF_HUB_DISABLE_XET']='1'
os.environ['HF_HUB_DOWNLOAD_TIMEOUT']='1800'
os.environ['PYTORCH_CUDA_ALLOC_CONF']='expandable_segments:True'
import torch,soundfile as sf
from transformers import BitsAndBytesConfig
from qwen_tts import Qwen3TTSModel,Qwen3TTSTokenizer
FEATURES=[('.', 'ProcureFlow_Supplier_Pack_Quantities_Explainer')]

assert torch.cuda.is_available(),'CUDA runtime unavailable'
torch.set_num_threads(int(os.environ.get('QWEN_CPU_THREADS','1')))
torch.set_num_interop_threads(1)
print('Local GPU: '+torch.cuda.get_device_name(0),flush=True)

# Keep the audio encoder/decoder at full precision; compress only the language
# generator to fit the existing 4 GB laptop GPU. No remote executable model code.
original_tokenizer_loader=Qwen3TTSTokenizer.from_pretrained
@classmethod
def load_audio_tokenizer(cls,path,*args,**kwargs):
    kwargs.pop('quantization_config',None)
    kwargs.pop('max_memory',None)
    return original_tokenizer_loader(path,*args,**kwargs)
Qwen3TTSTokenizer.from_pretrained=load_audio_tokenizer
quant=BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_compute_dtype=torch.bfloat16,bnb_4bit_quant_type='nf4',bnb_4bit_use_double_quant=True,llm_int8_skip_modules=['speaker_encoder','codec_head','text_projection','code_predictor'])
model_id='Qwen/Qwen3-TTS-12Hz-1.7B-Base'
print('Loading official Qwen 1.7B Base with NF4 generator weights',flush=True)
model=Qwen3TTSModel.from_pretrained(str(MODEL_ROOT/'models/Qwen3-TTS-12Hz-1.7B-Base'),device_map='cuda:0',dtype=torch.bfloat16,attn_implementation='sdpa',quantization_config=quant,local_files_only=True)
print(f'GPU allocated: {torch.cuda.memory_allocated()/1024**3:.2f} GB',flush=True)
progress={'frames':0,'started':0.0}
def show_progress(module,args,output):
    progress['frames']+=1
    if progress['frames']%100==0:
        print(f"  Generated {progress['frames']} audio frames in {time.time()-progress['started']:.1f}s",flush=True)
model.model.talker.register_forward_hook(show_progress)
AUDITION=MODEL_ROOT.parent/'voice-audition'
reference=AUDITION/'ProcureFlow_Qwen3_Narration_Sample_raw.wav'
ref_text=json.loads((AUDITION/'sample_config.json').read_text())['text']
print('Conditioning on the approved synthetic reference voice',flush=True)
prompt=model.create_voice_clone_prompt(ref_audio=str(reference),ref_text=ref_text,x_vector_only_mode=False)
if os.environ.get('QWEN_FAST')=='1':
    sys.path.insert(0,str(MODEL_ROOT/'faster-runtime'))
    from faster_qwen3_tts import FasterQwen3TTS
    from faster_qwen3_tts.predictor_graph import PredictorGraph
    from faster_qwen3_tts.talker_graph import TalkerGraph
    talker=model.model.talker;config=model.model.config.talker_config
    predictor=PredictorGraph(talker.code_predictor,talker.code_predictor.model.config,config.hidden_size,device='cuda:0',dtype=torch.bfloat16)
    graph=TalkerGraph(talker.model,config,device='cuda:0',dtype=torch.bfloat16,max_seq_len=2048)
    model=FasterQwen3TTS(model,predictor,graph,device='cuda:0',dtype=torch.bfloat16,max_seq_len=2048)
    print('Using reviewed MIT-licensed Faster Qwen CUDA graph runtime',flush=True)
selected=[x for x in FEATURES if len(sys.argv)==1 or x[0] in sys.argv[1:]]
for folder,stem in selected:
    path=ROOT/folder;story=json.loads((path/'storyboard.json').read_text())
    for pair in range(4):
        target='\n\n'.join(s['narration'] for s in story[pair*2:pair*2+2])
        spec={'model':model_id,'reference_sha256':hashlib.sha256(reference.read_bytes()).hexdigest(),'reference_text':ref_text,'text':target,'language':'English','use_xvector_only':False}
        audio=path/f'pair_{pair}.wav';meta=path/f'pair_{pair}_generation.json'
        if audio.is_file() and meta.is_file() and json.loads(meta.read_text()).get('request')==spec:
            print(f'{folder}: pair {pair+1}/4 cached',flush=True);continue
        print(f'{folder}: generating pair {pair+1}/4 locally',flush=True)
        started=time.time();torch.manual_seed(20261006+pair+int(os.environ.get('QWEN_SEED_OFFSET','0')))
        progress.update(frames=0,started=started)
        with torch.inference_mode():
            wavs,sr=model.generate_voice_clone(text=target,language='English',voice_clone_prompt=prompt,max_new_tokens=1200,do_sample=True,top_p=1.0,top_k=50,temperature=.9,repetition_penalty=1.05)
        sf.write(audio,wavs[0],sr)
        meta.write_text(json.dumps({'request':spec,'status':'Generated locally using official Qwen weights; generator NF4, audio codec and residual predictor BF16','runtime':'Faster Qwen 0.3.2 CUDA graphs' if os.environ.get('QWEN_FAST')=='1' else 'Upstream Qwen eager PyTorch','elapsed_seconds':round(time.time()-started,1),'sample_rate':sr,'duration_seconds':len(wavs[0])/sr,'peak_cuda_allocated_gb':round(torch.cuda.max_memory_allocated()/1024**3,3)},indent=2),encoding='utf-8')
        print(f'{folder}: pair {pair+1}/4 saved ({time.time()-started:.1f}s / {len(wavs[0])/sr:.1f}s audio)',flush=True)
        torch.cuda.empty_cache()
print('All selected narration generated locally',flush=True)
