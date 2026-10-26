# -*- coding: utf-8 -*-
"""업무 CSV → content/postings/<id>.json 의 "tasks" 배열.

CSV 칸: text(게임 단어), source(O*NET DWA 영문명, 정확히), match(높음/근사)
판정은 build.py 가 계산한다. 여기서는 확인용으로 판정 미리보기만 stderr에 보여 준다.

사용법:
  py pipeline/tasks_from_csv.py pipeline/review/sample.csv > tasks.json
"""
import argparse, csv, json, sys
from aei import load_aei, rate, DEFAULT_AEI


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("--aei", default=str(DEFAULT_AEI))
    a = ap.parse_args()
    may, apr = load_aei(a.aei)
    tasks = []
    with open(a.csv, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            t = {"text": r["text"].strip(), "source": r["source"].strip(), "match": (r.get("match") or "높음").strip()}
            word, note = rate(t, may, apr)
            print(f"  {word['judge'] if word else '제외'}  {t['text']}" + (f"   ← {note}" if note else ""), file=sys.stderr)
            tasks.append(t)
    json.dump(tasks, sys.stdout, ensure_ascii=False, indent=2)
    print()


if __name__ == "__main__":
    main()
