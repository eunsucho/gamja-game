// 게임 속 문구 모음. 대사·인트로·회고록 문장은 여기서만 고친다. (자리만 잡아 둔 예시 문구)
import { CONFIG } from "./config.js?v=20261103i";

// ---------- 세계관 인트로: 코미디 다큐 '감자극장' ----------
// img: assets/intro/ 그림, nar: 내레이션 자막(다큐 성우 톤), say: 감자 속마음, ai: AI 동기 한마디
// rules: true 인 장은 규칙 요약 카드
export const DOCU_TITLE = "감자극장 · 제1화 취업";
export const INTRO = [
  { img: "assets/intro/1_born.jpg", at: [0.5, 0.66], nar: `강원도 어느 감자밭.
오늘, 한 알의 감자가 태어났다.`, say: "응애." },
  { img: "assets/intro/2_child.jpg", at: [0.47, 0.56], nar: `감자는 무럭무럭 자랐다.
흙을 사랑했고, 햇볕을 사랑했다.
장래희망은 '큰 감자'였다.`, say: "나 커서 큰 감자 될 거야!" },
  { img: "assets/intro/3_college.jpg", at: [0.5, 0.5], nar: `스무 살, 감자는 감자대학교에 입학했다.
동아리, 축제, 그리고 학점 2.9.
감자는 행복했다.`, say: "인생 별거 없네~" },
  { img: "assets/intro/4_senior.jpg", at: [0.62, 0.6], nar: `그러나 졸업은 다가왔다.
동기들은 하나둘 떠나갔다.
인턴으로, 대학원으로, 감자튀김으로.`, say: "…나도 이제 뭐라도 해야 하나?" },
  { img: "assets/intro/5_dream.jpg", at: [0.3, 0.58], nar: `모든 감자의 꿈, 감자그룹.
연봉, 복지, 그리고 부모님의 자랑.`, say: `뭐 하는 회사인지는 모르겠지만…
나도 간다.` },
  { img: "assets/intro/6_rival.jpg", at: [0.32, 0.42], aiAt: [0.73, 0.43], nar: `그런데 올해 공채에는 특별한 지원자가 있었다.
지치지 않고, 밥도 안 먹는 AI 동기.`, say: "쟤도 지원했어…?", ai: "잘 부탁드립니다." },
  { img: "assets/intro/7_rain.jpg", at: [0.5, 0.7], nar: `공채 날, 공고 속 '할 일'이 비처럼 쏟아진다.
사람 몫은 감자가, AI 몫은 AI 동기가.
감자는 최종합격할 수 있을까.` },
  // 게임 설명: 화면 가운데에서 감자와 AI 동기가 번갈아 이야기한다
  { img: "assets/bg/street.jpg", story: { who: "me", text: "여기는 감자그룹 공채장.\n공고 속 진짜 업무가\n비처럼 쏟아진대!" } },
  { img: "assets/bg/street.jpg", story: { who: "ai", text: "난 AI 동기.\n사람들이 실제로 AI에게\n많이 맡기는 일은 내가 가져갈게.", sub: "근거: Anthropic Economic Index" } },
  { img: "assets/bg/street.jpg", story: { who: "me", text: "그럼 난 사람이 할 일을\n똑같이 쳐서 지킬게.\n이건 타자 게임이야!" } },
  { img: "assets/bg/street.jpg", story: { who: "ai", text: "타수는 맞게 친 단어로만 재.\n오타는 안 쳐줘!", sub: "1분에 친 자모 수 · 감자 = 5타" } }
];
// 규칙 카드: 그림 + 한 단어. (인트로 마지막 장 · 연습 전 · 일시정지)
export const RULES = [
  { who: "me", item: "key", word: "투자자 설명", label: "내가 입력" },
  { who: "ai", item: "grab", word: "동향 모니터링", label: "AI가 가져감" },
  { who: "no", item: "ban", word: "보도자료 배포", label: "치지 마" }
];

