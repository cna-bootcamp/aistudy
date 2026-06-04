/*
 * 예제 설명 페이지 콘텐츠 (OpenAI Whisper STT 단일 파일 예제)
 * 공용 셸: hands-on/explain-exam/  ·  여는 법: explain-exam/index.html?data=../05.stt/simple/explain/data.js
 * 검증: node hands-on/explain-exam/verify-data.js hands-on/05.stt/simple/explain/data.js
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "OpenAI Whisper STT 예제 설명",
    entry: "whisper.py",
  },

  files: [
    { id: "main", label: "whisper.py", role: "단일 파일 CLI 예제 · 오디오를 한국어 전사 + 영어 번역" },
  ],

  flow: [
    { step: 1, title: "실행 시작", label: "실행 시작",
      summary: "명령줄에서 python whisper.py 실행 → main()이 진입점으로 호출됨",
      detail: "이 예제는 웹이 아니라 '명령줄 프로그램'임. 터미널에서 실행하면 맨 아래 if __name__ == \"__main__\": 가 main()을 호출함. main()이 전체 작업을 순서대로 지휘함." },
    { step: 2, title: "명령줄 옵션 읽기", label: "옵션 읽기", refs: ["parse_args"],
      summary: "parse_args()로 --input(오디오 경로)·--output(저장 경로) 옵션을 읽음",
      detail: "식당 주문서를 받는 단계와 비슷함. argparse가 'python whisper.py --input a.mp3' 같은 입력을 해석해, 어떤 파일을 변환하고 어디에 저장할지 정함. 옵션을 생략하면 기본값을 씀." },
    { step: 3, title: "오디오 입력 확정", label: "오디오 확정", refs: ["resolve_audio_input", "select_audio_file"],
      summary: "resolve_audio_input()이 변환할 오디오 파일을 정함(인수 또는 사용자 선택)",
      detail: "--input 으로 파일을 직접 줬으면 그걸 쓰고, 없으면 audio 폴더의 파일 목록을 번호와 함께 보여주고 사용자가 키보드로 번호를 골라 선택함." },
    { step: 4, title: "OpenAI 클라이언트 생성", label: "클라이언트 생성", refs: ["load_openai_client"],
      summary: "load_openai_client()가 .env의 API 키로 OpenAI 객체를 만듦",
      detail: "OpenAI 서버와 통신할 '전화기'를 준비하는 단계임. .env 파일에서 비밀 API 키를 읽어 클라이언트를 만듦. 키가 없으면 여기서 친절히 알려주고 멈춤." },
    { step: 5, title: "한국어 전사", label: "한국어 전사", refs: ["transcribe_korean"],
      summary: "transcribe_korean()이 Whisper로 오디오를 한국어 텍스트로 받아씀",
      detail: "받아쓰기 단계임. 오디오 파일을 Whisper 전사(transcriptions) API에 보내, 말한 내용을 한국어 글자로 변환함." },
    { step: 6, title: "영어 번역", label: "영어 번역", refs: ["translate_english"],
      summary: "translate_english()이 Whisper로 오디오를 곧바로 영어로 옮김",
      detail: "같은 오디오를 이번엔 번역(translations) API에 보냄. '한국어로 받아쓴 뒤 번역'이 아니라, 오디오에서 곧바로 영어 텍스트를 만들어 줌." },
    { step: 7, title: "결과 저장", label: "결과 저장", refs: ["save_result"],
      summary: "save_result()가 한국어 전사 + 영어 번역을 result.txt로 저장",
      detail: "완성된 결과를 파일로 남기는 단계임. 저장 폴더가 없으면 만들고, 한국어·영어 결과를 보기 좋게 묶어 UTF-8 텍스트 파일로 씀." },
    { step: 8, title: "종료", label: "종료",
      summary: "완료 메시지와 입력·출력 경로를 출력하고 종료 코드(0=성공)를 반환",
      detail: "작업이 끝나면 어디에 저장했는지 알려주고 끝남. 도중에 오류가 나면 메시지를 찍고 종료 코드 1(실패)을 돌려줌." },
  ],

  functions: [
    {
      id: "module_setup",
      name: "모듈 설정 (경로·상수)",
      fileId: "main",
      summary: "파일 맨 위에서 한글 출력 깨짐 방지, 폴더 경로, 지원 오디오 형식 등 기본 설정을 준비함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 준비하는 값들'임. 이 파일 위치를 기준으로 audio 폴더·.env 경로를 자동으로 계산하고, Whisper가 받는 오디오 확장자 목록을 집합(set)으로 정의함.",
      terms: ["Path(__file__)", "set(집합)", "sys.stdout.reconfigure"],
      lines: [
        { at: 'if hasattr(sys.stdout, "reconfigure"):', text: "윈도우 콘솔에서 한글 출력이 깨지지 않도록 출력 인코딩을 UTF-8로 바꿈." },
        { at: 'SCRIPT_DIR = Path(__file__).resolve().parent', text: "Path(__file__)은 '이 파일의 위치'. .resolve().parent로 이 파일이 든 폴더의 절대경로를 구함." },
        { at: 'SUPPORTED_FORMATS = {', text: "Whisper가 받는 오디오 확장자 모음(set). 중복 없는 값들의 집합임." },
      ],
      code:
`# Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
SCRIPT_DIR = Path(__file__).resolve().parent
STT_DIR = SCRIPT_DIR.parent
HANDS_ON_DIR = STT_DIR.parent
AUDIO_DIR = STT_DIR / "audio"
ENV_PATH = HANDS_ON_DIR / ".env"
DEFAULT_OUTPUT = SCRIPT_DIR / "result.txt"
MODEL_ID = "whisper-1"

SUPPORTED_FORMATS = {
    ".flac",
    ".m4a",
    ".mp3",
    ".mp4",
    ".mpeg",
    ".mpga",
    ".ogg",
    ".wav",
    ".webm",
}`,
    },
    {
      id: "load_openai_client",
      name: "load_openai_client(env_path)",
      fileId: "main",
      summary: "비밀 설정 파일(.env)에서 OpenAI API 키를 읽어, 서버와 통신할 클라이언트를 만듦.",
      how: "API 키는 코드에 직접 쓰지 않고 .env 파일에 보관함. load_dotenv로 그 파일을 읽어 환경변수로 올린 뒤 키를 꺼냄. 키가 없으면 즉시 분명한 오류를 내어 빨리 알아채게 함.",
      terms: ["load_dotenv", "환경변수(.env)", "API 키", "RuntimeError", "OpenAI 클라이언트"],
      lines: [
        { at: 'load_dotenv(env_path)', text: ".env 파일을 읽어 그 안의 OPENAI_API_KEY를 환경변수로 올림." },
        { at: 'api_key = os.getenv(', text: "환경변수에서 API 키를 꺼냄. 없으면 None을 받음." },
        { at: 'if not api_key:', text: "키가 없으면 즉시 RuntimeError로 멈춰 원인(어떤 키가 어디에 없는지)을 알려줌." },
        { at: 'return OpenAI(api_key=api_key)', text: "키로 OpenAI 클라이언트(서버와 통신하는 객체)를 만들어 돌려줌." },
      ],
      code:
`def load_openai_client(env_path: Path) -> OpenAI:
    """hands-on/.env에서 OPENAI_API_KEY를 읽어 OpenAI 클라이언트를 생성함."""
    # .env 파일에서 API 키 등 환경변수를 로드함
    load_dotenv(env_path)
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(f"OPENAI_API_KEY가 설정되지 않았습니다: {env_path}")
    return OpenAI(api_key=api_key)`,
    },
    {
      id: "find_audio_files",
      name: "find_audio_files(audio_dir)",
      fileId: "main",
      summary: "audio 폴더 안에서 Whisper가 지원하는 오디오 파일만 골라 이름순으로 돌려줌.",
      how: "폴더가 없으면 빈 목록을 돌려줌(안전). 폴더 안 항목을 하나씩 보며, 파일이면서 확장자가 지원 형식인 것만 모아 sorted로 이름순 정렬함.",
      terms: ["제너레이터 표현식", "sorted()", "suffix(확장자)", "set(집합)", "타입 힌트"],
      lines: [
        { at: 'if not audio_dir.exists():', text: "폴더가 아예 없으면 빈 목록 []을 돌려줌(오류 대신 안전 처리)." },
        { at: 'for path in audio_dir.iterdir()', text: "iterdir()로 폴더 안의 항목을 하나씩 훑음." },
        { at: 'if path.is_file() and path.suffix.lower() in SUPPORTED_FORMATS', text: "파일이면서 확장자(.mp3 등)가 지원 형식 집합에 든 것만 고름. sorted로 이름순 정렬해 반환." },
      ],
      code:
`def find_audio_files(audio_dir: Path) -> list[Path]:
    """Whisper가 지원하는 오디오 파일 목록을 이름순으로 반환함."""
    if not audio_dir.exists():
        return []

    return sorted(
        path
        for path in audio_dir.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_FORMATS
    )`,
    },
    {
      id: "print_audio_files",
      name: "print_audio_files(audio_files)",
      fileId: "main",
      summary: "사용 가능한 오디오 파일을 1번부터 번호를 붙여 크기와 함께 화면에 출력함.",
      how: "목록이 비면 '파일이 없다'는 안내와 지원 확장자를 보여주고 끝냄. 파일이 있으면 enumerate로 1번부터 번호를 매겨 이름과 크기(KB)를 출력함.",
      terms: ["enumerate()", "f-string"],
      lines: [
        { at: 'if not audio_files:', text: "목록이 비면 안내 문구를 출력하고 함수를 끝냄(return)." },
        { at: 'for index, audio_path in enumerate(audio_files, start=1):', text: "enumerate(..., start=1)는 1번부터 번호를 매기며 항목을 함께 꺼내 줌." },
        { at: 'size_kb = audio_path.stat().st_size', text: "파일 크기를 바이트로 읽어 KB(÷1024)로 바꿔 함께 보여줌." },
      ],
      code:
`def print_audio_files(audio_files: list[Path]) -> None:
    """1부터 시작하는 번호와 함께 사용 가능한 오디오 파일 목록을 출력함."""
    print("=" * 70)
    print("Whisper 지원 오디오 파일")
    print("=" * 70)

    if not audio_files:
        print(f"오디오 파일이 없습니다: {AUDIO_DIR}")
        print("지원 확장자: " + ", ".join(sorted(SUPPORTED_FORMATS)))
        return

    for index, audio_path in enumerate(audio_files, start=1):
        size_kb = audio_path.stat().st_size / 1024
        print(f"{index}. {audio_path.name} ({size_kb:,.1f} KB)")`,
    },
    {
      id: "select_audio_file",
      name: "select_audio_file(audio_files)",
      fileId: "main",
      summary: "사용자가 키보드로 번호를 입력해 변환할 오디오 파일을 고르게 함.",
      how: "파일이 없으면 오류를 냄. 파일이 하나뿐이면 묻지 않고 자동 선택함. 여러 개면 번호를 입력받아, 숫자가 아니거나 범위를 벗어나면 다시 묻는 반복(while)을 돌림.",
      terms: ["input()", "int()", "예외 처리(try/except)", "while 반복", "FileNotFoundError"],
      lines: [
        { at: 'if len(audio_files) == 1:', text: "파일이 하나뿐이면 묻지 않고 그 파일을 자동 선택함." },
        { at: 'choice = input(', text: "input()으로 사용자가 키보드로 번호를 입력하게 함(콘솔 프로그램의 입력 방법)." },
        { at: 'index = int(choice)', text: "입력한 글자를 숫자로 바꿈. 숫자가 아니면 except로 가서 다시 물음." },
        { at: 'if 1 <= index <= len(audio_files):', text: "번호가 1~개수 범위 안이면 해당 파일을 돌려줌(목록은 0부터라 index-1)." },
      ],
      code:
`def select_audio_file(audio_files: list[Path]) -> Path:
    """사용자가 번호를 입력하여 오디오 파일을 선택하도록 안내함."""
    if not audio_files:
        raise FileNotFoundError(f"지원 오디오 파일을 찾을 수 없습니다: {AUDIO_DIR}")

    if len(audio_files) == 1:
        print(f"\\n자동 선택: {audio_files[0].name}")
        return audio_files[0]

    while True:
        choice = input("\\n변환할 파일 번호를 선택하세요: ").strip()
        try:
            index = int(choice)
        except ValueError:
            print("숫자를 입력해 주세요.")
            continue

        if 1 <= index <= len(audio_files):
            return audio_files[index - 1]

        print(f"1~{len(audio_files)} 사이 번호를 입력해 주세요.")`,
    },
    {
      id: "resolve_audio_input",
      name: "resolve_audio_input(input_arg)",
      fileId: "main",
      summary: "명령줄로 받은 파일이 있으면 그걸 쓰고, 없으면 폴더 목록에서 사용자가 고르게 함.",
      how: "--input 으로 경로를 줬으면 그 파일이 실제로 있는지·지원 형식인지 확인하고 사용함. 인수가 없으면 audio 폴더의 목록을 찾아 출력하고 select_audio_file로 고르게 함.",
      terms: ["Path(__file__)", "suffix(확장자)", "ValueError", "FileNotFoundError"],
      lines: [
        { at: 'if input_arg is not None:', text: "--input 으로 파일을 직접 줬으면(인수가 None이 아니면) 그 경로를 사용함." },
        { at: 'audio_path = input_arg.expanduser().resolve()', text: "~ 같은 단축 경로를 펴고(expanduser) 절대경로로 바꿈(resolve)." },
        { at: 'if audio_path.suffix.lower() not in SUPPORTED_FORMATS:', text: "확장자가 지원 형식이 아니면 ValueError로 알려줌." },
        { at: 'audio_files = find_audio_files(AUDIO_DIR)', text: "인수가 없으면 audio 폴더 목록을 찾아 사용자가 고르게 함." },
      ],
      code:
`def resolve_audio_input(input_arg: Path | None) -> Path:
    """CLI 인수나 대화식 선택으로 오디오 입력 경로를 확정함."""
    if input_arg is not None:
        audio_path = input_arg.expanduser().resolve()
        if not audio_path.exists():
            raise FileNotFoundError(f"입력 오디오 파일을 찾을 수 없습니다: {audio_path}")
        if audio_path.suffix.lower() not in SUPPORTED_FORMATS:
            raise ValueError(f"Whisper 미지원 확장자입니다: {audio_path.suffix}")
        return audio_path

    audio_files = find_audio_files(AUDIO_DIR)
    print_audio_files(audio_files)
    return select_audio_file(audio_files)`,
    },
    {
      id: "transcribe_korean",
      name: "transcribe_korean(client, audio_path)",
      fileId: "main",
      summary: "Whisper 전사 API로 오디오를 한국어 텍스트로 받아씀.",
      how: "오디오 파일을 바이너리로 열어 Whisper transcriptions API에 보냄. 언어를 'ko'로 지정해 한국어로 전사하고, 결과 텍스트만 꺼내 앞뒤 공백을 정리해 돌려줌.",
      terms: ["with open(rb)", "Whisper", "전사(transcription)", "response_format", "OpenAI 클라이언트"],
      lines: [
        { at: 'with audio_path.open("rb") as audio_file:', text: "오디오 파일을 바이너리(rb)로 엶. with 블록을 벗어나면 파일이 자동으로 닫힘." },
        { at: 'transcription = client.audio.transcriptions.create(', text: "Whisper 전사(transcriptions) API 호출 — 말소리를 같은 언어 글자로 받아쓰기." },
        { at: 'language="ko"', text: "언어를 한국어로 지정해 한국어로 전사함." },
        { at: 'return transcription.text.strip()', text: "결과에서 텍스트만 꺼내 앞뒤 공백을 제거(strip)해 돌려줌." },
      ],
      code:
`def transcribe_korean(client: OpenAI, audio_path: Path) -> str:
    """Whisper로 오디오를 한국어 텍스트로 전사함."""
    print(f"\\n1. 한국어 전사 생성 중: {audio_path.name}")
    with audio_path.open("rb") as audio_file:
        # OpenAI Whisper API를 호출하여 오디오를 텍스트로 변환함
        transcription = client.audio.transcriptions.create(
            model=MODEL_ID,
            file=audio_file,
            language="ko",
            response_format="json",
        )
    return transcription.text.strip()`,
    },
    {
      id: "translate_english",
      name: "translate_english(client, audio_path)",
      fileId: "main",
      summary: "Whisper 번역 API로 오디오를 곧바로 영어로 옮김.",
      how: "전사와 비슷하지만 translations API를 씀. 이 API는 '한국어로 받아쓴 뒤 번역'하는 게 아니라, 오디오에서 바로 영어 텍스트를 만들어 줌.",
      terms: ["with open(rb)", "Whisper", "번역(translation)", "OpenAI 클라이언트"],
      lines: [
        { at: 'translation = client.audio.translations.create(', text: "Whisper 번역(translations) API 호출 — 오디오를 곧바로 영어로 옮김(전사 후 번역이 아님)." },
        { at: 'return translation.text.strip()', text: "번역된 영어 텍스트만 꺼내 돌려줌." },
      ],
      code:
`def translate_english(client: OpenAI, audio_path: Path) -> str:
    """Whisper로 오디오를 영어로 직접 번역함."""
    print("2. 영문 번역 생성 중")
    with audio_path.open("rb") as audio_file:
        # Whisper translation API: 오디오를 영어로 직접 번역함 (전사 후 번역 아님)
        translation = client.audio.translations.create(
            model=MODEL_ID,
            file=audio_file,
            response_format="json",
        )
    return translation.text.strip()`,
    },
    {
      id: "save_result",
      name: "save_result(output_path, audio_path, korean_text, english_text)",
      fileId: "main",
      summary: "한국어 전사와 영어 번역을 보기 좋게 묶어 텍스트 파일로 저장함.",
      how: "저장할 폴더가 없으면 먼저 만듦. f-string(삼중 따옴표)으로 제목·생성시각·모델·결과를 담은 내용을 구성하고, UTF-8로 파일에 씀(한글이 안 깨지게 인코딩 지정).",
      terms: ["mkdir", "f-string", "write_text", "타입 힌트"],
      lines: [
        { at: 'output_path.parent.mkdir(parents=True, exist_ok=True)', text: "결과를 저장할 폴더가 없으면 만들어 둠(exist_ok=True: 이미 있어도 오류 없음)." },
        { at: 'content = f"""OpenAI Whisper STT Result', text: "저장할 내용을 f-string(삼중 따옴표)으로 구성함. 한국어 전사와 영어 번역을 함께 담음." },
        { at: 'output_path.write_text(content, encoding="utf-8")', text: "내용을 UTF-8로 파일에 씀(한글이 깨지지 않도록 인코딩 지정)." },
      ],
      code:
`def save_result(
    output_path: Path,
    audio_path: Path,
    korean_text: str,
    english_text: str,
) -> None:
    """한국어 전사 결과와 영문 번역을 텍스트 파일로 저장함."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    content = f"""OpenAI Whisper STT Result
Generated At: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
Model: {MODEL_ID}
Audio File: {audio_path.name}

## 한국어 전사
{korean_text}

## English Translation
{english_text}
"""
    output_path.write_text(content, encoding="utf-8")`,
    },
    {
      id: "parse_args",
      name: "parse_args()",
      fileId: "main",
      summary: "명령줄 옵션(--input, --output)을 정의하고 해석함.",
      how: "argparse는 'python whisper.py --input a.mp3 --output out.txt' 같은 명령줄 입력을 처리하는 표준 도구임. 각 옵션의 타입·기본값·도움말을 정의한 뒤 parse_args()로 실제 입력을 해석함.",
      terms: ["argparse", "Path(__file__)", "타입 힌트"],
      lines: [
        { at: 'parser = argparse.ArgumentParser(', text: "argparse 파서를 만듦. 명령줄 옵션을 정의·해석하는 표준 도구임." },
        { at: '"--input"', text: "--input 옵션 정의: 변환할 오디오 파일 경로(생략 가능, 기본 None)." },
        { at: '"--output"', text: "--output 옵션 정의: 결과를 저장할 경로(기본값 result.txt)." },
        { at: 'return parser.parse_args()', text: "실제 명령줄을 해석해, 옵션 값들을 담은 객체를 돌려줌." },
      ],
      code:
`def parse_args() -> argparse.Namespace:
    """커맨드라인 인수를 파싱함."""
    parser = argparse.ArgumentParser(description="OpenAI Whisper STT example")
    parser.add_argument(
        "--input",
        type=Path,
        default=None,
        help="입력 오디오 파일 경로. 생략하면 audio 디렉터리에서 선택합니다.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"출력 파일 경로. 기본값: {DEFAULT_OUTPUT}",
    )
    return parser.parse_args()`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "전체 작업을 순서대로 실행하는 시작점. 입력 확정→클라이언트→전사→번역→저장.",
      how: "프로그램의 '지휘자'임. 옵션을 읽고, 오디오를 정하고, 클라이언트를 만든 뒤, 한국어 전사 → 영어 번역 → 저장을 차례로 실행함. 전체를 try/except로 감싸 어떤 오류가 나도 메시지를 찍고 실패(1)로 끝냄.",
      terms: ["예외 처리(try/except)", "sys.stderr", "raise SystemExit", "if __name__"],
      lines: [
        { at: 'args = parse_args()', text: "먼저 명령줄 옵션을 읽음." },
        { at: 'audio_path = resolve_audio_input(args.input)', text: "변환할 오디오를 확정함(인수 또는 사용자 선택)." },
        { at: 'client = load_openai_client(ENV_PATH)', text: "API 키로 OpenAI 클라이언트를 준비함." },
        { at: 'korean_text = transcribe_korean(', text: "①한국어 전사 → ②영어 번역 → ③저장 순서로 실행함." },
        { at: 'except Exception as exc:', text: "중간에 어떤 오류가 나도 메시지를 찍고 종료 코드 1을 돌려줌(정상 종료는 0)." },
      ],
      code:
`def main() -> int:
    """Whisper 전사 및 번역 워크플로우를 실행함."""
    args = parse_args()
    output_path = args.output.expanduser().resolve()

    try:
        audio_path = resolve_audio_input(args.input)
        client = load_openai_client(ENV_PATH)
        korean_text = transcribe_korean(client, audio_path)
        english_text = translate_english(client, audio_path)
        save_result(output_path, audio_path, korean_text, english_text)
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print("\\n완료")
    print(f"- 입력 파일: {audio_path}")
    print(f"- 출력 파일: {output_path}")
    return 0`,
    },
  ],

  glossary: {
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .resolve().parent를 붙이면 이 파일이 든 폴더의 절대경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "set(집합)": "{ }로 묶은 '중복 없는 값들의 모음'. 'x in 집합'으로 들어있는지 매우 빠르게 확인할 수 있어, 지원 형식 검사에 적합함.",
    "sys.stdout.reconfigure": "콘솔(터미널) 출력의 글자 인코딩을 바꾸는 기능. 윈도우에서 한글이 깨지지 않도록 UTF-8로 다시 설정함.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(OpenAI 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "RuntimeError": "'실행 중 문제가 생겼다'고 알리는 오류의 한 종류. 여기서는 API 키가 없을 때 일부러 발생시켜 원인을 알려줌.",
    "OpenAI 클라이언트": "OpenAI 서버와 통신하는 객체. client.audio.transcriptions.create(...)처럼 이 객체를 통해 API를 호출함.",
    "제너레이터 표현식": "( ... for x in ... if ... ) 형태로, 값을 미리 다 만들지 않고 필요할 때 하나씩 만들어내는 효율적인 문법. 여기서는 sorted()에 바로 넘겨 정렬함.",
    "sorted()": "목록을 정렬해 새 목록으로 돌려주는 함수. 여기서는 파일을 이름순으로 정렬함.",
    "suffix(확장자)": "Path 객체의 .suffix는 파일 확장자(예: '.mp3')를 줌. .lower()로 소문자로 맞춰 비교함.",
    "enumerate()": "목록을 돌면서 '번호와 값'을 함께 꺼내 주는 함수. start=1을 주면 1번부터 셈.",
    "input()": "콘솔(터미널)에서 사용자가 키보드로 입력한 한 줄을 글자로 받아오는 함수.",
    "int()": "글자(문자열)를 정수로 바꾸는 함수. 숫자로 바꿀 수 없으면 ValueError가 남.",
    "while 반복": "조건이 참인 동안 계속 도는 반복문. 여기서는 올바른 번호를 입력할 때까지 다시 묻는 데 씀.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "FileNotFoundError": "찾는 파일이 없을 때 나는 오류. 여기서는 오디오 파일이 없을 때 분명히 알려주려고 일부러 발생시킴.",
    "ValueError": "값이 잘못됐을 때 나는 오류. 여기서는 지원하지 않는 확장자일 때 발생시킴.",
    "with open(rb)": "with 블록으로 파일을 열면, 블록을 벗어날 때 파일이 자동으로 닫힘. 'rb'는 바이너리(글자가 아닌 원본 바이트)로 읽는다는 뜻으로, 오디오 같은 파일에 씀.",
    "Whisper": "OpenAI의 음성 인식(STT) 모델. 오디오를 글자로 받아쓰거나(전사) 영어로 번역할 수 있음.",
    "전사(transcription)": "말소리를 '같은 언어의 글자'로 받아쓰는 것. 한국어 오디오 → 한국어 텍스트.",
    "번역(translation)": "여기서는 Whisper가 오디오를 곧바로 '영어 텍스트'로 옮기는 것. 받아쓰기 후 번역하는 게 아니라 한 번에 처리.",
    "response_format": "API 응답을 어떤 형식으로 받을지 지정하는 옵션. 'json'으로 받아 .text로 결과 글자를 꺼냄.",
    "mkdir": "폴더를 만드는 명령. parents=True는 중간 폴더까지, exist_ok=True는 이미 있어도 오류 없이 넘어가게 함.",
    "write_text": "문자열을 파일에 통째로 쓰는 Path의 기능. encoding='utf-8'로 한글이 깨지지 않게 저장함.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 값이 글자에 끼워 들어가는 파이썬 문법.",
    "argparse": "'python 파일.py --옵션 값' 형태의 명령줄 입력을 정의하고 해석해 주는 파이썬 표준 도구.",
    "sys.stderr": "오류 메시지를 내보내는 통로(표준 에러). 일반 출력(stdout)과 구분해 오류만 따로 보낼 수 있음.",
    "raise SystemExit": "프로그램을 끝내면서 종료 코드를 운영체제에 알림. main()의 반환값(0=성공, 1=실패)을 종료 코드로 씀.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
    "타입 힌트": "변수·함수에 자료의 종류(str, Path, list 등)를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
  },
};
