# 감자 취업시켜줘!!

**플레이:** https://eunsucho.github.io/gamja-game/ · **수업 학습지:** https://eunsucho.github.io/gamja-game/worksheet/

취준생 감자가 되어 채용공고 속 **진짜 업무**를 받아치는 타자 게임이에요. 한컴타자 '산성비' 오마주.
어떤 업무를 사람들이 실제로 AI에게 많이 맡기는지는 **Anthropic Economic Index** 기록을 따라요.
성균관대 사회공헌 팀 TAG 진로교육 프로젝트의 Track 2(대학생 대상)입니다.

## 어떻게 하는 게임인가요

- 공고를 고르면 그 공고의 전형(서류 → 필기 → 면접 → …)이 스테이지가 돼요. 스테이지마다 합격 게이지를 채우면 다음 전형으로 가고, 마지막 전형을 통과하면 최종합격이에요.
- 업무 단어는 세 종류예요.
  - **내가 입력:** 사람이 주도하는 일(X)과 AI에게 거의 안 시키는 일(□). 똑같이 치고 Enter → 게이지 +1
  - **AI가 가져감:** AI가 많이 하는 일(O). 그냥 두면 옆자리 AI 동기가 가져가요. 쳐도 반 칸뿐
  - **치지 마:** 비슷해 보이는 옆 팀의 일. 치면 게이지가 줄어요 (메신저 모드에서는 '넘기기' 버튼)
- 사람 몫을 놓치면 채용팀 불합격 문자가 와요. 3통이거나 마감 시간이 지나면 탈락이에요.
- 전형을 통과할 때마다 감자가 진화해요: 흙감자 → 찐감자 → 감자전 → 감자튀김 → 황금감자.
- 타수는 맞게 친 단어만, 첫 글자부터 Enter까지 걸린 시간으로 재요 (1분에 친 자모 수, 오타·기다린 시간 제외).

## 플레이 방식 두 가지

| 기기 | 방식 | 설명 |
|---|---|---|
| PC | 산성비 | 단어가 위에서 떨어져요 |
| 폰 | 메신저 업무톡 | 업무가 팀장님 메시지로 쌓이고, 말풍선 옆 원이 줄어들며 남은 시간을 보여 줘요. 키보드가 올라와도 화면이 자연스러워요 |

주소 끝에 `?mode=chat` 또는 `?mode=rain`을 붙이면 어느 기기에서든 바꿔 볼 수 있어요.
폰에서는 안드로이드는 전체화면으로, 아이폰은 '홈 화면에 추가'로 주소창 없이 할 수 있어요.

## 화면 흐름

| 화면 | 내용 |
|---|---|
| 타이틀 | 로고, 감자, 시작 · 감자극장 · 학습지 · 감자도감 |
| 감자극장 | 처음 한 번: 세계관 7장 → 감자와 AI 동기가 게임을 설명하는 4장 |
| 로비 | 분야(아래 탭)에 따라 옷이 바뀌는 감자, 공고 목록(회사 로고 · 직무) |
| 공고 | 회사 · 직무, 전형 스테이지 길 (1 서류 START → … → 최종합격) |
| 연습 | 처음 한 번: 단어 3종류 안내 → 실제 단어 3개로 연습 |
| 플레이 | 산성비 또는 메신저. 전형 통과 시 '○○ 합격! ○○로 진화!', 다음 전형 시작 시 '스피드업!', 스펙 아이템은 '스펙업!' |
| 결과 | 채용팀 문자 → 누르면 결과 카드: 감자·타수 → 퀴즈 → 배운 것 → 놓친 사람 몫 → 공유 카드 |
| 감자도감 | 공고마다 받은 최고 감자와 타수를 수집 카드로 모아요 |

## 수업 학습지

`worksheet/`에 AEI 직무별 Automation 추론 활동지가 있어요 (프로그래머 · 그래픽 디자이너 · 회계사 · 국과수 연구원).

- 웹: 눌러서 풀고, 'AI 기록과 비교하기'로 AEI 수치를 확인해요. 인쇄도 돼요.
- 원본 파일: `worksheet/aei_lesson_worksheet.docx`
- 그래픽 디자이너 4번('인쇄용 디지털 파일을 준비한다')은 정답지에 수치가 없어 '정답지 확인'으로 표시돼요.

## 폴더 구조

```
index.html              화면 뼈대
manifest.webmanifest    홈 화면에 추가(설치) 정보,  sw.js  설치용 서비스 워커
css/style.css           디자인
js/main.js              화면 전환, 연출, 연습, 결과·감자도감·공유 카드
js/game.js              게임 엔진 (산성비 · 메신저, AI 동기, 판정, 전형 진행, 타수)
js/scene.js             전형 단계 이름
js/copy.js              모든 문구, 행복도 단계, 회사 로고·감자 옷 연결
js/config.js            난이도 숫자
js/data.js              data/index.json 먼저 읽고, 공고 본문은 고를 때 받기
js/storage.js           개인 기록·도감, 인트로/연습 본 적 있는지 (브라우저에만 저장)
js/util.js              입력 비교, 한글 타수 계산
content/                사람이 확인한 공고 원본과 분야 목록 (여기를 고친다)
pipeline/               content → data 빌드, AEI 판정, 스크래핑 도구 (pipeline/README.md)
data/                   build.py 가 만드는 게임용 파일 (손으로 고치지 않음)
assets/                 bg/ 배경, intro/ 감자극장, items/ 아이템, outfit/ 옷 입은 감자,
                        potato/ 행복도 감자, logos/ 회사 로고, ui/ 버튼·카드·명패·원판, fonts/ 글꼴
worksheet/              수업 학습지 (웹 + docx)
tools/                  check_site.py 배포 전 점검, bump.py 버전 올리기, matte.py 그림 배경 오려 내기
design/assets.json      그림마다 어느 도구·프롬프트로 만들었는지
```

