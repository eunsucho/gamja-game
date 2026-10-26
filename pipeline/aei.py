# -*- coding: utf-8 -*-
"""AEI 판정 공통 코드. build.py 와 tasks_from_csv.py 가 같이 쓴다.

판정 기준은 수업과 같음: 5월 GLOBAL DWA automation% 사분위수
(69.22 이상 O / 41.04 미만 X / 그 사이 △ / 기록 없음 □)
"""
import csv
from pathlib import Path

Q1, Q3 = 41.04, 69.22
RELEASE, PERIOD, PREV_PERIOD, ONET = "2026-06-26", "2026-05-01", "2026-04-01", "31.0"
METRIC = "collaboration_bucket_automation_pct"

# 저장소 기준 기본 위치: Desktop/2026/aei_lesson/work/global_dwa.csv
DEFAULT_AEI = Path(__file__).resolve().parents[3] / "aei_lesson" / "work" / "global_dwa.csv"


def judge(v):
    if v is None:
        return "□"
    return "O" if v >= Q3 else ("X" if v < Q1 else "△")


def load_aei(path=DEFAULT_AEI):
    """DWA 영문명 → (5월 값, 4월 값)"""
    may, apr = {}, {}
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["metric_id"] != METRIC:
                continue
            name = r["node_name"].strip()
            if r["date_start"] == PERIOD:
                may[name] = float(r["value"])
            elif r["date_start"] == PREV_PERIOD:
                apr[name] = float(r["value"])
    return may, apr


def rate(task, may, apr):
    """업무 한 줄의 판정. 반환: (word dict 또는 None, 메시지 또는 None)"""
    src = task["source"].strip()
    v, prev = may.get(src), apr.get(src)
    j = judge(v)
    if (v is not None or prev is not None) and judge(prev) != j:
        return None, f"'{task['text']}': 4월({judge(prev)})과 5월({j}) 판정이 달라서 뺌"
    note = None
    if v is None and prev is None:
        note = f"'{task['text']}': AEI 기록 없음(□). DWA 이름 철자를 한 번 더 확인"
    word = {"text": task["text"].strip(), "judge": j, "pct": None if v is None else round(v, 1),
            "source": src, "match": (task.get("match") or "높음").strip()}
    return word, note
