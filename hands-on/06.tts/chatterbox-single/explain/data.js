/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../06.tts/chatterbox-single/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "Chatterbox 한국어 음성 복제 TTS 예제 설명",
    entry: "tts.py",
  },

  files: [
    { id: "main", label: "tts.py", role: "단일 파일 CLI 예제 · 한국어 음성 복제 TTS 전체 파이프라인" },
  ],

  flow: [
    {
      step: 1, title: "환경 초기화", label: "환경 초기화", refs: ["configure_console"],
      summary: "configure_console()로 Windows 터미널 UTF-8 설정, 상수·경로·데이터 구조 준비",
      detail: "프로그램이 시작되기 전 '무대 세팅' 단계임. Windows 환경에서 한글이 깨지지 않도록 출력 채널을 UTF-8로 바꾸고, 파일 경로·파라미터 기본값·오디오 확장자 목록 같은 고정값들을 미리 정의해 둠. RuntimeDeps·ToneDecision·TTSLine 같은 데이터 상자(dataclass)도 이 단계에서 정의됨.",
    },
    {
      step: 2, title: "필수 패키지 검사", label: "패키지 검사", refs: ["check_prerequisites"],
      summary: "check_prerequisites()가 PyTorch·torchaudio·ffmpeg·chatterbox-tts·groq 설치 여부를 확인하고 RuntimeDeps를 반환",
      detail: "주방을 열기 전 재료와 도구가 다 갖춰졌는지 점검하는 단계임. PyTorch·torchaudio(딥러닝 엔진), ffmpeg(음성 파일 변환 도구), chatterbox-tts(음성 합성 모델), groq(LLM 클라이언트)가 모두 설치돼 있어야 함. 하나라도 없으면 설치 방법을 안내하고 프로그램을 멈춤.",
    },
    {
      step: 3, title: "참조 음성 준비", label: "참조 음성 준비", refs: ["prepare_reference_voices", "scan_voice_sources", "convert_to_wav", "select_reference_voice"],
      summary: "prepare_reference_voices()가 voices/ 폴더를 스캔하고 비-WAV 파일을 ffmpeg로 WAV로 변환",
      detail: "'누구의 목소리로 말할지' 결정하는 단계임. voices/ 폴더에 있는 오디오 파일을 찾아 목록을 만들고, WAV가 아닌 파일(mp3, m4a 등)은 ffmpeg를 불러 WAV로 자동 변환함. 변환된 WAV가 여러 개면 사용자가 번호를 골라 선택함.",
    },
    {
      step: 4, title: "텍스트 입력 및 Groq 전처리", label: "텍스트 입력·전처리", refs: ["read_user_inputs", "read_multiline_text", "preprocess_text_with_groq", "apply_tone_prompt"],
      summary: "read_user_inputs()가 합성할 텍스트와 톤 프롬프트를 입력받고, Groq LLM으로 TTS 스크립트로 전처리",
      detail: "'무엇을 어떤 톤으로 말할지' 정하는 단계임. 여러 줄로 텍스트를 입력받고, 차분하게·밝게 같은 톤 지시도 선택적으로 받음. 그 텍스트를 Groq의 LLM에 보내 (emotion_label|exaggeration=0.35|cfg_weight=0.60) 대사 형식의 희곡식 스크립트로 바꿔 받음. 숫자·영문 약어도 한글 발음으로 정규화됨.",
    },
    {
      step: 5, title: "TTS 모델 로드", label: "모델 로드",
      summary: "ChatterboxMultilingualTTS.from_pretrained()로 모델을 GPU(또는 CPU)에 올리고, denoiser 모델도 로드",
      detail: "'주방장(AI 모델)'을 불러오는 단계임. 첫 실행 시 약 500 MB의 모델 파일을 인터넷에서 받아 캐시에 저장함. GPU(CUDA)가 있으면 빠르게, 없으면 CPU로 느리게 실행함. 음성 잡음 제거용 denoiser(Facebook DNS 모델)도 함께 준비함.",
    },
    {
      step: 6, title: "음성 합성·노이즈 제거·연결", label: "합성·노이즈·연결", refs: ["generate_and_save_segments", "script_to_tts_lines", "save_pcm16_wav"],
      summary: "generate_and_save_segments()가 TTS 스크립트를 세그먼트로 나눠 합성·노이즈 제거 후 ffmpeg로 연결",
      detail: "'요리(음성 생성)' 단계임. Groq 스크립트를 TTSLine 목록으로 파싱하고, 세그먼트별로 model.generate()를 호출해 음성을 만든 뒤 denoiser로 잡음을 제거함. 세그먼트 사이에 짧은 묵음을 끼워 ffmpeg concat demuxer로 하나의 WAV 파일로 이어 붙임.",
    },
    {
      step: 7, title: "결과 저장 및 종료", label: "저장·종료",
      summary: "results/ 폴더에 타임스탬프 이름의 WAV 파일로 저장하고 경로·포맷·길이를 출력",
      detail: "완성된 요리를 접시에 담는 단계임. 합성된 음성 WAV를 results/result_YYYYMMDD_HHMMSS.wav 이름으로 저장함. Groq 전처리 스크립트도 scripts/ 폴더에 남겨 나중에 참고할 수 있게 함. 최종 출력 경로·포맷·길이를 화면에 안내하고 종료함.",
    },
  ],

  functions: [
    // ===== 환경 설정 =====
    {
      id: "configure_console",
      name: "configure_console()",
      fileId: "main",
      summary: "Windows 터미널에서 한글 입출력이 깨지지 않도록 stdin·stdout·stderr를 UTF-8로 설정함.",
      how: "Windows 명령 프롬프트는 기본 인코딩이 cp949(또는 EUC-KR)라 한글이 깨질 수 있음. hasattr로 reconfigure 기능이 있는지 확인한 뒤 UTF-8로 바꿈. Linux·Mac에서는 이미 UTF-8이라 아무 일도 안 함.",
      terms: ["sys.stdout.reconfigure", "인코딩(encoding)", "타입 힌트"],
      lines: [
        { at: 'for stream_name in ("stdin", "stdout", "stderr"):', text: "세 개의 입출력 채널(stdin=키보드 입력, stdout=일반 출력, stderr=오류 출력)을 차례로 처리함." },
        { at: 'stream = getattr(sys, stream_name, None)', text: "getattr로 sys.stdin 같은 속성을 꺼냄. None은 '없으면 이 값을 쓰라'는 기본값." },
        { at: 'if hasattr(stream, "reconfigure"):', text: "reconfigure 기능이 있는 채널(Windows 콘솔)만 설정함. 없으면 건너뜀." },
        { at: 'stream.reconfigure(encoding="utf-8", errors="replace")', text: "UTF-8로 재설정. errors='replace'는 변환 안 되는 글자를 ?로 대체해 오류 없이 출력함." },
      ],
      code:
`def configure_console() -> None:
    """Windows 터미널에서 UTF-8 입출력을 설정함."""
    for stream_name in ("stdin", "stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        # Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")`,
    },
    {
      id: "exit_with_error",
      name: "exit_with_error(message, guide)",
      fileId: "main",
      summary: "오류 메시지와 선택적 안내문을 출력하고 프로세스를 즉시 종료함.",
      how: "오류가 생겼을 때 '무슨 문제인지'와 '어떻게 해결하는지'를 같이 알려주는 전용 종료 함수임. raise SystemExit(1)은 종료 코드 1(실패)을 운영체제에 전달함. 여러 곳에서 공통으로 씀.",
      terms: ["raise SystemExit", "타입 힌트"],
      lines: [
        { at: 'print(f"\\n[Error] {message}")', text: "오류 메시지를 빈 줄 뒤에 출력함. [Error] 접두어로 사용자가 오류임을 바로 알 수 있게 함." },
        { at: 'if guide:', text: "guide가 있을 때만(None이 아닐 때만) 안내문도 출력함." },
        { at: 'raise SystemExit(1)', text: "종료 코드 1(실패)을 운영체제에 알리며 프로그램을 끝냄." },
      ],
      code:
`def exit_with_error(message: str, guide: str | None = None) -> None:
    """에러 메시지와 선택적 안내문을 출력하고 프로세스를 종료함."""
    print(f"\\n[Error] {message}")
    if guide:
        print(guide)
    raise SystemExit(1)`,
    },
    {
      id: "load_env_file",
      name: "load_env_file(env_path)",
      fileId: "main",
      summary: ".env 파일을 직접 파싱하여 {키: 값} 딕셔너리로 반환함.",
      how: ".env 파일을 줄 단위로 읽어 # 주석·빈 줄·= 없는 줄을 건너뜀. KEY=값에서 앞뒤 따옴표를 제거하고 BOM(파일 시작 숨은 문자)도 제거함. load_dotenv 대신 직접 파싱하는 이유는 의존성을 최소화하기 위함.",
      terms: ["딕셔너리(dict)", "splitlines()", "strip()", "타입 힌트"],
      lines: [
        { at: 'if not env_path.exists():', text: ".env 파일이 아예 없으면 빈 딕셔너리를 돌려줌(오류 없이 안전 처리)." },
        { at: 'for raw_line in env_path.read_text(encoding="utf-8").splitlines():', text: "파일을 통째로 읽어 줄 단위로 쪼갬. encoding='utf-8'은 한글이 깨지지 않게 함." },
        { at: 'if not line or line.startswith("#") or "=" not in line:', text: "빈 줄, 주석(#), 등호(=)가 없는 줄은 건너뜀." },
        { at: 'key, value = line.split("=", 1)', text: "첫 번째 = 기준으로 키와 값을 나눔. split(\"=\", 1)은 최대 1번만 나눔(값에 = 포함 허용)." },
        { at: 'key = key.strip().removeprefix("export ").strip().lstrip', text: "export 접두어와 BOM 문자를 제거해 순수 키만 남김." },
      ],
      code:
`def load_env_file(env_path: Path) -> dict[str, str]:
    """.env 파일을 파싱하여 {키: 값} 딕셔너리로 반환함."""
    values: dict[str, str] = {}
    if not env_path.exists():
        return values

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip().removeprefix("export ").strip().lstrip("\\ufeff")
        value = value.strip().strip('"').strip("'")
        if key:
            values[key] = value

    return values`,
    },
    {
      id: "get_groq_api_key",
      name: "get_groq_api_key()",
      fileId: "main",
      summary: "환경변수 또는 .env 파일에서 GROQ_API_KEY를 읽어 반환함. 없으면 안내 후 종료.",
      how: "먼저 이미 메모리에 올라온 환경변수(os.environ)에서 키를 찾고, 없으면 .env 파일을 직접 읽어 찾음. 두 곳 모두 없으면 설정 방법을 안내하고 종료함.",
      terms: ["환경변수(.env)", "API 키", "os.environ"],
      lines: [
        { at: 'api_key = os.environ.get("GROQ_API_KEY", "").strip()', text: "os.environ에서 이미 로드된 환경변수를 먼저 확인함. 없으면 빈 문자열을 받음." },
        { at: 'env_values = load_env_file(HANDS_ON_ENV_PATH)', text: "환경변수에 없으면 .env 파일을 직접 파싱해 키를 찾음." },
        { at: 'exit_with_error(', text: "두 곳 모두에 키가 없으면 설정 위치와 형식을 안내하고 종료함." },
      ],
      code:
`def get_groq_api_key() -> str:
    """환경변수 또는 .env 파일에서 GROQ_API_KEY를 읽어 반환함. 없으면 종료."""
    # GROQ_API_KEY: Groq LLM API 인증에 사용하는 비밀 키
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if api_key:
        return api_key

    env_values = load_env_file(HANDS_ON_ENV_PATH)
    api_key = env_values.get("GROQ_API_KEY", "").strip()
    if api_key:
        return api_key

    exit_with_error(
        "GROQ_API_KEY not found.",
        "\\n".join(
            [
                f"Set GROQ_API_KEY in {HANDS_ON_ENV_PATH}",
                "Example: GROQ_API_KEY=gsk_...",
            ]
        ),
    )`,
    },
    {
      id: "make_run_paths",
      name: "make_run_paths()",
      fileId: "main",
      summary: "타임스탬프 기반 결과 WAV 경로와 스크립트 저장 경로를 만들어 반환함.",
      how: "실행할 때마다 다른 파일 이름을 쓰기 위해 현재 시각(한국 표준시)으로 이름을 만듦. results/ 와 scripts/ 폴더가 없으면 미리 만들어 둠.",
      terms: ["ZoneInfo", "datetime", "Path", "tuple(튜플)"],
      lines: [
        { at: 'timestamp = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y%m%d_%H%M%S")', text: "한국 표준시(KST) 기준 현재 시각을 '20250530_143022' 형태 문자열로 만듦." },
        { at: 'SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)', text: "scripts/ 폴더가 없으면 만듦. exist_ok=True는 이미 있어도 오류 없이 넘어감." },
        { at: 'return (', text: "결과 WAV 경로와 스크립트 txt 경로를 튜플(두 값을 묶은 쌍)로 돌려줌." },
      ],
      code:
`def make_run_paths() -> tuple[Path, Path]:
    """타임스탬프 기반 결과 WAV 및 스크립트 경로를 생성하여 반환함."""
    timestamp = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y%m%d_%H%M%S")
    SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    return (
        RESULTS_DIR / f"result_{timestamp}.wav",
        SCRIPTS_DIR / f"script_{timestamp}.txt",
    )`,
    },
    {
      id: "check_prerequisites",
      name: "check_prerequisites()",
      fileId: "main",
      summary: "PyTorch·torchaudio·ffmpeg·chatterbox-tts·groq 설치 여부를 확인하고 RuntimeDeps를 반환함.",
      how: "각 패키지를 import해 보고 실패하면 설치 방법을 안내하고 종료함. ffmpeg는 파이썬 패키지가 아니라 시스템 도구라, shutil.which로 'PATH에 명령이 있는지'를 확인함. 모두 통과하면 RuntimeDeps 상자에 담아 반환해 이후 코드가 재import 없이 씀.",
      terms: ["import", "shutil.which", "RuntimeDeps(dataclass)", "예외 처리(try/except)"],
      lines: [
        { at: 'check_python_version()', text: "Python 3.12 또는 3.13이어야 함. 다른 버전이면 안내 후 종료." },
        { at: '"PyTorch is not installed."', text: "try 블록 안에서 import를 시도함. ImportError가 나면 except에서 안내 후 종료." },
        { at: 'if shutil.which("ffmpeg") is None:', text: "shutil.which는 시스템 PATH에서 명령어를 찾아줌. None이면 ffmpeg가 없다는 뜻." },
        { at: 'from chatterbox.mtl_tts import ChatterboxMultilingualTTS', text: "chatterbox-tts 설치 여부 확인. 없으면 pip install -r requirements.txt 안내." },
        { at: 'return RuntimeDeps(torch=torch, model_class=ChatterboxMultilingualTTS, groq_client_class=Groq)', text: "검사를 모두 통과하면 필요한 객체들을 RuntimeDeps 상자에 담아 반환함." },
      ],
      code:
`def check_prerequisites() -> RuntimeDeps:
    """PyTorch, torchaudio, ffmpeg, chatterbox-tts, groq 설치 여부를 확인하고 RuntimeDeps를 반환함."""
    check_python_version()

    try:
        import torch
    except ImportError:
        exit_with_error(
            "PyTorch is not installed.",
            "\\n".join(
                [
                    "Install PyTorch CUDA build outside the venv first.",
                    f"Guide: {PYTORCH_GUIDE_URL}",
                    "Example: py -3.12 -m pip install torch torchvision torchaudio "
                    "--index-url https://download.pytorch.org/whl/cu126",
                ]
            ),
        )

    try:
        import torchaudio  # noqa: F401
    except ImportError:
        exit_with_error(
            "torchaudio is not installed.",
            "\\n".join(
                [
                    "Install the PyTorch package set outside the venv first.",
                    f"Guide: {PYTORCH_GUIDE_URL}",
                ]
            ),
        )

    if shutil.which("ffmpeg") is None:
        exit_with_error(
            "ffmpeg is not installed or not available on PATH.",
            "\\n".join(
                [
                    "ffmpeg is a system tool and must not be installed via pip.",
                    "Windows: winget install ffmpeg",
                    "macOS: brew install ffmpeg",
                    "Linux: sudo apt install ffmpeg",
                ]
            ),
        )

    warnings.filterwarnings(
        "ignore",
        message="pkg_resources is deprecated as an API.*",
        category=UserWarning,
    )

    try:
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    except ImportError as exc:
        exit_with_error(
            f"chatterbox-tts import failed: {exc}",
            "Install project dependencies with: pip install -r requirements.txt",
        )

    try:
        import numpy  # noqa: F401
        import scipy  # noqa: F401
    except ImportError as exc:
        exit_with_error(
            f"required Python package import failed: {exc}",
            "Install project dependencies with: pip install -r requirements.txt",
        )

    try:
        from groq import Groq
    except ImportError as exc:
        exit_with_error(
            f"groq import failed: {exc}",
            "Install project dependencies with: pip install -r requirements.txt",
        )

    return RuntimeDeps(torch=torch, model_class=ChatterboxMultilingualTTS, groq_client_class=Groq)`,
    },
    {
      id: "patch_chatterbox",
      name: "patch_chatterbox_alignment_analyzer()",
      fileId: "main",
      summary: "짧은 세그먼트에서 발생하는 Chatterbox 내부 IndexError를 monkey-patch로 우회 처리함.",
      how: "라이브러리 내부 버그를 직접 수정할 수 없을 때, 외부에서 함수를 안전한 버전으로 바꿔치기하는 기법을 monkey-patch라 함. 이미 패치됐는지 표시(_safe_empty_slice_patch)를 확인해 중복 적용을 막음.",
      terms: ["monkey-patch", "예외 처리(try/except)", "IndexError"],
      lines: [
        { at: 'from chatterbox.models.t3.inference.alignment_stream_analyzer import AlignmentStreamAnalyzer', text: "Chatterbox 내부 모듈을 가져옴. 없으면 return으로 건너뜀(패치 불필요)." },
        { at: 'if getattr(AlignmentStreamAnalyzer.step, "_safe_empty_slice_patch", False):', text: "이미 패치가 적용됐으면 다시 하지 않음. getattr은 속성이 없으면 False를 기본값으로 반환함." },
        { at: 'original_step = AlignmentStreamAnalyzer.step', text: "원래 함수를 변수에 저장해 둠. 새 함수 안에서 원래 함수를 감싸는 방식으로 사용함." },
        { at: 'safe_step._safe_empty_slice_patch = True', text: "패치 완료 표시를 함수에 붙여, 다음 실행 시 중복 패치를 막음." },
        { at: 'AlignmentStreamAnalyzer.step = safe_step', text: "라이브러리의 함수를 안전한 버전으로 교체함(monkey-patch 핵심 줄)." },
      ],
      code:
`def patch_chatterbox_alignment_analyzer() -> None:
    """짧은 세그먼트에서 발생하는 Chatterbox IndexError를 빈 슬라이스 복구 래퍼로 패치함."""
    try:
        from chatterbox.models.t3.inference.alignment_stream_analyzer import AlignmentStreamAnalyzer
    except ImportError:
        return

    if getattr(AlignmentStreamAnalyzer.step, "_safe_empty_slice_patch", False):
        return

    original_step = AlignmentStreamAnalyzer.step

    def safe_step(self, logits, next_token=None):
        try:
            return original_step(self, logits, next_token=next_token)
        except IndexError as exc:
            message = str(exc)
            if "Expected reduction dim 1 to have non-zero size" in message:
                return logits
            raise

    safe_step._safe_empty_slice_patch = True
    # 라이브러리 내부 함수를 수정된 버전으로 교체함 (monkey-patch)
    AlignmentStreamAnalyzer.step = safe_step`,
    },
    {
      id: "scan_voice_sources",
      name: "scan_voice_sources()",
      fileId: "main",
      summary: "voices/ 폴더에서 오디오 파일을 탐색하여 이름 오름차순으로 정렬된 목록을 반환함.",
      how: "VOICES_DIR.iterdir()로 폴더 안의 항목을 하나씩 훑어, 파일이면서 숨김 파일(.)이 아니고 오디오 후보인 것만 모음. key=lambda item: item.name.lower()로 대소문자 관계없이 이름 순으로 정렬함.",
      terms: ["리스트 컴프리헨션", "sorted()", "lambda", "set(집합)"],
      lines: [
        { at: 'VOICES_DIR.mkdir(parents=True, exist_ok=True)', text: "voices/ 폴더가 없으면 만듦. 있으면 아무 일도 안 함." },
        { at: 'if path.is_file() and not path.name.startswith(".")', text: "iterdir()로 폴더 안의 항목을 하나씩 꺼냄. 제너레이터 표현식으로 조건에 맞는 것만 모음." },
        { at: 'key=lambda item: item.name.lower()', text: "정렬 기준을 '이름 소문자'로 지정. 대문자 Voice.mp3와 소문자 voice.wav를 동등하게 비교함." },
      ],
      code:
`def scan_voice_sources() -> list[Path]:
    """voices/ 디렉터리에서 오디오 파일을 탐색하여 정렬된 목록을 반환함."""
    VOICES_DIR.mkdir(parents=True, exist_ok=True)
    return sorted(
        (
            path
            for path in VOICES_DIR.iterdir()
            if path.is_file() and not path.name.startswith(".") and is_audio_candidate(path)
        ),
        key=lambda item: item.name.lower(),
    )`,
    },
    {
      id: "convert_to_wav",
      name: "convert_to_wav(source)",
      fileId: "main",
      summary: "비-WAV 오디오 파일을 ffmpeg로 WAV로 변환하여 경로를 반환함. 이미 WAV이면 그대로 반환.",
      how: "Chatterbox는 WAV 파일만 참조 음성으로 받음. mp3·m4a 등은 ffmpeg 명령을 subprocess.run으로 실행해 WAV로 변환함. 이미 변환된 WAV가 있으면 다시 변환하지 않고 재사용함(캐싱).",
      terms: ["subprocess.run", "ffmpeg", "캐싱(cache)", "returncode"],
      lines: [
        { at: 'if source.suffix.lower() == ".wav":', text: "이미 WAV 파일이면 변환 없이 그대로 반환함." },
        { at: 'if target.exists() and target.stat().st_size > 0:', text: "변환된 WAV가 이미 있고 크기가 0보다 크면(정상 파일이면) 재사용함." },
        { at: 'result = subprocess.run(', text: "subprocess.run으로 ffmpeg 명령을 실행함. 파이썬에서 외부 프로그램을 실행하는 방법임." },
        { at: 'if result.returncode != 0:', text: "ffmpeg 종료 코드가 0이 아니면 실패. 오류 메시지를 보여주고 종료함." },
      ],
      code:
`def convert_to_wav(source: Path) -> Path:
    """비-WAV 오디오를 ffmpeg로 WAV로 변환하여 경로를 반환함. 이미 WAV이면 그대로 반환."""
    if source.suffix.lower() == ".wav":
        return source

    target = source.with_suffix(".wav")
    if target.exists() and target.stat().st_size > 0:
        print(f"[Voice] Reuse converted WAV: {target.name}")
        return target

    print(f"[Voice] Convert with ffmpeg: {source.name} -> {target.name}")
    result = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source),
            "-vn",
            "-ac",
            "1",
            "-ar",
            str(REFERENCE_SAMPLE_RATE),
            "-c:a",
            "pcm_s16le",
            str(target),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    if result.returncode != 0:
        exit_with_error(
            f"ffmpeg failed to convert reference audio: {source.name}",
            result.stderr.strip() or "Check whether the file is a valid audio file.",
        )

    return target`,
    },
    {
      id: "prepare_reference_voices",
      name: "prepare_reference_voices()",
      fileId: "main",
      summary: "voices/ 폴더의 오디오를 WAV로 변환·중복 제거하여 사용 가능한 WAV 목록을 반환함.",
      how: "scan_voice_sources()로 파일 목록을 찾고, convert_to_wav()로 하나씩 변환함. 같은 WAV 경로가 중복 생성되지 않도록 딕셔너리(wav_by_path)로 관리함. 파일이 하나도 없으면 안내 후 종료함.",
      terms: ["딕셔너리(dict)", "캐싱(cache)", "리스트(list)"],
      lines: [
        { at: 'sources = scan_voice_sources()', text: "voices/ 폴더에서 오디오 파일 목록을 가져옴." },
        { at: 'if not sources:', text: "파일이 없으면 넣을 파일 이름 예시와 권장 조건을 안내하고 종료함." },
        { at: 'wav_by_path: dict[str, Path] = {}', text: "같은 WAV 경로가 중복되지 않도록 '경로 문자열→Path' 딕셔너리로 관리함." },
        { at: 'wav_path = convert_to_wav(source)', text: "각 파일을 WAV로 변환(또는 재사용)하여 딕셔너리에 저장함." },
        { at: 'wav_files = sorted(wav_by_path.values(), key=lambda item: item.name.lower())', text: "중복 제거된 WAV 목록을 이름순으로 정렬해 최종 결과로 만듦." },
      ],
      code:
`def prepare_reference_voices() -> list[Path]:
    """voices/의 오디오를 WAV로 변환·중복 제거하여 사용 가능한 WAV 목록을 반환함."""
    sources = scan_voice_sources()
    if not sources:
        exit_with_error(
            f"No reference audio files found in {VOICES_DIR}",
            "\\n".join(
                [
                    "Place at least one reference voice file in voices/.",
                    "Recommended names: user.wav, user.mp3, user.m4a",
                    "Recommended clip: about 10 seconds, single speaker, low background noise.",
                ]
            ),
        )

    print("\\n[Voice] Found reference audio files:")
    for source in sources:
        print(f"  - {source.name}")

    wav_by_path: dict[str, Path] = {}
    for source in sources:
        wav_path = convert_to_wav(source)
        wav_by_path[str(wav_path.resolve()).lower()] = wav_path

    wav_files = sorted(wav_by_path.values(), key=lambda item: item.name.lower())
    if not wav_files:
        exit_with_error("No usable WAV reference audio files found.")

    return wav_files`,
    },
    {
      id: "select_reference_voice",
      name: "select_reference_voice(wav_files)",
      fileId: "main",
      summary: "WAV 목록에서 사용자가 번호로 참조 음성을 선택하게 함. 1개이면 자동 선택.",
      how: "파일이 하나면 자동 선택하여 사용자 입력을 생략함. 여러 개면 번호 목록을 보여주고 while True 반복으로 올바른 번호를 입력할 때까지 다시 물음. EOFError는 파이프 입력처럼 대화형이 아닐 때 발생하므로 안내 후 종료함.",
      terms: ["while 반복", "EOFError", "input()", "enumerate()"],
      lines: [
        { at: 'if len(wav_files) == 1:', text: "파일이 하나면 묻지 않고 자동 선택함." },
        { at: 'for index, wav_path in enumerate(wav_files, start=1):', text: "enumerate로 1번부터 번호를 매겨 이름과 크기(KB)를 출력함." },
        { at: 'choice = input(f"Select number (1-{len(wav_files)}): ").strip()', text: "input()으로 번호를 입력받음. EOFError가 나면 대화형이 아닌 환경이라 안내 후 종료함." },
        { at: 'if choice.isdigit():', text: "입력이 숫자인지 확인. 숫자가 아니면 안내 메시지를 출력하고 다시 입력받음." },
        { at: 'if 1 <= index <= len(wav_files):', text: "번호가 범위 안이면 해당 파일을 선택해 반환함(목록은 0부터라 index-1)." },
      ],
      code:
`def select_reference_voice(wav_files: list[Path]) -> Path:
    """WAV 목록에서 사용자가 선택한 참조 음성 경로를 반환함. 1개이면 자동 선택."""
    if len(wav_files) == 1:
        selected = wav_files[0]
        print(f"\\n[Voice] Use reference voice: {selected.name}")
        return selected

    print("\\n[Voice] Select one reference voice for this run.")
    for index, wav_path in enumerate(wav_files, start=1):
        size_kb = wav_path.stat().st_size // 1024
        print(f"  {index}. {wav_path.name} ({size_kb} KB)")

    while True:
        try:
            choice = input(f"Select number (1-{len(wav_files)}): ").strip()
        except EOFError:
            exit_with_error("Multiple reference voices found. Rerun interactively and select one.")

        if choice.isdigit():
            index = int(choice)
            if 1 <= index <= len(wav_files):
                selected = wav_files[index - 1]
                print(f"[Voice] Selected: {selected.name}")
                return selected

        print("Invalid selection. Please enter a valid number.")`,
    },
    {
      id: "apply_tone_prompt",
      name: "apply_tone_prompt(source_text, tone_prompt)",
      fileId: "main",
      summary: "톤 프롬프트 키워드를 분석해 exaggeration·cfg_weight 값을 결정한 ToneDecision을 반환함.",
      how: "사용자가 '차분하게', '밝고 활기차게' 같이 입력한 톤 지시어를 분석해, Chatterbox TTS의 두 파라미터 값으로 변환함. exaggeration은 감정 표현 강도(높을수록 과장됨), cfg_weight는 화자 일관성(높을수록 단조롭고 명확함). contains_any 도우미로 키워드를 간결하게 검사함.",
      terms: ["ToneDecision(dataclass)", "exaggeration", "cfg_weight", "contains_any"],
      lines: [
        { at: 'exaggeration = DEFAULT_EXAGGERATION', text: "키워드가 없으면 기본값(0.5)으로 시작함. 아래 조건에서 해당하면 덮어씀." },
        { at: 'if contains_any(prompt_lower, ("극적", "감정", "연기", "dramatic", "emotional")):', text: "극적·감정적 키워드면 exaggeration을 높이고 cfg_weight를 낮춰 다양한 억양을 냄." },
        { at: '"뉴스", "앵커", "또렷"', text: "뉴스 앵커 스타일이면 exaggeration을 낮추고 cfg_weight를 높여 또렷하고 일관된 발음을 냄." },
        { at: 'if contains_any(prompt_lower, ("느리", "천천히", "slow")):', text: "'느리게' 키워드가 있으면 cfg_weight를 추가로 낮춰 억양 변화를 줄임." },
        { at: 'return ToneDecision(', text: "결정된 파라미터를 ToneDecision 상자에 담아 반환함." },
      ],
      code:
`def apply_tone_prompt(source_text: str, tone_prompt: str) -> ToneDecision:
    """톤 프롬프트 키워드를 분석하여 exaggeration·cfg_weight를 결정한 ToneDecision을 반환함."""
    prompt = tone_prompt.strip()
    prompt_lower = prompt.lower()
    exaggeration = DEFAULT_EXAGGERATION
    cfg_weight = DEFAULT_CFG_WEIGHT

    if contains_any(prompt_lower, ("극적", "감정", "연기", "dramatic", "emotional")):
        exaggeration = 0.75
        cfg_weight = 0.35
    elif contains_any(prompt_lower, ("밝", "활기", "신나", "경쾌", "energetic", "bright", "cheerful")):
        exaggeration = 0.65
        cfg_weight = 0.45
    elif contains_any(
        prompt_lower,
        ("뉴스", "앵커", "또렷", "명확", "차분한 보도", "news", "anchor", "clear"),
    ):
        exaggeration = 0.35
        cfg_weight = 0.65
    elif contains_any(
        prompt_lower,
        ("차분", "다정", "부드럽", "온화", "잔잔", "calm", "warm", "gentle", "soft"),
    ):
        exaggeration = 0.35
        cfg_weight = 0.55

    if contains_any(prompt_lower, ("느리", "천천히", "slow")):
        cfg_weight = min(cfg_weight, 0.4)

    return ToneDecision(
        prompt=prompt,
        text=source_text,
        exaggeration=exaggeration,
        cfg_weight=cfg_weight,
    )`,
    },
    {
      id: "split_text_for_groq",
      name: "split_text_for_groq(text, max_chars)",
      fileId: "main",
      summary: "텍스트를 Groq API 청크 크기 제한에 맞게 분할하여 청크 목록을 반환함.",
      how: "Groq API에는 한 번에 보낼 수 있는 글자 수 제한이 있음. 먼저 빈 줄 기준으로 문단을 나누고, 문단이 제한보다 크면 split_text_for_tts로 더 작게 쪼갬. 여러 작은 조각을 합쳐도 제한 이하면 하나로 묶어 API 호출 횟수를 줄임.",
      terms: ["정규식(re)", "리스트(list)", "타입 힌트"],
      lines: [
        { at: 'blocks = [block.strip() for block in re.split(r"\\n\\s*\\n", text) if block.strip()]', text: "빈 줄(\\n\\n) 기준으로 문단을 나눔. 정규식 \\n\\s*\\n은 '빈 줄 사이 공백도 허용'함." },
        { at: 'candidate = f"{current}\\n\\n{block}".strip()', text: "현재 모은 내용에 새 문단을 붙여봄. 제한을 넘지 않으면 합쳐서 계속 모음." },
        { at: 'current = block', text: "제한을 초과하면 현재까지 모은 것을 청크로 확정하고, 새 문단으로 다시 시작함." },
        { at: 'for segment in split_text_for_tts(block, max_chars=max_chars):', text: "문단 하나가 이미 너무 크면 split_text_for_tts로 더 잘게 쪼갬." },
        { at: 'return chunks or [text]', text: "분할 결과가 없으면(text 전체가 기준 이하면) 원본 텍스트를 그대로 한 덩어리로 반환함." },
      ],
      code:
`def split_text_for_groq(text: str, max_chars: int = GROQ_PREPROCESS_CHARS) -> list[str]:
    """텍스트를 Groq 청크 크기 제한에 맞게 분할하여 청크 목록을 반환함."""
    chunks: list[str] = []
    current = ""

    blocks = [block.strip() for block in re.split(r"\\n\\s*\\n", text) if block.strip()]
    for block in blocks:
        if len(block) <= max_chars:
            candidate = f"{current}\\n\\n{block}".strip()
            if current and len(candidate) > max_chars:
                chunks.append(current)
                current = block
            else:
                current = candidate
            continue

        for segment in split_text_for_tts(block, max_chars=max_chars):
            candidate = f"{current}\\n\\n{segment}".strip()
            if current and len(candidate) > max_chars:
                chunks.append(current)
                current = segment
            else:
                current = candidate

    if current:
        chunks.append(current)

    return chunks or [text]`,
    },
    {
      id: "build_groq_prompts",
      name: "build_groq_prompts(source_text, tone_prompt)",
      fileId: "main",
      summary: "Groq API 호출용 시스템 프롬프트와 사용자 프롬프트 튜플을 생성하여 반환함.",
      how: "시스템 프롬프트에 TTS 전처리 전문가 역할과 출력 형식 규칙을 상세히 담음: 희곡식 큐 형식, 숫자·약어 한글화, 감정 레이블 목록 등. 사용자 프롬프트에는 톤 지시와 원본 텍스트를 넣음.",
      terms: ["시스템 프롬프트", "tuple(튜플)", "f-string"],
      lines: [
        { at: 'tone = tone_prompt.strip() or "default natural Korean narration"', text: "톤 프롬프트가 비어있으면 '기본 자연스러운 한국어 내레이션'으로 대체함." },
        { at: 'Each spoken line must start with one cue in this exact format:', text: "AI에게 각 줄이 반드시 (emotion_label|exaggeration=값|cfg_weight=값) 형식으로 시작해야 한다고 지시함." },
        { at: 'user_prompt = f"Tone prompt:\\n{tone}\\n\\nUser text:\\n{source_text}"', text: "사용자 프롬프트는 톤 지시와 원본 텍스트로 구성함." },
        { at: 'return system_prompt, user_prompt', text: "시스템 프롬프트와 사용자 프롬프트를 튜플로 함께 반환함." },
      ],
      code:
`def build_groq_prompts(source_text: str, tone_prompt: str) -> tuple[str, str]:
    """Groq API 호출용 시스템 프롬프트와 사용자 프롬프트 튜플을 생성하여 반환함."""
    tone = tone_prompt.strip() or "default natural Korean narration"
    system_prompt = (
        "You are a Korean TTS preprocessing specialist for Resemble AI Chatterbox Multilingual. "
        "Return only a plain text stage script. Do not return JSON, markdown, bullets, explanations, or code fences. "
        "Each spoken line must start with one cue in this exact format: "
        "(emotion_label|exaggeration=0.35|cfg_weight=0.60) dialogue. "
        "Use concise emotion labels: calm_clear, warm_gentle, bright_energetic, news_anchor, "
        "serious_apology, emphatic, concerned, encouraging, reflective. "
        "Chatterbox emotion is controlled by exaggeration and cfg_weight. "
        "For calm/news use exaggeration 0.30-0.45 and cfg_weight 0.60-0.75. "
        "For bright/emphatic use exaggeration 0.55-0.75 and cfg_weight 0.40-0.60. "
        "Preserve all facts, names, dates, amounts, quotations, and meaning. "
        "Do not summarize, add, omit, or translate. "
        "Normalize Korean numbers, dates, percentages, and money into Hangul reading forms. "
        "Normalize uppercase acronyms into Korean pronunciation: AI -> 에이아이, AM -> 에이엠, SDLC -> 에스디엘시. "
        "Convert other all-caps acronyms letter by letter. "
        "Do not leave raw Arabic numerals or all-caps acronyms in dialogue unless they are IDs/codes. "
        "Use [laugh], [cough], or [chuckle] only if the tone explicitly requests such non-speech sounds."
    )
    user_prompt = f"Tone prompt:\\n{tone}\\n\\nUser text:\\n{source_text}"
    return system_prompt, user_prompt`,
    },
    {
      id: "call_groq_for_script",
      name: "call_groq_for_script(client, source_text, tone_prompt, part_label, max_chars)",
      fileId: "main",
      summary: "Groq API를 호출해 TTS 스크립트를 생성하고 반환함. 토큰 초과 시 재귀 분할하여 재시도.",
      how: "client.chat.completions.create로 LLM에 프롬프트를 보냄. finish_reason이 'length'이면 응답이 잘렸다는 뜻이므로, 텍스트를 반으로 나눠 각각 재귀 호출함. 재귀 깊이가 깊어지지 않도록 최소 청크 크기(GROQ_PREPROCESS_MIN_CHARS)를 두어 무한 분할을 막음.",
      terms: ["재귀(recursion)", "finish_reason", "Groq", "LLM", "예외 처리(try/except)"],
      lines: [
        { at: 'completion = client.chat.completions.create(', text: "Groq API를 호출해 LLM 응답을 받음. temperature=0.15는 일관성 있는 결과를 냄." },
        { at: 'finish_reason = getattr(choice, "finish_reason", None)', text: "응답이 왜 끝났는지 확인. 'length'이면 토큰 초과로 잘린 것임." },
        { at: 'if finish_reason in {"length", "max_tokens"}:', text: "토큰이 초과됐으면 텍스트를 더 잘게 나눠 재귀 호출함." },
        { at: 'smaller_max_chars = max(GROQ_PREPROCESS_MIN_CHARS, max_chars // 2)', text: "청크 크기를 절반으로 줄임. 최소값 미만으로 내려가지 않도록 max()로 하한을 지킴." },
        { at: 'return (choice.message.content or "").strip()', text: "정상 종료이면 응답 텍스트를 꺼내 앞뒤 공백을 제거하고 반환함." },
      ],
      code:
`def call_groq_for_script(
    client: object,
    source_text: str,
    tone_prompt: str,
    part_label: str,
    max_chars: int = GROQ_PREPROCESS_CHARS,
) -> str:
    """Groq API를 호출하여 TTS 스크립트를 생성하고 텍스트로 반환함. 토큰 초과 시 재귀 분할."""
    system_prompt, user_prompt = build_groq_prompts(source_text, tone_prompt)
    try:
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.15,
            max_completion_tokens=GROQ_PREPROCESS_MAX_TOKENS,
        )
    except Exception as exc:
        exit_with_error(
            f"Groq preprocessing failed at {part_label}: {exc}",
            "This is usually caused by a long input. The script now preprocesses in smaller chunks; try shortening one paragraph if it persists.",
        )

    choice = completion.choices[0]
    finish_reason = getattr(choice, "finish_reason", None)

    if finish_reason in {"length", "max_tokens"}:
        if len(source_text) <= GROQ_PREPROCESS_MIN_CHARS or max_chars <= GROQ_PREPROCESS_MIN_CHARS:
            exit_with_error(
                f"Groq preprocessing was truncated at {part_label}.",
                "The input chunk is already small. Try simplifying that paragraph or reducing tone instructions.",
            )

        smaller_max_chars = max(GROQ_PREPROCESS_MIN_CHARS, max_chars // 2)
        print(
            f"[Preprocess] {part_label} reached token limit; "
            f"retrying with {smaller_max_chars}-char chunks."
        )
        sub_chunks = split_text_for_groq(source_text, max_chars=smaller_max_chars)
        sub_scripts = [
            call_groq_for_script(
                client,
                sub_chunk,
                tone_prompt,
                f"{part_label}.{sub_index}",
                max_chars=smaller_max_chars,
            )
            for sub_index, sub_chunk in enumerate(sub_chunks, start=1)
        ]
        return "\\n".join(script for script in sub_scripts if script.strip())

    return (choice.message.content or "").strip()`,
    },
    {
      id: "preprocess_text_with_groq",
      name: "preprocess_text_with_groq(groq_client_class, source_text, tone_prompt, script_path)",
      fileId: "main",
      summary: "Groq LLM으로 입력 텍스트를 TTS 스크립트로 전처리하고, 파일에 저장 후 반환함.",
      how: "API 키를 읽어 Groq 클라이언트를 만들고, 텍스트를 청크로 나눠 각각 call_groq_for_script를 호출함. 결과 청크들을 합쳐 빈 줄을 제거한 뒤 script_path에 파일로 저장해 나중에 검토할 수 있게 함.",
      terms: ["Groq", "LLM", "API 키", "splitlines()", "write_text"],
      lines: [
        { at: 'api_key = get_groq_api_key()', text: "API 키를 환경변수 또는 .env에서 읽어옴." },
        { at: 'client = groq_client_class(api_key=api_key)', text: "Groq 클라이언트 객체를 만듦. groq_client_class는 check_prerequisites()가 반환한 Groq 클래스임." },
        { at: 'chunks = split_text_for_groq(source_text)', text: "긴 텍스트를 청크로 나눔. 짧으면 하나의 청크로 처리됨." },
        { at: 'script_chunk = call_groq_for_script(client, chunk, tone_prompt, label)', text: "각 청크를 Groq API로 희곡식 TTS 스크립트로 변환함." },
        { at: 'preprocessed = "\\n".join(line.strip() for line in combined.splitlines() if line.strip())', text: "빈 줄 제거 및 줄별 앞뒤 공백 정리 후 하나의 문자열로 합침." },
        { at: 'script_path.write_text(preprocessed + "\\n", encoding="utf-8")', text: "전처리된 스크립트를 파일로 저장함. 나중에 내용을 확인하거나 재사용할 수 있음." },
      ],
      code:
`def preprocess_text_with_groq(
    groq_client_class: object,
    source_text: str,
    tone_prompt: str,
    script_path: Path,
) -> str:
    """Groq LLM으로 입력 텍스트를 TTS 스크립트로 전처리하고 파일에 저장 후 반환함."""
    api_key = get_groq_api_key()
    client = groq_client_class(api_key=api_key)
    chunks = split_text_for_groq(source_text)

    print(f"[Preprocess] Groq model: {GROQ_MODEL}")
    print(f"[Preprocess] Input split into {len(chunks)} chunk(s).")

    scripts: list[str] = []
    for index, chunk in enumerate(chunks, start=1):
        label = f"chunk {index}/{len(chunks)}"
        print(f"[Preprocess] {label} ({len(chunk)} chars)")
        script_chunk = call_groq_for_script(client, chunk, tone_prompt, label)
        if script_chunk:
            scripts.append(script_chunk)

    combined = "\\n".join(scripts)
    preprocessed = "\\n".join(line.strip() for line in combined.splitlines() if line.strip())
    if not preprocessed:
        exit_with_error("Groq returned empty preprocessed text.")

    script_path.write_text(preprocessed + "\\n", encoding="utf-8")
    print(f"[Preprocess] Script saved: {script_path}")

    return preprocessed`,
    },
    {
      id: "read_multiline_text",
      name: "read_multiline_text()",
      fileId: "main",
      summary: "EOD를 입력할 때까지 여러 줄 텍스트를 입력받아 하나의 문자열로 반환함.",
      how: "한 줄 input()을 while True로 반복해 여러 줄 텍스트를 받음. 첫 줄은 '>  ' 프롬프트, 이어지는 줄은 '. ' 프롬프트로 구분함. 'EOD'만 단독으로 입력하거나 EOF(Ctrl+D/Z)가 오면 반복을 끊음.",
      terms: ["input()", "while 반복", "EOFError", "strip()", "join()"],
      lines: [
        { at: 'lines: list[str] = []', text: "입력받은 줄들을 모을 빈 목록을 만듦." },
        { at: 'prompt = "> " if not lines else ". "', text: "아직 줄이 없으면 '> ', 이미 있으면 '. ' 프롬프트를 사용함." },
        { at: 'if line.strip().upper() == INPUT_END_MARKER:', text: "입력한 줄을 공백 제거 후 대문자로 바꿔 'EOD'와 비교함. 같으면 입력 종료." },
        { at: 'return "\\n".join(lines).strip()', text: "모든 줄을 줄바꿈으로 이어붙여 하나의 문자열로 만들고 앞뒤 공백을 제거함." },
      ],
      code:
`def read_multiline_text() -> str:
    """여러 줄 텍스트를 입력받아 하나의 문자열로 반환함. EOD 입력 시 종료."""
    print(f"Text to synthesize. Type {INPUT_END_MARKER} on its own line to finish.")
    print(f"Type {INPUT_END_MARKER} without text to exit.")

    lines: list[str] = []
    while True:
        prompt = "> " if not lines else ". "
        try:
            line = input(prompt)
        except EOFError:
            break

        if line.strip().upper() == INPUT_END_MARKER:
            break
        lines.append(line.rstrip())

    return "\\n".join(lines).strip()`,
    },
    {
      id: "read_user_inputs",
      name: "read_user_inputs(groq_client_class, script_path)",
      fileId: "main",
      summary: "텍스트와 톤 프롬프트를 입력받아 Groq 전처리 후 ToneDecision을 반환함. 빈 입력이면 None.",
      how: "사용자 입력의 모든 단계를 조율하는 함수임. 텍스트 → 톤 프롬프트 → Groq 전처리 → 파라미터 계산(apply_tone_prompt) 순으로 진행함. 텍스트가 비어 있으면 None을 반환해 메인 함수가 조용히 종료하도록 신호함.",
      terms: ["ToneDecision(dataclass)", "Groq", "LLM", "타입 힌트"],
      lines: [
        { at: 'source_text = read_multiline_text()', text: "여러 줄 입력을 받아 하나의 문자열로 모음." },
        { at: 'if not source_text:', text: "텍스트가 비어있으면 None을 반환하고 메인 함수에서 종료하게 함." },
        { at: 'tone_prompt = input(f"Tone prompt (optional, e.g. {TONE_EXAMPLES}): ").strip()', text: "톤 프롬프트를 한 줄로 입력받음. 생략하면 빈 문자열이 됨." },
        { at: 'source_text = preprocess_text_with_groq(groq_client_class, source_text, tone_prompt, script_path)', text: "Groq LLM으로 희곡식 TTS 스크립트로 변환함. 결과로 source_text를 덮어씀." },
        { at: 'decision = apply_tone_prompt(source_text, tone_prompt)', text: "톤 키워드를 분석해 exaggeration·cfg_weight 파라미터를 결정함." },
      ],
      code:
`def read_user_inputs(groq_client_class: object, script_path: Path) -> ToneDecision | None:
    """텍스트와 톤 프롬프트를 입력받아 Groq 전처리 후 ToneDecision을 반환함. 빈 입력이면 None."""
    print("\\n[Input] Korean text is synthesized directly with language_id=\\"ko\\".")
    source_text = read_multiline_text()

    if not source_text:
        print("[Exit] Empty text input.")
        return None

    try:
        tone_prompt = input(f"Tone prompt (optional, e.g. {TONE_EXAMPLES}): ").strip()
    except EOFError:
        tone_prompt = ""

    source_text = preprocess_text_with_groq(groq_client_class, source_text, tone_prompt, script_path)

    decision = apply_tone_prompt(source_text, tone_prompt)

    print("\\n[Tone] Prompt      :", decision.prompt or "(default tone)")
    print("[Tone] exaggeration:", decision.exaggeration)
    print("[Tone] cfg_weight  :", decision.cfg_weight)

    return decision`,
    },
    {
      id: "split_text_for_tts",
      name: "split_text_for_tts(text, max_chars)",
      fileId: "main",
      summary: "텍스트를 문장 단위로 나눠 TTS 세그먼트 목록을 반환함. 긴 문장은 단어 단위로 추가 분할.",
      how: "TTS 모델은 한 번에 너무 긴 텍스트를 받으면 품질이 떨어짐. 마침표·느낌표·물음표 뒤를 기준으로 문장을 나누고, 그래도 길면 split_long_sentence로 단어 단위로 쪼갬. 정규식으로 문장 경계를 찾음.",
      terms: ["정규식(re)", "리스트(list)", "MAX_CHARS_PER_SEGMENT"],
      lines: [
        { at: 'paragraphs = [line.strip() for line in text.splitlines() if line.strip()]', text: "줄 단위로 나눠 빈 줄은 제거함(문단 분리)." },
        { at: 'sentences = re.findall(r', text: "정규식으로 문장 끝(마침표 계열 뒤)을 기준으로 문장을 찾음." },
        { at: 'if len(sentence) <= max_chars:', text: "문장이 제한 이하면 그대로 세그먼트에 추가." },
        { at: 'segments.extend(split_long_sentence(sentence, max_chars))', text: "문장이 너무 길면 단어 단위로 추가 분할하여 확장함." },
      ],
      code:
`def split_text_for_tts(text: str, max_chars: int = MAX_CHARS_PER_SEGMENT) -> list[str]:
    """텍스트를 문장 단위로 분할하여 TTS 세그먼트 목록을 반환함."""
    paragraphs = [line.strip() for line in text.splitlines() if line.strip()]
    segments: list[str] = []

    for paragraph in paragraphs:
        sentences = re.findall(r'.+?(?:[.!?\\u3002\\uff01\\uff1f]+["\\'\\)\\]]*|$)', paragraph)
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            if len(sentence) <= max_chars:
                segments.append(sentence)
            else:
                segments.extend(split_long_sentence(sentence, max_chars))

    if not segments and text.strip():
        segments = split_long_sentence(text.strip(), max_chars)

    return segments`,
    },
    {
      id: "script_to_tts_lines",
      name: "script_to_tts_lines(script_text, tone_decision)",
      fileId: "main",
      summary: "Groq가 생성한 희곡식 스크립트 텍스트를 파싱해 TTSLine 목록을 반환함.",
      how: "각 줄이 (emotion_label|exaggeration=0.35|cfg_weight=0.60) 대사 형식인지 확인함. 정규식으로 큐(감정 지시)와 대사를 분리하고, tts_line_from_cue로 TTSLine 객체를 만듦. 마지막에 짧은 대사를 병합하는 merge_short_tts_lines를 호출함.",
      terms: ["TTSLine(dataclass)", "정규식(re)", "re.match", "리스트(list)"],
      lines: [
        { at: 'current_cue = ""', text: "큐(감정 지시)가 없는 줄도 직전 큐를 이어받아 처리함. 빈 문자열로 초기화." },
        { at: 'match = re.match(r"^\\((?P<cue>[^)]*)\\)\\s*(?P<text>.*)$", line)', text: "줄이 '(큐) 대사' 형식인지 확인함. 맞으면 큐와 대사를 named group으로 추출함." },
        { at: 'current_cue = match.group("cue").strip()', text: "새 큐를 current_cue에 저장함. 이후 대사 없는 줄도 이 큐를 씀." },
        { at: 'append_dialogue(current_cue, line)', text: "큐가 없는 일반 줄은 현재 큐를 그대로 사용해 대사로 처리함." },
        { at: 'return merge_short_tts_lines(lines)', text: "파싱 완료 후 짧은 대사를 인접 대사와 병합해 반환함." },
      ],
      code:
`def script_to_tts_lines(script_text: str, tone_decision: ToneDecision) -> list[TTSLine]:
    """Groq 스크립트 텍스트를 파싱하여 TTSLine 목록을 반환함."""
    lines: list[TTSLine] = []
    current_cue = ""

    def append_dialogue(cue: str, dialogue: str) -> None:
        for segment in split_text_for_tts(dialogue):
            if segment.strip():
                lines.append(tts_line_from_cue(cue, segment, tone_decision))

    for raw_line in script_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        match = re.match(r"^\\((?P<cue>[^)]*)\\)\\s*(?P<text>.*)$", line)
        if match:
            current_cue = match.group("cue").strip()
            dialogue = match.group("text").strip()
            if dialogue:
                append_dialogue(current_cue, dialogue)
            continue

        append_dialogue(current_cue, line)

    return merge_short_tts_lines(lines)`,
    },
    {
      id: "merge_short_tts_lines",
      name: "merge_short_tts_lines(lines)",
      fileId: "main",
      summary: "MIN_CHARS_PER_SEGMENT(12자) 미만 짧은 대사를 앞뒤 대사와 병합하여 IndexError를 방지함.",
      how: "Chatterbox가 너무 짧은 세그먼트를 처리할 때 내부 오류(IndexError)가 발생하는 버그가 있음. 이를 피하려고, 12자 미만 대사는 직전 대사 뒤에 붙임. 첫 번째 대사가 짧으면 두 번째 대사 앞에 붙임.",
      terms: ["TTSLine(dataclass)", "MIN_CHARS_PER_SEGMENT", "IndexError"],
      lines: [
        { at: 'if not lines:', text: "빈 목록이면 그대로 반환함." },
        { at: 'if len(line.text) < MIN_CHARS_PER_SEGMENT:', text: "현재 대사가 12자 미만이면 직전 대사 뒤에 붙임(공백 한 칸 포함)." },
        { at: 'merged[-1] = TTSLine(', text: "직전 대사를 '직전 대사 + 현재 짧은 대사'로 교체함. frozen=True라 새 객체를 만들어야 함." },
        { at: 'if len(merged) > 1 and len(merged[0].text) < MIN_CHARS_PER_SEGMENT:', text: "병합 후에도 첫 번째 대사가 짧으면, 두 번째 대사 앞에 붙이는 추가 처리를 함." },
      ],
      code:
`def merge_short_tts_lines(lines: list[TTSLine]) -> list[TTSLine]:
    """Chatterbox alignment analyzer IndexError 방지를 위해 짧은 대사를 인접 대사와 병합함."""
    if not lines:
        return lines

    merged: list[TTSLine] = []
    for line in lines:
        if not merged:
            merged.append(line)
            continue

        if len(line.text) < MIN_CHARS_PER_SEGMENT:
            previous = merged[-1]
            merged[-1] = TTSLine(
                cue=previous.cue,
                text=f"{previous.text} {line.text}".strip(),
                exaggeration=previous.exaggeration,
                cfg_weight=previous.cfg_weight,
            )
        else:
            merged.append(line)

    if len(merged) > 1 and len(merged[0].text) < MIN_CHARS_PER_SEGMENT:
        first = merged.pop(0)
        second = merged.pop(0)
        merged.insert(
            0,
            TTSLine(
                cue=second.cue,
                text=f"{first.text} {second.text}".strip(),
                exaggeration=second.exaggeration,
                cfg_weight=second.cfg_weight,
            ),
        )

    return merged`,
    },
    {
      id: "generate_and_save_segments",
      name: "generate_and_save_segments(model, torch, text, reference_voice, tone_decision, output_path, denoiser_model)",
      fileId: "main",
      summary: "TTS 스크립트를 세그먼트로 합성·노이즈 제거 후 ffmpeg로 연결하여 WAV를 저장하고 총 길이(초)를 반환함.",
      how: "TTSLine 목록을 만든 뒤 각 세그먼트를 model.generate()로 합성함. denoiser가 있으면 잡음 제거를 적용한 뒤 WAV로 저장함. 세그먼트 사이에 묵음을 끼우고 ffmpeg concat demuxer로 하나의 WAV로 이어 붙임. torch.cat 대신 ffmpeg를 쓰는 이유는 PCM 접합 아티팩트(잡음) 방지 때문임.",
      terms: ["model.generate()", "denoiser", "ffmpeg", "subprocess.run", "save_pcm16_wav", "torchaudio"],
      lines: [
        { at: 'tts_lines = script_to_tts_lines(text, tone_decision)', text: "희곡식 스크립트를 TTSLine 목록으로 파싱함." },
        { at: 'wav = model.generate(', text: "Chatterbox 모델로 한 세그먼트를 음성으로 합성함. reference_voice로 화자 목소리를 복제함." },
        { at: 'w = wav if wav.dim() == 2 else wav.unsqueeze(0)', text: "wav 텐서 모양을 denoiser가 요구하는 [1, N] 형태로 맞춤. unsqueeze(0)는 차원을 하나 추가함." },
        { at: 'saving raw.', text: "노이즈 제거 실패 시 원본 wav로 폴백(대체). 저장 후 길이(초)를 누적함." },
        { at: '"-f", "concat", "-safe", "0",', text: "ffmpeg concat demuxer로 세그먼트들을 순서대로 이어붙임. -safe 0은 절대경로 허용." },
        { at: 'for f in tmp_dir.iterdir():', text: "임시 폴더의 파일을 모두 지우고 폴더도 삭제함(SAVE_SEGMENTS=False일 때)." },
      ],
      code:
`def generate_and_save_segments(
    model: object,
    torch: object,
    text: str,
    reference_voice: Path,
    tone_decision: ToneDecision,
    output_path: Path,
    denoiser_model: object = None,
) -> float:
    """텍스트를 세그먼트로 합성·노이즈 제거 후 ffmpeg로 연결하여 WAV를 저장하고 총 길이(초)를 반환함."""
    tts_lines = script_to_tts_lines(text, tone_decision)
    if not tts_lines:
        exit_with_error("No text segments to synthesize.")

    timestamp = output_path.stem.replace("result_", "")
    tmp_dir = output_path.parent / f"_seg_{timestamp}"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    print(f"\\n[Generate] Split text into {len(tts_lines)} segment(s).")
    segment_paths: list[Path] = []
    total_duration = 0.0

    for index, line in enumerate(tts_lines, start=1):
        print(
            f"[Generate] Segment {index}/{len(tts_lines)} "
            f"({len(line.text)} chars, exaggeration={line.exaggeration:.2f}, cfg_weight={line.cfg_weight:.2f})"
        )
        wav = model.generate(
            line.text,
            language_id=LANGUAGE_ID,
            audio_prompt_path=str(reference_voice),
            exaggeration=line.exaggeration,
            cfg_weight=line.cfg_weight,
        )
        clean_path = tmp_dir / f"seg_{index:03d}.wav"

        if denoiser_model is not None:
            try:
                import torchaudio
                from denoiser.dsp import convert_audio as _dn_cvt
                dn_device = next(iter(denoiser_model.parameters())).device
                # wav가 [N] 또는 [1,N]일 수 있으므로 convert_audio를 위해 [1,N]으로 정규화
                w = wav if wav.dim() == 2 else wav.unsqueeze(0)
                w = _dn_cvt(w.to(dn_device), model.sr, denoiser_model.sample_rate, denoiser_model.chin)
                with torch.no_grad():
                    out = denoiser_model(w[None])
                if isinstance(out, (list, tuple)):
                    out = out[0]
                if denoiser_model.sample_rate != model.sr:
                    out = torchaudio.functional.resample(out, denoiser_model.sample_rate, model.sr)
                total_duration += save_pcm16_wav(out[0], model.sr, clean_path)
            except Exception as exc:
                print(f"[Generate] Segment {index} denoising failed ({exc}), saving raw.")
                total_duration += save_pcm16_wav(wav, model.sr, clean_path)
        else:
            total_duration += save_pcm16_wav(wav, model.sr, clean_path)

        segment_paths.append(clean_path)

        if index < len(tts_lines):
            total_duration += SILENCE_BETWEEN_SEGMENTS_SEC

    # torch.cat 방식의 raw PCM 접합 아티팩트를 방지하기 위해 ffmpeg concat demuxer 사용
    silence_path = tmp_dir / "silence.wav"
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi",
            "-i", f"aevalsrc=0:c=mono:s={model.sr}:d={SILENCE_BETWEEN_SEGMENTS_SEC}",
            str(silence_path),
        ],
        capture_output=True,
        check=True,
    )

    filelist_path = tmp_dir / "list.txt"
    entries: list[str] = []
    for i, seg_path in enumerate(segment_paths):
        entries.append(f"file '{seg_path.as_posix()}'")
        if i < len(segment_paths) - 1:
            entries.append(f"file '{silence_path.as_posix()}'")
    filelist_path.write_text("\\n".join(entries), encoding="utf-8")

    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "concat", "-safe", "0",
            "-i", str(filelist_path),
            str(output_path),
        ],
        capture_output=True,
        check=True,
    )

    if SAVE_SEGMENTS:
        seg_dir = output_path.parent / f"segments_{timestamp}"
        seg_dir.mkdir(parents=True, exist_ok=True)
        for seg_path in segment_paths:
            shutil.move(str(seg_path), seg_dir / seg_path.name)
        print(f"[Generate] Segments saved: {seg_dir}")

    for f in tmp_dir.iterdir():
        f.unlink()
    tmp_dir.rmdir()

    return total_duration`,
    },
    {
      id: "save_pcm16_wav",
      name: "save_pcm16_wav(wav_tensor, sample_rate, output_path)",
      fileId: "main",
      summary: "PyTorch 텐서로 된 음성 데이터를 정규화·클리핑 후 16-bit PCM WAV 파일로 저장하고 길이(초)를 반환함.",
      how: "TTS 모델은 float32(소수점 숫자) 형식의 텐서로 음성을 반환함. 사람 귀에 맞는 표준 WAV는 int16(정수) 형식이라 변환이 필요함. 최대 절댓값으로 나눠 -1~1 범위로 정규화하고, 32767을 곱해 정수로 바꿈.",
      terms: ["numpy", "scipy.io.wavfile", "텐서(tensor)", "PCM", "정규화(normalization)", "클리핑(clipping)"],
      lines: [
        { at: 'if hasattr(wav_tensor, "detach"):', text: "PyTorch 텐서이면 detach().cpu().numpy()로 계산 그래프에서 분리하고 NumPy 배열로 변환함." },
        { at: 'if audio.ndim == 2:', text: "2차원 배열(다채널)이면 모노(1채널)로 줄임. 형태에 따라 다른 방법으로 처리." },
        { at: 'if max_abs > 1.0:', text: "최대 절댓값이 1을 넘으면(클리핑 전 정규화) 최대값으로 나눠 -1~1 범위로 맞춤." },
        { at: 'audio = np.clip(audio, -1.0, 1.0)', text: "남은 범위 초과값을 -1.0~1.0으로 강제 제한함(클리핑)." },
        { at: 'audio_int16 = (audio * 32767.0).astype(np.int16)', text: "-1~1 범위 소수를 -32767~32767 정수로 변환함(16-bit PCM 표준 범위)." },
        { at: 'wavfile.write(str(output_path), sample_rate, audio_int16)', text: "scipy wavfile.write로 WAV 파일에 씀." },
      ],
      code:
`def save_pcm16_wav(wav_tensor: object, sample_rate: int, output_path: Path) -> float:
    """wav 텐서를 정규화·클리핑 후 16-bit PCM WAV로 저장하고 길이(초)를 반환함."""
    import numpy as np
    from scipy.io import wavfile

    if hasattr(wav_tensor, "detach"):
        audio = wav_tensor.detach().cpu().numpy()
    else:
        audio = np.asarray(wav_tensor)

    audio = np.asarray(audio, dtype=np.float32)
    if audio.ndim == 2:
        if audio.shape[0] == 1:
            audio = audio[0]
        elif audio.shape[1] == 1:
            audio = audio[:, 0]
        elif audio.shape[0] <= audio.shape[1]:
            audio = audio.mean(axis=0)
        else:
            audio = audio.mean(axis=1)

    max_abs = float(np.max(np.abs(audio))) if audio.size else 0.0
    if max_abs > 1.0:
        audio = audio / max_abs

    audio = np.clip(audio, -1.0, 1.0)
    audio_int16 = (audio * 32767.0).astype(np.int16)
    # 오디오 데이터를 16-bit PCM WAV 파일로 저장함
    wavfile.write(str(output_path), sample_rate, audio_int16)
    return float(len(audio_int16) / sample_rate) if sample_rate else 0.0`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "Chatterbox 한국어 음성 복제 TTS 전체 파이프라인을 순서대로 실행하는 진입점.",
      how: "프로그램의 '지휘자'임. 콘솔 설정 → 패키지 검사 → 라이브러리 버그 패치 → 참조 음성 준비 → 사용자 입력 → 모델 로드 → denoiser 로드 → 음성 합성·저장 순서로 전체를 조율함. torch.cuda.is_available()로 GPU 유무를 확인해 device를 결정함.",
      terms: ["ChatterboxMultilingualTTS", "denoiser", "CUDA", "GPU", "if __name__"],
      lines: [
        { at: 'configure_console()', text: "가장 먼저 콘솔 인코딩을 UTF-8로 설정함(한글 입출력 준비)." },
        { at: 'deps = check_prerequisites()', text: "필수 패키지 검사를 통과하면 torch·모델 클래스·Groq 클래스를 RuntimeDeps 상자에 받음." },
        { at: 'patch_chatterbox_alignment_analyzer()', text: "Chatterbox 내부 버그를 monkey-patch로 우회 처리함." },
        { at: 'device = "cuda" if torch.cuda.is_available() else "cpu"', text: "GPU(CUDA) 사용 가능 여부 확인. 불가능하면 CPU 사용." },
        { at: 'model = model_class.from_pretrained(device=device)', text: "Chatterbox 모델을 GPU 또는 CPU에 로드함. 첫 실행 시 약 500 MB 다운로드." },
        { at: 'denoiser_model = getattr(_dn_pretrained, DENOISER_MODEL)().to(device)', text: "Facebook DNS denoiser 모델을 로드하고 같은 device로 이동함." },
        { at: 'duration = generate_and_save_segments(model, torch, tone_decision.text,', text: "음성 합성·노이즈 제거·연결을 실행하고 총 재생 시간(초)을 받음." },
      ],
      code:
`def main() -> None:
    """Chatterbox 단일 사용자 한국어 음성 복제 TTS 전체 파이프라인을 실행함."""
    configure_console()

    print("=" * 64)
    print("Chatterbox Single-User Korean Voice Cloning TTS")
    print("Model   : Chatterbox Multilingual (500M, 23 languages)")
    print("Language: ko (Korean)")
    print("=" * 64)

    deps = check_prerequisites()
    patch_chatterbox_alignment_analyzer()
    wav_files = prepare_reference_voices()
    reference_voice = select_reference_voice(wav_files)
    output_path, script_path = make_run_paths()
    tone_decision = read_user_inputs(deps.groq_client_class, script_path)
    if tone_decision is None:
        return

    torch = deps.torch
    model_class = deps.model_class
    # GPU(CUDA) 사용 가능 여부 확인. 불가능하면 CPU 사용
    device = "cuda" if torch.cuda.is_available() else "cpu"

    print("\\n[Model] Loading ChatterboxMultilingualTTS...")
    print("[Model] First run downloads about 500 MB. Network connection and disk space are required.")
    if device == "cuda":
        print(f"[Model] Device: cuda ({torch.cuda.get_device_name(0)})")
    else:
        print("[Model] Device: cpu (generation can be slow)")

    model = model_class.from_pretrained(device=device)

    print(f"\\n[Denoiser] Loading {DENOISER_MODEL} model...")
    from denoiser import pretrained as _dn_pretrained
    denoiser_model = getattr(_dn_pretrained, DENOISER_MODEL)().to(device)
    denoiser_model.eval()
    print(f"[Denoiser] Ready (sample_rate={denoiser_model.sample_rate} Hz)")

    print("\\n[Generate] Voice cloning from:", reference_voice.name)
    duration = generate_and_save_segments(model, torch, tone_decision.text, reference_voice, tone_decision, output_path, denoiser_model)

    print("\\n[Done] Output:", output_path)
    print(f"[Done] Format: WAV, 16-bit PCM, {model.sr} Hz")
    print(f"[Done] Approx duration: {duration:.2f}s")
    print("[Note] Perth imperceptible watermark is automatically included by Chatterbox.")`,
    },
  ],

  glossary: {
    "sys.stdout.reconfigure": "콘솔(터미널) 출력의 글자 인코딩을 바꾸는 기능. 윈도우에서 한글이 깨지지 않도록 UTF-8로 다시 설정함.",
    "인코딩(encoding)": "글자를 컴퓨터가 저장·전송할 수 있는 숫자로 바꾸는 규칙. UTF-8은 한글·영문·특수문자를 모두 표현하는 현대 표준 방식.",
    "타입 힌트": "변수나 함수에 '이건 문자열(str)이야, 결과는 목록(list)이야'처럼 자료의 종류를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "raise SystemExit": "프로그램을 끝내면서 종료 코드를 운영체제에 알림. 1은 실패, 0은 성공을 뜻함.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"도시\": \"서울\"}처럼 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    "splitlines()": "문자열을 줄 단위로 나눠 목록으로 반환하는 함수. 줄바꿈 문자(\\n)가 나눔 기준이 됨.",
    "strip()": "문자열 앞뒤의 공백(스페이스·탭·줄바꿈)을 제거하는 함수. strip('\"')처럼 인자를 주면 특정 문자를 제거함.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(Groq LLM 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "os.environ": "운영체제에 등록된 환경변수를 읽거나 쓸 수 있는 파이썬 딕셔너리 같은 객체. os.environ.get('KEY')로 값을 안전하게 읽음.",
    "ZoneInfo": "시간대(타임존) 정보를 다루는 파이썬 표준 모듈. ZoneInfo('Asia/Seoul')은 한국 표준시(KST)를 뜻함.",
    "datetime": "날짜와 시간을 다루는 파이썬 표준 모듈. .now()로 현재 시각을, .strftime()으로 원하는 형식 문자열로 변환함.",
    "Path": "파일·폴더 경로를 다루는 파이썬 표준 클래스. 문자열 대신 Path를 쓰면 '/'와 '\\\\' 문제 없이 OS를 가리지 않고 경로를 조합할 수 있음.",
    "tuple(튜플)": "여러 값을 순서대로 담는 묶음. (a, b)처럼 괄호로 표현하며, 생성 후 변경할 수 없음. 함수에서 여러 값을 동시에 돌려줄 때 씀.",
    "import": "다른 파일이나 라이브러리의 코드를 이 파일에서 쓸 수 있게 불러오는 파이썬 명령. ImportError가 나면 해당 라이브러리가 설치되지 않은 것임.",
    "shutil.which": "시스템의 PATH에서 명령어 파일을 찾아주는 함수. 반환값이 None이면 해당 명령이 없는 것임.",
    "RuntimeDeps(dataclass)": "torch·ChatterboxMultilingualTTS·Groq 클래스를 묶어 담는 데이터 상자. @dataclass(frozen=True)로 만들면 생성 후 내용을 바꿀 수 없어 안전함.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "monkey-patch": "외부 라이브러리의 함수를 런타임(실행 중)에 다른 함수로 바꿔치기하는 기법. 소스 코드를 수정하지 않고 버그를 우회할 때 씀.",
    "IndexError": "목록이나 배열에서 존재하지 않는 번호(인덱스)에 접근할 때 발생하는 오류.",
    "리스트 컴프리헨션": "[표현식 for 항목 in 목록 if 조건] 형태로, 반복문을 한 줄로 짧게 써서 새 목록을 만드는 파이썬 문법.",
    "sorted()": "목록을 정렬해 새 목록으로 돌려주는 함수. key=로 정렬 기준을 지정할 수 있음.",
    "lambda": "이름 없는 간단한 함수를 한 줄로 만드는 파이썬 문법. lambda x: x+1은 'x를 받아 x+1을 돌려주는 함수'임.",
    "set(집합)": "{ }로 묶은 '중복 없는 값들의 모음'. 'x in 집합'으로 들어있는지 매우 빠르게 확인할 수 있어 확장자 검사에 적합함.",
    "subprocess.run": "파이썬에서 ffmpeg 같은 외부 프로그램을 실행하는 함수. 명령과 인자를 목록으로 넘기고, capture_output=True로 출력을 캡처함.",
    "ffmpeg": "오디오·비디오 파일 변환과 편집을 위한 강력한 무료 명령줄 도구. 여기서는 오디오 변환(mp3→wav)과 여러 WAV 파일 연결에 사용함.",
    "캐싱(cache)": "한 번 만든 결과를 저장해 두고, 다음에 또 필요하면 다시 만들지 않고 저장본을 재사용하는 것.",
    "returncode": "외부 프로그램이 종료할 때 운영체제에 전달하는 숫자. 0은 성공, 0이 아니면 실패를 뜻함.",
    "리스트(list)": "여러 값을 순서대로 담는 목록. [\"a\", \"b\"]처럼 대괄호로 표현함.",
    "while 반복": "조건이 참인 동안 계속 도는 반복문. while True는 break로 나오거나 오류가 날 때까지 무한 반복함.",
    "EOFError": "입력의 끝(End Of File)에 도달했을 때 발생하는 오류. 파이프 입력이나 비대화형 환경에서 input()을 호출하면 발생함.",
    "input()": "콘솔(터미널)에서 사용자가 키보드로 입력한 한 줄을 글자로 받아오는 함수.",
    "enumerate()": "목록을 돌면서 '번호와 값'을 함께 꺼내 주는 함수. start=1을 주면 1번부터 셈.",
    "ToneDecision(dataclass)": "톤 프롬프트·원본 텍스트·exaggeration·cfg_weight 파라미터를 한 상자에 담는 데이터 구조.",
    "exaggeration": "Chatterbox TTS의 감정 표현 강도 파라미터(0~1). 높을수록 감정이 과장되게 말하고, 낮을수록 차분하게 말함.",
    "cfg_weight": "Chatterbox TTS의 화자 일관성 파라미터(0~1). 높을수록 참조 음성 화자의 발음 특성을 유지하고, 낮을수록 억양이 자유로워짐.",
    "contains_any": "텍스트에 키워드 목록 중 하나라도 포함되면 True를 반환하는 도우미 함수. 조건 검사를 간결하게 만들기 위해 정의함.",
    "시스템 프롬프트": "AI에게 역할·규칙·출력 형식을 알려주는 지침 메시지. 대화의 맨 앞에 넣어 AI의 행동을 조종함.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
    "재귀(recursion)": "함수가 자기 자신을 다시 호출하는 기법. 여기서는 텍스트를 점점 더 잘게 나눠 재시도할 때 씀.",
    "finish_reason": "LLM API 응답이 끝난 이유. 'stop'은 정상 완료, 'length'는 토큰 한도 초과로 잘린 것을 뜻함.",
    "Groq": "빠른 LLM 추론 서비스. 여기서는 한국어 텍스트를 희곡식 TTS 스크립트로 변환하는 데 사용함.",
    "LLM": "'Large Language Model'의 줄임말. 사람처럼 글을 이해하고 생성할 수 있는 대규모 AI 언어 모델.",
    "write_text": "문자열을 파일에 통째로 쓰는 Path의 기능. encoding='utf-8'로 한글이 깨지지 않게 저장함.",
    "join()": "목록의 항목들을 특정 구분자로 이어붙여 하나의 문자열로 만드는 함수. '\\n'.join(['a','b'])는 'a\\nb'가 됨.",
    "TTSLine(dataclass)": "큐(감정 지시)·대사·exaggeration·cfg_weight를 한 줄의 TTS 지시로 묶는 데이터 구조.",
    "정규식(re)": "'Regular Expression'의 줄임말. 특정 패턴의 글자를 찾거나 나누는 강력한 도구. re.findall은 패턴에 맞는 모든 부분을 목록으로 반환함.",
    "re.match": "문자열의 처음부터 정규식 패턴이 맞는지 확인하는 함수. 맞으면 매치 객체를, 아니면 None을 반환함.",
    "MAX_CHARS_PER_SEGMENT": "TTS 세그먼트 하나의 최대 글자 수(기본값 120). 이보다 길면 분할해 합성 품질을 유지함.",
    "MIN_CHARS_PER_SEGMENT": "TTS 세그먼트의 최소 글자 수(기본값 12). 이보다 짧으면 Chatterbox 내부 오류가 생길 수 있어 인접 세그먼트와 병합함.",
    "IndexError": "목록이나 배열에서 존재하지 않는 번호(인덱스)에 접근할 때 발생하는 오류.",
    "model.generate()": "Chatterbox TTS 모델로 텍스트를 음성 텐서(소수 배열)로 변환하는 핵심 함수. 참조 음성 파일로 목소리를 복제함.",
    "denoiser": "음성에서 배경 잡음을 제거하는 모델. 여기서는 Facebook Research의 DNS(Deep Noise Suppression) 모델을 사용함.",
    "subprocess.run": "파이썬에서 ffmpeg 같은 외부 프로그램을 실행하는 함수. 명령과 인자를 목록으로 넘기고, capture_output=True로 출력을 캡처함.",
    "save_pcm16_wav": "PyTorch 텐서 음성 데이터를 16-bit PCM WAV 파일로 저장하는 함수. 정규화·클리핑 후 scipy로 저장함.",
    "torchaudio": "PyTorch 기반의 오디오 처리 라이브러리. 음성 파일 읽기·쓰기·리샘플링·변환 기능을 제공함.",
    "numpy": "수치 계산을 위한 파이썬 라이브러리. 다차원 배열(ndarray)로 음성 데이터를 효율적으로 처리함.",
    "scipy.io.wavfile": "scipy 라이브러리의 WAV 파일 입출력 모듈. wavfile.write()로 numpy 배열을 WAV로 저장함.",
    "텐서(tensor)": "다차원 숫자 배열. PyTorch에서 음성·이미지 등 데이터를 GPU에서 처리하기 위한 기본 자료 구조임.",
    "PCM": "'Pulse-Code Modulation'의 줄임말. 소리를 디지털로 저장하는 가장 기본적인 방식. 16-bit PCM은 CD 음질 표준임.",
    "정규화(normalization)": "값의 범위를 일정한 기준(예: -1~1)으로 맞추는 작업. 음성 데이터가 너무 크거나 작으면 소리가 왜곡되므로 먼저 정규화함.",
    "클리핑(clipping)": "값이 허용 범위를 벗어날 때 강제로 최댓값/최솟값으로 잘라내는 처리. np.clip(-1.0, 1.0)은 범위 초과분을 제거함.",
    "ChatterboxMultilingualTTS": "Resemble AI의 다국어 음성 복제 TTS 모델. 참조 음성 파일 하나만으로 그 목소리를 흉내 내어 23개 언어로 말할 수 있음.",
    "CUDA": "NVIDIA GPU에서 병렬 계산을 수행하는 프레임워크. 딥러닝 모델을 CPU보다 훨씬 빠르게 실행할 수 있게 함.",
    "GPU": "'Graphics Processing Unit'의 줄임말. 그래픽 처리용으로 만들어졌지만 딥러닝의 병렬 계산에도 탁월함.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
  },
};
