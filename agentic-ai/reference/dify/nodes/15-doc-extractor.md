# Document Extractor (문서 추출기)

## 개요

Document Extractor 노드는 업로드된 파일을 언어 모델이 처리할 수 있는 텍스트로 변환하는 중요한 중개자 역할을 함.
AI 시스템은 PDF나 DOCX와 같은 문서 형식을 직접 해석할 수 없기 때문에, 이 노드는 파일 업로드와 후속 AI 분석 간의 다리를 가능하게 함.

## 지원 형식

이 노드는 포괄적인 범위의 텍스트 기반 문서 타입을 수용함:

- **텍스트 문서**: TXT, Markdown 및 HTML 파일
- **Office 문서**: Markdown으로 변환된 표 추출이 포함된 DOCX 파일
- **PDF 문서**: pypdfium2 기술을 활용한 텍스트 기반 PDF
- **레거시 Word**: DOC 파일 (Unstructured API 필요)
- **스프레드시트**: Markdown 테이블로 변환된 Excel (.xls/.xlsx) 및 CSV 파일
- **프레젠테이션**: Unstructured API를 통해 처리된 PowerPoint 파일
- **이메일**: EML 및 MSG 파일 형식
- **전문**: EPUB 도서, VTT 자막, JSON/YAML 및 Properties 파일

이미지, 오디오 또는 비디오와 같은 바이너리 중심 형식은 별도의 전문 도구가 필요함.

## 입출력 구조

노드는 개별 파일 또는 배열로 여러 파일을 허용함.
단일 파일 입력의 경우 추출된 텍스트가 포함된 문자열을 출력함.
여러 파일 입력은 문자열 배열을 생성하며, 각 요소는 하나의 파일 내용을 포함함.
출력 변수는 일관되게 `text`로 명명됨.

## 처리 기능

시스템은 다양한 형식에 최적화된 전문 파싱 라이브러리를 사용함.
UTF-8을 대체 옵션으로 사용하여 chardet를 사용하여 파일 인코딩을 자동으로 감지함.
스프레드시트의 표는 Markdown 형식으로 변환되며, DOCX 파일은 단락 및 표 순서를 유지함.
자막 파일은 동일한 발화자의 연속된 발화를 병합함.

특정 형식(DOC, PowerPoint, EPUB)은 환경 변수를 통해 Unstructured API 서비스 구성이 필요함.
