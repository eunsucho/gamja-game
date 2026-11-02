# 작업 규칙 (항상 지킨다)

## 그림
- 아이콘·아이템·이모티콘·캐릭터 등 게임 그림은 **외부 MCP 이미지 생성 도구(Canva `generate-image`, Figma `generate_image` 등)로 만든다.**
- SVG·CSS 도형·이모지 글자로 직접 그려서 때우지 않는다.
- 만든 그림은 `assets/`에 넣고, 어느 도구·프롬프트로 만들었는지 `design/assets.json`에 적는다.

## 화면 글씨
- 화면에 글씨를 최소로. 설명은 그림·아이콘으로 보여 주고, 한 화면(카드)에 한 가지 정보만.
- 문장 설명 대신 짧은 단어 하나 + 그림.

## 디자인
- '진한 테두리 + 연한 채움' 패널·버튼 스타일 쓰지 않는다.
- 새 디자인은 실제 인기 게임 UI 레퍼런스를 찾아 근거로 삼는다.

## Git
- 커밋 작성자는 항상 **eunsucho <eunsucho@unc.edu>** 로 한다. (`git config user.name "eunsucho"`, `git config user.email "eunsucho@unc.edu"` 를 먼저 설정)
- 배포 전에 `py tools/bump.py` 로 CSS·JS·그림 주소의 버전 표시를 올린다.
- 작업용 시안·견본 파일은 저장소에 남기지 않는다. 다 쓰면 지운다.
