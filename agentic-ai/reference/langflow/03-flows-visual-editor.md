# Use the visual editor

Langflow의 비주얼 에디터를 사용하여 Flow 생성, 테스트, 공유.
Flow는 애플리케이션 워크플로우의 기능적 표현이며, 워크플로우의 개별 단계를 나타내는 컴포넌트로 구성.

드래그 앤 드롭 인터페이스로 복잡한 AI 워크플로우를 코드 작성 없이 생성 가능.
연결 가능한 리소스: 프롬프트, LLM, 데이터 소스, 에이전트, MCP 서버, 기타 도구 및 통합.

> **Tip**: 몇 분 만에 Flow를 빌드하고 실행하려면 [Langflow quickstart](/get-started-quickstart) 참조.

## Workspace

[Flow](/concepts-flows) 빌드 시 주로 워크스페이스와 상호작용.
[컴포넌트](/concepts-components) 추가, 설정, 연결하는 곳.

워크스페이스에서 접근 가능:
- **Playground**
- **Share** 메뉴
- **Logs**

### Workspace gestures and interactions

워크스페이스 탐색을 위한 단축키, 제스처, 기능:

| 작업 | 방법 |
|------|------|
| **수평/수직 패닝** | 워크스페이스 빈 영역 클릭 및 드래그 |
| **컴포넌트 재배치** | 컴포넌트를 워크스페이스 어디든 클릭 및 드래그 |
| **줌** | 마우스/트랙패드 스크롤 또는 **Canvas controls** 클릭 |
| **노트/코멘트 추가** | **Add Note** 클릭 |
| **키보드 단축키** | **Help** → **Shortcuts** |

컴포넌트 간 프로그래매틱 관계 변경: 컴포넌트 *edges* 또는 *ports* 조작.
자세한 정보: [Components overview](/concepts-components)

가이드 라인 활성화: **Help** → **Enable smart guides** 토글.

Flow 편집 불가 시: Flow가 [unlocked](/concepts-flows#lock-a-flow) 상태인지 확인.

## Playground

Flow에 **Chat Input** 컴포넌트가 있으면 **Playground**에서:
- Flow 실행
- Flow와 채팅
- 입력/출력 확인
- LLM 메모리 수정하여 실시간으로 응답 튜닝

**Basic Prompting** 템플릿으로 Flow 생성 후 워크스페이스에서 **Playground** 클릭하여 시도.

Flow에 **Agent** 컴포넌트가 있으면 **Playground**에서:
- 도구 호출 및 출력 표시
- 에이전트의 도구 사용 모니터링
- 응답 뒤의 추론 이해

에이전트 Flow 시도: **Simple Agent** 템플릿 또는 [Langflow quickstart](/get-started-quickstart).

자세한 정보: [Test flows in the Playground](/concepts-playground)

## Share

**Share** 메뉴 옵션 (Flow를 외부 애플리케이션에 통합):

| 옵션 | 설명 |
|------|------|
| **[API access](/concepts-publish#api-access)** | 자동 생성된 Python, JavaScript, curl 코드 스니펫으로 애플리케이션에 통합 |
| **[Export](/concepts-flows-import#export-a-flow)** | Flow를 JSON 파일로 로컬 머신에 내보내기 |
| **[MCP Server](/mcp-server)** | Flow를 MCP 호환 클라이언트의 도구로 노출 |
| **[Embed into site](/concepts-publish#embedded-chat-widget)** | Flow를 HTML, React, Angular 애플리케이션에 임베드 |
| **[Shareable Playground](/concepts-playground#share-a-flows-playground)** | **Playground** 인터페이스를 다른 사용자와 공유 |

> **Note**: Shareable Playground는 Playground 경험 공유용이며, 프로덕션 애플리케이션에서 Flow 실행용이 아님.
> Langflow Desktop에서는 사용 불가.

## See also

- [Manage files in Langflow](/concepts-file-management)
- [Global variables](/configuration-global-variables)
- [API keys and authentication](/api-keys-and-authentication)
