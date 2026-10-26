# 감자 취업시켜줘!! ㅜㅜ (가제)

취준생 감자가 되어 채용공고 속 **진짜 할 일**을 받아치며 감자그룹 본사 옥상까지 올라가는 타자 게임. 한컴타자 '산성비' 오마주.
성균관대 사회공헌 팀 TAG 진로교육 프로젝트의 Track 2(대학생 대상)입니다.

- 공고의 전형절차가 본사 층수예요. 전형 하나가 층 하나이고, 옥상에 닿으면 최종합격이에요.
- 사람이 주도하는 일(X)과 AI에게 거의 안 시키는 일(□)을 받아치면 엘리베이터가 한 칸 올라가요. 칸을 다 채우면 다음 층으로 가요.
- 사람 몫을 놓치면 불합격 문자가 오고 엘리베이터가 덜컹 내려가요. 3통이 오거나 마감 시간이 지나면 탈락이에요.
- AI가 많이 하는 일(O)은 옆자리 AI 동기가 낚아채 가요.
- 처음 하는 사람은 세계관 인트로 5장과 연습 라운드(단어 3개)를 먼저 봐요. 끝나면 '감자 회고록'에서 오늘 배운 것을 정리해 줘요.

## 화면 구성

화면마다 일러스트 배경 한 장 위에 UI를 최소로 얹어요. UI는 두 가지뿐이에요: 배경을 비추는 유리 패널과 버터색 버튼. 배남주 핑크는 감자그룹 CI 색이라 로고·사원증·채용팀 문자에만 써요.

| 화면 | 배경 (assets/) | 내용 |
|---|---|---|
| 타이틀 | bg/street.jpg | 로고, 감자, 시작 버튼 |
| 감자극장 (인트로) | intro/1~7.jpg | 코미디 다큐 7장 + 규칙 1장. 문구는 js/copy.js 의 INTRO |
| 로비 | bg/lobby.jpg | 매달린 안내판, 분야 탭, 공고 카드 (회사 · 포지션만) |
| 엘리베이터 홀 | bg/hall.jpg | 포지션과 전형(=층) 목록, 지원 버튼 |
| 플레이 | bg/lift_day → lift_sunset → lift_clouds | 올라갈수록 창밖이 낮 → 노을 → 구름 위로 바뀜 |
| 결과 | bg/roof.jpg (합격) · bg/exit.jpg (탈락) | 채용팀 문자, 감자, 한 장씩 넘기는 회고록 |

그림은 Canva AI로 만들었고, 어느 Canva 이미지인지 `design/assets.json`에 적어 두었어요. 지금 파일은 미리보기를 키운 임시본이라 흐려요. 원본으로 바꿀 때 파일 이름은 그대로 두면 돼요.

## 폴더 구조

```
index.html              화면 뼈대 (장소 6개)
css/style.css           디자인
js/main.js              화면 전환, 연출, 연습 라운드, 회고록 조립, 폰 키보드 높이 맞춤
js/game.js              산성비 엔진 (생성 · 낙하 · AI 동기 · 판정 · 층 진행)
js/scene.js             창밖 풍경, 거리, 층 이름, 본사 건물 그림
js/copy.js              모든 문구
js/config.js            난이도 숫자
js/data.js              data/index.json 먼저 읽고, 공고 본문은 고를 때 받기
js/storage.js           개인 기록, 인트로/연습 본 적 있는지 (브라우저에만 저장)
js/util.js              입력 비교, 한글 타수 계산
tools/check_site.py     배포 전 점검
content/taxonomy.json   분야(동) · 직무 목록 (NCS 기준)
content/postings/       사람이 확인한 공고 원본 (여기를 고친다)
pipeline/               content → data 빌드, CSV 도구, 스크래핑 원본 자리 (pipeline/README.md)
data/                   build.py 가 만드는 게임용 파일 (손으로 고치지 않음)
assets/                 캐릭터(배경 투명 PNG), bg/ 배경, intro/ 감자극장 그림
design/                 UI 샘플, 그림별 Canva 출처(assets.json)
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

이후 공고를 늘릴 때는 `build.py` → `check_site.py` → `git add` · `commit` · `push` 순서로 하면 돼요.

## 출처 표기

- Anthropic Economic Index, 2026-06-26 릴리스 (CC-BY)
- National Center for O*NET Development, O*NET 31.0 Database (CC BY 4.0)
- 게임에서는 'AI가 대화를 끝까지 처리한 비율'을 AI 동기의 성공 확률로 단순화했습니다. 이 수치는 대체 가능성이 아닙니다.
- 공고와 회사(감자그룹)는 실제 공고를 각색한 가상 콘텐츠입니다.

## 할 일

- [ ] 게임 이름 확정
- [ ] 최종 공고 콘텐츠 채우기 (샘플 두 개 교체)
- [ ] 고용24 API 명세 받아 `pipeline/sources.json` 채우기
- [ ] 공고 늘리기 (현직자 확인 후)
- [ ] 캐릭터 고해상도 이미지로 교체 (현재 200px, 주인공 디자인 확정 후)
- [ ] 문구 확정 (`js/copy.js`)
- [ ] 난이도 조정 (`js/config.js`)
- [ ] 코드·콘텐츠 라이선스 정하기
