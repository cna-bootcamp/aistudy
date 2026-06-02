# SQL Database

**SQL Database** 컴포넌트는 [SQLAlchemy 호환 데이터베이스](https://docs.sqlalchemy.org/en/20/)에서 SQL 쿼리 실행.
PostgreSQL, MySQL, SQLite 등 모든 SQLAlchemy 호환 데이터베이스 지원.

CQL 쿼리는 [DataStax 번들](/bundles-datastax) 참조.

## 자연어 프롬프트로 SQL 데이터베이스 쿼리

**Agent** 컴포넌트를 통해 자연어 쿼리를 지원하도록 **SQL Database** 컴포넌트 수정 가능.

### 장점
- 단일 수동 입력 쿼리에 제한되지 않고 동일 **SQL Database** 컴포넌트로 모든 쿼리 가능
- 사용자, 애플리케이션, 다른 컴포넌트가 유효한 SQL 구문을 입력으로 제공할 필요 없음
- 사용자가 SQL 구문을 마스터할 필요 없음
- **Agent** 컴포넌트가 자연어 프롬프트를 SQL 쿼리로 변환 → **SQL Database** 컴포넌트에 전달 → 결과 반환
- 애플리케이션 및 다른 컴포넌트의 입력을 정확한 SQL 쿼리로 추출/변환할 필요 없음
- 에이전트가 수신 데이터에 따라 SQL 쿼리를 생성하고 실행해야 함을 이해할 수 있는 충분한 컨텍스트만 제공하면 됨

### 설정 방법

1. 자체 샘플 데이터베이스 사용 또는 테스트 데이터베이스 생성

2. Flow에 **SQL Database** 컴포넌트 추가

3. **Database URL** 필드에 데이터베이스 연결 문자열 추가 (예: `sqlite:///test.db`)
   - 이 시점에서 **SQL Query** 필드에 SQL 쿼리 직접 입력 가능
   - 또는 포트를 사용하여 **Chat Input** 등 다른 컴포넌트에서 쿼리 전달 가능

4. **SQL Database** 컴포넌트 클릭 → 컴포넌트 헤더 메뉴에서 **Tool Mode** 활성화
   - 에이전트의 도구로 사용 가능
   - **Tool Mode**에서는 쿼리가 설정되지 않음 (에이전트가 생성하여 전송)

5. Flow에 **Agent** 컴포넌트 추가 후 OpenAI API 키 입력
   - 기본 모델은 OpenAI 모델
   - 다른 모델 사용 시 **Model Provider**, **Model Name**, **API Key** 필드 수정
   - 고급 SQL 쿼리 같은 특수 작업용으로 훈련된 모델 선택 고려

6. **SQL Database**의 **Toolset** 출력 → **Agent**의 **Tools** 입력 연결

7. **Playground**에서 데이터베이스 데이터에 대한 질문 (예: `Which users are in my database?`)
   - 에이전트가 질문에 답하기 위해 데이터베이스 쿼리 필요 여부 판단
   - LLM을 사용하여 SQL 쿼리 생성
   - **SQL Database** 컴포넌트의 `RUN_SQL_QUERY` 액션으로 데이터베이스에서 쿼리 실행
   - 대화형 형식으로 결과 반환 (원시 결과나 다른 형식으로 반환하도록 지시 가능)

### 예시 결과
```
Here are the users in your database:

1. **John Doe** - Email: john@example.com
2. **Jane Smith** - Email: jane@example.com
3. **John Doe** - Email: john@example.com
4. **Jane Smith** - Email: jane@example.com

It seems there are duplicate entries for the users.
```

## SQL Database 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Display Name | 설명 |
|------|--------------|------|
| `database_url` | Database URL | (입력) SQLAlchemy 호환 데이터베이스 연결 URL |
| `query` | SQL Query | (입력) 실행할 SQL 쿼리. 직접 입력, 다른 컴포넌트에서 전달, **Tool Mode**에서는 **Agent** 컴포넌트가 자동 제공 |
| `include_columns` | Include Columns | (입력) 결과에 열 이름 포함 여부. 기본값: `true` |
| `add_error` | Add Error | (입력) 활성화 시 오류 메시지를 결과에 추가. 기본값: `false` |
| `run_sql_query` | Result Table | (출력) 쿼리 결과를 `DataFrame`으로 반환 |

