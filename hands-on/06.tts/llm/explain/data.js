/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../06.tts/llm/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "LLM TTS — OpenAI 번역·음성 합성 예제 설명",
    entry: "tts.py",
  },

  files: [
    { id: "main", label: "tts.py", role: "단일 파일 CLI 예제 · 번역 + TTS 음성 합성 파이프라인" },
  ],

  flow: [
    { step: 1, title: "실행 시작",
      summary: "python tts.py 실행 → main()이 파이프라인 전체를 지휘함",
      detail: "이 예제는 웹이 아니라 '명령줄 프로그램'임. 터미널에서 실행하면 맨 아래 if __name__ == '__main__': 가 main()을 호출함. main()이 번역→음성합성→저장 전 과정을 순서대로 실행함." },
    { step: 2, title: "환경 변수 로드",
      summary: "load_env()가 .env 파일에서 OpenAI API 키를 읽어옴",
      detail: "API 키처럼 비밀 값은 코드에 직접 쓰지 않고 .env 파일에 보관함. find_env_file()이 상위 폴더를 거슬러 올라가며 .env를 찾고, load_dotenv()로 키를 환경변수로 올린 뒤 반환함. 키가 없으면 즉시 멈추고 위치를 알려줌." },
    { step: 3, title: "언어 선택",
      summary: "select_language()가 번역 대상 언어를 사용자에게 번호로 선택받음",
      detail: "식당에서 메뉴를 고르는 단계와 비슷함. 한국어·영어·중국어·일어·불어·스페인어 중 하나를 선택하면, 해당 언어 코드(ko/en/zh 등)와 이름을 튜플로 반환함. 한국어(원본)를 고르면 번역 단계를 건너뜀." },
    { step: 4, title: "대화 파일 로드",
      summary: "load_dialog()가 dialog.csv를 읽어 화자·대사 목록을 준비함",
      detail: "CSV 파일(|로 구분된 표)에서 speaker(화자)와 text(대사) 두 열을 읽어 DataFrame(표 형식)으로 가져옴. 파일이 없거나 필수 열이 빠지면 즉시 멈춤." },
    { step: 5, title: "화자별 음성 선택",
      summary: "get_speakers()로 등장인물을 파악하고 각각 음성을 선택받음",
      detail: "대본에 등장하는 화자(A, B 등)를 순서대로 뽑아냄. 각 화자마다 select_voice()를 호출해 alloy·echo·fable·onyx·nova·shimmer 6종 OpenAI 음성 중 하나를 사용자가 선택하도록 함." },
    { step: 6, title: "번역",
      summary: "translate_text()가 GPT-4o-mini로 대사를 선택 언어로 번역하고 캐시에 저장함",
      detail: "한국어를 선택했으면 번역 없이 원문을 그대로 씀. 다른 언어면 GPT-4o-mini에게 번역을 요청함. 이미 번역한 문장은 캐시(CSV 파일)에 저장해 두어 다음번 실행 시 API 호출 없이 재사용함. 진행률은 tqdm 프로그레스 바로 표시함." },
    { step: 7, title: "TTS 음성 합성",
      summary: "generate_tts()로 각 대사를 WAV 음성 바이트로 변환함",
      detail: "번역된 각 대사를 OpenAI TTS-1 모델에 보내 음성을 받아옴. 응답은 WAV 바이트(mp3가 아닌 원시 오디오)이고, wav_bytes_to_array()로 numpy 배열로 변환함. 빈 대사는 건너뜀." },
    { step: 8, title: "세그먼트 연결·저장",
      summary: "concatenate_segments()로 묵음을 삽입하며 이어붙이고 result.wav로 저장함",
      detail: "각 대사 음성 조각(세그먼트) 사이에 0.3초 묵음을 삽입해 자연스럽게 연결함. 마지막으로 scipy.wavfile.write()로 16-bit PCM WAV 파일로 저장하고 재생시간·샘플레이트를 출력함." },
  ],

  functions: [
    // ===== 경로 유틸리티 =====
    {
      id: "find_env_file",
      name: "find_env_file()",
      fileId: "main",
      summary: ".env 파일을 상위 폴더를 거슬러 올라가며 찾아 경로를 반환함.",
      how: "API 키는 공용 .env 파일에 보관함. 이 함수는 먼저 'agentic-ai/examples/.env' 경로를 시도하고, 없으면 단순 '.env'를 상위 최대 6단계까지 탐색함. 모두 없으면 현재 디렉터리 경로를 반환해 명확한 오류가 나도록 함.",
      terms: ["Path(__file__)", "for _ in range(n)", "candidate.exists()"],
      lines: [
        { at: '# agentic-ai/ 디렉터리가 있는 workspace 루트를 찾아 상위로 이동', text: "탐색 시작점을 이 파일이 있는 폴더(SCRIPT_DIR)로 설정함." },
        { at: 'candidate = current / "agentic-ai" / "examples" / ".env"', text: "공용 .env 경로 후보를 만듦. Path의 / 연산자는 폴더 경로를 이어붙임." },
        { at: 'current / "agentic-ai" / "examples" / ".env"', text: "공용 .env 경로 후보를 만들고, 있으면 바로 반환함. Path의 / 연산자는 폴더 경로를 이어붙임." },
        { at: '# 폴백: 상위 디렉터리에서 .env 파일 탐색', text: "없으면 단순 .env 파일을 찾는 두 번째 탐색으로 넘어감." },
        { at: 'return SCRIPT_DIR / ".env"', text: "6번 모두 탐색해도 없으면 현재 폴더 경로를 반환해, 이후 load_dotenv에서 명확한 오류가 나게 함." },
      ],
      code:
`def find_env_file() -> Path:
    """.env 파일을 workspace 루트까지 거슬러 올라가며 탐색하여 경로를 반환함."""
    # agentic-ai/ 디렉터리가 있는 workspace 루트를 찾아 상위로 이동
    current = SCRIPT_DIR
    for _ in range(6):
        candidate = current / "agentic-ai" / "examples" / ".env"
        if candidate.exists():
            return candidate
        current = current.parent
    # 폴백: 상위 디렉터리에서 .env 파일 탐색
    current = SCRIPT_DIR
    for _ in range(6):
        candidate = current / ".env"
        if candidate.exists():
            return candidate
        current = current.parent
    # 탐색 실패 시 명확한 에러가 발생하도록 현재 디렉터리 경로 반환
    return SCRIPT_DIR / ".env"`,
    },
    {
      id: "get_cache_path",
      name: "get_cache_path(lang_code)",
      fileId: "main",
      summary: "번역 캐시 CSV 파일이 저장될 경로를 반환하고, 폴더가 없으면 만듦.",
      how: "같은 문장을 매번 API로 번역하면 시간과 비용이 낭비됨. 언어별로 캐시 파일(dialog_ko.csv 등)을 만들어 번역 결과를 보관함. mkdir(parents=True, exist_ok=True)로 폴더를 안전하게 만듦.",
      terms: ["mkdir", "Path(__file__)"],
      lines: [
        { at: 'cache_dir = SCRIPT_DIR / "translations"', text: "캐시 파일을 저장할 폴더 경로를 지정함(tts.py와 같은 폴더 안의 translations/)." },
        { at: 'cache_dir.mkdir(parents=True, exist_ok=True)', text: "폴더가 없으면 만들고, 이미 있어도 오류 없이 넘어감." },
        { at: 'return cache_dir / f"dialog_{lang_code}.csv"', text: "언어 코드별로 구분된 캐시 파일 경로를 반환함. 예: dialog_en.csv" },
      ],
      code:
`def get_cache_path(lang_code: str) -> Path:
    """프로젝트 디렉터리 내 번역 캐시 파일 경로를 반환함."""
    cache_dir = SCRIPT_DIR / "translations"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / f"dialog_{lang_code}.csv"`,
    },
    {
      id: "get_input_path",
      name: "get_input_path()",
      fileId: "main",
      summary: "번역할 대화 CSV 파일(dialog.csv) 경로를 반환함.",
      how: "대본 파일 경로를 하드코딩 대신 함수로 분리해 관리함. TTS_ROOT는 06.tts/ 폴더이고, 그 아래 text/dialog.csv를 읽음.",
      terms: ["Path(__file__)"],
      lines: [
        { at: 'return TTS_ROOT / "text" / "dialog.csv"', text: "06.tts/text/dialog.csv 경로를 반환함. 실제 대본 파일 위치임." },
      ],
      code:
`def get_input_path() -> Path:
    """대화 CSV 입력 파일 경로를 반환함."""
    return TTS_ROOT / "text" / "dialog.csv"`,
    },
    {
      id: "get_output_path",
      name: "get_output_path()",
      fileId: "main",
      summary: "생성된 WAV 파일을 저장할 경로를 반환함.",
      how: "출력 경로를 함수로 분리해 한 곳에서 관리함. tts.py와 같은 폴더에 result.wav로 저장됨.",
      terms: ["Path(__file__)"],
      lines: [
        { at: 'return SCRIPT_DIR / "result.wav"', text: "tts.py와 같은 디렉터리(hands-on/06.tts/llm/)에 result.wav를 저장함." },
      ],
      code:
`def get_output_path() -> Path:
    """출력 WAV 파일 경로를 반환함."""
    return SCRIPT_DIR / "result.wav"`,
    },
    // ===== 환경 변수 =====
    {
      id: "load_env",
      name: "load_env()",
      fileId: "main",
      summary: ".env 파일에서 OpenAI API 키를 읽어 반환하고, 없으면 안내 메시지를 출력하고 종료함.",
      how: "find_env_file()로 .env 위치를 찾고, load_dotenv()로 그 파일의 KEY=값들을 환경변수로 올림. os.getenv로 OPENAI_API_KEY를 꺼내고 없으면 어디에 무엇을 추가해야 하는지 안내하고 sys.exit(1)로 즉시 종료함.",
      terms: ["load_dotenv", "환경변수(.env)", "API 키", "sys.exit"],
      lines: [
        { at: 'env_path = find_env_file()', text: ".env 파일 경로를 탐색해서 구함." },
        { at: 'load_dotenv(env_path)', text: "load_dotenv가 .env 파일의 KEY=값들을 읽어 환경변수로 등록함." },
        { at: 'api_key = os.getenv("OPENAI_API_KEY")', text: "환경변수에서 OpenAI API 키를 꺼냄. 없으면 None이 됨." },
        { at: 'if not api_key:', text: "키가 없으면 어떤 파일에 무엇을 추가해야 하는지 안내하고 프로그램을 멈춤." },
        { at: 'return api_key', text: "키가 있으면 다음 단계에서 쓸 수 있도록 반환함." },
      ],
      code:
`def load_env() -> str:
    """.env에서 환경변수를 로드하고 OpenAI API 키를 반환함. 없으면 종료."""
    env_path = find_env_file()
    load_dotenv(env_path)

    # OPENAI_API_KEY: OpenAI API 인증에 사용하는 비밀 키
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print(f"\\n[Error] OPENAI_API_KEY not found.")
        print(f"  Expected at: {env_path}")
        print(f"  Add OPENAI_API_KEY=sk-xxx to that file.")
        sys.exit(1)

    return api_key`,
    },
    // ===== 번역 캐시 =====
    {
      id: "load_translation_cache",
      name: "load_translation_cache(lang_code)",
      fileId: "main",
      summary: "이전에 저장된 번역 결과를 CSV 파일에서 읽어 {원문: 번역문} 딕셔너리로 반환함.",
      how: "같은 문장을 다시 번역하지 않기 위해 캐시를 씀. 캐시 파일이 있으면 pandas로 읽어 original(원문)→translated(번역문) 형태의 딕셔너리를 만듦. 없거나 오류가 나면 빈 딕셔너리를 반환해 프로그램이 멈추지 않도록 함.",
      terms: ["딕셔너리(dict)", "DataFrame", "pandas", "예외 처리(try/except)"],
      lines: [
        { at: 'cache: Dict[str, str] = {}', text: "빈 캐시 딕셔너리로 시작함. 파일이 없으면 이 빈 것을 그대로 반환함." },
        { at: 'if cache_path.exists():', text: "캐시 파일이 실제로 있을 때만 읽으려 시도함." },
        { at: 'df = pd.read_csv(cache_path, sep="|", encoding="utf-8")', text: "|로 구분된 CSV를 pandas DataFrame으로 읽음. pandas는 표 형식 데이터를 다루는 라이브러리임." },
        { at: 'cache[str(row["original"])] = str(row["translated"])', text: "표의 각 행을 순서대로 읽어 원문→번역문 딕셔너리를 만듦." },
        { at: 'except Exception as e:', text: "파일이 깨졌거나 형식이 맞지 않아도 빈 캐시로 계속 진행함(앱이 멈추지 않음)." },
      ],
      code:
`def load_translation_cache(lang_code: str) -> Dict[str, str]:
    """CSV 파일에서 번역 캐시를 로드하여 {원문: 번역문} 딕셔너리로 반환함."""
    cache_path = get_cache_path(lang_code)
    cache: Dict[str, str] = {}

    if cache_path.exists():
        try:
            df = pd.read_csv(cache_path, sep="|", encoding="utf-8")
            if "original" in df.columns and "translated" in df.columns:
                for _, row in df.iterrows():
                    cache[str(row["original"])] = str(row["translated"])
                print(f"[Cache] {len(cache)}개 번역 캐시 로드: {cache_path.name}")
        except Exception as e:
            print(f"[Cache] 캐시 로드 실패: {e}")

    return cache`,
    },
    {
      id: "save_translation_cache",
      name: "save_translation_cache(lang_code, cache)",
      fileId: "main",
      summary: "번역 캐시 딕셔너리를 CSV 파일로 저장해 다음 실행 시 재사용할 수 있게 함.",
      how: "딕셔너리의 키(원문)·값(번역문) 쌍을 DataFrame으로 변환해 |로 구분된 CSV 파일로 저장함. 저장 실패 시 오류 메시지만 출력하고 계속 진행함.",
      terms: ["딕셔너리(dict)", "DataFrame", "pandas", "예외 처리(try/except)"],
      lines: [
        { at: 'df = pd.DataFrame([', text: "딕셔너리의 키·값 쌍을 행이 있는 표(DataFrame)로 변환함." },
        { at: 'df.to_csv(cache_path, sep="|", index=False, encoding="utf-8")', text: "DataFrame을 |로 구분된 CSV로 저장함. index=False로 행 번호는 저장하지 않음." },
        { at: 'except Exception as e:', text: "저장 실패 시 프로그램을 멈추지 않고 메시지만 출력함." },
      ],
      code:
`def save_translation_cache(lang_code: str, cache: Dict[str, str]) -> None:
    """번역 캐시를 CSV 파일에 저장함."""
    cache_path = get_cache_path(lang_code)

    try:
        df = pd.DataFrame([
            {"original": k, "translated": v}
            for k, v in cache.items()
        ])
        df.to_csv(cache_path, sep="|", index=False, encoding="utf-8")
        print(f"[Cache] {len(cache)}개 번역 캐시 저장: {cache_path.name}")
    except Exception as e:
        print(f"[Cache] 캐시 저장 실패: {e}")`,
    },
    // ===== 사용자 인터랙션 =====
    {
      id: "select_language",
      name: "select_language()",
      fileId: "main",
      summary: "화면에 언어 목록을 보여주고 사용자가 번호로 선택하면 (언어코드, 한국어명, 영어명) 튜플을 반환함.",
      how: "SUPPORTED_LANGUAGES 딕셔너리에서 번호·코드·이름을 꺼내 표시함. 올바른 번호를 입력할 때까지 while 반복으로 다시 물음. 선택한 언어 정보는 튜플 언패킹으로 반환함.",
      terms: ["딕셔너리(dict)", "while 반복", "튜플(tuple)", "input()"],
      lines: [
        { at: 'for key, (code, korean, english) in SUPPORTED_LANGUAGES.items():', text: "딕셔너리를 돌며 번호·코드·이름을 동시에 꺼냄(언패킹)." },
        { at: 'choice = input("언어 번호를 선택하세요 (1-6): ").strip()', text: "사용자가 키보드로 번호를 입력함. .strip()으로 앞뒤 공백을 제거함." },
        { at: 'if choice in SUPPORTED_LANGUAGES:', text: "입력한 번호가 딕셔너리 키에 있으면 선택이 유효함." },
        { at: 'code, korean, english = SUPPORTED_LANGUAGES[choice]', text: "선택한 번호의 값(튜플)을 3개 변수에 한 번에 담음(언패킹)." },
        { at: 'return code, korean, english', text: "3개 값을 튜플로 반환함. 호출한 쪽에서 lang_code, lang_korean, lang_english로 받음." },
      ],
      code:
`def select_language() -> tuple:
    """번역 대상 언어를 사용자에게 선택받아 (언어 코드, 한국어명, 영어명) 튜플을 반환함."""
    print("\\n" + "=" * 60)
    print("번역 대상 언어 선택")
    print("=" * 60)

    for key, (code, korean, english) in SUPPORTED_LANGUAGES.items():
        print(f"  [{key}] {korean} ({english})")

    print("-" * 60)

    while True:
        choice = input("언어 번호를 선택하세요 (1-6): ").strip()
        if choice in SUPPORTED_LANGUAGES:
            code, korean, english = SUPPORTED_LANGUAGES[choice]
            print(f"\\n[선택] {korean} ({code})")
            return code, korean, english
        print("  1부터 6 사이의 번호를 입력하세요.")`,
    },
    {
      id: "select_voice",
      name: "select_voice(speaker)",
      fileId: "main",
      summary: "화자 이름을 보여주고 OpenAI TTS 음성 6종 중 하나를 사용자가 선택하게 함. 선택된 음성 이름을 반환함.",
      how: "OPENAI_VOICES 딕셔너리에서 번호·이름·성별·설명을 꺼내 표시함. 올바른 번호를 입력할 때까지 반복해서 묻고, 선택된 음성 이름(alloy 등)을 반환함.",
      terms: ["딕셔너리(dict)", "while 반복", "input()"],
      lines: [
        { at: "for key, info in OPENAI_VOICES.items():", text: "음성 딕셔너리를 돌며 번호·이름·성별·설명을 차례로 표시함." },
        { at: "choice = input(f\"  음성 번호 (1-6): \").strip()", text: "화자별로 음성 번호를 입력받음." },
        { at: "selected = OPENAI_VOICES[choice][\"name\"]", text: "선택된 번호의 음성 이름(alloy, echo 등)을 꺼냄." },
        { at: "return selected", text: "선택한 음성 이름을 반환함. 이후 generate_tts()에서 사용됨." },
      ],
      code:
`def select_voice(speaker: str) -> str:
    """화자에 대한 음성을 사용자에게 선택받아 음성 이름을 반환함."""
    print(f"\\n--- '{speaker}' 음성 선택 ---")

    for key, info in OPENAI_VOICES.items():
        print(f"  [{key}] {info['name']:8s} ({info['gender']:6s}) - {info['description']}")

    while True:
        choice = input(f"  음성 번호 (1-6): ").strip()
        if choice in OPENAI_VOICES:
            selected = OPENAI_VOICES[choice]["name"]
            print(f"  → {selected}")
            return selected
        print("  1부터 6 사이의 번호를 입력하세요.")`,
    },
    // ===== 데이터 로드 =====
    {
      id: "load_dialog",
      name: "load_dialog(input_path)",
      fileId: "main",
      summary: "대화 CSV 파일을 읽어 speaker·text 열이 있는지 검증하고 DataFrame으로 반환함.",
      how: "파일이 없으면 즉시 종료함. pandas로 |구분 CSV를 읽고 speaker·text 두 열이 모두 있는지 확인함. 하나라도 빠지면 에러 메시지를 출력하고 sys.exit(1)로 종료함.",
      terms: ["DataFrame", "pandas", "sys.exit"],
      lines: [
        { at: 'if not input_path.exists():', text: "파일이 없으면 즉시 오류를 출력하고 종료함(데이터 없이 계속 실행해도 의미 없으므로)." },
        { at: 'df = pd.read_csv(input_path, sep="|", encoding="utf-8")', text: "|로 구분된 CSV를 DataFrame으로 읽음." },
        { at: 'for col in ("speaker", "text"):', text: "speaker(화자)와 text(대사) 두 열이 반드시 있어야 함. 없으면 오류를 출력하고 종료함." },
        { at: 'return df', text: "검증을 통과한 DataFrame을 반환함. 이후 화자 추출·번역·음성 합성에 사용됨." },
      ],
      code:
`def load_dialog(input_path: Path) -> pd.DataFrame:
    """대화 CSV 파일을 로드하고 필수 컬럼을 검증하여 DataFrame을 반환함."""
    if not input_path.exists():
        print(f"\\n[Error] 입력 파일을 찾을 수 없습니다: {input_path}")
        sys.exit(1)

    df = pd.read_csv(input_path, sep="|", encoding="utf-8")

    for col in ("speaker", "text"):
        if col not in df.columns:
            print(f"\\n[Error] 필수 컬럼 '{col}'이 없습니다.")
            sys.exit(1)

    return df`,
    },
    {
      id: "get_speakers",
      name: "get_speakers(df)",
      fileId: "main",
      summary: "DataFrame에서 화자 목록을 등장 순서대로 중복 없이 추출하여 반환함.",
      how: "같은 화자가 여러 번 나와도 한 번만 포함함. 파이썬의 set(집합)은 순서를 보장하지 않으므로, 딕셔너리를 활용해 처음 등장 순서를 유지하며 중복을 제거함.",
      terms: ["딕셔너리(dict)", "DataFrame"],
      lines: [
        { at: 'seen: Dict[str, None] = {}', text: "빈 딕셔너리를 '순서 있는 중복 제거' 도구로 활용함. 같은 이름이 다시 나와도 덮어쓰기만 할 뿐 새 항목이 생기지 않음." },
        { at: 'for s in df["speaker"]:', text: "대사 표의 speaker 열을 순서대로 읽음." },
        { at: 'seen[str(s)] = None', text: "이름을 키로 저장함. 이미 있으면 None으로 덮어쓰기만 하고 추가되지 않음." },
        { at: 'return list(seen.keys())', text: "딕셔너리 키만 꺼내면 등장 순서를 유지한 고유 화자 목록이 됨." },
      ],
      code:
`def get_speakers(df: pd.DataFrame) -> List[str]:
    """등장 순서를 유지하며 고유 화자 목록을 추출하여 반환함."""
    seen: Dict[str, None] = {}
    for s in df["speaker"]:
        seen[str(s)] = None
    return list(seen.keys())`,
    },
    // ===== OpenAI 번역 =====
    {
      id: "translate_text",
      name: "translate_text(texts, target_language, cache, api_key)",
      fileId: "main",
      summary: "GPT-4o-mini로 텍스트 목록을 번역함. 이미 번역된 것은 캐시에서 꺼내 API 호출을 줄임.",
      how: "각 문장마다 캐시에 있으면 바로 꺼내고, 없으면 GPT-4o-mini API를 호출해 번역함. 번역 결과는 바로 캐시에 저장됨. 진행률은 tqdm 프로그레스 바로 표시함. 번역 실패 시 원문을 그대로 씀.",
      terms: ["tqdm", "프로그레스 바", "예외 처리(try/except)", "딕셔너리(dict)", "OpenAI SDK"],
      lines: [
        { at: 'for text in tqdm(texts, desc="번역 중"):', text: "tqdm은 반복 작업 진행률을 터미널에 막대 그래프로 보여주는 도구임." },
        { at: 'if text in cache:', text: "이미 번역한 문장이면 API를 호출하지 않고 캐시에서 바로 꺼냄." },
        { at: 'response = client.chat.completions.create(', text: "GPT-4o-mini에게 번역 요청을 보냄. messages에 시스템(번역 지시)과 사용자(번역할 문장)를 함께 넣음." },
        { at: 'result = (response.choices[0].message.content or text).strip()', text: "번역 결과 텍스트를 꺼냄. 응답이 비어 있으면 원문(text)을 그대로 씀." },
        { at: 'cache[text] = result', text: "번역 결과를 캐시에 저장해 다음번 같은 문장은 API 없이 바로 꺼냄." },
        { at: 'translated.append(text)', text: "번역이 실패하면 원문을 그대로 씀(오류로 멈추지 않음)." },
      ],
      code:
`def translate_text(
    texts: List[str],
    target_language: str,
    cache: Dict[str, str],
    api_key: str,
) -> List[str]:
    """GPT-4o-mini와 캐시를 활용하여 텍스트 목록을 번역하고 반환함."""
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    translated: List[str] = []
    new_translations = 0

    # tqdm: 반복 작업의 진행률을 프로그레스 바로 표시함
    for text in tqdm(texts, desc="번역 중"):
        text = str(text).strip()

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
                            f"Translate the given text to {target_language}. "
                            f"Output only the translated text, nothing else."
                        ),
                    },
                    {"role": "user", "content": text},
                ],
                temperature=0.3,
            )
            result = (response.choices[0].message.content or text).strip()
            cache[text] = result
            translated.append(result)
            new_translations += 1
        except Exception as e:
            print(f"\\n[Warning] 번역 실패 ('{text[:20]}...'): {e}")
            translated.append(text)

    if new_translations > 0:
        print(f"[번역] {new_translations}개 새로 번역됨")

    return translated`,
    },
    // ===== OpenAI TTS =====
    {
      id: "generate_tts",
      name: "generate_tts(text, voice, api_key)",
      fileId: "main",
      summary: "OpenAI TTS-1 모델에 텍스트와 음성 종류를 보내 WAV 오디오 바이트를 받아 반환함.",
      how: "OpenAI의 음성 합성(TTS) API를 호출함. tts-1 모델에 텍스트·음성 이름을 주고, 응답 형식으로 WAV를 요청함. 결과는 bytes 형식의 원시 오디오 데이터임.",
      terms: ["OpenAI SDK", "TTS(Text-to-Speech)", "bytes(바이트)", "response_format"],
      lines: [
        { at: 'client = OpenAI(api_key=api_key)', text: "API 키로 OpenAI 클라이언트를 만듦." },
        { at: 'response = client.audio.speech.create(', text: "★핵심★ OpenAI TTS API를 호출함. 텍스트를 음성으로 변환하는 요청임." },
        { at: 'model="tts-1",', text: "tts-1은 OpenAI의 표준 음성 합성 모델임(tts-1-hd는 고품질 버전)." },
        { at: 'voice=voice,', text: "앞서 사용자가 선택한 음성(alloy, echo 등)을 적용함." },
        { at: 'response_format="wav",', text: "응답을 WAV 형식으로 받음. 이어붙이기가 쉽고 손실 없는 오디오 형식임." },
        { at: 'return response.content', text: "WAV 오디오 데이터(바이트)를 반환함. 이후 배열로 변환해 이어붙임." },
      ],
      code:
`def generate_tts(text: str, voice: str, api_key: str) -> bytes:
    """OpenAI TTS-1 모델로 음성 바이트를 생성하여 반환함."""
    from openai import OpenAI

    client = OpenAI(api_key=api_key)

    response = client.audio.speech.create(
        model="tts-1",
        voice=voice,       # type: ignore[arg-type]
        input=text,
        response_format="wav",
    )
    return response.content`,
    },
    // ===== 오디오 처리 =====
    {
      id: "wav_bytes_to_array",
      name: "wav_bytes_to_array(wav_bytes)",
      fileId: "main",
      summary: "WAV 형식의 바이트 데이터를 (샘플레이트, 오디오 배열) 튜플로 변환하여 반환함.",
      how: "API가 돌려준 WAV 바이트를 파일 없이 메모리(io.BytesIO)에서 바로 읽음. scipy.wavfile.read()가 WAV 헤더를 분석해 샘플레이트와 numpy 배열을 반환함. 파일로 저장하지 않아 속도가 빠름.",
      terms: ["io.BytesIO", "numpy 배열", "샘플레이트", "scipy", "튜플(tuple)"],
      lines: [
        { at: 'with io.BytesIO(wav_bytes) as f:', text: "WAV 바이트를 메모리 속 가상 파일로 만듦. 디스크에 실제로 저장하지 않아도 됨." },
        { at: 'return wavfile.read(f)', text: "scipy.wavfile.read()가 WAV 헤더를 분석해 (샘플레이트, numpy 배열) 튜플을 반환함." },
      ],
      code:
`def wav_bytes_to_array(wav_bytes: bytes):
    """WAV 바이트를 (샘플레이트, numpy 배열) 튜플로 변환하여 반환함."""
    with io.BytesIO(wav_bytes) as f:
        return wavfile.read(f)`,
    },
    {
      id: "to_int16",
      name: "to_int16(audio)",
      fileId: "main",
      summary: "다양한 숫자 형식의 오디오 배열을 WAV 저장에 적합한 int16 형식으로 변환함.",
      how: "WAV 파일(16-bit PCM)은 -32768~32767 범위의 정수(int16)를 사용함. 이미 int16이면 그대로 반환함. 부동소수점(float) 형식이면 -1.0~1.0 범위로 자른 뒤 32767을 곱해 정수로 바꿈. 다른 형식이면 단순 변환함.",
      terms: ["numpy 배열", "int16", "dtype(데이터 타입)", "np.clip"],
      lines: [
        { at: 'if audio.dtype == np.int16:', text: "이미 int16 형식이면 변환 없이 그대로 반환함." },
        { at: 'if np.issubdtype(audio.dtype, np.floating):', text: "float32 등 부동소수점 형식인지 확인함. OpenAI TTS가 float 형식으로 데이터를 줄 수 있음." },
        { at: 'return (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)', text: "값을 -1.0~1.0 범위로 자른 뒤 32767을 곱해 int16 범위(-32767~32767)로 스케일을 바꿈." },
        { at: 'return audio.astype(np.int16)', text: "다른 정수 형식(int32 등)이면 단순 타입 변환으로 int16으로 바꿈." },
      ],
      code:
`def to_int16(audio: np.ndarray) -> np.ndarray:
    """임의 타입의 오디오 배열을 int16으로 정규화하여 반환함."""
    if audio.dtype == np.int16:
        return audio
    if np.issubdtype(audio.dtype, np.floating):
        return (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)
    return audio.astype(np.int16)`,
    },
    {
      id: "build_silence",
      name: "build_silence(duration_sec, sample_rate)",
      fileId: "main",
      summary: "지정한 길이(초)의 무음 오디오 배열을 생성하여 반환함.",
      how: "무음은 값이 모두 0인 오디오 배열임. 지속 시간(초)과 샘플레이트를 곱하면 필요한 샘플 개수가 나옴. np.zeros()로 전부 0인 배열을 만들어 대사 사이 자연스러운 간격으로 삽입함.",
      terms: ["numpy 배열", "샘플레이트", "int16"],
      lines: [
        { at: 'return np.zeros(int(duration_sec * sample_rate), dtype=np.int16)', text: "지속시간(초)×샘플레이트 개수만큼의 0 배열을 만듦. 예: 0.3초 × 24000Hz = 7200개 0." },
      ],
      code:
`def build_silence(duration_sec: float, sample_rate: int) -> np.ndarray:
    """지정 길이(초)의 무음 int16 배열을 생성하여 반환함."""
    return np.zeros(int(duration_sec * sample_rate), dtype=np.int16)`,
    },
    {
      id: "concatenate_segments",
      name: "concatenate_segments(segments, sample_rate, gap_sec)",
      fileId: "main",
      summary: "여러 오디오 조각 사이에 0.3초 묵음을 삽입하며 하나의 배열로 이어붙여 반환함.",
      how: "각 대사 음성 조각(segment)을 int16으로 변환하고, 마지막이 아니면 뒤에 묵음을 붙임. np.concatenate()로 전부 하나의 긴 오디오 배열로 합침.",
      terms: ["numpy 배열", "np.concatenate", "리스트(list)"],
      lines: [
        { at: 'silence = build_silence(gap_sec, sample_rate)', text: "gap_sec(기본 0.3초) 길이의 묵음 배열을 미리 만들어 둠." },
        { at: 'parts.append(to_int16(seg))', text: "오디오 조각을 int16으로 변환해 목록에 추가함." },
        { at: 'if i < len(segments) - 1:', text: "마지막 조각이 아니면 뒤에 묵음을 삽입해 대사 사이 간격을 만듦." },
        { at: 'return np.concatenate(parts)', text: "numpy의 concatenate()로 모든 조각과 묵음을 하나의 긴 배열로 이어붙임." },
      ],
      code:
`def concatenate_segments(
    segments: List[np.ndarray],
    sample_rate: int,
    gap_sec: float = 0.3,
) -> np.ndarray:
    """오디오 세그먼트 사이에 묵음을 삽입하여 하나의 배열로 연결함."""
    silence = build_silence(gap_sec, sample_rate)
    parts: List[np.ndarray] = []
    for i, seg in enumerate(segments):
        parts.append(to_int16(seg))
        if i < len(segments) - 1:
            parts.append(silence)
    return np.concatenate(parts)`,
    },
    // ===== 진입점 =====
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "전체 파이프라인(환경→언어→파일→음성 선택→번역→TTS→저장)을 순서대로 실행하는 시작점.",
      how: "프로그램의 '지휘자'임. API 키 로드 → 언어 선택 → 대화 파일 로드 → 화자 음성 선택 → 번역 → TTS 음성 합성 → 세그먼트 연결 → WAV 저장 순으로 실행함. tqdm으로 진행률을 표시하고 오류가 나면 경고 메시지만 출력하고 계속 진행함.",
      terms: ["tqdm", "프로그레스 바", "예외 처리(try/except)", "WAV", "샘플레이트", "if __name__"],
      lines: [
        { at: 'api_key = load_env()', text: ".env에서 OpenAI API 키를 읽음. 없으면 여기서 종료됨." },
        { at: 'lang_code, lang_korean, lang_english = select_language()', text: "언어 선택 결과를 3개 변수로 한 번에 받음(튜플 언패킹)." },
        { at: 'dialog_df = load_dialog(input_path)', text: "대화 CSV 파일을 읽어 DataFrame으로 받음." },
        { at: 'speaker_voices[speaker] = select_voice(speaker)', text: "각 화자마다 반복해 음성을 선택하고 딕셔너리에 저장함." },
        { at: 'if lang_code == "ko":', text: "한국어를 선택했으면 번역 없이 원문을 그대로 씀." },
        { at: 'for i, (_, row) in enumerate(tqdm(dialog_df.iterrows()', text: "대사마다 화자·텍스트·음성을 꺼내 TTS를 호출함. tqdm으로 진행률 표시." },
        { at: 'wav_bytes = generate_tts(text, voice, api_key)', text: "OpenAI TTS API로 음성 바이트를 받아옴." },
        { at: 'final_audio = concatenate_segments(audio_segments, sample_rate)', text: "모든 음성 조각을 묵음을 넣어 이어붙임." },
        { at: 'wavfile.write(str(output_path), sample_rate, final_audio)', text: "최종 오디오를 16-bit PCM WAV 파일로 저장함." },
      ],
      code:
`def main():
    """OpenAI 번역 및 TTS-1 음성 합성 전체 파이프라인을 실행함."""
    print("=" * 60)
    print("  LLM TTS - Text-to-Speech with OpenAI")
    print("  (GPT-4o-mini 번역 + TTS-1 음성 합성)")
    print("=" * 60)

    api_key = load_env()
    print("[API] OpenAI API 연결됨")

    input_path  = get_input_path()
    output_path = get_output_path()
    print(f"\\n[입력] {input_path}")
    print(f"[출력] {output_path}")

    # 1. 언어 선택
    lang_code, lang_korean, lang_english = select_language()

    # 2. 대화 파일 로드
    print(f"\\n[로드] 대화 파일 읽는 중...")
    dialog_df = load_dialog(input_path)
    print(f"[로드] {len(dialog_df)}개 대화 로드됨")

    # 3. 화자 목록
    speakers = get_speakers(dialog_df)
    print(f"[화자] {len(speakers)}명 감지: {speakers}")

    # 4. 화자별 음성 선택
    print("\\n" + "=" * 60)
    print("화자별 음성 선택")
    print("=" * 60)

    speaker_voices: Dict[str, str] = {}
    for speaker in speakers:
        speaker_voices[speaker] = select_voice(speaker)

    print("\\n[음성 할당 결과]")
    for speaker, voice in speaker_voices.items():
        print(f"  {speaker} → {voice}")

    # 5. 번역 캐시 로드
    cache = load_translation_cache(lang_code)

    # 6. 번역
    print(f"\\n[번역] {lang_korean}로 번역 중...")
    texts = dialog_df["text"].tolist()

    if lang_code == "ko":
        # 한국어가 원본 언어인 경우 번역 생략
        translated_texts = [str(t) for t in texts]
        print("[번역] 원본 언어(한국어) 선택 — 번역 생략")
    else:
        translated_texts = translate_text(texts, lang_english, cache, api_key)
        save_translation_cache(lang_code, cache)

    # 7. TTS 음성 합성
    print(f"\\n[TTS] 음성 생성 중...")
    audio_segments: List[np.ndarray] = []
    # OpenAI TTS 기본 샘플레이트
    sample_rate = 24000

    for i, (_, row) in enumerate(tqdm(dialog_df.iterrows(), total=len(dialog_df), desc="음성 생성")):
        speaker = str(row["speaker"])
        text    = translated_texts[i].strip()
        voice   = speaker_voices[speaker]

        if not text:
            continue

        try:
            wav_bytes = generate_tts(text, voice, api_key)
            sr, audio_data = wav_bytes_to_array(wav_bytes)
            sample_rate = sr
            audio_segments.append(audio_data)
        except Exception as e:
            print(f"\\n[Warning] 음성 생성 실패 (line {i + 1}): {e}")

    if not audio_segments:
        print("\\n[Error] 생성된 음성이 없습니다.")
        sys.exit(1)

    # 8. 세그먼트 연결 및 저장
    print(f"\\n[저장] 오디오 파일 생성 중...")
    final_audio = concatenate_segments(audio_segments, sample_rate)
    # 오디오 데이터를 16-bit PCM WAV 파일로 저장함
    wavfile.write(str(output_path), sample_rate, final_audio)

    duration_sec = len(final_audio) / sample_rate

    print("\\n" + "=" * 60)
    print("[완료]")
    print("=" * 60)
    print(f"  번역 언어  : {lang_korean} ({lang_code})")
    print(f"  출력 파일  : {output_path}")
    print(f"  재생 시간  : {duration_sec:.2f}초")
    print(f"  샘플레이트 : {sample_rate} Hz")
    print("=" * 60)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()`,
    },
  ],

  glossary: {
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .parent를 붙이면 이 파일이 든 폴더가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "for _ in range(n)": "반복 횟수만 필요하고 반복 변수는 쓰지 않을 때 _를 쓰는 파이썬 관용구. '_'는 '이 값은 쓰지 않겠다'는 의미임.",
    "candidate.exists()": "Path 객체의 .exists()는 그 경로에 실제 파일·폴더가 있는지 True/False로 확인함.",
    "mkdir": "폴더를 만드는 Path 메서드. parents=True는 중간 폴더까지 함께 만들고, exist_ok=True는 이미 있어도 오류 없이 넘어가게 함.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수(python-dotenv 라이브러리 제공).",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(OpenAI 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "sys.exit": "프로그램을 즉시 종료하는 함수. sys.exit(1)은 '비정상 종료(오류)'를 뜻하고, sys.exit(0)은 '정상 종료'를 뜻함.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"언어\": \"ko\"}처럼 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    "while 반복": "조건이 참인 동안 계속 도는 반복문. 여기서는 올바른 번호를 입력할 때까지 다시 묻는 데 씀.",
    "튜플(tuple)": "여러 값을 묶어 하나로 반환하는 방법. (코드, 이름, 영어명)처럼 괄호로 묶임. 함수가 여러 값을 한 번에 반환할 때 자주 씀.",
    "input()": "콘솔(터미널)에서 사용자가 키보드로 입력한 한 줄을 글자로 받아오는 함수.",
    "DataFrame": "pandas 라이브러리의 핵심 자료 구조. 행(row)과 열(column)이 있는 표 형식 데이터를 다룸. 스프레드시트와 비슷함.",
    "pandas": "표 형식 데이터(CSV, 엑셀 등)를 읽고, 분석하고, 변환하는 파이썬 라이브러리. pd.read_csv()로 CSV 파일을 손쉽게 읽을 수 있음.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "tqdm": "반복 작업의 진행률을 터미널에 막대 그래프(프로그레스 바)로 표시해 주는 라이브러리. 번역이나 TTS처럼 시간이 걸리는 작업에 유용함.",
    "프로그레스 바": "작업 진행률을 시각적으로 보여주는 막대 그래프. 예: [====>    ] 50% 와 같은 모양으로 터미널에 표시됨.",
    "OpenAI SDK": "OpenAI API를 파이썬에서 쉽게 쓸 수 있게 해주는 공식 라이브러리. from openai import OpenAI 로 불러씀.",
    "TTS(Text-to-Speech)": "글자를 음성으로 변환하는 기술. 텍스트를 입력하면 사람 목소리처럼 읽어주는 오디오 파일을 만들어 줌.",
    "bytes(바이트)": "파이썬에서 파일·오디오·이미지 같은 이진 데이터를 담는 자료형. API가 음성 파일을 bytes로 돌려주면 이걸 파일로 저장하거나 배열로 변환함.",
    "response_format": "API에 '응답을 어떤 형식으로 줘'라고 지정하는 옵션. 여기서는 'wav'를 지정해 WAV 오디오 데이터를 받음.",
    "io.BytesIO": "실제 파일 없이 메모리 안에서 파일처럼 다룰 수 있는 '가상 파일' 도구. 디스크에 저장하지 않고 오디오 바이트를 바로 처리할 때 씀.",
    "numpy 배열": "숫자를 빠르게 처리하는 특별한 목록(numpy 라이브러리). 오디오 데이터는 샘플 값들의 배열로 표현됨.",
    "샘플레이트": "1초에 오디오 샘플이 몇 개 있는지를 나타내는 숫자(Hz). OpenAI TTS-1은 24000Hz(24kHz)를 사용함. 값이 클수록 음질이 좋음.",
    "scipy": "과학·수학 계산을 위한 파이썬 라이브러리. 여기서는 scipy.io.wavfile로 WAV 파일을 읽고 쓰는 데 사용함.",
    "int16": "16비트 정수 형식(-32768~32767). WAV 파일(16-bit PCM 오디오)은 이 형식으로 오디오 샘플을 저장함.",
    "dtype(데이터 타입)": "numpy 배열의 숫자 종류(int16, float32 등). 오디오 처리 시 형식이 맞지 않으면 음질 문제나 오류가 생길 수 있음.",
    "np.clip": "배열의 값을 지정 범위 안으로 잘라주는 함수. np.clip(x, -1.0, 1.0)은 -1.0보다 작으면 -1.0으로, 1.0보다 크면 1.0으로 바꿈.",
    "np.concatenate": "여러 numpy 배열을 하나로 이어붙이는 함수. 오디오 조각들을 하나의 긴 배열로 합칠 때 씀.",
    "리스트(list)": "여러 값을 순서대로 담는 목록. [a, b, c]처럼 대괄호로 표현함. 오디오 조각들을 모아두는 데 씀.",
    "WAV": "손실 없이 오디오를 저장하는 파일 형식(Waveform Audio File Format). MP3와 달리 압축하지 않아 음질 손상이 없음.",
    "if __name__": "if __name__ == '__main__': 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
  },
};
