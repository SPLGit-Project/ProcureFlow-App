from pathlib import Path
import subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parents[2]
subprocess.run([sys.executable,str(REPO/'.agents/skills/procureflow-feature-update/scripts/build_guide.py'),'--root',str(ROOT),'--contract',str(ROOT/'source/template-contract.json'),'--output-name','07_ProcureFlow_Supplier_Bale_and_Carton_Quantities.docx'],check=True)
