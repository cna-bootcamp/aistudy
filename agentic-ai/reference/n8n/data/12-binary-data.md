# Binary Data

## 개요

Binary Data는 n8n에서 파일, 이미지, PDF 등 바이너리 형태의 데이터를 처리하는 기능임.
텍스트가 아닌 모든 형태의 데이터를 workflow 내에서 전달하고 변환하며 저장할 수 있음.

## Binary Data 구조

### Item 내 Binary 필드

```json
{
  "json": {
    "fileName": "document.pdf",
    "fileSize": 524288
  },
  "binary": {
    "data": {
      "data": "base64EncodedString...",
      "mimeType": "application/pdf",
      "fileName": "document.pdf",
      "fileExtension": "pdf"
    }
  }
}
```

### 주요 속성

| 속성 | 설명 | 예시 |
|------|------|------|
| `data` | Base64 인코딩된 바이너리 데이터 | "iVBORw0KGgo..." |
| `mimeType` | MIME 타입 | "image/png", "application/pdf" |
| `fileName` | 파일명 | "report.pdf" |
| `fileExtension` | 확장자 | "pdf", "jpg", "xlsx" |
| `fileSize` | 파일 크기 (bytes) | 1024000 |

## Binary Data 생성

### 파일 읽기

```javascript
// Read Binary Files node
// 지정된 경로의 파일을 binary로 읽어옴
```

### HTTP Request로 다운로드

```javascript
// HTTP Request node 설정
Response Format: File
Binary Property: data

// 이미지, PDF 등 다운로드 시 자동으로 binary 저장
```

### Code Node로 생성

```javascript
// 텍스트를 binary로 변환
const text = "Hello, World!";
const buffer = Buffer.from(text, 'utf-8');

return [{
  json: {},
  binary: {
    data: {
      data: buffer.toString('base64'),
      mimeType: 'text/plain',
      fileName: 'output.txt',
      fileExtension: 'txt'
    }
  }
}];
```

### Base64 문자열에서 변환

```javascript
// Base64 인코딩된 데이터를 binary로
const base64Data = item.json.imageBase64;

return [{
  json: {},
  binary: {
    image: {
      data: base64Data,
      mimeType: 'image/png',
      fileName: 'image.png',
      fileExtension: 'png'
    }
  }
}];
```

## Binary Data 접근

### Expression에서 접근

```javascript
// Binary 데이터 존재 확인
{{ $binary.data !== undefined }}

// 파일명 가져오기
{{ $binary.data.fileName }}

// MIME 타입 확인
{{ $binary.data.mimeType }}

// 파일 크기
{{ $binary.data.data.length }}
```

### Code Node에서 접근

```javascript
// Binary 데이터 읽기
const binaryData = item.binary.data;
const fileName = binaryData.fileName;
const mimeType = binaryData.mimeType;

// Base64 디코딩
const buffer = Buffer.from(binaryData.data, 'base64');
const text = buffer.toString('utf-8');
```

## Binary Data 변환

### 이미지 리사이징

```javascript
// Edit Image node 사용
// 또는 Code node에서 직접 처리

const sharp = require('sharp'); // n8n에서 지원하는 경우

const inputBuffer = Buffer.from(item.binary.data.data, 'base64');
const resizedBuffer = await sharp(inputBuffer)
  .resize(800, 600)
  .toBuffer();

return [{
  binary: {
    data: {
      data: resizedBuffer.toString('base64'),
      mimeType: 'image/jpeg',
      fileName: 'resized.jpg',
      fileExtension: 'jpg'
    }
  }
}];
```

### PDF 생성

```javascript
// HTML to PDF node
// 또는 외부 API 활용

// Puppeteer 기반 (Code node)
const puppeteer = require('puppeteer');

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setContent(item.json.htmlContent);
const pdfBuffer = await page.pdf({ format: 'A4' });
await browser.close();

return [{
  binary: {
    document: {
      data: pdfBuffer.toString('base64'),
      mimeType: 'application/pdf',
      fileName: 'generated.pdf',
      fileExtension: 'pdf'
    }
  }
}];
```

### 파일 형식 변환

```javascript
// CSV to Excel
// JSON to XML
// 등 다양한 변환 node 활용
```

## Binary Data 저장

### 로컬 파일 시스템

```javascript
// Write Binary File node
// Binary Property: data
// File Path: /path/to/output/file.pdf
```

### 클라우드 스토리지

```javascript
// AWS S3, Google Drive, Dropbox 등
// 각 node에서 binary data 직접 업로드 지원

// S3 Upload 예시
Binary Property: data
Bucket Name: my-bucket
File Name: {{ $binary.data.fileName }}
```

### 이메일 첨부

