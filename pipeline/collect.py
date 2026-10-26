# -*- coding: utf-8 -*-
"""1단계: 공고 원문 모으기 → pipeline/raw/<id>.txt + <id>.meta.json

원문은 저작권이 있어서 pipeline/raw/ 는 git에 올리지 않는다 (.gitignore).

방법 세 가지
  text   : 공고 본문을 복사해 pipeline/raw/<id>.txt 로 직접 저장한 경우. meta만 만들어 준다
  url    : 공고 웹페이지 주소에서 글자만 가져온다. robots.txt 가 막은 곳은 가져오지 않는다
           (자바스크립트로 그리는 채용 사이트는 글자가 비어 있을 수 있다. 그때는 text 방법을 쓴다)
  api    : pipeline/sources.json 에 적은 공공 API(예: 고용24)에서 공고 목록을 받는다.
           인증키는 환경변수로만 받는다 (파일에 적지 않는다)

사용법 (gamja-game 폴더에서)
  py pipeline/collect.py text --id sk-bio-ir --company "실제회사명" --site "회사 채용 페이지"
  py pipeline/collect.py url  --id naver-snb --url https://example.com/job/123 --company "실제회사명"
  py pipeline/collect.py api  --source work24 --keyword IR --limit 20
"""
import argparse, json, os, re, sys, urllib.parse, urllib.request, urllib.robotparser
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

RAW = Path(__file__).resolve().parent / "raw"
SOURCES = Path(__file__).resolve().parent / "sources.json"
UA = "gamja-game-content-bot/0.1 (education project; contact via repository)"
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def save_meta(pid, **meta):
    meta = {"id": pid, "collectedAt": date.today().isoformat(), **meta}
    (RAW / f"{pid}.meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


class _Text(HTMLParser):
    """HTML → 줄바꿈을 살린 글자. script·style 은 버린다"""
    BLOCK = {"p", "div", "li", "br", "tr", "h1", "h2", "h3", "h4", "h5", "section", "article", "dt", "dd"}

    def __init__(self):
        super().__init__(); self.out = []; self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self.skip += 1
        if tag in self.BLOCK:
            self.out.append("\n")
        if tag == "li":
            self.out.append("* ")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"):
            self.skip = max(0, self.skip - 1)
        if tag in self.BLOCK:
            self.out.append("\n")

    def handle_data(self, data):
        if not self.skip:
            self.out.append(data)

    def text(self):
        t = "".join(self.out)
        t = re.sub(r"[ \t ]+", " ", t)
        return re.sub(r"\n\s*\n+", "\n", t).strip()


def allowed(url):
    p = urllib.parse.urlparse(url)
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(f"{p.scheme}://{p.netloc}/robots.txt")
    try:
        rp.read()
    except Exception:
        return True          # robots.txt 를 못 읽으면 일반 규칙대로 허용
    return rp.can_fetch(UA, url)


def fetch(url, params=None):
    if params:
        url = url + ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        raw = r.read()
        enc = r.headers.get_content_charset() or "utf-8"
    return raw.decode(enc, errors="replace")


def cmd_text(a):
    f = RAW / f"{a.id}.txt"
    if not f.exists():
        sys.exit(f"{f} 가 없어요. 공고 본문을 이 파일로 먼저 저장해 주세요.")
    save_meta(a.id, method="text", company=a.company, site=a.site, url=a.url or "")
    print(f"meta 저장: {a.id}")


def cmd_url(a):
    if not allowed(a.url):
        sys.exit("이 페이지는 robots.txt 에서 수집을 막아 두었어요. 공고 본문을 복사해서 text 방법을 써 주세요.")
    p = _Text(); p.feed(fetch(a.url)); body = p.text()
    if len(body) < 200:
        print("[확인] 가져온 글자가 너무 적어요. 자바스크립트로 그리는 페이지일 수 있어요. text 방법을 권장해요.")
    (RAW / f"{a.id}.txt").write_text(body + "\n", encoding="utf-8")
    save_meta(a.id, method="url", company=a.company, site=a.site or urllib.parse.urlparse(a.url).netloc, url=a.url)
    print(f"저장: pipeline/raw/{a.id}.txt ({len(body)}자)")


def cmd_api(a):
    if not SOURCES.exists():
        sys.exit("pipeline/sources.json 이 없어요. sources.example.json 을 복사해서 채워 주세요.")
    src = json.loads(SOURCES.read_text(encoding="utf-8")).get(a.source)
    if not src or not src.get("url"):
        sys.exit(f"sources.json 의 '{a.source}' 에 호출 주소(url)가 비어 있어요. API 명세에서 확인해 넣어 주세요.")
    key = os.environ.get(src.get("key_env", ""), "")
    if not key:
        sys.exit(f"인증키 환경변수 {src.get('key_env')} 가 비어 있어요.")
    params = {k: v.format(keyword=a.keyword, limit=a.limit) if isinstance(v, str) else v for k, v in src.get("params", {}).items()}
    params[src.get("key_param", "authKey")] = key
    body = fetch(src["url"], params)
    out = RAW / f"_api_{a.source}_{date.today().isoformat()}.{src.get('format', 'xml')}"
    out.write_text(body, encoding="utf-8")
    print(f"목록 저장: {out.name}. 상세 본문은 공고마다 text 또는 url 방법으로 가져와요.")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    RAW.mkdir(exist_ok=True)
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("text", "url"):
        s = sub.add_parser(name)
        s.add_argument("--id", required=True, help="영어 소문자·숫자·하이픈. 예: sk-bio-ir")
        s.add_argument("--company", default="", help="실제 회사명 (빌드 때 aliases.csv 로 각색)")
        s.add_argument("--site", default="")
        s.add_argument("--url", required=(name == "url"), default="")
    s = sub.add_parser("api")
    s.add_argument("--source", required=True)
    s.add_argument("--keyword", default="")
    s.add_argument("--limit", default="20")
    a = ap.parse_args()
    if getattr(a, "id", None) and not ID_RE.match(a.id):
        sys.exit("id는 영어 소문자·숫자·하이픈만 써요.")
    {"text": cmd_text, "url": cmd_url, "api": cmd_api}[a.cmd](a)


if __name__ == "__main__":
    main()
