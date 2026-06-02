# ALTK

**ALTK** 번들은 [Agent Lifecycle Toolkit](https://github.com/AgentToolkit/agent-lifecycle-toolkit)의 컴포넌트 구현.

> **Tip**: ALTK에는 *컴포넌트*라는 기능이 포함됨. 이는 Langflow 컴포넌트와 다름.
> ALTK 내 모든 컴포넌트는 Langflow의 **ALTK Agent** 컴포넌트를 통해 사용 가능.

## ALTK Agent

ALTK 기능을 독립적으로 활성화/비활성화 가능.

### 주요 기능

| 기능 | 설명 |
|------|------|
| **Pre-tool validation** | [SPARC](https://agenttoolkit.github.io/agent-lifecycle-toolkit/concepts/components/sparc/) 리플렉션 컴포넌트를 사용하여 실행 전 도구 호출 유효성 검증. 적절성과 정확성 확인. 에이전트의 잘못된 도구 호출 실행 방지. |
| **Post-tool JSON processing** | 대용량 JSON 도구 응답을 Python 코드를 즉석 생성하여 처리, 관련 데이터 추출. 컨텍스트 크기 감소 및 대용량 도구 응답 처리 능력 향상. 특히 대규모 JSON 데이터 반환 API 처리에 유용. 전체 JSON 대신 에이전트 응답을 포함한 [Message](/data-types#message) 출력. |

자세한 정보: [Agent Lifecycle Toolkit 문서](https://agenttoolkit.github.io/agent-lifecycle-toolkit/)

비디오 튜토리얼: [ALTK in Langflow: Reliably handle JSON responses in your AI agent](https://www.youtube.com/watch?v=YNwPBK_KxXY)

## ALTK Agent 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Type | 설명 |
|------|------|------|
| `agent_llm` | Dropdown | (입력) 에이전트가 응답 생성에 사용할 모델 공급자 |
| `enable_tool_validation` | Boolean | (입력) 활성화 시 SPARC를 사용하여 실행 전 도구 호출 유효성 검증. 기본값: `true` |
| `enable_post_tool_reflection` | Boolean | (입력) 활성화 시 JSON 출력이 크기 임계값 초과 시 자동으로 JSON 처리. 기본값: `true` |
| `response_processing_size_threshold` | Integer | (입력) 응답 길이가 이 문자 임계값 초과 시에만 도구 출력 후처리. 기본값: `100`. 고급 파라미터. |
| `tools` | List[Tool] | (입력) 에이전트에서 사용 가능한 도구 목록 |
| `system_prompt` | String | (입력) 에이전트에 컨텍스트를 제공하는 시스템 프롬프트 |
| `input_value` | String | (입력) 에이전트에 대한 사용자 입력 |
| `memory` | Memory | (입력) 컨텍스트 지속성을 위한 에이전트 메모리 |
| `max_iterations` | Integer | (입력) 에이전트 실행 허용 최대 반복 횟수 |
| `verbose` | Boolean | (입력) 에이전트의 중간 단계 출력 여부 결정 |
| `handle_parsing_errors` | Boolean | (입력) 에이전트의 파싱 오류 처리 여부 결정 |

