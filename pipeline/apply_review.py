# -*- coding: utf-8 -*-
"""3단계: 사람이 확인한 표(pipeline/review/<id>.csv) → content/postings/<id>.json

- keep 이 Y 인 줄만 싣는다. ? 가 남아 있으면 알려 준다
- 실제 회사명은 pipeline/aliases.csv 로 감자 회사명으로 바꾼다. 대응표에 없으면 멈춘다 (실명이 저장소에 들어가지 않게)
- 기본은 status "draft". 다 확인했으면 --reviewed 를 붙여야 build.py 가 게임에 싣는다

사용법 (gamja-game 폴더에서)
  py pipeline/apply_review.py --id sk-bio-ir --field biz --job ir --position "IR 신입"
  py pipeline/apply_review.py --id sk-bio-ir --field biz --job ir --position "IR 신입" --reviewed --force
"""
import argparse, csv, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
YES = {"Y", "y", "O", "o", "1", "예"}


def load_aliases():
    f = HERE / "aliases.csv"
    if not f.exists():
        return {}
    with open(f, encoding="utf-8-sig") as fh:
        return {r["real"].strip(): r["alias"].strip() for r in csv.DictReader(fh) if r.get("real")}


def dump(o):
    lines, items = ["{"], list(o.items())
    for i, (k, v) in enumerate(items):
        c = "," if i < len(items) - 1 else ""
        if isinstance(v, list) and v and isinstance(v[0], dict):
            lines.append(f'  "{k}": [')
            lines.append(",\n".join("    " + json.dumps(x, ensure_ascii=False) for x in v))
            lines.append("  ]" + c)
        else:
            lines.append(f'  "{k}": ' + json.dumps(v, ensure_ascii=False) + c)
    return "\n".join(lines + ["}"]) + "\n"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", required=True)
    ap.add_argument("--field", required=True, help="content/taxonomy.json 의 분야 id")
    ap.add_argument("--job", required=True, help="그 분야 안의 직무 id")
    ap.add_argument("--position", required=True, help="게임에 보일 포지션 이름")
    ap.add_argument("--reviewed", action="store_true", help="다 확인했으면 붙인다 (게임에 실림)")
    ap.add_argument("--force", action="store_true", help="이미 있는 content 파일을 덮어쓴다")
    a = ap.parse_args()

    meta_f, rev_f = HERE / "raw" / f"{a.id}.meta.json", HERE / "review" / f"{a.id}.csv"
    if not rev_f.exists():
        sys.exit(f"{rev_f} 가 없어요. extract.py 를 먼저 돌려 주세요.")
    meta = json.loads(meta_f.read_text(encoding="utf-8")) if meta_f.exists() else {}
    out = ROOT / "content" / "postings" / f"{a.id}.json"
    if out.exists() and not a.force:
        sys.exit(f"{out.name} 이 이미 있어요. 덮어쓰려면 --force")

    real = meta.get("company", "")
    aliases = load_aliases()
    if real and real not in aliases:
        sys.exit(f"pipeline/aliases.csv 에 '{real}' 의 감자 회사명이 없어요. 한 줄 추가해 주세요 (real,alias).")
    company = aliases.get(real, real) or "감자회사"

    with open(rev_f, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    pending = [r for r in rows if r["keep"].strip() == "?" and r["kind"] != "trap" and (r["original"] or r["game_text"])]
    keep = [r for r in rows if r["keep"].strip() in YES]
    pick = lambda k: [r for r in keep if r["kind"] == k]
    errs = []

    tasks = []
    for r in pick("task"):
        text, src = r["game_text"].strip(), r["source"].strip()
        if not text or not src:
            errs.append(f"업무 '{r['original'][:30]}…': game_text 와 source 를 채워 주세요")
            continue
        tasks.append({"text": text, "source": src, "match": r["match"].strip() or "높음", "from": r["original"].strip()[:40]})
    stages = []
    for r in pick("stage"):
        f = r["features"].split()
        stages.append({"name": r["game_text"].strip() or r["original"].strip(), "type": "bonus"} if "bonus" in f
                      else {"name": r["game_text"].strip() or r["original"].strip(), "features": [x for x in f if x in ("spec", "trap", "interview")]})
    traps = [{"text": r["game_text"].strip(), "owner": r["owner"].strip(), "why": r["desc"].strip()}
             for r in pick("trap") if r["game_text"].strip() and r["owner"].strip()]
    terms = [{"term": r["game_text"].strip(), "desc": r["desc"].strip()} for r in pick("term") if r["desc"].strip()]
    specs = [r["game_text"].strip() for r in pick("spec") if r["game_text"].strip()]
    intro = next((r["game_text"].strip() or r["original"].strip() for r in pick("intro")), "")

    if errs:
        for e in errs:
            print("[오류]", e)
        sys.exit(1)
    if pending:
        print(f"[확인] keep 이 '?' 인 줄이 {len(pending)}개 남았어요. 싣지 않았어요.")
    if a.reviewed and len(tasks) < 4:
        sys.exit("업무가 4개 미만이라 reviewed 로 표시할 수 없어요.")

    o = {"id": a.id, "status": "reviewed" if a.reviewed else "draft", "sample": False, "field": a.field, "job": a.job,
         "company": company, "position": a.position, "intro": intro, "stages": stages, "tasks": tasks,
         "traps": traps, "specs": specs, "skills": [], "questions": [], "terms": terms,
         "provenance": {"site": meta.get("site", ""), "scrapedAt": meta.get("collectedAt", ""), "url": meta.get("url", ""), "note": ""}}
    if real:
        def swap(v):
            if isinstance(v, str):
                return v.replace(real, company)
            if isinstance(v, list):
                return [swap(x) for x in v]
            if isinstance(v, dict):
                return {k: (x if k == "url" else swap(x)) for k, x in v.items()}
            return v
        o = {k: (v if k in ("id", "provenance") else swap(v)) for k, v in o.items()}
    out.write_text(dump(o), encoding="utf-8")
    print(f"content/postings/{out.name} ({o['status']}): 업무 {len(tasks)} · 전형 {len(stages)} · 함정 {len(traps)} · 스펙 {len(specs)} · 용어 {len(terms)}")
    if not traps:
        print("[확인] 옆 직무 함정이 비어 있어요. review 표의 trap 줄에 game_text 와 owner 를 채우면 좋아요.")


if __name__ == "__main__":
    main()
