# Read File

Langflow 1.7.0에서 **File**에서 **Read File**로 이름 변경.

파일 로드 및 파싱, 콘텐츠를 `Data`, `DataFrame`, `Message` 객체로 변환.
여러 파일 타입 지원, 병렬 처리 및 오류 처리 파라미터, Docling 라이브러리를 사용한 고급 파싱 지원.

- 비주얼 에디터 또는 런타임에서 파일 추가 가능
- 여러 파일 동시 업로드 가능
- 로컬 Langflow 데이터베이스, **AWS S3**, **Google Drive**에서 파일 읽기 가능

참조:
- [File management](/concepts-file-management)
- [Create a chatbot that can ingest files](/chat-with-files)
- [Configure file storage](/concepts-file-management#configure-file-storage)

## 파일 타입 및 크기 제한

**최대 파일 크기:** 기본 1024 MB
- 수정: `LANGFLOW_MAX_FILE_SIZE_UPLOAD` [환경 변수](/environment-variables) 변경

**지원되지 않는 파일 타입:** 해당 파일 타입을 지원하는 다른 컴포넌트 사용하거나 지원되는 타입으로 변환 후 업로드.

- 이미지: [Upload images](/concepts-file-management#upload-images) 참조
- 비디오: **Twelve Labs** 및 **YouTube** [Bundles](/components-bundle-components) 참조

## File 파라미터

| Name | Display Name | 설명 |
|------|--------------|------|
| `path` | Files | 로드할 파일 경로. 로컬 또는 Langflow 파일 관리. 개별 파일 및 번들 아카이브 지원 |
| `file_path` | Server File Path | Langflow 파일 관리의 파일을 가리키는 `file_path` 속성이 있는 `Data` 객체 또는 파일 경로가 있는 `Message` 객체. `path`보다 우선 |
| `separator` | Separator | Message 형식의 여러 출력 간 구분자 |
| `silent_errors` | Silent Errors | `true`이면 오류 시 예외 발생 안 함. 기본값: 비활성화 (`false`) |
| `delete_server_file_after_processing` | Delete Server File After Processing | `true` (기본값)이면 처리 후 Server File Path 삭제 |
| `ignore_unsupported_extensions` | Ignore Unsupported Extensions | `true`이면 지원되지 않는 확장자 파일 수용하되 처리 안 함. 기본값: `true` |
| `ignore_unspecified_files` | Ignore Unspecified Files | `true`이면 `file_path` 속성 없는 Data 무시. 기본값: `false` |
| `concurrency_multithreading` | Processing Concurrency | 여러 파일 업로드 시 동시 처리할 파일 수. 기본값: 1. 1보다 크면 2개 이상 파일에 대해 병렬 처리 활성화 |
| `advanced_parser` | Advanced Parser | `true`이면 고급 파싱 활성화. 호환되는 파일 타입의 단일 파일 업로드에만 사용 가능. 기본값: 비활성화 (`false`) |

## 고급 파싱

Langflow 1.6부터 지원되는 파일 타입에 대해 [Docling](https://docling-project.github.io/docling/) 라이브러리를 사용한 고급 문서 파싱 지원.

**전제 조건:**
- **Langflow 1.6 이상 설치**
- **macOS Intel (x86_64)에서 Docling 의존성 설치:** [Docling 설치 가이드](https://docling-project.github.io/docling/installation/) 참조
- **Docker/Linux 시스템 의존성:** Docker 컨테이너에서 실행 시 추가 시스템 패키지 필요할 수 있음
- **Windows에서 개발자 모드 활성화:** Langflow Desktop 사용 시 [개발자 모드](https://learn.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development#activate-developer-mode) 필요

**사용 방법:**
1. **Read File** 컴포넌트에 유효한 파일 1개 추가
2. **Advanced Parsing** 활성화
3. **Controls**에서 고급 파싱 파라미터 구성

**고급 파싱 제한:**
- 하나의 파일만 처리. 여러 파일 선택 시 첫 번째 파일만 처리
- `.csv`, `.xlsx`, `.parquet` 파일 제외 (문서 처리용으로 설계됨)

**고급 파싱 파라미터:**

| Name | Display Name | 설명 |
|------|--------------|------|
| `pipeline` | Pipeline | 사용할 Docling 파이프라인: `standard` (기본값, 권장) 또는 `vlm` |
| `ocr_engine` | OCR Engine | `standard` 파이프라인용 OCR 파서: `None` (기본값) 또는 `EasyOCR` |
| `md_image_placeholder` | Markdown Image Placeholder | Markdown 출력 시 이미지 플레이스홀더. 기본값: `<!-- image -->` |
| `md_page_break_placeholder` | Markdown Page Break Placeholder | Markdown 출력 시 페이지 브레이크 플레이스홀더. 기본값: `""` |
| `doc_key` | Document Key | DoclingDocument 열의 키. 기본값: `doc` |

> **Tip**: 추가 Docling 기능은 [Docling 번들](/bundles-docling) 참조

## File 출력

출력은 로드된 파일 수와 고급 파싱 활성화 여부에 따라 다름.

| 상황 | 출력 |
|------|------|
| 파일 없음 | 오류 발생 (Silent Errors 활성화 시 출력 없음) |
| 고급 파싱 없는 단일 파일 | `Data`, `DataFrame`, `Message` 선택 가능 |
| 고급 파싱 있는 단일 파일 | 구조화된 문서 정보 포함 |
| 여러 파일 | `DataFrame` 또는 결합된 출력 |

