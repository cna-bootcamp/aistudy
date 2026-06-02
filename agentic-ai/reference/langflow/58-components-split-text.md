# Split Text

청크 크기, 구분자 등의 파라미터를 기반으로 데이터를 청크로 분할.
주로 벡터 데이터베이스에 토큰화 및 임베딩할 데이터 청킹에 사용.

참조:
- [Use embedding model components in a flow](/components-embedding-models#use-embedding-model-components-in-a-flow)
- [Create a Vector RAG chatbot](/chat-with-rag)

## 입력/출력

**입력:** `Message`, `Data`, `DataFrame`

**출력:**
- **Chunks**: 개별 텍스트 청크가 포함된 `Data` 객체 목록
- **DataFrame**: `text` 및 `metadata` 열이 있는 구조화된 `DataFrame`으로 청크 목록 반환

## Split Text 파라미터

| Name | Display Name | 설명 |
|------|--------------|------|
| `data_inputs` | Input | 분할할 데이터. `Message`, `Data`, `DataFrame` 형식 |
| `chunk_overlap` | Chunk Overlap | 청크 간 겹치는 문자 수. 청크 간 컨텍스트 유지에 도움. 구분자 만나면 해당 지점에서 오버랩 적용. 기본값: `200` |
| `chunk_size` | Chunk Size | 분할 후 각 청크의 목표 길이. 먼저 구분자로 분할 후 `chunk_size`보다 작은 청크 병합. 구분자 분할 후 `chunk_size`보다 큰 청크는 추가 분할 없이 그대로 출력. 기본값: `1000` |
| `separator` | Separator | 분할할 문자 정의. `\n`(줄바꿈), `\n\n`(단락 구분), `},`(JSON 객체 끝) 등. 직접 입력 또는 다른 컴포넌트에서 `Message`로 전달 |
| `text_key` | Text Key | 입력에서 추출하여 분할할 텍스트 열의 키. 기본값: `text` |
| `keep_separator` | Keep Separator | 출력 청크에서 구분자 처리 방법. `False`(제거), `True`(유지), `Start`(청크 시작에 배치), `End`(청크 끝에 배치). 기본값: `False` |

## 청킹 테스트

1. **Text Input** 또는 **Read File** 컴포넌트에 샘플 데이터 추가
2. **Split Text** 컴포넌트에서 **Run component** 클릭
3. **Inspect output**으로 청크 목록 및 메타데이터 확인
4. 청크가 예상대로 분할되지 않으면 파라미터 조정 후 재실행

## 청크 크기로 인한 토큰화 오류

**Split Text**를 임베딩 모델 (특히 `nvidia/nv-embed-v1` 같은 NVIDIA 모델)과 함께 사용할 때:
- 모델이 더 큰 토큰 제한을 지원하더라도 더 작은 청크 크기 (`500` 이하) 필요할 수 있음
- **Split Text** 컴포넌트가 설정한 정확한 청크 크기를 항상 강제하지 않음
- 개별 청크가 지정된 제한 초과 가능

**토큰화 오류 발생 시:**
- 청크 크기 줄이기
- 오버랩 길이 변경
- 더 일반적인 구분자 사용
- 컴포넌트 출력 검사로 구성 테스트

## 기타 텍스트 분할기

참조: [LangChain text splitter components](/bundles-langchain#text-splitters)

