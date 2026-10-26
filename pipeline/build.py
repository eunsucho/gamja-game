# -*- coding: utf-8 -*-
"""content/ (사람이 확인한 공고) → data/ (게임이 읽는 파일).

하는 일
  1. content/taxonomy.json 의 분야·직무와 content/postings/*.json 을 읽는다
  2. status 가 "reviewed" 인 공고만 싣는다 (스크래핑 직후 draft 는 건너뜀)
  3. 업무(tasks)마다 AEI 판정을 붙인다. 4월·5월 판정이 다른 업무는 뺀다
  4. 실제 회사명을 감자 이름으로 바꾼다 (pipeline/aliases.csv 가 있으면)
  5. 형식을 검사한다. 오류가 하나라도 있으면 아무것도 쓰지 않는다
  6. data/postings/<id>.json 과 data/index.json (분야 → 직무 → 공고 요약)을 쓴다

data/ 는 이 스크립트가 만드는 폴더라 손으로 고치지 않는다.

사용법 (gamja-game 폴더에서):
  py pipeline/build.py
  py pipeline/build.py --aei <global_dwa.csv 경로> --aliases pipeline/aliases.csv
"""
import argparse, csv, json, re, sys
from datetime import date
from pathlib import Path
from aei import load_aei, rate, DEFAULT_AEI, RELEASE, PERIOD, ONET

ROOT = Path(__file__).resolve().parents[1]
FEATURES = {"trap", "spec", "interview"}
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def load_aliases(path):
    """실제 회사명 → 감자 회사명. 파일이 없으면 빈 표"""
    if not path or not Path(path).exists():
        return {}
    with open(path, encoding="utf-8-sig") as f:
        return {r["real"].strip(): r["alias"].strip() for r in csv.DictReader(f) if r.get("real")}


def texts_of(p):
    """실제 회사명이 새어 나갔는지 검사할 글자들"""
    yield p.get("company", ""), p.get("position", ""), p.get("intro", "")
    for s in p.get("stages", []):
        yield (s.get("name", ""),)
    for t in p.get("tasks", []):
        yield (t.get("text", ""), t.get("from", ""))
    for k in ("specs", "skills", "questions"):
        yield tuple(p.get(k, []))
    for t in p.get("traps", []):
        yield (t,) if isinstance(t, str) else (t.get("text", ""), t.get("why", ""))
    for t in p.get("terms", []):
        yield (t.get("term", ""), t.get("desc", ""))


