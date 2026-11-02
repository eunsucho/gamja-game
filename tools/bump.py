# -*- coding: utf-8 -*-
"""배포 전에 한 번: CSS·JS·그림 주소의 ?v= 를 새 값으로 바꾼다.
브라우저가 예전 파일(특히 같은 이름의 그림)을 그대로 쓰지 않게 한다.
  py tools/bump.py
"""
import re, time
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
V = time.strftime("%Y%m%d%H%M")
files = [ROOT / "index.html", ROOT / "css" / "style.css", *(ROOT / "js").glob("*.js")]
# 파일 주소 끝(.png .jpg .woff .css .js) 바로 뒤에 ?v= 를 붙인다. 템플릿으로 만든 주소(`assets/outfit/${x}.png`)도 포함
pat = re.compile(r"((?:assets/|css/|js/|\./|\})[^\s\"'`()]*?\.(?:png|jpg|woff2?|css|js))(\?v=\w+)?(?=[\"'`)\s])")
for f in files:
    s = f.read_text(encoding="utf-8")
    n = pat.sub(lambda m: f"{m.group(1)}?v={V}", s)
    if n != s:
        f.write_text(n, encoding="utf-8")
print("version", V)
