# 30분 빠른 시작

예제 앱을 통해 Dify를 체험하는 단계별 튜토리얼임.
멀티 플랫폼 콘텐츠 생성기를 처음부터 구축하는 과정을 안내함.

기본적인 LLM 통합을 넘어, 강력한 Dify 노드를 사용하여
정교한 AI 애플리케이션을 더 빠르고 적은 노력으로 구성하는 방법을 학습함.

완성 시, 어떤 콘텐츠(텍스트, 문서, 이미지)든 받아서 선호하는 음성과 톤을 추가하고,
선택한 언어로 다듬어진 플랫폼별 소셜 미디어 게시물을 출력하는 워크플로우를 구축함.

## Step 1: 새 워크플로우 생성

Studio로 이동 후 Create from blank > Workflow 선택.
워크플로우 이름을 "Multi-platform content generator"로 지정하고 Create 클릭.
워크플로우 캔버스에 자동으로 이동하여 빌드 시작 가능.

## Step 2: 워크플로우 노드 추가 및 구성

언급되지 않은 설정은 기본값 유지.
노드와 변수에 명확하고 설명적인 이름을 부여하여 워크플로우에서 쉽게 식별하고 참조 가능하도록 함.

### 1. User Input 노드: 사용자 입력 수집

사용자로부터 수집할 정보(초안 텍스트, 대상 플랫폼, 원하는 톤, 참고 자료 등)를 정의함.
User Input 노드에서 입력 필드를 추가하면, 각 필드가 하류 노드에서 참조 가능한 변수가 됨.

입력 필드:
- Reference materials - text
- Reference materials - files
- Voice and tone
- Target platform
- Language requirements

### 2. Parameter Extractor 노드: 대상 플랫폼 식별

플랫폼 필드가 자유 텍스트 입력을 허용하므로 사용자가 다양한 방식으로 입력할 수 있음.
Parameter Extractor 노드는 LLM을 사용하여 자연어를 분석하고 표준화된 배열을 출력함.

구성 방법:
- 모델 선택
- User Input/platform을 입력 변수로 설정
- 추출 파라미터 추가: name=platform, type=Array[String]
- 인스트럭션 필드에 플랫폼 파싱 규칙 추가

### 3. IF/ELSE 노드: 플랫폼 추출 결과 검증

사용자가 유효하지 않은 플랫폼 이름을 입력한 경우,
IF/ELSE 노드로 워크플로우를 조기에 중단하는 분기를 생성함.

조건 설정:
- IF Parameter Extractor/platform contains "No platforms identified..."
- IF 분기에 Output 노드 추가하여 워크플로우 종료

### 4. List Operator 노드: 업로드 파일을 유형별로 분리

이미지와 문서를 각각 다른 처리가 필요하므로 두 개의 List Operator 노드를 사용하여 분리함.

- Image 노드: filter 조건 `{x}type in Image`
- Document 노드: filter 조건 `{x}type in Doc`

### 5. Doc Extractor 노드: 문서에서 텍스트 추출

LLM은 업로드된 파일(PDF, DOCX 등)을 직접 읽을 수 없음.
Doc Extractor 노드가 문서 파일을 일반 텍스트로 변환함.

### 6. LLM 노드: 모든 참고 자료 통합

여러 참고 유형(초안 텍스트, 문서, 이미지)을 하나의 일관된 요약으로 통합함.
비전 지원 모델을 선택하고 VISION을 활성화하여 Image/result를 비전 변수로 설정함.

### 7. Iteration 노드: 각 플랫폼별 맞춤 콘텐츠 생성

Iteration 노드가 플랫폼 목록을 순회하며 각 플랫폼에 대해 서브 워크플로우를 실행함:
1. **Identify Style** LLM 노드: 플랫폼별 스타일 가이드라인 및 모범 사례 분석
2. **Create Content** LLM 노드: 분석된 정보를 기반으로 최적화된 콘텐츠 생성

- PARALLEL MODE 활성화, 최대 병렬 처리를 10으로 설정

### 8. Template 노드: 최종 출력 포맷팅

Iteration 노드의 원시 배열 데이터를 Jinja2 템플릿을 사용하여 읽기 쉬운 형식으로 변환함.

> LLM도 출력 포맷팅이 가능하지만, 규칙 기반 포맷팅에는 Template 노드가
> 토큰 비용 없이 더 안정적이고 신뢰성 있는 방식으로 처리함.

### 9. Output 노드: 사용자에게 결과 반환

Template/output을 출력 변수로 설정함.

## Step 3: 테스트

- Checklist가 비어있는지 확인
- 참조 다이어그램과 워크플로우 비교하여 모든 노드와 연결이 일치하는지 확인
- 우측 상단의 Test Run 클릭, 입력 필드 작성 후 Start Run 클릭
- 단일 노드 실행: 구성 패널 상단의 "Run this step" 아이콘 클릭
- 캐시된 변수 편집: 캔버스 하단의 "View cached variables" 클릭

## Step 4: 배포 및 공유

워크플로우가 예상대로 실행되면 Publish > Publish Update를 클릭하여 라이브 및 공유 가능하게 함.
변경 사항이 있으면 항상 다시 배포하여 업데이트를 반영함.
