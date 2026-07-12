// start-here/hands-on 예제 설명 페이지 목록(레지스트리).
//
// 이 파일에 항목만 추가하면 explain-exam/index.html(데이터 없이 열었을 때)의
// 예제 리스트에 자동으로 나타남. file:// 에서도 안전하도록 window 전역 할당만 함.
//
// 각 항목 필드:
//   chapter : (선택) 그룹 제목. 같은 chapter끼리 묶여 표시됨. 없으면 "기타"로 묶임.
//   name    : 예제 이름(굵게 표시)
//   file    : 대표 파일명(코드 스타일로 표시)
//   desc    : 한 줄 설명
//   link    : 설명 페이지 경로(이 explain-exam 폴더 기준 상대경로). 보통 "../<예제>/explain/index.html"
//   readme  : (선택) README URL
//   web     : (선택) 가시화 페이지 경로(이 폴더 기준 상대경로). 보통 "../<예제>/web/index.html".
//             값이 있으면 카드에 "가시화 설명" 버튼이 표시됨. 해당 예제에 web/index.html이 있을 때만 설정.
window.EXAMPLE_INDEX = [
  {
    chapter: "언어모델 종합실습",
    name: "llm",
    file: "attention_demo.py · train.py · translate.py",
    desc: "밑바닥부터 만드는 미니 Transformer 언어모델 — Self-Attention → 모델 조립 → 학습 → 번역(Cross-Attention)",
    link: "../llm/explain/index.html",
    readme: "https://github.com/cna-bootcamp/aistudy/tree/main/start-here/hands-on/llm",
    web: "../llm/web/index.html",
  },
];
