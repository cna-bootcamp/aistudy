/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../06.tts/chatterbox/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "Chatterbox TTS 음성 복제 예제 설명",
    entry: "tts.py",
  },

  files: [
    { id: "main", label: "tts.py", role: "단일 파일 CLI 예제 · 음성 복제(Voice Cloning) 기반 다국어 TTS" },
  ],

  flow: [
    { step: 1, title: "사전 요건 검사", label: "사전 요건 검사", refs: ["check_prerequisites"],
      summary: "check_prerequisites()가 PyTorch와 chatterbox-tts 설치 여부를 확인함",
      detail: "요리를 시작하기 전 재료가 있는지 확인하는 단계임. PyTorch(딥러닝 엔진)와 Chatterbox 라이브러리가 없으면 친절한 안내를 보여주고 바로 종료함. 없는 채로 진행하면 훨씬 나중에 더 이해하기 어려운 오류가 나기 때문에 맨 먼저 확인함." },
    { step: 2, title: "경로 설정", label: "경로 설정",
      summary: "입력 대화 CSV 경로(input_path)와 출력 WAV 경로(output_path)를 정함",
      detail: "작업 재료(대화 CSV)가 어디 있고, 결과물(WAV 파일)을 어디에 저장할지 경로를 먼저 잡아두는 단계임. 경로는 이 파일 위치를 기준으로 자동 계산되므로 어디서 실행해도 어긋나지 않음." },
    { step: 3, title: "참조 음성 탐색", label: "참조 음성 탐색", refs: ["scan_voices"],
      summary: "scan_voices()가 voices/ 폴더에서 지원 오디오 파일 목록을 모아 반환함",
      detail: "흉내 낼 목소리 샘플을 찾는 단계임. voices/ 폴더에 넣어 둔 WAV·MP3·M4A 등 오디오 파일을 목록으로 모음. 하나도 없으면 친절한 안내를 보여주고 종료함." },
    { step: 4, title: "비-WAV 변환", label: "비-WAV 변환", refs: ["convert_non_wav_voices", "convert_to_wav"],
      summary: "convert_non_wav_voices()가 MP3·M4A 등을 WAV로 자동 변환함 (ffmpeg 사용)",
      detail: "Chatterbox 모델이 WAV 형식만 참조 음성으로 쓸 수 있기 때문에, MP3·M4A 같은 다른 형식은 ffmpeg로 미리 WAV로 바꿔두는 단계임. 이미 변환된 파일은 건너뜀." },
    { step: 5, title: "대화 CSV 로드", label: "대화 CSV 로드", refs: ["load_dialog"],
      summary: "load_dialog()가 파이프(|) 구분 CSV를 읽어 speaker·text 컬럼을 검증함",
      detail: "TTS로 읽어 줄 대화 내용을 불러오는 단계임. CSV 형식은 '화자|대사' 구조임. speaker·text 컬럼이 없거나 파일 자체가 없으면 즉시 종료함. 빈 행은 미리 제거함." },
    { step: 6, title: "화자-음성 매핑", label: "화자 매핑", refs: ["load_mapping", "save_mapping", "select_voice_for_speaker"],
      summary: "화자마다 어떤 참조 음성을 쓸지 mapping.json에서 읽거나 사용자가 직접 선택함",
      detail: "여러 화자가 있을 때, 각 화자에게 어떤 목소리 샘플을 쓸지 연결하는 단계임. mapping.json이 있으면 이전 설정을 재사용하고, 없거나 새 화자가 생기면 목록을 보여주며 사용자가 번호를 골라 매핑함. 선택 결과는 JSON으로 저장해 다음에 재사용할 수 있음." },
    { step: 7, title: "매핑 파일 검증", label: "매핑 검증",
      summary: "매핑된 음성 파일이 voices/ 폴더에 실제로 존재하는지 확인함",
      detail: "선택한 참조 음성 파일이 실제로 있는지 한 번 더 확인하는 안전장치임. 파일이 없으면 어디를 고쳐야 하는지 안내하고 종료함." },
    { step: 8, title: "모델 로드", label: "모델 로드",
      summary: "ChatterboxMultilingualTTS.from_pretrained()로 500M 파라미터 모델을 GPU/CPU에 올림",
      detail: "음성 합성을 담당하는 AI 모델을 메모리에 불러오는 단계임. GPU(CUDA)가 있으면 GPU에, 없으면 CPU에 올림. 첫 실행 시 약 500MB를 인터넷에서 다운로드함." },
    { step: 9, title: "음성 세그먼트 생성", label: "세그먼트 생성",
      summary: "대화 행마다 model.generate()를 호출해 참조 음성의 특성을 복제한 음성 데이터를 만듦",
      detail: "실제 목소리를 흉내 내어 대사를 읽어주는 핵심 단계임. 대화 행 하나마다 참조 음성(화자 특성)과 텍스트를 AI 모델에 넣어 음성 데이터를 받음. 행 사이에는 짧은 무음(silence)을 삽입해 자연스러운 간격을 만듦. tqdm으로 진행 상황을 프로그레스 바로 보여줌." },
    { step: 10, title: "연결·정규화·저장", label: "연결·정규화·저장",
      summary: "생성된 음성 조각들을 이어 붙이고, 음량을 조절해 16-bit PCM WAV로 저장함",
      detail: "여러 조각의 음성 데이터를 하나의 파일로 합치는 마지막 단계임. torch.cat으로 이어 붙이고, numpy로 최대 음량 기준 정규화(너무 크거나 작지 않게)를 수행함. 최종적으로 16-bit PCM WAV 파일로 저장하고 완료를 알림." },
  ],

  functions: [
    // ===== tts.py (단일 파일) =====
    {
      id: "module_setup",
      name: "모듈 설정 (경로·상수)",
      fileId: "main",
      summary: "파일 맨 위에서 경로 상수, 언어·샘플레이트·음질 설정값, 지원 오디오 형식 목록 등 기본 설정을 준비함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 준비하는 값들'임. Path(__file__)으로 이 파일의 위치를 기준 삼아 voices/ 폴더, mapping.json 경로를 자동 계산함. LANGUAGE·SAMPLE_RATE·EXAGGERATION·CFG_WEIGHT는 TTS 동작을 제어하는 설정값임.",
      terms: ["Path(__file__)", "EXAGGERATION", "CFG_WEIGHT", "SAMPLE_RATE", "LANGUAGE"],
      lines: [
        { at: "SCRIPT_DIR   = Path(__file__).parent", text: "Path(__file__).parent 는 '이 tts.py 파일이 든 폴더의 경로'를 구함. 어디서 실행해도 경로가 어긋나지 않음." },
        { at: "VOICES_DIR   = SCRIPT_DIR / \"voices\"", text: "voices/ 폴더 경로를 자동으로 계산함. 참조 음성(목소리 샘플)들이 여기에 저장됨." },
        { at: "LANGUAGE     = \"ko\"", text: "한국어(ISO 639-1 코드 'ko')로 TTS를 생성함. Chatterbox는 23개 언어를 지원함." },
        { at: "EXAGGERATION = 0.5", text: "EXAGGERATION은 감정 표현 강도. 0에 가까울수록 차분하고, 높을수록 과장된 억양이 됨." },
        { at: "CFG_WEIGHT   = 0.5", text: "CFG_WEIGHT는 화자 일관성 제어 값. 0.0에 가까울수록 언어 간 억양 혼입(accent bleed)을 억제함." },
      ],
      code:
`SCRIPT_DIR   = Path(__file__).parent   # hands-on/06.tts/chatterbox/
TTS_ROOT     = SCRIPT_DIR.parent       # hands-on/06.tts/
VOICES_DIR   = SCRIPT_DIR / "voices"
MAPPING_FILE = VOICES_DIR / "mapping.json"

LANGUAGE     = "ko"    # 한국어 (ISO 639-1) — 23개 지원 언어 중 하나
SAMPLE_RATE  = 24000   # Chatterbox 기본 출력 샘플레이트
SILENCE_SEC  = 0.2
EXAGGERATION = 0.5     # 감정 표현 강도 (높을수록 과장됨)
CFG_WEIGHT   = 0.5     # 화자 일관성 제어 (0.0 = 교차 언어 시 억양 혼입 억제)

VOICE_EXTENSIONS = (
    "*.wav",   # PCM WAV (기본, 변환 불필요)
    "*.mp3",   # MPEG Audio Layer III
    "*.m4a",   # AAC in MPEG-4 컨테이너
    "*.aac",   # Advanced Audio Coding (raw)
    "*.ogg",   # Ogg Vorbis
    "*.opus",  # Opus (WebRTC / 메신저 앱)
    "*.flac",  # Free Lossless Audio Codec
    "*.wma",   # Windows Media Audio
    "*.aiff",  # Audio Interchange File Format
    "*.aif",   # AIFF (대체 확장자)
    "*.webm",  # WebM 오디오
    "*.amr",   # Adaptive Multi-Rate (모바일)
    "*.mp4",   # MPEG-4 비디오/오디오 컨테이너
    "*.mov",   # QuickTime 컨테이너
    "*.3gp",   # 3GPP 모바일
    "*.3g2",   # 3GPP2 모바일
    "*.caf",   # Apple Core Audio Format
    "*.mka",   # Matroska 오디오
    "*.wv",    # WavPack
    "*.ape",   # Monkey's Audio
    "*.ra",    # RealAudio
    "*.au",    # Sun/NeXT AU
    "*.ac3",   # Dolby Digital AC-3
    "*.dts",   # DTS 오디오
    "*.tta",   # True Audio
    "*.spx",   # Speex (Ogg 컨테이너)
    "*.gsm",   # GSM 06.10
    "*.ts",    # MPEG Transport Stream
)`,
    },

    {
      id: "check_prerequisites",
      name: "check_prerequisites()",
      fileId: "main",
      summary: "PyTorch와 chatterbox-tts가 설치되어 있는지 확인하고, 없으면 설치 안내를 출력하고 종료함.",
      how: "import를 시도해서 오류가 나면 '라이브러리가 없다'는 뜻임. try/except ImportError로 이를 잡아 사용자에게 친절한 안내를 보여준 뒤 sys.exit(1)로 종료함. 나중에 알 수 없는 오류가 나는 것보다 시작 시점에 분명히 알려주는 것이 훨씬 낫기 때문임.",
      terms: ["예외 처리(try/except)", "ImportError", "sys.exit()"],
      lines: [
        { at: "import torch  # noqa: F401", text: "torch import를 시도함. F401은 '미사용 import 경고를 무시해라'는 코드 점검 도구용 표시임." },
        { at: "except ImportError:", text: "import가 실패하면(라이브러리가 없으면) 여기로 와서 안내를 출력하고 종료함." },
        { at: "from chatterbox.mtl_tts import ChatterboxMultilingualTTS  # noqa: F401", text: "Chatterbox 라이브러리도 같은 방식으로 설치 여부를 확인함." },
        { at: "except ImportError as e:", text: "Chatterbox import 실패 시 오류 내용(e)을 함께 출력해 어떤 문제인지 더 자세히 알려줌." },
      ],
      code:
`def check_prerequisites() -> None:
    """PyTorch 및 chatterbox-tts 설치 여부를 확인하고, 미설치 시 안내 후 종료함."""
    try:
        import torch  # noqa: F401
    except ImportError:
        print("\\n[Error] PyTorch not installed.")
        print("  Install guide: https://github.com/cna-bootcamp/aistudy/blob/main/agentic-ai/reference/install-pytorch.md")
        sys.exit(1)

    try:
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS  # noqa: F401
    except ImportError as e:
        print(f"\\n[Error] chatterbox-tts import failed: {e}")
        print("  If 'ml_dtypes' related: pip install --upgrade --force-reinstall ml_dtypes")
        print("  Otherwise reinstall: pip install -r requirements.txt")
        sys.exit(1)`,
    },

    {
      id: "scan_voices",
      name: "scan_voices()",
      fileId: "main",
      summary: "voices/ 폴더에서 지원 오디오 형식(WAV·MP3·M4A 등)의 파일을 모두 찾아 정렬된 목록으로 반환함.",
      how: "glob()은 '*.mp3' 같은 패턴으로 폴더 안의 파일을 검색하는 기능임. VOICE_EXTENSIONS에 정의된 확장자 패턴을 하나씩 돌며 파일을 수집하고, sorted()로 이름순 정렬함. voices/ 폴더가 없으면 먼저 만들어둠.",
      terms: ["glob()", "sorted()", "mkdir"],
      lines: [
        { at: "VOICES_DIR.mkdir(parents=True, exist_ok=True)", text: "voices/ 폴더가 없으면 먼저 만들어둠. exist_ok=True는 이미 있어도 오류 없이 넘어감." },
        { at: "files: List[Path] = []", text: "수집할 파일 경로 목록을 빈 상태로 만듦. List[Path]는 '경로 객체의 목록'이라는 타입 힌트임." },
        { at: "files.extend(VOICES_DIR.glob(ext))", text: "glob(ext)로 해당 확장자 패턴의 파일을 찾아 목록에 추가함. extend()는 여러 항목을 한꺼번에 추가함." },
        { at: "return sorted(files)", text: "모든 확장자를 다 찾은 후 이름순으로 정렬해 반환함." },
      ],
      code:
`def scan_voices() -> List[Path]:
    """voices/ 디렉터리의 지원 오디오 파일을 정렬하여 반환함."""
    VOICES_DIR.mkdir(parents=True, exist_ok=True)
    files: List[Path] = []
    for ext in VOICE_EXTENSIONS:
        files.extend(VOICES_DIR.glob(ext))
    return sorted(files)`,
    },

    {
      id: "convert_to_wav",
      name: "convert_to_wav(src)",
      fileId: "main",
      summary: "MP3·M4A 등 비-WAV 오디오 파일을 ffmpeg로 WAV 형식으로 변환하여 저장된 경로를 반환함.",
      how: "Chatterbox 모델이 참조 음성으로 WAV만 받으므로, 다른 형식은 WAV로 바꿔야 함. ffmpeg는 오디오·동영상 변환을 담당하는 외부 프로그램이고, subprocess.run()으로 파이썬에서 호출함. 이미 변환된 파일이 있으면 건너뜀(중복 방지).",
      terms: ["subprocess.run()", "ffmpeg", "RuntimeError", "타입 힌트"],
      lines: [
        { at: "dst = src.with_suffix(\".wav\")", text: "원본 파일의 확장자만 .wav로 바꾼 목적지 경로를 만듦. 예: voice.mp3 → voice.wav." },
        { at: "if dst.exists():", text: "이미 변환된 WAV가 있으면 다시 변환하지 않고 그 경로를 바로 반환함(재작업 방지)." },
        { at: "result = subprocess.run(", text: "subprocess.run()으로 파이썬 밖의 ffmpeg 프로그램을 실행해 오디오 형식을 변환함." },
        { at: "if result.returncode != 0:", text: "ffmpeg가 실패하면(returncode가 0이 아니면) RuntimeError로 오류 내용을 알려줌." },
      ],
      code:
`def convert_to_wav(src: Path) -> Path:
    """비-WAV 오디오 파일을 voices/ 디렉터리에서 WAV로 변환하여 경로를 반환함."""
    import subprocess
    dst = src.with_suffix(".wav")
    if dst.exists():
        print(f"[Voice] Already converted: {src.name} -> {dst.name} (skip)")
        return dst
    print(f"[Voice] Converting {src.name} -> {dst.name} ...")
    result = subprocess.run(
        ["ffmpeg", "-y", "-i", str(src), str(dst)],
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed to convert {src.name}:\\n{result.stderr.decode(errors='replace')}"
        )
    print(f"[Voice] Converted: {src.name} -> {dst.name}")
    return dst`,
    },

    {
      id: "convert_non_wav_voices",
      name: "convert_non_wav_voices(voice_files)",
      fileId: "main",
      summary: "참조 음성 목록 중 비-WAV 파일을 모두 WAV로 변환하고, 중복 없이 정렬된 WAV 목록을 반환함.",
      how: "set(집합)을 써서 같은 파일이 두 번 추가되는 것을 막음. 이미 WAV인 파일은 그대로 추가하고, 다른 형식은 convert_to_wav()로 변환한 뒤 추가함. 마지막에 sorted()로 이름순 정렬함.",
      terms: ["set(집합)", "sorted()"],
      lines: [
        { at: "wav_set: set = set()", text: "중복을 자동으로 제거하는 집합(set)으로 WAV 파일 경로를 모음." },
        { at: "if f.suffix.lower() == \".wav\":", text: "확장자가 이미 .wav이면 변환 없이 바로 집합에 추가함." },
        { at: "wav_path = convert_to_wav(f)", text: ".wav가 아니면 convert_to_wav()로 변환한 경로를 받아 집합에 추가함." },
        { at: "return sorted(wav_set)", text: "집합에 모인 WAV 경로들을 이름순으로 정렬해 목록으로 반환함." },
      ],
      code:
`def convert_non_wav_voices(voice_files: List[Path]) -> List[Path]:
    """비-WAV 파일을 모두 WAV로 변환하고, 중복 제거 후 정렬된 WAV 목록을 반환함."""
    wav_set: set = set()
    for f in voice_files:
        if f.suffix.lower() == ".wav":
            wav_set.add(f)
        else:
            wav_path = convert_to_wav(f)
            wav_set.add(wav_path)
    return sorted(wav_set)`,
    },

    {
      id: "load_mapping",
      name: "load_mapping()",
      fileId: "main",
      summary: "voices/mapping.json에서 화자→음성 파일명 매핑을 읽어 반환함. 파일이 없거나 오류면 None을 반환함.",
      how: "mapping.json은 '철수 → voice_male.wav' 같은 화자-음성 대응표를 저장하는 파일임. 파일이 없으면 None을 반환해 '새로 선택해야 함'을 알림. 읽는 중 오류가 나도 None을 반환해 프로그램이 멈추지 않음.",
      terms: ["JSON", "예외 처리(try/except)", "with open(rb)", "Optional"],
      lines: [
        { at: "if not MAPPING_FILE.exists():", text: "매핑 JSON 파일이 없으면 None을 반환함(첫 실행이거나 파일을 지운 경우)." },
        { at: "with open(MAPPING_FILE, encoding=\"utf-8\") as f:", text: "파일을 UTF-8로 열어 읽음. with 블록을 벗어나면 파일이 자동으로 닫힘." },
        { at: "data = json.load(f)", text: "JSON 파일 내용을 파이썬 딕셔너리로 변환함." },
        { at: "except Exception as e:", text: "파일 형식이 깨져 있는 등 어떤 오류라도 나면 None을 반환해 재선택을 유도함." },
      ],
      code:
`def load_mapping() -> Optional[Dict[str, str]]:
    """JSON 파일에서 화자→음성 파일명 매핑을 로드함. 파일이 없거나 오류 시 None 반환."""
    if not MAPPING_FILE.exists():
        return None
    try:
        with open(MAPPING_FILE, encoding="utf-8") as f:
            data = json.load(f)
        print(f"[Mapping] Loaded from {MAPPING_FILE.name}")
        return data
    except Exception as e:
        print(f"[Mapping] Failed to load ({e}), will re-select.")
        return None`,
    },

    {
      id: "save_mapping",
      name: "save_mapping(mapping)",
      fileId: "main",
      summary: "화자→음성 파일명 매핑 딕셔너리를 voices/mapping.json에 저장해 다음 실행 시 재사용할 수 있게 함.",
      how: "json.dump()로 파이썬 딕셔너리를 JSON 형식으로 파일에 씀. ensure_ascii=False는 한글을 그대로 저장하게 해주는 옵션이고, indent=2는 보기 좋게 들여쓰기를 해줌.",
      terms: ["JSON", "딕셔너리(dict)", "with open(rb)"],
      lines: [
        { at: "with open(MAPPING_FILE, \"w\", encoding=\"utf-8\") as f:", text: "매핑 파일을 쓰기 모드(\"w\")로 열음. 없으면 새로 만들고, 있으면 덮어씀." },
        { at: "json.dump(mapping, f, ensure_ascii=False, indent=2)", text: "딕셔너리를 JSON으로 변환해 파일에 씀. ensure_ascii=False로 한글이 \\uXXXX 대신 원문 그대로 저장됨." },
      ],
      code:
`def save_mapping(mapping: Dict[str, str]) -> None:
    """화자→음성 파일명 매핑을 JSON 파일에 저장하여 재사용을 가능하게 함."""
    with open(MAPPING_FILE, "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
    print(f"[Mapping] Saved to {MAPPING_FILE.name}")`,
    },

    {
      id: "select_voice_for_speaker",
      name: "select_voice_for_speaker(speaker, voice_files)",
      fileId: "main",
      summary: "화자 이름을 보여주고, 참조 음성 목록을 번호와 함께 출력하여 사용자가 번호로 선택하게 함.",
      how: "터미널에서 사용자와 대화하는 함수임. enumerate()로 1번부터 번호를 붙여 음성 목록을 출력함. while True 반복으로 올바른 번호를 입력할 때까지 계속 물어봄. 번호가 아닌 값이나 범위 밖 번호는 다시 묻는 방식으로 처리함.",
      terms: ["enumerate()", "input()", "while 반복", "예외 처리(try/except)"],
      lines: [
        { at: "for i, wav in enumerate(voice_files, 1):", text: "enumerate(..., 1)로 1번부터 번호를 붙여 음성 파일 목록을 하나씩 꺼냄." },
        { at: "while True:", text: "올바른 번호가 입력될 때까지 무한 반복함. 올바른 선택이 들어오면 return으로 빠져나옴." },
        { at: "choice = input(f\"Enter number (1-{len(voice_files)}): \").strip()", text: "터미널에서 사용자가 입력한 번호를 받음. .strip()으로 앞뒤 공백을 제거함." },
        { at: "idx = int(choice) - 1", text: "입력한 글자를 숫자로 바꾸고, 목록은 0부터 시작하므로 1을 뺌." },
        { at: "if 0 <= idx < len(voice_files):", text: "번호가 유효한 범위 안이면 해당 음성 파일명을 반환함." },
      ],
      code:
`def select_voice_for_speaker(speaker: str, voice_files: List[Path]) -> str:
    """참조 음성 목록을 표시하고, 사용자가 선택한 파일명을 반환함."""
    print(f"\\n{'=' * 60}")
    print(f"Select reference voice for speaker: '{speaker}'")
    print("=" * 60)
    for i, wav in enumerate(voice_files, 1):
        size_kb = wav.stat().st_size // 1024
        print(f"  {i:2}. {wav.name}  ({size_kb} KB)")
    print("=" * 60)
    print("  [Tip] Use Korean reference audio for best results.")
    print("        If using non-Korean audio, cfg_weight=0.0 reduces accent bleed.")

    while True:
        try:
            choice = input(f"Enter number (1-{len(voice_files)}): ").strip()
            idx = int(choice) - 1
            if 0 <= idx < len(voice_files):
                selected = voice_files[idx]
                print(f"Selected: {selected.name}")
                return selected.name
        except (ValueError, KeyboardInterrupt):
            pass
        print("Invalid choice. Please try again.")`,
    },

    {
      id: "load_dialog",
      name: "load_dialog(path)",
      fileId: "main",
      summary: "파이프(|) 구분자 CSV 파일에서 대화 데이터를 읽어, speaker·text 컬럼을 검증하고 빈 행을 제거해 반환함.",
      how: "pd.read_csv()로 CSV를 데이터프레임(표)으로 읽음. sep='|'는 구분자를 쉼표가 아닌 파이프(|)로 지정함. 필수 컬럼(speaker, text)이 없거나 파일이 없으면 즉시 종료함. 빈 대사 행은 dropna()와 조건 필터로 제거함.",
      terms: ["pandas(pd)", "데이터프레임(DataFrame)", "sep(구분자)", "dropna()"],
      lines: [
        { at: "if not path.exists():", text: "CSV 파일이 없으면 즉시 오류를 출력하고 종료함." },
        { at: "df = pd.read_csv(path, sep=\"|\", encoding=\"utf-8\")", text: "pd.read_csv()로 CSV를 읽음. sep='|'로 파이프 구분자를 지정하고, 한글이 깨지지 않도록 UTF-8 인코딩을 명시함." },
        { at: "for col in (\"speaker\", \"text\"):", text: "speaker·text 컬럼이 반드시 있어야 함. 하나라도 없으면 오류를 알리고 종료함." },
        { at: "df = df.dropna(subset=[\"speaker\", \"text\"])", text: "speaker 또는 text가 비어 있는(NaN) 행을 제거함." },
        { at: "return df[df[\"text\"] != \"\"].reset_index(drop=True)", text: "텍스트가 빈 문자열인 행을 제거하고, 행 번호를 0부터 다시 매겨 반환함." },
      ],
      code:
`def load_dialog(path: Path) -> pd.DataFrame:
    """파이프(|) 구분자 CSV에서 대화 데이터를 로드하고 필수 컬럼을 검증하여 반환함."""
    if not path.exists():
        print(f"\\n[Error] Input file not found: {path}")
        sys.exit(1)
    df = pd.read_csv(path, sep="|", encoding="utf-8")
    for col in ("speaker", "text"):
        if col not in df.columns:
            print(f"\\n[Error] Required column '{col}' not found in {path.name}")
            sys.exit(1)
    df = df.dropna(subset=["speaker", "text"])
    df["text"] = df["text"].astype(str).str.strip()
    return df[df["text"] != ""].reset_index(drop=True)`,
    },

    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "TTS 음성 복제 전체 파이프라인을 순서대로 실행하는 시작점. 사전 검사 → 음성 탐색 → 매핑 → 모델 로드 → 음성 생성 → 저장.",
      how: "프로그램의 '지휘자' 함수임. 10단계 파이프라인을 순서대로 실행함. GPU 사용 가능 여부에 따라 device를 'cuda' 또는 'cpu'로 결정하고, ChatterboxMultilingualTTS로 모델을 로드함. 대화 행마다 model.generate()로 음성을 만들어 torch.cat으로 이어 붙이고, numpy로 정규화한 뒤 WAV 파일로 저장함.",
      terms: ["ChatterboxMultilingualTTS", "torch.cuda", "torch.cat", "numpy(np)", "scipy.wavfile", "tqdm", "Voice Cloning", "Perth 워터마크"],
      lines: [
        { at: "if hasattr(sys.stdout, \"reconfigure\"):", text: "Windows 콘솔에서 한글 출력이 깨지지 않도록 UTF-8로 인코딩을 설정함." },
        { at: "device = \"cuda\" if torch.cuda.is_available() else \"cpu\"", text: "GPU(CUDA)를 쓸 수 있으면 'cuda', 없으면 'cpu'로 설정함. GPU가 있으면 훨씬 빠르게 음성을 생성함." },
        { at: "model = ChatterboxMultilingualTTS.from_pretrained(device=device)", text: "★핵심★ Chatterbox 다국어 TTS 모델을 불러옴. 첫 실행 시 약 500MB를 다운로드함." },
        { at: "silence = torch.zeros(1, int(SILENCE_SEC * sample_rate))", text: "SILENCE_SEC(0.2초) 분량의 무음 데이터를 만듦. 대화 행 사이에 삽입해 자연스러운 간격을 줌." },
        { at: "for i, (_, row) in enumerate(tqdm(rows, desc=\"Generating\")):", text: "tqdm으로 진행률을 프로그레스 바로 보여주며 대화 행 하나씩 처리함." },
        { at: "wav = model.generate(", text: "★핵심★ model.generate()에 텍스트·언어·참조 음성·설정값을 넘겨 목소리를 복제한 음성 데이터를 만듦." },
        { at: "final = torch.cat(segments, dim=1)", text: "torch.cat으로 모든 음성 조각을 시간 축(dim=1)으로 이어 붙여 하나의 긴 음성 데이터로 만듦." },
        { at: "final_np = final.squeeze(0).cpu().numpy().astype(np.float32)", text: "PyTorch 텐서를 numpy 배열로 변환함. squeeze(0)은 불필요한 차원을 제거하고, .numpy()로 배열 형태로 바꿈." },
        { at: "final_np = final_np / max_val * 0.95", text: "최대 절댓값으로 나눠 음량을 정규화함. *0.95는 클리핑(음량 초과로 인한 왜곡)을 방지하는 여유값임." },
        { at: "wavfile.write(str(output_path), sample_rate, final_int16)", text: "최종 음성 데이터를 16-bit PCM WAV 파일로 저장함. scipy의 wavfile.write()를 사용함." },
      ],
      code:
`def main() -> None:
    """Chatterbox 다국어 TTS 음성 복제 전체 파이프라인을 실행함."""
    # Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    print("=" * 60)
    print("Chatterbox Multilingual TTS — Voice Cloning")
    print("Model   : ChatterboxMultilingualTTS (500M, 23 languages)")
    print(f"Language: {LANGUAGE} (Korean)")
    print("=" * 60)

    # 1. 사전 요건 검사
    check_prerequisites()

    import torch
    # ChatterboxMultilingualTTS: Resemble AI의 다국어 음성 복제 TTS 모델 (500M 파라미터)
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    # 2. 경로 설정
    input_path  = TTS_ROOT / "text" / "dialog.csv"
    output_path = SCRIPT_DIR / "result.wav"

    # 3. voices/ 디렉터리의 오디오 파일 탐색
    all_voice_files = scan_voices()
    if not all_voice_files:
        print(f"\\n[Error] No audio files found in {VOICES_DIR}")
        print("  Place ~10s reference audio files (Korean preferred) in voices/ directory.")
        print("  Supported formats: WAV, MP3, M4A, AAC, OGG, OPUS, FLAC, WMA, AIFF, and more.")
        sys.exit(1)

    print(f"\\n[Voices] {len(all_voice_files)} reference voice(s) found:")
    for v in all_voice_files:
        print(f"  - {v.name}")

    # 4. 비-WAV 파일을 voices/ 디렉터리에서 WAV로 변환
    non_wav = [f for f in all_voice_files if f.suffix.lower() != ".wav"]
    if non_wav:
        print(f"\\n[Voice] Converting {len(non_wav)} non-WAV file(s) to WAV in voices/ ...")
        voice_files = convert_non_wav_voices(all_voice_files)
    else:
        voice_files = all_voice_files

    # 5. 대화 파일 로드
    print(f"\\n[Load] Reading dialog from {input_path.name}...")
    df = load_dialog(input_path)
    print(f"[Load] {len(df)} lines, {df['speaker'].nunique()} speakers")

    speakers: List[str] = list(dict.fromkeys(df["speaker"].astype(str).tolist()))
    print(f"[Load] Speakers: {speakers}")

    # 6. 화자별 음성 매핑
    mapping = load_mapping()
    need_save = False

    if mapping is None:
        print("\\n[Mapping] No mapping file found. Select reference voices for each speaker.")
        mapping = {}
        need_save = True
    else:
        missing = [s for s in speakers if s not in mapping]
        if missing:
            print(f"\\n[Mapping] New speakers detected: {missing}. Select reference voices.")
            need_save = True
        else:
            print("\\n[Mapping] Current speaker -> voice mapping:")
            for spk in speakers:
                print(f"  {spk} -> {mapping[spk]}")
            try:
                answer = input("\\nChange mapping? (y/N): ").strip().lower()
            except EOFError:
                answer = "n"
            if answer == "y":
                mapping = {}
                need_save = True

    for spk in speakers:
        if spk not in mapping:
            mapping[spk] = select_voice_for_speaker(spk, voice_files)

    if need_save:
        save_mapping(mapping)

    print("\\n[Mapping] Speaker -> Reference Voice")
    for spk in speakers:
        print(f"  {spk} -> {mapping.get(spk, '(not mapped)')}")

    # 7. 매핑된 음성 파일 존재 여부 검증 (이 시점에서 모두 WAV여야 함)
    for spk in speakers:
        ref = VOICES_DIR / mapping[spk]
        if not ref.exists():
            print(f"\\n[Error] Reference voice not found: {ref}")
            print("  Update voices/mapping.json or delete it to re-map.")
            sys.exit(1)

    # 8. ChatterboxMultilingualTTS 모델 로드
    print("\\n[Model] Loading ChatterboxMultilingualTTS...")
    print("[Model] First run downloads ~500MB — ensure network connection and disk space.")

    # GPU(CUDA) 사용 가능 여부 확인. 불가능하면 CPU 사용
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[Model] Device: {device}")

    model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    sample_rate = model.sr
    print(f"[Model] Loaded (sample rate: {sample_rate} Hz)")

    # 9. 음성 복제로 한국어 음성 세그먼트 생성
    print("\\n[Audio] Generating Korean speech with voice cloning...")
    print(f"[Audio] exaggeration={EXAGGERATION}, cfg_weight={CFG_WEIGHT}")
    segments = []
    silence = torch.zeros(1, int(SILENCE_SEC * sample_rate))  # CPU 텐서

    rows = list(df.iterrows())
    # tqdm: 반복 작업의 진행률을 프로그레스 바로 표시함
    for i, (_, row) in enumerate(tqdm(rows, desc="Generating")):
        spk     = str(row["speaker"])
        text    = str(row["text"])
        ref_wav = str(VOICES_DIR / mapping[spk])

        wav = model.generate(
            text,
            language_id=LANGUAGE,
            audio_prompt_path=ref_wav,
            exaggeration=EXAGGERATION,
            cfg_weight=CFG_WEIGHT,
        )
        # CPU로 이동 후 목록에 추가 (torch.cat 전 정규화)
        segments.append(wav.cpu())
        if i < len(rows) - 1:
            segments.append(silence)

    if not segments:
        print("\\n[Error] No audio segments generated.")
        sys.exit(1)

    # 10. 세그먼트 연결, 정규화, 16-bit PCM WAV 저장
    print("\\n[Audio] Concatenating segments...")
    # torch.cat: 텐서 목록을 시간 축(dim=1)으로 이어 붙임 → shape: [1, T]
    final = torch.cat(segments, dim=1)
    final_np = final.squeeze(0).cpu().numpy().astype(np.float32)

    max_val = np.max(np.abs(final_np))
    if max_val > 0:
        final_np = final_np / max_val * 0.95

    final_int16 = (final_np * 32767).astype(np.int16)
    # 오디오 데이터를 16-bit PCM WAV 파일로 저장함
    wavfile.write(str(output_path), sample_rate, final_int16)

    duration = len(final_int16) / sample_rate
    print(f"\\n[Done] Output  : {output_path}")
    print(f"[Done] Duration: {duration:.2f}s | Sample rate: {sample_rate} Hz")
    print("[Note] Perth watermark is automatically embedded in the output audio.")
    print("\\n" + "=" * 60)
    print("Voice Cloning Complete!")
    print("=" * 60)`,
    },
  ],

  glossary: {
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .parent를 붙이면 이 파일이 든 폴더의 경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "EXAGGERATION": "TTS 음성의 감정 표현 강도 설정값. 0에 가까울수록 차분하고 자연스럽고, 높을수록 억양이 과장되어 들림.",
    "CFG_WEIGHT": "화자 일관성 제어 값. 낮출수록 다국어 음성 복제 시 억양이 섞이는 현상(accent bleed)을 줄여줌.",
    "SAMPLE_RATE": "오디오의 초당 샘플(데이터) 수. 24000Hz는 1초 음성을 24,000개의 숫자로 표현한다는 뜻. 높을수록 음질이 선명해짐.",
    "LANGUAGE": "ISO 639-1 언어 코드. 'ko'는 한국어를 뜻함. Chatterbox는 이 코드를 보고 어떤 언어로 음성을 생성할지 결정함.",
    "glob()": "폴더 안에서 '*.mp3' 같은 패턴에 맞는 파일들을 찾아주는 기능. 마치 파일 탐색기의 검색과 같음.",
    "sorted()": "목록을 정렬해 새 목록으로 돌려주는 함수. 여기서는 파일을 이름순으로 정렬함.",
    "mkdir": "폴더를 만드는 명령. parents=True는 중간 폴더도 함께, exist_ok=True는 이미 있어도 오류 없이 넘어가게 함.",
    "subprocess.run()": "파이썬에서 외부 프로그램(ffmpeg 등)을 실행하는 방법. 결과(returncode)로 성공/실패를 확인함.",
    "ffmpeg": "오디오·동영상 형식을 변환하는 오픈소스 외부 프로그램. MP3·M4A를 WAV로 바꾸는 데 사용함.",
    "RuntimeError": "'실행 중 문제가 생겼다'고 알리는 오류의 한 종류. 여기서는 ffmpeg 변환 실패 시 일부러 발생시켜 원인을 알려줌.",
    "타입 힌트": "변수·함수에 자료의 종류(str, Path, List 등)를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "set(집합)": "{ }로 묶은 '중복 없는 값들의 모음'. 같은 파일 경로가 두 번 추가되는 것을 자동으로 막아줌.",
    "JSON": "데이터를 주고받는 표준 글자 형식. {\"key\": \"value\"} 모양으로, 파이썬 딕셔너리와 거의 똑같이 생김.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "with open(rb)": "with 블록으로 파일을 열면, 블록을 벗어날 때 파일이 자동으로 닫힘. 파일을 깜빡하고 안 닫는 실수를 방지함.",
    "Optional": "Optional[타입]은 '이 값이 있을 수도 있고 없을 수도 있다(None일 수 있다)'는 표시. 함수가 결과를 못 찾을 때 None을 반환할 수 있음을 알려줌.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"화자\": \"음성파일.wav\"}처럼 이름표를 붙여 값을 저장함.",
    "pandas(pd)": "표(엑셀 시트 같은) 형태의 데이터를 다루는 파이썬 라이브러리. CSV를 읽고, 행·열 단위로 필터링하거나 정리하는 데 씀.",
    "데이터프레임(DataFrame)": "pandas에서 사용하는 '표' 자료 구조. 행과 열로 이루어진 엑셀 시트와 같은 형태임.",
    "sep(구분자)": "CSV 파일에서 각 항목을 구분하는 글자. 기본은 쉼표(,)지만 이 예제는 파이프(|)를 구분자로 씀.",
    "dropna()": "pandas에서 값이 비어 있는(NaN) 행을 제거하는 기능. speaker나 text가 빈 대화 행을 걸러냄.",
    "enumerate()": "목록을 돌면서 '번호와 값'을 함께 꺼내 주는 함수. start=1을 주면 1번부터 셈.",
    "input()": "콘솔(터미널)에서 사용자가 키보드로 입력한 한 줄을 글자로 받아오는 함수.",
    "while 반복": "조건이 참인 동안 계속 도는 반복문. 여기서는 올바른 번호를 입력할 때까지 다시 묻는 데 씀.",
    "ImportError": "import 문으로 라이브러리를 불러올 때 해당 라이브러리가 설치되어 있지 않으면 발생하는 오류.",
    "sys.exit()": "프로그램을 즉시 종료하는 함수. 인수가 0이면 정상 종료, 1이면 오류 종료를 의미함.",
    "ChatterboxMultilingualTTS": "Resemble AI의 다국어 음성 복제(Voice Cloning) TTS 모델. 약 500M 파라미터로 23개 언어를 지원하며, 참조 음성의 화자 특성을 복제해 텍스트를 읽어줌.",
    "torch.cuda": "NVIDIA GPU(CUDA) 사용 가능 여부를 확인하거나 GPU 연산을 다루는 PyTorch 하위 모듈. torch.cuda.is_available()로 GPU 여부를 판단함.",
    "torch.cat": "여러 PyTorch 텐서를 지정한 축 방향으로 이어 붙이는 함수. dim=1은 시간 축으로 이어 붙여 긴 음성 데이터를 만듦.",
    "numpy(np)": "숫자 배열을 효율적으로 다루는 파이썬 라이브러리. 음성 데이터의 정규화(음량 조절)와 형식 변환에 사용함.",
    "scipy.wavfile": "scipy 라이브러리의 WAV 파일 읽기/쓰기 모듈. wavfile.write()로 numpy 배열을 WAV 파일로 저장함.",
    "tqdm": "반복 작업의 진행 상황을 프로그레스 바(=====50%=====>)로 시각적으로 보여주는 라이브러리. 긴 작업의 완료 예상 시간을 확인할 수 있음.",
    "Voice Cloning": "참조 음성 파일에서 화자의 목소리 특성(억양·톤·리듬)을 추출해, 새로운 텍스트를 그 목소리로 읽어주는 기술.",
    "Perth 워터마크": "Resemble AI가 음성 복제 남용을 방지하기 위해 생성 오디오에 자동 삽입하는 비가청(들리지 않는) 식별 신호. 이 신호로 AI 생성 음성임을 추적할 수 있음.",
  },
};
