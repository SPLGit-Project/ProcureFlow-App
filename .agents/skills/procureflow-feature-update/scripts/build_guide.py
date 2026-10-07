"""Preserve the approved DOCX package while filling checked content/image slots."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse, hashlib, json
from lxml import etree
from PIL import Image

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--contract',type=Path,required=True)
    parser.add_argument('--output-name',required=True)
    args=parser.parse_args()
    root=args.root.resolve(); contract=args.contract.resolve()
    plan=json.loads(contract.read_text(encoding='utf-8-sig'))
    ref=Path(plan['reference'])
    if not ref.is_absolute(): ref=contract.parent/ref
    assert hashlib.sha256(ref.read_bytes()).hexdigest()==plan['sha256'], 'Template hash mismatch'
    out=(root/args.output_name).resolve()
    assert out.parent==root and out!=ref.resolve(), 'Output must be a new file inside package'
    with ZipFile(ref) as z: parts={n:z.read(n) for n in z.namelist()}
    original=parts.copy()
    ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','wp':'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
    body=etree.fromstring(parts['word/document.xml'])
    paragraphs=body.xpath('//w:body//w:p',namespaces=ns)
    for index,slot in plan['slots'].items():
        nodes=paragraphs[int(index)].xpath('.//w:t',namespaces=ns)
        assert ''.join(n.text or '' for n in nodes)==slot['expected'], 'Unexpected slot '+index
        nodes[0].text=slot['text']
        for n in nodes[1:]: n.text=''
    drawings=body.xpath('//w:body//w:drawing',namespaces=ns)
    rels=etree.fromstring(parts['word/_rels/document.xml.rels'])
    types=etree.fromstring(parts['[Content_Types].xml'])
    if not any(n.get('Extension')=='png' for n in types):
        etree.SubElement(types,'{http://schemas.openxmlformats.org/package/2006/content-types}Default',Extension='png',ContentType='image/png')
    for spec in plan['images']:
        index=spec['index']; image=(root/'screenshots'/spec['file']).resolve()
        assert image.is_relative_to(root/'screenshots'), 'Screenshot outside package'
        with Image.open(image) as im: width,height=im.size
        w=min(spec['max_width_pt'],spec['max_height_pt']*width/height); h=w*height/width
        rid='rIdFeatureScreenshot'+str(index); target='media/feature-screenshot-'+str(index)+'.png'
        assert not any(n.get('Id')==rid for n in rels), 'Relationship already exists'
        etree.SubElement(rels,'{http://schemas.openxmlformats.org/package/2006/relationships}Relationship',Id=rid,Type=ns['r']+'/image',Target=target)
        d=drawings[index]; d.xpath('.//a:blip',namespaces=ns)[0].set('{'+ns['r']+'}embed',rid)
        for extent in d.xpath('.//wp:extent | .//a:xfrm/a:ext',namespaces=ns): extent.set('cx',str(round(w*12700)));extent.set('cy',str(round(h*12700)))
        d.xpath('.//wp:docPr',namespaces=ns)[0].set('descr',spec.get('description','Actual ProcureFlow screen: '+spec['file']))
        parts['word/'+target]=image.read_bytes()
    parts['word/document.xml']=etree.tostring(body,xml_declaration=True,encoding='UTF-8',standalone=True)
    parts['word/_rels/document.xml.rels']=etree.tostring(rels,xml_declaration=True,encoding='UTF-8',standalone=True)
    parts['[Content_Types].xml']=etree.tostring(types,xml_declaration=True,encoding='UTF-8',standalone=True)
    core=etree.fromstring(parts['docProps/core.xml']); core.find('{http://purl.org/dc/elements/1.1/}title').text=plan['title']
    parts['docProps/core.xml']=etree.tostring(core,xml_declaration=True,encoding='UTF-8',standalone=True)
    settings=etree.fromstring(parts['word/settings.xml']); update=settings.find('w:updateFields',ns)
    if update is None: update=etree.SubElement(settings,'{'+ns['w']+'}updateFields')
    update.set('{'+ns['w']+'}val','true');parts['word/settings.xml']=etree.tostring(settings,xml_declaration=True,encoding='UTF-8',standalone=True)
    editable={'word/document.xml','word/_rels/document.xml.rels','[Content_Types].xml','docProps/core.xml','word/settings.xml'}
    assert all(parts[n]==b for n,b in original.items() if n not in editable)
    with ZipFile(out,'w',ZIP_DEFLATED) as z:
        for n,b in parts.items():z.writestr(n,b)
    print(json.dumps({'output':str(out),'preserved_parts':len(original)-len(editable),'slots':len(plan['slots']),'images':len(plan['images'])}))
if __name__=='__main__':main()
