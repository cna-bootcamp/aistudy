"""GitHub 유사 환경(htmlLabels=false)으로 mermaid를 PNG 렌더링해 잘림을 재현/검증하는 임시 스크립트."""
import re
import json
import pathlib
import subprocess
import tempfile

base = pathlib.Path(__file__).parent
readmes = ["mas-a/README.md", "mas-b/README.md", "mas-c/README.md", "orchestrator/README.md"]
tmp = pathlib.Path(tempfile.gettempdir()) / "mmd_png"
tmp.mkdir(exist_ok=True)

# GitHub mermaid는 securityLevel strict + htmlLabels off(SVG text)로 렌더링 → CJK 폭 과소계산 잘림 재현
cfg = tmp / "cfg.json"
cfg.write_text(json.dumps({"securityLevel": "strict", "flowchart": {"htmlLabels": False}}), encoding="utf-8")

for rel in readmes:
    text = (base / rel).read_text(encoding="utf-8")
    for i, block in enumerate(re.findall(r"```mermaid\n(.*?)\n```", text, re.S)):
        name = rel.replace("/", "_").replace(".md", "") + f"_{i}"
        mmd = tmp / (name + ".mmd")
        mmd.write_text(block, encoding="utf-8")
        out = tmp / (name + ".png")
        r = subprocess.run(
            ["npx", "-y", "@mermaid-js/mermaid-cli", "-i", str(mmd), "-o", str(out),
             "-b", "white", "-s", "2", "-c", str(cfg)],
            capture_output=True, text=True, shell=True,
        )
        print(name, "OK" if out.exists() else "FAIL", "->", str(out))
print("DONE")
