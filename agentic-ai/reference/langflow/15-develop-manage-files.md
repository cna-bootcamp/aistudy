# Manage files

Langflow 서버에는 Flow에서 사용할 파일을 저장하는 파일 관리 시스템 제공.

Langflow 파일 관리에 업로드된 파일:
- Langflow의 스토리지 백엔드(로컬 또는 AWS S3)에 저장
- 모든 Flow에서 사용 가능
- 중앙 위치에서 파일 관리 및 재사용

## Use the file management UI

### 파일 관리 UI 접근

| 환경 | 접근 방법 |
|------|----------|
| **Langflow Desktop** | **Projects** 페이지에서 **My Files** 클릭 |
| **Langflow OSS** | 브라우저에서 `/files` 엔드포인트 접근 (예: `http://localhost:7860/files`) |
| **Backend-only** | [Langflow API files endpoints](/api-files) 사용 |

### 파일 업로드

1. **My Files** 페이지에서 **Upload** 클릭
2. 업로드할 파일 선택

### 파일 관리

- **이름 변경**: 파일 아이콘 호버 → 선택 → 이름 편집
- **다운로드**: 파일 선택 → **Download** 클릭 (복수 선택 시 ZIP 파일로 저장)
- **삭제**: 파일 선택 → **Delete** 클릭

## Upload and manage files with the Langflow API

Langflow API로 파일 관리 시스템에 업로드 및 관리, 런타임에 Flow로 파일 전송 가능.

자세한 정보: [Files endpoints](/api-files), [Create a chatbot that can ingest files](/chat-with-files)

## Set the maximum file size

기본 최대 파일 크기: **1024 MB**

변경 방법:
```
LANGFLOW_MAX_FILE_SIZE_UPLOAD=2048
```

## Use files in a flow

### 파일 사용 방법

1. 파일 입력을 받는 컴포넌트 추가 (예: **Read File**)
2. **Select files** 클릭
3. **My Files** 목록에서 파일 선택

> **Note**: **Read File** 컴포넌트가 지원하는 파일 타입만 선택 가능.
> 다른 파일 타입이 필요하면 해당 타입을 지원하는 컴포넌트 사용 또는 지원 타입으로 변환.

### Load files at runtime

런타임에 파일 로드를 위한 Flow 설정:

1. **Read File** 컴포넌트를 Flow에 추가
2. **Share** → **API access** → **Input Schema** 클릭
3. **File** 섹션 확장 → **Files** 행 → **Expose Input** 활성화
4. **Input Schema** 패널 닫기

코드 스니펫의 페이로드에 tweaks 포함:

```json
"tweaks": {
  "File-qYD5w": {
    "path": []
  }
}
```

Flow 실행 시:
1. 파일을 Langflow 파일 관리에 업로드
2. 반환된 `file_path`를 `/run` 요청의 `path` tweak에 전달

```json
"tweaks": {
  "FILE_COMPONENT_ID": {
    "path": [ "file_path" ]
  }
}
```

복수 파일 업로드: `[ "path1", "path2" ]`

## Upload images

**지원 이미지 형식:**
- PNG
- JPG/JPEG
- GIF
- BMP
- WebP

**업로드 방법:**

| 방법 | 설명 |
|------|------|
| **Playground** | 채팅 입력 영역에 드래그 앤 드롭 또는 **Attach image** 아이콘 클릭 |
| **API** | `files` 파라미터에 base64 인코딩 문자열로 전달 |

**API 예시:**

```bash
curl -X POST "http://$LANGFLOW_SERVER_ADDRESS/api/v1/run/$FLOW_ID" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $LANGFLOW_API_KEY" \
  -d '{
    "input_value": "What is in this image?",
    "files": ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."]
  }'
```

## Work with video files

비디오 파일: **Twelve Labs** 및 **YouTube** [Bundles](/components-bundle-components) 참조

## Configure file storage

Langflow는 두 가지 스토리지 백엔드 지원:

### Local storage (기본값)

파일이 Langflow 구성 디렉토리에 로컬 저장.

```
LANGFLOW_STORAGE_TYPE=local
```

### S3 storage

파일이 AWS S3 버킷에 저장. boto3 라이브러리 사용.

**.env 파일 설정:**

```bash
# S3 Storage Configuration
LANGFLOW_STORAGE_TYPE=s3
LANGFLOW_OBJECT_STORAGE_BUCKET_NAME=S3_BUCKET_NAME
LANGFLOW_OBJECT_STORAGE_PREFIX=S3_BUCKET_DIRECTORY

# AWS Credentials (required for S3)
AWS_ACCESS_KEY_ID=S3_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=S3_ACCESS_SECRET_KEY
AWS_DEFAULT_REGION=S3_REGION
```

**필요한 S3 권한:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:PutObjectTagging"
      ],
      "Resource": [
        "arn:aws:s3:::S3_BUCKET_NAME",
        "arn:aws:s3:::S3_BUCKET_NAME/S3_BUCKET_DIRECTORY/*"
      ]
    }
  ]
}
```

**Google Drive**: **Read File** 및 **Write file** 컴포넌트를 통해 사용 가능 (환경 변수로 구성 불가)

## File storage environment variables

| 변수 | 형식 | 기본값 | 설명 |
|------|------|--------|------|
| `LANGFLOW_STORAGE_TYPE` | String | `local` | 파일 스토리지 백엔드 (`local` 또는 `s3`) |
| `LANGFLOW_OBJECT_STORAGE_BUCKET_NAME` | String | 미설정 | S3 버킷 이름 (`s3` 사용 시 필수) |
| `LANGFLOW_OBJECT_STORAGE_PREFIX` | String | 미설정 | S3 버킷 내 폴더 경로 (선택사항) |
| `LANGFLOW_OBJECT_STORAGE_TAGS` | JSON | 미설정 | S3 객체 태그 (예: `{"env": "prod"}`) |

## See also

- [Components reference](/concepts-components)