// ---------- 연습 라운드 ----------
export const TUT = {
  spawn: ["치지 말고 보기!", "똑같이 치고 Enter!", "이건 치지 마!"],
  ok: ["AI 동기가 가져갔죠?", "게이지 +1!", "준비 끝!"],
  okTypedAi: "AI 몫은 반 칸만!",
  chatTrap: "넘기기 누르기!",
  retry: ["", "한 번 더!", "옆 팀 일이에요!"],
  done: { floor: "연습 끝!", msg: "", tip: "" }
};

// ---------- 플레이 중 감자 대사 ----------
export const LINES = {
  start: "지원 완료. 서류 넣는 손이 떨린다…",
  typed: w => ["X", "□"].includes(w.judge) ? "이건 내 몫! 내가 챙겼다." : w.judge === "△" ? "AI랑 반반인 일, 그래도 내가 잡았다." : "이건 AI 동기 몫이었는데… 뭐 괜찮아.",
  "ai-grab": w => `AI 동기가 '${w.text}' 가져감. 일 잘하네…`,
  "ai-missed": () => "AI 동기도 놓쳤다… 팀장님 한숨.",
  "ai-saved": () => "AI 동기가 겨우 수습했다. 휴.",
  fail: (w, p) => p.fails >= CONFIG.failLimit - 1 ? "문자 또 왔다… 폰 보기 무섭다…" : `앗, '${w.text}' 놓쳤다…`,
  trap: (w, p) => p.owner ? `면접관: 그건 ${p.owner} 일인데요…` : "면접관: 그건 우리 일이 아닌데요…",
  spec: () => "스펙 장착! 잠깐 비가 느려진다.",
  pass: () => "옆 팀 일은 돌려보냈다.",
  "claim-ok": () => "내 몫이라고 설득 성공! 면접관 끄덕.",
  "claim-wrong": () => "면접관: 그건 AI가 더 잘하던데요?",
  salary: (w, p) => `초봉 ${p.salary.toLocaleString()}만 원! 더 올려!`
};

// AI 동기 반응 (말풍선 짧게)
export const BUDDY = {
  nod: "ㅇㅇ 그건 네 거",
  shrug: "그거 내 건데…",
  grab: "이건 제가 할게요",
  missed: "앗… 놓쳤다",
  claimWrong: "그건 제가 더 빨라요"
};

// 떠오르는 점수 글자: 숫자만. 함정·스펙처럼 숫자만으로 뜻이 안 보이는 것만 짧은 말을 붙인다
export const FLOAT = {
  trap: () => "함정",
  spec: () => "스펙",
  "claim-ok": () => "설득 성공",
  "claim-wrong": () => "우기기"
};

// ---------- 층 도착 카드 ----------
export const DOOR = {
  start: (f) => ({ floor: f.room, msg: `${f.step}단계`, tip: "" }),
  clear: (done, f, next, lv) => ({
    floor: `${done.name} 합격!`,
    msg: `${lv.name}${/[가-힣]$/.test(lv.name) && (lv.name.charCodeAt(lv.name.length - 1) - 44032) % 28 ? "으로" : "로"} 진화!`,
    tip: ""
  }),
  roof: { floor: "최종합격!", msg: "", tip: "" },
  termsLabel: "새 단어"
};

