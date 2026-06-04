/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../07.vlm/gemini/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "Gemini Vision 이미지 분석 (VLM) 예제 설명",
    entry: "vlm.py",
  },

  files: [
    { id: "main", label: "vlm.py", role: "단일 파일 CLI 예제 · 이미지를 Gemini Vision API로 분석하여 한국어 설명 출력" },
  ],

  flow: [
    {
      step: 1,
      title: "실행 시작",
      label: "실행 시작",
      refs: ["main"],
      summary: "python vlm.py 실행 → main()이 진입점으로 호출됨",
      detail: "터미널(명령줄)에서 파일을 실행하면 맨 아래 if __name__ == \"__main__\": 가 main()을 호출함. main()이 전체 작업을 순서대로 지휘하는 '지휘자' 역할임.",
    },
    {
      step: 2,
      title: "명령줄 옵션 읽기",
      label: "명령줄 옵션 읽기",
      refs: ["parse_args"],
      summary: "parse_args()로 --input(이미지 경로)·--prompt·--model·--max-tokens 옵션을 읽음",
      detail: "식당 주문서를 받는 단계와 비슷함. argparse가 'python vlm.py --input photo.jpg' 같은 입력을 해석해, 어떤 파일을 분석할지·어떤 질문을 할지·어떤 모델을 쓸지를 정함. 옵션을 생략하면 기본값(DEFAULT_MODEL 등)을 씀.",
    },
    {
      step: 3,
      title: "API 키 로드",
      label: "API 키 로드",
      refs: ["load_api_key"],
      summary: "load_api_key()가 hands-on/.env에서 GEMINI_API_KEY를 읽어 반환함",
      detail: "Google Gemini 서버에 접속하려면 비밀 열쇠(API 키)가 필요함. 키는 코드에 직접 쓰지 않고 .env 파일에 보관하고, load_dotenv로 읽어옴. 키가 없으면 즉시 오류를 내어 원인을 알려줌.",
    },
    {
      step: 4,
      title: "이미지 경로 확정",
      label: "이미지 경로 확정",
      refs: ["get_image_path"],
      summary: "get_image_path()가 CLI 인수 또는 대화형 입력으로 이미지 파일 경로를 확정하고 유효성 검증",
      detail: "--input 으로 파일을 직접 줬으면 그걸 쓰고, 없으면 사용자에게 경로를 입력받음. 파일이 실제로 있는지, 지원하는 이미지 형식(.jpg·.png 등)인지 확인함.",
    },
    {
      step: 5,
      title: "Gemini 클라이언트 초기화",
      label: "클라이언트 초기화",
      summary: "genai.Client(api_key=...)로 Gemini API와 통신할 클라이언트 객체를 만듦",
      detail: "Google Gemini 서버와 통신할 '전화기'를 준비하는 단계임. API 키를 넘겨 클라이언트를 만들면, 이후 이 객체를 통해 이미지 분석 요청을 보낼 수 있음.",
    },
    {
      step: 6,
      title: "이미지 분석",
      label: "이미지 분석",
      refs: ["analyze_image"],
      summary: "analyze_image()가 이미지를 Gemini Vision API에 전송하고 분석 결과 텍스트를 받음",
      detail: "이미지를 실제로 AI가 보고 설명하는 핵심 단계임. 20MB 미만 파일은 바이너리(인라인 데이터)로 직접 전송하고, 이상이면 File API로 먼저 업로드한 뒤 참조함. generate_content()가 이미지와 질문(프롬프트)을 묶어 Gemini에 전달함.",
    },
    {
      step: 7,
      title: "결과 출력",
      label: "결과 출력",
      summary: "분석 결과를 화면에 출력하고 프로그램 종료",
      detail: "AI가 작성한 이미지 설명 텍스트를 화면에 보기 좋게 구분선과 함께 출력하고 끝남. 중간에 오류가 나면 sys.exit(1)로 실패를 알림.",
    },
  ],

  functions: [
    {
      id: "load_api_key",
      name: "load_api_key()",
      fileId: "main",
      summary: "hands-on/.env에서 GEMINI_API_KEY를 읽어 반환. 키가 없으면 즉시 오류를 냄.",
      how: "API 키는 코드에 직접 쓰면 노출되어 위험함. .env 파일에 보관하고 load_dotenv로 읽어 환경변수로 올림. 이 파일 위치(Path(__file__))를 기준으로 .env 경로를 자동 계산하므로, 어느 폴더에서 실행해도 올바른 경로를 찾음. 키가 비어있으면 EnvironmentError로 멈춰 원인을 분명히 알려줌.",
      terms: ["Path(__file__)", "load_dotenv", "환경변수(.env)", "API 키", "EnvironmentError"],
      lines: [
        { at: "env_path = Path(__file__).parent.parent.parent / \".env\"", text: "Path(__file__)은 '이 파일(vlm.py)의 위치'. 부모 폴더를 3번 타고 올라가 hands-on/.env 경로를 자동으로 만듦. 어디서 실행해도 경로가 어긋나지 않음." },
        { at: "load_dotenv(dotenv_path=env_path)", text: "load_dotenv가 .env 파일을 읽어 GEMINI_API_KEY 등을 프로그램의 환경변수로 등록함." },
        { at: "api_key = os.getenv(\"GEMINI_API_KEY\")", text: "환경변수에서 GEMINI_API_KEY 값을 꺼냄. 파일에 없으면 None을 받음." },
        { at: "if not api_key:", text: "키가 비어있으면 즉시 EnvironmentError로 멈춰, '어떤 파일을 확인하라'는 친절한 안내를 줌." },
      ],
      code:
`def load_api_key() -> str:
    """hands-on/.env에서 GEMINI_API_KEY를 읽어 반환. 키 미설정 시 오류 발생."""
    # 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
    env_path = Path(__file__).parent.parent.parent / ".env"
    # .env 파일에서 API 키 등 환경변수를 로드함
    load_dotenv(dotenv_path=env_path)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError(
            f"GEMINI_API_KEY가 설정되지 않음. {env_path} 파일을 확인하세요."
        )
    return api_key`,
    },
    {
      id: "parse_args",
      name: "parse_args()",
      fileId: "main",
      summary: "CLI 인자(--input·--prompt·--model·--max-tokens)를 정의하고 해석하여 반환.",
      how: "argparse는 'python vlm.py --input photo.jpg' 같은 명령줄 입력을 처리하는 파이썬 표준 도구임. 각 옵션의 타입·기본값·도움말을 정의한 뒤 parse_args()로 실제 입력을 해석함. 생략된 옵션은 기본값(DEFAULT_MODEL, DEFAULT_PROMPT 등)을 씀.",
      terms: ["argparse", "타입 힌트"],
      lines: [
        { at: "parser = argparse.ArgumentParser(description=\"Gemini Vision 이미지 분석\")", text: "argparse 파서를 만듦. 명령줄 옵션을 정의·해석하는 파이썬 표준 도구임." },
        { at: "\"--input\", \"-i\"", text: "--input(-i) 옵션: 분석할 이미지 파일 경로. 생략하면 나중에 대화형으로 입력받음." },
        { at: "\"--prompt\", \"-p\"", text: "--prompt(-p) 옵션: 이미지에 대해 AI에게 물어볼 질문. 생략하면 DEFAULT_PROMPT(기본 설명 요청)를 씀." },
        { at: "\"--max-tokens\"", text: "--max-tokens 옵션: AI가 생성할 글자 수의 최대 한도(기본 8192). 너무 길면 비용이 늘어나므로 상한을 정함." },
        { at: "return parser.parse_args()", text: "실제 명령줄을 해석해, 옵션 값들을 담은 객체(Namespace)를 돌려줌." },
      ],
      code:
`def parse_args() -> argparse.Namespace:
    """CLI 인자 파싱 후 Namespace 반환."""
    parser = argparse.ArgumentParser(description="Gemini Vision 이미지 분석")
    parser.add_argument("--input", "-i", type=str, help="분석할 이미지 파일 경로")
    parser.add_argument(
        "--prompt", "-p", type=str, default=DEFAULT_PROMPT, help="이미지 분석 프롬프트"
    )
    parser.add_argument(
        "--model",
        type=str,
        default=DEFAULT_MODEL,
        help=f"사용할 Gemini 모델 (기본값: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--max-tokens", type=int, default=8192, help="최대 생성 토큰 수 (기본값: 8192)"
    )
    return parser.parse_args()`,
    },
    {
      id: "get_image_path",
      name: "get_image_path(input_arg)",
      fileId: "main",
      summary: "CLI 인수 또는 대화형 입력으로 이미지 파일 경로를 획득하고 유효성 검증 후 반환.",
      how: "--input 으로 경로를 줬으면 그 파일이 실제로 있는지·지원 형식인지 확인하고 사용함. 인수가 없으면 사용자에게 경로를 직접 입력받음. 따옴표를 strip()으로 제거해 경로 오류를 방지함. 파일 존재 여부·파일인지·지원 확장자인지를 순서대로 검증함.",
      terms: ["Path(__file__)", "Optional", "ValueError", "FileNotFoundError", "타입 힌트"],
      lines: [
        { at: "if input_arg:", text: "--input 으로 경로를 줬으면(인수가 있으면) 그 경로를 Path 객체로 만들어 사용함." },
        { at: "raw = input(\"경로> \").strip().strip('\"').strip(\"'\")", text: "대화형 입력: 사용자가 입력한 경로의 앞뒤 공백과 따옴표를 제거함. 파일 탐색기에서 복사하면 따옴표가 붙을 수 있어 안전하게 처리함." },
        { at: "if not path.exists():", text: "Path.exists()로 파일이 실제로 있는지 확인. 없으면 FileNotFoundError로 알려줌." },
        { at: "if not path.is_file():", text: "파일이 아니라 폴더를 입력했을 경우를 걸러내는 검증." },
        { at: "if path.suffix.lower() not in SUPPORTED_EXTENSIONS:", text: "확장자(.jpg·.png 등)가 Gemini Vision이 지원하는 목록에 없으면 ValueError로 알려줌." },
      ],
      code:
`def get_image_path(input_arg: Optional[str]) -> Path:
    """CLI 인자 또는 대화형 입력으로 이미지 파일 경로를 획득하고 유효성 검증 후 반환."""
    if input_arg:
        path = Path(input_arg)
    else:
        print("\\n이미지 파일 경로를 입력하세요.")
        print(f"지원 형식: {', '.join(sorted(SUPPORTED_EXTENSIONS))}")
        raw = input("경로> ").strip().strip('"').strip("'")
        path = Path(raw)

    if not path.exists():
        raise FileNotFoundError(f"파일을 찾을 수 없음: {path}")
    if not path.is_file():
        raise ValueError(f"파일이 아님: {path}")
    if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"지원하지 않는 형식: {path.suffix}  (지원: {', '.join(sorted(SUPPORTED_EXTENSIONS))})"
        )
    return path`,
    },
    {
      id: "analyze_image",
      name: "analyze_image(client, image_path, prompt, model, max_tokens)",
      fileId: "main",
      summary: "Gemini Vision API로 이미지를 분석하여 모델 응답 텍스트 반환. 20MB 미만은 인라인, 이상은 File API 사용.",
      how: "이미지를 AI에게 보내는 핵심 함수임. 파일 크기에 따라 두 가지 전송 방식을 씀. 작은 파일(20MB 미만)은 이미지 바이트를 Part.from_bytes()로 직접 전송(인라인 방식). 큰 파일은 File API로 먼저 업로드한 뒤 참조함(대용량 방식). generate_content()가 이미지와 프롬프트를 묶어 Gemini에 보내고 응답을 받음.",
      terms: ["genai.Client", "GenerateContentConfig", "Part.from_bytes", "MIME 타입", "File API", "generate_content", "with open(rb)"],
      lines: [
        { at: "mime_type = MIME_MAP[image_path.suffix.lower()]", text: "확장자(.jpg 등)로 MIME 타입(\"image/jpeg\" 등)을 찾음. MIME 타입은 파일 종류를 서버에 알려주는 표준 표기임." },
        { at: "size_mb = file_size / (1024 * 1024)", text: "파일 크기를 바이트에서 MB(메가바이트)로 변환함. 1024×1024(=1MB)로 나눔." },
        { at: "config = types.GenerateContentConfig(max_output_tokens=max_tokens)", text: "AI가 생성할 최대 글자 수(토큰)를 설정함. 너무 많으면 비용이 늘어나므로 상한을 지정함." },
        { at: "if size_mb < 20:", text: "20MB 기준으로 전송 방식을 선택함. 작으면 바이트로 직접 전송, 크면 File API로 업로드 후 참조." },
        { at: "image_bytes = f.read()", text: "이미지 파일을 바이너리(rb)로 읽어 메모리에 올림. with 블록이므로 끝나면 파일이 자동으로 닫힘." },
        { at: "image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)", text: "이미지 바이트와 MIME 타입을 묶어 Gemini가 알아볼 수 있는 Part 객체로 만듦(인라인 전송 방식)." },
        { at: "contents=[image_part, prompt],", text: "★핵심★ generate_content()가 이미지(image_part)와 질문(prompt)을 묶어 Gemini에 보내고 분석 결과를 받음. 인라인(20MB 미만) 전송 방식." },
        { at: "uploaded = client.files.upload(file=str(image_path))", text: "20MB 이상 대용량 파일은 File API로 먼저 Google 서버에 업로드한 뒤, 업로드된 파일을 contents에 넣어 참조함." },
        { at: "return response.text.strip()", text: "응답에서 텍스트만 꺼내 앞뒤 공백을 제거(strip)해 돌려줌." },
      ],
      code:
`def analyze_image(
    client: genai.Client,
    image_path: Path,
    prompt: str,
    model: str,
    max_tokens: int,
) -> str:
    """Gemini Vision API로 이미지를 분석하여 모델 응답 텍스트 반환.

    20MB 미만 파일은 인라인 데이터로 전송, 이상은 File API 업로드 사용.
    """
    mime_type = MIME_MAP[image_path.suffix.lower()]
    file_size = image_path.stat().st_size
    size_mb = file_size / (1024 * 1024)

    config = types.GenerateContentConfig(max_output_tokens=max_tokens)

    if size_mb < 20:
        # 인라인 데이터 방식 (20MB 미만)
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        response = client.models.generate_content(
            model=model,
            contents=[image_part, prompt],
            config=config,
        )
    else:
        # File API 방식 (20MB 이상)
        print(f"   - 대용량 파일 ({size_mb:.1f}MB) → File API 업로드 중...")
        uploaded = client.files.upload(file=str(image_path))
        response = client.models.generate_content(
            model=model,
            contents=[uploaded, prompt],
            config=config,
        )

    return response.text.strip()`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "전체 작업을 순서대로 실행하는 시작점. API키 로드→이미지 경로 확정→클라이언트 초기화→이미지 분석→결과 출력.",
      how: "프로그램의 '지휘자'임. 각 단계를 try/except로 감싸 오류가 나면 멈추지 않고 오류 메시지를 보여줌. 실행 상황을 1~2번처럼 번호를 붙여 출력해 진행 상태를 사용자에게 알려줌. 모든 단계가 끝나면 분석 결과를 출력하고 종료함.",
      terms: ["예외 처리(try/except)", "if __name__", "argparse"],
      lines: [
        { at: "args = parse_args()", text: "먼저 명령줄 옵션(--input·--prompt 등)을 읽음." },
        { at: "api_key = load_api_key()", text: ".env에서 GEMINI_API_KEY를 읽음. 없으면 여기서 오류 메시지를 찍고 sys.exit(1)로 종료." },
        { at: "image_path = get_image_path(args.input)", text: "이미지 경로를 확정하고 유효성을 검증함. 오류면 메시지 출력 후 종료." },
        { at: "client = genai.Client(api_key=api_key)", text: "API 키로 Gemini 클라이언트를 만듦. 초기화 실패 시 오류 처리." },
        { at: "result = analyze_image(client, image_path, args.prompt, args.model, args.max_tokens)", text: "★핵심★ Gemini Vision API로 이미지를 분석함. 오류 발생 시 메시지 출력 후 종료." },
        { at: "if __name__ == \"__main__\":", text: "이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)." },
      ],
      code:
`def main() -> None:
    """메인 실행 함수."""
    args = parse_args()

    print("=" * 60)
    print("Gemini Vision 이미지 분석 예제")
    print("=" * 60)

    # 1. API 키 로드
    try:
        api_key = load_api_key()
    except EnvironmentError as e:
        print(f"\\n[오류] {e}")
        sys.exit(1)

    # 2. 이미지 경로 획득
    try:
        image_path = get_image_path(args.input)
    except (FileNotFoundError, ValueError) as e:
        print(f"\\n[오류] {e}")
        sys.exit(1)

    print(f"\\n이미지: {image_path}")
    print(f"프롬프트: {args.prompt}")
    print(f"모델: {args.model}")
    print("=" * 60)

    # 3. Gemini 클라이언트 초기화
    print("\\n1. Gemini API 클라이언트 초기화 중...")
    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        print(f"\\n[오류] 클라이언트 초기화 실패: {e}")
        sys.exit(1)
    print("   - 초기화 완료!")

    # 4. 이미지 분석
    print("\\n2. 이미지 분석 중...")
    try:
        result = analyze_image(client, image_path, args.prompt, args.model, args.max_tokens)
    except Exception as e:
        print(f"\\n[오류] 이미지 분석 실패: {e}")
        sys.exit(1)

    # 5. 결과 출력
    print("\\n" + "=" * 60)
    print("분석 결과")
    print("=" * 60)
    print(result)
    print("=" * 60)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()`,
    },
  ],

  glossary: {
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .parent를 붙이면 이 파일이 든 폴더, .parent.parent.parent는 3단계 위 폴더를 가리킴. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(Google Gemini 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "EnvironmentError": "환경 설정에 문제가 생겼을 때 나는 오류. 여기서는 API 키가 없을 때 일부러 발생시켜 원인을 알려줌.",
    "argparse": "'python 파일.py --옵션 값' 형태의 명령줄 입력을 정의하고 해석해 주는 파이썬 표준 도구.",
    "타입 힌트": "변수·함수에 자료의 종류(str, Path, Optional 등)를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "Optional": "값이 있을 수도, None(없음)일 수도 있는 인자를 표현하는 타입 힌트. Optional[str]은 '문자열이거나 None'이라는 뜻.",
    "ValueError": "값이 잘못됐을 때 나는 오류. 여기서는 지원하지 않는 이미지 형식이거나 경로가 파일이 아닐 때 발생시킴.",
    "FileNotFoundError": "찾는 파일이 없을 때 나는 오류. 여기서는 지정한 이미지 파일이 존재하지 않을 때 발생시킴.",
    "genai.Client": "Google Gen AI SDK의 핵심 객체. API 키를 받아 Gemini 모델 호출·파일 업로드 등 모든 API 기능을 제공하는 '통신 창구'임.",
    "GenerateContentConfig": "Gemini generate_content() 호출 시 동작을 제어하는 설정 객체. max_output_tokens(최대 생성 글자 수) 등을 지정할 수 있음.",
    "Part.from_bytes": "이미지 바이트 데이터와 MIME 타입을 묶어 Gemini API가 이해하는 콘텐츠 조각(Part)으로 만드는 메서드. 20MB 미만 이미지를 직접 전송할 때 씀.",
    "MIME 타입": "파일 종류를 나타내는 표준 이름(예: 'image/jpeg', 'image/png'). 서버에 '이 파일이 어떤 종류인지'를 알려주는 표시임.",
    "File API": "Google이 제공하는 파일 업로드 서비스. 20MB 이상 대용량 이미지를 Gemini에서 분석할 때, 먼저 파일을 서버에 올리고 참조 방식으로 전송함.",
    "generate_content": "Gemini 모델에게 이미지·텍스트(프롬프트)를 보내고 분석 결과를 받는 핵심 API 메서드. contents에 이미지와 질문을 함께 담아 보냄.",
    "with open(rb)": "with 블록으로 파일을 열면, 블록을 벗어날 때 파일이 자동으로 닫힘. 'rb'는 바이너리(글자가 아닌 원본 바이트)로 읽는다는 뜻으로, 이미지 같은 파일에 씀.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
  },
};
