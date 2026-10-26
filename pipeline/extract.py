# -*- coding: utf-8 -*-
"""2단계: 공고 원문 → 사람이 확인할 표(pipeline/review/<id>.csv)

원문을 구역(소개·담당업무·자격요건·우대사항·전형절차)으로 나누고, 줄마다 후보를 만든다.
  task  : 담당업무 줄. game_text 를 실무 표현으로 고쳐 쓰고, candidates 중 맞는 O*NET 업무(DWA)를 source 에 옮긴다
  spec  : 자격요건·우대사항 줄. 서류 전형의 스펙 단어
  stage : 전형 이름. features 에 spec / trap / interview / bonus
  term  : 낯선 단어 후보. desc 에 한 줄 풀이를 쓴다
  trap  : 옆 직무의 일. 자동으로는 못 만들어서 빈 줄만 준비한다 (owner = 실제로 그 일을 하는 팀)
  intro : 이 자리를 한 줄로 소개하는 문장
keep 칸: Y = 싣기, N = 빼기, ? = 아직 안 봄 (apply_review 는 Y 만 싣는다)

사용법 (gamja-game 폴더에서)
  py pipeline/extract.py --id sk-bio-ir
"""
import argparse, csv, json, re, sys
from pathlib import Path
from aei import load_aei, judge, DEFAULT_AEI

HERE = Path(__file__).resolve().parent
RAW, REVIEW = HERE / "raw", HERE / "review"
DEFAULT_ONET = HERE.parents[2] / "aei_lesson" / "onet" / "tasks_to_dwas.csv"
COLS = ["kind", "keep", "original", "game_text", "source", "match", "owner", "desc", "features", "candidates"]

HEAD = [
    ("tasks", r"(담당\s*업무|주요\s*업무|업무\s*내용|하는\s*일|역할)"),
    ("quals", r"(지원\s*자격|자격\s*요건|필수\s*요건|이런 분과)"),
    ("prefs", r"(우대\s*사항|우대\s*요건|이런 경험이 있다면)"),
    ("stages", r"(전형\s*절차|전형\s*안내|채용\s*절차|이러한 여정)"),
    ("skip", r"(근무지|근무\s*조건|기타\s*사항|복리\s*후생|참고\s*사항|미리 확인|모집\s*법인|학력\s*사항|[가-힣]+ 이야기|FAQ)"),
]
BULLET = re.compile(r"^\s*(?:[*\-•·○▪◦]|\d+[.)])\s*")
ACTION = re.compile(r"(분석|기획|제안|협업|개선|발굴|구축|운영|컨설팅|파악|진행|작성|모니터링|지원|관리|협상|발표|응대|조율)")
STAGE_WORD = re.compile(r"(서류|필기|면접|인터뷰|검사|전형|처우|협의|검진|과제|챌린지|코딩|테스트)")
STAGE_SKIP = re.compile(r"(접수|입사|안내|일정|변동|결과에 따라|레퍼런스|진행됩니다|진행될|입니다|합니다|최종\s*합격)")
JARGON = re.compile(r"(?<![./@\w])[A-Z][A-Za-z&]{1,}(?: [A-Z][A-Za-z]{1,})?|[가-힣]{2,}(?:공시|검사|인터뷰|협의|검진|위원회)")
# 누구나 아는 말, 사이트·주소 조각, 흔한 전형 이름은 용어 후보에서 뺀다
TERM_STOP = {"AI", "FAQ", "KST", "My Page", "Search Firm", "Service", "Business", "Cloud", "OECD", "CEO", "IT", "PC", "OK"}


def heading(line):
    s = line.strip()
    if len(s) > 28 or BULLET.match(line):
        return None
    for name, pat in HEAD:
        if re.search(pat, s):
            return name
    return None


def split_sections(text):
    sec, cur = {"intro": [], "tasks": [], "quals": [], "prefs": [], "stages": [], "skip": []}, "intro"
    for raw in text.splitlines():
        if not raw.strip():
            continue
        h = heading(raw)
        if h:
            cur = h
            continue
        sec[cur].append(raw.rstrip())
    return sec


def clean(line):
    return BULLET.sub("", line).strip()


def short_spec(s):
    s = re.sub(r"\([^)]*\)", "", s)
    s = re.sub(r"\s*:\s*", " ", s)
    for a, b in [("에 대한 기본적인 이해도", " 이해"), ("에 대한 관심과 기본적인 이해도", " 관심"), ("에 대한 이해", " 이해"),
                 ("의 능숙한 활용 역량", " 능숙"), ("할 수 있는 역량", ""), ("역량 보유자", " 역량"), (" 보유자", ""), ("능통자", "능통")]:
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s).strip(" ,.")


