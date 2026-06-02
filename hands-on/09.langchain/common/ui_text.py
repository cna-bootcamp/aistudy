"""여행 플래너 LangChain 예제의 Streamlit 앱 공통 UI 텍스트 상수 모음."""

APP_TITLE = "여행 플래너"
APP_ICON = "🗺️"

WELCOME_MESSAGE = """안녕하세요. 오늘 여행 루트를 함께 정리하는 AI 여행 플래너임.

도시명을 알려주면 날씨, 관광지, 맛집 정보를 도구 호출로 조회한 뒤 오늘 일정으로 추천함.

예시
- 서울
- 도쿄 날씨
- 파리 관광지
- 부산 맛집
"""

USAGE_GUIDE = """### 사용 예시
- `서울`
- `도쿄 날씨`
- `파리 관광지`
- `부산 맛집`
- `제주 여행 루트`

### 요청 유형
- 날씨
- 관광지
- 맛집
- 여행루트

도시명만 입력하면 오늘의 여행 루트 추천 수행.
"""

TECH_GUIDE = """### LangChain ReAct 흐름
1. 사용자 요청 → HumanMessage 변환
2. create_react_agent가 LLM + 도구 루프 자동 실행
3. LLM이 tool_calls 생성 → 도구 실행 → ToolMessage로 결과 추가
4. tool_calls가 없을 때까지 3번 반복
5. 최종 AIMessage를 스트리밍으로 렌더링
"""
