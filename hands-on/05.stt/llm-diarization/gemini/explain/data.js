/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../05.stt/llm-diarization/gemini/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "Gemini 화자 분리 음성 인식 예제 설명",
    entry: "diarization.py",
  },

  files: [
    { id: "main", label: "diarization.py", role: "단일 파일 CLI 예제 · Gemini로 오디오를 전사하고 화자를 분리함" },
  ],

  flow: [
    { step: 1, title: "실행 시작",
      label: "실행 시작",
      refs: ["main"],
      summary: "명령줄에서 python diarization.py 실행 → main()이 진입점으로 호출됨",
      detail: "이 예제는 웹이 아니라 '명령줄 프로그램'임. 터미널에서 실행하면 맨 아래 if __name__ == \"__main__\": 가 main()을 호출함. main()이 전체 작업을 순서대로 지휘함." },
    { step: 2, title: "명령줄 옵션 읽기",
      label: "명령줄 옵션 읽기",
      refs: ["parse_args"],
      summary: "parse_args()로 --input·--output-dir·--name-map·--yes·--env 옵션을 읽음",
      detail: "식당 주문서를 받는 단계와 비슷함. argparse가 'python diarization.py --input a.mp3' 같은 입력을 해석해, 어떤 파일을 처리하고 어디에 저장할지 정함. 옵션을 생략하면 기본값을 씀." },
    { step: 3, title: "파일 검증 & API 키 준비",
      label: "파일 검증·API 키",
      refs: ["validate_audio_file", "load_api_key"],
      summary: "validate_audio_file()로 파일·형식 확인, load_api_key()로 Gemini API 키를 읽음",
      detail: "실제 요리를 시작하기 전 재료가 있는지, 주방 출입 열쇠가 있는지 확인하는 단계임. 파일이 없거나 지원하지 않는 형식이면 즉시 멈추고, API 키가 없어도 명확한 오류를 냄." },
    { step: 4, title: "Gemini 화자 분리 요청",
      label: "Gemini 화자 분리 요청",
      refs: ["transcribe_with_gemini"],
      summary: "transcribe_with_gemini()가 오디오를 Gemini 모델에 직접 전달하여 화자 분리 전사를 받음",
      detail: "핵심 단계임. 오디오 파일을 직접 Gemini 모델에 넘기면서 '화자를 구분해 대화록으로 작성해달라'는 지시(DIARIZATION_PROMPT)도 함께 보냄. 20MB 이하면 파일을 바이너리로 직접 첨부하고, 초과하면 Files API로 먼저 업로드함." },
    { step: 5, title: "응답 파싱",
      label: "응답 파싱",
      refs: ["parse_transcript"],
      summary: "parse_transcript()가 AI 응답에서 [MM:SS] 화자X: 텍스트 형식의 줄만 추출함",
      detail: "AI가 돌려준 긴 텍스트에서 필요한 줄만 골라내는 단계임. 정규식(TRANSCRIPT_LINE_RE)으로 '[00:05] 화자A: 안녕하세요' 같은 형식의 줄만 추출하고, 타임스탬프와 화자 라벨을 정규화함." },
    { step: 6, title: "화자 이름 매핑",
      label: "화자 이름 매핑",
      refs: ["get_speaker_name_mapping"],
      summary: "get_speaker_name_mapping()이 '화자A'를 실제 이름(예: 아내)으로 바꿀지 대화식으로 물음",
      detail: "AI는 화자를 '화자A', '화자B'처럼 익명으로 구분함. 이 단계에서 사용자가 실제 이름으로 바꿀 수 있음. --yes 옵션이면 묻지 않고 기본 라벨을 유지하고, --name-map으로 미리 지정할 수도 있음." },
    { step: 7, title: "이름 적용 & 저장",
      label: "이름 적용·저장",
      refs: ["apply_speaker_names", "save_results"],
      summary: "apply_speaker_names()로 이름을 반영하고, save_results()가 TXT·CSV·JSON 세 파일로 저장함",
      detail: "결과를 세 가지 형식으로 저장함. TXT는 사람이 읽기 좋은 대화록, CSV는 표 형식(pandas), JSON은 프로그램이 다시 읽기 좋은 구조화 데이터임." },
    { step: 8, title: "최종 출력 & 종료",
      label: "최종 출력·종료",
      refs: ["main"],
      summary: "최종 대화록과 저장된 파일 경로를 출력하고 프로그램이 종료됨",
      detail: "작업이 끝나면 이름이 반영된 최종 대화록을 화면에 보여주고, 저장된 TXT·CSV·JSON 파일 경로를 알려줌. 오류가 나면 메시지를 출력하고 종료 코드 1(실패)로 끝냄." },
  ],

  functions: [
    {
      id: "module_constants",
      name: "모듈 상수 & 정규식",
      fileId: "main",
      summary: "파일 맨 위에서 모델명·크기 제한·지원 형식·MIME 타입·정규식·프롬프트 같은 기본값을 한곳에 모아 정의함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 준비하는 값들'임. TRANSCRIPT_LINE_RE는 AI 응답에서 대화 줄을 찾아내는 정규식 패턴이고, DIARIZATION_PROMPT는 AI에게 화자 분리 방법을 알려주는 긴 지침문임.",
      terms: ["re.compile", "정규식(regex)", "set(집합)", "MIME 타입", "TypedDict", "@dataclass(frozen=True)"],
      lines: [
        { at: 'INLINE_AUDIO_LIMIT_MB = 20', text: "20MB 이하 파일은 바이너리로 직접 첨부하고, 초과하면 Files API를 사용하는 기준값임." },
        { at: 'SUPPORTED_EXTENSIONS = {', text: "Gemini가 받는 오디오 확장자 모음(set). 중복 없는 값들의 집합임." },
        { at: 'MIME_TYPES = {', text: "확장자별로 대응하는 MIME 타입을 담은 딕셔너리. 예: '.mp3' → 'audio/mp3'. Gemini가 파일 종류를 알도록 전달함." },
        { at: 'TRANSCRIPT_LINE_RE = re.compile(', text: "★핵심★ 정규식 패턴을 미리 컴파일해 두면 반복 검색이 빨라짐. 이 패턴으로 AI 응답에서 '[MM:SS] 화자X: 텍스트' 형식의 줄만 골라냄." },
        { at: 'DIARIZATION_PROMPT = """', text: "AI에게 화자 분리 방법을 알려주는 지침문. 형식(라벨·타임스탬프)과 주의사항을 자연어로 적어 모델이 일관된 형식으로 응답하게 함." },
      ],
      code:
`MODEL_NAME = "gemini-2.5-flash"
ENV_KEY = "GEMINI_API_KEY"
BYTES_PER_MB = 1024 * 1024
INLINE_AUDIO_LIMIT_MB = 20
MAX_OUTPUT_TOKENS = 8192
MAX_SAMPLE_TEXT_LENGTH = 70

SUPPORTED_EXTENSIONS = {
    ".aac",
    ".aiff",
    ".flac",
    ".m4a",
    ".mp3",
    ".ogg",
    ".wav",
}

MIME_TYPES = {
    ".aac": "audio/aac",
    ".aiff": "audio/aiff",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mp3",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
}

TRANSCRIPT_LINE_RE = re.compile(
    r"^\\[(?P<timestamp>\\d{1,2}:\\d{2})\\]\\s*"
    r"(?P<speaker>화자\\s*[가-힣A-Za-z0-9]+)\\s*:\\s*(?P<text>.+?)\\s*$"
)

DIARIZATION_PROMPT = """다음 오디오를 한국어 대화록으로 전사하고 화자를 분리하세요.

[요구사항]
1. 서로 다른 화자는 첫 등장 순서대로 화자A, 화자B, 화자C처럼 일관되게 표시하세요.
2. 각 발화는 반드시 [MM:SS] 화자X: 텍스트 형식으로만 출력하세요.
3. 설명, 요약, 제목, 마크다운, 코드블록은 출력하지 마세요.
4. 감탄사, 추임새, 짧은 대답, 말더듬, 웃음 등 자연스러운 발화를 가능한 한 포함하세요.
5. 의미가 바뀌지 않도록 과도하게 다듬지 말고 실제 들리는 대화에 가깝게 적으세요.
6. 이름을 추정하지 말고 반드시 화자A, 화자B 같은 라벨만 사용하세요.

[출력 예시]
[00:00] 화자A: 여보세요?
[00:02] 화자B: 어, 지금 어디야?

오디오 전체를 빠짐없이 전사하세요."""`,
    },
    {
      id: "Segment_Paths",
      name: "Segment · Paths (타입 정의)",
      fileId: "main",
      summary: "대화 한 줄의 구조(Segment)와 파일 경로 묶음(Paths)을 타입으로 정의함.",
      how: "Segment는 TypedDict로 '딕셔너리인데 각 항목의 타입이 정해진 것'임. Paths는 dataclass로 '여러 경로를 한 번에 묶는 간편한 객체'임. frozen=True는 '한 번 만들면 바꿀 수 없다'는 뜻으로 실수로 경로를 덮어쓰는 것을 막음.",
      terms: ["TypedDict", "@dataclass(frozen=True)", "타입 힌트"],
      lines: [
        { at: 'class Segment(TypedDict):', text: "TypedDict는 '키 이름과 타입이 정해진 딕셔너리 구조'를 정의함. id·timestamp·speaker·text 네 항목을 갖는 딕셔너리임." },
        { at: '@dataclass(frozen=True)', text: "@dataclass는 __init__·__repr__ 같은 메서드를 자동 생성해 주는 데코레이터임. frozen=True는 생성 후 값 변경을 막음." },
        { at: 'class Paths:', text: "Paths는 예제에서 쓰는 경로들(스크립트 위치·입력 파일·출력 폴더 등)을 한 묶음으로 관리함." },
      ],
      code:
`class Segment(TypedDict):
    """파싱된 대화록 세그먼트 구조."""

    id: int
    timestamp: str
    speaker: str
    text: str


@dataclass(frozen=True)
class Paths:
    """이 예제에서 사용하는 기본 경로 묶음."""

    script_dir: Path
    stt_dir: Path
    env_path: Path
    input_path: Path
    output_dir: Path`,
    },
    {
      id: "default_paths",
      name: "default_paths()",
      fileId: "main",
      summary: "이 파일 위치를 기준으로 기본 경로(입력 오디오·.env·출력 폴더)를 자동으로 계산하여 반환함.",
      how: "어디서 실행해도 경로가 어긋나지 않도록, 하드코딩 대신 '이 파일 위치'를 기준으로 경로를 계산함. Paths 객체에 담아 한 번에 반환함.",
      terms: ["Path(__file__)"],
      lines: [
        { at: 'script_dir = Path(__file__).resolve().parent', text: "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .resolve().parent로 이 파일이 든 폴더의 절대경로를 구함." },
        { at: 'stt_dir = script_dir.parent.parent', text: "script_dir의 두 단계 위가 stt 폴더임. 폴더 구조를 따라 올라가 공통 경로를 구함." },
        { at: 'input_path=stt_dir / "audio" / "phone-with-wife.mp3"', text: "기본 입력 오디오 경로를 설정함. / 연산자는 Path끼리 경로를 이어붙이는 파이썬 문법임." },
      ],
      code:
`def default_paths() -> Paths:
    """이 파일 위치를 기준으로 기본 경로를 생성하여 반환함."""
    # 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
    script_dir = Path(__file__).resolve().parent
    stt_dir = script_dir.parent.parent
    return Paths(
        script_dir=script_dir,
        stt_dir=stt_dir,
        env_path=stt_dir.parent / ".env",
        input_path=stt_dir / "audio" / "phone-with-wife.mp3",
        output_dir=script_dir,
    )`,
    },
    {
      id: "parse_args",
      name: "parse_args()",
      fileId: "main",
      summary: "명령줄 옵션(--input, --output-dir, --name-map, --yes, --env)을 정의하고 해석함.",
      how: "argparse는 'python diarization.py --input a.mp3' 같은 명령줄 입력을 처리하는 표준 도구임. 각 옵션의 기본값·도움말을 정의하고, parse_args()로 실제 입력을 해석해 돌려줌.",
      terms: ["argparse"],
      lines: [
        { at: 'parser = argparse.ArgumentParser(', text: "argparse 파서를 만듦. 명령줄 옵션을 정의·해석하는 표준 도구임." },
        { at: '"--input"', text: "--input 옵션: 변환할 오디오 파일 경로(기본값은 default_paths의 phone-with-wife.mp3)." },
        { at: '"--name-map"', text: '--name-map 옵션: "화자A=아내,화자B=남편" 처럼 화자 이름을 미리 지정할 때 씀.' },
        { at: '"--yes"', text: "--yes 옵션: 화자 이름을 묻지 않고 기본 라벨(화자A 등)을 그대로 유지함." },
        { at: 'return parser.parse_args()', text: "실제 명령줄을 해석해, 옵션 값들을 담은 객체를 돌려줌." },
      ],
      code:
`def parse_args() -> argparse.Namespace:
    """커맨드라인 인수를 파싱함."""
    paths = default_paths()
    parser = argparse.ArgumentParser(
        description="Gemini 2.5 Flash 직접 오디오 처리 기반 화자 분리 음성 인식 예제"
    )
    parser.add_argument(
        "--input",
        default=str(paths.input_path),
        help="입력 오디오 파일 경로",
    )
    parser.add_argument(
        "--output-dir",
        default=str(paths.output_dir),
        help="결과 파일을 저장할 디렉터리",
    )
    parser.add_argument(
        "--name-map",
        default="",
        help='비대화식 화자 이름 매핑. 예: "화자A=아내,화자B=남편"',
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="이름 입력을 묻지 않고 기본 화자 라벨을 유지",
    )
    parser.add_argument(
        "--env",
        default=str(paths.env_path),
        help="GEMINI_API_KEY를 읽을 .env 파일 경로",
    )
    return parser.parse_args()`,
    },
    {
      id: "load_api_key",
      name: "load_api_key(env_path)",
      fileId: "main",
      summary: ".env 파일에서 GEMINI_API_KEY를 읽어 반환하고, 키가 없으면 명확한 오류를 냄.",
      how: "API 키는 코드에 직접 쓰지 않고 .env 파일에 보관함. load_dotenv로 그 파일을 읽어 환경변수로 올린 뒤 키를 꺼냄. 키가 없으면 즉시 분명한 오류를 내어 빨리 알아채게 함.",
      terms: ["load_dotenv", "환경변수(.env)", "API 키", "RuntimeError"],
      lines: [
        { at: 'if env_path.exists():', text: ".env 파일이 있을 때만 로드함. 없어도 환경변수에 이미 키가 있을 수 있으므로 바로 오류를 내지 않음." },
        { at: 'load_dotenv(env_path)', text: ".env 파일을 읽어 그 안의 GEMINI_API_KEY를 환경변수로 올림." },
        { at: 'api_key = os.getenv(ENV_KEY)', text: "환경변수에서 API 키를 꺼냄. 없으면 None을 받음." },
        { at: 'if not api_key:', text: "키가 없으면 즉시 RuntimeError로 멈춰 원인(어떤 키가 어디에 없는지)을 알려줌." },
      ],
      code:
`def load_api_key(env_path: Path) -> str:
    """.env 파일에서 GEMINI_API_KEY를 읽어 반환함."""
    if env_path.exists():
        # .env 파일에서 API 키 등 환경변수를 로드함
        load_dotenv(env_path)

    api_key = os.getenv(ENV_KEY)
    if not api_key:
        raise RuntimeError(
            f"{ENV_KEY}가 설정되지 않았습니다. {env_path} 파일 또는 환경 변수에 값을 설정하세요."
        )
    return api_key`,
    },
    {
      id: "get_mime_type",
      name: "get_mime_type(audio_path)",
      fileId: "main",
      summary: "파일 확장자를 보고 Gemini에 전달할 MIME 타입 문자열을 반환함.",
      how: "Gemini에 파일을 보낼 때 파일 종류를 알려야 함. 확장자(.mp3 등)를 MIME_TYPES 표에서 찾아 'audio/mp3' 같은 형식으로 변환함. 표에 없으면 기본값 'audio/mp3'를 씀.",
      terms: ["MIME 타입", ".get()"],
      lines: [
        { at: 'return MIME_TYPES.get(audio_path.suffix.lower(), "audio/mp3")', text: "audio_path.suffix.lower()는 확장자를 소문자로 가져옴(예: '.MP3' → '.mp3'). 표에 없으면 'audio/mp3'를 기본값으로 씀." },
      ],
      code:
`def get_mime_type(audio_path: Path) -> str:
    """파일 확장자에 대응하는 MIME 타입 문자열을 반환함."""
    return MIME_TYPES.get(audio_path.suffix.lower(), "audio/mp3")`,
    },
    {
      id: "validate_audio_file",
      name: "validate_audio_file(audio_path)",
      fileId: "main",
      summary: "오디오 파일이 실제로 존재하고, 파일이며, Gemini가 지원하는 형식인지 미리 확인함.",
      how: "요리 시작 전 재료를 점검하는 것과 같음. 세 가지를 순서대로 확인함: ①파일이 있는가 ②일반 파일인가(폴더가 아닌가) ③지원 형식인가. 문제가 있으면 즉시 적절한 오류를 발생시켜 나중에 더 알기 어려운 오류가 나는 것을 막음.",
      terms: ["FileNotFoundError", "ValueError", "set(집합)"],
      lines: [
        { at: 'if not audio_path.exists():', text: "파일이 없으면 FileNotFoundError로 알려줌(어느 경로를 찾았는지 포함)." },
        { at: 'if not audio_path.is_file():', text: "폴더를 잘못 지정한 경우를 걸러냄. is_file()은 파일일 때만 True임." },
        { at: 'if audio_path.suffix.lower() not in SUPPORTED_EXTENSIONS:', text: "확장자가 지원 형식 집합(set)에 없으면 ValueError로 알려줌. 지원 목록도 함께 출력해 사용자가 바로 알 수 있게 함." },
      ],
      code:
`def validate_audio_file(audio_path: Path) -> None:
    """오디오 파일 경로의 존재 여부와 지원 형식을 검증함."""
    if not audio_path.exists():
        raise FileNotFoundError(f"오디오 파일을 찾을 수 없습니다: {audio_path}")
    if not audio_path.is_file():
        raise ValueError(f"오디오 파일 경로가 아닙니다: {audio_path}")
    if audio_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise ValueError(f"지원하지 않는 오디오 형식입니다: {audio_path.suffix} (지원: {supported})")`,
    },
    {
      id: "transcribe_with_gemini",
      name: "transcribe_with_gemini(audio_path, api_key)",
      fileId: "main",
      summary: "Gemini 모델에 오디오를 직접 전달하여 화자 분리 전사 결과 텍스트를 받아 반환함.",
      how: "이 예제의 핵심 함수임. Gemini는 텍스트뿐 아니라 오디오를 직접 이해할 수 있는 멀티모달 AI임. 20MB 이하면 파일을 바이너리로 직접 읽어 Part.from_bytes로 첨부하고, 초과하면 Files API로 먼저 업로드함. DIARIZATION_PROMPT와 오디오를 함께 넘기면 Gemini가 화자를 구분해 대화록을 만들어 줌.",
      terms: ["Gemini", "멀티모달", "Part.from_bytes", "Files API", "예외 처리(try/except)", "with open(rb)"],
      lines: [
        { at: 'client = genai.Client(api_key=api_key)', text: "Gemini SDK 클라이언트를 만듦. 이 객체를 통해 모델 호출·파일 업로드 등 모든 API 요청을 보냄." },
        { at: 'if file_size_mb <= INLINE_AUDIO_LIMIT_MB:', text: "20MB 이하면 파일을 바이너리로 직접 읽어 첨부(인라인 방식). 초과하면 Files API 업로드 방식을 씀." },
        { at: 'audio_part = types.Part.from_bytes(', text: "★핵심★ 오디오 바이너리와 MIME 타입을 묶어 Gemini가 이해하는 Part 객체로 만듦. 텍스트가 아닌 오디오를 모델에 직접 첨부하는 방법임." },
        { at: 'uploaded_file = client.files.upload(file=str(audio_path))', text: "20MB 초과 시 Files API로 파일을 먼저 Gemini 서버에 업로드하고, 그 참조를 contents에 넣음." },
        { at: 'response = client.models.generate_content(', text: "DIARIZATION_PROMPT(지침)와 오디오를 함께 보내 Gemini에 화자 분리 전사를 요청함." },
        { at: 'raise RuntimeError(f"Gemini API 호출 실패: {exc}") from exc', text: "API 오류가 나면 멈추지 않고 원인을 담아 RuntimeError를 다시 발생시킴(from exc로 원본 오류도 보존)." },
      ],
      code:
`def transcribe_with_gemini(audio_path: Path, api_key: str) -> str:
    """Gemini 모델에 오디오를 직접 전달하여 화자 분리 전사 결과를 반환함."""
    client = genai.Client(api_key=api_key)
    mime_type = get_mime_type(audio_path)
    file_size_mb = audio_path.stat().st_size / BYTES_PER_MB

    print("[1/3] Gemini 직접 오디오 처리 요청 준비")
    print(f"  입력 파일: {audio_path}")
    print(f"  MIME: {mime_type}")
    print(f"  모델: {MODEL_NAME}")

    try:
        if file_size_mb <= INLINE_AUDIO_LIMIT_MB:
            with open(audio_path, "rb") as audio_file:
                audio_part = types.Part.from_bytes(
                    data=audio_file.read(),
                    mime_type=mime_type,
                )
            contents = [DIARIZATION_PROMPT, audio_part]
        else:
            print("  20MB 초과 파일이므로 Gemini Files API 업로드 방식 사용")
            uploaded_file = client.files.upload(file=str(audio_path))
            contents = [DIARIZATION_PROMPT, uploaded_file]

        print("[2/3] Gemini 응답 생성 중")
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=MAX_OUTPUT_TOKENS,
            ),
        )
    except Exception as exc:
        raise RuntimeError(f"Gemini API 호출 실패: {exc}") from exc

    response_text = (response.text or "").strip()
    if not response_text:
        raise RuntimeError("Gemini API 응답에 텍스트가 없습니다.")
    return response_text`,
    },
    {
      id: "parse_transcript",
      name: "parse_transcript(response_text)",
      fileId: "main",
      summary: "AI 응답 텍스트에서 '[MM:SS] 화자X: 텍스트' 형식의 줄만 골라 Segment 목록으로 변환함.",
      how: "AI가 항상 완벽한 형식으로 응답하지 않을 수 있음. 정규식(TRANSCRIPT_LINE_RE)으로 줄별로 검사해, 형식에 맞는 줄만 골라내고 타임스탬프·화자·텍스트를 분리함. 하나도 찾지 못하면 오류를 냄.",
      terms: ["정규식(regex)", "리스트(list)", "TypedDict"],
      lines: [
        { at: 'for raw_line in response_text.splitlines():', text: "AI 응답 전체를 줄 단위로 나눔. splitlines()는 \\n·\\r\\n 등 여러 줄바꿈 형식을 모두 처리함." },
        { at: 'match = TRANSCRIPT_LINE_RE.match(line)', text: "정규식 패턴으로 이 줄이 '[MM:SS] 화자X: 텍스트' 형식인지 확인함. 맞으면 match 객체를, 틀리면 None을 받음." },
        { at: 'if not match:', text: "형식에 안 맞는 줄(빈 줄·설명문 등)은 건너뜀." },
        { at: '"timestamp": normalize_timestamp(match.group("timestamp"))', text: "match.group(\"timestamp\")로 정규식의 named group에서 타임스탬프 부분만 꺼냄. normalize_timestamp로 형식을 MM:SS로 통일함." },
        { at: 'if not segments:', text: "형식에 맞는 줄이 하나도 없으면 RuntimeError로 알려줌. AI가 엉뚱한 형식으로 응답한 경우임." },
      ],
      code:
`def parse_transcript(response_text: str) -> list[Segment]:
    """응답 텍스트에서 \`[MM:SS] 화자X: 텍스트\` 형식의 행만 파싱하여 반환함."""
    segments: list[Segment] = []
    for raw_line in response_text.splitlines():
        line = raw_line.strip()
        match = TRANSCRIPT_LINE_RE.match(line)
        if not match:
            continue

        segments.append(
            {
                "id": len(segments) + 1,
                "timestamp": normalize_timestamp(match.group("timestamp")),
                "speaker": normalize_speaker(match.group("speaker")),
                "text": match.group("text"),
            }
        )

    if not segments:
        raise RuntimeError("AI 응답에서 '[MM:SS] 화자X: 텍스트' 형식의 발화를 찾지 못했습니다.")
    return segments`,
    },
    {
      id: "normalize_timestamp",
      name: "normalize_timestamp(timestamp)",
      fileId: "main",
      summary: "AI가 '1:05'처럼 M:SS로 줄 수도 있는 타임스탬프를 항상 '01:05'(MM:SS) 형식으로 통일함.",
      how: "분(M)과 초(SS)를 ':' 기준으로 나눠 각각 정수로 바꾼 뒤, :02d 형식으로 두 자리로 맞춤. 예: '1:5' → '01:05'.",
      terms: ["f-string"],
      lines: [
        { at: 'minutes, seconds = timestamp.split(":")', text: "':' 기준으로 나눠 분과 초를 각각 꺼냄." },
        { at: 'return f"{int(minutes):02d}:{int(seconds):02d}"', text: "int()로 숫자로 바꾸고, :02d로 항상 두 자리(1 → 01)로 표시함. f-string으로 'MM:SS' 문자열을 만들어 돌려줌." },
      ],
      code:
`def normalize_timestamp(timestamp: str) -> str:
    """M:SS 형태의 타임스탬프를 MM:SS 형식으로 정규화함."""
    minutes, seconds = timestamp.split(":")
    return f"{int(minutes):02d}:{int(seconds):02d}"`,
    },
    {
      id: "normalize_speaker",
      name: "normalize_speaker(speaker)",
      fileId: "main",
      summary: "화자 라벨에서 공백을 제거하여 '화자 A' → '화자A'처럼 일관된 형식으로 만듦.",
      how: "AI가 '화자 A'처럼 공백을 넣어 응답할 수 있음. re.sub로 연속 공백을 전부 제거해 항상 '화자A' 형식으로 통일함.",
      terms: ["정규식(regex)"],
      lines: [
        { at: 'return re.sub(r"\\s+", "", speaker)', text: "re.sub(패턴, 바꿀값, 대상)으로 화자 라벨 안의 공백(\\s+: 한 개 이상)을 빈 문자열로 교체해 모두 제거함." },
      ],
      code:
`def normalize_speaker(speaker: str) -> str:
    """화자 라벨에서 공백을 제거하여 정규화함."""
    return re.sub(r"\\s+", "", speaker)`,
    },
    {
      id: "parse_name_map",
      name: "parse_name_map(name_map_text)",
      fileId: "main",
      summary: "'화자A=아내,화자B=남편' 형태의 텍스트를 딕셔너리로 파싱함.",
      how: "--name-map 옵션으로 받은 문자열을 프로그램이 쓰기 좋은 딕셔너리로 변환함. 쉼표로 나눈 뒤 각 항목을 '='로 쪼개 화자-이름 쌍을 만듦. 잘못된 형식은 즉시 오류를 냄.",
      terms: ["딕셔너리(dict)", "ValueError"],
      lines: [
        { at: 'if not name_map_text.strip():', text: "입력이 비어 있으면 빈 딕셔너리를 돌려줌(--name-map을 생략한 경우)." },
        { at: 'for item in name_map_text.split(","):', text: "쉼표로 나눠 '화자A=아내' 같은 항목을 하나씩 처리함." },
        { at: 'if "=" not in item:', text: "'='가 없는 항목은 잘못된 형식으로 ValueError를 냄." },
        { at: 'speaker, name = item.split("=", 1)', text: "'=' 기준으로 최대 1번만 나눔(maxsplit=1). 이름에 '='가 들어와도 안전함." },
      ],
      code:
`def parse_name_map(name_map_text: str) -> dict[str, str]:
    """\`화자A=아내,화자B=남편\` 형태의 텍스트를 딕셔너리로 파싱함."""
    if not name_map_text.strip():
        return {}

    mapping: dict[str, str] = {}
    for item in name_map_text.split(","):
        item = item.strip()
        if not item:
            continue
        if "=" not in item:
            raise ValueError(f"--name-map 항목 형식이 잘못되었습니다: {item}")

        speaker, name = item.split("=", 1)
        speaker = speaker.strip()
        name = name.strip()
        if not speaker:
            raise ValueError(f"--name-map 항목에 화자 라벨이 없습니다: {item}")
        mapping[speaker] = name or speaker

    return mapping`,
    },
    {
      id: "collect_speaker_samples",
      name: "collect_speaker_samples(segments, max_count)",
      fileId: "main",
      summary: "화자별로 샘플 발화를 최대 max_count개씩 모아 화자별 발화 미리보기 딕셔너리를 만듦.",
      how: "사용자가 '이 화자가 누구인지' 판단하도록 실제 발화 예시를 보여주기 위한 함수임. setdefault로 화자가 처음 등장할 때 빈 목록을 만들고, 이미 충분히 모였으면 건너뜀. 발화가 너무 길면 잘라서 '...'을 붙임.",
      terms: ["딕셔너리(dict)", ".get()"],
      lines: [
        { at: 'samples.setdefault(speaker, [])', text: "setdefault는 '이 키가 없으면 기본값을 넣고 돌려줌'. 처음 등장하는 화자에 빈 목록을 자동으로 만들어 줌." },
        { at: 'if len(samples[speaker]) >= max_count:', text: "이미 max_count개를 모았으면 이 화자의 샘플은 더 추가하지 않고 다음 세그먼트로 넘어감." },
        { at: 'text = f"{text[:MAX_SAMPLE_TEXT_LENGTH]}..."', text: "발화가 70자보다 길면 70자만 잘라서 '...'을 붙여 화면에 보기 좋게 줄임." },
      ],
      code:
`def collect_speaker_samples(segments: list[Segment], max_count: int = 2) -> dict[str, list[str]]:
    """화자별 샘플 발화를 최대 max_count개씩 수집하여 반환함."""
    samples: dict[str, list[str]] = {}
    for segment in segments:
        speaker = segment["speaker"]
        samples.setdefault(speaker, [])
        if len(samples[speaker]) >= max_count:
            continue

        text = segment["text"]
        if len(text) > MAX_SAMPLE_TEXT_LENGTH:
            text = f"{text[:MAX_SAMPLE_TEXT_LENGTH]}..."
        samples[speaker].append(text)

    return samples`,
    },
    {
      id: "get_speaker_name_mapping",
      name: "get_speaker_name_mapping(segments, preset_mapping, yes)",
      fileId: "main",
      summary: "화자별 샘플 발화를 보여주고, yes 모드가 아니면 사용자에게 실제 이름을 입력받아 매핑을 반환함.",
      how: "AI는 화자를 '화자A'처럼 익명으로 구분함. 이 함수가 사용자에게 샘플을 보여주고 이름을 물어봄. --yes 옵션이면 묻지 않고, --name-map으로 미리 지정한 화자는 건너뜀. input()으로 키보드 입력을 받고, Enter를 누르면 기본 라벨을 유지함.",
      terms: ["input()", "딕셔너리(dict)", "리스트 컴프리헨션"],
      lines: [
        { at: 'speakers = sorted({segment["speaker"] for segment in segments})', text: "세그먼트에서 화자 라벨을 중복 없이 모은 뒤(집합 컴프리헨션) 이름순 정렬함." },
        { at: 'name_mapping = {speaker: preset_mapping.get(speaker, speaker) for speaker in speakers}', text: "딕셔너리 컴프리헨션으로 화자별 이름 매핑을 만듦. --name-map에 있으면 그 이름을, 없으면 기본 라벨(화자A 등)을 씀." },
        { at: 'if yes:', text: "--yes 옵션이면 이름 입력 없이 현재 매핑을 바로 돌려줌." },
        { at: 'name = input(f"{speaker} 실제 이름 [{current}]: ").strip()', text: "input()으로 키보드 입력을 받음. 빈 줄(Enter)이면 기본 라벨을 유지함." },
      ],
      code:
`def get_speaker_name_mapping(
    segments: list[Segment],
    preset_mapping: dict[str, str],
    yes: bool,
) -> dict[str, str]:
    """화자 샘플을 출력하고, yes 모드가 아니면 실제 이름을 대화식으로 입력받음."""
    speakers = sorted({segment["speaker"] for segment in segments})
    samples = collect_speaker_samples(segments)
    name_mapping = {speaker: preset_mapping.get(speaker, speaker) for speaker in speakers}

    print("\\n[화자별 샘플 발화]")
    for speaker in speakers:
        print(f"- {speaker}")
        for sample in samples.get(speaker, []):
            print(f"  - {sample}")

    if yes:
        print("\\n--yes 옵션으로 이름 입력을 생략합니다.")
        return name_mapping

    unmapped_speakers = [speaker for speaker in speakers if speaker not in preset_mapping]
    if not unmapped_speakers:
        print("\\n--name-map에 모든 화자가 지정되어 이름 입력을 생략합니다.")
        return name_mapping

    print("\\n[실제 이름 입력]")
    print("Enter를 누르면 기본 화자 라벨을 유지합니다.")
    for speaker in unmapped_speakers:
        current = name_mapping[speaker]
        name = input(f"{speaker} 실제 이름 [{current}]: ").strip()
        if name:
            name_mapping[speaker] = name

    return name_mapping`,
    },
    {
      id: "apply_speaker_names",
      name: "apply_speaker_names(segments, name_mapping)",
      fileId: "main",
      summary: "세그먼트 목록에서 '화자A' 같은 라벨을 실제 이름으로 바꾼 새 목록을 반환함.",
      how: "원본 세그먼트를 바꾸지 않고, 이름이 바뀐 새 세그먼트 목록을 만들어 돌려줌. 이름 매핑에 없는 화자는 원래 라벨 그대로 유지함(.get의 기본값 활용).",
      terms: ["딕셔너리(dict)", ".get()", "리스트(list)"],
      lines: [
        { at: 'renamed_segments: list[Segment] = []', text: "이름이 바뀐 세그먼트를 담을 새 빈 목록을 만듦. 원본 segments는 건드리지 않음." },
        { at: '"speaker": name_mapping.get(segment["speaker"], segment["speaker"])', text: "name_mapping에서 이 화자의 이름을 찾음. 없으면(.get의 두 번째 인수) 원래 라벨 그대로 씀." },
      ],
      code:
`def apply_speaker_names(segments: list[Segment], name_mapping: dict[str, str]) -> list[Segment]:
    """세그먼트에 실제 화자 이름을 적용하여 새 목록을 반환함."""
    renamed_segments: list[Segment] = []
    for segment in segments:
        renamed_segments.append(
            {
                "id": segment["id"],
                "timestamp": segment["timestamp"],
                "speaker": name_mapping.get(segment["speaker"], segment["speaker"]),
                "text": segment["text"],
            }
        )
    return renamed_segments`,
    },
    {
      id: "format_segments",
      name: "format_segments(segments)",
      fileId: "main",
      summary: "세그먼트 목록을 '[MM:SS] 화자: 텍스트' 형식의 대화록 문자열로 만듦.",
      how: "각 세그먼트를 '[MM:SS] 화자: 텍스트' 형식으로 바꿔 줄바꿈으로 이어붙임. 화면 출력과 TXT 저장에 공통으로 씀.",
      terms: ["f-string", "리스트 컴프리헨션"],
      lines: [
        { at: 'return "\\n".join(', text: '"\\n".join(...)은 목록 안의 문자열들을 줄바꿈(\\n)으로 이어 붙여 하나의 문자열로 만듦.' },
        { at: 'f"[{segment[\'timestamp\']}] {segment[\'speaker\']}: {segment[\'text\']}"', text: "각 세그먼트를 '[MM:SS] 화자: 텍스트' 형식의 f-string으로 만듦." },
      ],
      code:
`def format_segments(segments: list[Segment]) -> str:
    """세그먼트 목록을 대화록 텍스트 형식으로 변환함."""
    return "\\n".join(
        f"[{segment['timestamp']}] {segment['speaker']}: {segment['text']}"
        for segment in segments
    )`,
    },
    {
      id: "save_results",
      name: "save_results(raw_response, original_segments, final_segments, name_mapping, audio_path, output_dir)",
      fileId: "main",
      summary: "TXT·CSV·JSON 세 가지 형식으로 결과를 저장하고 저장된 경로를 반환함.",
      how: "결과를 사람이 읽기 쉬운 TXT, 스프레드시트용 CSV(pandas), 프로그램이 읽기 쉬운 JSON으로 함께 저장함. TXT에는 원본 AI 응답·파싱된 원본 대화록·이름 반영 최종 대화록 세 가지를 모두 담아 과정을 추적할 수 있게 함.",
      terms: ["pandas", "json.dumps", "write_text", "mkdir", "f-string"],
      lines: [
        { at: 'output_dir.mkdir(parents=True, exist_ok=True)', text: "결과 폴더가 없으면 만들어 둠(parents=True: 중간 폴더까지, exist_ok=True: 이미 있어도 오류 없음)." },
        { at: 'created_at = datetime.now().isoformat(timespec="seconds")', text: "현재 시각을 '2024-01-01T12:00:00' 형식(ISO 8601)으로 만듦. 결과 파일에 생성 시각을 기록함." },
        { at: 'txt_path.write_text(txt_content, encoding="utf-8")', text: "내용을 UTF-8로 파일에 씀. encoding='utf-8' 지정으로 한글이 깨지지 않게 저장함." },
        { at: 'df = pd.DataFrame(final_segments, columns=["id", "timestamp", "speaker", "text"])', text: "세그먼트 목록을 pandas 데이터프레임(표 형식)으로 만듦. 열 이름을 명시적으로 지정함." },
        { at: 'df.to_csv(csv_path, index=False, encoding="utf-8-sig", sep="|")', text: "데이터프레임을 CSV로 저장함. utf-8-sig는 엑셀에서 열 때 한글이 안 깨지는 인코딩. sep='|'는 구분자로 | 기호를 사용(텍스트에 쉼표가 있을 수 있어)." },
        { at: 'json.dumps(payload, ensure_ascii=False, indent=2)', text: "딕셔너리를 JSON 문자열로 바꿈. ensure_ascii=False: 한글을 유니코드 이스케이프 없이 그대로 저장. indent=2: 들여쓰기로 보기 좋게 정렬함." },
      ],
      code:
`def save_results(
    raw_response: str,
    original_segments: list[Segment],
    final_segments: list[Segment],
    name_mapping: dict[str, str],
    audio_path: Path,
    output_dir: Path,
) -> tuple[Path, Path, Path]:
    """TXT, CSV, JSON 결과 파일을 저장하고 저장 경로를 반환함."""
    output_dir.mkdir(parents=True, exist_ok=True)

    txt_path = output_dir / "result.txt"
    csv_path = output_dir / "result_chunks.csv"
    json_path = output_dir / "result.json"

    created_at = datetime.now().isoformat(timespec="seconds")

    txt_content = "\\n".join(
        [
            "# Gemini LLM 화자 분리 음성 인식 결과",
            "",
            f"- 생성 시각: {created_at}",
            f"- 입력 파일: {audio_path}",
            f"- 모델: {MODEL_NAME}",
            "",
            "## 원본 변환 결과",
            "",
            raw_response.strip(),
            "",
            "## 파싱된 원본 대화록",
            "",
            format_segments(original_segments),
            "",
            "## 이름 반영 최종 대화록",
            "",
            format_segments(final_segments),
            "",
        ]
    )
    txt_path.write_text(txt_content, encoding="utf-8")

    df = pd.DataFrame(final_segments, columns=["id", "timestamp", "speaker", "text"])
    df.to_csv(csv_path, index=False, encoding="utf-8-sig", sep="|")

    payload = {
        "created_at": created_at,
        "audio_file": str(audio_path),
        "model": MODEL_NAME,
        "speaker_name_map": name_mapping,
        "segments": final_segments,
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    return txt_path, csv_path, json_path`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "전체 작업을 순서대로 실행하는 시작점. 검증→API→전사→파싱→이름매핑→저장.",
      how: "프로그램의 '지휘자'임. 옵션을 읽고, 파일 검증, API 키 준비, Gemini 전사, 응답 파싱, 화자 이름 매핑, 저장을 차례로 실행함. 전체를 try/except로 감싸 KeyboardInterrupt(Ctrl+C)와 일반 오류를 모두 안전하게 처리함.",
      terms: ["예외 처리(try/except)", "sys.exit", "if __name__", "타입 힌트"],
      lines: [
        { at: 'audio_path = Path(args.input).expanduser().resolve()', text: "명령줄에서 받은 경로를 ~ 펴기(expanduser)와 절대경로 변환(resolve)으로 안전하게 정규화함." },
        { at: 'validate_audio_file(audio_path)', text: "API 호출 전에 먼저 파일 존재·형식을 점검해 명확한 오류를 낼 수 있게 함." },
        { at: 'raw_response = transcribe_with_gemini(audio_path, api_key)', text: "★핵심★ Gemini에 오디오를 보내 화자 분리 대화록을 받아옴." },
        { at: 'except KeyboardInterrupt:', text: "사용자가 Ctrl+C로 중단하면 '중단됐다'는 메시지를 찍고 종료 코드 130(관례)으로 끝냄." },
        { at: 'except Exception as exc:', text: "그 외 모든 오류는 메시지를 찍고 종료 코드 1(실패)로 끝냄. 프로그램이 갑자기 죽지 않게 함." },
      ],
      code:
`def main() -> None:
    """Gemini 화자 분리 워크플로우를 실행함."""
    args = parse_args()
    audio_path = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    env_path = Path(args.env).expanduser().resolve()

    try:
        validate_audio_file(audio_path)
        api_key = load_api_key(env_path)
        preset_mapping = parse_name_map(args.name_map)

        raw_response = transcribe_with_gemini(audio_path, api_key)
        original_segments = parse_transcript(raw_response)

        print("[3/3] 응답 파싱 완료")
        print(f"  파싱된 발화 수: {len(original_segments)}")

        name_mapping = get_speaker_name_mapping(original_segments, preset_mapping, args.yes)
        final_segments = apply_speaker_names(original_segments, name_mapping)
        txt_path, csv_path, json_path = save_results(
            raw_response=raw_response,
            original_segments=original_segments,
            final_segments=final_segments,
            name_mapping=name_mapping,
            audio_path=audio_path,
            output_dir=output_dir,
        )
    except KeyboardInterrupt:
        print("\\n사용자가 작업을 중단했습니다.")
        sys.exit(130)
    except Exception as exc:
        print(f"\\n오류: {exc}", file=sys.stderr)
        sys.exit(1)

    print("\\n[이름 반영 최종 대화록]")
    print(format_segments(final_segments))
    print("\\n[결과 파일]")
    print(f"- TXT: {txt_path}")
    print(f"- CSV: {csv_path}")
    print(f"- JSON: {json_path}")`,
    },
  ],

  glossary: {
    "Gemini": "Google이 만든 멀티모달 AI 모델. 텍스트뿐 아니라 오디오·이미지·영상도 직접 이해할 수 있어, 오디오를 따로 텍스트로 바꾸지 않고도 바로 이해하고 응답할 수 있음.",
    "멀티모달": "여러 종류의 데이터(텍스트·이미지·오디오·영상)를 동시에 처리할 수 있는 AI 능력. Gemini는 오디오를 직접 이해함.",
    "화자 분리(diarization)": "여러 사람이 대화하는 오디오에서 '이 부분은 화자A', '저 부분은 화자B'처럼 누가 말했는지를 구분하는 기술.",
    "Part.from_bytes": "오디오·이미지 같은 바이너리 데이터와 MIME 타입을 묶어 Gemini가 이해하는 Part 객체로 만드는 함수. 텍스트가 아닌 미디어를 모델에 직접 첨부할 때 씀.",
    "Files API": "Gemini SDK의 파일 업로드 서비스. 20MB가 넘는 큰 파일을 직접 첨부하는 대신, 먼저 서버에 업로드하고 그 참조를 모델에 전달함.",
    "MIME 타입": "파일의 종류를 인터넷 표준 형식으로 나타낸 것. 예: 'audio/mp3'는 MP3 오디오, 'image/jpeg'는 JPEG 이미지. 서버가 파일을 올바르게 해석하도록 알려줌.",
    "re.compile": "정규식 패턴을 미리 컴파일(분석·준비)해 두는 함수. 같은 패턴을 여러 번 쓸 때 매번 분석하지 않아 빠름.",
    "정규식(regex)": "특정 문자 패턴을 찾거나 바꾸는 '패턴 언어'. 예: \\d는 숫자 하나, \\s는 공백 하나. '[00:05] 화자A: 텍스트' 같은 형식을 자동으로 찾아낼 때 씀.",
    "TypedDict": "파이썬의 '타입이 정해진 딕셔너리' 정의 방법. 딕셔너리이지만 각 키의 타입을 명시해 두어 코드를 읽기 쉽게 하고 실수를 줄임.",
    "@dataclass(frozen=True)": "@dataclass는 클래스에 __init__·__repr__ 같은 메서드를 자동 생성해 주는 데코레이터임. frozen=True를 추가하면 생성 후 값을 바꿀 수 없어 안전함.",
    "pandas": "파이썬의 대표적인 데이터 분석 라이브러리. 표(DataFrame) 형태로 데이터를 다루고 CSV·엑셀 등으로 쉽게 저장할 수 있음.",
    "json.dumps": "파이썬 딕셔너리·목록을 JSON 형식 문자열로 바꾸는 함수. ensure_ascii=False로 한글을 그대로 유지하고, indent로 보기 좋게 들여쓸 수 있음.",
    "argparse": "'python 파일.py --옵션 값' 형태의 명령줄 입력을 정의하고 해석해 주는 파이썬 표준 도구.",
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .resolve().parent를 붙이면 이 파일이 든 폴더의 절대경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(Gemini 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "RuntimeError": "'실행 중 문제가 생겼다'고 알리는 오류의 한 종류. 여기서는 API 키가 없거나 AI 응답이 없을 때 일부러 발생시켜 원인을 알려줌.",
    "FileNotFoundError": "찾는 파일이 없을 때 나는 오류. 여기서는 오디오 파일이 없을 때 분명히 알려주려고 일부러 발생시킴.",
    "ValueError": "값이 잘못됐을 때 나는 오류. 여기서는 지원하지 않는 확장자나 잘못된 --name-map 형식일 때 발생시킴.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "set(집합)": "{ }로 묶은 '중복 없는 값들의 모음'. 'x in 집합'으로 포함 여부를 매우 빠르게 확인할 수 있어, 지원 형식 검사에 적합함.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {'도시': '서울'}처럼 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    ".get()": "딕셔너리에서 값을 '안전하게' 꺼내는 방법. 열쇠가 없어도 오류를 내지 않고, 정해둔 기본값을 돌려줌.",
    "리스트(list)": "여러 값을 순서대로 담는 목록. [\"a\", \"b\"]처럼 대괄호로 표현함.",
    "리스트 컴프리헨션": "[표현식 for 항목 in 목록 if 조건] 형태로, 반복문을 한 줄로 짧게 써서 새 목록을 만드는 파이썬 문법.",
    "input()": "콘솔(터미널)에서 사용자가 키보드로 입력한 한 줄을 글자로 받아오는 함수.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
    "write_text": "문자열을 파일에 통째로 쓰는 Path의 기능. encoding='utf-8'로 한글이 깨지지 않게 저장함.",
    "mkdir": "폴더를 만드는 명령. parents=True는 중간 폴더까지, exist_ok=True는 이미 있어도 오류 없이 넘어가게 함.",
    "타입 힌트": "변수·함수에 자료의 종류(str, Path, list 등)를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "sys.exit": "프로그램을 끝내면서 종료 코드를 운영체제에 알림. 0=성공, 1=실패, 130=Ctrl+C 중단(관례).",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
    "with open(rb)": "with 블록으로 파일을 열면, 블록을 벗어날 때 파일이 자동으로 닫힘. 'rb'는 바이너리(글자가 아닌 원본 바이트)로 읽는다는 뜻으로, 오디오 같은 파일에 씀.",
  },
};
