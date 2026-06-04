/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../04.pdf/PyMuPDF/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "PDF → 마크다운 변환 (PyMuPDF) 예제 설명",
    entry: "pdf2md.py",
  },

  files: [
    { id: "main", label: "pdf2md.py", role: "단일 파일 · PDF를 읽어 마크다운으로 변환" },
  ],

  flow: [
    {
      step: 1,
      title: "실행 시작",
      label: "실행 시작",
      refs: ["main"],
      summary: "python pdf2md.py 실행 → main()이 진입점으로 호출됨",
      detail: "터미널에서 실행하면 파일 맨 아래 if __name__ == '__main__': 가 main()을 부름. main()이 전체 작업을 순서대로 지휘하는 시작점임.",
    },
    {
      step: 2,
      title: "명령줄 옵션 읽기",
      label: "명령줄 옵션 읽기",
      refs: ["parse_args"],
      summary: "parse_args()로 --input(PDF 경로)·--output(저장 경로) 옵션을 읽음",
      detail: "식당에서 주문서를 받는 단계와 비슷함. argparse가 'python pdf2md.py --input my.pdf' 같은 입력을 해석해, 어떤 파일을 변환하고 어디에 저장할지 정함. 옵션을 생략하면 기본값(../AI GARAGE Proposal.pdf → ./result.md)을 씀.",
    },
    {
      step: 3,
      title: "PDF 열고 텍스트 추출",
      label: "PDF 텍스트 추출",
      refs: ["extract_lines"],
      summary: "fitz.open()으로 PDF를 열고, 각 페이지에서 extract_lines()로 줄·위치·폰트 크기를 추출함",
      detail: "책을 열어 한 줄씩 정보를 받아 적는 단계임. 단순히 글자만 꺼내는 것이 아니라, 각 줄이 페이지의 어느 위치에 있고 글자 크기가 얼마인지도 함께 기록함. 이 정보가 나중에 제목·본문 구분에 쓰임.",
    },
    {
      step: 4,
      title: "반복 헤더·푸터 감지",
      label: "헤더·푸터 감지",
      refs: ["find_repeated_edge_keys"],
      summary: "find_repeated_edge_keys()로 여러 페이지에 반복 등장하는 머리말·꼬리말 키를 찾아냄",
      detail: "책 매 페이지에 같은 회사명·페이지 번호가 붙어 있는 경우, 이를 자동으로 탐지하는 단계임. '페이지 상단/하단에 있으면서 25% 이상의 페이지에 반복되는 글'을 헤더·푸터로 판단함. 페이지 번호 숫자는 {n}으로 통일해 비교함.",
    },
    {
      step: 5,
      title: "헤더·푸터 제거",
      label: "헤더·푸터 제거",
      refs: ["remove_repeated_header_footer"],
      summary: "remove_repeated_header_footer()로 반복 머리말·꼬리말을 각 페이지에서 제거함",
      detail: "탐지된 반복 텍스트를 실제로 걷어내는 단계임. 가장자리 영역에 있으면서 반복 키 목록에 있는 줄만 제거하고, 본문은 그대로 남김.",
    },
    {
      step: 6,
      title: "마크다운 렌더링",
      label: "마크다운 렌더링",
      refs: ["render_markdown", "line_to_markdown"],
      summary: "render_markdown()이 전체 줄을 마크다운 문자열로 변환함. 폰트 크기로 제목 수준을 추론함",
      detail: "추출한 줄 하나하나를 '# 제목', '- 목록', 일반 본문 중 어떤 형식인지 판단해 마크다운으로 바꾸는 핵심 단계임. 전체 글자 크기의 중간값(중앙값)을 본문 기준으로 삼아, 그보다 크면 제목으로 처리함.",
    },
    {
      step: 7,
      title: "결과 저장",
      label: "결과 저장",
      summary: "변환된 마크다운 문자열을 output_path에 UTF-8로 저장함",
      detail: "완성된 결과를 파일로 남기는 단계임. 저장 폴더가 없으면 자동으로 만들고, UTF-8 인코딩으로 써서 한글이 깨지지 않게 함.",
    },
    {
      step: 8,
      title: "종료",
      label: "종료",
      refs: ["main"],
      summary: "완료 메시지를 출력하고 프로그램이 끝남",
      detail: "변환이 끝나면 '완료.'라고 알려주고 종료함.",
    },
  ],

  functions: [
    // ===== pdf2md.py =====
    {
      id: "module_setup",
      name: "모듈 설정 (경로·상수·TextLine)",
      fileId: "main",
      summary: "파일 맨 위에서 경로 상수·불릿 기호 집합을 준비하고, 추출한 줄 1개의 정보를 담을 TextLine 데이터클래스를 정의함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 준비하는 값들'임. SCRIPT_DIR로 이 파일의 위치를 기준으로 기본 경로를 자동 계산하고, BULLET_MARKERS는 불릿 기호들의 집합(set)을 정의함. TextLine은 각 줄의 위치·폰트 크기·텍스트를 하나로 묶는 '기록 양식(데이터클래스)'임.",
      terms: ["Path(__file__)", "set(집합)", "@dataclass", "frozen=True", "타입 힌트"],
      lines: [
        { at: "SCRIPT_DIR = Path(__file__).resolve().parent", text: "Path(__file__)은 '이 파일의 위치'. .resolve().parent로 이 파일이 든 폴더의 절대경로를 구함." },
        { at: 'BULLET_MARKERS = {"•"', text: "불릿 기호를 집합(set)으로 관리함. 'x in 집합'으로 포함 여부를 빠르게 확인할 수 있음." },
        { at: "@dataclass(frozen=True)", text: "@dataclass는 데이터를 묶는 클래스를 자동으로 완성해주는 데코레이터임. frozen=True는 '한 번 만들면 값 변경 불가'를 의미함." },
        { at: "class TextLine:", text: "PDF에서 꺼낸 텍스트 줄 1개의 정보(위치·폰트크기·텍스트)를 하나로 묶는 데이터 컨테이너임." },
      ],
      code:
`# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = SCRIPT_DIR.parent / "AI GARAGE Proposal.pdf"
DEFAULT_OUTPUT = SCRIPT_DIR / "result.md"
# 불릿 기호 유니코드 문자 집합 (•, ●, ▪, ◦)
BULLET_MARKERS = {"•", "●", "▪", "◦"}


@dataclass(frozen=True)
class TextLine:
    """PDF 페이지에서 추출한 텍스트 줄 1개와 위치·폰트 크기 정보."""

    page_index: int
    page_height: float
    x0: float
    y0: float
    x1: float
    y1: float
    text: str
    font_size: float`,
    },

    {
      id: "clean_text",
      name: "clean_text(text)",
      fileId: "main",
      summary: "특수 공백 문자와 연속 공백을 단일 공백으로 정리해 깔끔한 텍스트를 돌려줌.",
      how: "PDF에서 꺼낸 텍스트에는 일반 공백(스페이스)이 아닌 특수 공백(예: U+00A0 비줄바꿈 공백)이 섞이거나, 공백이 여러 개 연속으로 붙어 있을 수 있음. 첫 번째 replace로 특수 공백을 일반 공백으로 바꾸고, re.sub로 연속된 공백을 하나로 줄임.",
      terms: ["정규식(re)", "strip()", "replace()"],
      lines: [
        { at: 'text = text.replace("\\u00a0"', text: "첫 인자는 비줄바꿈 공백(U+00A0, 특수 공백)임. 이를 일반 공백으로 바꿔 다음 단계에서 제거되게 함." },
        { at: 'text = re.sub(r"\\s+", " ", text)', text: 're.sub(r"\\s+", " ", text)는 공백·탭·줄바꿈 등 여러 공백을 단일 공백 하나로 바꾸는 정규식임.' },
        { at: "return text.strip()", text: ".strip()으로 앞뒤 공백을 최종 제거해 돌려줌." },
      ],
      code:
`def clean_text(text: str) -> str:
    """비줄바꿈 공백과 연속 공백을 단일 공백으로 정규화하여 반환함."""
    text = text.replace("\\u00a0", " ")
    text = re.sub(r"\\s+", " ", text)
    return text.strip()`,
    },

    {
      id: "repeat_key",
      name: "repeat_key(text)",
      fileId: "main",
      summary: "헤더·푸터 반복 감지를 위해, 텍스트를 소문자+공백 제거+숫자→{n} 치환한 비교 키를 돌려줌.",
      how: "두 페이지의 머리말이 '3페이지'와 '4페이지'처럼 숫자만 다른 경우에도 같은 헤더로 인식하도록, 모든 숫자를 {n}으로 바꿔 비교함. 소문자와 공백 제거로 대소문자·공백 차이도 무시함.",
      terms: ["정규식(re)", "lower()"],
      lines: [
        { at: "key = clean_text(text).lower()", text: "clean_text로 공백을 정리한 뒤 .lower()로 소문자로 바꿔 대소문자 차이를 무시함." },
        { at: 'key = re.sub(r"\\s+", "", key)', text: "공백을 모두 제거해 줄 내 공백 차이도 무시하게 함." },
        { at: 'key = re.sub(r"\\d+", "{n}", key)', text: "숫자(\\d+)를 모두 {n}으로 치환해 '3페이지'와 '5페이지'를 같은 키로 취급하게 함." },
      ],
      code:
`def repeat_key(text: str) -> str:
    """반복 헤더·푸터 감지용 비교 키를 생성하여 반환함.
    소문자 변환 후 공백 제거, 숫자를 {n}으로 치환하여 페이지 번호 차이를 무시함."""
    key = clean_text(text).lower()
    key = re.sub(r"\\s+", "", key)
    key = re.sub(r"\\d+", "{n}", key)
    return key`,
    },

    {
      id: "is_edge_line",
      name: "is_edge_line(line)",
      fileId: "main",
      summary: "텍스트 줄이 페이지 상단 또는 하단 가장자리 영역에 있으면 True를 돌려줌.",
      how: "헤더·푸터는 보통 페이지 위·아래 끝에 위치함. 상단 한계(top_limit)와 하단 한계(bottom_limit)를 페이지 높이의 일정 비율로 계산해, 줄의 y좌표가 그 범위 안에 있으면 가장자리 줄로 판단함.",
      terms: ["min()", "타입 힌트"],
      lines: [
        { at: "top_limit = min(45.0, line.page_height * 0.055)", text: "상단 한계를 45pt와 페이지 높이 5.5% 중 작은 값으로 잡음. 페이지마다 다르게 적용하는 유연한 방식임." },
        { at: "bottom_limit = line.page_height - min(45.0, line.page_height * 0.08)", text: "하단 한계는 페이지 높이에서 하단 여백(45pt 또는 8%)을 뺀 값임." },
        { at: "return line.y0 <= top_limit or line.y1 >= bottom_limit", text: "줄의 위쪽(y0)이 상단 한계 이하이거나 줄의 아래쪽(y1)이 하단 한계 이상이면 가장자리 줄임." },
      ],
      code:
`def is_edge_line(line: TextLine) -> bool:
    """텍스트 줄이 페이지 상단 또는 하단 가장자리 영역에 있으면 True를 반환함."""
    top_limit = min(45.0, line.page_height * 0.055)
    bottom_limit = line.page_height - min(45.0, line.page_height * 0.08)
    return line.y0 <= top_limit or line.y1 >= bottom_limit`,
    },

    {
      id: "extract_lines",
      name: "extract_lines(page, page_index)",
      fileId: "main",
      summary: "fitz 페이지 하나에서 텍스트 줄을 위치·폰트 크기와 함께 추출해 TextLine 목록으로 돌려줌.",
      how: "fitz의 get_text('dict')는 페이지를 블록→줄→스팬 구조로 돌려줌. 텍스트 블록(type=0)만 처리하고, 각 줄의 스팬들을 이어 붙여 한 줄의 텍스트를 만듦. 폰트 크기는 스팬 중 가장 큰 값을 씀. 마지막에 y좌표·x좌표순으로 정렬해 읽는 순서를 맞춤.",
      terms: ["get_text(dict)", "fitz.Page", "리스트 컴프리헨션", "sorted()", "타입 힌트"],
      lines: [
        { at: 'page_dict = page.get_text("dict", sort=True)', text: 'get_text("dict")는 페이지 내용을 블록→줄→스팬 계층 구조의 딕셔너리로 꺼냄. sort=True는 위에서 아래 순서를 맞춤.' },
        { at: 'if block.get("type") != 0:', text: "type=0은 텍스트 블록, type=1은 이미지 블록임. 텍스트만 처리하도록 이미지 블록은 건너뜀." },
        { at: 'text = clean_text("".join(', text: '각 스팬의 텍스트를 이어 붙인 뒤 clean_text로 정리함. join은 여러 문자열을 하나로 합치는 파이썬 기능임.' },
        { at: "font_size = max((span.get(", text: "한 줄 안에 스팬이 여러 개일 때, 그 중 가장 큰 폰트 크기를 대표 크기로 씀." },
        { at: "return sorted(lines, key=lambda line: (line.y0, line.x0))", text: "위에서 아래(y0), 왼쪽에서 오른쪽(x0) 순으로 정렬해 읽는 순서와 일치시킴." },
      ],
      code:
`def extract_lines(page: fitz.Page, page_index: int) -> list[TextLine]:
    """fitz 페이지에서 텍스트 줄을 바운딩박스·폰트 크기와 함께 추출하여 반환함."""
    page_dict = page.get_text("dict", sort=True)
    lines: list[TextLine] = []

    for block in page_dict.get("blocks", []):
        # type 0은 텍스트 블록을 의미함 (1은 이미지 블록)
        if block.get("type") != 0:
            continue

        for raw_line in block.get("lines", []):
            spans = raw_line.get("spans", [])
            text = clean_text("".join(span.get("text", "") for span in spans))
            if not text:
                continue

            x0, y0, x1, y1 = raw_line["bbox"]
            font_size = max((span.get("size", 0.0) for span in spans), default=0.0)
            lines.append(
                TextLine(
                    page_index=page_index,
                    page_height=page.rect.height,
                    x0=x0,
                    y0=y0,
                    x1=x1,
                    y1=y1,
                    text=text,
                    font_size=font_size,
                )
            )

    return sorted(lines, key=lambda line: (line.y0, line.x0))`,
    },

    {
      id: "find_repeated_edge_keys",
      name: "find_repeated_edge_keys(pages)",
      fileId: "main",
      summary: "여러 페이지의 가장자리 줄 중 반복 등장하는 텍스트 키 집합을 찾아 돌려줌.",
      how: "페이지가 1개뿐이면 반복이 없으므로 빈 집합을 돌려줌. 각 페이지에서 가장자리 줄의 repeat_key를 모아 Counter(도수 분포표)에 더함. 전체 페이지의 25% 이상(최소 2번)에 나타나면 반복 헤더·푸터로 판정함.",
      terms: ["Counter", "set(집합)", "math.ceil()", "타입 힌트"],
      lines: [
        { at: "if len(pages) < 2:", text: "페이지가 1개면 반복 비교가 불가능하므로 빈 집합을 즉시 돌려줌." },
        { at: "counter: Counter[str] = Counter()", text: "Counter는 '항목별 등장 횟수'를 자동으로 세는 딕셔너리임. 빵집 재고 장부처럼 각 키가 몇 번 나타났는지 기록함." },
        { at: "min_count = max(2, math.ceil(len(pages) * 0.25))", text: "반복 판정 기준: 최소 2번이면서 전체 페이지의 25% 이상. math.ceil은 소수점 올림(예: 4.25→5)." },
        { at: "return {key for key, count in counter.items() if count >= min_count}", text: "기준 이상인 키만 골라 집합(set)으로 돌려줌(집합 컴프리헨션)." },
      ],
      code:
`def find_repeated_edge_keys(pages: list[list[TextLine]]) -> set[str]:
    """여러 페이지의 가장자리 영역에서 반복 등장하는 텍스트 키 집합을 반환함."""
    if len(pages) < 2:
        return set()

    counter: Counter[str] = Counter()
    for lines in pages:
        page_keys = {
            repeat_key(line.text)
            for line in lines
            if is_edge_line(line) and repeat_key(line.text)
        }
        counter.update(page_keys)

    min_count = max(2, math.ceil(len(pages) * 0.25))
    return {key for key, count in counter.items() if count >= min_count}`,
    },

    {
      id: "remove_repeated_header_footer",
      name: "remove_repeated_header_footer(pages, repeated_keys)",
      fileId: "main",
      summary: "각 페이지에서 반복 헤더·푸터에 해당하는 가장자리 줄을 제거한 페이지 목록을 돌려줌.",
      how: "감지된 반복 키 집합을 이용해 각 페이지의 줄을 필터링함. 가장자리(is_edge_line)이면서 키가 repeated_keys에 있는 줄만 제거하고, 나머지는 그대로 유지함.",
      terms: ["리스트 컴프리헨션", "set(집합)", "타입 힌트"],
      lines: [
        { at: "filtered_pages: list[list[TextLine]] = []", text: "결과를 담을 빈 목록을 준비함. 타입 힌트로 '페이지 목록의 목록' 구조를 명시함." },
        { at: "for lines in pages:", text: "페이지 하나하나를 순서대로 처리함." },
        { at: "if not (is_edge_line(line) and repeat_key(line.text) in repeated_keys)", text: "가장자리 줄이면서 반복 키에 속하는 줄만 빼고 나머지를 남김(not 조건). 리스트 컴프리헨션으로 한 줄에 처리함." },
      ],
      code:
`def remove_repeated_header_footer(
    pages: list[list[TextLine]], repeated_keys: set[str]
) -> list[list[TextLine]]:
    """각 페이지에서 반복 헤더·푸터에 해당하는 가장자리 줄을 제거하여 반환함."""
    filtered_pages: list[list[TextLine]] = []
    for lines in pages:
        filtered_pages.append(
            [
                line
                for line in lines
                if not (is_edge_line(line) and repeat_key(line.text) in repeated_keys)
            ]
        )
    return filtered_pages`,
    },

    {
      id: "section_heading_level",
      name: "section_heading_level(text, font_size, body_size)",
      fileId: "main",
      summary: "폰트 크기와 텍스트 패턴으로 마크다운 헤딩 수준(1~3)을 추론함. 헤딩이 아니면 0을 돌려줌.",
      how: "두 가지 기준으로 판단함: ①텍스트가 '1.2 서론' 같은 번호 패턴이면 h2, ②폰트 크기가 본문보다 얼마나 큰지로 h1/h2/h3를 구분함. 본문 크기의 1.65배 이상→h1, 1.35배 이상→h2, 1.18배 이상이면서 80자 이하→h3.",
      terms: ["정규식(re)", "re.match()", "타입 힌트"],
      lines: [
        { at: 'if re.match(r"^\\d+(?:\\.\\d+)', text: "re.match로 텍스트 시작이 '1.', '2.1.' 같은 숫자 번호 패턴인지 확인함. 번호가 있으면 h2로 처리함." },
        { at: "if font_size >= body_size * 1.65:", text: "본문보다 65% 이상 큰 폰트면 대제목(h1, #)으로 판단함." },
        { at: "if font_size >= body_size * 1.35:", text: "본문보다 35% 이상 큰 폰트면 중제목(h2, ##)으로 판단함." },
        { at: "if font_size >= body_size * 1.18 and len(text) <= 80:", text: "본문보다 18% 이상 크고 80자 이하면 소제목(h3, ###)으로 판단함. 긴 문장은 제목이 아닐 가능성이 높아 길이 조건을 붙임." },
      ],
      code:
`def section_heading_level(text: str, font_size: float, body_size: float) -> int:
    """폰트 크기와 텍스트 패턴을 기반으로 마크다운 헤딩 수준(1~3)을 추론하여 반환함.
    헤딩에 해당하지 않으면 0을 반환함."""
    if re.match(r"^\\d+(?:\\.\\d+){1,}\\s+", text):
        return 2

    if font_size >= body_size * 1.65:
        return 1

    if font_size >= body_size * 1.35:
        return 2

    if font_size >= body_size * 1.18 and len(text) <= 80:
        return 3

    return 0`,
    },

    {
      id: "line_to_markdown",
      name: "line_to_markdown(line, body_size)",
      fileId: "main",
      summary: "TextLine 하나를 마크다운 형식 문자열로 변환함. 불릿이면 '- ', 헤딩이면 '#' 기호를 붙임.",
      how: "줄 하나를 어떤 마크다운으로 바꿀지 결정하는 함수임. 텍스트 첫 글자가 불릿 기호(●, • 등)이면 '- '로 시작하는 목록 항목으로, 헤딩으로 판단되면 수준에 맞는 #을 붙임. 둘 다 아니면 그대로 돌려줌.",
      terms: ["BULLET_MARKERS", "set(집합)", "f-string", "타입 힌트"],
      lines: [
        { at: "if text[0] in BULLET_MARKERS:", text: "텍스트 첫 글자가 불릿 기호 집합에 들어있으면 '- '로 시작하는 마크다운 목록으로 변환함." },
        { at: "return \"- \" + text[1:].strip()", text: "불릿 기호 다음 텍스트([1:])를 공백 정리 후 '- '를 앞에 붙여 돌려줌." },
        { at: "level = section_heading_level(text,", text: "section_heading_level로 헤딩 수준(0~3)을 물어봄." },
        { at: "return f\"{'#' * level} {text}\"", text: "헤딩이면 수준만큼 '#'을 반복(예: level=2이면 '##')하고 텍스트를 붙임." },
      ],
      code:
`def line_to_markdown(line: TextLine, body_size: float) -> str:
    """추출된 텍스트 줄 1개를 마크다운 형식 문자열로 변환하여 반환함."""
    text = clean_text(line.text)
    if not text:
        return ""

    if text[0] in BULLET_MARKERS:
        return "- " + text[1:].strip()

    level = section_heading_level(text, line.font_size, body_size)
    if level:
        return f"{'#' * level} {text}"

    return text`,
    },

    {
      id: "render_markdown",
      name: "render_markdown(pages)",
      fileId: "main",
      summary: "필터링된 페이지 전체를 마크다운 문자열로 렌더링함. 폰트 크기 중앙값을 본문 기준으로 삼음.",
      how: "전체 줄의 폰트 크기 중앙값(statistics.median)을 '보통 글자 크기'로 정하고, 이보다 큰 것을 제목으로 처리함. 페이지가 바뀌거나 헤딩 앞에서는 빈 줄을 삽입해 가독성을 높임. 마지막 빈 줄은 제거(pop)함.",
      terms: ["statistics.median", "리스트 컴프리헨션", "startswith()", "타입 힌트"],
      lines: [
        { at: "all_lines = [line for page in pages for line in page]", text: "페이지별로 나뉜 줄을 하나의 목록으로 합침(중첩 리스트 컴프리헨션)." },
        { at: "body_size = (", text: "전체 줄 폰트 크기의 중앙값(statistics.median)을 본문 기준 크기로 삼음. 줄이 없으면 기본값 10.0을 씀." },
        { at: "if previous_page != -1 and previous_page != line.page_index:", text: "이전 페이지와 현재 페이지가 다르면(페이지 경계) 빈 줄을 삽입해 가독성을 높임." },
        { at: "if markdown.startswith(\"#\") and markdown_lines and markdown_lines[-1] != \"\":", text: "헤딩(#으로 시작) 앞에 빈 줄이 없으면 추가해 마크다운 가독성을 높임." },
        { at: "while markdown_lines and markdown_lines[-1] == \"\":", text: "결과 끝의 빈 줄을 제거해 깔끔하게 마무리함." },
      ],
      code:
`def render_markdown(pages: list[list[TextLine]]) -> str:
    """필터링된 텍스트 줄 전체를 마크다운 문자열로 렌더링하여 반환함.
    페이지 경계마다 빈 줄을 삽입하고 헤딩 앞에도 빈 줄을 추가함."""
    all_lines = [line for page in pages for line in page]
    body_size = (
        statistics.median(line.font_size for line in all_lines) if all_lines else 10.0
    )

    markdown_lines: list[str] = []
    previous_page = -1

    for page in pages:
        for line in page:
            markdown = line_to_markdown(line, body_size)
            if not markdown:
                continue

            if previous_page != -1 and previous_page != line.page_index:
                if markdown_lines and markdown_lines[-1] != "":
                    markdown_lines.append("")

            if markdown.startswith("#") and markdown_lines and markdown_lines[-1] != "":
                markdown_lines.append("")

            markdown_lines.append(markdown)
            previous_page = line.page_index

    while markdown_lines and markdown_lines[-1] == "":
        markdown_lines.pop()

    return "\\n".join(markdown_lines) + "\\n"`,
    },

    {
      id: "convert_pdf_to_markdown",
      name: "convert_pdf_to_markdown(input_path, output_path)",
      fileId: "main",
      summary: "PDF 파일을 열어 텍스트를 추출하고, 헤더·푸터를 제거한 뒤 마크다운으로 변환·저장하는 전체 파이프라인.",
      how: "이 함수가 변환 파이프라인 전체를 지휘함: ①PDF 존재 확인 → ②fitz.open으로 열기 → ③페이지별 extract_lines → ④반복 헤더·푸터 감지·제거 → ⑤render_markdown → ⑥파일 저장. with 블록으로 PDF를 열면 블록이 끝날 때 자동으로 닫힘.",
      terms: ["with open(rb)", "fitz.open()", "FileNotFoundError", "mkdir", "write_text", "타입 힌트"],
      lines: [
        { at: "if not input_path.exists():", text: "PDF 파일이 없으면 즉시 FileNotFoundError를 발생시켜 원인을 분명히 알려줌." },
        { at: "with fitz.open(input_path) as document:", text: "fitz.open으로 PDF를 열고, with 블록을 벗어나면 파일이 자동으로 닫힘." },
        { at: "pages = [extract_lines(page, index) for index, page in enumerate(document)]", text: "PDF의 각 페이지를 enumerate로 번호와 함께 꺼내, extract_lines로 줄 목록을 만들어 페이지별 목록으로 구성함." },
        { at: "repeated_keys = find_repeated_edge_keys(pages)", text: "반복 헤더·푸터 키를 찾은 뒤 바로 아래 줄에서 제거함." },
        { at: "output_path.parent.mkdir(parents=True, exist_ok=True)", text: "저장 폴더가 없으면 만들어 둠(exist_ok=True: 이미 있어도 오류 없음)." },
        { at: "output_path.write_text(markdown, encoding=\"utf-8\")", text: "마크다운 문자열을 UTF-8로 저장. encoding 지정으로 한글이 깨지지 않음." },
      ],
      code:
`def convert_pdf_to_markdown(input_path: Path, output_path: Path) -> None:
    """PDF 파일을 마크다운으로 변환하여 output_path에 저장함."""
    if not input_path.exists():
        raise FileNotFoundError(f"입력 PDF를 찾을 수 없습니다: {input_path}")

    # with 블록을 벗어나면 파일이 자동으로 닫힘
    with fitz.open(input_path) as document:
        pages = [extract_lines(page, index) for index, page in enumerate(document)]

    repeated_keys = find_repeated_edge_keys(pages)
    filtered_pages = remove_repeated_header_footer(pages, repeated_keys)
    markdown = render_markdown(filtered_pages)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown, encoding="utf-8")`,
    },

    {
      id: "parse_args",
      name: "parse_args()",
      fileId: "main",
      summary: "명령줄 옵션(--input, --output)을 정의하고 해석해 돌려줌.",
      how: "argparse는 'python pdf2md.py --input my.pdf --output out.md' 같은 명령줄 입력을 처리하는 파이썬 표준 도구임. 각 옵션의 타입·기본값·도움말을 정의하고 parse_args()로 실제 입력을 해석함.",
      terms: ["argparse", "Path(__file__)", "타입 힌트"],
      lines: [
        { at: "parser = argparse.ArgumentParser(", text: "argparse 파서를 만듦. description은 --help 실행 시 보여주는 설명임." },
        { at: '"--input"', text: "--input 옵션 정의: 변환할 PDF 경로. type=Path로 자동으로 Path 객체로 변환됨." },
        { at: '"--output"', text: "--output 옵션 정의: 저장할 마크다운 경로. 기본값은 DEFAULT_OUTPUT(result.md)." },
        { at: "return parser.parse_args()", text: "실제 명령줄을 해석해 옵션 값들을 담은 Namespace 객체를 돌려줌." },
      ],
      code:
`def parse_args() -> argparse.Namespace:
    """명령줄 인자(입력 PDF, 출력 MD 경로)를 파싱하여 반환함."""
    parser = argparse.ArgumentParser(
        description="PyMuPDF를 이용한 PDF → 마크다운 변환"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help=f"입력 PDF 경로. 기본값: {DEFAULT_INPUT}",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"출력 마크다운 경로. 기본값: {DEFAULT_OUTPUT}",
    )
    return parser.parse_args()`,
    },

    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "PDF → 마크다운 변환 워크플로우 전체를 실행하는 시작점.",
      how: "프로그램의 '지휘자'임. 명령줄 옵션을 읽고, 경로를 절대경로로 확정한 뒤, convert_pdf_to_markdown을 호출해 변환을 실행함. 시작 전에 입력·출력 경로를 알려주고, 끝나면 '완료.'를 출력함.",
      terms: ["argparse", "Path(__file__)", "if __name__", "타입 힌트"],
      lines: [
        { at: "args = parse_args()", text: "먼저 명령줄 옵션을 읽어 args에 담음." },
        { at: "input_path = args.input.expanduser().resolve()", text: "expanduser()는 '~' 같은 단축 경로를 펴고, resolve()로 절대경로로 확정함." },
        { at: 'print(f"입력: {input_path}")', text: "변환 전에 입력·출력 경로를 화면에 알려줌." },
        { at: "convert_pdf_to_markdown(input_path, output_path)", text: "핵심 변환 함수를 호출해 PDF를 마크다운으로 변환·저장함." },
        { at: 'print("완료.")', text: "변환이 끝나면 완료 메시지를 출력하고 프로그램이 끝남." },
      ],
      code:
`def main() -> None:
    """PDF → 마크다운 변환 워크플로우를 실행함."""
    args = parse_args()
    input_path = args.input.expanduser().resolve()
    output_path = args.output.expanduser().resolve()

    print(f"입력: {input_path}")
    print(f"출력: {output_path}")

    convert_pdf_to_markdown(input_path, output_path)

    print("완료.")


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()`,
    },
  ],

  glossary: {
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .resolve().parent를 붙이면 이 파일이 든 폴더의 절대경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "set(집합)": "{ }로 묶은 '중복 없는 값들의 모음'. 'x in 집합'으로 들어있는지 매우 빠르게 확인할 수 있어, 지원 형식 검사나 반복 키 보관에 적합함.",
    "@dataclass": "클래스를 정의할 때 __init__(생성자)·__repr__(출력) 같은 반복 코드를 자동으로 만들어주는 데코레이터. 데이터를 담는 클래스를 간결하게 작성할 수 있음.",
    "frozen=True": "@dataclass에 붙이는 옵션. 'frozen(얼어있는)'이라는 뜻처럼, 한 번 만든 객체의 값을 변경할 수 없게 함. 실수로 값을 바꾸는 것을 방지함.",
    "타입 힌트": "변수·함수에 '이건 문자열(str)이야, 결과는 목록(list)이야'처럼 자료의 종류를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "정규식(re)": "문자열에서 패턴을 찾거나 바꾸는 표현식. 예: r'\\d+'는 '숫자 하나 이상'을 의미함. 파이썬의 re 모듈로 사용함.",
    "strip()": "문자열 앞뒤의 공백(또는 지정한 문자)을 제거하는 메서드. '  안녕  '.strip() → '안녕'.",
    "replace()": "문자열 안의 특정 문자(열)를 다른 것으로 바꾸는 메서드. '가나다'.replace('나', 'X') → '가X다'.",
    "re.match()": "문자열의 시작 부분이 패턴과 일치하는지 확인하는 함수. 일치하면 매치 객체, 아니면 None을 돌려줌.",
    "lower()": "문자열을 모두 소문자로 바꾸는 메서드. 'ABC'.lower() → 'abc'. 대소문자 무관 비교에 씀.",
    "min()": "여러 값 중 가장 작은 것을 돌려주는 함수. min(3, 5) → 3.",
    "Counter": "파이썬 collections 모듈의 도수 분포 딕셔너리. Counter(['a','b','a'])는 {'a':2,'b':1}처럼 항목별 등장 횟수를 자동으로 셈.",
    "math.ceil()": "소수점 올림 함수. math.ceil(4.1) → 5. '최소 몇 번 이상'처럼 올림이 필요할 때 씀.",
    "리스트 컴프리헨션": "[표현식 for 항목 in 목록 if 조건] 형태로, 반복문을 한 줄로 짧게 써서 새 목록을 만드는 파이썬 문법.",
    "sorted()": "목록을 정렬해 새 목록으로 돌려주는 함수. key=로 정렬 기준을 지정할 수 있음.",
    "get_text(dict)": "PyMuPDF(fitz)에서 페이지 내용을 딕셔너리 구조(블록→줄→스팬)로 꺼내는 메서드. 각 스팬에 텍스트·위치·폰트 크기 정보가 들어 있음.",
    "fitz.Page": "PyMuPDF에서 PDF 한 페이지를 나타내는 객체. get_text()·rect.height 등의 메서드와 속성으로 페이지 내용을 다룸.",
    "fitz.open()": "PyMuPDF 라이브러리로 PDF 파일을 여는 함수. with 블록과 함께 쓰면 블록이 끝날 때 파일이 자동으로 닫힘.",
    "with open(rb)": "with 블록으로 파일을 열면, 블록을 벗어날 때 파일이 자동으로 닫힘. 'rb'는 바이너리로 읽는다는 뜻임.",
    "statistics.median": "목록 값들의 중앙값을 구하는 함수. 전체를 크기순으로 나열했을 때 가운데 값. 폰트 크기의 대표값을 구하는 데 씀.",
    "startswith()": "문자열이 특정 문자(열)로 시작하는지 확인하는 메서드. '# 제목'.startswith('#') → True.",
    "FileNotFoundError": "찾는 파일이 없을 때 나는 오류. 여기서는 PDF 파일이 없을 때 분명히 알려주려고 일부러 발생시킴.",
    "mkdir": "폴더를 만드는 Path 메서드. parents=True는 중간 폴더도 함께, exist_ok=True는 이미 있어도 오류 없이 넘어가게 함.",
    "write_text": "문자열을 파일에 통째로 쓰는 Path의 기능. encoding='utf-8'로 한글이 깨지지 않게 저장함.",
    "argparse": "'python 파일.py --옵션 값' 형태의 명령줄 입력을 정의하고 해석해 주는 파이썬 표준 도구.",
    "if __name__": "if __name__ == '__main__': 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함. 다른 파일이 import할 때는 실행 안 됨.",
    "BULLET_MARKERS": "불릿 기호(•, ●, ▪, ◦)를 모아둔 집합 상수. 텍스트 첫 글자가 이 중 하나이면 목록 항목으로 처리함.",
    "f-string": "문자열 앞에 f를 붙이고 f'안녕 {이름}'처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
  },
};
