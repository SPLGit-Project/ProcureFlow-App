from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
ROOT=Path(__file__).resolve().parents[1]
story=json.loads((ROOT/'work/storyboard.json').read_text(encoding='utf-8'))
NAVY='#10252F';CYAN='#43C6E2';MUTED='#A8C0C9'
def font(size,bold=False):return ImageFont.truetype('C:/Windows/Fonts/'+('segoeuib.ttf' if bold else 'segoeui.ttf'),size)
def text(d,x,y,t,size=32,color='white',bold=False,width=1760):
    f=font(size,bold);lines=[]
    for para in t.split('\n'):
        line=''
        for word in para.split():
            if line and f.getlength(line+' '+word)>width:lines.append(line);line=word
            else:line=(line+' '+word).strip()
        lines.append(line)
    d.multiline_text((x,y),'\n'.join(lines),font=f,fill=color,spacing=10)
for i,s in enumerate(story):
    im=Image.new('RGB',(1920,1080),NAVY);d=ImageDraw.Draw(im)
    d.ellipse((1380,-260,2110,470),fill='#14343F')
    text(d,80,45,'Procure',44,bold=True);text(d,80+font(44,True).getlength('Procure'),45,'Flow',44,CYAN,True)
    text(d,1400,63,'FEATURE UPDATE 07',22,MUTED,True)
    text(d,80,128,'FEATURE UPDATE' if i==0 else f'{i:02}  /  ASSOCIATED WORKFLOW',22,CYAN,True)
    text(d,80,194,s['title'],56,bold=True)
    pic=Image.open(ROOT/'screenshots'/s['image']).convert('RGB')
    # Keep screenshot pixels intact and fit the same scene image region as the six prior explainers.
    pic.thumbnail((1760,470),Image.Resampling.LANCZOS)
    x=80+(1760-pic.width)//2;y=310+(470-pic.height)//2
    d.rounded_rectangle((x-4,y-4,x+pic.width+4,y+pic.height+4),14,fill='#48616C');im.paste(pic,(x,y))
    text(d,80,819,s['note'],28,CYAN,True)
    d.line((80,1027,1840,1027),fill='#345461',width=3);d.line((80,1027,80+1760*(i+1)/8,1027),fill=CYAN,width=4)
    text(d,80,1042,'SUPPLIER BALE AND CARTON QUANTITIES / EXPLAINER',17,MUTED)
    text(d,1760,1042,f'{i+1} / 8',17,MUTED)
    im.save(ROOT/f'work/scene_{i}.png')
(ROOT/'ProcureFlow_Supplier_Pack_Quantities_Transcript.txt').write_text('Supplier bale and carton quantities\n\n'+
    '\n\n'.join(s['title']+'\n'+s['narration'] for s in story)+'\n',encoding='utf-8')
print('Eight scenes composed using actual branch screenshots')
