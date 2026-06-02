# Components Overview

컴포넌트: Flow의 구성 요소. 각 컴포넌트는 특정 사용 사례 또는 통합을 위해 설계.

> **Tip**: Langflow 워크스페이스 키보드 단축키 제공.
> 헤더 → 프로필 아이콘 → **Settings** → **Shortcuts**에서 확인 가능.

## Flow에 컴포넌트 추가

**Core components** 또는 **Bundles** 메뉴에서 컴포넌트를 워크스페이스로 드래그.

**컴포넌트 분류:**

| 메뉴 | 설명 |
|------|------|
| **Core components** | Langflow 기본 컴포넌트. 목적별 그룹화 (Inputs/Outputs, Data 등). 범용 기능 또는 여러 서드파티 통합 지원 |
| **Bundles** | 특정 서드파티 통합 지원 컴포넌트. 서비스 제공자별 그룹화 |
| **Legacy** | 기본적으로 숨김. 더 이상 지원되지 않는 컴포넌트 |

## 컴포넌트 구성

### 컴포넌트 헤더 메뉴

워크스페이스에서 컴포넌트 클릭 시 헤더 메뉴 표시.

| 옵션 | 설명 |
|------|------|
| **Code** | Python 코드 직접 편집으로 컴포넌트 설정 수정 |
| **Controls** | 기본 숨김 옵션 포함 모든 파라미터 조정 |
| **Tool Mode** | Agent 컴포넌트와 결합 시 활성화 |
| **Show More** | Delete, Duplicate 등 추가 옵션 |

### 컴포넌트 이름 변경

컴포넌트 클릭 → **Edit** 클릭. Markdown 문법 지원.

### 컴포넌트 실행

**Run component** 클릭으로 단일 컴포넌트 실행.
- 성공 시 **Last Run** 값 표시
- 단일 컴포넌트 실행: `build_vertex` 함수 호출
- 전체 Flow 실행과 달리 업스트림 의존성 자동 실행 안 함

### 출력 및 로그 검사

**Inspect** 클릭으로 단일 컴포넌트의 출력 및 로그 확인.

### 컴포넌트 동결 (Freeze)

> **Info**: 컴포넌트 동결 시 모든 업스트림 컴포넌트도 함께 동결.

**용도:** 일관된 출력이 예상되고 한 번만 실행 필요한 경우.

**동작:**
- 동결된 컴포넌트 및 모든 업스트림 컴포넌트 재실행 방지
- 마지막 출력 상태 보존
- 이후 Flow 실행 시 보존된 출력 사용

**설정:** 컴포넌트 클릭 → **Show More** → **Freeze** 선택.

## 컴포넌트 포트

컴포넌트 테두리의 원형 아이콘: 연결 지점 (포트).

- **입력 포트**: 특정 데이터 타입 수신
- **출력 포트**: 특정 데이터 타입 출력
- 동일 타입(색상)의 포트끼리 연결하여 데이터 전송

> **Tip**:
> - 포트 위에 마우스 올리면 연결 세부 정보 표시
> - 포트 클릭으로 호환 컴포넌트 검색
> - 비호환 데이터 타입 시 **Type Convert** 컴포넌트로 변환

### 동적 포트

일부 컴포넌트는 포트가 동적으로 추가/제거됨.
- 예: **Prompt Template** 컴포넌트 - 중괄호로 감싼 값 감지 시 새 포트 생성

### 출력 타입 선택

모든 컴포넌트는 출력 생성 (다음 컴포넌트로 전송 또는 최종 결과).

**다중 출력 타입:**
- `group_outputs=True`: 모든 타입 동시 출력 (여러 출력 포트)
- `group_outputs=False` 또는 생략: 출력 타입 선택 필요

예: 언어 모델 컴포넌트
- **Model Response**: Message 데이터 출력
- **Language Model**: Language Model 입력이 있는 컴포넌트에 연결 (예: Structured Output)

### 포트 색상

| 데이터 타입 | 포트 색상 |
|------------|----------|
| Data | Red |
| DataFrame | Pink |
| Embeddings | Emerald |
| LanguageModel | Fuchsia |
| Memory | Orange |
| Message | Indigo |
| Tool | Cyan |
| Unknown/multiple | Gray |

## 컴포넌트 코드

워크스페이스에서 컴포넌트 선택 → **Code** 클릭으로 Python 코드 확인/편집.

**컴포넌트 코드 역할:**
- 비주얼 에디터에 표시할 설정 옵션 결정
- 정의된 입력 타입에 따라 입력 검증
- 구성된 파라미터, 메서드, 함수로 데이터 처리
- 결과를 Flow의 다음 컴포넌트로 전달

**코드 구조:**
- 모든 컴포넌트는 기본 `Component` 클래스 상속
- 입력/출력 정의 (워크스페이스에서 포트로 표현)
- 기능 처리를 위한 메서드/함수 포함

**입력 정의 예시:**
```python
inputs = [
    IntInput(
        name="chunk_size",
        display_name="Chunk Size",
        info="The maximum length of each chunk.",
        value=1000,
    ),
    IntInput(
        name="chunk_overlap",
        display_name="Chunk Overlap",
        info="The amount of overlap between chunks.",
        value=200,
    ),
    # ...
]
```

## 컴포넌트 버전

- 컴포넌트 버전 및 상태: 내부 Langflow 데이터베이스에 저장
- Flow에 컴포넌트 추가 시 분리된 복사본 생성
- 복사본은 Langflow 업그레이드 시 자동 동기화 안 됨
- 추가 시점의 버전 번호 및 상태 유지

### 버전 업데이트

**업데이트 알림:**
- **Update ready**: 주요 변경 사항 없음
- **Update available**: 주요 변경 사항 가능 (입력/출력 수정으로 연결 끊김 가능)

**업데이트 방법:**
1. **Update** 클릭: 단일 컴포넌트 업데이트 (주요 변경 없을 때 권장)
2. **Review** 클릭: 모든 업데이트 확인 및 스냅샷 생성 후 업데이트 (주요 변경 있을 때 권장)
   - **Create backup flow before updating** 활성화로 백업 생성 가능
   - 백업 Flow: 원본과 같은 폴더에 `(backup)` 접미사로 저장

## 그룹 컴포넌트

여러 컴포넌트를 단일 컴포넌트로 그룹화하여 재사용.

**그룹화 방법:**
1. Shift + 드래그로 컴포넌트 선택 (또는 Ctrl/Cmd + 클릭으로 개별 선택)
2. **Group** 클릭으로 병합

**그룹 관리:**
- 단일 컴포넌트로 구성 및 관리 (이름, 코드, 설정)
- 그룹 해제: **Show More** → **Ungroup**
- 다른 Flow에서 재사용: **Show More** → **Save**로 Core components 메뉴에 커스텀 컴포넌트로 저장

## Legacy 컴포넌트

더 이상 지원되지 않으며 향후 릴리스에서 제거 가능.

**권장 사항:**
- 기존 Flow에서 계속 사용 가능하나, 지원되는 컴포넌트로 교체 권장
- 대체 컴포넌트: **Legacy** 배너에 제안 표시
- 대체 컴포넌트 검색: 제공자, 서비스, 컴포넌트 이름으로 검색
- 대안 없을 경우: **API Request** 등 범용 컴포넌트 활용 또는 커스텀 컴포넌트 생성

**Legacy 컴포넌트 표시:** 비주얼 에디터 → **Component settings** → **Legacy** 필터 토글.