def check(p, fname, fields, errs, warns):
    pid = p.get("id", "")
    where = fname
    for k in ("id", "field", "job", "company", "position", "stages", "tasks"):
        if k not in p:
            errs.append(f"{where}: {k} 없음")
    if pid and not ID_RE.match(pid):
        errs.append(f"{where}: id는 영어 소문자·숫자·하이픈만 ({pid})")
    if pid and Path(fname).stem != pid:
        errs.append(f"{where}: 파일 이름과 id가 다름 ({pid})")
    f = fields.get(p.get("field"))
    if not f:
        errs.append(f"{where}: field '{p.get('field')}' 가 taxonomy.json에 없음")
    elif p.get("job") not in {j["id"] for j in f["jobs"]}:
        errs.append(f"{where}: job '{p.get('job')}' 가 분야 '{f['id']}'에 없음")
    stages = p.get("stages", [])
    if not any(s.get("type") != "bonus" for s in stages):
        errs.append(f"{where}: 일반 전형이 하나도 없음")
    for i, s in enumerate(stages):
        if not s.get("name"):
            errs.append(f"{where}: stages[{i}].name 없음")
        bad = set(s.get("features", [])) - FEATURES
        if bad:
            errs.append(f"{where}: stages[{i}].features에 모르는 값 {sorted(bad)}")
    for i, t in enumerate(p.get("tasks", [])):
        if not t.get("text") or not t.get("source"):
            errs.append(f"{where}: tasks[{i}]에 text·source 필요")
        if t.get("match", "높음") not in ("높음", "근사"):
            errs.append(f"{where}: tasks[{i}].match는 높음 또는 근사")
    for k in ("specs", "skills", "questions"):
        if k in p and not (isinstance(p[k], list) and all(isinstance(x, str) for x in p[k])):
            errs.append(f"{where}: {k}는 문자열 배열")
    for i, t in enumerate(p.get("traps", [])):
        # 함정 = 이 직무와 헷갈리는 옆 직무의 일. {text, owner(누구 일인지), why(한 줄 이유)}. 예전처럼 문자열만 써도 됨
        if not (isinstance(t, str) or (isinstance(t, dict) and t.get("text") and t.get("owner"))):
            errs.append(f"{where}: traps[{i}]는 문자열 또는 {{text, owner, why}}")
    for i, t in enumerate(p.get("terms", [])):
        if not (isinstance(t, dict) and t.get("term") and t.get("desc")):
            errs.append(f"{where}: terms[{i}]에 term·desc 필요")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--aei", default=str(DEFAULT_AEI))
    ap.add_argument("--aliases", default=str(ROOT / "pipeline" / "aliases.csv"))
    a = ap.parse_args()

    tax = json.loads((ROOT / "content" / "taxonomy.json").read_text(encoding="utf-8"))
    fields = {f["id"]: f for f in tax["fields"]}
    aliases = load_aliases(a.aliases)
    may, apr = load_aei(a.aei)

    errs, warns, skipped, built = [], [], [], {}
    for path in sorted((ROOT / "content" / "postings").glob("*.json")):
        try:
            p = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errs.append(f"{path.name}: JSON 형식 오류 ({e})")
            continue
        if p.get("status") != "reviewed":
            skipped.append(f"{path.name} ({p.get('status', '상태 없음')})")
            continue
        check(p, path.name, fields, errs, warns)

        # 회사명 각색, 그리고 실제 회사명이 다른 칸에 남아 있는지 검사
        p["company"] = aliases.get(p.get("company", ""), p.get("company", ""))
        for group in texts_of(p):
            for t in group:
                for real in aliases:
                    if real and real in t:
                        errs.append(f"{path.name}: 실제 회사명 '{real}'이 남아 있음 → '{t}'")

        words = []
        for t in p.get("tasks", []):
            if not t.get("source"):
                continue
            w, note = rate(t, may, apr)
            if note:
                warns.append(f"{path.name}: {note}")
            if w:
                if t.get("from"):
                    w["from"] = t["from"]          # 공고의 어느 줄에서 나온 업무인지
                words.append(w)
        if len(words) < 4:
            errs.append(f"{path.name}: 판정이 붙은 업무가 4개 미만 ({len(words)}개)")
        if words and all(w["judge"] == "O" for w in words):
            warns.append(f"{path.name}: 사람 몫 업무가 하나도 없음. 게임이 너무 쉬워져요")

        built[p.get("id", path.stem)] = {
            "id": p.get("id"), "sample": bool(p.get("sample")), "field": p.get("field"), "job": p.get("job"),
            "company": p["company"], "position": p.get("position"), "intro": p.get("intro", ""),
            "stages": p.get("stages", []), "words": words,
            "traps": [t if isinstance(t, dict) else {"text": t} for t in p.get("traps", [])],
            "specs": p.get("specs", []), "skills": p.get("skills", []),
            "questions": p.get("questions", []), "terms": p.get("terms", []),
            "meta": {"aei_release": RELEASE, "period": PERIOD[:7], "onet": ONET, "builtAt": date.today().isoformat()}
        }

    for w in warns:
        print("[확인]", w)
    for s in skipped:
        print("[건너뜀]", s)
    if errs:
        for e in errs:
            print("[오류]", e)
        print(f"\n오류 {len(errs)}개. data/ 는 그대로 두었어요.")
        sys.exit(1)

    out = ROOT / "data" / "postings"
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.json"):
        if old.stem not in built:
            old.unlink()
    for pid, p in built.items():
        (out / f"{pid}.json").write_text(json.dumps(p, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    index = {"version": 2, "season": tax.get("season", ""), "builtAt": date.today().isoformat(), "fields": []}
    for f in tax["fields"]:
        jobs = []
        for j in f["jobs"]:
            ps = [{"id": p["id"], "company": p["company"], "position": p["position"], "stages": len(p["stages"]), "sample": p["sample"]}
                  for p in built.values() if p["field"] == f["id"] and p["job"] == j["id"]]
            jobs.append({"id": j["id"], "name": j["name"], "ncs": j.get("ncs", ""), "soc": j.get("soc", ""), "postings": ps})
        index["fields"].append({"id": f["id"], "name": f["name"], "short": f.get("short", f["name"]), "icon": f.get("icon", "building"),
                                "ncs": f.get("ncs", ""), "wing": f.get("wing", ""), "jobs": jobs})
    (ROOT / "data" / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"\n공고 {len(built)}개를 실었어요. 분야 {len(index['fields'])}개 → data/index.json")


if __name__ == "__main__":
    main()
