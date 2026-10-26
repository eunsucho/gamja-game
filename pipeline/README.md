# 공고 파이프라인

공고를 모아서 게임에 싣는 길이에요. 게임은 `data/`만 읽고, `data/`는 `build.py`만 만들어요.

```
1 collect.py       공고 원문 모으기          → pipeline/raw/<id>.txt          (git 제외: 저작권)
2 extract.py       구역 나누기·후보 뽑기     → pipeline/review/<id>.csv       (git 제외: 원문 포함)
   (사람)          확인표를 엑셀로 열어 고치기
3 apply_review.py  확인표 → 공고 콘텐츠      → content/postings/<id>.json     (실제 회사명은 각색)
4 build.py         판정 계산·검사·색인       → data/index.json, data/postings/*.json
```

모든 명령은 `gamja-game` 폴더에서 실행해요.

## 1. 원문 모으기 (`collect.py`)

| 방법 | 언제 | 명령 |
|---|---|---|
| text | 공고 본문을 복사해 `pipeline/raw/<id>.txt`로 저장했을 때. 가장 확실해요 | `py pipeline/collect.py text --id sk-bio-ir --company "실제회사명" --site "채용 사이트"` |
| url | 공고 페이지가 글자로 된 HTML일 때. robots.txt가 막은 곳은 가져오지 않아요 | `py pipeline/collect.py url --id xxx --url https://... --company "실제회사명"` |
| api | 고용24 같은 공공 API. `sources.example.json`을 `sources.json`으로 복사해 호출 주소를 채우고, 인증키는 환경변수(`WORK24_KEY`)로만 넘겨요 | `py pipeline/collect.py api --source work24 --keyword IR` |

- id는 영어 소문자·숫자·하이픈이에요. 이 id가 끝까지 공고 이름이 돼요.
- 채용 사이트 상당수는 자바스크립트로 글자를 그려서 url 방법으로는 비어 있을 수 있어요. 그때는 text 방법을 써요.
- 고용24 API의 정확한 호출 주소와 파라미터 이름은 활용 신청 후 받는 명세를 따라야 해서 비워 뒀어요.

## 2. 후보 뽑기 (`extract.py`)

```bash
py pipeline/extract.py --id sk-bio-ir
```

원문을 소개·담당업무·자격요건·우대사항·전형절차로 나누고, 확인표 한 줄에 후보 하나씩 적어요.

| kind | 무엇 | 사람이 할 일 |
|---|---|---|
| task | 담당업무 줄 | `game_text`를 실무 표현으로 고쳐 쓰고(예: 'IR 자료 작성 지원' → 'IR Book 숫자 업데이트'), `candidates`의 O*NET 업무 중 맞는 것을 `source`에 옮겨요. 근사 연결이면 `match`를 '근사'로 |
| spec | 자격요건·우대사항 | 게임에 쓸 짧은 스펙 단어로 다듬어요 |
| stage | 전형 이름 | `features`에 spec · trap · interview · bonus |
| term | 낯선 단어 후보 | `desc`에 한 줄 풀이를 써요. 풀이가 없으면 싣지 않아요 |
| trap | 옆 직무의 일 (빈 줄) | 이 직무와 헷갈리는 다른 팀의 일을 `game_text`에, 그 팀을 `owner`에, 한 줄 이유를 `desc`에 |
| intro | 소개 문장 | 이 자리를 한 줄로 소개해요 |

- `keep`: Y = 싣기, N = 빼기, ? = 아직 안 봄. Y인 줄만 실려요.
- 담당업무 머리말이 없는 공고(소개 문단만 있는 공고)는 문장 단위로 후보를 뽑고 keep을 ?로 둬요.
- `candidates`는 `dwa_hints.csv`의 한국어 키워드로 고른 O*NET 업무 3개와 그 판정이에요. 키워드가 부족하면 이 파일에 한 줄씩 더해요.
- 4월·5월 판정이 다른 업무는 build에서 빠지므로 후보에서도 뺐어요.
- 이미 있는 확인표는 덮어쓰지 않아요(사람이 고친 내용 보호). 다시 뽑으려면 `--force`.

## 3. 콘텐츠로 옮기기 (`apply_review.py`)

```bash
py pipeline/apply_review.py --id sk-bio-ir --field biz --job ir --position "IR 신입"
py pipeline/apply_review.py --id sk-bio-ir --field biz --job ir --position "IR 신입" --reviewed --force
```

- 실제 회사명은 `pipeline/aliases.csv`(`real,alias`)로 바꿔요. 대응표에 없으면 멈춰요. 회사명이 들어간 모든 문장도 함께 바꿔요.
- 처음에는 `draft`로 저장돼요. 다 확인했으면 `--reviewed`를 붙여야 게임에 실려요.
- 면접 질문(`questions`)과 필요 역량(`skills`)은 확인표에 없어서 content 파일에서 직접 채워요.

## 4. 빌드 (`build.py`)

```bash
py pipeline/build.py
```

- 업무마다 AEI 판정(O·△·X·□)을 붙이고, 4월·5월 판정이 다른 업무는 빼요.
- 실제 회사명이 어디든 남아 있으면 오류로 멈추고, 오류가 하나라도 있으면 `data/`를 건드리지 않아요.

## 공고 콘텐츠 형식 (`content/postings/<id>.json`)

| 칸 | 내용 |
|---|---|
| `tasks` | `{text, source, match, from}` · 게임에 내려오는 업무 단어, O*NET 업무, 연결 정확도, 공고 원문 줄 |
| `traps` | `{text, owner, why}` · 옆 직무의 일. 일반 업무와 똑같이 내려오고, 치면 "그건 ○○팀 일인데요" |
| `specs` | 서류 전형의 스펙 단어 |
| `terms` | `{term, desc}` · 낯선 단어 풀이. 그 층에 나온 단어는 층 도착 카드에, 전부는 회고록에 보여요 |
| `questions` | 면접 전형에서 반짝이는 단어에 붙는 면접관 질문 |
| `stages` | 전형 = 층. `features`: spec · trap · interview, 또는 `"type": "bonus"` |

## 분야 · 직무 분류 (`content/taxonomy.json`)

- 분야 = 로비의 탭. NCS 직무분류 대분류 코드(`ncs`)를 따르고, `icon`(Tabler 아이콘 이름)과 `short`(탭 이름)를 둬요.
- 직무 = 그 분야 안의 한 묶음. `soc`에는 O*NET 직업 코드를 확인된 것만 적어요.

## AEI · O*NET 원자료 위치

기본값은 `Desktop/2026/aei_lesson/work/global_dwa.csv`와 `aei_lesson/onet/tasks_to_dwas.csv`예요. 다른 곳에 있으면 `--aei`, `--onet`으로 알려 주세요.
