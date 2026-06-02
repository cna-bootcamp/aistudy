/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../03.summary/groq/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "Groq LPU 텍스트 요약 예제 설명",
    entry: "summary.py",
  },

  files: [
    { id: "main", label: "summary.py", role: "단일 파일 CLI 예제 · 마크다운 문서를 청크 분할 후 Groq API로 요약" },
  ],

  flow: [
    { step: 1, title: "실행 시작",
      summary: "python summary.py 실행 → main()이 진입점으로 호출됨",
      detail: "이 예제는 웹이 아니라 '명령줄 프로그램'임. 터미널에서 실행하면 맨 아래 if __name__ == '__main__': 가 main()을 호출함. main()이 전체 작업을 순서대로 지휘함." },
    { step: 2, title: "명령줄 옵션 읽기",
      summary: "parse_args()로 --input·--output·--model 등 옵션을 읽음",
      detail: "식당 주문서를 받는 단계와 비슷함. argparse가 'python summary.py --input 파일.md' 같은 입력을 해석해, 어떤 파일을 요약하고 어디에 저장할지, 어떤 모델을 쓸지 정함. 옵션을 생략하면 기본값을 씀." },
    { step: 3, title: "환경 변수 로드",
      summary: "load_environment()가 .env 파일을 찾아 GROQ_API_KEY 등 환경 변수를 올림",
      detail: "API 키처럼 코드에 직접 쓰면 안 되는 비밀값은 .env 파일에 따로 보관함. 이 함수는 현재 디렉터리에서 시작해 상위 폴더를 거슬러 올라가며 .env 파일을 찾아 읽음." },
    { step: 4, title: "입력 파일 읽기",
      summary: "read_text_file()이 마크다운 파일을 읽고, clean_markdown()으로 불필요한 기호를 정리함",
      detail: "요약할 문서(마크다운)를 읽는 단계임. 한글 문서는 인코딩이 제각각일 수 있어, utf-8부터 cp949까지 여러 인코딩을 차례로 시도함. 이미지 태그, 표 구분선, 불필요한 마크다운 기호는 깔끔히 지워 요약 품질을 높임." },
    { step: 5, title: "Groq 클라이언트 생성",
      summary: "create_groq_client()가 GROQ_API_KEY로 Groq 서버와 통신할 객체를 만듦",
      detail: "Groq 서버와 통신할 '전화기'를 준비하는 단계임. API 키가 없으면 즉시 RuntimeError로 알려줌. Groq는 LPU(언어처리장치)라는 특수 반도체를 사용해 매우 빠른 속도로 AI 추론을 처리함." },
    { step: 6, title: "청크 분할 및 요약",
      summary: "summarize_text()가 긴 문서를 청크로 나눈 뒤 각 청크를 Groq API로 요약함",
      detail: "LLM(거대 언어 모델)은 한 번에 처리할 수 있는 글자 수(컨텍스트 윈도우)에 한계가 있음. 문서가 짧으면 한 번에 요약하고, 길면 여러 조각(청크)으로 나눠 각각 요약한 뒤 마지막에 하나로 통합함." },
    { step: 7, title: "최종 통합 요약",
      summary: "청크가 여러 개면 build_final_prompt()로 부분 요약들을 하나로 통합 요약 요청함",
      detail: "각 청크 요약을 다시 AI에게 주고 '이것들을 하나로 합쳐 달라'고 요청하는 단계임. 결과는 회사 개요·핵심 가치·주요 실적·운영 인원·교육 프로그램 5개 섹션 구조로 정리됨." },
    { step: 8, title: "결과 저장 및 출력",
      summary: "write_text_file()로 summary.txt에 저장하고, 사용량(토큰·시간)을 출력함",
      detail: "완성된 요약을 파일로 남기는 단계임. 저장 폴더가 없으면 만들고 UTF-8로 씀. 마지막으로 API를 몇 번 호출했는지, 총 토큰이 얼마나 쓰였는지, 초당 출력 속도는 얼마인지를 콘솔에 출력함." },
  ],

  functions: [
    // ===== summary.py (메인) =====
    {
      id: "groq_options_dataclass",
      name: "GroqOptions (데이터클래스)",
      fileId: "main",
      summary: "Groq API를 호출할 때 필요한 옵션(모델·온도·최대 토큰 등)을 한 묶음으로 담는 데이터 용기.",
      how: "@dataclass(frozen=True)는 '값을 바꿀 수 없는 구조체'를 쉽게 만들어 주는 파이썬 문법임. 여러 인자를 함수마다 따로 넘기지 않고 이 객체 하나로 묶어 전달하면 코드가 깔끔해짐. frozen=True라서 생성 후 값을 바꾸려 하면 오류가 남.",
      terms: ["@dataclass", "frozen=True", "타입 힌트"],
      lines: [
        { at: "class GroqOptions:", text: "@dataclass(frozen=True)는 '이 클래스를 불변 데이터 용기로 만들어 줘'라는 표식임. __init__ 같은 메서드를 자동으로 생성해 줌." },
        { at: "model: str", text: "모델 ID를 담는 항목. 기본값은 'openai/gpt-oss-120b'." },
        { at: "reasoning_effort: str", text: "reasoning_effort: AI가 추론에 얼마나 공을 들일지 ('low'·'medium'·'high'). Groq 특유의 옵션임." },
      ],
      code:
`@dataclass(frozen=True)
class GroqOptions:
    """Groq Chat Completions API 호출에 필요한 옵션 묶음."""

    model: str
    temperature: float
    top_p: float
    max_completion_tokens: int
    reasoning_effort: str
    reasoning_format: str`,
    },
    {
      id: "completion_result_dataclass",
      name: "CompletionResult (데이터클래스)",
      fileId: "main",
      summary: "API 호출 1회의 결과(요약 텍스트, 소요 시간, 토큰 수)를 한 묶음으로 담는 데이터 용기.",
      how: "API를 여러 번 호출할 때 각 결과를 일관된 구조로 담아두면, 나중에 전체 사용량을 집계하기 쉬워짐. frozen=True라서 값을 바꿀 수 없어 안전함.",
      terms: ["@dataclass", "frozen=True", "타입 힌트"],
      lines: [
        { at: "class CompletionResult:", text: "API 호출 결과 하나를 담는 불변 데이터 용기 클래스임." },
        { at: "elapsed_seconds: float", text: "API 호출에 걸린 시간(초). 나중에 속도 계산에 사용함." },
        { at: "prompt_tokens: int", text: "입력으로 보낸 토큰 수. completion_tokens는 AI가 생성한 토큰 수." },
      ],
      code:
`@dataclass(frozen=True)
class CompletionResult:
    """API 호출 1회의 요약 텍스트와 토큰 사용량 정보."""

    text: str
    elapsed_seconds: float
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int`,
    },
    {
      id: "read_text_file",
      name: "read_text_file(path)",
      fileId: "main",
      summary: "한글 문서가 어떤 인코딩으로 저장되었든 읽을 수 있도록, 여러 인코딩을 차례로 시도해 파일을 읽음.",
      how: "한국어 문서는 utf-8, utf-8-sig(BOM 포함), cp949, euc-kr 등 다양한 방식으로 저장될 수 있음. 인코딩이 맞지 않으면 UnicodeDecodeError가 남. 이 함수는 성공할 때까지 다음 인코딩을 시도하는 방식으로 안전하게 파일을 읽음.",
      terms: ["인코딩(encoding)", "UnicodeDecodeError", "예외 처리(try/except)", "타입 힌트"],
      lines: [
        { at: 'encodings = ("utf-8", "utf-8-sig", "cp949", "euc-kr")', text: "시도할 인코딩 목록을 순서대로 정해둠. utf-8을 먼저 시도하고, 실패하면 다음 것을 씀." },
        { at: "content = path.read_text(encoding=encoding)", text: "Path.read_text()로 파일 전체를 한 번에 문자열로 읽음. 인코딩이 맞지 않으면 UnicodeDecodeError가 남." },
        { at: "except UnicodeDecodeError:", text: "인코딩 불일치로 실패하면 오류를 무시하고 continue로 다음 인코딩을 시도함." },
        { at: 'return path.read_text(encoding="utf-8", errors="ignore")', text: "모든 인코딩이 실패하면 utf-8로 읽되 깨지는 글자는 무시(skip)함. 최후의 안전망." },
      ],
      code:
`def read_text_file(path: Path) -> str:
    """한글 문서 호환을 위해 여러 인코딩으로 입력 파일을 읽음."""
    encodings = ("utf-8", "utf-8-sig", "cp949", "euc-kr")

    for encoding in encodings:
        try:
            content = path.read_text(encoding=encoding)
            print(f"   - 인코딩: {encoding}")
            return content
        except UnicodeDecodeError:
            continue

    print("   - 인코딩: utf-8(errors='ignore')")
    return path.read_text(encoding="utf-8", errors="ignore")`,
    },
    {
      id: "write_text_file",
      name: "write_text_file(path, content)",
      fileId: "main",
      summary: "요약 결과 문자열을 UTF-8 텍스트 파일로 저장함. 저장 폴더가 없으면 먼저 만듦.",
      how: "파일을 저장하기 전에 path.parent.mkdir(parents=True, exist_ok=True)로 필요한 폴더를 만들어 둠. content.strip()으로 앞뒤 빈 줄을 제거하고 os.linesep으로 줄 끝을 운영체제에 맞게 정리함.",
      terms: ["mkdir", "write_text", "f-string", "타입 힌트"],
      lines: [
        { at: "path.parent.mkdir(parents=True, exist_ok=True)", text: "저장할 폴더가 없으면 만들어 둠(exist_ok=True: 이미 있어도 오류 없음)." },
        { at: "path.write_text(content.strip() + os.linesep", text: "내용을 UTF-8로 파일에 씀. os.linesep은 줄 끝 문자를 OS에 맞게(Windows: \\r\\n, 나머지: \\n) 처리함." },
      ],
      code:
`def write_text_file(path: Path, content: str) -> None:
    """요약 결과를 UTF-8 텍스트 파일로 저장함."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + os.linesep, encoding="utf-8")`,
    },
    {
      id: "clean_markdown",
      name: "clean_markdown(text)",
      fileId: "main",
      summary: "이미지 태그, 표 구분선, 제목 기호(#) 등 마크다운 특수 기호를 제거해 AI 요약 품질을 높임.",
      how: "마크다운 파일에는 AI 요약에 방해가 되는 기호들(이미지 링크, | 표 구분선, ## 제목 기호 등)이 가득함. 정규식(re.sub)으로 이런 것들을 걸러내어 AI가 순수한 텍스트 내용에만 집중할 수 있게 함.",
      terms: ["정규식(re)", "re.sub", "re.fullmatch", "리스트(list)", "f-string"],
      lines: [
        { at: 'text = re.sub(r"!\\[', text: "정규식으로 마크다운 이미지 태그 ![설명](링크) 패턴을 모두 찾아 지움." },
        { at: 'if re.fullmatch(r"\\|?[\\s:\\-|]+\\|?"', text: "표의 구분선(|---|---|)만 있는 줄은 요약에 필요 없어 건너뜀." },
        { at: 'stripped = re.sub(r"^#{1,6}\\s*"', text: "줄 앞의 ## 같은 제목 기호를 제거해 일반 텍스트로 만듦." },
        { at: 'text = re.sub(r"\\n{3,}"', text: "3개 이상 연속 빈 줄을 2개로 줄여 깔끔하게 정리함." },
      ],
      code:
`def clean_markdown(text: str) -> str:
    """요약 품질을 높이기 위해 이미지와 마크다운 표기를 간단히 정리함."""
    text = re.sub(r"!\\[[^\\]]*\\]\\([^)]+\\)", "", text)

    cleaned_lines: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()

        if not stripped:
            cleaned_lines.append("")
            continue

        if re.fullmatch(r"\\|?[\\s:\\-|]+\\|?", stripped):
            continue

        if stripped.startswith("|") and stripped.endswith("|"):
            cells = [cell.strip() for cell in stripped.strip("|").split("|")]
            stripped = " / ".join(cell for cell in cells if cell)

        stripped = re.sub(r"^#{1,6}\\s*", "", stripped)
        stripped = re.sub(r"^\\s*[-*]\\s+", "- ", stripped)
        stripped = re.sub(r"[ \\t]+", " ", stripped)
        cleaned_lines.append(stripped)

    text = "\\n".join(cleaned_lines)
    text = re.sub(r"\\n{3,}", "\\n\\n", text)
    return text.strip()`,
    },
    {
      id: "split_long_paragraph",
      name: "split_long_paragraph(paragraph, max_chars)",
      fileId: "main",
      summary: "하나의 긴 단락을 문장 경계를 기준으로 max_chars 이하 크기의 조각들로 나눔.",
      how: "단락이 너무 길면 API 호출 한도를 초과함. 문장 끝 부호(. ! ? 。 ！ ？) 기준으로 먼저 문장을 분리한 뒤, 문장들을 순서대로 묶어 max_chars를 넘지 않는 청크를 만듦. 단일 문장이 max_chars를 초과하면 글자 수 기준으로 강제 분할함.",
      terms: ["정규식(re)", "리스트(list)", "제너레이터 표현식", "타입 힌트"],
      lines: [
        { at: 'sentences = re.split(r"(?<=[.!?。！？])\\s+"', text: "(?<=...) 는 '이 패턴 뒤'를 의미하는 정규식. 문장 끝 부호 뒤에 오는 공백을 기준으로 문장을 분리함." },
        { at: "if len(sentence) > max_chars:", text: "단일 문장이 max_chars보다 길면 글자 수로 강제 분할함." },
        { at: "candidate = f\"{current} {sentence}\".strip()", text: "현재 묶음에 다음 문장을 추가했을 때 길이를 미리 계산해 봄(candidate)." },
        { at: "return [chunk for chunk in chunks if chunk]", text: "빈 문자열이 섞이지 않도록 실제 내용이 있는 청크만 골라 반환함(리스트 컴프리헨션)." },
      ],
      code:
`def split_long_paragraph(paragraph: str, max_chars: int) -> list[str]:
    """문장 경계를 기준으로 긴 단락을 max_chars 이하 청크 목록으로 분할함."""
    sentences = re.split(r"(?<=[.!?。！？])\\s+", paragraph)
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        if len(sentence) > max_chars:
            if current:
                chunks.append(current.strip())
                current = ""
            chunks.extend(
                sentence[start : start + max_chars].strip()
                for start in range(0, len(sentence), max_chars)
            )
            continue

        candidate = f"{current} {sentence}".strip()
        if len(candidate) <= max_chars:
            current = candidate
            continue

        if current:
            chunks.append(current.strip())
        current = sentence

    if current:
        chunks.append(current.strip())

    return [chunk for chunk in chunks if chunk]`,
    },
    {
      id: "split_text",
      name: "split_text(text, max_chars)",
      fileId: "main",
      summary: "긴 문서 전체를 단락 경계를 기준으로 Groq API 호출에 적합한 크기의 청크 목록으로 분할함.",
      how: "문서를 빈 줄 기준으로 단락으로 나눈 뒤, 단락들을 max_chars를 넘지 않게 묶어 청크를 만듦. 단락 하나가 max_chars보다 길면 split_long_paragraph로 한 번 더 분할함. 내부 함수 flush_current()가 현재까지 모은 단락들을 청크로 확정하는 역할을 함.",
      terms: ["정규식(re)", "리스트(list)", "중첩 함수", "nonlocal", "ValueError"],
      lines: [
        { at: 'raise ValueError("--max-chunk-chars 값은 1 이상이어야 합니다.")', text: "max_chars가 0 이하이면 즉시 오류를 냄. 잘못된 값으로 실행되는 것을 막는 안전장치." },
        { at: "if len(text) <= max_chars:", text: "문서가 max_chars 이하로 짧으면 분할 없이 그대로 목록 하나로 반환함." },
        { at: 'paragraphs = [part.strip() for part in re.split(r"\\n\\s*\\n"', text: "빈 줄을 기준으로 단락을 분리함. 앞뒤 공백이 있는 것도 .strip()으로 정리함(리스트 컴프리헨션)." },
        { at: "def flush_current() -> None:", text: "중첩 함수(안에 정의된 함수). 지금까지 모은 단락들을 청크로 확정하고 current_parts를 비움." },
        { at: "nonlocal current_length", text: "nonlocal은 바깥 함수의 변수를 안쪽 함수에서 수정할 수 있게 해주는 키워드임." },
      ],
      code:
`def split_text(text: str, max_chars: int) -> list[str]:
    """긴 문서를 Groq API 호출에 적합한 청크 목록으로 분할함."""
    if max_chars <= 0:
        raise ValueError("--max-chunk-chars 값은 1 이상이어야 합니다.")

    if len(text) <= max_chars:
        return [text]

    paragraphs = [part.strip() for part in re.split(r"\\n\\s*\\n", text) if part.strip()]
    chunks: list[str] = []
    current_parts: list[str] = []
    current_length = 0

    def flush_current() -> None:
        nonlocal current_length
        if current_parts:
            chunks.append("\\n\\n".join(current_parts).strip())
            current_parts.clear()
            current_length = 0

    for paragraph in paragraphs:
        paragraph_length = len(paragraph)

        if paragraph_length > max_chars:
            flush_current()
            chunks.extend(split_long_paragraph(paragraph, max_chars))
            continue

        separator_length = 2 if current_parts else 0
        candidate_length = current_length + separator_length + paragraph_length
        if candidate_length <= max_chars:
            current_parts.append(paragraph)
            current_length = candidate_length
            continue

        flush_current()
        current_parts.append(paragraph)
        current_length = paragraph_length

    flush_current()
    return chunks`,
    },
    {
      id: "iter_env_candidates",
      name: "iter_env_candidates(start_dir)",
      fileId: "main",
      summary: "현재 예제 폴더에서 시작해 상위 폴더를 거슬러 올라가며 .env 파일이 있을 법한 후보 경로를 순서대로 만들어 냄.",
      how: "API 키는 프로젝트 최상단의 .env 파일에 보관되는 경우가 많음. 이 함수는 제너레이터(yield)를 써서 후보 경로를 하나씩 만들어냄. Iterable은 '순서대로 꺼낼 수 있는 것'을 의미하는 타입 힌트임.",
      terms: ["제너레이터(yield)", "Iterable", "Path(__file__)", "타입 힌트"],
      lines: [
        { at: "for directory in (start_dir, *start_dir.parents):", text: "*start_dir.parents는 '현재 폴더의 모든 상위 폴더 목록'을 펼쳐 넣는 문법. 현재 폴더→부모→조부모 순으로 훑음." },
        { at: 'yield directory / ".env"', text: "yield는 값을 하나 내놓고 잠깐 멈추는 제너레이터 문법. 호출자가 next()를 부를 때마다 다음 경로를 하나씩 만들어 줌." },
        { at: 'yield directory / "agentic-ai" / "examples" / ".env"', text: "각 폴더에서 직접 .env와 agentic-ai/examples/.env 두 곳을 후보로 냄." },
      ],
      code:
`def iter_env_candidates(start_dir: Path) -> Iterable[Path]:
    """현재 예제와 저장소 상위 디렉터리에서 .env 후보 경로를 순서대로 반환함."""
    for directory in (start_dir, *start_dir.parents):
        yield directory / ".env"
        yield directory / "agentic-ai" / "examples" / ".env"`,
    },
    {
      id: "load_environment",
      name: "load_environment(start_dir)",
      fileId: "main",
      summary: "GROQ_API_KEY가 포함된 .env 파일을 찾아 환경 변수로 로드하고, 로드한 파일 목록을 반환함.",
      how: "iter_env_candidates가 후보 경로를 순서대로 내놓으면, 실제로 존재하는 파일만 골라 load_dotenv로 읽음. override=False는 '이미 환경 변수가 설정되어 있으면 덮어쓰지 말라'는 뜻으로, 사용자가 미리 설정한 값을 보호함. seen 집합으로 같은 파일을 중복 로드하는 것을 막음.",
      terms: ["load_dotenv", "환경변수(.env)", "set(집합)", "타입 힌트"],
      lines: [
        { at: "loaded_paths: list[Path] = []", text: "성공적으로 로드한 .env 파일 경로 목록. 나중에 콘솔에 보여줌." },
        { at: "seen: set[Path] = set()", text: "이미 처리한 경로를 기억하는 집합. 같은 파일을 중복 로드하지 않기 위한 안전장치." },
        { at: "load_dotenv(resolved, override=False)", text: "load_dotenv가 .env 파일을 읽어 환경변수로 올림. override=False: 이미 설정된 값은 건드리지 않음." },
      ],
      code:
`def load_environment(start_dir: Path) -> list[Path]:
    """GROQ_API_KEY가 포함된 .env 파일을 찾아 환경 변수로 로드함."""
    loaded_paths: list[Path] = []
    seen: set[Path] = set()

    for candidate in iter_env_candidates(start_dir):
        resolved = candidate.resolve()
        if resolved in seen or not resolved.exists():
            continue

        load_dotenv(resolved, override=False)
        loaded_paths.append(resolved)
        seen.add(resolved)

    return loaded_paths`,
    },
    {
      id: "create_groq_client",
      name: "create_groq_client()",
      fileId: "main",
      summary: "환경 변수에서 GROQ_API_KEY를 읽어 Groq API 클라이언트를 생성함. 키가 없으면 즉시 오류를 냄.",
      how: "Groq는 LPU(Language Processing Unit)라는 전용 반도체로 초고속 AI 추론을 제공하는 서비스임. 이 함수는 API 키로 Groq 클라이언트(서버와 통신하는 객체)를 만들어 줌. GROQ_BASE_URL이 있으면 사용자 정의 엔드포인트로 연결하는 고급 옵션도 지원함.",
      terms: ["API 키", "환경변수(.env)", "RuntimeError", "Groq LPU"],
      lines: [
        { at: 'api_key = os.getenv("GROQ_API_KEY")', text: "os.getenv로 환경변수에서 API 키를 읽음. 없으면 None을 돌려줌." },
        { at: "if not api_key:", text: "키가 없으면 즉시 RuntimeError로 멈춰 원인을 분명히 알려줌(디버깅 쉬움)." },
        { at: "base_url = os.getenv(\"GROQ_BASE_URL\")", text: "GROQ_BASE_URL이 있으면 사용자 정의 서버 주소로 연결함(고급 옵션)." },
        { at: "return Groq(api_key=api_key)", text: "API 키로 Groq 클라이언트 객체를 만들어 돌려줌." },
      ],
      code:
`def create_groq_client() -> Groq:
    """환경 변수(GROQ_API_KEY)를 읽어 Groq API 클라이언트를 생성함.
    GROQ_API_KEY가 없으면 RuntimeError를 발생시킴."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY가 설정되지 않았습니다. "
            "agentic-ai/examples/.env 또는 현재 디렉터리 .env에 값을 설정하세요."
        )

    base_url = os.getenv("GROQ_BASE_URL")
    if base_url:
        # Groq: Groq Cloud LPU에 요청을 보내는 공식 Python 클라이언트
        return Groq(api_key=api_key, base_url=base_url)
    return Groq(api_key=api_key)`,
    },
    {
      id: "build_chunk_prompt",
      name: "build_chunk_prompt(chunk, chunk_index, total_chunks)",
      fileId: "main",
      summary: "문서의 한 조각(청크)을 요약해 달라고 AI에게 요청하는 메시지 목록을 만듦.",
      how: "AI에게 보내는 메시지는 시스템 메시지(역할·규칙)와 사용자 메시지(실제 요청)로 구성됨. 시스템 메시지는 'AI의 역할 지침서', 사용자 메시지는 '이번 작업 지시'임. chunk_index/total_chunks를 포함해 AI가 전체 맥락을 파악하게 함.",
      terms: ["프롬프트(prompt)", "시스템 메시지", "f-string", "리스트(list)", "딕셔너리(dict)"],
      lines: [
        { at: 'system_prompt = (', text: "시스템 메시지: AI의 역할(기업 교육 자료 요약 보조자)과 기본 규칙을 알려주는 지침서임." },
        { at: 'user_prompt = f"""다음 문서 조각을 읽고', text: "사용자 메시지: 실제 요약 작업 지시. f-string으로 청크 번호와 내용을 끼워 넣음." },
        { at: '{"role": "system", "content": system_prompt}', text: "role이 'system'인 딕셔너리가 AI에게 역할을 알려주는 메시지임." },
        { at: '{"role": "user", "content": user_prompt}', text: "role이 'user'인 딕셔너리가 실제 요약 요청 메시지임." },
      ],
      code:
`def build_chunk_prompt(chunk: str, chunk_index: int, total_chunks: int) -> list[dict[str, str]]:
    """문서 일부(청크)를 요약하도록 요청하는 시스템·사용자 메시지 목록을 생성함."""
    system_prompt = (
        "당신은 기업 교육 자료를 요약하는 AI 개발 실습 보조자입니다. "
        "원문에 있는 사실만 사용하고, 한국어로 간결하게 정리하세요."
    )
    user_prompt = f"""다음 문서 조각을 읽고 핵심 내용을 요약해 주세요.

문서 조각: {chunk_index}/{total_chunks}

요약 원칙:
- 회사 개요, 핵심 가치, 수행 실적, 운영 인원, 교육 프로그램 관련 내용 우선 정리
- 수치, 기간, 고유명사는 가능한 한 보존
- 중복 표현과 이미지 설명은 제외
- Markdown 목록 형식으로 작성

문서 내용:
{chunk}"""

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]`,
    },
    {
      id: "build_document_prompt",
      name: "build_document_prompt(text)",
      fileId: "main",
      summary: "짧은 문서(청크 분할 불필요)를 5개 섹션 구조로 요약 요청하는 메시지 목록을 만듦.",
      how: "문서가 max_chunk_chars 이하로 짧으면 청크 분할 없이 이 함수로 한 번에 요약함. 결과를 '회사 개요·핵심 가치·주요 실적·운영 인원·교육 프로그램' 5개 섹션 형식으로 달라고 지정함.",
      terms: ["프롬프트(prompt)", "시스템 메시지", "f-string", "리스트(list)", "딕셔너리(dict)"],
      lines: [
        { at: 'user_prompt = f"""다음 문서를 읽고 최종 요약을 작성해 주세요.', text: "단일 문서 전체를 5개 섹션 구조로 요약 요청하는 사용자 메시지." },
        { at: "## 1. 회사 개요", text: "AI 응답이 이 5개 섹션 구조를 따르도록 형식을 명시함." },
        { at: '{"role": "system", "content": system_prompt},', text: "시스템·사용자 메시지를 목록으로 묶어 반환함. call_groq()에 그대로 전달됨." },
      ],
      code:
`def build_document_prompt(text: str) -> list[dict[str, str]]:
    """단일 전체 문서를 5개 섹션 구조로 요약하도록 요청하는 메시지 목록을 생성함."""
    system_prompt = (
        "당신은 기업 교육 자료를 요약하는 AI 개발 실습 보조자입니다. "
        "원문에 있는 사실만 사용하고, 한국어로 간결하게 정리하세요."
    )
    user_prompt = f"""다음 문서를 읽고 최종 요약을 작성해 주세요.

최종 요약 형식:
# 텍스트 요약
## 1. 회사 개요
## 2. 핵심 가치와 행동 원칙
## 3. 주요 수행 실적
## 4. 운영 인원과 전문성
## 5. 교육 프로그램과 기대효과

작성 원칙:
- 각 섹션은 3~5개 bullet 중심으로 작성
- 수치, 기간, 고유명사는 가능한 한 보존
- 중복 표현과 이미지 설명은 제외
- 원문에 없는 내용 추가 금지

문서 내용:
{text}"""

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]`,
    },
    {
      id: "build_final_prompt",
      name: "build_final_prompt(chunk_summaries)",
      fileId: "main",
      summary: "여러 청크 요약들을 하나의 최종 요약으로 통합 요청하는 메시지 목록을 만듦.",
      how: "청크별 요약이 여러 개 있을 때, 이것들을 다시 AI에게 주고 '하나로 합쳐 달라'고 요청하는 마지막 단계임. enumerate로 [부분 요약 1], [부분 요약 2] 형식으로 번호를 붙여 구분해 줌.",
      terms: ["프롬프트(prompt)", "시스템 메시지", "enumerate()", "f-string", "리스트(list)"],
      lines: [
        { at: 'joined_summaries = "\\n\\n".join(', text: "각 청크 요약에 번호를 붙여([부분 요약 1] 등) 하나의 긴 문자열로 합침." },
        { at: 'f"[부분 요약 {index}]\\n{summary}"', text: "f-string으로 번호와 요약 내용을 '[부분 요약 1]\\n내용' 형식으로 만듦." },
        { at: 'for index, summary in enumerate(chunk_summaries, start=1)', text: "enumerate(..., start=1)로 1번부터 번호를 매기며 각 요약을 꺼냄." },
      ],
      code:
`def build_final_prompt(chunk_summaries: list[str]) -> list[dict[str, str]]:
    """여러 청크 요약을 하나의 최종 요약으로 통합 요청하는 메시지 목록을 생성함."""
    system_prompt = (
        "당신은 여러 개의 부분 요약을 하나의 최종 요약으로 통합하는 전문 요약가입니다. "
        "중복은 제거하고 사실 관계는 유지하세요."
    )
    joined_summaries = "\\n\\n".join(
        f"[부분 요약 {index}]\\n{summary}"
        for index, summary in enumerate(chunk_summaries, start=1)
    )
    user_prompt = f"""다음 부분 요약들을 하나의 최종 요약으로 통합해 주세요.

최종 요약 형식:
# 텍스트 요약
## 1. 회사 개요
## 2. 핵심 가치와 행동 원칙
## 3. 주요 수행 실적
## 4. 운영 인원과 전문성
## 5. 교육 프로그램과 기대효과

작성 원칙:
- 한국어로 작성
- 원문에 없는 내용 추가 금지
- 각 섹션은 3~5개 bullet 중심으로 작성
- 중복 내용은 한 번만 정리

부분 요약:
{joined_summaries}"""

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]`,
    },
    {
      id: "extract_message_text",
      name: "extract_message_text(message)",
      fileId: "main",
      summary: "Groq 응답 메시지 객체에서 최종 텍스트 문자열만 꺼냄. 응답 형식이 달라도 안전하게 처리함.",
      how: "AI 응답의 content 필드는 단순 문자열일 수도 있고, 여러 조각의 목록(list)일 수도 있음. getattr로 안전하게 꺼내고, isinstance로 형태를 확인한 뒤 알맞게 처리함. 어떤 경우에도 빈 문자열 이상의 값을 돌려줌.",
      terms: ["getattr()", "isinstance()", "리스트(list)", "딕셔너리(dict)", "타입 힌트"],
      lines: [
        { at: "content = getattr(message, \"content\", None)", text: "getattr은 객체에서 속성을 안전하게 꺼냄. 없으면 None을 돌려줌(딕셔너리의 .get()과 비슷함)." },
        { at: "if isinstance(content, str):", text: "content가 단순 문자열이면 그대로 앞뒤 공백 제거 후 반환함." },
        { at: "if isinstance(content, list):", text: "content가 목록이면(응답이 여러 조각) 텍스트 부분만 골라 이어 붙임." },
        { at: 'parts.append(str(item.get("text") or item.get("content") or ""))', text: "딕셔너리 항목이면 'text' 또는 'content' 키를 순서대로 시도해 값을 꺼냄." },
      ],
      code:
`def extract_message_text(message: object) -> str:
    """Groq 응답 메시지 객체에서 최종 텍스트 문자열만 추출함."""
    content = getattr(message, "content", None)

    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                parts.append(str(item.get("text") or item.get("content") or ""))
            else:
                parts.append(str(getattr(item, "text", "") or getattr(item, "content", "")))
        return "\\n".join(part for part in parts if part).strip()

    return ""`,
    },
    {
      id: "call_groq",
      name: "call_groq(client, messages, options)",
      fileId: "main",
      summary: "Groq Chat Completions API를 실제로 호출하고, 응답 텍스트와 소요 시간·토큰 사용량을 CompletionResult로 묶어 반환함.",
      how: "이 함수가 실제 AI 호출이 일어나는 핵심임. time.perf_counter()로 시작·끝 시간을 재 경과 시간을 계산함. response.choices[0].message에서 첫 번째 응답을 꺼내고, usage에서 토큰 사용량을 읽음. 응답이 비어 있으면 RuntimeError로 알려줌.",
      terms: ["time.perf_counter()", "response.choices", "토큰(token)", "RuntimeError", "getattr()", "타입 힌트"],
      lines: [
        { at: "start_time = time.perf_counter()", text: "time.perf_counter()는 고정밀 타이머. 시작 시각을 기록해 두었다가 나중에 빼면 경과 시간이 나옴." },
        { at: "response = client.chat.completions.create(", text: "Groq Chat Completions API 호출. OpenAI API와 호환되는 형식임." },
        { at: "message = response.choices[0].message", text: "response.choices는 AI가 생성한 후보 답변 목록. [0]이 첫 번째(보통 유일한) 답변임." },
        { at: "usage = getattr(response, \"usage\", None)", text: "getattr로 usage 속성을 안전하게 꺼냄. 없으면 None." },
        { at: "prompt_tokens = int(getattr(usage, \"prompt_tokens\", 0) or 0)", text: "토큰 수를 안전하게 정수로 변환. 속성이 없거나 None이면 0으로 처리함." },
      ],
      code:
`def call_groq(
    client: Groq,
    messages: list[dict[str, str]],
    options: GroqOptions,
) -> CompletionResult:
    """Groq Chat Completions API를 호출하고 응답 텍스트와 사용량을 반환함."""
    start_time = time.perf_counter()
    response = client.chat.completions.create(
        model=options.model,
        messages=messages,
        temperature=options.temperature,
        top_p=options.top_p,
        max_completion_tokens=options.max_completion_tokens,
        reasoning_effort=options.reasoning_effort,
        reasoning_format=options.reasoning_format,
    )
    elapsed = time.perf_counter() - start_time

    message = response.choices[0].message
    text = extract_message_text(message)
    if not text:
        raise RuntimeError("Groq 응답에서 요약 텍스트를 찾을 수 없습니다.")

    usage = getattr(response, "usage", None)
    prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
    completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
    total_tokens = int(getattr(usage, "total_tokens", 0) or 0)

    return CompletionResult(
        text=text,
        elapsed_seconds=elapsed,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
    )`,
    },
    {
      id: "summarize_text",
      name: "summarize_text(client, text, max_chunk_chars, options)",
      fileId: "main",
      summary: "문서를 청크로 분할해 각각 요약한 뒤 최종 통합 요약을 생성하는 전체 요약 흐름을 담당함.",
      how: "이 함수가 요약 작업의 지휘자임. 청크가 하나면 build_document_prompt로 한 번에 요약하고, 여러 개면 각각 build_chunk_prompt로 부분 요약 → build_final_prompt로 통합 요약하는 2단계 방식을 씀. 반환값은 tuple로 최종 요약 텍스트와 모든 API 호출 결과 목록임.",
      terms: ["tuple", "리스트(list)", "enumerate()", "타입 힌트"],
      lines: [
        { at: "chunks = split_text(text, max_chars=max_chunk_chars)", text: "문서를 max_chunk_chars 이하의 청크 목록으로 분할함." },
        { at: "if total_chunks == 1:", text: "청크가 하나이면 분할 요약 없이 전체 문서를 한 번에 요약함(더 빠르고 효율적)." },
        { at: "for index, chunk in enumerate(chunks, start=1):", text: "청크가 여러 개이면 1번부터 순서대로 각 청크를 요약함." },
        { at: "final_result = call_groq(", text: "모든 청크 요약이 끝나면 마지막으로 통합 요약을 요청함." },
        { at: "return final_result.text, results", text: "tuple로 최종 요약 텍스트와 모든 API 호출 결과 목록을 함께 반환함." },
      ],
      code:
`def summarize_text(
    client: Groq,
    text: str,
    max_chunk_chars: int,
    options: GroqOptions,
) -> tuple[str, list[CompletionResult]]:
    """문서를 청크별로 요약한 뒤 최종 통합 요약을 생성하여 반환함."""
    chunks = split_text(text, max_chars=max_chunk_chars)
    total_chunks = len(chunks)
    results: list[CompletionResult] = []
    chunk_summaries: list[str] = []

    print(f"   - 분할 청크 수: {total_chunks}")

    if total_chunks == 1:
        print(f"   - 전체 문서 요약 중 ({len(chunks[0]):,} characters)")
        result = call_groq(
            client=client,
            messages=build_document_prompt(chunks[0]),
            options=options,
        )
        print(
            "     완료: "
            f"{result.elapsed_seconds:.2f}초, "
            f"{result.completion_tokens:,} output tokens"
        )
        return result.text, [result]

    for index, chunk in enumerate(chunks, start=1):
        print(f"   - 청크 {index}/{total_chunks} 요약 중 ({len(chunk):,} characters)")
        result = call_groq(
            client=client,
            messages=build_chunk_prompt(chunk, index, total_chunks),
            options=options,
        )
        results.append(result)
        chunk_summaries.append(result.text)
        print(
            "     완료: "
            f"{result.elapsed_seconds:.2f}초, "
            f"{result.completion_tokens:,} output tokens"
        )

    print("   - 최종 통합 요약 생성 중")
    final_result = call_groq(
        client=client,
        messages=build_final_prompt(chunk_summaries),
        options=options,
    )
    results.append(final_result)
    return final_result.text, results`,
    },
    {
      id: "parse_args",
      name: "parse_args()",
      fileId: "main",
      summary: "명령줄 옵션(--input, --output, --model 등)을 정의하고 해석해 반환함.",
      how: "argparse는 'python summary.py --model abc' 같은 명령줄 입력을 처리하는 파이썬 표준 도구임. 각 옵션의 타입·기본값·선택지를 정의하고, parse_args()로 실제 입력을 해석해 옵션 묶음 객체를 반환함.",
      terms: ["argparse", "Path(__file__)", "타입 힌트"],
      lines: [
        { at: "base_dir = Path(__file__).resolve().parent", text: "이 파일이 위치한 디렉터리 경로를 절대경로로 구함. 기본 입·출력 경로를 여기 기준으로 정함." },
        { at: 'parser.add_argument("--input"', text: "--input: 요약할 마크다운 파일 경로. 생략하면 result_Docling.md를 씀." },
        { at: 'parser.add_argument("--reasoning-effort"', text: "--reasoning-effort: AI 추론 공력 수준. 'low'·'medium'·'high' 중 선택. choices로 입력값을 제한함." },
        { at: "return parser.parse_args()", text: "실제 명령줄을 해석해 옵션 값들을 담은 Namespace 객체를 돌려줌." },
      ],
      code:
`def parse_args() -> argparse.Namespace:
    """명령줄 인자를 파싱하여 반환함."""
    # 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
    base_dir = Path(__file__).resolve().parent

    parser = argparse.ArgumentParser(description="Groq LPU 텍스트 요약 예제")
    parser.add_argument("--input", type=Path, default=base_dir / "result_Docling.md")
    parser.add_argument("--output", type=Path, default=base_dir / "summary.txt")
    parser.add_argument("--model", default=DEFAULT_MODEL_ID)
    parser.add_argument("--max-chunk-chars", type=int, default=DEFAULT_MAX_CHUNK_CHARS)
    parser.add_argument("--max-completion-tokens", type=int, default=DEFAULT_MAX_COMPLETION_TOKENS)
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--top-p", type=float, default=0.9)
    parser.add_argument("--reasoning-effort", choices=("low", "medium", "high"), default="low")
    parser.add_argument(
        "--reasoning-format",
        choices=("hidden", "parsed", "raw"),
        default="hidden",
        help="hidden은 최종 답변만 반환하고, parsed/raw는 추론 내용을 분리 또는 포함합니다.",
    )
    return parser.parse_args()`,
    },
    {
      id: "print_usage_summary",
      name: "print_usage_summary(results)",
      fileId: "main",
      summary: "모든 API 호출의 누적 소요 시간·토큰 수·출력 속도를 콘솔에 출력함.",
      how: "results 목록에 담긴 CompletionResult들을 합산해 총 사용량을 계산함. 출력 속도(tokens/sec)는 completion_tokens(출력 토큰 수) ÷ elapsed(초)로 구함. Groq LPU의 초고속 처리 능력을 수치로 확인할 수 있음.",
      terms: ["sum()", "제너레이터 표현식", "f-string", "타입 힌트"],
      lines: [
        { at: "elapsed = sum(result.elapsed_seconds for result in results)", text: "제너레이터 표현식으로 각 결과의 elapsed_seconds를 합산해 총 소요 시간을 구함." },
        { at: "tokens_per_second = completion_tokens / elapsed if elapsed > 0 else 0", text: "0으로 나누는 오류를 막기 위해 elapsed > 0일 때만 나눔. Groq LPU는 이 값이 매우 높음." },
        { at: 'print(f"   - API 호출 수: {len(results)}")', text: "API를 몇 번 호출했는지(청크 수 + 통합 요약 1회)를 출력함." },
      ],
      code:
`def print_usage_summary(results: list[CompletionResult]) -> None:
    """전체 API 호출의 누적 사용량과 처리 시간을 콘솔에 출력함."""
    elapsed = sum(result.elapsed_seconds for result in results)
    prompt_tokens = sum(result.prompt_tokens for result in results)
    completion_tokens = sum(result.completion_tokens for result in results)
    total_tokens = sum(result.total_tokens for result in results)
    tokens_per_second = completion_tokens / elapsed if elapsed > 0 else 0

    print("\\n사용량 요약")
    print(f"   - API 호출 수: {len(results)}")
    print(f"   - 총 소요 시간: {elapsed:.2f}초")
    print(f"   - 입력 토큰: {prompt_tokens:,}")
    print(f"   - 출력 토큰: {completion_tokens:,}")
    print(f"   - 전체 토큰: {total_tokens:,}")
    print(f"   - 출력 속도: {tokens_per_second:.1f} tokens/sec")`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "텍스트 요약 워크플로우 전체를 지휘하는 진입점. 인자 파싱 → 파일 읽기 → 요약 → 저장 순서로 실행함.",
      how: "프로그램의 '지휘자'임. 옵션을 읽고 GroqOptions를 만들고, 환경 변수를 로드하고, 파일을 읽어 정리하고, Groq 클라이언트를 만들고, 요약하고, 결과를 저장함. 각 단계마다 번호(1~4)를 찍어 진행 상황을 알려줌.",
      terms: ["if __name__", "Path(__file__)", "FileNotFoundError", "tuple", "타입 힌트"],
      lines: [
        { at: "base_dir = Path(__file__).resolve().parent", text: "이 파일이 위치한 디렉터리 절대경로를 구함. 환경 변수 로드의 시작 기준점으로 사용함." },
        { at: "options = GroqOptions(", text: "명령줄에서 읽은 옵션들로 GroqOptions 데이터클래스 객체를 만듦. 이후 call_groq에 전달됨." },
        { at: "loaded_env_paths = load_environment(base_dir)", text: "현재 폴더부터 상위 폴더를 거슬러 올라가며 .env 파일을 찾아 API 키 등을 로드함." },
        { at: "if not input_path.exists():", text: "입력 파일이 없으면 FileNotFoundError로 즉시 알려줌(실행 초반에 오류를 발견할 수 있음)." },
        { at: "input_text = clean_markdown(read_text_file(input_path))", text: "파일을 읽고 마크다운 기호를 정리하는 두 단계를 한 줄로 연결함." },
        { at: "summary, results = summarize_text(", text: "summarize_text가 tuple을 반환하므로 summary(요약 텍스트)와 results(사용량 기록) 두 변수로 나눠 받음." },
      ],
      code:
`def main() -> None:
    """텍스트 요약 워크플로우 실행: 인자 파싱 → 파일 읽기 → 요약 → 저장."""
    args = parse_args()
    base_dir = Path(__file__).resolve().parent
    input_path = args.input.resolve()
    output_path = args.output.resolve()

    options = GroqOptions(
        model=args.model,
        temperature=args.temperature,
        top_p=args.top_p,
        max_completion_tokens=args.max_completion_tokens,
        reasoning_effort=args.reasoning_effort,
        reasoning_format=args.reasoning_format,
    )

    print("=" * 70)
    print("Groq LPU 텍스트 요약 예제")
    print("=" * 70)
    print(f"모델: {options.model}")
    print(f"입력 파일: {input_path}")
    print(f"출력 파일: {output_path}")

    loaded_env_paths = load_environment(base_dir)
    if loaded_env_paths:
        print("\\n환경 변수 파일")
        for env_path in loaded_env_paths:
            print(f"   - {env_path}")

    if not input_path.exists():
        raise FileNotFoundError(f"입력 파일을 찾을 수 없습니다: {input_path}")

    print("\\n1. 입력 파일 읽기")
    input_text = clean_markdown(read_text_file(input_path))
    print(f"   - 문서 길이: {len(input_text):,} characters")

    print("\\n2. Groq 클라이언트 초기화")
    client = create_groq_client()
    print("   - 초기화 완료")

    print("\\n3. 요약 생성")
    summary, results = summarize_text(
        client=client,
        text=input_text,
        max_chunk_chars=args.max_chunk_chars,
        options=options,
    )

    print("\\n4. 결과 저장")
    write_text_file(output_path, summary)
    print(f"   - 저장 완료: {output_path}")

    print_usage_summary(results)

    print("\\n" + "=" * 70)
    print("요약 결과")
    print("=" * 70)
    print(summary)
    print("=" * 70)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()`,
    },
  ],

  glossary: {
    "@dataclass": "클래스(데이터 용기)를 쉽게 만들어 주는 파이썬 표식(데코레이터). @dataclass를 붙이면 __init__·__repr__ 같은 메서드를 자동으로 생성해 줘서 코드가 훨씬 간결해짐.",
    "frozen=True": "@dataclass(frozen=True)에 붙이는 옵션. 생성된 객체의 값을 바꾸려 하면 오류가 남. '읽기 전용 데이터 용기'를 만들 때 씀.",
    "타입 힌트": "변수·함수에 자료의 종류(str, int, Path, list 등)를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "인코딩(encoding)": "글자를 컴퓨터가 저장·전송할 수 있는 숫자로 변환하는 규칙. 한국어 파일은 utf-8, cp949, euc-kr 등 다양한 방식으로 저장될 수 있어 읽을 때 맞는 규칙을 써야 함.",
    "UnicodeDecodeError": "파일을 잘못된 인코딩으로 읽으려 할 때 나는 오류. '글자를 해석하는 규칙이 맞지 않다'는 뜻임.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "mkdir": "폴더를 만드는 명령. parents=True는 중간 폴더까지, exist_ok=True는 이미 있어도 오류 없이 넘어가게 함.",
    "write_text": "문자열을 파일에 통째로 쓰는 Path의 기능. encoding='utf-8'로 한글이 깨지지 않게 저장함.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
    "정규식(re)": "글자 패턴을 표현하는 특수 문법. 예: r\"\\d+\"는 숫자 한 개 이상을 찾음. re.sub(패턴, 대체, 텍스트)로 특정 패턴을 찾아 바꿈.",
    "re.sub": "정규식으로 텍스트에서 패턴을 찾아 다른 문자열로 교체하는 함수. re.sub(찾을패턴, 바꿀문자, 대상텍스트) 형태로 씀.",
    "re.fullmatch": "문자열 전체가 패턴과 완전히 일치하는지 확인하는 함수. 일치하면 매치 객체, 아니면 None을 돌려줌.",
    "리스트(list)": "여러 값을 순서대로 담는 목록. [\"a\", \"b\"]처럼 대괄호로 표현함.",
    "제너레이터(yield)": "값을 한 번에 다 만들지 않고 요청받을 때마다 하나씩 만들어 내는 함수. yield 키워드로 값을 하나 내놓고 잠깐 멈춤. 메모리를 아낄 수 있음.",
    "Iterable": "'순서대로 꺼낼 수 있는 것'을 뜻하는 타입 힌트. 리스트, 제너레이터, 튜플 등이 모두 Iterable임.",
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .resolve().parent를 붙이면 이 파일이 든 폴더의 절대경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env 파일에 KEY=값 형태로 적어둠.",
    "set(집합)": "{ }로 묶은 '중복 없는 값들의 모음'. 'x in 집합'으로 들어있는지 매우 빠르게 확인할 수 있음.",
    "API 키": "외부 서비스(Groq 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "RuntimeError": "'실행 중 문제가 생겼다'고 알리는 오류의 한 종류. 여기서는 API 키가 없을 때 일부러 발생시켜 원인을 알려줌.",
    "Groq LPU": "Groq가 개발한 Language Processing Unit(언어처리장치). AI 추론에 특화된 전용 반도체로, GPU보다 훨씬 빠른 속도(수백~수천 tokens/sec)로 LLM을 실행할 수 있음.",
    "프롬프트(prompt)": "AI에게 주는 '지시문'. 어떤 역할을 맡아 어떻게 답할지를 글로 알려주는 것임.",
    "시스템 메시지": "AI에게 역할과 규칙을 알려주는 '지침' 메시지. role이 'system'인 딕셔너리로 전달되며, 대화 맨 앞에 넣음.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"role\": \"user\"}처럼 이름표를 붙여 값을 저장함.",
    "제너레이터 표현식": "( 표현식 for 항목 in 목록 if 조건 ) 형태로, 값을 미리 다 만들지 않고 필요할 때 하나씩 만들어내는 효율적인 문법.",
    "nonlocal": "중첩 함수(안에 정의된 함수)에서 바깥 함수의 변수를 읽기만 하는 게 아니라 '수정'하고 싶을 때 쓰는 키워드. nonlocal 없이 바깥 변수를 바꾸려 하면 오류가 남.",
    "중첩 함수": "함수 안에 또 다른 함수를 정의하는 것. 바깥 함수의 변수를 그대로 쓸 수 있어, 반복되는 작은 작업을 깔끔하게 묶을 때 유용함.",
    "ValueError": "값이 잘못됐을 때 나는 오류. 여기서는 max_chars가 0 이하일 때 발생시킴.",
    "리스트 컴프리헨션": "[표현식 for 항목 in 목록 if 조건] 형태로, 반복문을 한 줄로 짧게 써서 새 목록을 만드는 파이썬 문법.",
    "getattr()": "객체에서 속성을 안전하게 꺼내는 함수. getattr(객체, '속성명', 기본값)처럼 써서, 속성이 없어도 오류 대신 기본값을 돌려줌.",
    "isinstance()": "어떤 값이 특정 종류(타입)인지 확인하는 함수. 예: isinstance(x, list)는 'x가 리스트인가?'를 True/False로 답함.",
    "time.perf_counter()": "아주 정밀한(나노초 단위) 타이머를 반환하는 함수. 두 번 호출해 차이를 구하면 코드 실행 시간을 잴 수 있음.",
    "response.choices": "Chat Completions API 응답에서 AI가 생성한 후보 답변 목록. [0]이 첫 번째(보통 유일한) 답변임.",
    "토큰(token)": "AI 모델이 글자를 처리하는 단위. 단어 또는 단어 조각 하나가 토큰 1~수 개에 해당함. 입력 토큰 + 출력 토큰이 과금의 기준이 됨.",
    "tuple": "여러 값을 순서대로 담는 자료 구조. 리스트와 비슷하지만 한 번 만들면 값을 바꿀 수 없음. (a, b) 형태로 표현하며, 함수에서 여러 값을 한꺼번에 반환할 때 자주 씀.",
    "sum()": "목록(또는 제너레이터)의 모든 숫자를 더해 합계를 구하는 함수.",
    "argparse": "'python 파일.py --옵션 값' 형태의 명령줄 입력을 정의하고 해석해 주는 파이썬 표준 도구.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
    "FileNotFoundError": "찾는 파일이 없을 때 나는 오류. 여기서는 입력 파일이 없을 때 분명히 알려주려고 사용함.",
    "enumerate()": "목록을 돌면서 '번호와 값'을 함께 꺼내 주는 함수. start=1을 주면 1번부터 셈.",
  },
};
