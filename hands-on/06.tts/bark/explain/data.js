/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../06.tts/bark/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "Bark TTS — GPT-4o-mini 번역 + Bark 음성 합성 예제 설명",
    entry: "tts.py",
  },

  files: [
    { id: "main", label: "tts.py", role: "단일 파일 CLI 예제 · CSV 대화 번역 후 화자별 음성 합성" },
  ],

  flow: [
    { step: 1, title: "실행 시작", label: "실행 시작",
      summary: "python tts.py 실행 → main()이 진입점으로 호출됨",
      detail: "터미널(명령줄)에서 실행하면 파일 맨 아래 if __name__ == '__main__': 가 main()을 호출함. main()이 번역 → 음성 합성 전 과정을 순서대로 지휘함." },
    { step: 2, title: "디바이스 확인", label: "디바이스 확인", refs: ["check_device"],
      summary: "check_device()가 GPU(CUDA) 사용 가능 여부를 확인해 'cuda' 또는 'cpu'를 정함",
      detail: "AI 모델을 돌리려면 많은 계산이 필요함. GPU가 있으면 훨씬 빠르게 처리할 수 있어, 자동으로 GPU(cuda)를 우선 선택하고 없으면 CPU를 씀." },
    { step: 3, title: "API 키 로드", label: "API 키 로드", refs: ["load_api_key", "find_env_file"],
      summary: "load_api_key()가 .env 파일에서 OPENAI_API_KEY를 읽어 옴",
      detail: "OpenAI 서비스를 쓰려면 비밀 열쇠(API 키)가 필요함. 코드에 직접 쓰면 위험하므로 .env 파일에 따로 보관하고, load_dotenv로 읽어옴. 키가 없으면 즉시 오류를 내고 종료함." },
    { step: 4, title: "대화 CSV 로드", label: "대화 CSV 로드", refs: ["load_dialog"],
      summary: "load_dialog()가 dialog.csv를 읽어 대화 데이터와 화자 목록을 가져옴",
      detail: "번역·합성할 대화 원고를 파이프(|) 구분자 CSV 파일에서 읽어옴. speaker(화자)와 text(대사) 두 열이 필수임. 화자 목록도 이때 추출함." },
    { step: 5, title: "언어 선택", label: "언어 선택", refs: ["select_language"],
      summary: "select_language()가 지원 언어 목록을 보여주고 사용자가 번호로 선택함",
      detail: "영어·한국어·중국어 등 13개 언어 중 하나를 번호로 입력해 선택함. 선택한 언어 코드(예: 'en')와 이름(예: 'English')을 이후 번역·음성 합성에 씀." },
    { step: 6, title: "대화 번역", label: "대화 번역", refs: ["translate_dialogs", "load_translation_cache", "save_translation_cache"],
      summary: "translate_dialogs()가 GPT-4o-mini를 호출해 각 대사를 선택 언어로 번역함",
      detail: "이미 번역한 내용이 캐시(저장본)에 있으면 API를 다시 부르지 않고 재사용함. 없으면 GPT-4o-mini에 '전문 번역가처럼 번역해달라'는 지침과 함께 각 대사를 보냄. 번역 완료 후 캐시에 저장함." },
    { step: 7, title: "음성 프리셋 할당", label: "프리셋 할당", refs: ["assign_voices", "select_voice"],
      summary: "assign_voices()가 각 화자마다 Bark 음성 프리셋(번호 0~9)을 사용자에게 선택받음",
      detail: "Bark 모델은 '음성 프리셋'으로 목소리를 결정함. 화자별로 0~9번(0~4는 남성, 5~9는 여성 근사) 중 하나를 선택하면 'v2/en_speaker_3' 형식의 프리셋 문자열이 만들어짐." },
    { step: 8, title: "Bark 모델 로드", label: "모델 로드", refs: ["load_model"],
      summary: "load_model()이 HuggingFace에서 suno/bark 모델과 전처리기를 불러옴",
      detail: "처음 실행할 때는 인터넷에서 모델 파일을 다운로드하므로 시간이 걸림. 이후엔 캐시를 씀. GPU가 있으면 float16(절반 정밀도)으로 변환해 메모리를 절약하고 속도를 높임." },
    { step: 9, title: "음성 합성", label: "음성 합성", refs: ["generate_speech"],
      summary: "각 대사를 generate_speech()로 오디오 배열로 변환함",
      detail: "번역된 대사 하나하나를 Bark 모델에 넣어 음성 데이터(숫자 배열)로 바꿈. 화자별로 미리 선택한 음성 프리셋을 적용해, 같은 문장도 다른 목소리로 만들 수 있음." },
    { step: 10, title: "오디오 합치기 & 저장", label: "합치기·저장", refs: ["concatenate_audio"],
      summary: "concatenate_audio()로 대사들을 묵음 간격과 함께 이어 붙이고, WAV 파일로 저장함",
      detail: "여러 대사 오디오를 0.2초 묵음을 사이에 두고 하나의 긴 오디오로 연결함. 음량을 정규화하고 16-bit PCM 형식 WAV로 저장함. result.wav 파일이 완성물임." },
  ],

  functions: [
    // ===== tts.py (단일 파일) =====
    {
      id: "module_setup",
      name: "모듈 설정 (경로·상수)",
      fileId: "main",
      summary: "파일 맨 위에서 지원 언어 목록, 경로 상수 등 기본 설정값을 준비함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 준비하는 값들'임. SUPPORTED_LANGUAGES는 번호→(언어코드, 언어이름) 를 담은 딕셔너리로, 언어 선택 메뉴와 번역·음성 합성 모두에서 씀. SCRIPT_DIR은 이 파일이 있는 폴더의 절대경로를 자동 계산함.",
      terms: ["Path(__file__)", "딕셔너리(dict)", "warnings.filterwarnings"],
      lines: [
        { at: 'warnings.filterwarnings("ignore", message=".*attention.*mask.*")', text: "Bark 모델 실행 중 나오는 특정 경고 메시지를 화면에서 숨김. 동작에는 영향 없음." },
        { at: 'SUPPORTED_LANGUAGES = {', text: "번호(1~13)를 열쇠로, (언어코드, 언어이름) 쌍을 값으로 가지는 딕셔너리. 언어 선택 메뉴를 만들 때 씀." },
        { at: 'SCRIPT_DIR = Path(__file__).parent.resolve()', text: "Path(__file__)은 '이 파이썬 파일 자체'. .parent.resolve()로 이 파일이 있는 폴더의 절대경로를 구함. 어디서 실행해도 경로가 어긋나지 않음." },
        { at: 'TTS_ROOT   = SCRIPT_DIR.parent', text: "SCRIPT_DIR의 한 단계 위 폴더(hands-on/06.tts/)를 가리킴. dialog.csv를 찾을 때 씀." },
      ],
      code: `warnings.filterwarnings("ignore", message=".*attention.*mask.*")


SUPPORTED_LANGUAGES = {
    "1":  ("en", "English"),
    "2":  ("ko", "Korean"),
    "3":  ("zh", "Chinese"),
    "4":  ("ja", "Japanese"),
    "5":  ("de", "German"),
    "6":  ("fr", "French"),
    "7":  ("es", "Spanish"),
    "8":  ("it", "Italian"),
    "9":  ("pt", "Portuguese"),
    "10": ("pl", "Polish"),
    "11": ("ru", "Russian"),
    "12": ("hi", "Hindi"),
    "13": ("tr", "Turkish"),
}

# 이 파일이 위치한 디렉터리 경로를 구함
SCRIPT_DIR = Path(__file__).parent.resolve()   # hands-on/06.tts/bark/
TTS_ROOT   = SCRIPT_DIR.parent                  # hands-on/06.tts/`,
    },
    {
      id: "find_env_file",
      name: "find_env_file()",
      fileId: "main",
      summary: "상위 폴더를 거슬러 올라가며 .env 파일을 찾아 경로를 반환함.",
      how: "API 키가 든 .env 파일이 어느 폴더에 있는지 모를 때 자동으로 탐색함. 먼저 'agentic-ai/examples/.env' 위치를 시도하고, 없으면 '.env'만 있는 폴더를 찾아 올라감. 8번까지 상위 폴더를 탐색함.",
      terms: ["Path(__file__)", "for 반복", "타입 힌트"],
      lines: [
        { at: 'candidate = current / "agentic-ai" / "examples" / ".env"', text: "먼저 'agentic-ai/examples/.env' 경로를 확인함. /는 Path 객체에서 폴더를 이어붙이는 연산자임. 찾으면 즉시 반환함." },
        { at: 'candidate = current / ".env"', text: "두 번째 탐색: agentic-ai/.env를 못 찾으면 단순 .env 파일을 최대 8단계 상위 폴더에서 찾음." },
        { at: 'return SCRIPT_DIR / ".env"', text: "어디서도 .env를 찾지 못하면 이 파일과 같은 폴더의 .env를 기본값으로 반환함." },
      ],
      code: `def find_env_file() -> Path:
    """.env 파일을 상위 디렉터리로 거슬러 올라가며 탐색하여 경로를 반환함."""
    current = SCRIPT_DIR
    for _ in range(8):
        candidate = current / "agentic-ai" / "examples" / ".env"
        if candidate.exists():
            return candidate
        current = current.parent
    current = SCRIPT_DIR
    for _ in range(8):
        candidate = current / ".env"
        if candidate.exists():
            return candidate
        current = current.parent
    return SCRIPT_DIR / ".env"`,
    },
    {
      id: "get_paths",
      name: "get_input_path() / get_output_path() / get_cache_path()",
      fileId: "main",
      summary: "입력 CSV, 출력 WAV, 번역 캐시 CSV의 파일 경로를 각각 반환하는 경로 도우미 함수 세 개.",
      how: "경로를 한 곳에서 관리하면 나중에 바꾸기 쉬움. get_input_path()는 대화 원고 CSV, get_output_path()는 최종 WAV, get_cache_path()는 언어별 번역 캐시 CSV 경로를 돌려줌. 캐시 폴더는 없으면 자동 생성함.",
      terms: ["Path(__file__)", "mkdir", "타입 힌트"],
      lines: [
        { at: 'return TTS_ROOT / "text" / "dialog.csv"', text: "06.tts/text/dialog.csv — 번역할 대화 원고 파일 위치." },
        { at: 'return SCRIPT_DIR / "result.wav"', text: "bark/result.wav — 최종 음성 출력 파일 위치." },
        { at: 'cache_dir = SCRIPT_DIR / "translations"', text: "번역 캐시 파일들을 bark/translations/ 폴더에 언어 코드별로 보관함." },
        { at: 'cache_dir.mkdir(parents=True, exist_ok=True)', text: "translations 폴더가 없으면 만들어 둠. exist_ok=True: 이미 있어도 오류 없음." },
      ],
      code: `def get_input_path() -> Path:
    """대화 CSV 파일 경로를 반환함."""
    return TTS_ROOT / "text" / "dialog.csv"


def get_output_path() -> Path:
    """출력 WAV 파일 경로를 반환함."""
    return SCRIPT_DIR / "result.wav"


def get_cache_path(lang_code: str) -> Path:
    """언어 코드에 해당하는 번역 캐시 CSV 파일 경로를 반환함."""
    cache_dir = SCRIPT_DIR / "translations"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / f"dialog_{lang_code}.csv"`,
    },
    {
      id: "check_device",
      name: "check_device()",
      fileId: "main",
      summary: "GPU(CUDA)가 있으면 'cuda', 없으면 'cpu'를 반환해 AI 모델이 어디서 돌지 결정함.",
      how: "AI 모델(Bark)은 계산량이 많아 GPU에서 훨씬 빠르게 돌아감. torch.cuda.is_available()으로 GPU 사용 가능 여부를 자동으로 확인하고, 결과 문자열을 반환하면 이후 코드가 그 값을 model.to(device)에 사용함.",
      terms: ["PyTorch(torch)", "CUDA", "타입 힌트"],
      lines: [
        { at: 'if torch.cuda.is_available():', text: "PyTorch가 GPU(CUDA)를 인식하는지 확인함. True면 GPU 사용 가능." },
        { at: 'print(f"[INFO] GPU detected: {torch.cuda.get_device_name(0)}")', text: "GPU가 있으면 이름을 출력함(예: 'NVIDIA GeForce RTX 4080')." },
        { at: 'return "cpu"', text: "GPU가 없으면 CPU로 실행함. 속도는 느리지만 결과는 동일함." },
      ],
      code: `def check_device() -> str:
    """GPU(CUDA) 사용 가능 여부 확인. 불가능하면 CPU 사용."""
    if torch.cuda.is_available():
        print(f"[INFO] GPU detected: {torch.cuda.get_device_name(0)}")
        return "cuda"
    print("[INFO] No GPU detected, using CPU (slower)")
    return "cpu"`,
    },
    {
      id: "load_api_key",
      name: "load_api_key()",
      fileId: "main",
      summary: ".env 파일에서 OPENAI_API_KEY를 읽어 반환함. 없으면 오류 메시지 후 종료.",
      how: "API 키를 코드에 직접 쓰면 실수로 외부에 노출될 수 있음. .env 파일에 따로 보관하고 load_dotenv로 읽어옴. 키가 없으면 sys.exit(1)로 프로그램을 멈춰, 키 없이 API를 호출하는 더 이상한 오류를 방지함.",
      terms: ["load_dotenv", "환경변수(.env)", "API 키", "sys.exit"],
      lines: [
        { at: 'env_path = find_env_file()', text: "먼저 .env 파일 위치를 자동으로 찾음." },
        { at: 'load_dotenv(env_path)', text: ".env 파일의 KEY=값 들을 읽어 프로그램 환경변수로 올림." },
        { at: 'api_key = os.getenv("OPENAI_API_KEY")', text: "환경변수에서 OPENAI_API_KEY 값을 꺼냄. 없으면 None을 받음." },
        { at: 'if not api_key:', text: "키가 없으면(빈 값이면) 오류 메시지를 출력하고 sys.exit(1)으로 프로그램을 즉시 종료함." },
      ],
      code: `def load_api_key() -> str:
    """.env 파일에서 OPENAI_API_KEY를 로드하여 반환함. 없으면 프로세스 종료."""
    env_path = find_env_file()
    load_dotenv(env_path)
    # OPENAI_API_KEY: OpenAI API 인증에 사용하는 비밀 키
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print(f"[ERROR] OPENAI_API_KEY not found. Expected at: {env_path}")
        sys.exit(1)
    return api_key`,
    },
    {
      id: "select_language",
      name: "select_language()",
      fileId: "main",
      summary: "지원 언어 목록을 번호와 함께 출력하고, 사용자가 고른 (언어코드, 언어이름) 쌍을 반환함.",
      how: "SUPPORTED_LANGUAGES 딕셔너리를 순서대로 출력해 메뉴를 만들고, input()으로 번호를 입력받음. 잘못된 번호가 들어오면 다시 묻는 while 반복을 씀. 올바른 입력이 들어오면 언어코드·이름 쌍을 반환함.",
      terms: ["딕셔너리(dict)", "while 반복", "input()", "튜플(tuple)", "타입 힌트"],
      lines: [
        { at: 'for key, (code, name) in SUPPORTED_LANGUAGES.items():', text: "딕셔너리의 열쇠와 값(코드, 이름 쌍)을 동시에 꺼내 메뉴를 출력함." },
        { at: 'choice = input("Enter number (1-13): ").strip()', text: "사용자가 키보드로 번호를 입력하게 함. .strip()은 앞뒤 공백을 제거함." },
        { at: 'if choice in SUPPORTED_LANGUAGES:', text: "입력한 번호가 딕셔너리에 있는 유효한 열쇠인지 확인함." },
        { at: 'return code, name', text: "유효한 선택이면 언어코드와 언어이름 쌍을 돌려줌(예: 'en', 'English')." },
      ],
      code: `def select_language() -> tuple:
    """지원 언어 목록을 출력하고, 사용자가 선택한 (언어 코드, 언어 이름) 튜플을 반환함."""
    print("\\n" + "=" * 50)
    print("Select Target Language for Translation")
    print("=" * 50)
    for key, (code, name) in SUPPORTED_LANGUAGES.items():
        print(f"  {key:>2}. {name} ({code})")
    print("=" * 50)
    while True:
        choice = input("Enter number (1-13): ").strip()
        if choice in SUPPORTED_LANGUAGES:
            code, name = SUPPORTED_LANGUAGES[choice]
            print(f"[INFO] Selected: {name} ({code})")
            return code, name
        print("[ERROR] Invalid choice. Please try again.")`,
    },
    {
      id: "load_dialog",
      name: "load_dialog(input_path)",
      fileId: "main",
      summary: "파이프(|) 구분자 CSV를 읽어 대화 데이터(DataFrame)와 화자 목록을 반환함.",
      how: "대화 원고 CSV는 '화자|대사' 형식임. pandas의 read_csv로 읽고, speaker·text 열이 없으면 즉시 종료함. 화자 목록은 순서는 유지하되 중복 없이 추출함(seen 딕셔너리 활용).",
      terms: ["pandas(pd)", "DataFrame", "sep(구분자)", "딕셔너리(dict)", "타입 힌트"],
      lines: [
        { at: 'df = pd.read_csv(input_path, sep="|", encoding="utf-8")', text: "파이프(|)로 구분된 CSV를 읽어 DataFrame으로 만듦. encoding='utf-8'로 한글이 깨지지 않게 함." },
        { at: 'for col in ("speaker", "text"):', text: "speaker, text 두 열이 모두 있는지 확인함. 없으면 오류를 내고 종료함." },
        { at: 'seen: dict = {}', text: "seen 딕셔너리는 화자 이름을 순서 있게, 중복 없이 모으는 데 씀. 파이썬 3.7+ 딕셔너리는 삽입 순서를 유지함." },
        { at: 'speakers = list(seen.keys())', text: "딕셔너리 열쇠(화자 이름들)를 목록으로 만들어 반환함." },
      ],
      code: `def load_dialog(input_path: Path) -> tuple:
    """파이프(|) 구분자 CSV에서 대화 데이터를 로드하고, (DataFrame, 화자 목록) 튜플을 반환함."""
    if not input_path.exists():
        print(f"[ERROR] Input file not found: {input_path}")
        sys.exit(1)
    df = pd.read_csv(input_path, sep="|", encoding="utf-8")
    for col in ("speaker", "text"):
        if col not in df.columns:
            print(f"[ERROR] CSV must contain '{col}' column")
            sys.exit(1)
    seen: dict = {}
    for s in df["speaker"]:
        seen[str(s)] = None
    speakers = list(seen.keys())
    print(f"[INFO] Found {len(df)} dialog(s) with {len(speakers)} speaker(s): {speakers}")
    return df, speakers`,
    },
    {
      id: "load_translation_cache",
      name: "load_translation_cache(lang_code)",
      fileId: "main",
      summary: "이전에 저장한 번역 캐시 CSV를 읽어 {원문: 번역문} 딕셔너리로 반환함.",
      how: "같은 대사를 매번 API로 번역하면 비용이 듦. 이전 번역 결과를 CSV로 저장해두고, 다음 실행 시 재사용함. 캐시 파일이 없거나 읽기 실패 시 빈 딕셔너리를 반환해 안전하게 동작함.",
      terms: ["pandas(pd)", "DataFrame", "딕셔너리(dict)", "예외 처리(try/except)", "타입 힌트"],
      lines: [
        { at: 'if not cache_path.exists():', text: "캐시 파일이 없으면 빈 딕셔너리를 반환함. 처음 실행 시 정상적인 상태." },
        { at: 'return df.set_index("text")["translated_text"].to_dict()', text: "text 열을 인덱스로 설정하고 translated_text 열과 연결해 {원문: 번역문} 딕셔너리로 변환함." },
        { at: 'except Exception as e:', text: "캐시 파일이 손상됐거나 읽기 실패해도 프로그램이 멈추지 않고 빈 딕셔너리로 대신함." },
      ],
      code: `def load_translation_cache(lang_code: str) -> dict:
    """이전에 저장한 번역 캐시 CSV를 불러와 {원문: 번역문} 딕셔너리로 반환함."""
    cache_path = get_cache_path(lang_code)
    if not cache_path.exists():
        return {}
    try:
        df = pd.read_csv(cache_path, sep="|", encoding="utf-8")
        if "translated_text" not in df.columns:
            return {}
        print(f"[INFO] Translation cache found: {cache_path.name}")
        return df.set_index("text")["translated_text"].to_dict()
    except Exception as e:
        print(f"[WARNING] Failed to load translation cache: {e}")
        return {}`,
    },
    {
      id: "save_translation_cache",
      name: "save_translation_cache(df_translated, lang_code)",
      fileId: "main",
      summary: "번역 결과 DataFrame을 언어별 캐시 CSV 파일로 저장함.",
      how: "번역 완료 후 결과를 파일로 남겨두면, 다음 실행 시 같은 텍스트를 재번역하지 않아도 됨. 저장 실패해도 경고만 출력하고 프로그램을 멈추지 않음.",
      terms: ["pandas(pd)", "DataFrame", "예외 처리(try/except)", "타입 힌트"],
      lines: [
        { at: 'df_translated.to_csv(cache_path, sep="|", index=False, encoding="utf-8")', text: "DataFrame을 파이프(|) 구분자 CSV로 저장함. index=False는 행 번호 열을 빼고 저장하는 옵션." },
        { at: 'except Exception as e:', text: "저장 실패해도 경고 메시지만 출력하고 계속 진행함. 캐시 저장 실패가 전체 작업을 막으면 안 되기 때문." },
      ],
      code: `def save_translation_cache(df_translated: pd.DataFrame, lang_code: str) -> None:
    """번역 결과 DataFrame을 캐시 CSV 파일로 저장함."""
    cache_path = get_cache_path(lang_code)
    try:
        df_translated.to_csv(cache_path, sep="|", index=False, encoding="utf-8")
        print(f"[INFO] Translation saved to cache: {cache_path.name}")
    except Exception as e:
        print(f"[WARNING] Failed to save translation cache: {e}")`,
    },
    {
      id: "translate_dialogs",
      name: "translate_dialogs(client, df, lang_name, lang_code)",
      fileId: "main",
      summary: "GPT-4o-mini를 호출해 대화 CSV의 각 대사를 지정 언어로 번역하고, 번역 열이 추가된 DataFrame을 반환함.",
      how: "캐시에 이미 번역된 대사는 API를 다시 부르지 않고 재사용함. 없는 대사만 GPT-4o-mini에 '전문 번역가처럼 번역만 해달라'는 시스템 지침과 함께 보냄. tqdm이 진행 상황을 프로그레스 바로 보여줌. 번역 실패 시 원문을 그대로 씀.",
      terms: ["pandas(pd)", "DataFrame", "tqdm(진행 바)", "temperature", "예외 처리(try/except)", "타입 힌트"],
      lines: [
        { at: 'cache = load_translation_cache(lang_code)', text: "먼저 이전 번역 캐시를 불러옴. 이미 번역된 것은 API를 호출하지 않아 비용을 아낌." },
        { at: 'for text in tqdm(texts, desc="Translating"):', text: "tqdm은 반복 중 진행률을 '████░░░ 60%' 형태의 프로그레스 바로 보여줌. desc는 바 앞에 붙는 이름." },
        { at: 'if text in cache:', text: "이미 번역된 텍스트면 캐시에서 바로 꺼내 씀(API 호출 없음)." },
        { at: 'model="gpt-4o-mini"', text: "번역에는 비용이 저렴하고 빠른 gpt-4o-mini 모델을 씀." },
        { at: 'result = (response.choices[0].message.content or text).strip()', text: "번역 결과를 꺼냄. 결과가 비어 있으면 원문을 그대로 씀(or text 안전장치)." },
        { at: 'df_out["translated_text"] = translated', text: "원본 DataFrame 복사본에 번역 결과 열을 추가해 반환함." },
      ],
      code: `def translate_dialogs(
    client: OpenAI,
    df: pd.DataFrame,
    lang_name: str,
    lang_code: str,
) -> pd.DataFrame:
    """GPT-4o-mini를 사용해 대화 텍스트를 지정 언어로 번역하고, 번역 열이 추가된 DataFrame을 반환함."""
    cache = load_translation_cache(lang_code)
    texts = df["text"].astype(str).tolist()
    translated = []
    new_count = 0

    print(f"\\n[INFO] Translating to {lang_name} ({len(texts)} lines)...")
    # tqdm: 반복 작업의 진행률을 프로그레스 바로 표시함
    for text in tqdm(texts, desc="Translating"):
        text = text.strip()
        if text in cache:
            translated.append(cache[text])
            continue
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            f"You are a professional translator. "
                            f"Translate the given text to {lang_name}. "
                            f"Output only the translated text, nothing else."
                        ),
                    },
                    {"role": "user", "content": text},
                ],
                temperature=0.3,
                max_tokens=1000,
            )
            result = (response.choices[0].message.content or text).strip()
            cache[text] = result
            translated.append(result)
            new_count += 1
        except Exception as e:
            print(f"\\n[WARNING] Translation failed ('{text[:30]}'): {e}")
            translated.append(text)

    if new_count > 0:
        print(f"[INFO] {new_count} new translation(s) completed")

    df_out = df.copy()
    df_out["translated_text"] = translated
    return df_out`,
    },
    {
      id: "select_voice",
      name: "select_voice(speaker, lang_code)",
      fileId: "main",
      summary: "화자 이름과 언어 코드를 받아 사용자가 선택한 Bark 음성 프리셋 문자열을 반환함.",
      how: "Bark 모델은 'v2/en_speaker_3' 형식의 '음성 프리셋' 문자열로 목소리를 결정함. 0~4번은 남성, 5~9번은 여성(근사치). 사용자가 번호를 고르면 언어코드와 조합해 프리셋 문자열을 만들어 반환함.",
      terms: ["while 반복", "input()", "f-string", "isdigit()"],
      lines: [
        { at: 'for i in range(10):', text: "0~9번 화자 프리셋 목록을 출력함. 0~4는 남성, 5~9는 여성(근사치)으로 표시." },
        { at: 'if choice.isdigit() and 0 <= int(choice) <= 9:', text: "입력이 숫자이고 0~9 범위인지 확인함. isdigit()은 '모든 글자가 숫자인가?'를 True/False로 답함." },
        { at: 'preset = f"v2/{lang_code}_speaker_{choice}"', text: "언어코드와 번호를 조합해 Bark 프리셋 문자열을 만듦. 예: 'v2/en_speaker_3'." },
      ],
      code: `def select_voice(speaker: str, lang_code: str) -> str:
    """화자 이름과 언어 코드를 받아 사용자가 선택한 Bark 음성 프리셋 문자열을 반환함."""
    print(f"\\n--- Speaker: {speaker} ---")
    print("=" * 50)
    print(f"Select Voice Preset (Language: {lang_code})")
    print("=" * 50)
    for i in range(10):
        gender = "Male" if i < 5 else "Female"
        print(f"  {i}. Speaker {i} ({gender} - approximate)")
    print("=" * 50)
    while True:
        choice = input("Enter number (0-9): ").strip()
        if choice.isdigit() and 0 <= int(choice) <= 9:
            preset = f"v2/{lang_code}_speaker_{choice}"
            print(f"[INFO] Selected: {preset}")
            return preset
        print("[ERROR] Invalid choice. Please try again.")`,
    },
    {
      id: "assign_voices",
      name: "assign_voices(speakers, lang_code)",
      fileId: "main",
      summary: "각 화자에 대해 음성 프리셋을 선택받아 {화자명: 프리셋} 딕셔너리로 반환함.",
      how: "화자가 여러 명일 때 한 번에 모두 선택받기 위한 함수임. 딕셔너리 컴프리헨션으로 화자 목록을 순회하면서 각자 select_voice()를 호출해 프리셋을 모음.",
      terms: ["딕셔너리(dict)", "딕셔너리 컴프리헨션", "타입 힌트"],
      lines: [
        { at: 'voices = {speaker: select_voice(speaker, lang_code) for speaker in speakers}', text: "딕셔너리 컴프리헨션: {화자명: 프리셋} 딕셔너리를 한 줄로 만듦. 화자마다 select_voice()를 호출해 사용자에게 선택받음." },
        { at: 'for speaker, preset in voices.items():', text: "선택 완료 후 모든 화자→프리셋 배정을 요약해 출력함." },
      ],
      code: `def assign_voices(speakers: list, lang_code: str) -> dict:
    """각 화자에 대해 음성 프리셋을 선택받아 {화자명: 프리셋} 딕셔너리로 반환함."""
    print("\\n" + "=" * 50)
    print("Assign Voice to Each Speaker")
    print("=" * 50)
    voices = {speaker: select_voice(speaker, lang_code) for speaker in speakers}
    print("\\n[INFO] Voice assignments:")
    for speaker, preset in voices.items():
        print(f"  {speaker} -> {preset}")
    return voices`,
    },
    {
      id: "load_model",
      name: "load_model(device)",
      fileId: "main",
      summary: "HuggingFace에서 suno/bark 모델과 전처리기(AutoProcessor)를 불러와 지정 디바이스에 올림.",
      how: "AutoProcessor는 텍스트를 Bark 모델이 이해하는 형식으로 바꾸는 전처리기, BarkModel은 그 입력을 오디오로 변환하는 AI 모델임. 처음엔 인터넷에서 다운로드가 필요하고 이후엔 로컬 캐시를 씀. GPU면 float16으로 변환해 메모리와 속도를 최적화함.",
      terms: ["AutoProcessor", "BarkModel", "HuggingFace Transformers", "PyTorch(torch)", "CUDA", "float16", "타입 힌트"],
      lines: [
        { at: 'processor = AutoProcessor.from_pretrained("suno/bark")', text: "HuggingFace Hub에서 'suno/bark' 전처리기를 불러옴. 처음엔 다운로드, 이후엔 로컬 캐시 사용." },
        { at: 'model = BarkModel.from_pretrained("suno/bark")', text: "Bark TTS 모델 자체를 불러옴. 텍스트+프리셋 → 오디오 배열을 만드는 AI 모델." },
        { at: 'model = model.to(device)', text: "모델을 GPU('cuda') 또는 CPU('cpu')로 이동함. 계산이 지정한 디바이스에서 수행됨." },
        { at: 'model = model.to(torch.float16)', text: "GPU가 있으면 모델 정밀도를 float16(절반 정밀도)으로 낮춤. 메모리 사용량이 절반으로 줄고 속도가 빨라짐." },
      ],
      code: `def load_model(device: str) -> tuple:
    """HuggingFace에서 suno/bark 모델과 프로세서를 로드하여 (processor, model) 튜플을 반환함."""
    print("\\n[INFO] Loading Bark model (first run may take a while)...")
    # AutoProcessor: 텍스트를 Bark 모델 입력 형식으로 변환하는 전처리기
    processor = AutoProcessor.from_pretrained("suno/bark")
    # BarkModel: 텍스트를 오디오로 변환하는 Bark TTS 모델 (suno/bark)
    model = BarkModel.from_pretrained("suno/bark")
    model = model.to(device)
    if device == "cuda":
        model = model.to(torch.float16)
    print("[INFO] Model loaded successfully")
    return processor, model`,
    },
    {
      id: "generate_speech",
      name: "generate_speech(processor, model, text, voice_preset, device)",
      fileId: "main",
      summary: "텍스트와 음성 프리셋으로 Bark 모델에서 오디오 숫자 배열을 생성해 반환함.",
      how: "텍스트→오디오 변환의 핵심 함수임. processor가 텍스트를 모델 입력 형식으로 바꾸고, model.generate()가 실제 음성 데이터를 생성함. torch.no_grad()는 '이 블록 안에서는 학습을 하지 말고 추론(생성)만 해라'는 뜻으로, 메모리를 아낌.",
      terms: ["AutoProcessor", "BarkModel", "PyTorch(torch)", "numpy(np)", "torch.no_grad()", "do_sample", "타입 힌트"],
      lines: [
        { at: 'inputs = processor(text, voice_preset=voice_preset, return_tensors="pt")', text: "전처리기가 텍스트와 음성 프리셋을 PyTorch 텐서(pt) 형식으로 변환함. 이게 모델의 입력이 됨." },
        { at: 'inputs = {k: v.to(device) for k, v in inputs.items()}', text: "딕셔너리 컴프리헨션으로 모든 입력 텐서를 GPU/CPU로 이동함." },
        { at: 'with torch.no_grad():', text: "이 블록 안에서는 기울기 계산(학습용)을 끔. 메모리를 아끼고 추론 속도를 높임." },
        { at: 'audio_array = model.generate(**inputs, do_sample=True)', text: "★핵심★ 모델이 입력을 받아 오디오 데이터를 생성함. do_sample=True는 '약간 무작위성을 넣어 자연스럽게'라는 뜻." },
        { at: 'return audio_array.cpu().numpy().squeeze()', text: ".cpu()로 CPU로 옮기고, .numpy()로 파이썬 배열로 변환, .squeeze()로 불필요한 차원을 제거함." },
      ],
      code: `def generate_speech(
    processor: AutoProcessor,
    model: BarkModel,
    text: str,
    voice_preset: str,
    device: str,
) -> np.ndarray:
    """텍스트와 음성 프리셋으로 Bark 모델에서 오디오 배열을 생성하여 반환함."""
    inputs = processor(text, voice_preset=voice_preset, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}
    with torch.no_grad():
        audio_array = model.generate(**inputs, do_sample=True)
    return audio_array.cpu().numpy().squeeze()`,
    },
    {
      id: "concatenate_audio",
      name: "concatenate_audio(segments, sample_rate, silence_duration)",
      fileId: "main",
      summary: "여러 오디오 세그먼트 사이에 묵음을 끼워 넣고 하나의 배열로 연결함.",
      how: "대사 하나하나가 오디오 조각(세그먼트)임. 이것들을 이어 붙일 때 사이에 짧은 묵음(기본 0.2초)을 넣으면 더 자연스럽게 들림. numpy의 concatenate가 여러 배열을 하나로 합침.",
      terms: ["numpy(np)", "np.zeros", "np.concatenate", "sample_rate(샘플레이트)", "타입 힌트"],
      lines: [
        { at: 'silence = np.zeros(int(silence_duration * sample_rate), dtype=np.float32)', text: "묵음 데이터를 만듦. 0.2초 × 24000Hz = 4800개의 0으로 채운 배열임." },
        { at: 'for i, seg in enumerate(segments):', text: "각 오디오 조각을 순서대로 꺼내 parts 목록에 넣음." },
        { at: 'if i < len(segments) - 1:', text: "마지막 조각이 아닐 때만 묵음을 추가함(마지막 조각 뒤엔 묵음 불필요)." },
        { at: 'return np.concatenate(parts)', text: "parts 목록의 모든 배열(오디오 조각 + 묵음)을 순서대로 이어 하나의 긴 배열로 합침." },
      ],
      code: `def concatenate_audio(segments: list, sample_rate: int, silence_duration: float = 0.2) -> np.ndarray:
    """오디오 세그먼트 목록 사이에 묵음을 삽입하여 하나의 배열로 연결함."""
    silence = np.zeros(int(silence_duration * sample_rate), dtype=np.float32)
    parts = []
    for i, seg in enumerate(segments):
        parts.append(seg)
        if i < len(segments) - 1:
            parts.append(silence)
    return np.concatenate(parts)`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "번역 + Bark TTS 음성 합성 전체 파이프라인을 순서대로 실행하는 진입점.",
      how: "모든 단계를 지휘하는 함수임. 디바이스 확인→API 키→CSV 로드→언어 선택→번역(캐시 우선)→음성 프리셋 배정→모델 로드→대사별 음성 생성→오디오 합치기→정규화→WAV 저장 순서로 진행함. 오류가 나면 오류 메시지와 함께 종료함.",
      terms: ["pandas(pd)", "tqdm(진행 바)", "numpy(np)", "scipy.io.wavfile", "예외 처리(try/except)", "정규화(normalize)", "if __name__"],
      lines: [
        { at: 'if all(t.strip() in cache for t in texts):', text: "모든 대사가 캐시에 이미 있으면 API를 전혀 부르지 않고 캐시만 씀. all()은 '모두 참인가?'를 확인함." },
        { at: 'for _, row in tqdm(df_translated.iterrows(), total=len(df_translated), desc="Processing"):', text: "DataFrame을 한 행씩 꺼내면서 tqdm으로 진행률을 보여줌. _는 행 번호(안 씀), row는 한 줄 데이터." },
        { at: 'sample_rate = 24000', text: "Bark 모델의 샘플레이트(1초당 오디오 샘플 수). 24000Hz가 고정값임." },
        { at: 'max_val = np.max(np.abs(final_audio))', text: "오디오 최대 절댓값을 구함. 이 값으로 나누면 음량이 -1~1 범위로 정규화됨(너무 크거나 작은 소리 방지)." },
        { at: 'final_audio = (final_audio * 32767).astype(np.int16)', text: "정규화된 오디오(-1~1)를 16-bit 정수(-32768~32767) 범위로 변환함. WAV 파일의 표준 형식임." },
        { at: 'wavfile.write(str(output_path), sample_rate, final_audio)', text: "scipy의 wavfile.write로 최종 오디오를 WAV 파일로 저장함." },
      ],
      code: `def main():
    """번역 및 Bark TTS 음성 합성 전체 파이프라인을 실행함."""
    print("=" * 60)
    print("  Bark TTS - Text to Speech Generator with Translation")
    print("  (suno/bark + GPT-4o-mini translation)")
    print("=" * 60)

    device = check_device()

    input_path  = get_input_path()
    output_path = get_output_path()
    print(f"\\n[INFO] Input : {input_path}")
    print(f"[INFO] Output: {output_path}")

    api_key = load_api_key()
    client  = OpenAI(api_key=api_key)
    print("[INFO] OpenAI API connected for translation")

    df, speakers = load_dialog(input_path)

    lang_code, lang_name = select_language()

    # 캐시에 전체 번역이 있으면 API 호출 없이 재사용
    cache = load_translation_cache(lang_code)
    texts = df["text"].astype(str).tolist()

    if all(t.strip() in cache for t in texts):
        print(f"[INFO] Using cached translation for {lang_name}")
        df_translated = df.copy()
        df_translated["translated_text"] = [cache[t.strip()] for t in texts]
    else:
        df_translated = translate_dialogs(client, df, lang_name, lang_code)
        save_translation_cache(df_translated, lang_code)

    speaker_voices = assign_voices(speakers, lang_code)

    processor, model = load_model(device)
    # Bark 모델 샘플레이트: AttributeError 방지를 위해 하드코딩
    sample_rate = 24000

    print("\\n[INFO] Generating speech...")
    audio_segments = []

    for _, row in tqdm(df_translated.iterrows(), total=len(df_translated), desc="Processing"):
        speaker = str(row["speaker"])
        text    = str(row["translated_text"]).strip()
        if not text:
            continue
        try:
            audio = generate_speech(processor, model, text, speaker_voices[speaker], device)
            audio_segments.append(audio)
        except Exception as e:
            print(f"\\n[WARNING] Speech generation failed: {e}")

    if not audio_segments:
        print("[ERROR] No audio segments generated")
        sys.exit(1)

    print("\\n[INFO] Concatenating audio segments...")
    final_audio = concatenate_audio(audio_segments, sample_rate, silence_duration=0.2)

    # 오디오 최댓값으로 정규화한 뒤 16-bit 정수형으로 변환
    max_val = np.max(np.abs(final_audio))
    if max_val > 0:
        final_audio = final_audio / max_val
    final_audio = (final_audio * 32767).astype(np.int16)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    # 오디오 데이터를 16-bit PCM WAV 파일로 저장함
    wavfile.write(str(output_path), sample_rate, final_audio)

    print("\\n" + "=" * 60)
    print("[SUCCESS]")
    print("=" * 60)
    print(f"  Output file : {output_path}")
    print(f"  Duration    : {len(final_audio) / sample_rate:.2f} sec")
    print(f"  Sample rate : {sample_rate} Hz")
    print(f"  Language    : {lang_name} ({lang_code})")
    print("=" * 60)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()`,
    },
  ],

  glossary: {
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일 자체'를 가리킴. .parent.resolve()를 붙이면 이 파일이 있는 폴더의 절대경로를 구함. 어디서 실행해도 경로가 어긋나지 않음.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"en\": \"English\"}처럼 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    "딕셔너리 컴프리헨션": "{키: 값 for 항목 in 목록} 형태로, 반복문을 한 줄로 짧게 써서 새 딕셔너리를 만드는 파이썬 문법.",
    "warnings.filterwarnings": "특정 경고 메시지를 화면에 표시하지 않도록 필터링하는 함수. 동작에는 영향 없이 불필요한 경고만 숨김.",
    "for 반복": "for 변수 in 범위: 형태로, 범위 안의 항목을 하나씩 꺼내 반복 실행하는 구문.",
    "타입 힌트": "변수나 함수에 '이건 문자열(str)이야, 결과는 튜플(tuple)이야'처럼 자료의 종류를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "PyTorch(torch)": "딥러닝(AI) 모델을 만들고 실행하는 파이썬 라이브러리. GPU 가속 계산을 지원하며, Bark 모델이 내부적으로 사용함.",
    "CUDA": "NVIDIA GPU에서 병렬 계산을 할 수 있게 해주는 기술. AI 모델을 GPU에서 돌리면 CPU보다 훨씬 빠름.",
    "float16": "숫자를 16비트(절반 정밀도)로 저장하는 방식. 기본(float32, 32비트)보다 메모리를 절반 차지하고 GPU에서 빠르게 계산됨. AI 추론에 주로 씀.",
    "AutoProcessor": "HuggingFace Transformers 라이브러리의 전처리기. 텍스트·오디오 등을 AI 모델이 이해하는 숫자 텐서 형식으로 변환함.",
    "BarkModel": "suno가 만든 Bark TTS 모델을 HuggingFace Transformers로 감싼 클래스. 텍스트와 음성 프리셋을 입력받아 오디오 데이터를 생성함.",
    "HuggingFace Transformers": "수천 개의 AI 모델을 쉽게 불러쓸 수 있는 파이썬 라이브러리. from_pretrained('모델이름')으로 인터넷에서 모델을 자동으로 내려받아 씀.",
    "torch.no_grad()": "'기울기(gradient) 계산을 하지 마라'는 지시. AI 모델을 학습시킬 때는 기울기가 필요하지만, 단순 사용(추론)할 때는 필요 없어 메모리와 속도를 아낌.",
    "do_sample": "모델이 결과를 생성할 때 약간의 무작위성을 넣는 옵션. True면 매번 조금씩 다른 목소리가 나와 더 자연스럽게 들림.",
    "numpy(np)": "숫자 배열을 빠르게 처리하는 파이썬 라이브러리. 오디오 데이터는 숫자 배열로 표현되므로 numpy로 다룸.",
    "np.zeros": "0으로 채운 숫자 배열을 만드는 numpy 함수. 여기서는 묵음(소리가 없는) 오디오 데이터를 만드는 데 씀.",
    "np.concatenate": "여러 numpy 배열을 순서대로 이어 하나의 긴 배열로 합치는 함수. 오디오 조각들을 하나의 긴 오디오로 연결할 때 씀.",
    "sample_rate(샘플레이트)": "1초당 오디오 샘플(숫자) 개수. 24000Hz면 1초에 24,000개의 숫자로 소리를 표현함. 높을수록 음질이 좋음.",
    "scipy.io.wavfile": "WAV 오디오 파일을 읽고 쓰는 scipy 라이브러리의 모듈. wavfile.write(경로, 샘플레이트, 배열)로 오디오 데이터를 WAV 파일로 저장함.",
    "정규화(normalize)": "오디오 데이터의 최대 음량을 일정한 기준값으로 맞추는 작업. 너무 크거나 작은 소리를 표준 범위(-1~1)로 조정함.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. .env 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(OpenAI 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "sys.exit": "프로그램을 즉시 종료하는 함수. sys.exit(1)은 '오류로 인한 종료'를, sys.exit(0)은 '정상 종료'를 운영체제에 알림.",
    "pandas(pd)": "표(행·열) 형태의 데이터를 다루는 파이썬 라이브러리. CSV 파일을 읽거나 데이터를 정리할 때 씀.",
    "DataFrame": "pandas의 핵심 자료 구조. 엑셀 시트처럼 행과 열로 구성된 표 형태의 데이터를 담음.",
    "sep(구분자)": "CSV 파일에서 각 열을 나누는 기호. 기본은 쉼표(,)지만 이 예제에서는 파이프(|)를 씀.",
    "튜플(tuple)": "여러 값을 순서대로 묶은 자료 구조. ()로 표현하며, 목록(list)과 달리 한 번 만들면 바꿀 수 없음. 여기서는 (언어코드, 언어이름) 쌍을 반환할 때 씀.",
    "tqdm(진행 바)": "반복 작업의 진행 상황을 '████░░░ 60% | 6/10' 형태의 바로 보여주는 라이브러리. 오래 걸리는 작업의 진행률을 시각적으로 확인할 수 있음.",
    "temperature": "AI 답변의 '창의성/무작위성' 정도(0~1). 0에 가까울수록 매번 비슷하고 일관된 결과를, 높을수록 다양한 결과를 냄. 번역에는 0.3처럼 낮은 값을 씀.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "while 반복": "조건이 참인 동안 계속 도는 반복문. 여기서는 올바른 번호를 입력할 때까지 다시 묻는 데 씀.",
    "input()": "콘솔(터미널)에서 사용자가 키보드로 입력한 한 줄을 글자로 받아오는 함수.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
    "isdigit()": "문자열의 모든 글자가 숫자인지 True/False로 알려주는 함수. '3'.isdigit()은 True, 'a3'은 False.",
    "mkdir": "폴더를 만드는 명령. parents=True는 중간 폴더까지, exist_ok=True는 이미 있어도 오류 없이 넘어가게 함.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함. 다른 파일이 import할 때는 실행 안 됨.",
  },
};