```javascript
// Gmail, Outlook 등 email node
// Attachments 설정
Binary Property: data
```

## 고급 Binary 처리

### 여러 Binary 데이터 처리

```javascript
// Code node - 복수 파일 처리
return $input.all().map(item => {
  const processedBinary = {};

  // 모든 binary 필드 순회
  for (const [key, binary] of Object.entries(item.binary || {})) {
    const buffer = Buffer.from(binary.data, 'base64');
    // 처리 로직
    processedBinary[key] = {
      ...binary,
      data: buffer.toString('base64')
    };
  }

  return {
    json: item.json,
    binary: processedBinary
  };
});
```

### Binary 메타데이터 추출

```javascript
// 파일 정보 추출
const fileInfo = {
  name: item.binary.data.fileName,
  size: Buffer.from(item.binary.data.data, 'base64').length,
  type: item.binary.data.mimeType,
  extension: item.binary.data.fileExtension,
  base64Length: item.binary.data.data.length
};

return [{
  json: fileInfo,
  binary: item.binary
}];
```

### Binary 데이터 검증

```javascript
// 파일 타입 검증
const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
const mimeType = item.binary.data.mimeType;

if (!allowedTypes.includes(mimeType)) {
  throw new Error(`Invalid file type: ${mimeType}`);
}

// 파일 크기 제한 (10MB)
const maxSize = 10 * 1024 * 1024;
const fileSize = Buffer.from(item.binary.data.data, 'base64').length;

if (fileSize > maxSize) {
  throw new Error(`File too large: ${fileSize} bytes`);
}
```

## 실전 활용 예제

### 이미지 OCR 처리

```
Read Files → Convert to Binary → Google Vision API → Extract Text
```

### 자동 문서 변환 파이프라인

```
Watch Folder → Read Binary → Convert (e.g., DOCX to PDF) → Upload to S3 → Notify
```

### 이메일 첨부파일 처리

```
Gmail Trigger → Extract Attachments → Save to Drive → Update Database
```

### 동적 PDF 리포트 생성

```
Database Query → Generate HTML → HTML to PDF → Email with Attachment
```

## Binary Property 명명 규칙

### 기본 Property 이름

- `data`: 기본 binary 데이터
- `attachment`: 이메일 첨부파일
- `file`: 일반 파일
- `image`: 이미지 데이터
- `document`: 문서 파일

### 복수 Binary 처리

```javascript
// 여러 binary를 동시에 포함
return [{
  json: { note: 'Multiple files' },
  binary: {
    image1: { data: '...', fileName: 'photo1.jpg', ... },
    image2: { data: '...', fileName: 'photo2.jpg', ... },
    document: { data: '...', fileName: 'report.pdf', ... }
  }
}];
```

## Best Practice

### 1. 메모리 관리

```javascript
// 대용량 파일은 스트리밍 처리
// Base64는 원본 대비 약 33% 크기 증가
// 가능한 경우 파일 경로 참조 사용
```

### 2. 에러 처리

```javascript
try {
  const buffer = Buffer.from(item.binary.data.data, 'base64');
  // 처리 로직
} catch (error) {
  console.error('Binary processing error:', error);
  // Fallback 또는 에러 로깅
}
```

### 3. MIME Type 정확성

```javascript
// 파일 확장자와 MIME type 일치 확인
const mimeTypeMap = {
  'jpg': 'image/jpeg',
  'png': 'image/png',
  'pdf': 'application/pdf',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};
```

### 4. Binary Property 명시

```javascript
// node 설정에서 항상 binary property 이름 명시
// 기본값 'data'에 의존하지 말고 명확하게 지정
```

## 주의사항

1. **메모리 제한**: Binary 데이터는 메모리에 로드되므로 대용량 파일 처리 시 주의
2. **Base64 오버헤드**: 인코딩으로 인한 33% 크기 증가 고려
3. **타임아웃**: 대용량 파일 처리 시 node 실행 타임아웃 설정 조정 필요
4. **보안**: 민감한 파일은 암호화 또는 안전한 스토리지 사용

## 지원되는 파일 형식

### 이미지

- JPEG, PNG, GIF, BMP, WEBP, SVG

### 문서

- PDF, DOCX, XLSX, PPTX, TXT, CSV

### 압축

- ZIP, TAR, GZ

### 기타

- JSON, XML, HTML (binary로 처리 가능)

## 참고사항

- Binary 데이터는 workflow JSON에 포함되므로 버전 관리 시 주의
- 대용량 파일은 외부 스토리지 참조 URL 사용 권장
- n8n Cloud는 binary 크기 제한 있음 (플랜별 상이)
- Self-hosted는 서버 리소스에 따라 제한 조정 가능
