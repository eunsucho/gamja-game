// 게임 속 문구 모음. 대사·인트로·회고록 문장은 여기서만 고친다. (자리만 잡아 둔 예시 문구)
import { CONFIG } from "./config.js";

// ---------- 세계관 인트로: 코미디 다큐 '감자극장' ----------
// img: assets/intro/ 그림, nar: 내레이션 자막(다큐 성우 톤), say: 감자 속마음, ai: AI 동기 한마디
// rules: true 인 장은 규칙 요약 카드
export const DOCU_TITLE = "감자극장 · 제1화 취업";
export const INTRO = [
  { img: "assets/intro/1_born.jpg", nar: `강원도 어느 감자밭.
오늘, 한 알의 감자가 태어났다.`, say: "응애." },
  { img: "assets/intro/2_child.jpg", nar: `감자는 무럭무럭 자랐다.
흙을 사랑했고, 햇볕을 사랑했다.
장래희망은 '큰 감자'였다.`, say: "나 커서 큰 감자 될 거야!" },
  { img: "assets/intro/3_college.jpg", nar: `스무 살, 감자는 감자대학교에 입학했다.
동아리, 축제, 그리고 학점 2.9.
감자는 행복했다.`, say: "인생 별거 없네~" },
  { img: "assets/intro/4_senior.jpg", nar: `그러나 졸업은 다가왔다.
동기들은 하나둘 떠나갔다.
인턴으로, 대학원으로, 감자튀김으로.`, say: "…나도 이제 뭐라도 해야 하나?" },
  { img: "assets/intro/5_dream.jpg", nar: `모든 감자의 꿈, 감자그룹.
연봉, 복지, 그리고 부모님의 자랑.`, say: `뭐 하는 회사인지는 모르겠지만…
나도 간다.` },
  { img: "assets/intro/6_rival.jpg", nar: `그런데 올해 공채에는 특별한 지원자가 있었다.
지치지 않고, 밥도 안 먹는 AI 동기.`, say: "쟤도 지원했어…?", ai: "잘 부탁드립니다." },
  { img: "assets/intro/7_rain.jpg", nar: `공채 날, 공고 속 '할 일'이 비처럼 쏟아진다.
감자는 과연 옥상까지 올라갈 수 있을까.` },
  { img: "assets/bg/street.jpg", rules: true }
];
export const RULES = [
  { pill: "투자자에게 실적 설명", cls: "", title: "내 몫", desc: "쳐서 받아치면 올라가요" },
  { pill: "시장 동향 모니터링", cls: "", title: "AI 동기 몫", desc: "두면 AI 동기가 가져가요" },
  { pill: "보도자료 배포", cls: "", title: "옆 팀의 일", desc: "헷갈려도 치면 덜컹 내려가요" }
];

// ---------- 연습 라운드 ----------
export const TUT = {
  spawn: [
    "가만히 봐! 이건 AI가 많이 하는 일이야.\nAI 동기가 가져가지?",
    "이건 내 몫이야!\n똑같이 입력하고 Enter!",
    "비슷해 보여도 이건 옆 팀 일이야.\n치지 마!"
  ],
  ok: [
    "봤지? AI 동기 몫은 맡겨도 돼.",
    "좋아! 내 몫을 받아치면 엘리베이터가 올라가.",
    "완벽해. 이제 진짜 공채다!"
  ],
  okTypedAi: "쳐도 되지만, AI 동기 몫이라 반 칸만 올라가.",
  retry: [
    "",
    "앗, 떨어졌다! 한 번 더 내려올게. 쳐 봐!",
    "치면 안 돼! 면접관이 실망해서 덜컹 내려가. 다시!"
  ],
  done: { floor: "연습 끝", msg: "준비 완료!", tip: "이제 진짜 서류 접수가 시작돼요." }
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
  start: (f) => ({ floor: `${f.label} ${f.room}`, msg: "지원서 접수 시작", tip: `사람 몫 ${CONFIG.floorSteps}칸을 채우면 다음 층으로` }),
  clear: (done, f, next) => ({
    floor: `${f.label} ${f.room} 도착`,
    msg: `${done.name} 합격!`,
    tip: next.type === "bonus" ? "빨리 칠수록 초봉이 올라요" :
      (next.features || []).includes("interview") ? "반짝이는 단어는 면접관 질문이에요" :
      (next.features || []).includes("trap") ? "옆 팀의 일이 섞여 내려와요" : "비가 조금 더 빨라져요"
  }),
  roof: { floor: "옥상", msg: "최종합격!", tip: "사원증이 나왔어요" },
  termsLabel: "이번 층에서 나온 낯선 단어"
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
  eyebrow: "1F 로비 · 채용 안내",
  title: "어느 부서로 갈까?",
  say: "다 가고 싶고 다 무섭다…",
  empty: "공고 준비 중"
};
export const BRIEF = { label: "전형 = 층", tutorial: "연습 라운드부터", go: "지원서 제출" };

