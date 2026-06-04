/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../05.stt/llm-diarization/claude/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "Whisper + Claude 화자 분리 예제 설명",
    entry: "diarization.py",
  },

  files: [
    { id: "main", label: "diarization.py", role: "단일 파일 CLI 예제 · Whisper STT 후 Claude로 화자 분리" },
  ],

  flow: [
    { step: 1, title: "실행 시작",
      label: "실행 시작",
      refs: ["main"],
      summary: "python diarization.py 실행 → main()이 진입점으로 호출됨",
      detail: "터미널에서 실행하면 맨 아래 if __name__ == '__main__': 가 main()을 호출함. 프로그램의 '지휘자' 역할을 함." },
    { step: 2, title: "CLI 옵션 읽기",
      label: "CLI 옵션 읽기",
      refs: ["parse_args"],
      summary: "parse_args()로 --input·--output-dir·--name-map·--yes 옵션을 읽음",
      detail: "식당 주문서를 받는 단계임. argparse가 명령줄 옵션을 해석해 어떤 오디오 파일을 쓸지, 결과를 어디 저장할지, 화자 이름을 미리 정했는지 파악함." },
    { step: 3, title: "오디오 파일 확정",
      label: "오디오 파일 확정",
      refs: ["resolve_audio_input"],
      summary: "resolve_audio_input()이 변환할 오디오 파일 경로를 확정함",
      detail: "--input 으로 직접 지정하지 않으면 audio 폴더의 첫 번째 파일을 자동 선택함. 파일이 없거나 지원하지 않는 형식이면 여기서 오류를 냄." },
    { step: 4, title: "API 키 로드",
      label: "API 키 로드",
      refs: ["load_api_keys"],
      summary: "load_api_keys()가 .env에서 CLAUDE_API_KEY와 OPENAI_API_KEY를 읽어옴",
      detail: "두 서비스(Whisper=OpenAI, 화자분리=Claude)를 모두 쓰므로 두 가지 비밀 열쇠가 필요함. 하나라도 없으면 명확한 오류와 함께 멈춤." },
    { step: 5, title: "Whisper STT",
      label: "Whisper STT",
      refs: ["transcribe_with_whisper"],
      summary: "transcribe_with_whisper()가 오디오를 OpenAI Whisper에 보내 타임스탬프 포함 전사를 받아옴",
      detail: "오디오를 글자로 받아쓰는 단계임. 일반 전사(json)가 아니라 verbose_json 형식을 써서 '[00:05] 안녕하세요' 같은 시작 시각 정보를 함께 받아옴. 이 타임스탬프가 화자 분리의 핵심 단서가 됨." },
    { step: 6, title: "Claude 화자 분리",
      label: "Claude 화자 분리",
      refs: ["diarize_with_claude"],
      summary: "diarize_with_claude()가 Whisper 전사 결과를 Claude에게 보내 화자를 구분하게 함",
      detail: "Claude는 오디오를 직접 들을 수 없음. 대신 '[00:05] 안녕하세요' 같은 Whisper 결과를 받아, 말투·호칭·대화 흐름을 분석해 '화자A: 안녕하세요' 형식으로 구분해줌. 탐정처럼 문맥 단서만으로 누가 말했는지 추리하는 단계임." },
    { step: 7, title: "결과 파싱",
      label: "결과 파싱",
      refs: ["parse_diarized_transcript"],
      summary: "parse_diarized_transcript()가 Claude 응답을 [MM:SS] 화자X: 텍스트 형식으로 파싱함",
      detail: "Claude가 내보낸 텍스트에서 정규식으로 형식에 맞는 행만 뽑아냄. 타임스탬프와 화자 라벨을 표준 형식으로 정규화함." },
    { step: 8, title: "화자 이름 지정",
      label: "화자 이름 지정",
      refs: ["choose_speaker_names", "apply_speaker_names"],
      summary: "choose_speaker_names()가 화자A·화자B 같은 라벨에 실제 이름을 매핑함",
      detail: "화자A·화자B는 임시 라벨임. 이 단계에서 샘플 발화를 보여주고 '화자A는 누구인가요?' 를 대화식으로 물어봄. --name-map으로 미리 정하거나 --yes로 건너뛸 수도 있음." },
    { step: 9, title: "결과 저장",
      label: "결과 저장",
      refs: ["save_results"],
      summary: "save_results()가 TXT·CSV·JSON 세 파일로 결과를 저장함",
      detail: "대화록(TXT), 스프레드시트용(CSV), 데이터 처리용(JSON) 세 가지 형식으로 저장함. 이후 분석·번역·자막 생성 등 다양한 목적으로 활용할 수 있음." },
    { step: 10, title: "종료",
      label: "종료",
      refs: ["main"],
      summary: "저장 경로를 출력하고 종료 코드(0=성공, 1=실패)를 반환함",
      detail: "작업이 끝나면 세 결과 파일 경로를 출력하고 끝남. 도중에 오류가 나면 오류 메시지를 출력하고 종료 코드 1을 반환함." },
  ],

  functions: [
    {
      id: "module_setup",
      name: "모듈 설정 (경로·상수·클래스)",
      fileId: "main",
      summary: "파일 맨 위에서 한글 출력 설정, 경로 상수, 지원 형식, 정규식 패턴, 데이터 구조 클래스를 준비함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 준비하는 값들'임. 경로는 이 파일 위치를 기준으로 자동 계산함. DIARIZED_LINE_PATTERN은 Claude가 내보내는 '[MM:SS] 화자X: 텍스트' 형식을 파싱하는 정규식임. SegmentDict(TypedDict)는 파싱된 한 줄의 구조를 정의하고, WhisperSegment(@dataclass)는 Whisper 세그먼트를 타임스탬프 자동 계산 기능과 함께 저장함.",
      terms: ["Path(__file__)", "set(집합)", "sys.stdout.reconfigure", "re.compile(정규식)", "named group", "TypedDict", "@dataclass(frozen)", "@property"],
      lines: [
        { at: 'if hasattr(sys.stdout, "reconfigure"):', text: "윈도우 콘솔에서 한글 출력이 깨지지 않도록 출력 인코딩을 UTF-8로 바꿈." },
        { at: 'SCRIPT_DIR = Path(__file__).resolve().parent', text: "Path(__file__)은 '이 파일의 위치'. .resolve().parent로 이 파일이 든 폴더의 절대경로를 구함." },
        { at: 'SUPPORTED_FORMATS = {', text: "Whisper가 받는 오디오 확장자 모음(set). 중복 없는 값들의 집합임." },
        { at: 'DIARIZED_LINE_PATTERN = re.compile(', text: "re.compile로 정규식 패턴을 미리 컴파일해 저장함. 반복 사용 시 성능이 좋아짐." },
        { at: 'class SegmentDict(TypedDict):', text: "TypedDict는 딕셔너리의 각 키 이름과 값 타입을 정의하는 클래스임. 실제 딕셔너리처럼 쓰지만 코드 점검 도구가 타입을 확인해줌." },
        { at: '@dataclass(frozen=True)', text: "@dataclass는 __init__·__repr__ 등을 자동 생성해주는 데코레이터임. frozen=True는 '생성 후 값을 바꿀 수 없는 불변 객체'로 만듦." },
        { at: 'def timestamp(self) -> str:', text: "@property는 메서드를 '속성처럼' 쓸 수 있게 해줌. segment.timestamp처럼 ()없이 호출 가능." },
      ],
      code:
`# Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
SCRIPT_DIR = Path(__file__).resolve().parent
STT_DIR = SCRIPT_DIR.parents[1]
HANDS_ON_DIR = STT_DIR.parent
AUDIO_DIR = STT_DIR / "audio"
ENV_PATH = HANDS_ON_DIR / ".env"

WHISPER_MODEL = "whisper-1"
CLAUDE_MODEL = "claude-opus-4-7"
MAX_OUTPUT_TOKENS = 8192
MAX_SAMPLE_TEXT_LENGTH = 80

SUPPORTED_FORMATS = {
    ".aac",
    ".flac",
    ".m4a",
    ".mp3",
    ".mp4",
    ".mpeg",
    ".mpga",
    ".ogg",
    ".wav",
    ".webm",
}

DIARIZED_LINE_PATTERN = re.compile(
    r"^\\[(?P<timestamp>\\d{1,3}:\\d{2})\\]\\s*"
    r"(?P<speaker>화자\\s*[A-Za-z0-9가-힣]+)\\s*:\\s*"
    r"(?P<text>.+?)\\s*$"
)


class SegmentDict(TypedDict):
    """파싱된 대화록 행 구조."""

    id: int
    timestamp: str
    speaker: str
    text: str


@dataclass(frozen=True)
class WhisperSegment:
    """Whisper 세그먼트: 시작 시각과 텍스트를 포함함."""

    start: float
    end: float
    text: str

    @property
    def timestamp(self) -> str:
        return format_timestamp(self.start)`,
    },
    {
      id: "format_timestamp",
      name: "format_timestamp(seconds)",
      fileId: "main",
      summary: "초 단위 숫자를 'MM:SS' 형식 문자열로 변환함. 예: 65.3 → '01:05'",
      how: "divmod(65, 60)은 (1, 5)를 돌려줌. 즉 몫(분)과 나머지(초)를 한 번에 구함. :02d 형식으로 한 자리 숫자를 '01'처럼 두 자리로 맞춤.",
      terms: ["divmod", "f-string", "타입 힌트"],
      lines: [
        { at: 'total_seconds = max(0, int(seconds))', text: "max(0, ...)으로 음수가 되지 않게 하고, int()로 소수점을 버림." },
        { at: 'minutes, seconds_part = divmod(total_seconds, 60)', text: "divmod(65, 60)은 (1, 5) — 몫(분)과 나머지(초)를 동시에 구함. 두 변수에 한꺼번에 담음." },
        { at: 'return f"{minutes:02d}:{seconds_part:02d}"', text: ":02d는 '최소 2자리, 부족하면 0으로 채워라'는 형식 지정임. 5 → '05'." },
      ],
      code:
`def format_timestamp(seconds: float) -> str:
    """초 단위 시각을 MM:SS 형식 문자열로 변환함."""
    total_seconds = max(0, int(seconds))
    minutes, seconds_part = divmod(total_seconds, 60)
    return f"{minutes:02d}:{seconds_part:02d}"`,
    },
    {
      id: "normalize_timestamp",
      name: "normalize_timestamp(timestamp)",
      fileId: "main",
      summary: "'M:SS' 같이 분이 한 자리인 타임스탬프를 '0M:SS' 두 자리 형식으로 정규화함.",
      how: "Claude가 응답에서 '1:05'처럼 한 자리 분을 쓸 수 있음. 이를 '01:05'로 통일해 어디서든 같은 형식이 되게 함.",
      terms: ["f-string", "타입 힌트"],
      lines: [
        { at: 'minute_text, second_text = timestamp.split(":", 1)', text: "'1:05'.split(':', 1)은 ['1', '05']로 나눔. 1은 '최대 1번만 나눠라'는 뜻." },
        { at: 'return f"{minutes:02d}:{seconds:02d}"', text: "두 자리로 맞춰 돌려줌. 1→01, 5→05." },
      ],
      code:
`def normalize_timestamp(timestamp: str) -> str:
    """M:SS 형태의 타임스탬프를 MM:SS 형식으로 정규화함."""
    minute_text, second_text = timestamp.split(":", 1)
    minutes = int(minute_text)
    seconds = int(second_text)
    return f"{minutes:02d}:{seconds:02d}"`,
    },
    {
      id: "normalize_speaker_label",
      name: "normalize_speaker_label(label)",
      fileId: "main",
      summary: "'화자 A'처럼 공백이 포함된 화자 라벨을 '화자A'로 정규화함.",
      how: "Claude가 '화자A'로 쓰기도 하고 '화자 A'로 쓰기도 함. re.sub로 공백을 전부 없애고, 화자 뒤 문자를 대문자로 맞춰 항상 '화자A' 형식이 되게 함.",
      terms: ["re.sub(정규식 치환)", "타입 힌트"],
      lines: [
        { at: 'label = re.sub(r"\\s+", "", label.strip())', text: "re.sub(패턴, 바꿀값, 대상)은 패턴에 맞는 부분을 바꿔줌. \\s+는 '1개 이상의 공백'이고 \"\"로 바꾸면 공백을 모두 삭제함." },
        { at: 'if label.startswith("화자"):', text: "'화자'로 시작하는지 확인하고, 뒤 부분을 .upper()로 대문자로 바꿈." },
      ],
      code:
`def normalize_speaker_label(label: str) -> str:
    """'화자 A'처럼 공백이 포함된 화자 라벨을 '화자A' 형식으로 정규화함."""
    label = re.sub(r"\\s+", "", label.strip())
    if label.startswith("화자"):
        return "화자" + label[2:].upper()
    return label`,
    },
    {
      id: "read_field",
      name: "read_field(value, field_name, default)",
      fileId: "main",
      summary: "딕셔너리·pydantic 모델·일반 객체 어느 것에서든 같은 방식으로 필드 값을 읽어오는 도우미.",
      how: "OpenAI SDK 버전에 따라 응답이 딕셔너리일 수도, 객체(pydantic 모델)일 수도 있음. isinstance로 종류를 확인해 딕셔너리면 .get(), 객체면 getattr()을 씀. 코드 나머지 부분이 응답 형식 변화에 영향받지 않게 함.",
      terms: ["isinstance()", ".get()", "getattr", "타입 힌트"],
      lines: [
        { at: 'if isinstance(value, dict):', text: "isinstance(value, dict)는 'value가 딕셔너리인가?'를 확인함." },
        { at: 'return value.get(field_name, default)', text: "딕셔너리면 .get()으로 안전하게 꺼냄. 없으면 default를 반환." },
        { at: 'return getattr(value, field_name, default)', text: "객체면 getattr로 속성을 꺼냄. 없으면 default를 반환." },
      ],
      code:
`def read_field(value: Any, field_name: str, default: Any = None) -> Any:
    """dict, pydantic 모델, 일반 객체에서 공통으로 필드 값을 읽어 반환함."""
    if isinstance(value, dict):
        return value.get(field_name, default)
    return getattr(value, field_name, default)`,
    },
    {
      id: "require_package",
      name: "require_package(import_name, install_name)",
      fileId: "main",
      summary: "패키지를 임포트하고, 없으면 '설치하세요' 안내와 함께 오류를 냄. 지연 임포트 도우미.",
      how: "openai·anthropic·pandas는 파일 맨 위에서 import하지 않고, 실제로 쓸 때 이 함수로 불러옴(지연 임포트). 없으면 ImportError가 나는데, 더 친절한 설치 안내 메시지로 바꿔서 냄. raise … from exc는 원래 오류도 함께 보존함.",
      terms: ["지연 임포트(lazy import)", "__import__", "예외 처리(try/except)", "raise…from", "RuntimeError"],
      lines: [
        { at: 'return __import__(import_name)', text: "__import__('openai')는 import openai와 같음. 문자열로 동적으로 모듈을 불러올 수 있음." },
        { at: 'except ImportError as exc:', text: "패키지가 없으면 ImportError가 남. 이를 잡아서 더 친절한 RuntimeError로 변환함." },
        { at: 'raise RuntimeError(', text: "설치 방법을 안내하는 오류를 냄. from exc는 원래 ImportError도 함께 보존해 디버깅을 도움." },
      ],
      code:
`def require_package(import_name: str, install_name: str) -> Any:
    """패키지를 임포트하고 없으면 설치 안내 메시지와 함께 예외를 발생시킴."""
    try:
        return __import__(import_name)
    except ImportError as exc:
        raise RuntimeError(
            f"{install_name} 패키지가 설치되지 않았습니다. "
            f"\`python -m pip install -r requirements.txt\` 실행 필요"
        ) from exc`,
    },
    {
      id: "find_audio_files",
      name: "find_audio_files(audio_dir)",
      fileId: "main",
      summary: "audio 폴더에서 Whisper가 지원하는 오디오 파일만 골라 이름순으로 돌려줌.",
      how: "폴더가 없으면 빈 목록을 돌려줌(안전 처리). 폴더 안 항목을 하나씩 보며, 파일이면서 확장자가 지원 형식인 것만 모아 이름순 정렬함.",
      terms: ["제너레이터 표현식", "sorted()", "suffix(확장자)", "set(집합)", "타입 힌트"],
      lines: [
        { at: 'if not audio_dir.exists():', text: "폴더가 없으면 빈 목록 []을 돌려줌(오류 대신 안전 처리)." },
        { at: 'for path in audio_dir.iterdir()', text: "iterdir()로 폴더 안의 항목을 하나씩 훑음." },
        { at: 'if path.is_file() and path.suffix.lower() in SUPPORTED_FORMATS', text: "파일이면서 확장자가 지원 형식 집합에 든 것만 고름. sorted로 이름순 정렬." },
      ],
      code:
`def find_audio_files(audio_dir: Path) -> list[Path]:
    """공용 audio 디렉터리에서 지원 형식의 오디오 파일 목록을 반환함."""
    if not audio_dir.exists():
        return []

    return sorted(
        path
        for path in audio_dir.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_FORMATS
    )`,
    },
    {
      id: "resolve_audio_input",
      name: "resolve_audio_input(input_path)",
      fileId: "main",
      summary: "--input 으로 파일을 직접 줬으면 그걸 쓰고, 없으면 audio 폴더의 첫 번째 파일을 자동 선택함.",
      how: "simple 예제는 번호를 입력받아 사용자가 선택했지만, 이 예제는 자동으로 첫 번째 파일을 고름. 경로를 검증해 파일이 없거나 형식이 안 맞으면 명확한 오류를 냄.",
      terms: ["Path(__file__)", "suffix(확장자)", "FileNotFoundError", "ValueError"],
      lines: [
        { at: 'if input_path is not None:', text: "--input 으로 파일을 직접 줬으면(None이 아니면) 그 경로를 사용함." },
        { at: 'audio_path = input_path.expanduser().resolve()', text: "~ 같은 단축 경로를 펴고(expanduser) 절대경로로 바꿈(resolve)." },
        { at: 'audio_files = find_audio_files(AUDIO_DIR)', text: "인수가 없으면 audio 폴더 목록에서 첫 번째 파일을 자동 선택함." },
        { at: 'if audio_path.suffix.lower() not in SUPPORTED_FORMATS:', text: "확장자가 지원 형식이 아니면 ValueError로 알려줌." },
      ],
      code:
`def resolve_audio_input(input_path: Path | None) -> Path:
    """CLI 입력이 없으면 audio 디렉터리 첫 번째 지원 파일을 자동 선택함."""
    if input_path is not None:
        audio_path = input_path.expanduser().resolve()
    else:
        audio_files = find_audio_files(AUDIO_DIR)
        if not audio_files:
            raise FileNotFoundError(f"오디오 파일을 찾을 수 없습니다: {AUDIO_DIR}")
        audio_path = audio_files[0].resolve()
        print(f"입력 파일 자동 선택: {audio_path.name}")

    if not audio_path.exists():
        raise FileNotFoundError(f"오디오 파일을 찾을 수 없습니다: {audio_path}")
    if not audio_path.is_file():
        raise ValueError(f"파일이 아닙니다: {audio_path}")
    if audio_path.suffix.lower() not in SUPPORTED_FORMATS:
        raise ValueError(f"지원하지 않는 오디오 형식입니다: {audio_path.suffix}")
    return audio_path`,
    },
    {
      id: "load_api_keys",
      name: "load_api_keys(env_path)",
      fileId: "main",
      summary: ".env 파일에서 CLAUDE_API_KEY와 OPENAI_API_KEY 두 가지를 읽어 반환함.",
      how: "이 예제는 두 서비스(Whisper=OpenAI, 화자분리=Claude)를 모두 씀. 두 키를 한 함수에서 같이 확인해, 없는 키가 있으면 어떤 키들이 없는지 목록으로 알려주고 멈춤.",
      terms: ["load_dotenv", "환경변수(.env)", "API 키", "RuntimeError", "튜플(tuple)"],
      lines: [
        { at: 'dotenv = require_package("dotenv", "python-dotenv")', text: "python-dotenv 패키지를 지연 임포트함. 없으면 설치 안내와 함께 멈춤." },
        { at: 'dotenv.load_dotenv(env_path)', text: ".env 파일을 읽어 환경변수로 올림." },
        { at: 'claude_key = os.getenv("CLAUDE_API_KEY")', text: "환경변수에서 Claude API 키를 꺼냄. 없으면 None을 받음." },
        { at: 'if missing:', text: "없는 키들을 missing 목록에 모아, 한 번에 어떤 키들이 필요한지 알려줌." },
        { at: 'return claude_key, openai_key', text: "두 키를 튜플로 묶어 한꺼번에 돌려줌. 호출부에서 claude_key, openai_key = load_api_keys(...)로 받음." },
      ],
      code:
`def load_api_keys(env_path: Path) -> tuple[str, str]:
    """hands-on/.env에서 CLAUDE_API_KEY와 OPENAI_API_KEY를 읽어 반환함."""
    dotenv = require_package("dotenv", "python-dotenv")
    if not env_path.exists():
        raise FileNotFoundError(f".env 파일을 찾을 수 없습니다: {env_path}")

    # .env 파일에서 API 키 등 환경변수를 로드함
    dotenv.load_dotenv(env_path)
    claude_key = os.getenv("CLAUDE_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")

    missing = []
    if not claude_key:
        missing.append("CLAUDE_API_KEY")
    if not openai_key:
        missing.append("OPENAI_API_KEY")
    if missing:
        raise RuntimeError(f"{', '.join(missing)} 값이 .env에 없습니다: {env_path}")

    return claude_key, openai_key`,
    },
    {
      id: "transcribe_with_whisper",
      name: "transcribe_with_whisper(audio_path, api_key)",
      fileId: "main",
      summary: "OpenAI Whisper API를 호출해 타임스탬프가 포함된 전사 세그먼트 목록을 받아옴.",
      how: "verbose_json 형식과 timestamp_granularities=['segment']를 써서 '[00:05] 안녕하세요' 형태의 시간 정보를 포함한 응답을 받음. 이 타임스탬프가 Claude의 화자 분리 힌트가 됨. 받은 응답은 extract_whisper_segments로 정리함.",
      terms: ["with open(rb)", "Whisper", "전사(transcription)", "verbose_json", "timestamp_granularities", "OpenAI 클라이언트"],
      lines: [
        { at: 'openai_module = require_package("openai", "openai")', text: "openai 패키지를 지연 임포트함." },
        { at: 'with audio_path.open("rb") as audio_file:', text: "오디오 파일을 바이너리(rb)로 엶. with 블록을 벗어나면 파일이 자동으로 닫힘." },
        { at: 'response_format="verbose_json",', text: "verbose_json은 단순 텍스트가 아니라 타임스탬프·세그먼트 등 상세 정보를 포함한 JSON을 받는 형식임." },
        { at: 'timestamp_granularities=["segment"],', text: "세그먼트 단위 타임스탬프를 요청함. 이 타임스탬프가 화자 분리의 핵심 단서가 됨." },
      ],
      code:
`def transcribe_with_whisper(audio_path: Path, api_key: str) -> list[WhisperSegment]:
    """Whisper STT를 실행하여 타임스탬프가 포함된 세그먼트 목록을 반환함."""
    openai_module = require_package("openai", "openai")
    client = openai_module.OpenAI(api_key=api_key)

    print(f"[1/3] Whisper STT 실행: {audio_path.name}")
    with audio_path.open("rb") as audio_file:
        # OpenAI Whisper API를 호출하여 오디오를 텍스트로 변환함
        response = client.audio.transcriptions.create(
            model=WHISPER_MODEL,
            file=audio_file,
            language="ko",
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )

    segments = extract_whisper_segments(response)
    if not segments:
        raise RuntimeError("Whisper 응답에서 segment 타임스탬프를 찾지 못했습니다.")

    print(f"Whisper segment 수: {len(segments)}")
    return segments`,
    },
    {
      id: "extract_whisper_segments",
      name: "extract_whisper_segments(response)",
      fileId: "main",
      summary: "OpenAI SDK 응답(객체 또는 딕셔너리)에서 세그먼트 목록을 꺼내 WhisperSegment 리스트로 변환함.",
      how: "SDK 버전에 따라 응답 형식이 다를 수 있음. read_field로 종류에 상관없이 segments를 꺼내고, model_dump()라는 백업 방법도 시도함. 빈 텍스트 세그먼트는 걸러냄.",
      terms: ["read_field", "model_dump", "타입 힌트", "리스트 컴프리헨션"],
      lines: [
        { at: 'raw_segments = read_field(response, "segments")', text: "read_field로 응답 형식(딕셔너리/객체)에 상관없이 segments를 꺼냄." },
        { at: 'if raw_segments is None and hasattr(response, "model_dump"):', text: "segments가 없으면 model_dump()로 딕셔너리로 변환해 다시 시도함. pydantic 모델의 직렬화 방법임." },
        { at: 'text = str(read_field(raw_segment, "text", "")).strip()', text: "각 세그먼트의 텍스트를 꺼내 앞뒤 공백을 제거함. 빈 것은 건너뜀." },
        { at: 'segments.append(WhisperSegment(start=start, end=end, text=text))', text: "정리된 값으로 WhisperSegment 객체를 만들어 목록에 추가함." },
      ],
      code:
`def extract_whisper_segments(response: Any) -> list[WhisperSegment]:
    """OpenAI SDK 응답에서 세그먼트 객체를 추출하여 반환함."""
    raw_segments = read_field(response, "segments")
    if raw_segments is None and hasattr(response, "model_dump"):
        raw_segments = response.model_dump().get("segments")

    segments: list[WhisperSegment] = []
    for raw_segment in raw_segments or []:
        text = str(read_field(raw_segment, "text", "")).strip()
        if not text:
            continue

        start = float(read_field(raw_segment, "start", 0.0) or 0.0)
        end = float(read_field(raw_segment, "end", start) or start)
        segments.append(WhisperSegment(start=start, end=end, text=text))

    return segments`,
    },
    {
      id: "format_whisper_segments",
      name: "format_whisper_segments(segments)",
      fileId: "main",
      summary: "WhisperSegment 목록을 '[MM:SS] 텍스트' 형식의 문자열로 변환해 Claude 프롬프트에 넣을 수 있게 함.",
      how: "각 세그먼트를 '[00:05] 안녕하세요' 형태로 변환하고, 줄바꿈으로 이어붙여 하나의 긴 문자열로 만듦. 이 문자열이 Claude에게 화자 분리 힌트로 전달됨.",
      terms: ["제너레이터 표현식", "타입 힌트"],
      lines: [
        { at: 'return "\\n".join(f"[{segment.timestamp}] {segment.text}" for segment in segments)', text: "각 세그먼트를 '[MM:SS] 텍스트' 형식으로 변환해 줄바꿈으로 이어붙임. segment.timestamp는 @property로 자동 계산됨." },
      ],
      code:
`def format_whisper_segments(segments: list[WhisperSegment]) -> str:
    """Whisper 세그먼트를 Claude 프롬프트용 텍스트 형식으로 변환함."""
    return "\\n".join(f"[{segment.timestamp}] {segment.text}" for segment in segments)`,
    },
    {
      id: "build_diarization_prompt",
      name: "build_diarization_prompt(whisper_text)",
      fileId: "main",
      summary: "Whisper 전사 결과를 받아 Claude에게 화자 분리를 요청하는 프롬프트를 만듦.",
      how: "좋은 프롬프트는 AI에게 '무엇을·어떻게·어떤 형식으로' 해야 하는지를 명확히 알려줌. 이 함수는 ①입력 데이터, ②작업 지시(6개 규칙), ③출력 형식 규칙, ④예시를 담은 완전한 지침서를 만듦. 특히 출력 형식을 '`[MM:SS] 화자X: 텍스트` 행만'으로 엄격히 제한해 파싱이 쉽게 함.",
      terms: ["f-string", "프롬프트 엔지니어링"],
      lines: [
        { at: 'return f"""아래는 OpenAI Whisper가', text: "f\"\"\"...\"\"\" 는 여러 줄 f-string임. whisper_text 변수 값이 중간에 끼워 들어감." },
        { at: '[Whisper STT 결과]', text: "실제 Whisper 전사 내용이 여기 들어감. Claude가 이 내용을 보고 화자를 추리함." },
        { at: '[작업 지시]', text: "6개 규칙으로 Claude가 어떻게 화자를 구분하고 라벨을 붙여야 하는지 안내함." },
        { at: '[출력 규칙]', text: "출력 형식을 엄격히 제한함. 설명·제목·코드블록 없이 대화 행만 출력하게 함." },
        { at: '[출력 예시]', text: "예시를 보여줘 Claude가 정확히 어떤 형식으로 써야 하는지 이해하게 함." },
      ],
      code:
`def build_diarization_prompt(whisper_text: str) -> str:
    """화자 분리를 요청하는 한국어 Claude 프롬프트를 생성함."""
    return f"""아래는 OpenAI Whisper가 생성한 한국어 STT 결과입니다.
Claude는 오디오를 직접 들을 수 없으므로, 아래 segment 타임스탬프와 문맥만 사용하여 화자를 분리하세요.

[Whisper STT 결과]
{whisper_text}

[작업 지시]
1. 대화의 말투, 호칭, 응답 흐름, 문맥을 근거로 화자를 구분하세요.
2. 화자는 반드시 화자A, 화자B, 화자C처럼 표시하세요.
3. 같은 사람은 처음부터 끝까지 같은 화자 라벨을 유지하세요.
4. 각 발화의 시작 타임스탬프는 입력 segment의 [MM:SS] 값을 활용하세요.
5. 자연스러운 대화를 위해 감탄사, 추임새, 짧은 반응도 삭제하지 말고 포함하세요.
6. STT 오류로 보이는 부분은 문맥상 최소한으로만 다듬고, 의미를 새로 만들지 마세요.

[출력 규칙]
- 출력은 오직 \`[MM:SS] 화자X: 텍스트\` 형식의 행만 작성하세요.
- 설명, 요약, 제목, 코드블록, 목록 기호, 주석은 절대 출력하지 마세요.
- 확실하지 않은 발화도 가장 가능성이 높은 화자로 배정하세요.

[출력 예시]
[00:00] 화자A: 어, 여보세요.
[00:02] 화자B: 응, 지금 어디야?
[00:04] 화자A: 아, 나 거의 다 왔어."""`,
    },
    {
      id: "diarize_with_claude",
      name: "diarize_with_claude(whisper_text, api_key)",
      fileId: "main",
      summary: "Claude API를 호출해 Whisper 전사 결과에 화자 분리를 수행하고 결과 텍스트를 돌려줌.",
      how: "Claude에게 system 메시지(역할 부여)와 user 메시지(작업 지시+데이터)를 보냄. Claude 응답의 content는 여러 블록(리스트)일 수 있어, text 속성이 있는 것만 모아 하나의 문자열로 합침.",
      terms: ["Anthropic 클라이언트", "messages.create", "system 메시지", "content 블록", "getattr", "타입 힌트"],
      lines: [
        { at: 'anthropic_module = require_package("anthropic", "anthropic")', text: "anthropic 패키지를 지연 임포트함." },
        { at: 'message = client.messages.create(', text: "Claude API 호출. model·max_tokens·system·messages를 지정함." },
        { at: 'system=(', text: "system 메시지는 Claude에게 역할을 부여함. '화자 분리 전문가'로 행동하게 지정함." },
        { at: 'for content_block in message.content:', text: "Claude 응답의 content는 여러 블록의 목록임. 각 블록에서 text 속성을 꺼냄." },
        { at: 'block_text = getattr(content_block, "text", "")', text: "getattr로 text 속성을 안전하게 꺼냄. 없으면 빈 문자열을 받음." },
      ],
      code:
`def diarize_with_claude(whisper_text: str, api_key: str) -> str:
    """Claude API를 호출하여 Whisper 전사 결과에 화자 분리를 수행함."""
    anthropic_module = require_package("anthropic", "anthropic")
    client = anthropic_module.Anthropic(api_key=api_key)

    print(f"[2/3] Claude 화자 분리 실행: {CLAUDE_MODEL}")
    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=MAX_OUTPUT_TOKENS,
        system=(
            "당신은 한국어 전화 통화 전사와 화자 분리 전문가입니다. "
            "반드시 사용자가 지정한 출력 형식만 반환합니다."
        ),
        messages=[
            {
                "role": "user",
                "content": build_diarization_prompt(whisper_text),
            }
        ],
    )

    text_parts: list[str] = []
    for content_block in message.content:
        block_text = getattr(content_block, "text", "")
        if block_text:
            text_parts.append(block_text)

    transcript = "\\n".join(text_parts).strip()
    if not transcript:
        raise RuntimeError("Claude 응답이 비어 있습니다.")
    return transcript`,
    },
    {
      id: "parse_diarized_transcript",
      name: "parse_diarized_transcript(transcript)",
      fileId: "main",
      summary: "Claude가 출력한 '[MM:SS] 화자X: 텍스트' 형식의 텍스트를 파싱해 SegmentDict 목록으로 변환함.",
      how: "Claude가 가끔 형식에 맞지 않는 행을 섞어 출력할 수 있음. DIARIZED_LINE_PATTERN 정규식으로 형식에 맞는 행만 뽑아내고, 타임스탬프와 화자 라벨을 정규화해 일관된 구조로 만듦.",
      terms: ["re.compile(정규식)", "named group", "splitlines", "TypedDict"],
      lines: [
        { at: 'for raw_line in transcript.splitlines():', text: "splitlines()는 텍스트를 줄 단위로 나눔. '\\n'.split()과 비슷하지만 다양한 줄바꿈 형식을 모두 처리함." },
        { at: 'match = DIARIZED_LINE_PATTERN.match(line)', text: "정규식 패턴으로 한 줄이 '[MM:SS] 화자X: 텍스트' 형식인지 확인함. 맞지 않으면 continue로 건너뜀." },
        { at: 'timestamp": normalize_timestamp(match.group("timestamp")),', text: "match.group('timestamp')로 named group 값을 꺼냄. normalize_timestamp로 MM:SS 형식으로 정규화함." },
        { at: '"speaker": normalize_speaker_label(match.group("speaker")),', text: "화자 라벨도 normalize_speaker_label로 '화자A' 형식으로 정규화함." },
        { at: 'if not segments:', text: "파싱된 세그먼트가 하나도 없으면 Claude 응답 형식이 잘못된 것이므로 오류를 냄." },
      ],
      code:
`def parse_diarized_transcript(transcript: str) -> list[SegmentDict]:
    """\`[MM:SS] 화자X: 텍스트\` 형식의 행만 파싱하여 세그먼트 목록을 반환함."""
    segments: list[SegmentDict] = []

    for raw_line in transcript.splitlines():
        line = raw_line.strip()
        match = DIARIZED_LINE_PATTERN.match(line)
        if not match:
            continue

        text = match.group("text").strip()
        if not text:
            continue

        segments.append(
            {
                "id": len(segments) + 1,
                "timestamp": normalize_timestamp(match.group("timestamp")),
                "speaker": normalize_speaker_label(match.group("speaker")),
                "text": text,
            }
        )

    if not segments:
        raise RuntimeError(
            "Claude 응답에서 \`[MM:SS] 화자X: 텍스트\` 형식의 행을 찾지 못했습니다."
        )
    return segments`,
    },
    {
      id: "render_segments",
      name: "render_segments(segments)",
      fileId: "main",
      summary: "파싱된 SegmentDict 목록을 '[MM:SS] 화자이름: 텍스트' 대화록 텍스트로 변환함.",
      how: "저장할 TXT 파일에 들어갈 대화록 형식을 만드는 함수임. 각 세그먼트를 한 줄로 변환하고 줄바꿈으로 이어붙임.",
      terms: ["제너레이터 표현식", "TypedDict"],
      lines: [
        { at: 'return "\\n".join(', text: "각 세그먼트를 '[MM:SS] 화자: 텍스트' 형식으로 변환해 줄바꿈으로 이어붙임." },
      ],
      code:
`def render_segments(segments: list[SegmentDict]) -> str:
    """파싱된 세그먼트를 대화록 텍스트 형식으로 변환함."""
    return "\\n".join(
        f"[{segment['timestamp']}] {segment['speaker']}: {segment['text']}"
        for segment in segments
    )`,
    },
    {
      id: "collect_speaker_samples",
      name: "collect_speaker_samples(segments)",
      fileId: "main",
      summary: "화자별로 샘플 발화를 최대 3개씩 모아, 사용자가 누가 누구인지 알아볼 수 있게 함.",
      how: "화자A·화자B가 실제로 누구인지 알려주려면 샘플 발화를 보여줘야 함. setdefault로 화자가 없으면 빈 목록을 만들고, 3개가 채워지면 더 이상 추가하지 않음. 긴 발화는 80자로 자름.",
      terms: ["딕셔너리(dict)", "setdefault"],
      lines: [
        { at: 'samples.setdefault(speaker, [])', text: "setdefault는 '키가 없으면 기본값으로 추가하고, 있으면 기존 값을 그대로 둠'. 새 화자가 처음 나올 때 빈 목록을 만듦." },
        { at: 'if len(samples[speaker]) >= 3:', text: "화자당 샘플은 최대 3개만 모음. 3개가 되면 continue로 다음 세그먼트로 넘어감." },
        { at: 'text = text[:MAX_SAMPLE_TEXT_LENGTH] + "..."', text: "긴 발화는 MAX_SAMPLE_TEXT_LENGTH(80자)까지만 잘라 '...'을 붙임." },
      ],
      code:
`def collect_speaker_samples(segments: list[SegmentDict]) -> dict[str, list[str]]:
    """화자별 샘플 발화를 최대 3개씩 수집하여 반환함."""
    samples: dict[str, list[str]] = {}
    for segment in segments:
        speaker = segment["speaker"]
        samples.setdefault(speaker, [])
        if len(samples[speaker]) >= 3:
            continue

        text = segment["text"]
        if len(text) > MAX_SAMPLE_TEXT_LENGTH:
            text = text[:MAX_SAMPLE_TEXT_LENGTH] + "..."
        samples[speaker].append(text)
    return samples`,
    },
    {
      id: "parse_name_map",
      name: "parse_name_map(name_map_text)",
      fileId: "main",
      summary: "'화자A=아내,화자B=남편' 같은 문자열을 {'화자A': '아내', '화자B': '남편'} 딕셔너리로 변환함.",
      how: "--name-map 옵션으로 화자 이름을 미리 지정할 수 있음. 쉼표로 여러 매핑을 나누고, =로 라벨과 이름을 나눔. 형식이 잘못됐으면 명확한 오류를 냄.",
      terms: ["딕셔너리(dict)", "split()", "strip()", "ValueError"],
      lines: [
        { at: 'if not name_map_text:', text: "입력이 없으면(None이거나 빈 문자열) 빈 딕셔너리를 돌려줌." },
        { at: 'for item in name_map_text.split(","):', text: "쉼표로 '화자A=아내', '화자B=남편'처럼 각 매핑으로 나눔." },
        { at: 'if "=" not in item:', text: "'='가 없으면 형식이 잘못된 것이므로 ValueError로 알려줌." },
        { at: 'label, name = item.split("=", 1)', text: "'화자A=아내'를 ['화자A', '아내']로 나눔. 1은 '한 번만 나눠라'." },
      ],
      code:
`def parse_name_map(name_map_text: str | None) -> dict[str, str]:
    """\`화자A=아내,화자B=남편\` 형태의 CLI 텍스트를 딕셔너리로 파싱함."""
    if not name_map_text:
        return {}

    mapping: dict[str, str] = {}
    for item in name_map_text.split(","):
        item = item.strip()
        if not item:
            continue
        if "=" not in item:
            raise ValueError(f"--name-map 항목에 '='가 없습니다: {item}")

        label, name = item.split("=", 1)
        label = normalize_speaker_label(label)
        name = name.strip()
        if not label or not name:
            raise ValueError(f"--name-map 항목이 비어 있습니다: {item}")
        mapping[label] = name
    return mapping`,
    },
    {
      id: "choose_speaker_names",
      name: "choose_speaker_names(segments, predefined_names, interactive)",
      fileId: "main",
      summary: "화자별 샘플 발화를 보여주고, 실제 이름을 입력받거나 미리 정해진 이름을 사용해 화자 이름 매핑을 완성함.",
      how: "대화식(interactive=True)이면 input()으로 사용자에게 직접 이름을 물어봄. --yes나 --name-map을 쓰면 대화 없이 진행함. 미리 정해진 이름이 있으면 그걸 기본값으로 제안함.",
      terms: ["input()", "딕셔너리(dict)", "sorted()"],
      lines: [
        { at: 'samples = collect_speaker_samples(segments)', text: "먼저 화자별 샘플 발화를 모아 화면에 출력함. 사용자가 누가 누구인지 알아볼 수 있게 함." },
        { at: 'if not interactive:', text: "--yes나 --name-map을 썼으면 묻지 않고 미리 정해진 이름 또는 기본 라벨로 바로 매핑함." },
        { at: 'unknown = sorted(set(predefined_names) - set(speakers))', text: "--name-map에 있지만 실제 결과에 없는 화자 라벨이 있으면 사용자에게 알려줌." },
        { at: 'entered_name = input(prompt).strip()', text: "input()으로 사용자에게 이름을 물어봄. Enter를 누르면 빈 문자열을 받아 기본값을 씀." },
      ],
      code:
`def choose_speaker_names(
    segments: list[SegmentDict],
    predefined_names: dict[str, str],
    interactive: bool,
) -> dict[str, str]:
    """화자 샘플 발화를 보여 주고 실제 이름을 입력받거나 기본 라벨을 유지함."""
    samples = collect_speaker_samples(segments)
    speakers = sorted(samples)

    print("\\n[화자별 샘플 발화]")
    for speaker in speakers:
        print(f"- {speaker}")
        for sample in samples[speaker]:
            print(f"  - {sample}")

    if not interactive:
        mapping = {
            speaker: predefined_names.get(speaker, speaker)
            for speaker in speakers
        }
        unknown = sorted(set(predefined_names) - set(speakers))
        if unknown:
            print(f"참고: 결과에 없는 화자 라벨은 무시합니다: {', '.join(unknown)}")
        return mapping

    print("\\n실제 이름을 입력하세요. Enter를 누르면 기본 화자 라벨을 유지합니다.")
    mapping: dict[str, str] = {}
    for speaker in speakers:
        default_name = predefined_names.get(speaker, speaker)
        prompt = f"{speaker} 이름 [{default_name}]: "
        entered_name = input(prompt).strip()
        mapping[speaker] = entered_name or default_name
    return mapping`,
    },
    {
      id: "apply_speaker_names",
      name: "apply_speaker_names(segments, name_mapping)",
      fileId: "main",
      summary: "파싱된 세그먼트의 화자 라벨(화자A 등)을 실제 이름(아내 등)으로 바꿔 새 목록을 돌려줌.",
      how: "기존 segments를 직접 바꾸지 않고, 이름이 반영된 새 딕셔너리 목록을 만들어 돌려줌(불변성). .get()으로 매핑에 없는 화자는 원래 라벨을 그대로 씀.",
      terms: ["리스트 컴프리헨션", ".get()", "딕셔너리(dict)", "TypedDict"],
      lines: [
        { at: 'return [', text: "리스트 컴프리헨션으로 각 세그먼트를 이름이 반영된 새 딕셔너리로 변환해 목록으로 만듦." },
        { at: '"speaker": name_mapping.get(segment["speaker"], segment["speaker"]),', text: "매핑에 이 화자가 있으면 실제 이름을, 없으면 원래 라벨을 그대로 씀." },
      ],
      code:
`def apply_speaker_names(
    segments: list[SegmentDict],
    name_mapping: dict[str, str],
) -> list[SegmentDict]:
    """파싱된 세그먼트에 실제 화자 이름을 적용하여 반환함."""
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
    {
      id: "save_results",
      name: "save_results(output_dir, audio_path, raw_claude_transcript, parsed_segments, final_segments, name_mapping)",
      fileId: "main",
      summary: "화자 분리 결과를 TXT·CSV·JSON 세 가지 형식 파일로 저장하고 저장 경로를 돌려줌.",
      how: "같은 데이터를 서로 다른 목적의 형식으로 저장함. TXT는 사람이 읽는 대화록, CSV는 스프레드시트/분석용(구분자 |), JSON은 프로그램이 읽는 구조화 데이터임. pandas.DataFrame이 세그먼트 목록을 표(DataFrame)로 변환해 CSV로 저장함.",
      terms: ["mkdir", "write_text", "JSON", "pandas(DataFrame)", "utf-8-sig", "튜플(tuple)", "f-string"],
      lines: [
        { at: 'pandas_module = require_package("pandas", "pandas")', text: "pandas 패키지를 지연 임포트함." },
        { at: 'output_dir.mkdir(parents=True, exist_ok=True)', text: "결과를 저장할 폴더가 없으면 만들어 둠. parents=True는 중간 폴더까지, exist_ok=True는 이미 있어도 오류 없이 넘어감." },
        { at: 'txt_path.write_text(', text: "TXT 파일에 메타 정보·원본 Claude 응답·파싱 대화록·최종 대화록을 모두 담아 저장함." },
        { at: 'pandas_module.DataFrame(final_segments).to_csv(', text: "세그먼트 목록을 pandas DataFrame(표)으로 변환해 CSV로 저장함. sep='|'로 구분자를 파이프로 지정함." },
        { at: 'encoding="utf-8-sig",', text: "utf-8-sig는 UTF-8에 BOM(바이트 순서 표식)을 붙인 것임. 엑셀에서 한글 CSV를 열 때 깨지지 않게 하려고 씀." },
        { at: 'json_path.write_text(', text: "JSON 형식으로 구조화된 결과를 저장함. ensure_ascii=False로 한글을 그대로 저장하고, indent=2로 들여쓰기해 읽기 좋게 함." },
        { at: 'return txt_path, csv_path, json_path', text: "세 파일 경로를 튜플로 묶어 돌려줌. 호출부에서 txt, csv, json = save_results(...)로 받음." },
      ],
      code:
`def save_results(
    output_dir: Path,
    audio_path: Path,
    raw_claude_transcript: str,
    parsed_segments: list[SegmentDict],
    final_segments: list[SegmentDict],
    name_mapping: dict[str, str],
) -> tuple[Path, Path, Path]:
    """TXT, CSV, JSON 결과 파일을 저장하고 저장 경로를 반환함."""
    pandas_module = require_package("pandas", "pandas")
    output_dir.mkdir(parents=True, exist_ok=True)

    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    parsed_transcript = render_segments(parsed_segments)
    final_transcript = render_segments(final_segments)

    txt_path = output_dir / "result.txt"
    txt_path.write_text(
        "\\n".join(
            [
                "# Claude LLM 화자 분리 결과",
                "",
                f"- 생성 시각: {generated_at}",
                f"- 입력 오디오: {audio_path.name}",
                f"- Whisper 모델: {WHISPER_MODEL}",
                f"- Claude 모델: {CLAUDE_MODEL}",
                "",
                "## 원본 변환 결과",
                raw_claude_transcript.strip(),
                "",
                "## 파싱된 원본 대화록",
                parsed_transcript,
                "",
                "## 이름 반영 최종 대화록",
                final_transcript,
                "",
            ]
        ),
        encoding="utf-8",
    )

    csv_path = output_dir / "result_chunks.csv"
    pandas_module.DataFrame(final_segments).to_csv(
        csv_path,
        index=False,
        encoding="utf-8-sig",
        sep="|",
    )

    json_path = output_dir / "result.json"
    json_path.write_text(
        json.dumps(
            {
                "generated_at": generated_at,
                "audio_file": str(audio_path),
                "whisper_model": WHISPER_MODEL,
                "claude_model": CLAUDE_MODEL,
                "name_mapping": name_mapping,
                "segments": final_segments,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    return txt_path, csv_path, json_path`,
    },
    {
      id: "parse_args",
      name: "parse_args()",
      fileId: "main",
      summary: "CLI 옵션(--input·--output-dir·--name-map·--yes)을 정의하고 해석함.",
      how: "argparse는 'python diarization.py --input a.mp3 --yes' 같은 명령줄 입력을 처리하는 표준 도구임. --yes는 값 없이 쓰는 플래그형 옵션으로, store_true를 쓰면 명령줄에 --yes가 있으면 True, 없으면 False가 됨.",
      terms: ["argparse", "store_true", "타입 힌트"],
      lines: [
        { at: 'parser = argparse.ArgumentParser(', text: "argparse 파서를 만듦. 명령줄 옵션을 정의·해석하는 표준 도구임." },
        { at: '"--input",', text: "--input 옵션: 변환할 오디오 파일 경로. 생략하면 auto 선택." },
        { at: '"--output-dir",', text: "--output-dir 옵션: 결과를 저장할 폴더 경로." },
        { at: '"--name-map",', text: '--name-map 옵션: "화자A=아내,화자B=남편" 형식으로 이름을 미리 지정.' },
        { at: 'action="store_true"', text: "store_true: 이 옵션이 명령줄에 있으면 True, 없으면 False로 저장. 값을 따로 쓰지 않는 플래그형 옵션에 씀." },
      ],
      code:
`def parse_args() -> argparse.Namespace:
    """CLI 인수를 파싱함."""
    parser = argparse.ArgumentParser(
        description="Whisper STT 후 Claude로 화자 분리를 수행하는 예제"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=None,
        help="입력 오디오 파일 경로. 생략하면 hands-on/05.stt/audio의 첫 번째 파일 사용",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=SCRIPT_DIR,
        help="결과 파일을 저장할 디렉터리. 기본값은 현재 예제 디렉터리",
    )
    parser.add_argument(
        "--name-map",
        default=None,
        help='비대화식 이름 매핑. 예: "화자A=아내,화자B=남편"',
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="이름 입력을 생략하고 지정되지 않은 화자는 기본 라벨 유지",
    )
    return parser.parse_args()`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "전체 화자 분리 워크플로우를 순서대로 실행하는 시작점.",
      how: "프로그램의 '지휘자'임. 옵션 읽기 → API 키 로드 → Whisper 전사 → Claude 화자 분리 → 파싱 → 이름 지정 → 저장 순으로 진행함. 전체를 try/except로 감싸 오류가 나도 메시지를 찍고 실패(1)로 끝냄. KeyboardInterrupt(Ctrl+C)도 별도로 처리함.",
      terms: ["예외 처리(try/except)", "sys.stderr", "raise SystemExit", "if __name__", "KeyboardInterrupt"],
      lines: [
        { at: 'args = parse_args()', text: "먼저 명령줄 옵션을 읽음." },
        { at: 'interactive_names = not args.yes and args.name_map is None', text: "대화식 이름 입력 여부를 결정함. --yes도 아니고 --name-map도 없으면 대화식으로 물어봄." },
        { at: 'claude_key, openai_key = load_api_keys(ENV_PATH)', text: "두 API 키를 한 번에 불러옴. 없으면 여기서 명확한 오류를 냄." },
        { at: 'whisper_segments = transcribe_with_whisper(audio_path, openai_key)', text: "①Whisper 전사 → ②Claude 화자 분리 → ③파싱 → ④이름 지정 → ⑤저장 순서로 실행함." },
        { at: 'except KeyboardInterrupt:', text: "Ctrl+C로 사용자가 중단하면 종료 코드 130(Unix 관례)을 반환함." },
        { at: 'except Exception as exc:', text: "그 외 모든 오류는 메시지를 찍고 종료 코드 1로 끝냄." },
      ],
      code:
`def main() -> int:
    """Claude 화자 분리 워크플로우를 실행함."""
    args = parse_args()
    interactive_names = not args.yes and args.name_map is None

    try:
        audio_path = resolve_audio_input(args.input)
        output_dir = args.output_dir.expanduser().resolve()
        name_map = parse_name_map(args.name_map)

        claude_key, openai_key = load_api_keys(ENV_PATH)
        whisper_segments = transcribe_with_whisper(audio_path, openai_key)
        whisper_text = format_whisper_segments(whisper_segments)
        raw_claude_transcript = diarize_with_claude(whisper_text, claude_key)

        print("[3/3] Claude 응답 파싱 및 결과 저장")
        parsed_segments = parse_diarized_transcript(raw_claude_transcript)
        speaker_names = choose_speaker_names(
            parsed_segments,
            name_map,
            interactive=interactive_names,
        )
        final_segments = apply_speaker_names(parsed_segments, speaker_names)
        txt_path, csv_path, json_path = save_results(
            output_dir,
            audio_path,
            raw_claude_transcript,
            parsed_segments,
            final_segments,
            speaker_names,
        )

    except KeyboardInterrupt:
        print("\\n사용자가 실행을 중단했습니다.", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print("\\n완료")
    print(f"- result.txt: {txt_path}")
    print(f"- result_chunks.csv: {csv_path}")
    print(f"- result.json: {json_path}")
    return 0`,
    },
  ],

  glossary: {
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .resolve().parent를 붙이면 이 파일이 든 폴더의 절대경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "set(집합)": "{ }로 묶은 '중복 없는 값들의 모음'. 'x in 집합'으로 포함 여부를 매우 빠르게 확인할 수 있어, 지원 형식 검사에 적합함.",
    "sys.stdout.reconfigure": "콘솔(터미널) 출력의 글자 인코딩을 바꾸는 기능. 윈도우에서 한글이 깨지지 않도록 UTF-8로 다시 설정함.",
    "re.compile(정규식)": "re.compile로 정규식 패턴을 미리 컴파일해 저장함. 매번 패턴을 새로 만들지 않아 성능이 좋아지고, 패턴을 변수처럼 재사용할 수 있음.",
    "named group": "정규식에서 (?P<이름>패턴) 형태로 이름을 붙인 그룹. match.group('이름')으로 매칭된 값을 이름으로 꺼낼 수 있음. 번호 대신 이름으로 접근해 코드가 읽기 쉬워짐.",
    "TypedDict": "딕셔너리의 각 키 이름과 값의 타입을 미리 정의하는 클래스. 실제 딕셔너리처럼 사용하지만, 코드 점검 도구가 키 이름과 타입을 확인해 실수를 줄여줌.",
    "@dataclass(frozen)": "@dataclass는 __init__·__repr__ 등을 자동 생성해주는 데코레이터임. frozen=True는 '한번 만들면 값을 바꿀 수 없는 불변 객체'로 만들어 안전하게 공유할 수 있음.",
    "@property": "메서드(함수)를 속성처럼 쓸 수 있게 해주는 데코레이터. @property를 붙이면 segment.timestamp()가 아니라 segment.timestamp처럼 괄호 없이 호출 가능함.",
    "divmod": "두 수를 나눠 몫과 나머지를 동시에 돌려주는 내장 함수. divmod(65, 60)은 (1, 5) — 65초는 1분 5초임. 분과 초로 나눌 때 편리함.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
    "타입 힌트": "변수·함수에 자료의 종류(str, Path, list 등)를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "re.sub(정규식 치환)": "re.sub(패턴, 바꿀값, 대상)은 대상 문자열에서 패턴에 맞는 부분을 찾아 바꿔줌. '\\s+'는 '1개 이상의 공백'을 의미함.",
    "isinstance()": "어떤 값이 특정 종류(타입)인지 확인하는 함수. 예: isinstance(x, dict)는 'x가 딕셔너리인가?'를 True/False로 답함.",
    ".get()": "딕셔너리에서 값을 '안전하게' 꺼내는 방법. 열쇠(키)가 없어도 오류를 내지 않고, 정해둔 기본값을 돌려줌.",
    "getattr": "객체에서 속성 이름을 문자열로 지정해 꺼내는 함수. getattr(obj, 'name', 기본값)은 obj.name이 없으면 기본값을 돌려줌. 속성 이름을 동적으로 지정할 수 있음.",
    "지연 임포트(lazy import)": "파일 맨 위에서 미리 import하지 않고, 실제로 쓸 때 처음으로 import하는 방식. 패키지가 없어도 프로그램은 시작되고, 실제 사용 시점에 오류를 냄.",
    "__import__": "모듈 이름을 문자열로 받아 동적으로 import하는 내장 함수. __import__('openai')는 import openai와 같은 효과임.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "raise…from": "raise 오류 from 원래_오류 형태로, 새 오류를 발생시키면서 원인이 된 오류를 함께 보존함. 디버깅 시 원래 오류도 볼 수 있음.",
    "RuntimeError": "'실행 중 문제가 생겼다'고 알리는 오류의 한 종류. 여기서는 패키지가 없거나 API 키가 없을 때 일부러 발생시켜 원인을 알려줌.",
    "제너레이터 표현식": "( ... for x in ... if ... ) 형태로, 값을 미리 다 만들지 않고 필요할 때 하나씩 만들어내는 효율적인 문법. sorted()에 바로 넘겨 정렬함.",
    "sorted()": "목록을 정렬해 새 목록으로 돌려주는 함수. 여기서는 파일이나 화자 이름을 이름순으로 정렬함.",
    "suffix(확장자)": "Path 객체의 .suffix는 파일 확장자(예: '.mp3')를 줌. .lower()로 소문자로 맞춰 '.MP3'도 같이 인식하게 함.",
    "FileNotFoundError": "찾는 파일이나 폴더가 없을 때 나는 오류. 여기서는 오디오 파일이나 .env가 없을 때 분명히 알려주려고 일부러 발생시킴.",
    "ValueError": "값이 잘못됐을 때 나는 오류. 여기서는 지원하지 않는 확장자이거나 --name-map 형식이 잘못됐을 때 발생시킴.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(OpenAI, Claude 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "튜플(tuple)": "여러 값을 순서대로 묶는 자료 구조. 리스트와 비슷하지만 한 번 만들면 값을 바꿀 수 없음. 함수에서 여러 값을 한꺼번에 돌려줄 때 씀.",
    "read_field": "딕셔너리·pydantic 모델·일반 객체 어느 것에서든 같은 방식으로 필드 값을 읽어오는 내부 도우미 함수. isinstance로 종류를 확인해 .get() 또는 getattr을 골라 씀.",
    "model_dump": "pydantic 모델 객체를 딕셔너리로 변환하는 메서드. SDK 버전에 따라 응답 객체 타입이 달라질 때 딕셔너리로 통일하는 데 씀.",
    "verbose_json": "Whisper API 응답 형식 옵션. 단순 텍스트(json) 대신 타임스탬프·언어·세그먼트 등 상세 정보를 포함한 JSON을 받음.",
    "timestamp_granularities": "Whisper API에서 어느 단위의 타임스탬프를 받을지 지정하는 옵션. 'segment'로 지정하면 세그먼트(문장) 단위 시작/끝 시각을 받음.",
    "with open(rb)": "with 블록으로 파일을 열면, 블록을 벗어날 때 파일이 자동으로 닫힘. 'rb'는 바이너리(글자가 아닌 원본 바이트)로 읽는다는 뜻으로, 오디오 같은 파일에 씀.",
    "Whisper": "OpenAI의 음성 인식(STT) 모델. 오디오를 글자로 받아쓰거나(전사) 영어로 번역할 수 있음.",
    "전사(transcription)": "말소리를 '같은 언어의 글자'로 받아쓰는 것. 한국어 오디오 → 한국어 텍스트.",
    "OpenAI 클라이언트": "OpenAI 서버와 통신하는 객체. client.audio.transcriptions.create(...)처럼 이 객체를 통해 API를 호출함.",
    "Anthropic 클라이언트": "Anthropic(Claude) 서버와 통신하는 객체. client.messages.create(...)처럼 이 객체를 통해 Claude API를 호출함.",
    "messages.create": "Claude API의 대화 생성 호출. model·max_tokens·system·messages를 지정해 Claude에게 요청을 보내고 응답을 받음.",
    "system 메시지": "Claude에게 역할과 행동 지침을 미리 알려주는 메시지. '당신은 화자 분리 전문가입니다'처럼 AI의 페르소나를 설정함.",
    "content 블록": "Claude API 응답의 content는 여러 블록(텍스트·이미지 등)의 목록임. 각 블록에서 text 속성을 꺼내 이어붙여 최종 텍스트를 만듦.",
    "splitlines": "텍스트를 줄 단위로 나누는 메서드. '\\n'.split과 달리 다양한 줄바꿈 형식(\\r\\n, \\r 등)을 모두 처리함.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"화자\": \"A\"}처럼 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    "setdefault": "딕셔너리에서 '키가 없으면 기본값으로 추가하고, 있으면 기존 값을 그대로 두는' 메서드. 새 항목을 안전하게 초기화할 때 씀.",
    "리스트 컴프리헨션": "[표현식 for 항목 in 목록 if 조건] 형태로, 반복문을 한 줄로 짧게 써서 새 목록을 만드는 파이썬 문법.",
    "split()": "문자열을 구분자로 나눠 목록으로 돌려주는 메서드. '화자A=아내'.split('=', 1)은 ['화자A', '아내']를 돌려줌.",
    "strip()": "문자열 앞뒤의 공백·줄바꿈을 제거하는 메서드. 사용자 입력이나 API 응답에서 불필요한 공백을 없앨 때 씀.",
    "input()": "콘솔(터미널)에서 사용자가 키보드로 입력한 한 줄을 글자로 받아오는 함수.",
    "mkdir": "폴더를 만드는 명령. parents=True는 중간 폴더까지, exist_ok=True는 이미 있어도 오류 없이 넘어가게 함.",
    "write_text": "문자열을 파일에 통째로 쓰는 Path의 기능. encoding='utf-8'로 한글이 깨지지 않게 저장함.",
    "JSON": "데이터를 주고받는 표준 글자 형식. {\"key\": \"value\"} 모양으로, 파이썬 딕셔너리와 거의 똑같이 생김.",
    "pandas(DataFrame)": "표 형태 데이터를 다루는 대표적인 파이썬 라이브러리. DataFrame은 행·열로 구성된 표 구조이고, to_csv()로 CSV 파일로 저장함.",
    "utf-8-sig": "UTF-8 인코딩에 BOM(바이트 순서 표식)을 붙인 형식. 엑셀에서 한글 CSV 파일을 열 때 깨지지 않게 하려고 씀.",
    "argparse": "'python 파일.py --옵션 값' 형태의 명령줄 입력을 정의하고 해석해 주는 파이썬 표준 도구.",
    "store_true": "argparse 옵션의 action 값. 명령줄에 '--yes'가 있으면 True, 없으면 False를 저장함. 값 없이 쓰는 플래그형 옵션에 씀.",
    "sys.stderr": "오류 메시지를 내보내는 통로(표준 에러). 일반 출력(stdout)과 구분해 오류만 따로 보낼 수 있음.",
    "raise SystemExit": "프로그램을 끝내면서 종료 코드를 운영체제에 알림. main()의 반환값(0=성공, 1=실패)을 종료 코드로 씀.",
    "if __name__": "if __name__ == '__main__': 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
    "KeyboardInterrupt": "사용자가 Ctrl+C로 프로그램을 강제 중단했을 때 발생하는 예외. 별도로 처리해 '사용자가 중단했습니다' 메시지를 보여줌.",
    "프롬프트 엔지니어링": "AI가 원하는 출력을 내도록 질문·지시·예시를 잘 구성하는 기술. 형식을 엄격히 제한하고 예시를 보여주면 파싱이 쉬운 일관된 출력을 얻을 수 있음.",
  },
};
