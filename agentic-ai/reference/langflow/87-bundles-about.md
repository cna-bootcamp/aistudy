# About Bundles

**번들(Bundles)**은 Langflow와 특정 서드파티 서비스 통합을 지원하는 커스텀 컴포넌트 모음.
Langflow의 Core 컴포넌트와 동일한 방식으로 Flow에 추가하고 설정 가능.

번들 탐색: 비주얼 에디터에서 **Bundles** 클릭.

## 번들 유지보수 및 문서화

- 많은 번들 컴포넌트는 서드파티 기여자가 개발
- 일부 공급자는 번들과 함께 문서 제공, 일부는 자체 문서에서 문서화, 일부는 문서 없음
- 특정 번들 컴포넌트 문서 찾기:
  - Langflow 문서 탐색
  - 공급자 문서 확인
  - 컴포넌트 자체에서 관련 문서 링크 찾기 (API 엔드포인트 등)

### 컴포넌트에서 문서 링크 찾기

1. 컴포넌트 클릭하여 [헤더 메뉴](/concepts-components#component-menus) 표시
2. **More** 클릭
3. **Docs** 선택

Langflow 문서는 Flow 내에서 번들 사용에 초점.
공급자별 기능이나 API 정보는 해당 공급자 문서 참조.

## 컴포넌트 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

## Core 컴포넌트와 번들

> **Tip**: Langflow 문서에 모든 번들이나 번들 내 컴포넌트가 나열되지 않음.
> 사용 중인 Langflow 버전의 정확한 번들/컴포넌트 목록은 비주얼 에디터의 **Bundles** 확인.
> 이전 버전에서 사용한 컴포넌트를 찾을 수 없으면 제거되었거나 [Legacy 컴포넌트](#legacy-번들)로 표시되었을 수 있음.

- Langflow는 서드파티 공급자별 번들 외에 범용 **Core 컴포넌트** 제공
- 특정 서비스나 통합을 찾으려면 비주얼 에디터에서 **Search** 사용
- 원하는 컴포넌트가 없으면 [커스텀 컴포넌트](/components-custom-components) 생성 가능

## Legacy 번들

Legacy 컴포넌트는 더 이상 지원되지 않으며 향후 릴리스에서 제거될 수 있음.
기존 Flow에서 계속 사용 가능하지만, 가능한 빨리 지원되는 컴포넌트로 교체 권장.

- 권장 대체 컴포넌트는 Flow 내 컴포넌트의 **Legacy** 배너에 표시
- **Search**로 공급자, 서비스, 컴포넌트 이름으로 검색하여 대체 컴포넌트 찾기
- 명확한 대체품이 없으면 다른 컴포넌트 적용 고려 (예: [API Request](/api-request) 같은 Core 컴포넌트)
- Legacy 컴포넌트 코드로 커스텀 컴포넌트 생성 가능
- 새 Flow에서 Legacy 컴포넌트 사용 방지를 위해 기본적으로 숨김
  - **Component settings**에서 **Legacy** 필터 토글로 표시 가능

### CrewAI 번들 (Legacy)

다음 CrewAI 컴포넌트를 [Agent](/components-agents) 컴포넌트 같은 다른 에이전트 컴포넌트로 대체:

- CrewAI Agent
- CrewAI Hierarchical Crew / CrewAI Hierarchical Task
- CrewAI Sequential Crew / CrewAI Sequential Task
- CrewAI Sequential Task Agent

### Embeddings 번들 (Legacy)

| Legacy 컴포넌트 | 대체 방법 |
|----------------|----------|
| **Embedding Similarity** | 벡터 스토어 컴포넌트의 내장 유사도 검색 기능 |
| **Text Embedder** | Embedding Model 컴포넌트들 |

### Vector Stores 번들 (Legacy)

- **Local DB** 컴포넌트만 포함
- 다른 벡터 스토어 컴포넌트는 각 공급자별 번들에서 찾을 수 있음
  - 예: [DataStax](/bundles-datastax) 번들

### Zep 번들 (Legacy)

- **Zep Chat Memory** - Legacy 상태

## 관련 항목

- [LangWatch 관찰성 및 평가](/integrations-langwatch)