def stage_rows(lines):
    names = []
    for l in lines:
        s = clean(l)
        if ">" in s or "→" in s:
            names += [p.strip() for p in re.split(r"[>→]", s)]
            continue
        first = re.split(r"\t|\s{2,}", s)[0].strip(" &")
        if STAGE_WORD.search(first) and not STAGE_SKIP.search(first) and len(first) <= 20:
            names.append(first)
    seen, out = set(), []
    for n in names:
        n = re.sub(r"\s+", " ", n).strip()
        if n and n not in seen and not STAGE_SKIP.search(n):
            seen.add(n); out.append(n)
    rows = []
    for i, n in enumerate(out):
        f = "bonus" if re.search(r"(처우|협의)", n) else "spec" if i == 0 else "trap interview" if re.search(r"(면접|인터뷰)", n) else "trap"
        rows.append({"kind": "stage", "keep": "Y", "original": n, "game_text": n, "features": f})
    return rows


def load_dwas(path):
    with open(path, encoding="utf-8") as f:
        return sorted({r["DWA Element Name"].strip() for r in csv.DictReader(f)})


def load_hints():
    with open(HERE / "dwa_hints.csv", encoding="utf-8-sig") as f:
        return [(r["keyword"], r["stems"].split("|")) for r in csv.DictReader(f)]


def candidates(line, dwas, hints, may, apr, n=3):
    stems = {st for kw, sts in hints if kw in line for st in sts}
    if not stems:
        return []
    scored = []
    for d in dwas:
        low = d.lower()
        hit = sum(1 for st in stems if st in low)
        if not hit:
            continue
        v, p = may.get(d), apr.get(d)
        if (v is not None or p is not None) and judge(v) != judge(p):
            continue          # 달마다 판정이 바뀌는 업무는 build 에서 빠지므로 후보에서도 뺀다
        scored.append((hit + (0.3 if v is not None else 0), d, v))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [f"{d} [{judge(v)}{'' if v is None else f' {v:.0f}'}]" for _, d, v in scored[:n]]


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", required=True)
    ap.add_argument("--aei", default=str(DEFAULT_AEI))
    ap.add_argument("--onet", default=str(DEFAULT_ONET))
    ap.add_argument("--force", action="store_true", help="이미 있는 review 표를 덮어쓴다")
    a = ap.parse_args()
    src = RAW / f"{a.id}.txt"
    if not src.exists():
        sys.exit(f"{src} 가 없어요. 먼저 collect.py 로 원문을 모아 주세요.")
    out = REVIEW / f"{a.id}.csv"
    if out.exists() and not a.force:
        sys.exit(f"{out.name} 이 이미 있어요. 사람이 고친 내용을 지우지 않으려고 멈췄어요. 덮어쓰려면 --force")

    text = src.read_text(encoding="utf-8")
    sec = split_sections(text)
    may, apr = load_aei(a.aei)
    dwas, hints = load_dwas(a.onet), load_hints()
    rows = []

    intro = next((clean(l) for l in sec["intro"] if len(clean(l)) > 20), "")
    rows.append({"kind": "intro", "keep": "Y", "original": intro, "game_text": ""})

    task_lines = [clean(l) for l in sec["tasks"] if len(clean(l)) > 4]
    from_prose = False
    if not task_lines:     # 담당업무 머리말이 없는 공고: 소개 문단의 문장에서 할 일이 담긴 문장을 고른다
        from_prose = True
        for l in sec["intro"]:
            for sent in re.split(r"(?<=[다.])\s+", clean(l)):
                sent = re.sub(r"^(또한|나아가|그리고|단순히)\s*,?\s*", "", sent)
                if ACTION.search(sent) and 10 < len(sent) < 160:
                    task_lines.append(sent)
    for l in task_lines:
        rows.append({"kind": "task", "keep": "?" if from_prose else "Y", "original": l, "game_text": "", "match": "높음",
                     "candidates": " | ".join(candidates(l, dwas, hints, may, apr))})

    for l in sec["quals"] + sec["prefs"]:
        s = clean(l)
        if len(s) > 3:
            rows.append({"kind": "spec", "keep": "?", "original": s, "game_text": short_spec(s)})

    rows += stage_rows(sec["stages"])

    terms, seen = [], set()
    meta_f = RAW / f"{a.id}.meta.json"
    company = json.loads(meta_f.read_text(encoding="utf-8")).get("company", "") if meta_f.exists() else ""
    brand = {w for w in re.split(r"\s+", company) if w} | {company}
    for m in JARGON.finditer(text):
        t = m.group(0).strip()
        if t in TERM_STOP or any(b and (b in t or t in b) for b in brand if len(b) >= 2):
            continue
        if t not in seen and len(t) >= 2 and not t.isdigit():
            seen.add(t); terms.append(t)
    for t in terms[:25]:
        rows.append({"kind": "term", "keep": "?", "original": t, "game_text": t, "desc": ""})
    for _ in range(4):
        rows.append({"kind": "trap", "keep": "?", "original": "", "game_text": "", "owner": "", "desc": ""})

    REVIEW.mkdir(exist_ok=True)
    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in COLS})
    n = lambda k: sum(1 for r in rows if r["kind"] == k)
    print(f"review/{out.name}: 업무 {n('task')} · 스펙 {n('spec')} · 전형 {n('stage')} · 용어 후보 {n('term')}"
          + (" (담당업무 머리말이 없어 소개 문장에서 골랐어요. keep 을 확인해 주세요)" if from_prose else ""))


if __name__ == "__main__":
    main()
