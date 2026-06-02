# AssemblyAI

**AssemblyAI** 컴포넌트로 강력한 Speech AI 모델을 앱에 적용 가능:

- 오디오 및 비디오 파일 전사
- 전사본 포맷팅
- 자막 생성
- 오디오 파일에 LLM 적용

자세한 정보: [AssemblyAI API 문서](https://www.assemblyai.com/docs)

## 사전 요구 사항

- [AssemblyAI 계정](https://www.assemblyai.com/dashboard/signup) 및 API 키
  - 모든 AssemblyAI 컴포넌트의 *AssemblyAI API Key* 필드에 키 입력
- (선택) LeMUR 사용 시 유료 AssemblyAI 계정 필요 (무료 계정에 미포함)

## 컴포넌트

### AssemblyAI Start Transcript

오디오 또는 비디오 파일을 전사용으로 제출.

> **Tip**: 파일을 한 번만 제출하려면 컴포넌트 경로를 고정(freeze) 가능.

**입력:**
| 파라미터 | 설명 |
|----------|------|
| AssemblyAI API Key | API 키 |
| Audio File | 전사할 오디오 또는 비디오 파일 |
| Speech Model (선택) | 모델 클래스 선택. 기본값: *Best*. [speech models](https://www.assemblyai.com/docs/speech-to-text/speech-recognition#select-the-speech-model-with-best-and-nano) 참조. |
| Automatic Language Detection (선택) | 자동 언어 감지 활성화 |
| Language (선택) | 오디오 파일 언어. 자동 감지 비활성화 시 수동 설정. [지원 언어](https://www.assemblyai.com/docs/getting-started/supported-languages) 참조. |
| Enable Speaker Labels (선택) | 오디오 파일의 화자 감지 및 발화 내용 |
| Expected Number of Speakers (선택) | Speaker Labels 활성화 시 예상 화자 수 |
| Audio File URL (선택) | 전사할 오디오/비디오 파일 URL. Audio File 대신 사용 가능. |
| Punctuate (선택) | 구두점 적용. 기본값: `true` |
| Format Text (선택) | 대소문자 및 텍스트 포맷팅 적용. 기본값: `true` |

**출력:** Transcript ID - 전사본 ID

### AssemblyAI Poll Transcript

전사본 상태를 몇 초마다 확인하여 전사 완료까지 폴링.

**입력:**
| 파라미터 | 설명 |
|----------|------|
| AssemblyAI API Key | API 키 |
| Polling Interval (선택) | 폴링 간격(초). 기본값: 3 |

**출력:** Transcription Result - 완료된 전사본의 AssemblyAI JSON 응답. 텍스트 및 기타 정보 포함.

### AssemblyAI Get Subtitles

SRT 또는 VTT 형식의 자막 생성.

**입력:**
| 파라미터 | 설명 |
|----------|------|
| AssemblyAI API Key | API 키 |
| Transcription Result | **Poll Transcript** 컴포넌트의 출력 |
| Subtitle Format | 자막 형식 (SRT 또는 VTT) |
| Character per Caption (선택) | 자막당 최대 문자 수 (0은 무제한) |

**출력:** Subtitles - SRT 또는 VTT 형식의 자막이 포함된 `subtitles` 필드가 있는 JSON 응답

### AssemblyAI LeMUR

[AssemblyAI LeMUR 프레임워크](https://www.assemblyai.com/docs/lemur)를 사용하여 음성 데이터에 LLM 적용.

LeMUR은 전사본을 추가 컨텍스트로 자동 수집하여 오디오 데이터에 LLM 쉽게 적용.
오디오 요약, 인사이트 추출, 질문하기 등의 작업에 사용.

**입력:**
| 파라미터 | 설명 |
|----------|------|
| AssemblyAI API Key | API 키 |
| Transcription Result | **Poll Transcript** 컴포넌트의 출력 |
| Input Prompt | 모델에 프롬프트할 텍스트. 직접 입력 또는 **Prompt Template** 컴포넌트 연결 |
| Final Model | 압축 후 최종 프롬프트에 사용할 모델. 기본값: Claude 3.5 Sonnet |
| Temperature (선택) | 모델에 사용할 온도. 기본값: 0.0 |
| Max Output Size (선택) | 최대 출력 크기(토큰), 최대 4000. 기본값: 2000 |
| Endpoint (선택) | 사용할 LeMUR 엔드포인트. 기본값: "task". "summary" 및 "question-answer"는 프롬프트 입력 불필요. [LeMUR API 문서](https://www.assemblyai.com/docs/api-reference/lemur/) 참조. |
| Questions (선택) | 쉼표로 구분된 질문 목록. *Endpoint*가 "question-answer"일 때만 사용. |
| Transcript IDs (선택) | 쉼표로 구분된 전사본 ID 목록. LeMUR은 여러 전사본에 대해 작업 가능. 제공 시 *Transcription Result* 무시. |

**출력:** LeMUR Response - 생성된 LLM 응답

### AssemblyAI List Transcripts

이전에 생성된 모든 전사본을 나열하는 독립 실행 컴포넌트.

**입력:**
| 파라미터 | 설명 |
|----------|------|
| AssemblyAI API Key | API 키 |
| Limit (선택) | 검색할 최대 전사본 수. 기본값: 20, 전체는 0 |
| Filter (선택) | 전사본 상태로 필터링 |
| Created On (선택) | 특정 날짜에 생성된 전사본만 조회 (YYYY-MM-DD) |
| Throttled Only (선택) | 스로틀된 전사본만 조회, 상태 필터 재정의 |

**출력:** Transcript List - 전사본 ID, 상태, 데이터 등의 정보가 포함된 전사본 목록

## Flow 프로세스

1. 사용자가 오디오 또는 비디오 파일 입력
2. 사용자가 LLM 프롬프트 입력 (예: 전사본 요약 생성)
3. Flow가 오디오 파일을 전사용으로 제출
4. Flow가 전사 완료까지 몇 초마다 상태 확인
5. Flow가 전사 결과를 파싱하고 전사된 텍스트 출력
6. Flow가 자막 생성
7. Flow가 LLM 프롬프트를 적용하여 요약 생성
8. 독립 컴포넌트로 모든 전사본 나열 가능

## 전사 및 Speech AI Flow 실행

1. Flow 수동 빌드 또는 사전 빌드된 JSON 파일 가져오기:
   - 권장: [AssemblyAI Transcription and Speech AI flow JSON](/assets/files/AssemblyAI_Flow-368be24ae9542f0b8b5253cc9d97b42f.json) 다운로드 후 Langflow에 [가져오기](/concepts-flows-import)
   - 빈 Flow 생성 후 설명된 컴포넌트 추가

2. 모든 필요 컴포넌트에 AssemblyAI API 키 입력 (Start Transcript, Poll Transcript, Get Subtitles, LeMUR, List Transcripts)

3. **Start Transcript** 컴포넌트에 오디오 또는 비디오 파일 선택
   - 선택: 파일 추가 후 컴포넌트를 실행하고 [고정(freeze)](/concepts-components#freeze-a-component)하여 Flow 실행 횟수와 관계없이 파일을 한 번만 제출

4. **Parser** 컴포넌트에서 **Run component** 클릭하여 전사 테스트. 템플릿이 `{text}`인지 확인.

5. 자막 생성 및 전체 Flow 실행: **List Transcript** 컴포넌트에서 **Run component** 클릭

## 커스터마이즈

- **Start Transcript** 컴포넌트의 파라미터 수정
- **Get Subtitles** 컴포넌트의 자막 형식 수정
- **LeMUR** 컴포넌트 입력의 LLM 프롬프트 수정
- **LeMUR** 컴포넌트의 LLM 파라미터 (예: temperature) 수정

## 문제 해결

- 모든 필요 컴포넌트에 API 키가 올바르게 설정되었는지 확인
- LeMUR 사용 시 AssemblyAI 계정 업그레이드 필요 (무료 계정 미포함)
- 모든 컴포넌트가 Flow에서 올바르게 연결되었는지 확인
- Langflow 로그에서 오류 메시지 검토
- [AssemblyAI API 문서](https://www.assemblyai.com/docs/) 확인
- [AssemblyAI 지원팀](https://www.assemblyai.com/contact/support) 문의

