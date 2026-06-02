# LangChain

**Bundles**는 Langflow와 특정 타사 통합을 지원하는 커스텀 컴포넌트를 포함

이 페이지에서는 **LangChain** 번들에서 사용할 수 있는 컴포넌트 설명

---

## CSV Agent

**Agent** 코어 컴포넌트를 기반으로 함

CSV 파일과 LLM에서 CSV Agent 생성
자세한 내용은 [LangChain CSV agent 문서](https://python.langchain.com/api_reference/experimental/agents/langchain_experimental.agents.agent_toolkits.csv.base.create_csv_agent.html) 참조

### 파라미터

| Name | Type | Description |
|------|------|-------------|
| llm | LanguageModel | Agent에 사용할 언어 모델 |
| path | File | CSV 파일 경로 |
| agent_type | String | 생성할 Agent 유형 |
| agent | AgentExecutor | CSV Agent 인스턴스 (출력) |

---

## OpenAI Tools Agent

**Agent** 코어 컴포넌트를 기반으로 함

OpenAI Tools Agent 생성
자세한 내용은 [LangChain OpenAI agent 문서](https://python.langchain.com/api_reference/langchain/agents/langchain.agents.openai_functions_agent.base.create_openai_functions_agent.html) 참조

### 파라미터

| Name | Type | Description |
|------|------|-------------|
| llm | LanguageModel | 사용할 언어 모델 |
| tools | List of Tools | Agent가 액세스할 도구 목록 |
| system_prompt | String | Agent에 컨텍스트를 제공하는 시스템 프롬프트 |
| input_value | String | Agent에 대한 사용자 입력 |
| memory | Memory | 컨텍스트 지속성을 위해 Agent가 사용할 메모리 |
| max_iterations | Integer | Agent가 실행할 최대 반복 횟수 |
| verbose | Boolean | Agent의 중간 단계를 출력할지 여부 |
| handle_parsing_errors | Boolean | Agent에서 파싱 오류를 처리할지 여부 |
| agent | AgentExecutor | OpenAI Tools Agent 인스턴스 (출력) |
| output | String | 입력에 대한 Agent 실행 출력 (출력) |

---

## OpenAPI Agent

**Agent** 코어 컴포넌트를 기반으로 함

OpenAPI 서비스와 상호작용하는 Agent 생성
자세한 내용은 [LangChain OpenAPI toolkit 문서](https://docs.langchain.com/oss/python/integrations/tools/openapi) 참조

### 파라미터

| Name | Type | Description |
|------|------|-------------|
| llm | LanguageModel | 사용할 언어 모델 |
| openapi_spec | String | 서비스에 대한 OpenAPI 사양 |
| base_url | String | API의 기본 URL |
| headers | Dict | API 요청에 대한 선택적 헤더 |
| agent_executor_kwargs | Dict | Agent executor에 대한 선택적 파라미터 |
| agent | AgentExecutor | OpenAPI Agent 인스턴스 (출력) |

---

## Prompt Hub

[LangChain Hub](https://docs.langchain.com/langsmith/manage-prompts#public-prompt-hub)에서 프롬프트를 가져옴

**Prompt Template** 코어 컴포넌트와 마찬가지로 프롬프트의 각 변수에 대해 추가 필드가 컴포넌트에 추가됨
예를 들어 기본 프롬프트 `efriis/my-first-prompt`는 `profession` 및 `question` 필드를 추가

### 파라미터

| Name | Display Name | Description |
|------|--------------|-------------|
| langchain_api_key | Your LangChain API Key | 사용할 LangChain API 키 |
| langchain_hub_prompt | LangChain Hub Prompt | 사용할 LangChain Hub 프롬프트 |
| prompt | Build Prompt | `build_prompt` 메서드가 반환하는 빌드된 프롬프트 메시지 (출력) |

---

## SQL Agent

**Agent** 코어 컴포넌트를 기반으로 함

SQL 데이터베이스와 상호작용하는 Agent 생성
자세한 내용은 [LangChain SQL agent 문서](https://docs.langchain.com/oss/python/langchain/sql-agent) 참조

### 파라미터

| Name | Type | Description |
|------|------|-------------|
| llm | LanguageModel | 사용할 언어 모델 |
| database | Database | SQL 데이터베이스 연결 |
| top_k | Integer | SELECT 쿼리에서 반환할 결과 수 |
| use_tools | Boolean | 쿼리 실행을 위해 도구를 사용할지 여부 |
| return_intermediate_steps | Boolean | Agent의 중간 단계를 반환할지 여부 |
| max_iterations | Integer | Agent를 실행할 최대 반복 횟수 |
| max_execution_time | Integer | 최대 실행 시간(초) |
| early_stopping_method | String | 조기 중지에 사용할 방법 |
| verbose | Boolean | Agent의 생각을 출력할지 여부 |
| agent | AgentExecutor | SQL Agent 인스턴스 (출력) |

---

## SQL Database

LangChain **SQL Database** 컴포넌트는 SQL 데이터베이스에 대한 연결 설정

이 컴포넌트는 SQLAlchemy 호환 데이터베이스에서 SQL 쿼리를 실행하는
**SQL Database** 코어 컴포넌트와는 다름

---

## Text Splitters

**LangChain** 번들에는 다음 텍스트 스플리터 컴포넌트가 포함됨:

- **Character Text Splitter**
- **Language Recursive Text Splitter**
- **Natural Language Text Splitter**
- **Recursive Character Text Splitter**
- **Semantic Text Splitter**

---

## Tool Calling Agent

**Agent** 코어 컴포넌트를 기반으로 함

다양한 언어 모델로 구조화된 도구 호출을 위한 Agent 생성
자세한 내용은 [LangChain tool calling 문서](https://docs.langchain.com/oss/python/langchain/agents#tools) 참조

### 파라미터

| Name | Type | Description |
|------|------|-------------|
| llm | LanguageModel | 사용할 언어 모델 |
| tools | List[Tool] | Agent가 사용할 수 있는 도구 목록 |
| system_message | String | Agent에 사용할 시스템 메시지 |
| return_intermediate_steps | Boolean | Agent의 중간 단계를 반환할지 여부 |
| max_iterations | Integer | Agent를 실행할 최대 반복 횟수 |
| max_execution_time | Integer | 최대 실행 시간(초) |
| early_stopping_method | String | 조기 중지에 사용할 방법 |
| verbose | Boolean | Agent의 생각을 출력할지 여부 |
| agent | AgentExecutor | Tool Calling Agent 인스턴스 (출력) |

---

## XML Agent

**Agent** 코어 컴포넌트를 기반으로 함

LangChain을 사용하여 XML Agent 생성
Agent는 LLM에 대한 도구 지침에 XML 형식 사용
자세한 내용은 [LangChain XML Agent 문서](https://python.langchain.com/api_reference/langchain/agents/langchain.agents.xml.base.create_xml_agent.html) 참조

### 파라미터

| Name | Type | Description |
|------|------|-------------|
| llm | LanguageModel | Agent에 사용할 언어 모델 |
| user_prompt | String | XML 형식 지침이 포함된 Agent에 대한 커스텀 프롬프트 템플릿 |
| tools | List[Tool] | Agent가 사용할 수 있는 도구 목록 |
| agent | AgentExecutor | XML Agent 인스턴스 (출력) |

---

## 기타 LangChain 컴포넌트

**LangChain** 번들의 기타 컴포넌트:

- **Fake Embeddings**
- **HTML Link Extractor**
- **Runnable Executor**
- **Spider Web Crawler & Scraper**

---

## 레거시 LangChain 컴포넌트

레거시 컴포넌트는 더 이상 지원되지 않으며 향후 릴리스에서 제거될 수 있음
기존 플로우에서 계속 사용할 수 있지만 가능한 한 빨리 지원되는 컴포넌트로 교체하는 것을 권장
제안된 대체 항목은 플로우의 컴포넌트에 있는 **Legacy** 배너에 포함됨

### 레거시 상태의 LangChain 컴포넌트

- **Conversation Chain**
- **LLM Checker Chain**
- **LLM Math Chain**
- **Natural Language to SQL**
- **Retrieval QA**
- **Self Query Retriever**
- **JSON Agent**
- **Vector Store Info/Agent**
- **VectorStoreRouterAgent**

### 대체 방법

이러한 컴포넌트를 교체하려면 **LangChain** 번들의 다른 컴포넌트 또는
**Agent** 컴포넌트나 **SQL Database** 컴포넌트와 같은 일반 Langflow 컴포넌트를 고려

### 레거시 컴포넌트 표시

레거시 컴포넌트는 기본적으로 숨겨짐
비주얼 에디터에서 **Component settings**를 클릭하여 **Legacy** 필터를 토글 가능

---

## 참조

- [LangChain Hub](https://docs.langchain.com/langsmith/manage-prompts#public-prompt-hub)
- [LangChain CSV Agent](https://python.langchain.com/api_reference/experimental/agents/langchain_experimental.agents.agent_toolkits.csv.base.create_csv_agent.html)
- [LangChain OpenAI Agent](https://python.langchain.com/api_reference/langchain/agents/langchain.agents.openai_functions_agent.base.create_openai_functions_agent.html)
- [LangChain OpenAPI Toolkit](https://docs.langchain.com/oss/python/integrations/tools/openapi)
- [LangChain SQL Agent](https://docs.langchain.com/oss/python/langchain/sql-agent)
- [LangChain Tool Calling](https://docs.langchain.com/oss/python/langchain/agents#tools)
- [LangChain XML Agent](https://python.langchain.com/api_reference/langchain/agents/langchain.agents.xml.base.create_xml_agent.html)