// ---------- 휴대폰 문자: 실제 채용 문자처럼 쓴다 ([Web발신] + 홈페이지 확인 안내) ----------
export const SMS = {
  app: "메시지",
  sender: "감자그룹 채용팀",
  // 플레이 중 불합격 문자 1·2·3통째. 같은 말투로 점점 불길해진다
  miss: (stage, n) => [
    `[Web발신] [감자그룹] 감자님, 2026 하반기 신입사원 공채 ${stage} 관련 안내드립니다. 채용 홈페이지에서 확인 바랍니다.`,
    `[Web발신] [감자그룹] 감자님, ${stage} 진행 상황을 재안내드립니다. 채용 홈페이지에서 확인 바랍니다.`,
    `[Web발신] [감자그룹] 감자님, ${stage} 결과가 발표되었습니다. 채용 홈페이지에서 확인 바랍니다.`
  ][Math.min(n, 3) - 1],
  // 결과 화면
  pass: () => "[Web발신] [감자그룹] 감자님, 2026 하반기 신입사원 공채 최종 합격을 진심으로 축하드립니다. 입사 안내는 채용 홈페이지에서 확인 바랍니다.",
  letters: stage => `[Web발신] [감자그룹] 감자님, ${stage} 결과가 발표되었습니다. 채용 홈페이지에서 확인 바랍니다.`,
  deadline: stage => `[Web발신] [감자그룹] 감자님, ${stage} 접수가 마감되었습니다. 채용 홈페이지에서 확인 바랍니다.`,
  quit: stage => `[Web발신] [감자그룹] 감자님, ${stage} 지원 철회가 접수되었습니다. 언제든 다시 지원하실 수 있습니다.`
};
// 결과 한 줄 (회고록 첫 장)
export const RESULT = {
  pass: "최종 합격",
  letters: s => `${s} 탈락`,
  deadline: s => `${s} 마감`,
  quit: s => `${s} 철회`,
  sayPass: "옥상이다…! 사원증이 나왔다…!",
  sayFail: "편의점 가서 삼각김밥이나 먹어야지…"
};

// ---------- 로비 ----------
export const LOBBY = {
  eyebrow: "감자그룹 채용 안내",
  title: "어디 지원할까?",
  say: "다 가고 싶고 다 무섭다…",
  empty: "공고 준비 중"
};
export const BRIEF = { label: "", tutorial: "연습하고 시작", go: "지원하기" };

// ---------- 머릿돌 · 출처 ----------
export const CREDITS = "AI 기록은 Anthropic Economic Index(2026-06-26 릴리스, CC-BY)를 O*NET 31.0(CC BY 4.0) 직무와 연결한 것이에요. 수치는 사람들이 그 일을 AI에게 시킨 대화 중 AI가 끝까지 처리한 비율이고, 게임에서는 이를 AI 동기의 성공 확률로 단순화했어요. 대체 가능성을 뜻하지 않아요. 회사와 공고는 실제 공고를 각색한 가상 공고예요. 분야 분류는 NCS 직무분류를 따랐어요.";

// ---------- 감자 회고록: 오늘 배운 것 ----------
// 플레이 기록 r 과 공고 p 를 보고 맞는 문장을 우선순위대로 최대 3개 고른다. 모자라면 기본 문장으로 채운다.
export const LESSONS = [
  { when: (r, x) => x.missedMine.length >= 1, short: "놓친 일 = 사람 몫", say: (r, x) => ({ head: "이 자리의 핵심은 사람이 판단하고 설명하는 일이었어요", body: `놓친 일: ${x.missedMine.slice(0, 3).join(", ")}` }) },
  { when: r => r.trapHits >= 1, short: "옆 팀 일은 패스", say: () => ({ head: "옆 팀의 일까지 이 자리 일로 봤어요", body: "비슷해 보이는 직무끼리도 맡는 일이 달라요. 공고의 '주요 업무'에 있는 일만 이 자리의 일이에요." }) },
  { when: r => r.aiTyped >= 3, short: "AI 몫은 맡기기", say: () => ({ head: "AI 동기가 잘하는 일에 시간을 썼어요", body: "실제로도 이런 일은 사람들이 AI에게 많이 맡겨요. 내 시간은 사람 몫에 쓰는 게 이득이에요." }) },
  { when: r => r.claimOk >= 1, short: "내 몫 설명 성공!", say: () => ({ head: "'이건 사람 몫'이라고 설명할 수 있었어요", body: "AI 시대 면접에서 내 몫을 설명하는 힘은 강력한 무기예요." }) },
  { when: r => r.claimWrong >= 1, short: "우기면 설득력 ↓", say: () => ({ head: "AI가 잘하는 일까지 내 몫이라고 우기면 설득력이 떨어져요", body: "어디까지 AI에게 맡기고 어디부터 내가 하는지 나눠서 말해 봐요." }) },
  { when: r => r.specHits >= 3, short: "스펙보다 할 일", say: () => ({ head: "스펙은 잠깐 도움이 될 뿐이에요", body: "이 자리에서 무슨 일을 하는지 아는 게 먼저예요." }) }
];
export const LESSON_DEFAULTS = [
  { short: "한 공고 = AI 몫 + 사람 몫", head: "한 공고 안에도 AI가 많이 하는 일과 사람이 주도하는 일이 섞여 있어요", body: "직무 이름만 보고 'AI가 대체한대'라고 판단하기엔 일이 너무 다양해요." },
  { short: "직무명보다 담당업무", head: "직무 이름보다 담당업무 한 줄 한 줄이 그 자리를 더 잘 설명해요", body: "같은 'IR'이어도 회사마다 하는 일이 달라요." },
  { short: "AI가 해도 자리는 남아요", head: "AI가 하는 일이 있다고 그 자리가 사라지는 건 아니에요", body: "사람 몫이 어디인지 아는 사람이 그 자리에 맞는 사람이에요." }
];