// ---------- 머릿돌 · 출처 ----------
export const CREDITS = "AI 기록은 Anthropic Economic Index(2026-06-26 릴리스, CC-BY)를 O*NET 31.0(CC BY 4.0) 직무와 연결한 것이에요. 수치는 사람들이 그 일을 AI에게 시킨 대화 중 AI가 끝까지 처리한 비율이고, 게임에서는 이를 AI 동기의 성공 확률로 단순화했어요. 대체 가능성을 뜻하지 않아요. 회사와 공고는 실제 공고를 각색한 가상 공고예요. 분야 분류는 NCS 직무분류를 따랐어요.";

// ---------- 감자 회고록: 오늘 배운 것 ----------
// 플레이 기록 r 과 공고 p 를 보고 맞는 문장을 우선순위대로 최대 3개 고른다. 모자라면 기본 문장으로 채운다.
export const LESSONS = [
  { when: (r, x) => x.missedMine.length >= 1, say: (r, x) => ({ head: "이 자리의 핵심은 사람이 판단하고 설명하는 일이었어요", body: `놓친 일: ${x.missedMine.slice(0, 3).join(", ")}` }) },
  { when: r => r.trapHits >= 1, say: () => ({ head: "옆 팀의 일까지 이 자리 일로 봤어요", body: "비슷해 보이는 직무끼리도 맡는 일이 달라요. 공고의 '주요 업무'에 있는 일만 이 자리의 일이에요." }) },
  { when: r => r.aiTyped >= 3, say: () => ({ head: "AI 동기가 잘하는 일에 시간을 썼어요", body: "실제로도 이런 일은 사람들이 AI에게 많이 맡겨요. 내 시간은 사람 몫에 쓰는 게 이득이에요." }) },
  { when: r => r.claimOk >= 1, say: () => ({ head: "'이건 사람 몫'이라고 설명할 수 있었어요", body: "AI 시대 면접에서 내 몫을 설명하는 힘은 강력한 무기예요." }) },
  { when: r => r.claimWrong >= 1, say: () => ({ head: "AI가 잘하는 일까지 내 몫이라고 우기면 설득력이 떨어져요", body: "어디까지 AI에게 맡기고 어디부터 내가 하는지 나눠서 말해 봐요." }) },
  { when: r => r.specHits >= 3, say: () => ({ head: "스펙은 잠깐 도움이 될 뿐이에요", body: "이 자리에서 무슨 일을 하는지 아는 게 먼저예요." }) }
];
export const LESSON_DEFAULTS = [
  { head: "한 공고 안에도 AI가 많이 하는 일과 사람이 주도하는 일이 섞여 있어요", body: "직무 이름만 보고 'AI가 대체한대'라고 판단하기엔 일이 너무 다양해요." },
  { head: "직무 이름보다 담당업무 한 줄 한 줄이 그 자리를 더 잘 설명해요", body: "같은 'IR'이어도 회사마다 하는 일이 달라요." },
  { head: "AI가 하는 일이 있다고 그 자리가 사라지는 건 아니에요", body: "사람 몫이 어디인지 아는 사람이 그 자리에 맞는 사람이에요." }
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
