// 게임 밸런스 값. 콘텐츠와 상관없이 여기 숫자만 바꿔서 난이도를 맞춘다.
export const CONFIG = {
  failLimit: 3,               // 불합격 문자 몇 통이면 그 전형에서 탈락
  floorSteps: 8,              // 다음 층까지 올라가야 하는 칸 수 (다 채우면 그 전형 합격)
  stageSeconds: 60,           // 일반 전형 마감 시간(초). 그 안에 칸을 다 못 채우면 마감 탈락
  bonusSeconds: 15,           // 처우협의(보너스) 길이(초)
  // 업무 단어가 10~14자라 한 개 치는 데 4~5초 걸린다. 사람 몫만 쳐도 되니 생성 간격을 그보다 조금 짧게 둔다
  fallSeconds: 11,            // 1단계에서 단어가 바닥까지 떨어지는 시간(초)
  fallSpeedUp: 0.88,          // 단계가 오를 때마다 떨어지는 시간에 곱하는 값
  spawnSeconds: 2.6,          // 1단계 단어 생성 간격(초)
  spawnSpeedUp: 0.9,         // 단계가 오를 때마다 생성 간격에 곱하는 값
  // 폰 화면 키보드는 실제 키보드보다 느리다. 대규모 측정에서 평균이 데스크탑 51.6 WPM(Dhakal 외, CHI 2018),
  // 모바일 36.2 WPM(Palin 외, MobileHCI 2019)이라 약 1.4배 걸린다. 폰에서는 낙하·생성 간격·마감을 이만큼 늘린다
  mobilePace: 1.4,
  maxOnScreen: 7,             // 화면에 동시에 떠 있는 최대 단어 수
  trapRate: 0.12,             // 함정 단어 비율 (trap 기능이 켜진 전형)
  specRate: 0.08,             // 스펙 아이템 비율 (spec 기능이 켜진 전형)
  spotlightRate: 0.25,        // 면접 질문 이벤트가 붙을 확률 (interview 기능이 켜진 전형)
  aiGrabWindow: [0.35, 0.8],  // O 단어를 AI 동기가 낚아채려 시도하는 높이 구간(0=맨 위, 1=바닥)
  partialMissFail: 0.5,       // △ 단어를 놓쳤을 때 불합격 문자가 올 확률
  specSlowSeconds: 3,         // 스펙 아이템 효과 시간(초)
  specSlowFactor: 0.45,       // 스펙 아이템 효과 동안 낙하 속도 배율
  steps: {                    // 엘리베이터가 움직이는 칸 수
    mine: 1,                  // X·□ 단어를 받아침
    partial: 1,               // △ 단어를 받아침
    aiOwned: 0.5,             // O 단어를 직접 받아침 (AI 동기 몫이라 반 칸)
    trap: -0.5,               // 함정 단어를 받아침
    miss: -1                  // 불합격 문자를 받음 (덜컹)
  },
  score: {
    mine: 120,                // X·□ 단어를 받아침
    partial: 90,              // △ 단어를 받아침
    aiOwned: 30,              // O 단어를 직접 받아침 (해도 되지만 AI 동기 몫)
    trap: -150,               // 함정 단어를 받아침
    spec: 40,                 // 스펙 아이템을 받아침
    claimOk: 150,             // 면접 질문에 '내 몫'을 제대로 주장
    claimWrong: -100,         // AI 몫인데 내 몫이라고 우김
    aiMissed: -20,            // AI 동기도 놓친 O 단어가 바닥에 닿음
    comboStep: 10             // 콤보 1당 추가 점수
  },
  mood: { spark: 3, fire: 7, oopsMs: 1100 },  // 감자 표정이 바뀌는 콤보 기준, 실수 표정 유지 시간
  tutorialFall: 7,            // 연습 라운드에서 단어가 떨어지는 시간(초)
  salaryBase: 3800,           // 처우협의 시작 초봉(만원, 농담용)
  salaryPerKey: 4             // 처우협의에서 타수 1당 오르는 초봉(만원)
};