export const TODO_DEFAULT = [
  "공고의 '주요 업무'를 먼저 읽고, 사람이 판단하고 설명하는 일에 밑줄 긋기",
  "그 일을 해 본 경험을 자기소개서 한 문단으로 써 보기"
];

// ---------- 회고록: 판정 이름과 근거 문장 ----------
export const JUDGE_LABEL = { "O": "AI가 많이 하는 일", "△": "AI와 같이 하는 일", "X": "사람이 주도하는 일", "□": "AI에게 거의 안 시키는 일" };
export function pctPhrase(w) {
  return w.pct == null
    ? "AI 사용 기록에서 거의 확인되지 않은 일이에요. 못 한다는 뜻이 아니라 아직 잘 안 시키는 일이에요."
    : `사람들이 이 일을 AI에게 시킨 대화 중 ${w.pct}%에서 AI가 끝까지 처리했어요.`;
}

// ---------- 감자 행복도 (결과 · 도감 · 공유 카드) ----------
export const LEVELS = [
  { img: "assets/potato/lv0_dirt.png", name: "흙감자", say: "흙으로 돌아갈래…" },
  { img: "assets/potato/lv1_steam.png", name: "찐감자", say: "그래도 좀 익었다" },
  { img: "assets/potato/lv2_pancake.png", name: "감자전", say: "노릇노릇 자신감!" },
  { img: "assets/potato/lv3_fries.png", name: "감자튀김", say: "바삭하게 거의 다 왔다!" },
  { img: "assets/potato/lv4_gold.png", name: "황금감자", say: "최종합격! 사원증 GET" }
];
// 합격 = 4. 아니면 통과한 전형 비율로 0~3, 사람 몫을 80% 넘게 지켰으면 한 단계 위(최대 3)
export function levelOf(r, stages) {
  if (r.passed) return 4;
  const normal = stages.filter(s => s.type !== "bonus").length || 1;
  let lv = Math.min(3, Math.floor((r.reached / normal) * 4));
  if ((r.guard ?? 0) >= 80) lv = Math.min(3, lv + 1);
  return lv;
}
// 기기별 평균 타수(한글, 분당 자모). 대략값: PC 300타 · 폰 200타 (모바일은 PC의 약 0.7배)
export const AVG_CPM = { pc: 300, phone: 200 };

// ---------- 회사 로고 (assets/logos, Figma 생성) ----------
export const COMPANY_LOGO = {
  "감자바이오": "bio", "감자홀딩스": "holdings", "감자케미칼": "chem", "한국감자공사": "energy", "감자은행": "bank",
  "팀감자": "team", "감자식품": "food", "감자전자": "electronics", "감자몰": "mall", "감자텔레콤": "telecom",
  "감자스튜디오": "studio", "감자페이": "pay", "감자대학교병원": "hospital", "감자과학수사연구원": "forensic"
};
export const logoOf = name => `assets/logos/${COMPANY_LOGO[name] || "sprout"}.png`;

// 분야별 감자 옷 (assets/outfit, Figma 생성)
export const OUTFIT = { biz: "biz", finance: "finance", sales: "sales", it: "it", design: "design", health: "health", science: "science" };
export const outfitOf = field => `assets/outfit/${OUTFIT[field] || "default"}.png`;
