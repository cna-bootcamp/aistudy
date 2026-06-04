/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../06.tts/kakao-vits/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "Kakao VITS TTS — 다화자 텍스트 음성 합성 예제 설명",
    entry: "tts.py",
  },

  files: [
    { id: "main", label: "tts.py", role: "단일 파일 CLI 예제 · 한국어→영어 번역 후 VITS 모델로 다화자 WAV 생성" },
  ],

  flow: [
    {
      step: 1,
      title: "환경 준비", label: "환경 준비", refs: ["module_setup"],
      summary: "espeak-ng 경로를 시스템 PATH에 추가하고 필요한 라이브러리를 불러옴",
      detail: "레코딩 스튜디오 문을 열기 전에 장비를 세팅하는 단계임. Windows에서 음소 변환기(phonemizer)가 espeak-ng를 못 찾는 문제를 방지하려고 파일 맨 위에서 미리 환경변수를 설정함. 그 뒤에 re, Path, numpy 등 필요한 도구들을 불러옴.",
    },
    {
      step: 2,
      title: "사전 요건 검사", label: "사전 요건 검사", refs: ["check_prerequisites"],
      summary: "check_prerequisites()가 PyTorch와 espeak-ng 설치 여부를 확인하고, 없으면 안내 후 종료함",
      detail: "녹음을 시작하기 전에 마이크와 앰프가 잘 꽂혀 있는지 확인하는 단계임. PyTorch(딥러닝 엔진)와 espeak-ng(발음 변환 도구)가 없으면 어차피 아무것도 할 수 없으므로 친절한 설치 안내를 출력하고 프로그램을 바로 멈춤. 이렇게 하면 나중에 알 수 없는 오류로 헤매는 것을 막을 수 있음.",
    },
    {
      step: 3,
      title: "번역 캐시 로드", label: "번역 캐시 로드", refs: ["load_translation_cache", "_cache_path"],
      summary: "load_translation_cache()가 이전에 번역한 결과를 CSV 파일에서 읽어 딕셔너리로 준비함",
      detail: "이미 번역한 문장을 또 번역하면 시간과 비용이 낭비됨. 이전 실행에서 저장해 둔 translations/dialog_en.csv 파일이 있으면 그 내용을 '원문→영문' 표(딕셔너리)로 읽어들임. 파일이 없으면 빈 표로 시작함.",
    },
    {
      step: 4,
      title: "대화 파일 로드", label: "대화 파일 로드", refs: ["load_dialog"],
      summary: "load_dialog()가 text/dialog.csv에서 speaker·text 컬럼을 읽어 DataFrame으로 반환함",
      detail: "연기자(화자)들의 대본을 불러오는 단계임. 파이프(|) 구분자 CSV 파일에서 speaker(화자명)·text(대사) 컬럼을 읽음. 컬럼이 없거나 파일이 없으면 친절한 오류를 내고 종료함.",
    },
    {
      step: 5,
      title: "화자별 음성 선택", label: "화자 음성 선택", refs: ["display_voice_menu"],
      summary: "display_voice_menu()로 각 화자에게 VCTK 108명 중 한 명의 목소리를 배정함",
      detail: "각 대사를 어떤 배우 목소리로 낼지 고르는 캐스팅 단계임. 억양 그룹(English·Scottish·American 등)별로 화자 목록을 보여주고, 사용자가 번호를 입력해 각 캐릭터의 목소리를 선택함.",
    },
    {
      step: 6,
      title: "한국어→영어 번역", label: "한국어→영어 번역", refs: ["translate_to_english", "save_translation_cache"],
      summary: "translate_to_english()가 각 대사를 영어로 변환함 (캐시 우선, 새 번역은 저장)",
      detail: "VITS 모델은 영어 텍스트를 입력받으므로, 한국어 대사를 먼저 영어로 바꿔야 함. 캐시에 있으면 즉시 재사용하고, 없으면 Google 번역 API로 번역한 뒤 캐시에 저장함. tqdm으로 진행률을 프로그레스 바로 보여줌.",
    },
    {
      step: 7,
      title: "모델 로드", label: "모델 로드",
      summary: "HuggingFace에서 kakao-enterprise/vits-vctk 모델과 토크나이저를 내려받아 준비함",
      detail: "녹음 스튜디오의 핵심 장비(AI 성우 모델)를 불러오는 단계임. 첫 실행 시 약 500 MB를 내려받음. GPU(CUDA)가 있으면 GPU를, 없으면 CPU를 사용함.",
    },
    {
      step: 8,
      title: "오디오 세그먼트 생성", label: "세그먼트 생성", refs: ["generate_segment", "sanitize_for_tts", "make_silence"],
      summary: "generate_segment()가 각 대사를 WAV 파형(numpy 배열)으로 변환하고, 대사 사이에 짧은 무음을 삽입함",
      detail: "대본의 각 줄을 한 줄씩 녹음하는 단계임. sanitize_for_tts로 텍스트를 정리한 뒤 VITS 모델에 화자 ID와 함께 넘기면 파형(음파 숫자 배열)이 나옴. 대사와 대사 사이에 0.2초 무음을 끼워 자연스럽게 이어 붙임.",
    },
    {
      step: 9,
      title: "정규화 및 WAV 저장", label: "정규화·저장",
      summary: "세그먼트를 이어 붙이고 볼륨을 정규화한 뒤 16-bit PCM WAV로 저장함",
      detail: "녹음된 조각들을 하나의 완성된 음성 파일로 합치는 단계임. 볼륨이 너무 크거나 작으면 일관성이 깨지므로 최대값 기준으로 0.95 비율로 정규화함. 최종 결과를 result.wav로 저장함.",
    },
  ],

  functions: [
    // ===== tts.py (메인·유일 파일) =====
    {
      id: "module_setup",
      name: "모듈 설정 (espeak-ng PATH · VCTK_SPEAKERS)",
      fileId: "main",
      summary: "파일 맨 위에서 espeak-ng 경로를 환경변수에 등록하고, 108명 VCTK 화자 데이터를 상수로 정의함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 실행되는 설정 코드'임. phonemizer 라이브러리는 espeak-ng 실행 파일이 PATH에 있어야 동작하는데, Windows에서는 자동으로 등록되지 않는 경우가 많아 직접 추가함. VCTK_SPEAKERS는 108명 화자의 정보(아이디·성별·나이·억양·지역)를 담은 큰 딕셔너리임.",
      terms: ["환경변수(os.environ)", "Path(__file__)", "딕셔너리(dict)", "phonemizer", "VCTK"],
      lines: [
        { at: "_ESPEAK_PATHS = [", text: "espeak-ng가 설치될 수 있는 Windows 경로 두 곳을 미리 목록으로 정의함." },
        { at: 'os.environ["PATH"] = _p + os.pathsep', text: "espeak-ng 폴더를 시스템 PATH 맨 앞에 추가해 phonemizer가 찾을 수 있게 함." },
        { at: 'os.environ["PHONEMIZER_ESPEAK_LIBRARY"]', text: "phonemizer가 사용할 espeak-ng DLL 파일 경로를 환경변수로 지정함." },
        { at: "SCRIPT_DIR = Path(__file__).parent", text: "Path(__file__)은 '이 파이썬 파일 자체'를 의미함. .parent로 이 파일이 있는 폴더 경로를 구함." },
        { at: 'VCTK_SPEAKERS: Dict[int, Dict] = {', text: "108명 화자 정보를 '번호→정보 딕셔너리' 형태로 정의한 상수임. 번호가 모델에 넘길 speaker_id임." },
      ],
      code:
`# Windows espeak-ng PATH 설정 — phonemizer import 전에 반드시 실행해야 함
_ESPEAK_PATHS = [
    r"C:\\Program Files\\eSpeak NG",
    r"C:\\Program Files (x86)\\eSpeak NG",
]
for _p in _ESPEAK_PATHS:
    if os.path.exists(_p):
        # PATH: espeak-ng 실행 파일 경로를 시스템 PATH에 추가함
        os.environ["PATH"] = _p + os.pathsep + os.environ.get("PATH", "")
        # PHONEMIZER_ESPEAK_LIBRARY: phonemizer가 사용할 espeak-ng DLL 경로
        os.environ["PHONEMIZER_ESPEAK_LIBRARY"] = os.path.join(_p, "libespeak-ng.dll")
        # PHONEMIZER_ESPEAK_PATH: phonemizer가 사용할 espeak-ng 실행 파일 경로
        os.environ["PHONEMIZER_ESPEAK_PATH"] = os.path.join(_p, "espeak-ng.exe")
        break

# 이 파일이 위치한 디렉터리 경로를 구함
SCRIPT_DIR = Path(__file__).parent   # hands-on/06.tts/kakao-vits/
TTS_ROOT   = SCRIPT_DIR.parent       # hands-on/06.tts/

# ============================================================
# VCTK 화자 데이터베이스 (108명)
# ============================================================
VCTK_SPEAKERS: Dict[int, Dict] = {
    0:   {"id": "p225", "gender": "F", "age": 23, "accent": "English",       "region": "Southern England"},
    1:   {"id": "p226", "gender": "M", "age": 22, "accent": "English",       "region": "Surrey"},
    2:   {"id": "p227", "gender": "M", "age": 38, "accent": "English",       "region": "Cumbria"},
    3:   {"id": "p228", "gender": "F", "age": 22, "accent": "English",       "region": "Southern England"},
    4:   {"id": "p229", "gender": "F", "age": 23, "accent": "English",       "region": "Southern England"},
    5:   {"id": "p230", "gender": "F", "age": 22, "accent": "English",       "region": "Stockton-on-tees"},
    6:   {"id": "p231", "gender": "F", "age": 23, "accent": "English",       "region": "Southern England"},
    7:   {"id": "p232", "gender": "M", "age": 23, "accent": "English",       "region": "Southern England"},
    8:   {"id": "p233", "gender": "F", "age": 23, "accent": "English",       "region": "Staffordshire"},
    9:   {"id": "p234", "gender": "F", "age": 22, "accent": "Scottish",      "region": "West Dumfries"},
    10:  {"id": "p236", "gender": "F", "age": 23, "accent": "English",       "region": "Manchester"},
    11:  {"id": "p237", "gender": "M", "age": 22, "accent": "Scottish",      "region": "Fife"},
    12:  {"id": "p238", "gender": "F", "age": 22, "accent": "English",       "region": "Northampton"},
    13:  {"id": "p239", "gender": "F", "age": 22, "accent": "English",       "region": "Southwest England"},
    14:  {"id": "p240", "gender": "F", "age": 21, "accent": "English",       "region": "Southern England"},
    15:  {"id": "p241", "gender": "M", "age": 21, "accent": "Scottish",      "region": "Perth"},
    16:  {"id": "p243", "gender": "M", "age": 22, "accent": "English",       "region": "London"},
    17:  {"id": "p244", "gender": "F", "age": 22, "accent": "English",       "region": "Manchester"},
    18:  {"id": "p245", "gender": "M", "age": 23, "accent": "Irish",         "region": "Dublin"},
    19:  {"id": "p246", "gender": "M", "age": 22, "accent": "Scottish",      "region": "Edinburgh"},
    20:  {"id": "p247", "gender": "M", "age": 22, "accent": "Scottish",      "region": "Argyll"},
    21:  {"id": "p248", "gender": "F", "age": 23, "accent": "Indian",        "region": "India"},
    22:  {"id": "p249", "gender": "F", "age": 22, "accent": "Scottish",      "region": "Edinburgh"},
    23:  {"id": "p250", "gender": "F", "age": 22, "accent": "English",       "region": "Southeast England"},
    24:  {"id": "p251", "gender": "M", "age": 26, "accent": "Indian",        "region": "India"},
    25:  {"id": "p252", "gender": "M", "age": 22, "accent": "Scottish",      "region": "Edinburgh"},
    26:  {"id": "p253", "gender": "F", "age": 22, "accent": "Welsh",         "region": "Cardiff"},
    27:  {"id": "p254", "gender": "M", "age": 21, "accent": "English",       "region": "Surrey"},
    28:  {"id": "p255", "gender": "M", "age": 19, "accent": "Scottish",      "region": "Fife"},
    29:  {"id": "p256", "gender": "M", "age": 24, "accent": "English",       "region": "Birmingham"},
    30:  {"id": "p257", "gender": "F", "age": 24, "accent": "English",       "region": "Southern England"},
    31:  {"id": "p258", "gender": "M", "age": 22, "accent": "English",       "region": "Southern England"},
    32:  {"id": "p259", "gender": "M", "age": 23, "accent": "English",       "region": "Nottingham"},
    33:  {"id": "p260", "gender": "M", "age": 21, "accent": "Irish",         "region": "Dublin"},
    34:  {"id": "p261", "gender": "F", "age": 30, "accent": "NorthernIrish", "region": "Belfast"},
    35:  {"id": "p262", "gender": "F", "age": 23, "accent": "Scottish",      "region": "Edinburgh"},
    36:  {"id": "p263", "gender": "M", "age": 22, "accent": "Scottish",      "region": "Aberdeen"},
    37:  {"id": "p264", "gender": "F", "age": 23, "accent": "Scottish",      "region": "Falkirk"},
    38:  {"id": "p265", "gender": "F", "age": 23, "accent": "Scottish",      "region": "Dumfries"},
    39:  {"id": "p266", "gender": "F", "age": 22, "accent": "Irish",         "region": "Dublin"},
    40:  {"id": "p267", "gender": "F", "age": 23, "accent": "English",       "region": "Yorkshire"},
    41:  {"id": "p268", "gender": "F", "age": 23, "accent": "English",       "region": "Southern England"},
    42:  {"id": "p269", "gender": "F", "age": 20, "accent": "English",       "region": "Newcastle"},
    43:  {"id": "p270", "gender": "M", "age": 21, "accent": "English",       "region": "Yorkshire"},
    44:  {"id": "p271", "gender": "M", "age": 19, "accent": "Scottish",      "region": "Edinburgh"},
    45:  {"id": "p272", "gender": "M", "age": 26, "accent": "Scottish",      "region": "Edinburgh"},
    46:  {"id": "p273", "gender": "M", "age": 23, "accent": "English",       "region": "Suffolk"},
    47:  {"id": "p274", "gender": "M", "age": 22, "accent": "English",       "region": "Essex"},
    48:  {"id": "p275", "gender": "M", "age": 23, "accent": "Scottish",      "region": "Aberdeen"},
    49:  {"id": "p276", "gender": "F", "age": 24, "accent": "English",       "region": "Oxford"},
    50:  {"id": "p277", "gender": "F", "age": 23, "accent": "English",       "region": "NE England"},
    51:  {"id": "p278", "gender": "M", "age": 22, "accent": "English",       "region": "Cheshire"},
    52:  {"id": "p279", "gender": "M", "age": 23, "accent": "English",       "region": "Leicester"},
    53:  {"id": "p280", "gender": "M", "age": 21, "accent": "American",      "region": "US"},
    54:  {"id": "p281", "gender": "M", "age": 28, "accent": "Scottish",      "region": "Glasgow"},
    55:  {"id": "p282", "gender": "F", "age": 21, "accent": "Scottish",      "region": "Edinburgh"},
    56:  {"id": "p283", "gender": "F", "age": 23, "accent": "Irish",         "region": "Cork"},
    57:  {"id": "p284", "gender": "M", "age": 25, "accent": "English",       "region": "Lancashire"},
    58:  {"id": "p285", "gender": "M", "age": 19, "accent": "Scottish",      "region": "Edinburgh"},
    59:  {"id": "p286", "gender": "M", "age": 23, "accent": "English",       "region": "Newcastle"},
    60:  {"id": "p287", "gender": "M", "age": 23, "accent": "English",       "region": "Yorkshire"},
    61:  {"id": "p288", "gender": "F", "age": 22, "accent": "Irish",         "region": "Dublin"},
    62:  {"id": "p292", "gender": "M", "age": 23, "accent": "NorthernIrish", "region": "Belfast"},
    63:  {"id": "p293", "gender": "F", "age": 22, "accent": "American",      "region": "US"},
    64:  {"id": "p294", "gender": "F", "age": 33, "accent": "American",      "region": "US"},
    65:  {"id": "p295", "gender": "F", "age": 25, "accent": "Irish",         "region": "Dublin"},
    66:  {"id": "p297", "gender": "F", "age": 20, "accent": "American",      "region": "New York"},
    67:  {"id": "p298", "gender": "M", "age": 21, "accent": "Irish",         "region": "Meath"},
    68:  {"id": "p299", "gender": "F", "age": 25, "accent": "American",      "region": "US"},
    69:  {"id": "p300", "gender": "F", "age": 23, "accent": "American",      "region": "California"},
    70:  {"id": "p301", "gender": "F", "age": 23, "accent": "American",      "region": "North Carolina"},
    71:  {"id": "p302", "gender": "M", "age": 28, "accent": "Canadian",      "region": "Canada"},
    72:  {"id": "p303", "gender": "F", "age": 23, "accent": "Indian",        "region": "India"},
    73:  {"id": "p304", "gender": "M", "age": 24, "accent": "NorthernIrish", "region": "Belfast"},
    74:  {"id": "p305", "gender": "F", "age": 19, "accent": "American",      "region": "US"},
    75:  {"id": "p306", "gender": "F", "age": 24, "accent": "American",      "region": "US"},
    76:  {"id": "p307", "gender": "F", "age": 23, "accent": "Canadian",      "region": "Canada"},
    77:  {"id": "p308", "gender": "F", "age": 23, "accent": "Indian",        "region": "India"},
    78:  {"id": "p310", "gender": "F", "age": 21, "accent": "American",      "region": "US"},
    79:  {"id": "p311", "gender": "M", "age": 21, "accent": "American",      "region": "US"},
    80:  {"id": "p312", "gender": "F", "age": 21, "accent": "Canadian",      "region": "Canada"},
    81:  {"id": "p313", "gender": "F", "age": 20, "accent": "Indian",        "region": "India"},
    82:  {"id": "p314", "gender": "F", "age": 19, "accent": "SouthAfrican",  "region": "South Africa"},
    83:  {"id": "p316", "gender": "M", "age": 20, "accent": "Canadian",      "region": "Canada"},
    84:  {"id": "p317", "gender": "F", "age": 23, "accent": "Canadian",      "region": "Canada"},
    85:  {"id": "p318", "gender": "F", "age": 20, "accent": "Welsh",         "region": "Wales"},
    86:  {"id": "p323", "gender": "F", "age": 19, "accent": "SouthAfrican",  "region": "South Africa"},
    87:  {"id": "p326", "gender": "M", "age": 21, "accent": "Irish",         "region": "Ireland"},
    88:  {"id": "p329", "gender": "F", "age": 23, "accent": "American",      "region": "US"},
    89:  {"id": "p330", "gender": "F", "age": 19, "accent": "American",      "region": "US"},
    90:  {"id": "p333", "gender": "F", "age": 23, "accent": "English",       "region": "Liverpool"},
    91:  {"id": "p334", "gender": "M", "age": 18, "accent": "Irish",         "region": "Dublin"},
    92:  {"id": "p335", "gender": "F", "age": 18, "accent": "English",       "region": "Birmingham"},
    93:  {"id": "p336", "gender": "F", "age": 24, "accent": "Scottish",      "region": "Fife"},
    94:  {"id": "p339", "gender": "F", "age": 21, "accent": "American",      "region": "US"},
    95:  {"id": "p340", "gender": "F", "age": 25, "accent": "English",       "region": "London"},
    96:  {"id": "p341", "gender": "F", "age": 24, "accent": "American",      "region": "US"},
    97:  {"id": "p343", "gender": "F", "age": 25, "accent": "Canadian",      "region": "Canada"},
    98:  {"id": "p345", "gender": "M", "age": 21, "accent": "American",      "region": "US"},
    99:  {"id": "p347", "gender": "M", "age": 27, "accent": "Indian",        "region": "India"},
    100: {"id": "p351", "gender": "F", "age": 21, "accent": "Indian",        "region": "India"},
    101: {"id": "p360", "gender": "M", "age": 21, "accent": "American",      "region": "US"},
    102: {"id": "p361", "gender": "F", "age": 26, "accent": "NewZealand",    "region": "New Zealand"},
    103: {"id": "p362", "gender": "F", "age": 29, "accent": "American",      "region": "US"},
    104: {"id": "p363", "gender": "M", "age": 22, "accent": "Canadian",      "region": "Canada"},
    105: {"id": "p364", "gender": "M", "age": 31, "accent": "Welsh",         "region": "Wales"},
    106: {"id": "p374", "gender": "M", "age": 24, "accent": "English",       "region": "Southern England"},
    107: {"id": "p376", "gender": "M", "age": 22, "accent": "English",       "region": "Kent"},
}`,
    },

    {
      id: "check_prerequisites",
      name: "check_prerequisites()",
      fileId: "main",
      summary: "PyTorch와 espeak-ng가 설치되어 있는지 확인하고, 하나라도 없으면 설치 안내를 출력하고 프로그램을 종료함.",
      how: "try/except로 torch를 import해 보고 실패하면 'PyTorch 없음'으로 기록함. espeak-ng는 shutil.which로 실행 파일이 PATH에 있는지, 또는 알려진 Windows 경로에 파일이 있는지 확인함. 하나라도 없으면 설치 방법 URL을 출력하고 sys.exit(1)로 즉시 종료함.",
      terms: ["예외 처리(try/except)", "shutil.which", "sys.exit()", "ImportError"],
      lines: [
        { at: "import torch  # noqa: F401", text: "torch를 import해 보고, ImportError가 나면 '설치 안 됨'으로 기록함. noqa는 '이 줄의 lint 경고를 무시해라'는 표시임." },
        { at: "espeak_found = shutil.which(", text: "shutil.which는 실행 파일이 PATH에 있는지 찾아줌. which('espeak-ng')가 None이면 찾지 못한 것임." },
        { at: "espeak_found = any(os.path.exists(p) for p in _ESPEAK_PATHS)", text: "PATH에 없더라도 알려진 Windows 설치 경로 중 하나라도 존재하면 설치된 것으로 봄." },
        { at: "if not missing:", text: "빠진 것이 없으면(missing 목록이 비면) 바로 함수를 끝내고 정상 진행함." },
        { at: "sys.exit(1)", text: "sys.exit(1)은 프로그램을 즉시 종료함. 숫자 1은 '비정상 종료(오류)'를 뜻함(0은 정상)." },
      ],
      code:
`def check_prerequisites() -> None:
    """PyTorch 및 espeak-ng 설치 여부를 확인하고, 미설치 시 안내 후 종료함."""
    missing = []

    try:
        import torch  # noqa: F401
    except ImportError:
        missing.append("pytorch")

    espeak_found = shutil.which("espeak-ng") is not None
    if not espeak_found:
        espeak_found = any(os.path.exists(p) for p in _ESPEAK_PATHS)
    if not espeak_found:
        missing.append("espeak-ng")

    if not missing:
        return

    print("\\n[Error] Required dependencies not found:\\n")

    if "pytorch" in missing:
        print("  [PyTorch]")
        print("  Install guide: https://github.com/cna-bootcamp/aistudy/blob/main/agentic-ai/reference/install-pytorch.md")
        print()

    if "espeak-ng" in missing:
        print("  [espeak-ng]")
        print("  Windows : https://github.com/espeak-ng/espeak-ng/releases (MSI installer)")
        print("  macOS   : brew install espeak-ng")
        print("  Linux   : sudo apt install espeak-ng")
        print()

    sys.exit(1)`,
    },

    {
      id: "_cache_path",
      name: "_cache_path()",
      fileId: "main",
      summary: "번역 캐시 CSV 파일이 저장될 경로를 반환하고, 필요하면 폴더를 미리 만들어 둠.",
      how: "캐시 파일은 tts.py 옆의 translations/ 폴더 안에 dialog_en.csv 이름으로 저장됨. mkdir(parents=True, exist_ok=True)는 폴더가 없어도 오류 없이 만들어 줌.",
      terms: ["Path(__file__)", "mkdir", "타입 힌트"],
      lines: [
        { at: 'cache_dir = SCRIPT_DIR / "translations"', text: "SCRIPT_DIR는 tts.py가 있는 폴더임. / 연산자로 하위 폴더 경로를 이어 붙임(파이썬 pathlib 문법)." },
        { at: "cache_dir.mkdir(parents=True, exist_ok=True)", text: "폴더가 없으면 만들어 줌. exist_ok=True는 이미 있어도 오류를 내지 않는 옵션임." },
        { at: 'return cache_dir / "dialog_en.csv"', text: "캐시 CSV 파일의 완성된 경로를 돌려줌." },
      ],
      code:
`def _cache_path() -> Path:
    """영어 번역 캐시 파일 경로를 반환함."""
    cache_dir = SCRIPT_DIR / "translations"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / "dialog_en.csv"`,
    },

    {
      id: "load_translation_cache",
      name: "load_translation_cache()",
      fileId: "main",
      summary: "이전에 번역한 결과를 CSV 파일에서 읽어 {원문: 번역문} 딕셔너리로 반환함.",
      how: "pandas의 read_csv로 | 구분자 파일을 읽음. original·translated 두 컬럼이 있으면 행을 돌며 딕셔너리로 만듦. 파일이 없거나 읽기에 실패해도 빈 딕셔너리를 돌려줘 프로그램이 멈추지 않음.",
      terms: ["pandas(DataFrame)", ".iterrows()", "예외 처리(try/except)", "딕셔너리(dict)"],
      lines: [
        { at: "path = _cache_path()", text: "캐시 파일 경로를 먼저 가져옴." },
        { at: "if path.exists():", text: "파일이 실제로 있을 때만 읽으려고 시도함. 없으면 빈 딕셔너리를 바로 반환함." },
        { at: 'df = pd.read_csv(path, sep="|"', text: "pandas read_csv로 | 구분자 CSV를 읽어 표(DataFrame) 형태로 가져옴." },
        { at: 'if "original" in df.columns and "translated" in df.columns:', text: "필요한 컬럼이 모두 있을 때만 처리함. 컬럼이 없으면 빈 딕셔너리로 처리됨." },
        { at: "for _, row in df.iterrows():", text: "DataFrame의 각 행을 하나씩 꺼냄. _는 '행 번호는 안 씀'을 뜻하는 관용 표현임." },
      ],
      code:
`def load_translation_cache() -> Dict[str, str]:
    """파일에서 영어 번역 캐시를 로드하여 {원문: 번역문} 딕셔너리로 반환함."""
    path = _cache_path()
    cache: Dict[str, str] = {}
    if path.exists():
        try:
            df = pd.read_csv(path, sep="|", encoding="utf-8")
            if "original" in df.columns and "translated" in df.columns:
                for _, row in df.iterrows():
                    cache[str(row["original"])] = str(row["translated"])
            print(f"[Cache] Loaded {len(cache)} translations from {path.name}")
        except Exception as e:
            print(f"[Cache] Failed to load cache: {e}")
    return cache`,
    },

    {
      id: "save_translation_cache",
      name: "save_translation_cache(cache)",
      fileId: "main",
      summary: "번역 결과 딕셔너리를 CSV 파일로 저장해 다음 실행 때 재사용할 수 있게 함.",
      how: "딕셔너리의 키·값을 original·translated 컬럼으로 만든 DataFrame을 | 구분자 CSV로 저장함. 저장 실패 시에도 오류를 출력할 뿐 프로그램은 계속 진행함.",
      terms: ["pandas(DataFrame)", "예외 처리(try/except)", "딕셔너리(dict)"],
      lines: [
        { at: 'df = pd.DataFrame([{"original": k, "translated": v}', text: "딕셔너리의 각 항목을 {original, translated} 행으로 변환해 DataFrame을 만듦." },
        { at: 'df.to_csv(path, sep="|", index=False', text: "| 구분자 CSV로 저장. index=False는 행 번호를 파일에 쓰지 않게 함." },
      ],
      code:
`def save_translation_cache(cache: Dict[str, str]) -> None:
    """영어 번역 캐시를 파일에 저장함."""
    path = _cache_path()
    try:
        df = pd.DataFrame([{"original": k, "translated": v} for k, v in cache.items()])
        df.to_csv(path, sep="|", index=False, encoding="utf-8")
        print(f"[Cache] Saved {len(cache)} translations to {path.name}")
    except Exception as e:
        print(f"[Cache] Failed to save cache: {e}")`,
    },

    {
      id: "translate_to_english",
      name: "translate_to_english(text, cache)",
      fileId: "main",
      summary: "텍스트를 영어로 번역하여 반환함. 캐시에 있으면 재사용하고, ASCII 텍스트는 번역 없이 그대로 씀.",
      how: "먼저 캐시에 이미 번역된 결과가 있는지 확인함. text.isascii()로 이미 영어(ASCII)인지 판단하고, 영어면 그대로 반환함. 한국어 등 비ASCII 문자가 있으면 deep-translator 라이브러리의 GoogleTranslator로 번역함. 번역이 실패하면 ASCII 문자만 추출하거나 placeholder를 사용하는 폴백(대안) 처리를 함.",
      terms: ["딕셔너리(dict)", ".isascii()", "GoogleTranslator", "예외 처리(try/except)", "폴백(fallback)"],
      lines: [
        { at: "if text in cache:", text: "캐시 딕셔너리에 이미 번역된 결과가 있으면 바로 반환함(API 호출 없이 재사용)." },
        { at: "if text.isascii():", text: ".isascii()는 텍스트가 모두 영문(ASCII 코드) 문자로만 이뤄져 있는지 확인함. True면 이미 영어라 번역 불필요." },
        { at: "from deep_translator import GoogleTranslator", text: "실제로 필요할 때만 deep_translator를 불러옴(지연 import). 설치 안 돼도 이 함수를 안 부르면 에러가 안 남." },
        { at: "result = GoogleTranslator(source=", text: "GoogleTranslator를 사용해 텍스트를 자동 감지(auto)→영어(en)로 번역함." },
        { at: 'ascii_only = text.encode("ascii", errors="ignore")', text: "번역이 실패했을 때의 폴백: ASCII 문자만 추출해 그나마 쓸 수 있는 문자열로 만듦." },
      ],
      code:
`def translate_to_english(text: str, cache: Dict[str, str]) -> str:
    """deep-translator를 사용해 텍스트를 영어로 번역하고 반환함 (캐시 활용)."""
    if text in cache:
        return cache[text]

    if text.isascii():
        cache[text] = text
        return text

    try:
        from deep_translator import GoogleTranslator
        result = GoogleTranslator(source="auto", target="en").translate(text)
        if result:
            cache[text] = result
            return result
    except Exception as e:
        print(f"[Translation] deep-translator error: {e}")

    # 번역 실패 시 ASCII 문자만 추출하여 반환 (폴백)
    ascii_only = text.encode("ascii", errors="ignore").decode("ascii").strip()
    if ascii_only:
        print(f"[Warning] Translation failed, using ASCII fallback: {ascii_only[:50]}")
        cache[text] = ascii_only
        return ascii_only

    print(f"[Warning] Non-ASCII text, no fallback available: {text[:30]}... → using placeholder")
    placeholder = "untranslated text"
    cache[text] = placeholder
    return placeholder`,
    },

    {
      id: "display_voice_menu",
      name: "display_voice_menu(character_name)",
      fileId: "main",
      summary: "화자 이름을 받아 억양 그룹별 VCTK 화자 목록을 출력하고, 사용자가 번호로 고른 화자 인덱스를 반환함.",
      how: "108명의 화자를 억양(English·Scottish·American 등)별로 묶어(setdefault 패턴) 정렬 후 번호를 매겨 출력함. 사용자가 번호를 입력하면 해당 VCTK 화자 인덱스를 반환함. 잘못된 입력이 오면 다시 물음(while True 반복).",
      terms: ["딕셔너리(dict)", "setdefault()", "sorted()", "while 반복", "예외 처리(try/except)", "타입 힌트"],
      lines: [
        { at: "accents: Dict[str, List] = {}", text: "억양 이름을 키로, 해당 화자 목록을 값으로 담을 빈 딕셔너리를 준비함." },
        { at: "accents.setdefault(info[\"accent\"], []).append((idx, info))", text: "setdefault는 키가 없으면 기본값(빈 목록)을 만들고 거기에 추가하는 편리한 패턴임. 억양별로 화자를 그룹화함." },
        { at: "for accent in sorted(accents.keys()):", text: "억양 이름을 알파벳 순으로 정렬해 화면에 보여줌." },
        { at: 'choice = input(f"Enter number (1-{len(all_options)}): ")', text: "input()으로 사용자가 번호를 입력하게 함. .strip()으로 앞뒤 공백을 제거함." },
        { at: "idx = int(choice) - 1", text: "입력한 글자를 숫자로 바꾸고 1을 빼 0-기반 인덱스로 변환함. 숫자가 아니면 except로 가서 다시 물음." },
        { at: "if 0 <= idx < len(all_options):", text: "번호가 유효한 범위 안이면 해당 화자 인덱스를 반환함." },
      ],
      code:
`def display_voice_menu(character_name: str) -> int:
    """억양 그룹별 화자 메뉴를 표시하고, 선택된 화자 인덱스를 반환함."""
    print(f"\\n{'=' * 60}")
    print(f"Select Voice for '{character_name}'")
    print("=" * 60)

    # 억양별로 그룹화
    accents: Dict[str, List] = {}
    for idx, info in VCTK_SPEAKERS.items():
        accents.setdefault(info["accent"], []).append((idx, info))

    all_options: List[int] = []
    option_num = 1

    for accent in sorted(accents.keys()):
        print(f"\\n  [{accent}]")
        for idx, info in accents[accent]:
            gender_str = "Female" if info["gender"] == "F" else "Male"
            print(f"    {option_num:3}. {info['id']} - {gender_str}, Age {info['age']}, {info['region']}")
            all_options.append(idx)
            option_num += 1

    print("\\n" + "=" * 60)

    while True:
        try:
            choice = input(f"Enter number (1-{len(all_options)}): ").strip()
            idx = int(choice) - 1
            if 0 <= idx < len(all_options):
                selected = all_options[idx]
                info = VCTK_SPEAKERS[selected]
                print(f"Selected: {info['id']} ({info['gender']}, {info['accent']}, {info['region']})")
                return selected
        except (ValueError, KeyboardInterrupt):
            pass
        print("Invalid choice. Please try again.")`,
    },

    {
      id: "load_dialog",
      name: "load_dialog(path)",
      fileId: "main",
      summary: "파이프(|) 구분자 CSV에서 대화 데이터를 읽고, speaker·text 컬럼이 있는지 검증한 뒤 DataFrame으로 반환함.",
      how: "파일이 없으면 오류를 출력하고 종료함. 파일이 있으면 pandas로 읽고, speaker·text 컬럼이 반드시 있어야 함을 확인함. 컬럼이 없으면 오류를 출력하고 종료함.",
      terms: ["pandas(DataFrame)", "sys.exit()", "타입 힌트"],
      lines: [
        { at: "if not path.exists():", text: "입력 파일이 없으면 오류를 출력하고 즉시 종료함. 없는 파일로 계속 진행하면 더 알기 어려운 오류가 발생함." },
        { at: 'df = pd.read_csv(path, sep="|"', text: "| 구분자 CSV를 읽어 DataFrame으로 가져옴. DataFrame은 엑셀 표처럼 행·열로 이뤄진 데이터 구조임." },
        { at: 'for col in ("speaker", "text"):', text: "speaker와 text 두 컬럼이 모두 있는지 순서대로 확인함." },
        { at: "if col not in df.columns:", text: "컬럼이 없으면 오류를 출력하고 종료함." },
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

    return df`,
    },

    {
      id: "sanitize_for_tts",
      name: "sanitize_for_tts(text)",
      fileId: "main",
      summary: "VITS 모델에 넣기 전 텍스트를 정리함 — 비ASCII 문자 제거, 연속 공백 정규화, 특수문자 제거.",
      how: "VITS 모델은 영어 텍스트만 처리할 수 있음. 비ASCII 문자가 섞여 있으면 오류가 나므로, ASCII 문자만 남기고 나머지를 제거함. 빈 텍스트가 되면 'silence'(무음)나 'untranslated text'를 대신 넣어 모델이 빈 입력을 받지 않게 함. re.sub으로 공백·특수문자를 정규식으로 정리함.",
      terms: ["정규식(re.sub)", ".isascii()", ".strip()", "폴백(fallback)"],
      lines: [
        { at: 'if not text or not text.strip():', text: "텍스트가 아예 없거나 공백뿐이면 'silence'를 돌려줌(모델이 빈 입력을 받으면 오류가 남)." },
        { at: "if not text.isascii():", text: "비ASCII(예: 한글)가 포함된 경우 ASCII 문자만 추출함. 번역이 완벽하지 않을 때를 대비한 안전장치임." },
        { at: 'text = re.sub(r"\\s+", " ", text).strip()', text: "re.sub로 연속된 공백(탭·줄바꿈 포함)을 공백 하나로 줄임." },
        { at: 'text = re.sub(r"[^\\w\\s.,!?\'\\"-]", "", text)', text: "단어·공백·허용된 특수문자(.,!?'\"-)만 남기고 나머지를 제거함." },
      ],
      code:
`def sanitize_for_tts(text: str) -> str:
    """VITS 입력을 위해 비ASCII 문자를 제거하고 공백을 정규화하여 반환함."""
    if not text or not text.strip():
        return "silence"

    if not text.isascii():
        ascii_only = text.encode("ascii", errors="ignore").decode("ascii").strip()
        if not ascii_only:
            return "untranslated text"
        text = ascii_only

    text = re.sub(r"\\s+", " ", text).strip()
    text = re.sub(r"[^\\w\\s.,!?'\\"-]", "", text)
    return text if text else "silence"`,
    },

    {
      id: "generate_segment",
      name: "generate_segment(model, tokenizer, text, speaker_id, device)",
      fileId: "main",
      summary: "텍스트 한 문장과 화자 ID를 받아 VITS 모델로 음성 파형(numpy 배열)을 생성하여 반환함.",
      how: "먼저 sanitize_for_tts로 텍스트를 정리하고, 토크나이저로 모델이 이해하는 숫자 형태로 변환함. torch.no_grad() 블록 안에서 모델을 실행하면 메모리를 덜 씀(추론 전용). 결과 파형을 GPU→CPU로 옮겨 numpy 배열로 변환해 반환함.",
      terms: ["numpy(배열)", "VITS", "토크나이저(tokenizer)", "torch.no_grad()", "GPU·CPU", "waveform(파형)"],
      lines: [
        { at: "clean = sanitize_for_tts(text)", text: "텍스트를 모델이 처리할 수 있게 정리함." },
        { at: "inputs = tokenizer(clean, return_tensors=", text: "tokenizer가 텍스트를 숫자 텐서로 변환해 모델에 넘길 준비를 함. return_tensors='pt'는 PyTorch 텐서 형식임." },
        { at: "with torch.no_grad():", text: "torch.no_grad() 블록 안에서는 그라디언트(학습용 계산)를 하지 않아 메모리를 아낌. 추론(실행)만 할 때 쓰는 패턴임." },
        { at: "output = model(**inputs, speaker_id=torch.tensor([speaker_id])", text: "model에 입력 텐서와 화자 ID를 함께 넘겨 음성 파형을 생성함. **inputs는 딕셔너리를 인자로 풀어 넘기는 파이썬 문법임." },
        { at: "return output.waveform.squeeze().cpu().numpy()", text: ".squeeze()는 크기 1인 차원을 제거하고, .cpu()로 GPU에서 CPU로 옮긴 뒤 .numpy()로 numpy 배열로 변환함." },
      ],
      code:
`def generate_segment(model, tokenizer, text: str, speaker_id: int, device) -> np.ndarray:
    """단일 텍스트 세그먼트의 파형을 생성하여 numpy 배열로 반환함."""
    import torch

    clean = sanitize_for_tts(text)
    inputs = tokenizer(clean, return_tensors="pt").to(device)

    with torch.no_grad():
        output = model(**inputs, speaker_id=torch.tensor([speaker_id]).to(device))

    return output.waveform.squeeze().cpu().numpy()`,
    },

    {
      id: "make_silence",
      name: "make_silence(duration_sec, sample_rate)",
      fileId: "main",
      summary: "지정한 길이(초)만큼의 무음(0으로 채워진) 배열을 만들어 반환함.",
      how: "오디오는 숫자 배열임. 0으로 채워진 배열은 소리가 없는 구간(무음)을 의미함. duration_sec * sample_rate로 필요한 샘플 개수를 계산해 그 크기의 0 배열을 만듦.",
      terms: ["numpy(배열)", "sample_rate(샘플링 레이트)", "float32"],
      lines: [
        { at: "return np.zeros(int(duration_sec * sample_rate), dtype=np.float32)", text: "np.zeros는 0으로 채워진 배열을 만듦. 길이 = 초 × 샘플링 레이트(1초당 샘플 수). float32는 오디오에 주로 쓰이는 32비트 소수 형식임." },
      ],
      code:
`def make_silence(duration_sec: float, sample_rate: int) -> np.ndarray:
    """지정 길이(초)의 무음 float32 배열을 생성하여 반환함."""
    return np.zeros(int(duration_sec * sample_rate), dtype=np.float32)`,
    },

    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "전체 TTS 파이프라인을 순서대로 실행하는 진입점. 환경 설정→캐시→대화 로드→화자 선택→번역→모델 로드→오디오 생성→저장.",
      how: "프로그램의 '지휘자' 함수임. 각 단계를 번호와 주석으로 명확히 구분해 놓아 흐름을 파악하기 쉬움. GPU가 있으면 자동으로 GPU를 쓰고, 없으면 CPU를 씀. tqdm으로 진행률을 표시하며 각 대사를 처리함. 세그먼트를 모두 이어 붙인 뒤 볼륨을 정규화하고 16-bit PCM WAV로 저장함.",
      terms: ["VitsModel", "AutoTokenizer", "tqdm", "numpy(배열)", "GPU·CPU", "sample_rate(샘플링 레이트)", "PCM", "if __name__"],
      lines: [
        { at: 'if hasattr(sys.stdout, "reconfigure"):', text: "Windows 콘솔에서 한글이 깨지는 것을 막기 위해 출력 인코딩을 UTF-8로 다시 설정함." },
        { at: "from transformers import VitsModel, AutoTokenizer", text: "VitsModel: HuggingFace의 VITS TTS 모델. AutoTokenizer: 모델에 맞는 토크나이저를 자동으로 선택해 불러오는 도구." },
        { at: "check_prerequisites()", text: "PyTorch·espeak-ng 설치를 확인하고, 없으면 여기서 종료됨." },
        { at: "speakers: List[str] = list(dict.fromkeys(df[\"speaker\"]", text: "dict.fromkeys로 중복을 없애면서 등장 순서를 유지한 화자 목록을 만듦. set()은 순서를 보장하지 않아 대신 사용함." },
        { at: "device = torch.device(\"cuda\" if torch.cuda.is_available() else \"cpu\")", text: "GPU(CUDA)를 사용할 수 있으면 GPU를, 없으면 CPU를 쓰도록 자동 선택함." },
        { at: "model = VitsModel.from_pretrained(\"kakao-enterprise/vits-vctk\")", text: "HuggingFace Hub에서 Kakao의 VITS 모델을 불러옴. 첫 실행 시 약 500 MB를 다운로드함." },
        { at: "for text in tqdm(texts_raw, desc=\"Translating\"):", text: "tqdm은 반복 진행률을 프로그레스 바로 보여주는 도구. 몇 개 중 몇 개가 완료됐는지 한눈에 볼 수 있음." },
        { at: "for i, (_, row) in enumerate(tqdm(df.iterrows()", text: "df.iterrows()로 대화 행을 하나씩 꺼내고 tqdm으로 진행률을 표시하며 각 대사를 음성으로 변환함." },
        { at: "final = np.concatenate(segments)", text: "np.concatenate로 각 대사의 오디오 배열을 순서대로 이어 붙여 하나의 긴 배열로 만듦." },
        { at: "final = final / max_val * 0.95", text: "최대 절댓값으로 나눠 정규화한 뒤 0.95를 곱해 클리핑(소리 잘림)을 방지함." },
        { at: "final_int16 = (final * 32767).astype(np.int16)", text: "float32(소수) 파형을 16-bit 정수(int16)로 변환함. 32767은 int16의 최댓값으로, 이렇게 해야 표준 WAV 파일 형식이 됨." },
        { at: "wavfile.write(str(output_path), sample_rate, final_int16)", text: "scipy의 wavfile.write로 완성된 오디오를 WAV 파일로 저장함." },
      ],
      code:
`def main() -> None:
    """Kakao VITS 다화자 TTS 전체 파이프라인을 실행함."""
    # Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    import torch
    import scipy.io.wavfile as wavfile
    # VitsModel: HuggingFace Transformers의 VITS TTS 모델 — kakao-enterprise/vits-vctk 사용
    from transformers import VitsModel, AutoTokenizer

    print("=" * 60)
    print("Kakao VITS TTS - Multi-speaker Text-to-Speech")
    print("Model : kakao-enterprise/vits-vctk (108 speakers)")
    print("=" * 60)

    # 1. 사전 요건 검사
    check_prerequisites()

    # 2. 경로 설정
    input_path  = TTS_ROOT / "text" / "dialog.csv"
    output_path = SCRIPT_DIR / "result.wav"

    # 3. 번역 캐시 로드
    cache = load_translation_cache()

    # 4. 대화 파일 로드
    print(f"\\n[Load] Reading dialog from {input_path.name}...")
    df = load_dialog(input_path)
    print(f"[Load] {len(df)} lines loaded")

    # 5. 등장 순서를 유지한 고유 화자 목록
    speakers: List[str] = list(dict.fromkeys(df["speaker"].astype(str).tolist()))
    print(f"[Load] {len(speakers)} speakers found: {speakers}")

    # 6. 화자별 음성 선택
    speaker_voice: Dict[str, int] = {}
    for spk in speakers:
        speaker_voice[spk] = display_voice_menu(spk)

    print("\\n" + "=" * 60)
    print("Voice Assignment")
    print("=" * 60)
    for spk, vid in speaker_voice.items():
        info = VCTK_SPEAKERS[vid]
        print(f"  {spk}: {info['id']} ({info['gender']}, {info['accent']}, {info['region']})")

    # 7. 한국어→영어 번역
    print("\\n[Translation] Translating to English...")
    texts_raw = df["text"].astype(str).tolist()
    translated: List[str] = []
    new_count = 0

    # tqdm: 반복 작업의 진행률을 프로그레스 바로 표시함
    for text in tqdm(texts_raw, desc="Translating"):
        before = len(cache)
        en = translate_to_english(text, cache)
        if len(cache) > before:
            new_count += 1
        translated.append(en)

    if new_count > 0:
        save_translation_cache(cache)
        print(f"[Translation] {new_count} new translations cached")
    else:
        print("[Translation] All loaded from cache")

    # 8. 모델 로드
    print("\\n[Model] Loading kakao-enterprise/vits-vctk...")
    print("[Model] First run will download the model (~500 MB)...")

    # GPU(CUDA) 사용 가능 여부 확인. 불가능하면 CPU 사용
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[Model] Device: {device}")

    model = VitsModel.from_pretrained("kakao-enterprise/vits-vctk").to(device)
    tokenizer = AutoTokenizer.from_pretrained("kakao-enterprise/vits-vctk")
    sample_rate: int = model.config.sampling_rate
    print(f"[Model] Loaded (sample rate: {sample_rate} Hz)")

    # 9. 오디오 세그먼트 생성
    print("\\n[Audio] Generating speech...")
    segments: List[np.ndarray] = []
    silence = make_silence(0.2, sample_rate)

    for i, (_, row) in enumerate(tqdm(df.iterrows(), total=len(df), desc="Generating")):
        spk  = str(row["speaker"])
        text = translated[i]
        vid  = speaker_voice[spk]

        wav = generate_segment(model, tokenizer, text, vid, device)
        segments.append(wav)
        if i < len(df) - 1:
            segments.append(silence)

    # 10. 세그먼트 연결, 정규화, 저장
    print("\\n[Audio] Concatenating segments...")
    final = np.concatenate(segments)

    max_val = np.max(np.abs(final))
    if max_val > 0:
        final = final / max_val * 0.95

    final_int16 = (final * 32767).astype(np.int16)
    # 오디오 데이터를 16-bit PCM WAV 파일로 저장함
    wavfile.write(str(output_path), sample_rate, final_int16)

    duration = len(final) / sample_rate
    print(f"\\n[Done] {output_path}")
    print(f"[Done] Duration: {duration:.2f}s  |  Sample rate: {sample_rate} Hz")
    print("\\n" + "=" * 60)
    print("Generation Complete!")
    print("=" * 60)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()`,
    },
  ],

  glossary: {
    "환경변수(os.environ)": "운영체제가 프로그램에게 전달하는 설정값 모음. os.environ['이름']으로 읽거나 쓸 수 있음. API 키나 프로그램 경로처럼 '코드 밖에서 정하는 값'을 여기에 보관함.",
    "phonemizer": "텍스트를 발음 기호(음소)로 변환해 주는 라이브러리. VITS 모델이 텍스트를 읽으려면 먼저 발음 기호로 바꿔야 하는데 phonemizer가 이 역할을 함. espeak-ng 실행 파일이 설치되어 있어야 동작함.",
    "VCTK": "영국 에든버러 대학이 공개한 다화자 음성 데이터셋. 다양한 억양(영국·미국·스코틀랜드 등) 화자의 목소리가 포함됨. Kakao VITS 모델은 108명의 목소리를 학습함.",
    "VITS": "Variational Inference with adversarial learning for end-to-end Text-to-Speech의 줄임말. 텍스트를 한 번에 자연스러운 음성으로 변환하는 딥러닝 TTS 모델임. Kakao Enterprise가 공개한 vits-vctk는 108명의 다양한 목소리를 낼 수 있음.",
    "VitsModel": "HuggingFace Transformers 라이브러리가 제공하는 VITS 모델 클래스. from_pretrained()로 미리 학습된 가중치를 불러와 바로 음성을 생성할 수 있음.",
    "AutoTokenizer": "모델 이름을 주면 그에 맞는 토크나이저를 자동으로 찾아 불러오는 도구. 토크나이저는 텍스트를 모델이 이해하는 숫자 형태로 변환함.",
    "토크나이저(tokenizer)": "텍스트를 모델이 처리할 수 있는 숫자(토큰) 배열로 바꾸는 도구. 예: 'hello' → [15496]. 각 모델마다 다른 방식으로 텍스트를 나눔.",
    "waveform(파형)": "소리를 숫자로 표현한 배열. 1초에 샘플링 레이트(예: 22050) 개의 숫자가 있으며, 각 숫자가 그 순간의 공기 압력(소리 크기)을 나타냄. 숫자들을 재생하면 소리가 들림.",
    "numpy(배열)": "파이썬에서 숫자 배열을 빠르게 처리하는 라이브러리. 오디오 파형, 이미지, 행렬 등 대량의 숫자 데이터를 다룰 때 필수적으로 씀. np.zeros, np.concatenate 등 수학 연산을 간단히 할 수 있음.",
    "torch.no_grad()": "with torch.no_grad(): 블록 안에서는 PyTorch가 그라디언트(학습에 필요한 계산)를 추적하지 않음. 추론(실행)만 할 때는 이 계산이 불필요해 메모리와 속도가 절약됨.",
    "GPU·CPU": "GPU(그래픽처리장치)는 수천 개의 계산을 동시에 해 딥러닝 연산을 빠르게 처리함. CPU(중앙처리장치)는 순서대로 계산해 더 느리지만 GPU가 없어도 실행 가능함. torch.device로 어느 것을 쓸지 지정함.",
    "sample_rate(샘플링 레이트)": "1초에 몇 개의 숫자(샘플)로 소리를 표현하는지 나타내는 값. VITS 모델은 22050 Hz(1초에 22050개)를 씀. 값이 클수록 음질이 좋고 파일 크기도 커짐.",
    "PCM": "Pulse-Code Modulation의 줄임말. 오디오를 디지털 숫자로 저장하는 가장 기본적인 방식. WAV 파일은 보통 16-bit PCM 형식으로 저장되며, 각 샘플을 -32768~32767 범위의 정수로 표현함.",
    "pandas(DataFrame)": "파이썬에서 표(엑셀 같은) 형태의 데이터를 다루는 라이브러리. DataFrame은 행과 열로 이뤄진 데이터 구조임. read_csv, iterrows 등으로 CSV 파일을 쉽게 읽고 처리할 수 있음.",
    ".iterrows()": "DataFrame의 각 행을 (행번호, 행데이터) 쌍으로 하나씩 돌려주는 반복자. for _, row in df.iterrows()로 행 번호는 무시하고 행 데이터만 꺼낼 수 있음.",
    "tqdm": "반복 작업의 진행률을 예쁜 프로그레스 바로 출력해 주는 라이브러리. for item in tqdm(목록)처럼 목록을 tqdm으로 감싸면 진행률이 자동으로 표시됨.",
    "GoogleTranslator": "deep-translator 라이브러리가 제공하는 구글 번역 클라이언트. GoogleTranslator(source='auto', target='en').translate(텍스트)로 자동 감지→영어 번역을 할 수 있음.",
    "폴백(fallback)": "주요 방법이 실패했을 때 대신 쓰는 차선책. 예: 구글 번역이 실패하면 ASCII 문자만 추출해 쓰는 것. 폴백이 있으면 프로그램이 오류 없이 계속 진행할 수 있음.",
    "정규식(re.sub)": "문자열 패턴을 찾아 다른 값으로 바꾸는 도구. re.sub(r'\\s+', ' ', text)는 '공백이 1개 이상 연속된 부분을 공백 하나로 바꿔라'는 뜻임. r 앞에 붙이면 역슬래시를 그대로 씀.",
    ".isascii()": "문자열이 모두 ASCII 코드(영문·숫자·기본 특수문자) 범위에 있는지 확인하는 함수. True면 이미 영어·숫자만 있다는 뜻. 한글·중국어 등이 있으면 False를 반환함.",
    ".strip()": "문자열 앞뒤의 공백(스페이스·탭·줄바꿈)을 제거하는 함수. 사용자 입력이나 파일 데이터에 의도치 않은 공백이 붙어 있을 때 정리함.",
    "setdefault()": "딕셔너리에서 키가 없을 때만 기본값을 설정하고 그 값을 반환하는 함수. d.setdefault('k', [])는 'k가 없으면 빈 목록을 만들어 반환, 있으면 있는 값 반환'이라는 뜻임.",
    "sorted()": "목록을 정렬해 새 목록으로 돌려주는 함수. 문자열 목록은 알파벳 순, 숫자 목록은 오름차순으로 정렬됨.",
    "while 반복": "조건이 참인 동안 계속 반복하는 문법. while True:는 '무한 반복'이며, 안에서 return이나 break를 만나야 빠져나올 수 있음. 사용자가 올바른 입력을 할 때까지 다시 묻는 데 자주 씀.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "ImportError": "필요한 라이브러리가 설치되지 않아 import에 실패했을 때 발생하는 오류. try/except로 잡아 '설치가 필요하다'는 안내를 줄 수 있음.",
    "shutil.which": "'이 실행 파일이 PATH에 있는가?'를 찾아주는 함수. None이 반환되면 찾지 못한 것임. Unix의 which 명령과 같은 역할.",
    "sys.exit()": "프로그램을 즉시 종료하는 함수. 숫자 0은 정상 종료, 1 이상은 비정상(오류) 종료를 의미함. 운영체제에게 종료 코드를 전달함.",
    "mkdir": "폴더를 만드는 Path의 기능. parents=True는 중간 폴더까지 함께 만들고, exist_ok=True는 이미 있어도 오류를 내지 않음.",
    "타입 힌트": "변수·함수에 자료의 종류(str, int, Path, Dict 등)를 표시해 두는 문법. 실행에 꼭 필요하진 않지만 코드를 읽고 검사하기 쉽게 함.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"이름\": \"홍길동\"}처럼 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .parent를 붙이면 이 파일이 든 폴더 경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "float32": "32비트 소수 형식. 오디오 파형 처리에 주로 씀. numpy 배열에서 dtype=np.float32로 지정하면 모든 원소가 이 형식으로 저장됨.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함. 다른 파일이 import할 때는 실행되지 않음.",
  },
};
