# -*- coding: utf-8 -*-
"""배포 전 점검. GitHub Pages 에 올리기 전에 한 번 돌린다.

  py tools/check_site.py

[오류] 가 하나라도 있으면 끝에 실패로 끝난다. [확인] 은 올려도 되지만 알고 있어야 할 것.
"""
import csv, json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVED = ["index.html", "css", "js", "data", "assets"]   # 실제로 사람들이 받는 파일
errs, warns, oks = [], [], []


def served_files():
    for s in SERVED:
        p = ROOT / s
        yield from ([p] if p.is_file() else [f for f in p.rglob("*") if f.is_file()])


def text_of(f):
    try:
        return f.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return ""


# 1. 게임 데이터: 색인과 공고 파일이 맞는지, content 와 같은지
idx_f = ROOT / "data" / "index.json"
if not idx_f.exists():
    errs.append("data/index.json 이 없어요. py pipeline/build.py 를 먼저 돌려 주세요.")
else:
    idx = json.loads(idx_f.read_text(encoding="utf-8"))
    ids = [p["id"] for f in idx["fields"] for j in f["jobs"] for p in j["postings"]]
    for pid in ids:
        pf = ROOT / "data" / "postings" / f"{pid}.json"
        if not pf.exists():
            errs.append(f"색인에 있는 공고 {pid} 의 파일이 없어요")
            continue
        p = json.loads(pf.read_text(encoding="utf-8"))
        miss = [k for k in ("id", "company", "position", "stages", "words") if k not in p]
        if miss:
            errs.append(f"{pid}: {', '.join(miss)} 없음")
    reviewed = []
    for cf in (ROOT / "content" / "postings").glob("*.json"):
        c = json.loads(cf.read_text(encoding="utf-8"))
        if c.get("status") == "reviewed":
            reviewed.append(c["id"])
            if (ROOT / "data" / "postings" / f"{c['id']}.json").exists() and cf.stat().st_mtime > (ROOT / "data" / "postings" / f"{c['id']}.json").stat().st_mtime:
                warns.append(f"{c['id']}: content 가 data 보다 새로워요. build.py 를 다시 돌려 주세요")
    if sorted(reviewed) != sorted(ids):
        errs.append(f"확인 완료 공고({len(reviewed)}개)와 게임에 실린 공고({len(ids)}개)가 달라요. build.py 를 다시 돌려 주세요")
    else:
        oks.append(f"게임 공고 {len(ids)}개, content 와 일치")

# 2. 그림·파일 경로: 코드에 적힌 assets/ 경로가 실제로 있는지
refs = set()
for f in served_files():
    if f.suffix in (".html", ".js", ".css"):
        refs |= set(re.findall(r"assets/[\w\-./]+?\.(?:png|jpg|jpeg|webp|svg|gif)", text_of(f)))
missing = sorted(r for r in refs if not (ROOT / r).exists())
for r in missing:
    errs.append(f"코드가 부르는 그림이 없어요: {r}")
if not missing:
    oks.append(f"코드가 부르는 그림 {len(refs)}개 모두 있음")

# 3. 실제 회사명이 새지 않았는지 (pipeline/aliases.csv 가 있을 때)
al = ROOT / "pipeline" / "aliases.csv"
if al.exists():
    with open(al, encoding="utf-8-sig") as fh:
        reals = [r["real"].strip() for r in csv.DictReader(fh) if r.get("real", "").strip()]
    leaks = [(f.relative_to(ROOT).as_posix(), n) for f in served_files() for n in reals if n and n in text_of(f)]
    for f, n in leaks:
        errs.append(f"실제 회사명 '{n}' 이 {f} 에 남아 있어요")
    if not leaks:
        oks.append(f"실제 회사명 {len(reals)}개, 배포 파일에 없음")
else:
    warns.append("pipeline/aliases.csv 가 없어서 실명 검사를 건너뛰었어요 (샘플만 있으면 괜찮아요)")

# 4. 저장소에 올리면 안 되는 것이 .gitignore 에 있는지
gi = (ROOT / ".gitignore").read_text(encoding="utf-8") if (ROOT / ".gitignore").exists() else ""
for need in ("pipeline/raw/", "pipeline/review/", "pipeline/aliases.csv"):
    if need.rstrip("/") not in gi:
        errs.append(f".gitignore 에 {need} 가 없어요 (원문 저작권·실명)")
if (ROOT / ".git").exists():
    try:
        tracked = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8").stdout.split()
        bad = [t for t in tracked if t.startswith(("pipeline/raw/", "pipeline/aliases.csv")) or (t.startswith("pipeline/review/") and not t.endswith("sample.csv"))]
        for b in bad:
            errs.append(f"git 이 올리면 안 되는 파일을 추적 중이에요: {b} (git rm --cached 로 빼 주세요)")
    except FileNotFoundError:
        pass
oks.append(".gitignore 확인")

# 5. 내 컴퓨터에서만 되는 주소가 남았는지
for f in served_files():
    t = text_of(f)
    for pat in (r"localhost", r"127\.0\.0\.1", r"[A-Za-z]:[\\/]Users"):
        if re.search(pat, t):
            errs.append(f"{f.relative_to(ROOT).as_posix()}: 내 컴퓨터 주소가 남아 있어요 ({pat})")

# 6. 외부 글꼴·아이콘이 버전을 고정했는지 (버전이 없으면 어느 날 갑자기 바뀔 수 있음)
html = text_of(ROOT / "index.html")
for u in re.findall(r'href="(https://cdn\.jsdelivr\.net/[^"]+)"', html):
    if "@" not in u:
        warns.append(f"버전이 고정되지 않은 외부 파일: {u}")
oks.append("외부 파일 버전 확인")
og = re.search(r'property="og:image" content="([^"]*)"', html)
if og and not og.group(1).startswith("https://"):
    warns.append("공유 미리보기 그림(og:image)이 상대 주소예요. 배포 후 전체 주소로 바꾸면 카카오톡에서도 그림이 보여요")

# 7. 그림 원본 여부, 파일 크기
man = ROOT / "design" / "assets.json"
if man.exists():
    prev = [k for k, v in json.loads(man.read_text(encoding="utf-8")).items() if isinstance(v, dict) and v.get("status") == "preview"]
    if not prev:
        oks.append("그림 모두 원본")
    if prev:
        warns.append(f"그림 {len(prev)}개가 아직 흐린 미리보기예요 (design/assets.json). 올려도 되지만 원본으로 바꾸면 선명해져요")
total = 0
for f in served_files():
    size = f.stat().st_size; total += size
    if size > 1_500_000:
        warns.append(f"큰 파일: {f.relative_to(ROOT).as_posix()} ({size / 1e6:.1f}MB). 폰에서 느릴 수 있어요")
oks.append(f"배포 파일 전체 {total / 1e6:.1f}MB")

# 8. GitHub Pages 설정
if not (ROOT / ".nojekyll").exists():
    warns.append(".nojekyll 이 없어요. 밑줄(_)로 시작하는 파일이 생기면 Pages 가 숨겨요")

sys.stdout.reconfigure(encoding="utf-8")
for o in oks:
    print("[통과]", o)
for w in warns:
    print("[확인]", w)
for e in errs:
    print("[오류]", e)
print(f"\n오류 {len(errs)} · 확인 {len(warns)}" + (" → 올리기 전에 오류를 고쳐 주세요" if errs else " → 올려도 돼요"))
sys.exit(1 if errs else 0)