## 로컬에서 실행

공고 데이터를 `fetch`로 읽기 때문에 `index.html`을 더블클릭하면 동작하지 않습니다. 이 폴더에서 간단한 서버를 띄우세요.

```bash
py -m http.server 8000
```

브라우저에서 http://localhost:8000 을 엽니다.

## 콘텐츠 채우기

공고는 네 단계로 실어요. 자세한 방법은 [pipeline/README.md](pipeline/README.md)에 있어요.

```bash
py pipeline/collect.py text --id <공고id> --company "실제회사명"   # 1 원문 모으기
py pipeline/extract.py --id <공고id>                               # 2 확인표 만들기 → 엑셀로 고치기
py pipeline/apply_review.py --id <공고id> --field <분야> --job <직무> --position "<포지션>" --reviewed
py pipeline/build.py                                               # 4 게임 데이터 만들기
```

공고 하나에는 실무 업무 단어, 헷갈리는 옆 직무의 일(함정), 낯선 단어 풀이, 스펙 단어, 면접 질문이 들어가요.
`build.py`는 게임에 내려오는 단어에서 키보드로 치기 어려운 글자(가운데 점 · & / 괄호 등)를 빼고, '졸업 예정'·'경력'처럼 지원 자격인 문구는 스펙에서 제외해요.

## GitHub Pages 배포

빌드 과정이 없는 정적 사이트라, 이 폴더를 그대로 올리면 돼요. 모든 경로가 상대 경로라 저장소 이름이 바뀌어도 동작해요.

1. 점검을 돌려요. `[오류]`가 없어야 해요.
   ```bash
   py pipeline/build.py
   py tools/check_site.py
   ```
   - 게임 데이터가 content와 맞는지, 그림 경로가 다 있는지, 실제 회사명이 새지 않았는지, 공고 원문이 git에 올라가지 않는지 확인해요.
2. 저장소를 만들고 올려요 (처음 한 번).
   ```bash
   git init
   git add .
   git status
   git commit -m "first release"
   gh repo create <저장소이름> --public --source=. --push
   ```
   - `git status`에 `pipeline/raw/`, `pipeline/review/*.csv`, `pipeline/aliases.csv`가 보이면 멈추고 `.gitignore`를 확인해요.
3. 저장소 Settings → Pages → Build and deployment에서 **Deploy from a branch**, 브랜치 `main`, 폴더 `/ (root)`를 골라요.
4. 1~2분 뒤 `https://<계정>.github.io/<저장소이름>/`에서 열려요.
5. 공유 미리보기: `index.html`의 `og:image`를 `https://<계정>.github.io/<저장소이름>/assets/share.jpg`로, `og:url`을 게임 주소로 바꿔서 다시 올리면 카카오톡에서도 그림이 보여요.

이후 공고를 늘릴 때는 `build.py` → `check_site.py` → `tools/bump.py` → `git add` · `commit` · `push` 순서로 하면 돼요.

### 배포할 때 버전 올리기

`py tools/bump.py` 를 실행하면 CSS·JS·그림 주소의 버전 표시(`?v=`)가 한 번에 바뀌어요. 안 바꾸면 브라우저에 남은 예전 파일(특히 같은 이름의 그림)이 새 화면과 섞일 수 있어요.

## AEI 수치가 없을 때

`build.py`는 원자료(`aei_lesson/work/global_dwa.csv`)가 없으면 `pipeline/aei_subset.csv`를 써요. 수업 정답지(answer_key_raw.csv)에서 옮긴 DWA 약 120개의 5월 값과 4월 판정이 들어 있어요. 새 공고에 이 표에 없는 DWA를 쓰면 □(기록 없음)으로 판정되니, 원자료로 다시 빌드해 확인해요.

## 출처 표기

- Anthropic Economic Index, 2026-06-26 릴리스 (CC-BY)
- National Center for O*NET Development, O*NET 31.0 Database (CC BY 4.0)
- 게임에서는 'AI가 대화를 끝까지 처리한 비율'을 AI 동기의 성공 확률로 단순화했습니다. 이 수치는 대체 가능성이 아닙니다.
- 공고와 회사(감자그룹)는 실제 공고를 각색한 가상 콘텐츠입니다.
- 글꼴: 넥슨 메이플스토리체 (`assets/fonts`, 무료 글꼴)
- 그림: Canva AI(배경·감자극장·캐릭터), Figma AI(로고·아이템·버튼·옷·카드 등). 어느 도구·프롬프트로 만들었는지 `design/assets.json`에 적어 두었어요.

## 할 일

- [ ] 게임 이름 확정
- [ ] 공고를 실제 공고 원문 기준으로 다시 맞추기 (지금 14개는 공개 공고 여러 건을 각색, 현직자 확인 필요)
- [ ] 원자료(global_dwa.csv)로 다시 빌드해 □(기록 없음) 판정 확인
- [ ] 고용24 API 명세 받아 `pipeline/sources.json` 채우기
- [ ] 실제 폰에서 확인: 메신저 모드 키보드, 안드로이드 전체화면, 아이폰 홈 화면 추가, 공유하기
- [ ] 난이도 조정 (`js/config.js`)
- [ ] 코드·콘텐츠 라이선스 정하기
