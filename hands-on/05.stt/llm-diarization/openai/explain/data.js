/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../05.stt/llm-diarization/openai/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "OpenAI LLM 화자 분리(Diarization) 예제 설명",
    entry: "diarization.py",
  },

  files: [
    { id: "main", label: "diarization.py", role: "단일 파일 CLI 예제 · MP3를 오디오 LLM에 보내 화자 분리 전사" },
  ],

  flow: [
    { step: 1, title: "실행 시작", label: "실행 시작",
      summary: "터미널에서 python diarization.py 실행 → main()이 진입점으로 호출됨",
      detail: "이 예제는 웹이 아니라 '명령줄 프로그램'임. 터미널에서 실행하면 맨 아래 if __name__ == \"__main__\": 가 main()을 호출함. main()이 전체 작업을 순서대로 지휘함." },
    { step: 2, title: "명령줄 옵션 읽기", label: "옵션 읽기", refs: ["parse_args"],
      summary: "parse_args()로 --input(MP3 경로)·--output-dir·--name-map·--yes 옵션을 읽음",
      detail: "식당에서 주문서를 받는 단계임. argparse가 'python diarization.py --input audio.mp3' 같은 입력을 해석해, 어떤 파일을 처리하고 어디에 저장할지 정함. 옵션을 생략하면 기본값을 씀." },
    { step: 3, title: "오디오 파일 확정", label: "오디오 확정", refs: ["resolve_audio_input", "validate_audio_file"],
      summary: "resolve_audio_input()이 MP3 파일을 정하고 validate_audio_file()로 유효성을 검증함",
      detail: "--input 으로 파일을 직접 줬으면 그걸 씀. 없으면 공용 audio 폴더의 첫 번째 MP3를 자동 선택함. 파일이 없거나 25MB를 초과하거나 MP3가 아니면 오류를 냄." },
    { step: 4, title: "OpenAI 클라이언트 생성", label: "클라이언트 생성", refs: ["load_openai_client"],
      summary: "load_openai_client()가 .env의 OPENAI_API_KEY로 OpenAI 객체를 만듦",
      detail: "OpenAI 서버와 통신할 '전화기'를 준비하는 단계임. .env 파일에서 비밀 API 키를 읽어 클라이언트를 만듦. 키가 없으면 즉시 분명한 오류를 냄." },
    { step: 5, title: "base64 전송 및 전사", label: "base64 전송·전사", refs: ["encode_audio_base64", "transcribe_with_openai_audio"],
      summary: "MP3를 base64로 인코딩 후 Chat Completions input_audio로 gpt-audio 모델에 전달함",
      detail: "일반적인 Whisper API와 달리, 이 예제는 Chat Completions API의 input_audio 기능을 씀. MP3 파일 전체를 base64(글자) 형태로 변환해 메시지 안에 직접 넣어 보냄. 모델이 오디오를 듣고 화자를 구분하며 전사함." },
    { step: 6, title: "전사 결과 파싱", label: "결과 파싱", refs: ["parse_transcript"],
      summary: "parse_transcript()가 AI 응답에서 [MM:SS] 화자A: 텍스트 형식의 줄만 추출함",
      detail: "AI의 자유로운 응답 글에서 정해진 형식의 줄만 골라내는 단계임. 정규표현식(regex)으로 '[MM:SS] 화자A: 발화내용' 형식의 줄만 찾아 구조화된 세그먼트 목록으로 만듦." },
    { step: 7, title: "화자 이름 입력", label: "화자 이름 입력", refs: ["collect_speaker_names"],
      summary: "collect_speaker_names()가 샘플 발화를 보여주고 사용자가 화자 실제 이름을 입력하게 함",
      detail: "AI는 화자를 '화자A', '화자B'처럼 익명으로 표시함. 이 단계에서 각 화자의 샘플 발화를 보여주고 실제 이름(예: '아내', '남편')을 입력받아 매핑함. --yes 옵션이면 자동으로 기본 라벨 유지." },
    { step: 8, title: "이름 적용 및 저장", label: "이름 적용·저장", refs: ["apply_speaker_names", "save_results"],
      summary: "apply_speaker_names()로 이름을 바꾸고, save_results()로 TXT·CSV·JSON 세 파일로 저장함",
      detail: "최종 완성 단계임. 세그먼트에 실제 이름을 적용한 뒤, 원본·파싱·최종 대화록을 TXT로, 세그먼트를 CSV와 JSON으로 각각 저장함. 세 가지 형식으로 다양한 활용이 가능함." },
    { step: 9, title: "종료", label: "종료",
      summary: "저장된 파일 경로를 출력하고 종료 코드(0=성공, 1=실패, 130=중단)를 반환함",
      detail: "작업이 끝나면 TXT·CSV·JSON 경로를 알려주고 끝남. 도중에 오류가 나면 메시지를 찍고 1을 반환. Ctrl+C로 중단하면 130을 반환함." },
  ],

  functions: [
    // ===== 모듈 설정 =====
    {
      id: "module_setup",
      name: "모듈 설정 (경로·상수·프롬프트)",
      fileId: "main",
      summary: "파일 맨 위에서 한글 출력 깨짐 방지, 폴더 경로, 파일 크기 제한, 정규표현식, AI 지침(프롬프트) 등 기본 설정을 준비함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 준비하는 값들'임. 경로는 이 파일의 위치를 기준으로 자동 계산하고, DIARIZATION_PROMPT는 AI에게 화자 분리 방법을 알려주는 긴 지침문임.",
      terms: ["Path(__file__)", "sys.stdout.reconfigure", "정규표현식(regex)", "base64", "TypedDict"],
      lines: [
        { at: 'if hasattr(sys.stdout, "reconfigure"):', text: "윈도우 콘솔에서 한글 출력이 깨지지 않도록 출력 인코딩을 UTF-8로 바꿈." },
        { at: 'SCRIPT_DIR = Path(__file__).resolve().parent', text: "Path(__file__)은 '이 파일의 위치'. .resolve().parent로 이 파일이 든 폴더의 절대경로를 구함." },
        { at: 'MAX_FILE_SIZE_MB = 25', text: "Chat Completions API의 input_audio 최대 파일 크기는 25MB. 이 값을 상수로 정의해 코드 전체에서 재사용함." },
        { at: 'TRANSCRIPT_LINE_RE = re.compile(', text: "정규표현식(regex)을 미리 컴파일해 두는 것. 매번 만들지 않고 재사용하여 빠르게 줄을 파싱함." },
        { at: 'DIARIZATION_PROMPT = """', text: "AI에게 화자 분리를 어떻게 수행할지 알려주는 지침문(프롬프트). 출력 형식까지 명시하여 파싱하기 쉬운 응답을 유도함." },
      ],
      code:
`# Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
SCRIPT_DIR = Path(__file__).resolve().parent
LLM_DIARIZATION_DIR = SCRIPT_DIR.parent
STT_DIR = LLM_DIARIZATION_DIR.parent
HANDS_ON_DIR = STT_DIR.parent
AUDIO_DIR = STT_DIR / "audio"
ENV_PATH = HANDS_ON_DIR / ".env"

MODEL_ID = "gpt-audio-1.5"
AUDIO_FORMAT = "mp3"
MAX_FILE_SIZE_MB = 25
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
MAX_OUTPUT_TOKENS = 4096
MAX_SAMPLE_TEXT_LENGTH = 80

TRANSCRIPT_LINE_RE = re.compile(
    r"^\\[(?P<timestamp>\\d{2}:\\d{2})\\]\\s*"
    r"(?P<speaker>화자[A-Z0-9가-힣]+)\\s*:\\s*"
    r"(?P<text>.+?)\\s*$"
)

DIARIZATION_PROMPT = """첨부된 MP3 오디오를 듣고 한국어 화자 분리 음성 인식을 수행하세요.

[요구사항]
1. 실제 이름을 추정하지 말고 화자를 화자A, 화자B, 화자C 형식으로 구분하세요.
2. 각 발화는 시작 시간을 [MM:SS] 형식으로 표시하세요.
3. 감탄사, 추임새, 망설임, 짧은 대답도 자연스러운 발화로 포함하세요.
4. 전화 통화의 의미가 바뀌지 않도록 원문 발화를 최대한 빠짐없이 옮기세요.
5. 설명, 요약, 제목, 표, 코드블록은 출력하지 마세요.

[출력 형식]
[MM:SS] 화자A: 발화 내용
[MM:SS] 화자B: 발화 내용

위 출력 형식에 맞는 줄만 출력하세요."""`,
    },

    // ===== Segment TypedDict =====
    {
      id: "Segment",
      name: "Segment (TypedDict)",
      fileId: "main",
      summary: "화자 분리 결과 한 줄(세그먼트)의 데이터 구조를 정의함. 번호·타임스탬프·화자·발화 텍스트를 담음.",
      how: "TypedDict는 딕셔너리에 '어떤 키에 어떤 타입의 값이 들어가야 하는지'를 명시하는 파이썬 기능임. 실제 실행에는 영향이 없고, 코드 작성할 때 실수를 줄이는 안내 역할을 함.",
      terms: ["TypedDict", "타입 힌트"],
      lines: [
        { at: 'class Segment(TypedDict):', text: "Segment는 TypedDict를 상속한 클래스임. 딕셔너리인데 키와 값 타입이 정해져 있음." },
        { at: '"파싱된 화자 분리 세그먼트 구조."', text: "이 클래스의 역할을 설명하는 짧은 docstring임." },
        { at: 'id: int', text: "각 세그먼트에 붙는 순서 번호(정수)." },
        { at: 'speaker: str', text: "화자 라벨(예: '화자A') 또는 실제 이름이 들어가는 문자열 칸." },
      ],
      code:
`class Segment(TypedDict):
    """파싱된 화자 분리 세그먼트 구조."""

    id: int
    timestamp: str
    speaker: str
    text: str`,
    },

    // ===== load_openai_client =====
    {
      id: "load_openai_client",
      name: "load_openai_client(env_path)",
      fileId: "main",
      summary: "비밀 설정 파일(.env)에서 OpenAI API 키를 읽어, 서버와 통신할 클라이언트를 만듦.",
      how: "API 키는 코드에 직접 쓰지 않고 .env 파일에 보관함. load_dotenv로 그 파일을 읽어 환경변수로 올린 뒤 키를 꺼냄. 키가 없으면 즉시 분명한 오류를 내어 빨리 알아채게 함.",
      terms: ["load_dotenv", "환경변수(.env)", "API 키", "RuntimeError", "OpenAI 클라이언트"],
      lines: [
        { at: 'load_dotenv(env_path)', text: ".env 파일을 읽어 그 안의 OPENAI_API_KEY를 환경변수로 올림." },
        { at: 'api_key = os.getenv("OPENAI_API_KEY")', text: "환경변수에서 API 키를 꺼냄. 없으면 None을 받음." },
        { at: 'if not api_key:', text: "키가 없으면 즉시 RuntimeError로 멈춰 원인(어떤 키가 어디에 없는지)을 알려줌." },
        { at: 'return OpenAI(api_key=api_key)', text: "키로 OpenAI 클라이언트(서버와 통신하는 객체)를 만들어 돌려줌." },
      ],
      code:
`def load_openai_client(env_path: Path) -> OpenAI:
    """OPENAI_API_KEY를 읽어 OpenAI 클라이언트를 생성함."""
    # .env 파일에서 API 키 등 환경변수를 로드함
    load_dotenv(env_path)
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(f"OPENAI_API_KEY가 설정되지 않았습니다: {env_path}")
    return OpenAI(api_key=api_key)`,
    },

    // ===== find_audio_files =====
    {
      id: "find_audio_files",
      name: "find_audio_files(audio_dir)",
      fileId: "main",
      summary: "audio 폴더 안에서 MP3 파일만 골라 이름순으로 돌려줌.",
      how: "폴더가 없으면 빈 목록을 돌려줌(안전). 폴더 안 항목을 하나씩 보며, 파일이면서 확장자가 '.mp3'인 것만 모아 sorted로 이름순 정렬함.",
      terms: ["sorted()", "suffix(확장자)", "타입 힌트"],
      lines: [
        { at: 'if not audio_dir.exists():', text: "폴더가 아예 없으면 빈 목록 []을 돌려줌(오류 대신 안전 처리)." },
        { at: 'path for path in audio_dir.iterdir()', text: "iterdir()로 폴더 안의 항목을 하나씩 훑음." },
        { at: 'path.suffix.lower() == ".mp3"', text: "확장자가 '.mp3'인 파일만 고름. .lower()로 대소문자를 맞춰 비교함." },
      ],
      code:
`def find_audio_files(audio_dir: Path) -> list[Path]:
    """audio 디렉터리에서 MP3 파일 목록을 이름순으로 반환함."""
    if not audio_dir.exists():
        return []
    return sorted(
        path for path in audio_dir.iterdir() if path.is_file() and path.suffix.lower() == ".mp3"
    )`,
    },

    // ===== validate_audio_file =====
    {
      id: "validate_audio_file",
      name: "validate_audio_file(audio_path)",
      fileId: "main",
      summary: "선택된 MP3 파일이 존재하는지·MP3인지·25MB 이하인지 세 가지를 검사함.",
      how: "잘못된 파일로 API를 호출하면 비용도 들고 오류도 나중에 남. 미리 조건을 검사해서 문제를 빨리 발견하게 함. 조건별로 다른 오류(FileNotFoundError, ValueError)를 발생시켜 원인을 명확히 알림.",
      terms: ["FileNotFoundError", "ValueError", "타입 힌트"],
      lines: [
        { at: 'if not audio_path.exists():', text: "파일이 없으면 FileNotFoundError로 알려줌." },
        { at: 'if audio_path.suffix.lower() != ".mp3":', text: "MP3가 아닌 파일이면 ValueError로 알려줌. 이 예제는 MP3만 지원함." },
        { at: 'if audio_path.stat().st_size > MAX_FILE_SIZE_BYTES:', text: "파일 크기가 25MB를 초과하면 ValueError로 알려줌. API 제한 사항임." },
      ],
      code:
`def validate_audio_file(audio_path: Path) -> None:
    """선택된 MP3 입력 파일의 유효성을 검증함."""
    if not audio_path.exists():
        raise FileNotFoundError(f"입력 오디오 파일을 찾을 수 없습니다: {audio_path}")
    if not audio_path.is_file():
        raise ValueError(f"입력 경로가 파일이 아닙니다: {audio_path}")
    if audio_path.suffix.lower() != ".mp3":
        raise ValueError("이 예제는 Chat Completions input_audio format='mp3' 전송만 지원합니다.")
    if audio_path.stat().st_size > MAX_FILE_SIZE_BYTES:
        size_mb = audio_path.stat().st_size / (1024 * 1024)
        raise ValueError(f"오디오 파일이 {MAX_FILE_SIZE_MB}MB를 초과합니다: {size_mb:.2f}MB")`,
    },

    // ===== resolve_audio_input =====
    {
      id: "resolve_audio_input",
      name: "resolve_audio_input(input_arg)",
      fileId: "main",
      summary: "명령줄로 받은 파일이 있으면 그걸 쓰고, 없으면 공용 audio 폴더의 첫 번째 MP3를 자동 선택함.",
      how: "--input 으로 경로를 줬으면 그 파일을 검증 후 사용함. 인수가 없으면 audio 폴더에서 MP3 목록을 찾아 첫 번째를 자동 선택함(simple 예제처럼 사용자에게 묻지 않음).",
      terms: ["Path(__file__)", "FileNotFoundError", "타입 힌트"],
      lines: [
        { at: 'if input_arg is not None:', text: "--input 으로 파일을 직접 줬으면(인수가 None이 아니면) 그 경로를 사용함." },
        { at: 'audio_path = input_arg.expanduser().resolve()', text: "~ 같은 단축 경로를 펴고(expanduser) 절대경로로 바꿈(resolve)." },
        { at: 'audio_files = find_audio_files(AUDIO_DIR)', text: "인수가 없으면 audio 폴더 목록을 찾아 첫 번째 MP3를 자동 선택함." },
        { at: 'audio_path = audio_files[0].resolve()', text: "목록의 첫 번째 파일을 절대경로로 변환해 선택함." },
      ],
      code:
`def resolve_audio_input(input_arg: Path | None) -> Path:
    """CLI 인수가 없으면 공용 audio 디렉터리 첫 번째 MP3를 자동 선택함."""
    if input_arg is not None:
        audio_path = input_arg.expanduser().resolve()
        validate_audio_file(audio_path)
        return audio_path

    audio_files = find_audio_files(AUDIO_DIR)
    if not audio_files:
        raise FileNotFoundError(f"MP3 파일을 찾을 수 없습니다: {AUDIO_DIR}")

    audio_path = audio_files[0].resolve()
    validate_audio_file(audio_path)
    return audio_path`,
    },

    // ===== encode_audio_base64 =====
    {
      id: "encode_audio_base64",
      name: "encode_audio_base64(audio_path)",
      fileId: "main",
      summary: "오디오 파일을 읽어 base64 인코딩된 문자열로 변환함.",
      how: "Chat Completions API의 input_audio는 파일을 직접 업로드하는 게 아니라, 파일 내용을 base64(글자 형식)로 변환해 메시지 안에 담아 보냄. 바이너리(rb)로 파일을 읽어 base64로 인코딩하고, 마지막에 .decode('utf-8')로 글자로 바꿈.",
      terms: ["with open(rb)", "base64"],
      lines: [
        { at: 'with audio_path.open("rb") as audio_file:', text: "오디오 파일을 바이너리(rb)로 엶. with 블록을 벗어나면 파일이 자동으로 닫힘." },
        { at: 'return base64.b64encode(audio_file.read()).decode("utf-8")', text: "파일 내용 전체를 읽어 base64로 인코딩하고, 글자(str) 형태로 변환해 돌려줌." },
      ],
      code:
`def encode_audio_base64(audio_path: Path) -> str:
    """오디오 파일을 읽어 base64 인코딩된 문자열로 반환함."""
    with audio_path.open("rb") as audio_file:
        return base64.b64encode(audio_file.read()).decode("utf-8")`,
    },

    // ===== transcribe_with_openai_audio =====
    {
      id: "transcribe_with_openai_audio",
      name: "transcribe_with_openai_audio(client, audio_path, max_output_tokens)",
      fileId: "main",
      summary: "base64로 인코딩된 MP3를 Chat Completions input_audio로 전달하여 화자 분리 전사 결과를 받아 옴.",
      how: "Whisper API(client.audio.transcriptions)와 달리, Chat Completions API(client.chat.completions.create)에 오디오를 첨부해 LLM이 직접 판단하게 함. modalities=[\"text\"]는 텍스트 출력만 요청하는 옵션임. 응답이 문자열이나 리스트로 올 수 있어 두 경우를 모두 처리함.",
      terms: ["input_audio", "modalities", "OpenAI 클라이언트", "base64"],
      lines: [
        { at: 'audio_data = encode_audio_base64(audio_path)', text: "먼저 MP3 파일을 base64 문자열로 변환함." },
        { at: 'response = client.chat.completions.create(', text: "Chat Completions API를 호출함. Whisper API가 아닌 GPT 오디오 모델을 씀." },
        { at: '"type": "input_audio",', text: "메시지 콘텐츠에 오디오를 첨부하는 방식. base64 데이터와 형식(mp3)을 함께 넣음." },
        { at: 'content = response.choices[0].message.content', text: "API 응답에서 첫 번째 후보 메시지의 내용을 꺼냄." },
        { at: 'if isinstance(content, str) and content.strip():', text: "응답이 문자열이면 바로 반환함. 리스트이면 아래에서 텍스트 조각을 모아 합침." },
      ],
      code:
`def transcribe_with_openai_audio(
    client: OpenAI,
    audio_path: Path,
    max_output_tokens: int,
) -> str:
    """base64 MP3 오디오를 OpenAI 오디오 채팅 모델에 전달하여 전사 결과를 반환함."""
    audio_data = encode_audio_base64(audio_path)

    response = client.chat.completions.create(
        model=MODEL_ID,
        modalities=["text"],
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": DIARIZATION_PROMPT},
                    {
                        "type": "input_audio",
                        "input_audio": {
                            "data": audio_data,
                            "format": AUDIO_FORMAT,
                        },
                    },
                ],
            }
        ],
        max_tokens=max_output_tokens,
    )

    content = response.choices[0].message.content
    if isinstance(content, str) and content.strip():
        return content.strip()
    if isinstance(content, list):
        text_parts: list[str] = []
        for part in content:
            if isinstance(part, dict) and part.get("type") == "text":
                text_parts.append(str(part.get("text", "")))
            elif hasattr(part, "text"):
                text_parts.append(str(part.text))
        combined = "\\n".join(part for part in text_parts if part.strip())
        if combined.strip():
            return combined.strip()
    raise RuntimeError("OpenAI 응답에서 텍스트 내용을 찾을 수 없습니다.")`,
    },

    // ===== parse_transcript =====
    {
      id: "parse_transcript",
      name: "parse_transcript(raw_text)",
      fileId: "main",
      summary: "AI 응답 전체 글에서 [MM:SS] 화자X: 텍스트 형식의 줄만 골라 세그먼트 목록으로 만듦.",
      how: "AI가 자유롭게 쓴 글 중에는 설명·표 같은 불필요한 줄이 섞일 수 있음. 정규표현식(TRANSCRIPT_LINE_RE)으로 정해진 형식의 줄만 찾아내고, 나머지는 무시함. 각 줄에서 타임스탬프·화자·발화 텍스트를 꺼내 딕셔너리로 만듦.",
      terms: ["정규표현식(regex)", "splitlines()", "TypedDict"],
      lines: [
        { at: 'for line in raw_text.splitlines():', text: "응답 전체를 줄 단위로 나눠 하나씩 검사함. splitlines()는 줄바꿈 문자로 텍스트를 자르는 함수임." },
        { at: 'match = TRANSCRIPT_LINE_RE.match(line.strip())', text: "각 줄이 '[MM:SS] 화자X: 텍스트' 형식인지 정규표현식으로 확인함. 형식이 맞으면 match 객체가 생기고, 아니면 None이 됨." },
        { at: 'if not match:', text: "형식에 맞지 않는 줄(설명, 제목 등)은 건너뜀." },
        { at: '"id": len(segments) + 1,', text: "세그먼트 번호는 1부터 순서대로 매김. len(segments)는 현재까지 모인 세그먼트 수임." },
      ],
      code:
`def parse_transcript(raw_text: str) -> list[Segment]:
    """\`[MM:SS] 화자X: 텍스트\` 형식의 행만 파싱하고 그 외 줄은 무시함."""
    segments: list[Segment] = []
    for line in raw_text.splitlines():
        match = TRANSCRIPT_LINE_RE.match(line.strip())
        if not match:
            continue

        text = match.group("text").strip()
        if not text:
            continue

        segments.append(
            {
                "id": len(segments) + 1,
                "timestamp": match.group("timestamp"),
                "speaker": match.group("speaker"),
                "text": text,
            }
        )
    return segments`,
    },

    // ===== parse_name_map =====
    {
      id: "parse_name_map",
      name: "parse_name_map(name_map_arg)",
      fileId: "main",
      summary: "'화자A=이름,화자B=이름' 형태의 명령줄 문자열을 딕셔너리로 변환함.",
      how: "--name-map 옵션으로 비대화식 이름 매핑을 받을 때 씀. 쉼표로 나누고, 각 항목을 '='로 나눠 화자→이름 쌍을 만듦. 빈 값이면 빈 딕셔너리를 반환해 안전하게 처리함.",
      terms: ["딕셔너리(dict)", "ValueError", "타입 힌트"],
      lines: [
        { at: 'if not name_map_arg:', text: "인수가 None이거나 빈 문자열이면 빈 딕셔너리를 돌려줌." },
        { at: 'for item in name_map_arg.split(","):', text: "쉼표로 나눠 '화자A=이름' 형태의 항목을 하나씩 처리함." },
        { at: 'if "=" not in item:', text: "'=' 기호가 없으면 형식 오류임. ValueError로 알려줌." },
        { at: 'speaker, name = item.split("=", 1)', text: "'='로 나누되 최대 1번만 나눔(이름에 '='가 있어도 안전)." },
      ],
      code:
`def parse_name_map(name_map_arg: str | None) -> dict[str, str]:
    """\`화자A=이름,화자B=이름\` 형태의 CLI 입력을 딕셔너리로 파싱함."""
    if not name_map_arg:
        return {}

    mapping: dict[str, str] = {}
    for item in name_map_arg.split(","):
        item = item.strip()
        if not item:
            continue
        if "=" not in item:
            raise ValueError(f"--name-map 항목은 '화자A=이름' 형식이어야 합니다: {item}")
        speaker, name = item.split("=", 1)
        speaker = speaker.strip()
        name = name.strip()
        if not speaker:
            raise ValueError(f"--name-map 화자 라벨이 비어 있습니다: {item}")
        mapping[speaker] = name or speaker
    return mapping`,
    },

    // ===== speaker_sort_key =====
    {
      id: "speaker_sort_key",
      name: "speaker_sort_key(speaker)",
      fileId: "main",
      summary: "'화자A', '화자B' 같은 화자 라벨을 알파벳 순서(A→B→C)로 정렬하기 위한 정렬 키를 반환함.",
      how: "sorted()에 key=speaker_sort_key를 주면, 각 화자 이름에 이 함수를 적용한 값을 기준으로 정렬함. '화자A'에서 'A'를 꺼내 알파벳 순서를 숫자로 바꿈(A=0, B=1, C=2). 규칙에 맞지 않는 라벨은 100을 줘 맨 뒤로 보냄.",
      terms: ["ord()", "타입 힌트"],
      lines: [
        { at: 'suffix = speaker.replace("화자", "", 1)', text: "'화자' 글자를 제거해 'A', 'B' 같은 뒷부분만 꺼냄." },
        { at: 'if len(suffix) == 1 and "A" <= suffix <= "Z":', text: "뒷부분이 영문 대문자 한 글자면 알파벳 순서로 정렬 키를 만듦." },
        { at: 'return (ord(suffix) - ord("A"), speaker)', text: "ord()로 알파벳을 숫자로 바꿈. A=0, B=1, C=2 순서가 됨." },
      ],
      code:
`def speaker_sort_key(speaker: str) -> tuple[int, str]:
    """화자A, 화자B 순서로 정렬하기 위한 정렬 키를 반환함."""
    suffix = speaker.replace("화자", "", 1)
    if len(suffix) == 1 and "A" <= suffix <= "Z":
        return (ord(suffix) - ord("A"), speaker)
    return (100, speaker)`,
    },

    // ===== collect_speaker_samples =====
    {
      id: "collect_speaker_samples",
      name: "collect_speaker_samples(segments)",
      fileId: "main",
      summary: "화자별로 샘플 발화를 최대 2개씩 수집하여 화자→샘플목록 딕셔너리로 반환함.",
      how: "이름 입력 화면에서 각 화자가 어떤 말을 했는지 미리 보여주기 위해 씀. setdefault로 처음 보는 화자를 안전하게 등록하고, 2개 채우면 더 이상 추가하지 않음. 긴 발화는 80자로 잘라 표시함.",
      terms: ["딕셔너리(dict)", "setdefault()", "타입 힌트"],
      lines: [
        { at: 'samples.setdefault(speaker, [])', text: "화자가 처음 나오면 빈 목록을 만들어 둠. 이미 있으면 그대로 둠(setdefault의 역할)." },
        { at: 'if len(samples[speaker]) >= 2:', text: "샘플이 2개 이상이면 더 이상 추가하지 않고 건너뜀." },
        { at: 'if len(text) > MAX_SAMPLE_TEXT_LENGTH:', text: "발화가 너무 길면 80자까지만 잘라 '...'을 붙임." },
      ],
      code:
`def collect_speaker_samples(segments: list[Segment]) -> dict[str, list[str]]:
    """화자별 샘플 발화를 최대 2개씩 수집하여 반환함."""
    samples: dict[str, list[str]] = {}
    for segment in segments:
        speaker = segment["speaker"]
        samples.setdefault(speaker, [])
        if len(samples[speaker]) >= 2:
            continue

        text = segment["text"]
        if len(text) > MAX_SAMPLE_TEXT_LENGTH:
            text = text[:MAX_SAMPLE_TEXT_LENGTH] + "..."
        samples[speaker].append(text)
    return samples`,
    },

    // ===== collect_speaker_names =====
    {
      id: "collect_speaker_names",
      name: "collect_speaker_names(segments, provided_mapping, non_interactive)",
      fileId: "main",
      summary: "화자 샘플을 보여주고, 비대화식 모드가 아니면 사용자가 실제 이름을 입력하게 함.",
      how: "세 가지 경우를 처리함: ① --name-map으로 이미 이름이 있으면 그 이름 사용 ② --yes(non_interactive) 이면 기본 라벨 유지 ③ 둘 다 아니면 키보드로 입력받음. 화자는 알파벳 순서로 정렬해 순서대로 보여줌.",
      terms: ["input()", "딕셔너리(dict)", "set(집합)", "sorted()", "타입 힌트"],
      lines: [
        { at: 'speakers = sorted({segment["speaker"] for segment in segments}, key=speaker_sort_key)', text: "세그먼트 전체에서 화자 라벨만 추출(집합으로 중복 제거)하고 알파벳 순으로 정렬함." },
        { at: 'if speaker in provided_mapping:', text: "--name-map으로 이름이 미리 제공된 화자는 그 이름을 그대로 씀." },
        { at: 'if non_interactive:', text: "--yes 옵션이면 입력을 받지 않고 기본 화자 라벨을 유지함." },
        { at: 'name = input(f"{speaker} 실제 이름(Enter={speaker}): ").strip()', text: "키보드로 이름을 입력받음. Enter만 치면 기본 라벨을 유지함." },
      ],
      code:
`def collect_speaker_names(
    segments: list[Segment],
    provided_mapping: dict[str, str],
    non_interactive: bool,
) -> dict[str, str]:
    """화자 샘플을 보여 주고, 비대화식 모드가 아니면 실제 이름을 입력받음."""
    speakers = sorted({segment["speaker"] for segment in segments}, key=speaker_sort_key)
    samples = collect_speaker_samples(segments)
    name_mapping: dict[str, str] = {}

    print("\\n[화자별 샘플 발화]")
    for speaker in speakers:
        print(f"- {speaker}")
        for index, sample in enumerate(samples.get(speaker, []), start=1):
            print(f"  {index}. {sample}")

    print("\\n[화자 이름 입력]")
    print("Enter를 누르면 기본 화자 라벨을 유지합니다.")

    for speaker in speakers:
        if speaker in provided_mapping:
            name_mapping[speaker] = provided_mapping[speaker]
            print(f"- {speaker}: {provided_mapping[speaker]}")
            continue

        if non_interactive:
            name_mapping[speaker] = speaker
            print(f"- {speaker}: {speaker}")
            continue

        name = input(f"{speaker} 실제 이름(Enter={speaker}): ").strip()
        name_mapping[speaker] = name or speaker

    return name_mapping`,
    },

    // ===== apply_speaker_names =====
    {
      id: "apply_speaker_names",
      name: "apply_speaker_names(segments, name_mapping)",
      fileId: "main",
      summary: "파싱된 세그먼트의 화자 라벨을 사용자가 입력한 실제 이름으로 바꿔 새 목록을 반환함.",
      how: "원본 세그먼트를 바꾸지 않고 새로운 목록을 만들어 반환함(불변성 유지). name_mapping.get(화자, 화자)는 '이름이 있으면 쓰고, 없으면 원래 라벨 유지'라는 안전한 방식임.",
      terms: ["리스트 컴프리헨션", ".get()", "TypedDict"],
      lines: [
        { at: 'return [', text: "리스트 컴프리헨션으로 새 세그먼트 목록을 만들어 반환함. 원본은 그대로 둠." },
        { at: '"speaker": name_mapping.get(segment["speaker"], segment["speaker"])', text: "name_mapping에서 화자 이름을 찾음. 없으면 원래 화자 라벨을 그대로 씀." },
      ],
      code:
`def apply_speaker_names(segments: list[Segment], name_mapping: dict[str, str]) -> list[Segment]:
    """파싱된 세그먼트에 화자 표시 이름을 적용하여 반환함."""
    return [
        {
            "id": segment["id"],
            "timestamp": segment["timestamp"],
            "speaker": name_mapping.get(segment["speaker"], segment["speaker"]),
            "text": segment["text"],
        }
        for segment in segments
    ]`,
    },

    // ===== format_segments =====
    {
      id: "format_segments",
      name: "format_segments(segments)",
      fileId: "main",
      summary: "세그먼트 목록을 '[MM:SS] 화자: 발화내용' 형태의 대화록 텍스트 한 줄씩으로 변환함.",
      how: "저장할 TXT 파일이나 화면 출력을 위해 세그먼트 목록을 보기 좋은 텍스트 형식으로 이어 붙임. 각 세그먼트를 f-string으로 형식화하고 줄바꿈으로 연결함.",
      terms: ["f-string", "리스트 컴프리헨션", "타입 힌트"],
      lines: [
        { at: 'return "\\n".join(', text: "각 세그먼트를 형식화한 문자열을 줄바꿈(\\n)으로 이어 붙여 하나의 텍스트로 만듦." },
        { at: 'f"[{segment[\'timestamp\']}] {segment[\'speaker\']}: {segment[\'text\']}"', text: "f-string으로 '[00:10] 화자A: 안녕하세요' 형태의 줄을 만듦." },
      ],
      code:
`def format_segments(segments: list[Segment]) -> str:
    """세그먼트 목록을 대화록 텍스트 형식으로 변환함."""
    return "\\n".join(
        f"[{segment['timestamp']}] {segment['speaker']}: {segment['text']}"
        for segment in segments
    )`,
    },

    // ===== save_results =====
    {
      id: "save_results",
      name: "save_results(output_dir, audio_path, raw_transcript, parsed_segments, final_segments, name_mapping)",
      fileId: "main",
      summary: "화자 분리 결과를 TXT·CSV·JSON 세 가지 형식으로 저장하고 저장 경로를 반환함.",
      how: "세 파일을 만드는 이유: TXT는 사람이 읽기 편한 형식, CSV는 엑셀에서 열기 편한 형식, JSON은 다른 프로그램이 읽기 좋은 형식임. pandas의 to_csv로 CSV를 만들고, json.dumps로 JSON을 만듦. UTF-8로 저장해 한글이 깨지지 않게 함.",
      terms: ["mkdir", "pandas(DataFrame)", "JSON", "f-string", "write_text", "타입 힌트"],
      lines: [
        { at: 'output_dir.mkdir(parents=True, exist_ok=True)', text: "결과를 저장할 폴더가 없으면 만들어 둠(exist_ok=True: 이미 있어도 오류 없음)." },
        { at: 'txt_path = output_dir / "result.txt"', text: "저장할 파일 경로를 정함. / 연산자로 폴더 경로에 파일명을 붙임." },
        { at: 'pd.DataFrame(final_segments).to_csv(', text: "세그먼트 목록을 DataFrame으로 변환 후 CSV로 저장함. | 구분자, utf-8-sig 인코딩(엑셀에서 한글 깨짐 방지)." },
        { at: 'json_path.write_text(json.dumps(json_data,', text: "JSON 형태로 변환한 뒤 파일에 씀. ensure_ascii=False로 한글을 그대로 유지, indent=2로 보기 좋게 들여씀." },
      ],
      code:
`def save_results(
    output_dir: Path,
    audio_path: Path,
    raw_transcript: str,
    parsed_segments: list[Segment],
    final_segments: list[Segment],
    name_mapping: dict[str, str],
) -> tuple[Path, Path, Path]:
    """원본 및 이름 반영 화자 분리 결과를 TXT, CSV, JSON으로 저장함."""
    output_dir.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    txt_path = output_dir / "result.txt"
    txt_content = f"""OpenAI LLM Diarization Result
Generated At: {generated_at}
Model: {MODEL_ID}
Audio File: {audio_path.name}

## 원본 변환 결과
{raw_transcript.strip()}

## 파싱된 원본 대화록
{format_segments(parsed_segments)}

## 이름 반영 최종 대화록
{format_segments(final_segments)}
"""
    txt_path.write_text(txt_content, encoding="utf-8")

    csv_path = output_dir / "result_chunks.csv"
    pd.DataFrame(final_segments).to_csv(csv_path, index=False, encoding="utf-8-sig", sep="|")

    json_path = output_dir / "result.json"
    json_data = {
        "generated_at": generated_at,
        "model": MODEL_ID,
        "audio_file": str(audio_path),
        "speaker_name_map": name_mapping,
        "segments": final_segments,
    }
    json_path.write_text(json.dumps(json_data, ensure_ascii=False, indent=2), encoding="utf-8")

    return txt_path, csv_path, json_path`,
    },

    // ===== parse_args =====
    {
      id: "parse_args",
      name: "parse_args()",
      fileId: "main",
      summary: "명령줄 옵션(--input, --output-dir, --name-map, --yes, --max-output-tokens)을 정의하고 해석함.",
      how: "argparse는 'python diarization.py --input audio.mp3 --yes' 같은 명령줄 입력을 처리하는 표준 도구임. 각 옵션의 타입·기본값·도움말을 정의한 뒤 parse_args()로 실제 입력을 해석함.",
      terms: ["argparse", "타입 힌트"],
      lines: [
        { at: 'parser = argparse.ArgumentParser(', text: "argparse 파서를 만듦. 명령줄 옵션을 정의·해석하는 표준 도구임." },
        { at: '"--input",', text: "--input 옵션: 변환할 MP3 파일 경로(생략 가능, 생략 시 audio 폴더 첫 번째 파일)." },
        { at: '"--output-dir",', text: "--output-dir 옵션: 결과를 저장할 폴더 경로(기본값: 스크립트와 같은 폴더)." },
        { at: '"--name-map",', text: "--name-map 옵션: '화자A=이름,화자B=이름' 형태의 비대화식 이름 매핑." },
        { at: '"--yes",', text: "--yes 옵션: 이름 입력을 건너뛰고 기본 화자 라벨을 유지하는 플래그." },
      ],
      code:
`def parse_args() -> argparse.Namespace:
    """CLI 인수를 파싱함."""
    parser = argparse.ArgumentParser(
        description="OpenAI gpt-audio-1.5 기반 LLM 화자 분리 음성 인식 예제"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=None,
        help="입력 MP3 파일 경로. 생략 시 hands-on/05.stt/audio의 첫 번째 MP3 사용",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=SCRIPT_DIR,
        help=f"결과 저장 디렉터리. 기본값: {SCRIPT_DIR}",
    )
    parser.add_argument(
        "--name-map",
        default=None,
        help='비대화식 이름 매핑. 예: "화자A=아내,화자B=남편"',
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="이름 입력을 건너뛰고 미지정 화자는 기본 라벨 유지",
    )
    parser.add_argument(
        "--max-output-tokens",
        type=int,
        default=MAX_OUTPUT_TOKENS,
        help=f"Chat Completions 최대 출력 토큰. 기본값: {MAX_OUTPUT_TOKENS}",
    )
    return parser.parse_args()`,
    },

    // ===== main =====
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "전체 작업을 순서대로 실행하는 시작점. 옵션 읽기→오디오 확정→전사→파싱→이름 입력→저장.",
      how: "프로그램의 '지휘자'임. 옵션을 읽고, 오디오를 정하고, 클라이언트를 만든 뒤, 전사→파싱→이름매핑→저장을 차례로 실행함. KeyboardInterrupt(Ctrl+C)와 일반 Exception을 따로 잡아 종료 코드를 다르게 반환함.",
      terms: ["예외 처리(try/except)", "KeyboardInterrupt", "sys.stderr", "raise SystemExit", "if __name__"],
      lines: [
        { at: 'args = parse_args()', text: "먼저 명령줄 옵션을 읽음." },
        { at: 'audio_path = resolve_audio_input(args.input)', text: "변환할 MP3를 확정함(인수 또는 자동 선택)." },
        { at: 'client = load_openai_client(ENV_PATH)', text: "API 키로 OpenAI 클라이언트를 준비함." },
        { at: 'raw_transcript = transcribe_with_openai_audio(', text: "오디오를 input_audio로 전송해 화자 분리 전사 결과를 받음." },
        { at: 'except KeyboardInterrupt:', text: "Ctrl+C로 중단하면 130을 반환. 일반 오류는 아래 except에서 1을 반환함." },
      ],
      code:
`def main() -> int:
    """OpenAI 오디오 화자 분리 워크플로우를 실행함."""
    args = parse_args()
    output_dir = args.output_dir.expanduser().resolve()

    try:
        audio_path = resolve_audio_input(args.input)
        provided_mapping = parse_name_map(args.name_map)

        print("=" * 70)
        print("OpenAI LLM 화자 분리 음성 인식")
        print("=" * 70)
        print(f"- 모델: {MODEL_ID}")
        print(f"- 입력: {audio_path}")
        print(f"- 출력 디렉터리: {output_dir}")

        client = load_openai_client(ENV_PATH)

        print("\\n[1/4] MP3 파일을 base64 input_audio로 전송 중")
        raw_transcript = transcribe_with_openai_audio(
            client=client,
            audio_path=audio_path,
            max_output_tokens=args.max_output_tokens,
        )

        print("\\n[2/4] AI 원본 응답")
        print("-" * 70)
        print(raw_transcript)
        print("-" * 70)

        parsed_segments = parse_transcript(raw_transcript)
        if not parsed_segments:
            raise RuntimeError("AI 응답에서 '[MM:SS] 화자X: 텍스트' 형식의 줄을 찾지 못했습니다.")

        print(f"\\n[3/4] 파싱된 발화 수: {len(parsed_segments)}")
        name_mapping = collect_speaker_names(
            segments=parsed_segments,
            provided_mapping=provided_mapping,
            non_interactive=args.yes,
        )
        final_segments = apply_speaker_names(parsed_segments, name_mapping)

        txt_path, csv_path, json_path = save_results(
            output_dir=output_dir,
            audio_path=audio_path,
            raw_transcript=raw_transcript,
            parsed_segments=parsed_segments,
            final_segments=final_segments,
            name_mapping=name_mapping,
        )

    except KeyboardInterrupt:
        print("\\n사용자 요청으로 중단되었습니다.", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print("\\n[4/4] 저장 완료")
    print(f"- TXT:  {txt_path}")
    print(f"- CSV:  {csv_path}")
    print(f"- JSON: {json_path}")
    return 0


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    raise SystemExit(main())`,
    },
  ],

  glossary: {
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .resolve().parent를 붙이면 이 파일이 든 폴더의 절대경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "sys.stdout.reconfigure": "콘솔(터미널) 출력의 글자 인코딩을 바꾸는 기능. 윈도우에서 한글이 깨지지 않도록 UTF-8로 다시 설정함.",
    "정규표현식(regex)": "문자열에서 특정 패턴을 찾거나 검증하는 규칙. 예: r'^[0-9]+$'는 '숫자로만 이루어진 문자열'을 뜻함. re.compile()로 미리 만들어 두면 반복 사용 시 빠름.",
    "base64": "바이너리 데이터(이미지·오디오 등)를 글자(A~Z, a~z, 0~9, +, /)로만 표현하는 인코딩 방식. 글자만 주고받을 수 있는 곳(API, JSON)에 파일 내용을 넣을 때 씀.",
    "TypedDict": "딕셔너리의 키와 값 타입을 미리 정해두는 파이썬 기능. 예: Segment TypedDict는 'id는 int, speaker는 str이어야 한다'를 명시함. 실행에 영향은 없고, 코드 작성 시 실수를 줄임.",
    "input_audio": "OpenAI Chat Completions API에서 오디오 파일을 메시지에 첨부하는 방식. base64로 인코딩된 오디오 데이터를 type='input_audio'로 넣으면 LLM이 오디오를 직접 처리함.",
    "modalities": "Chat Completions API에서 응답 형식을 지정하는 옵션. ['text']이면 텍스트만, ['text', 'audio']이면 텍스트와 오디오 둘 다 받음.",
    "OpenAI 클라이언트": "OpenAI 서버와 통신하는 객체. client.chat.completions.create(...)처럼 이 객체를 통해 API를 호출함.",
    "pandas(DataFrame)": "데이터를 표(행·열) 형태로 다루는 파이썬 라이브러리. pd.DataFrame(목록)으로 표를 만들고 to_csv()로 CSV 파일로 저장함.",
    "splitlines()": "문자열을 줄바꿈 문자(\\n, \\r\\n 등) 기준으로 나눠 줄 목록으로 만드는 함수. split('\\n')과 비슷하지만 다양한 줄바꿈 형식을 자동 처리함.",
    "setdefault()": "딕셔너리에서 '키가 없으면 기본값을 넣고 반환, 있으면 기존 값을 반환'하는 함수. if 키 not in dict: dict[키] = [] 를 한 줄로 줄인 것임.",
    "ord()": "글자 하나를 그에 해당하는 숫자(유니코드 코드 포인트)로 바꾸는 함수. 예: ord('A')=65, ord('B')=66. 알파벳 순서를 비교할 때 씀.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(OpenAI 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "RuntimeError": "'실행 중 문제가 생겼다'고 알리는 오류의 한 종류. 여기서는 API 키가 없거나 응답에서 텍스트를 못 찾을 때 발생시킴.",
    "FileNotFoundError": "찾는 파일이나 폴더가 없을 때 나는 오류. 여기서는 오디오 파일이 없을 때 분명히 알려주려고 일부러 발생시킴.",
    "ValueError": "값이 잘못됐을 때 나는 오류. 여기서는 MP3가 아니거나 파일이 너무 크거나 이름 형식이 틀릴 때 발생시킴.",
    "sorted()": "목록을 정렬해 새 목록으로 돌려주는 함수. key= 인수로 정렬 기준 함수를 지정할 수 있음.",
    "set(집합)": "{ }로 묶은 '중복 없는 값들의 모음'. 여기서는 화자 라벨 중복을 제거할 때 씀.",
    "suffix(확장자)": "Path 객체의 .suffix는 파일 확장자(예: '.mp3')를 줌. .lower()로 소문자로 맞춰 비교함.",
    "with open(rb)": "with 블록으로 파일을 열면, 블록을 벗어날 때 파일이 자동으로 닫힘. 'rb'는 바이너리(글자가 아닌 원본 바이트)로 읽는다는 뜻으로, 오디오 같은 파일에 씀.",
    "타입 힌트": "변수·함수에 자료의 종류(str, Path, list 등)를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"화자\": \"아내\"}처럼 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    ".get()": "딕셔너리에서 값을 '안전하게' 꺼내는 방법. 열쇠가 없어도 오류를 내지 않고, 정해둔 기본값을 돌려줌.",
    "리스트 컴프리헨션": "[표현식 for 항목 in 목록] 형태로, 반복문을 한 줄로 짧게 써서 새 목록을 만드는 파이썬 문법.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
    "argparse": "'python 파일.py --옵션 값' 형태의 명령줄 입력을 정의하고 해석해 주는 파이썬 표준 도구.",
    "input()": "콘솔(터미널)에서 사용자가 키보드로 입력한 한 줄을 글자로 받아오는 함수.",
    "mkdir": "폴더를 만드는 명령. parents=True는 중간 폴더까지, exist_ok=True는 이미 있어도 오류 없이 넘어가게 함.",
    "write_text": "문자열을 파일에 통째로 쓰는 Path의 기능. encoding='utf-8'로 한글이 깨지지 않게 저장함.",
    "JSON": "데이터를 주고받는 표준 글자 형식. {\"key\": \"value\"} 모양으로, 파이썬 딕셔너리와 거의 똑같이 생김.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "KeyboardInterrupt": "사용자가 Ctrl+C를 눌러 프로그램을 강제 중단할 때 발생하는 신호. 일반 Exception과 따로 잡아 다른 메시지를 보여줄 수 있음.",
    "sys.stderr": "오류 메시지를 내보내는 통로(표준 에러). 일반 출력(stdout)과 구분해 오류만 따로 보낼 수 있음.",
    "raise SystemExit": "프로그램을 끝내면서 종료 코드를 운영체제에 알림. main()의 반환값(0=성공, 1=실패, 130=중단)을 종료 코드로 씀.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
  },
};
