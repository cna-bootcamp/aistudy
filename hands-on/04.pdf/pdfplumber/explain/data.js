/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../04.pdf/pdfplumber/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "PDF → 마크다운 변환 (pdfplumber) 예제 설명",
    entry: "pdf2md.py",
  },

  files: [
    { id: "main", label: "pdf2md.py", role: "단일 파일 CLI · PDF에서 텍스트·표를 추출해 마크다운으로 변환" },
  ],

  flow: [
    {
      step: 1,
      title: "실행 시작",
      label: "실행 시작",
      refs: ["main"],
      summary: "python pdf2md.py 명령을 실행하면 main()이 진입점으로 호출됨",
      detail: "파일 맨 아래 if __name__ == '__main__': 가 main()을 호출함. 웹 서버 없이 터미널에서 바로 실행하는 'CLI 프로그램'임.",
    },
    {
      step: 2,
      title: "명령줄 옵션 읽기",
      label: "명령줄 옵션 읽기",
      refs: ["parse_args"],
      summary: "parse_args()로 --input(PDF 경로)·--output(결과 MD 경로)을 읽음",
      detail: "argparse가 'python pdf2md.py --input 문서.pdf' 같은 입력을 해석함. 생략하면 기본값(AI GARAGE Proposal.pdf, result.md)을 씀.",
    },
    {
      step: 3,
      title: "반복 줄 탐지",
      label: "반복 줄 탐지",
      refs: ["detect_repeated_edge_lines"],
      summary: "detect_repeated_edge_lines()가 헤더·푸터에 반복 등장하는 문구를 미리 수집함",
      detail: "PDF 문서에는 모든 페이지에 '회사명', '페이지 번호' 같은 반복 문구가 있음. 이 단계에서 그런 줄들을 미리 파악해 두어, 나중에 본문 추출 시 걸러냄. 식당 메뉴에서 '본사: 서울' 같은 고정 문구를 제거하는 것과 같음.",
    },
    {
      step: 4,
      title: "페이지별 변환",
      label: "페이지별 변환",
      refs: ["build_markdown", "page_sections_to_markdown"],
      summary: "build_markdown()이 각 페이지를 순회하며 표·텍스트를 마크다운으로 변환함",
      detail: "PDF를 한 장씩 넘기며, 각 페이지에서 page_sections_to_markdown()을 호출함. 표(테이블)가 있으면 마크다운 테이블로, 일반 텍스트는 줄 단위로 변환함. 페이지 사이에는 구분선(---)을 삽입함.",
    },
    {
      step: 5,
      title: "본문 영역 잘라내기",
      label: "본문 영역 잘라내기",
      refs: ["crop_body"],
      summary: "crop_body()가 헤더·푸터 비율(7%)만큼 상·하단을 제외한 본문만 남김",
      detail: "페이지 전체 높이에서 위 7%, 아래 7%를 잘라내 본문만 처리함. 물리적으로 페이지 가장자리를 가위로 자르는 것과 같음.",
    },
    {
      step: 6,
      title: "표 탐지 및 변환",
      label: "표 탐지·변환",
      refs: ["table_to_markdown"],
      summary: "find_tables()로 표 위치를 찾고, table_to_markdown()으로 마크다운 테이블로 변환함",
      detail: "pdfplumber가 선(라인)을 기반으로 표의 경계를 자동 탐지함. 표를 찾은 다음 위쪽 텍스트 → 표 → 아래 텍스트 순서로 위→아래 순서를 유지해 변환함.",
    },
    {
      step: 7,
      title: "텍스트 정제",
      label: "텍스트 정제",
      refs: ["clean_text_lines"],
      summary: "clean_text_lines()가 반복 줄 제거, 불릿 기호 정규화, 빈 줄 정리를 수행함",
      detail: "헤더·푸터 반복 줄을 걸러내고, PDF의 '•' 기호를 마크다운 '-'로 바꾸고, 연속 빈 줄도 정리함. 지저분한 원고를 깔끔하게 다듬는 편집자와 같음.",
    },
    {
      step: 8,
      title: "파일 저장",
      label: "파일 저장",
      refs: ["write_markdown"],
      summary: "write_markdown()이 결과를 UTF-8 마크다운 파일로 저장함",
      detail: "출력 폴더가 없으면 자동으로 만들고, 변환된 마크다운 내용을 UTF-8 인코딩으로 저장함. 한글이 깨지지 않도록 encoding='utf-8'을 명시함.",
    },
    {
      step: 9,
      title: "종료",
      label: "종료",
      refs: ["main"],
      summary: "완료 메시지를 출력하고 종료 코드(0=성공, 1=실패)를 반환함",
      detail: "작업이 성공하면 어떤 파일을 변환했고 어디에 저장했는지 알려줌. 오류가 발생하면 메시지를 찍고 종료 코드 1을 돌려줌.",
    },
  ],

  functions: [
    // ===== pdf2md.py (메인 · 유일 파일) =====
    {
      id: "module_constants",
      name: "모듈 상수 (경로·설정값)",
      fileId: "main",
      summary: "파일 맨 위에서 경로·헤더푸터 비율·표 탐지 설정 등 전역 상수를 준비함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 준비하는 값들'임. Path(__file__)으로 이 파일의 위치를 기준으로 기본 입출력 경로를 자동 계산하고, 헤더·푸터 잘라낼 비율과 pdfplumber 표 탐지 옵션을 상수로 정의함.",
      terms: ["Path(__file__)", "pdfplumber", "argparse"],
      lines: [
        { at: "SCRIPT_DIR = Path(__file__).resolve().parent", text: "이 파일이 있는 폴더를 절대경로로 구함. 어디서 실행해도 경로가 어긋나지 않음." },
        { at: "DEFAULT_INPUT = SCRIPT_DIR.parent", text: "기본 입력 PDF는 한 단계 위 폴더(04.pdf/)에 있는 파일로 설정함." },
        { at: "HEADER_RATIO = 0.07", text: "페이지 높이의 7%를 헤더 영역으로 간주해 잘라냄. 0.07 = 7%." },
        { at: "REPEATED_LINE_THRESHOLD = 0.6", text: "전체 페이지의 60% 이상에서 등장하는 줄을 헤더·푸터 반복 문구로 판단함." },
        { at: "TABLE_SETTINGS = {", text: "pdfplumber가 표를 찾을 때 쓰는 옵션 묶음임. '선 기반 탐지', 허용 오차 등을 지정함." },
      ],
      code:
`# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = SCRIPT_DIR.parent / "AI GARAGE Proposal.pdf"
DEFAULT_OUTPUT = SCRIPT_DIR / "result.md"

# 페이지 상·하단 헤더/푸터 비율 (전체 높이 대비)
HEADER_RATIO = 0.07
FOOTER_RATIO = 0.07
# 전체 페이지 중 반복 텍스트로 판단하는 등장 비율 임계값
REPEATED_LINE_THRESHOLD = 0.6
MIN_REPEATED_PAGES = 2
MIN_SECTION_HEIGHT = 4

TABLE_SETTINGS = {
    "vertical_strategy": "lines",
    "horizontal_strategy": "lines",
    "snap_tolerance": 3,
    "join_tolerance": 3,
    "edge_min_length": 3,
    "intersection_tolerance": 5,
    "text_tolerance": 3,
}`,
    },
    {
      id: "parse_args",
      name: "parse_args()",
      fileId: "main",
      summary: "명령줄에서 --input(PDF 경로)과 --output(결과 저장 경로) 옵션을 정의하고 해석함.",
      how: "argparse는 'python pdf2md.py --input 파일.pdf' 같은 명령줄을 정의·해석하는 표준 도구임. 옵션을 생략하면 DEFAULT_INPUT/DEFAULT_OUTPUT을 쓰도록 기본값을 설정해 둠.",
      terms: ["argparse", "타입 힌트"],
      lines: [
        { at: "parser = argparse.ArgumentParser(", text: "명령줄 옵션을 정의·해석하는 argparse 파서를 만듦." },
        { at: '"--input"', text: "--input 옵션 정의: 변환할 PDF 경로. 생략하면 기본값(AI GARAGE Proposal.pdf)을 씀." },
        { at: '"--output"', text: "--output 옵션 정의: 결과를 저장할 마크다운 경로. 생략하면 result.md를 씀." },
        { at: "return parser.parse_args()", text: "실제 명령줄을 해석해 옵션 값들을 담은 객체를 돌려줌." },
      ],
      code:
`def parse_args() -> argparse.Namespace:
    """명령줄 인자(입력 PDF, 출력 MD 경로)를 파싱하여 반환함."""
    parser = argparse.ArgumentParser(
        description="pdfplumber를 이용한 PDF → 마크다운 변환"
    )
    parser.add_argument(
        "--input",
        default=str(DEFAULT_INPUT),
        help=f"입력 PDF 경로. 기본값: {DEFAULT_INPUT}",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help=f"출력 마크다운 경로. 기본값: {DEFAULT_OUTPUT}",
    )
    return parser.parse_args()`,
    },
    {
      id: "normalize_line",
      name: "normalize_line(line)",
      fileId: "main",
      summary: "문자열 안의 연속된 공백을 하나로 줄이고 앞뒤 공백을 없애는 정규화 함수.",
      how: "PDF에서 추출한 텍스트에는 공백이 여러 개 연속으로 붙어 있는 경우가 많음. re.sub로 공백 두 개 이상을 한 개로 줄이고, strip()으로 앞뒤 공백을 제거함.",
      terms: ["re.sub(정규식)", "strip()"],
      lines: [
        { at: 'return re.sub(r"\\s+", " ", line).strip()', text: 're.sub(r"\\s+", " ", line)은 탭·줄바꿈·공백 연속을 하나의 공백으로 바꿈. .strip()은 앞뒤 공백 제거.' },
      ],
      code:
`def normalize_line(line: str) -> str:
    """연속 공백을 단일 공백으로 줄이고 앞뒤 공백을 제거하여 반환함."""
    return re.sub(r"\\s+", " ", line).strip()`,
    },
    {
      id: "extract_lines",
      name: "extract_lines(page)",
      fileId: "main",
      summary: "페이지(또는 잘라낸 영역)에서 비어 있지 않은 텍스트 줄 목록을 뽑아 반환함.",
      how: "pdfplumber의 extract_text()로 텍스트를 뽑은 뒤 splitlines()로 줄 단위로 나눔. 각 줄을 normalize_line으로 정제하고, 빈 줄은 걸러냄. 헤더·푸터 반복 줄 탐지에서 사용함.",
      terms: ["pdfplumber", "리스트 컴프리헨션"],
      lines: [
        { at: 'text = page.extract_text(x_tolerance=1.5, y_tolerance=3, layout=False) or ""', text: "pdfplumber가 페이지에서 텍스트를 추출함. 결과가 None이면 빈 문자열로 대체함." },
        { at: "return [normalize_line(line) for line in text.splitlines() if normalize_line(line)]", text: "줄 단위로 나눈 뒤 정규화하고, 빈 줄은 걸러내 목록으로 반환함(리스트 컴프리헨션)." },
      ],
      code:
`def extract_lines(page) -> list[str]:
    """페이지 또는 잘라낸 영역에서 비어 있지 않은 텍스트 줄 목록을 반환함."""
    text = page.extract_text(x_tolerance=1.5, y_tolerance=3, layout=False) or ""
    return [normalize_line(line) for line in text.splitlines() if normalize_line(line)]`,
    },
    {
      id: "edge_crop",
      name: "edge_crop(page, top, bottom)",
      fileId: "main",
      summary: "페이지에서 top~bottom 사이의 가장자리 영역(헤더 또는 푸터)을 잘라내 반환함.",
      how: "pdfplumber의 crop()은 페이지의 특정 사각형 영역만 잘라낸 새 객체를 돌려줌. 여기서는 왼쪽 끝(0)부터 오른쪽 끝(page.width)까지 너비 전체를, top~bottom 높이로 잘라냄. 헤더·푸터 반복 줄 탐지에서 씀.",
      terms: ["pdfplumber", "crop()"],
      lines: [
        { at: "return page.crop((0, top, page.width, bottom), strict=False)", text: "crop((x0, y0, x1, y1))으로 사각형 영역을 잘라냄. strict=False는 경계 밖으로 살짝 넘쳐도 허용함." },
      ],
      code:
`def edge_crop(page, top: float, bottom: float):
    """페이지의 상단 또는 하단 가장자리 영역을 잘라낸 객체를 반환함."""
    return page.crop((0, top, page.width, bottom), strict=False)`,
    },
    {
      id: "detect_repeated_edge_lines",
      name: "detect_repeated_edge_lines(pdf)",
      fileId: "main",
      summary: "모든 페이지 헤더·푸터 영역을 훑어 반복 등장하는 문구를 집합(set)으로 수집함.",
      how: "각 페이지에서 헤더(상단 7%)와 푸터(하단 7%) 영역을 잘라내고 줄을 추출함. Counter로 줄별 등장 횟수를 셈. '전체 페이지의 60% 이상' 또는 'MIN_REPEATED_PAGES 이상'에서 나온 줄을 반복 문구로 판단함. 이 집합을 나중에 텍스트 정제 시 필터로 씀.",
      terms: ["Counter(빈도 계산기)", "set(집합)", "math.ceil()"],
      lines: [
        { at: "if page_count < MIN_REPEATED_PAGES:", text: "페이지가 너무 적으면(기본 2페이지 미만) 헤더·푸터 탐지를 생략하고 빈 집합을 돌려줌." },
        { at: "counts: Counter[str] = Counter()", text: "Counter는 '각 줄이 몇 번 등장했는지' 자동으로 세주는 딕셔너리임." },
        { at: "for crop in (", text: "각 페이지에서 헤더 영역(0~header_bottom)과 푸터 영역(footer_top~height)을 각각 잘라 줄을 추출함." },
        { at: "counts.update(page_edge_lines)", text: "이 페이지의 가장자리 줄을 전체 카운터에 추가함." },
        { at: "return {line for line, count in counts.items() if count >= repeated_minimum}", text: "반복 횟수가 기준 이상인 줄만 집합으로 반환함(집합 컴프리헨션)." },
      ],
      code:
`def detect_repeated_edge_lines(pdf) -> set[str]:
    """여러 페이지의 헤더·푸터 영역에서 반복 등장하는 텍스트 줄 집합을 반환함."""
    page_count = len(pdf.pages)
    if page_count < MIN_REPEATED_PAGES:
        return set()

    repeated_minimum = max(
        MIN_REPEATED_PAGES,
        math.ceil(page_count * REPEATED_LINE_THRESHOLD),
    )
    counts: Counter[str] = Counter()

    for page in pdf.pages:
        header_bottom = page.height * HEADER_RATIO
        footer_top = page.height * (1 - FOOTER_RATIO)
        page_edge_lines = set()

        for crop in (
            edge_crop(page, 0, header_bottom),
            edge_crop(page, footer_top, page.height),
        ):
            page_edge_lines.update(extract_lines(crop))

        counts.update(page_edge_lines)

    return {line for line, count in counts.items() if count >= repeated_minimum}`,
    },
    {
      id: "crop_body",
      name: "crop_body(page)",
      fileId: "main",
      summary: "페이지에서 헤더·푸터 영역을 제외한 본문 영역만 잘라내 반환함.",
      how: "페이지 높이에서 위쪽 7%(헤더)와 아래쪽 7%(푸터)를 빼고, 남은 가운데 부분만 crop()으로 잘라냄. 이렇게 하면 본문 처리 시 헤더·푸터가 섞이지 않음.",
      terms: ["crop()", "pdfplumber"],
      lines: [
        { at: "top = page.height * HEADER_RATIO", text: "헤더 아래 경계(y 좌표) = 전체 높이 × 7%." },
        { at: "bottom = page.height * (1 - FOOTER_RATIO)", text: "푸터 위 경계(y 좌표) = 전체 높이 × 93%." },
        { at: "return page.crop((0, top, page.width, bottom), strict=False)", text: "본문 사각형(전체 너비, top~bottom)만 잘라낸 객체를 반환함." },
      ],
      code:
`def crop_body(page):
    """고정 헤더·푸터 영역을 제외한 본문 영역만 잘라낸 객체를 반환함."""
    top = page.height * HEADER_RATIO
    bottom = page.height * (1 - FOOTER_RATIO)
    return page.crop((0, top, page.width, bottom), strict=False)`,
    },
    {
      id: "clean_text_lines",
      name: "clean_text_lines(text, repeated_lines)",
      fileId: "main",
      summary: "반복 헤더·푸터 줄 제거, 불릿 기호 정규화, 빈 줄 정리를 수행해 깨끗한 줄 목록을 반환함.",
      how: "텍스트를 줄 단위로 나눠 처리함. 빈 줄은 'blank_pending(빈 줄 예약)' 플래그로 관리해 이중 빈 줄을 방지함. repeated_lines에 있는 줄은 건너뜀. PDF 불릿 기호 '•'는 마크다운 '-'로 교체함. 결과 끝의 빈 줄도 제거함.",
      terms: ["strip()", "불릿(bullet)", "리스트(list)"],
      lines: [
        { at: "cleaned: list[str] = []", text: "정제된 줄들을 담을 빈 목록을 만듦. 이 목록에 줄을 하나씩 추가해 나감." },
        { at: "if line in repeated_lines:", text: "이 줄이 반복 헤더·푸터 문구 집합에 있으면 건너뜀(필터링)." },
        { at: 'line = line.replace("•", "-")', text: 'PDF의 불릿 기호 "•"를 마크다운 목록 기호 "-"로 교체함.' },
        { at: 'if line.startswith("-") and not line.startswith("- "):', text: '"-내용"처럼 공백 없이 붙은 경우 "- 내용"으로 정규화함.' },
        { at: "while cleaned and cleaned[-1] == ", text: '결과 끝에 빈 줄이 남아 있으면 제거함. cleaned[-1]은 목록의 마지막 항목.' },
      ],
      code:
`def clean_text_lines(text: str, repeated_lines: set[str]) -> list[str]:
    """반복 헤더·푸터 줄을 제거하고 불릿 기호를 정규화한 텍스트 줄 목록을 반환함."""
    cleaned: list[str] = []
    blank_pending = False

    for raw_line in text.splitlines():
        line = normalize_line(raw_line)

        if not line:
            blank_pending = bool(cleaned)
            continue

        if line in repeated_lines:
            continue

        line = line.replace("•", "-")
        if line.startswith("-") and not line.startswith("- "):
            line = "- " + line[1:].strip()

        if blank_pending and cleaned[-1] != "":
            cleaned.append("")
        cleaned.append(line)
        blank_pending = False

    while cleaned and cleaned[-1] == "":
        cleaned.pop()

    return cleaned`,
    },
    {
      id: "extract_clean_text",
      name: "extract_clean_text(page, repeated_lines)",
      fileId: "main",
      summary: "페이지 영역에서 텍스트를 추출하고 반복 줄을 제거해 깨끗한 문자열로 반환함.",
      how: "extract_text()로 텍스트를 뽑아 clean_text_lines()로 정제한 뒤, 줄들을 '\\n'으로 이어 붙여 하나의 문자열로 돌려줌. 실제 본문 처리에서 쓰는 텍스트 추출 함수임.",
      terms: ["pdfplumber", "strip()"],
      lines: [
        { at: 'text = page.extract_text(x_tolerance=1.5, y_tolerance=3, layout=False) or ""', text: "페이지 영역에서 텍스트를 추출함. 결과가 None이면 빈 문자열 사용." },
        { at: 'return "\\n".join(clean_text_lines(text, repeated_lines))', text: "정제된 줄들을 줄바꿈으로 이어붙여 하나의 문자열로 반환함." },
      ],
      code:
`def extract_clean_text(page, repeated_lines: set[str]) -> str:
    """페이지 영역에서 텍스트를 추출하고 반복 가장자리 줄을 제거하여 반환함."""
    text = page.extract_text(x_tolerance=1.5, y_tolerance=3, layout=False) or ""
    return "\\n".join(clean_text_lines(text, repeated_lines))`,
    },
    {
      id: "normalize_cell",
      name: "normalize_cell(cell)",
      fileId: "main",
      summary: "표 셀 값을 마크다운에 안전하게 넣을 수 있는 문자열로 변환함.",
      how: "셀이 None이면 빈 문자열을 돌려줌. 셀 안의 줄바꿈은 마크다운에서 쓰는 '<br>'로 바꾸고, 공백을 정규화함. 마크다운 테이블 구분자인 '|'가 셀에 있으면 이스케이프(\\|)해 표가 깨지지 않게 함.",
      terms: ["마크다운(Markdown)", "이스케이프(escape)"],
      lines: [
        { at: "if cell is None:", text: "셀 값이 없으면(None) 빈 문자열을 돌려줌(마크다운 테이블에서 빈 칸)." },
        { at: 'value = normalize_line(str(cell).replace("\\n", "<br>"))', text: '셀을 문자열로 바꾸고, 줄바꿈을 마크다운 줄바꿈 "<br>"로 대체한 뒤 공백을 정규화함.' },
        { at: 'return value.replace("|", r"\\|")', text: '마크다운 테이블 구분자 "|"가 셀에 있으면 "\\|"로 이스케이프해 표가 깨지지 않게 함.' },
      ],
      code:
`def normalize_cell(cell: object) -> str:
    """표 셀 값을 마크다운 출력에 적합한 문자열로 정규화하여 반환함."""
    if cell is None:
        return ""

    value = normalize_line(str(cell).replace("\\n", "<br>"))
    return value.replace("|", r"\\|")`,
    },
    {
      id: "table_to_markdown",
      name: "table_to_markdown(table)",
      fileId: "main",
      summary: "pdfplumber가 추출한 표 데이터(2차원 목록)를 마크다운 테이블 문자열로 변환함.",
      how: "표는 행(row)과 열(column)로 이루어진 2차원 목록임. 헤더 행 | 구분선 | 데이터 행 순서로 마크다운 테이블을 만듦. 첫 행이 모두 비어 있으면 'Column 1', 'Column 2' 같은 임시 헤더를 넣음. 열 개수가 맞지 않는 행은 빈 칸으로 채움.",
      terms: ["마크다운(Markdown)", "리스트 컴프리헨션", "Sequence(시퀀스)"],
      lines: [
        { at: "rows = [[normalize_cell(cell) for cell in row] for row in table if row]", text: "2차원 표의 각 셀을 normalize_cell()로 정제함(중첩 리스트 컴프리헨션)." },
        { at: "column_count = max(len(row) for row in rows)", text: "모든 행 중 가장 많은 열 개수를 구해, 표의 열 수를 통일함." },
        { at: 'header = [f"Column {index}" for index in range(1, column_count + 1)]', text: "첫 행이 모두 빈 경우 'Column 1', 'Column 2'... 형태의 임시 헤더를 만듦." },
        { at: '"| " + " | ".join(["---"] * column_count) + " |",', text: '마크다운 헤더 구분선 "| --- | --- |..." 행을 만듦.' },
        { at: 'lines.append("| " + " | ".join(row) + " |")', text: "나머지 데이터 행을 마크다운 테이블 행으로 추가함." },
      ],
      code:
`def table_to_markdown(table: Sequence[Sequence[object]]) -> str:
    """pdfplumber에서 추출한 표 데이터를 마크다운 테이블 문자열로 변환하여 반환함."""
    rows = [[normalize_cell(cell) for cell in row] for row in table if row]
    rows = [row for row in rows if any(cell for cell in row)]
    if not rows:
        return ""

    column_count = max(len(row) for row in rows)
    normalized_rows = [row + [""] * (column_count - len(row)) for row in rows]

    header = normalized_rows[0]
    if not any(header):
        header = [f"Column {index}" for index in range(1, column_count + 1)]

    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(["---"] * column_count) + " |",
    ]

    for row in normalized_rows[1:]:
        lines.append("| " + " | ".join(row) + " |")

    return "\\n".join(lines)`,
    },
    {
      id: "crop_vertical_band",
      name: "crop_vertical_band(page, top, bottom)",
      fileId: "main",
      summary: "본문 페이지에서 위·아래 좌표를 받아 수직 띠 영역을 잘라냄. 너무 얇으면 None 반환.",
      how: "표와 표 사이, 또는 표 위·아래의 텍스트 영역을 잘라낼 때 씀. 영역이 MIN_SECTION_HEIGHT(4픽셀)보다 얇으면 의미 없는 조각이므로 None을 돌려줌. page.bbox로 현재 잘라낸 영역의 실제 경계를 가져와 top/bottom을 안전하게 보정함.",
      terms: ["crop()", "bbox(경계상자)"],
      lines: [
        { at: "x0, page_top, x1, page_bottom = page.bbox", text: "page.bbox는 현재 잘라낸 영역의 (x0, y0, x1, y1) 경계값을 반환함." },
        { at: "if bottom - top < MIN_SECTION_HEIGHT:", text: "잘라낼 영역 높이가 4픽셀 미만이면 너무 얇아 의미가 없으므로 None을 반환함." },
        { at: "return page.crop((x0, top, x1, bottom), strict=False)", text: "x 방향은 페이지 전체 너비를 유지하고, y 방향만 잘라냄." },
      ],
      code:
`def crop_vertical_band(page, top: float, bottom: float):
    """이미 잘라낸 본문 페이지에서 수직 방향 일부 영역을 다시 잘라 반환함.
    높이가 MIN_SECTION_HEIGHT 미만이면 None을 반환함."""
    x0, page_top, x1, page_bottom = page.bbox
    top = max(top, page_top)
    bottom = min(bottom, page_bottom)

    if bottom - top < MIN_SECTION_HEIGHT:
        return None

    return page.crop((x0, top, x1, bottom), strict=False)`,
    },
    {
      id: "page_sections_to_markdown",
      name: "page_sections_to_markdown(page, repeated_lines)",
      fileId: "main",
      summary: "한 페이지에서 '텍스트 → 표 → 텍스트' 위→아래 순서로 마크다운 섹션 목록을 만듦.",
      how: "이 함수가 페이지 변환의 핵심임. ①본문 영역 자르기 → ②표 탐지 및 정렬 → ③표 위 텍스트 → ④표 변환 → ⑤다음 표로 반복 → ⑥마지막 남은 텍스트 순서로 처리함. '커서(cursor)' 변수가 위→아래로 이동하며 처리 위치를 추적함.",
      terms: ["pdfplumber", "find_tables()", "bbox(경계상자)", "cursor(커서)", "리스트(list)"],
      lines: [
        { at: "body_page = crop_body(page)", text: "먼저 헤더·푸터를 제외한 본문 영역으로 페이지를 잘라냄." },
        { at: "tables = sorted(body_page.find_tables(table_settings=TABLE_SETTINGS), key=lambda t: t.bbox[1])", text: "본문에서 표를 모두 찾아 위→아래 순서(y 좌표 기준)로 정렬함." },
        { at: "for table_index, table in enumerate(tables, start=1):", text: "각 표를 순서대로 처리함. enumerate로 1부터 번호를 붙임(Table 1, Table 2...)." },
        { at: "text_band = crop_vertical_band(body_page, cursor, table_top)", text: "커서 위치부터 이 표 위쪽까지의 텍스트 영역을 잘라냄." },
        { at: 'sections.append(f"### Table {table_index}\\n\\n{markdown_table}")', text: "변환한 마크다운 테이블을 '### Table 1' 제목과 함께 섹션에 추가함." },
        { at: "cursor = max(cursor, table_bottom)", text: "커서를 표 아래쪽으로 이동시켜, 이미 처리한 영역을 다시 처리하지 않게 함." },
      ],
      code:
`def page_sections_to_markdown(page, repeated_lines: set[str]) -> list[str]:
    """페이지에서 표와 텍스트를 위→아래 순서로 추출하여 마크다운 섹션 목록을 반환함."""
    body_page = crop_body(page)
    body_top = body_page.bbox[1]
    body_bottom = body_page.bbox[3]
    sections: list[str] = []
    cursor = body_top

    tables = sorted(body_page.find_tables(table_settings=TABLE_SETTINGS), key=lambda t: t.bbox[1])

    for table_index, table in enumerate(tables, start=1):
        table_top = table.bbox[1]
        table_bottom = table.bbox[3]

        text_band = crop_vertical_band(body_page, cursor, table_top)
        if text_band is not None:
            text = extract_clean_text(text_band, repeated_lines)
            if text:
                sections.append(text)

        markdown_table = table_to_markdown(table.extract())
        if markdown_table:
            sections.append(f"### Table {table_index}\\n\\n{markdown_table}")

        cursor = max(cursor, table_bottom)

    remaining_band = crop_vertical_band(body_page, cursor, body_bottom)
    if remaining_band is not None:
        text = extract_clean_text(remaining_band, repeated_lines)
        if text:
            sections.append(text)

    if not sections:
        text = extract_clean_text(body_page, repeated_lines)
        if text:
            sections.append(text)

    return sections`,
    },
    {
      id: "build_markdown",
      name: "build_markdown(pdf_path)",
      fileId: "main",
      summary: "PDF 파일 전체를 열어 모든 페이지를 순서대로 마크다운 문자열 하나로 만들어 반환함.",
      how: "pdfplumber.open()으로 PDF를 열고, detect_repeated_edge_lines()로 반복 줄을 파악함. 각 페이지를 순회하며 page_sections_to_markdown()으로 변환하고, 페이지 사이에는 구분선('---')을 삽입함. 마지막에 모든 줄을 이어붙여 하나의 문자열로 반환함.",
      terms: ["with open(rb)", "pdfplumber", "enumerate()"],
      lines: [
        { at: "with pdfplumber.open(pdf_path) as pdf:", text: "pdfplumber.open()으로 PDF를 열어 pdf 객체를 얻음. with 블록을 벗어나면 파일이 자동으로 닫힘." },
        { at: "repeated_lines = detect_repeated_edge_lines(pdf)", text: "모든 페이지에서 반복 헤더·푸터 줄을 미리 수집해 둠." },
        { at: "for page_number, page in enumerate(pdf.pages, start=1):", text: "PDF 페이지를 1번부터 순서대로 처리함. enumerate로 페이지 번호를 함께 얻음." },
        { at: 'lines.extend(["", "---", ""])', text: "2번째 페이지부터 페이지 사이에 마크다운 구분선 '---'을 삽입함." },
        { at: 'return "\\n".join(lines).rstrip() + "\\n"', text: "모든 줄을 줄바꿈으로 이어붙이고, 끝 공백을 제거한 뒤 마지막에 줄바꿈 하나를 붙여 반환함." },
      ],
      code:
`def build_markdown(pdf_path: Path) -> str:
    """PDF 파일 전체를 읽어 페이지 순서대로 마크다운 문자열을 생성하여 반환함."""
    lines: list[str] = []

    # with 블록을 벗어나면 파일이 자동으로 닫힘
    with pdfplumber.open(pdf_path) as pdf:
        repeated_lines = detect_repeated_edge_lines(pdf)

        for page_number, page in enumerate(pdf.pages, start=1):
            if page_number > 1:
                lines.extend(["", "---", ""])
            sections = page_sections_to_markdown(page, repeated_lines)

            if sections:
                lines.append("\\n\\n".join(sections))

    return "\\n".join(lines).rstrip() + "\\n"`,
    },
    {
      id: "resolve_path",
      name: "resolve_path(path)",
      fileId: "main",
      summary: "문자열로 받은 경로를 절대 Path 객체로 변환함.",
      how: "argparse가 돌려주는 문자열 경로를 Path 객체로 바꾸고, '~'(홈 디렉터리)를 풀어(expanduser) 절대경로로 변환(resolve)함. 어디서 실행해도 정확한 경로를 얻게 함.",
      terms: ["Path(__file__)", "타입 힌트"],
      lines: [
        { at: "return Path(path).expanduser().resolve()", text: "문자열 경로를 Path로 바꾸고, ~를 풀어 절대경로로 변환함." },
      ],
      code:
`def resolve_path(path: str) -> Path:
    """사용자가 입력한 경로 문자열을 절대 Path 객체로 변환하여 반환함."""
    return Path(path).expanduser().resolve()`,
    },
    {
      id: "write_markdown",
      name: "write_markdown(content, output_path)",
      fileId: "main",
      summary: "마크다운 내용을 UTF-8 파일로 저장함. 출력 폴더가 없으면 자동 생성.",
      how: "저장할 폴더가 없으면 mkdir(parents=True, exist_ok=True)로 만듦. write_text()로 내용을 UTF-8로 파일에 씀. 한글이 깨지지 않도록 인코딩을 명시함.",
      terms: ["mkdir", "write_text", "타입 힌트"],
      lines: [
        { at: "output_path.parent.mkdir(parents=True, exist_ok=True)", text: "저장할 폴더가 없으면 만들어 둠. exist_ok=True는 이미 있어도 오류 없음." },
        { at: 'output_path.write_text(content, encoding="utf-8")', text: '마크다운 내용을 UTF-8로 파일에 씀. encoding="utf-8"을 지정해 한글이 깨지지 않게 함.' },
      ],
      code:
`def write_markdown(content: str, output_path: Path) -> None:
    """마크다운 내용을 UTF-8로 파일에 저장함. 출력 디렉터리가 없으면 자동 생성."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")`,
    },
    {
      id: "convert_pdf_to_markdown",
      name: "convert_pdf_to_markdown(input_path, output_path)",
      fileId: "main",
      summary: "PDF 파일 1개를 마크다운 파일로 변환·저장하는 중간 조율 함수.",
      how: "입력 PDF가 실제로 존재하는지 확인하고(없으면 FileNotFoundError), build_markdown()으로 변환한 뒤 write_markdown()으로 저장함. main()과 핵심 로직 사이의 다리 역할을 함.",
      terms: ["FileNotFoundError", "타입 힌트"],
      lines: [
        { at: "if not input_path.exists():", text: "입력 PDF 파일이 없으면 FileNotFoundError로 즉시 알려줌." },
        { at: "markdown = build_markdown(input_path)", text: "PDF를 마크다운 문자열로 변환함." },
        { at: "write_markdown(markdown, output_path)", text: "변환된 마크다운을 파일로 저장함." },
      ],
      code:
`def convert_pdf_to_markdown(input_path: Path, output_path: Path) -> None:
    """PDF 파일 1개를 마크다운 파일로 변환하여 저장함."""
    if not input_path.exists():
        raise FileNotFoundError(f"입력 PDF를 찾을 수 없습니다: {input_path}")

    markdown = build_markdown(input_path)
    write_markdown(markdown, output_path)`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "CLI 진입점. 옵션을 읽고 변환을 실행하며, 성공 시 0·실패 시 1을 반환함.",
      how: "프로그램의 '지휘자'임. 명령줄 옵션을 읽어 경로를 확정하고, convert_pdf_to_markdown()을 호출함. 전체를 try/except로 감싸 오류가 나도 프로그램이 죽지 않고 메시지를 출력 후 종료 코드 1을 반환함.",
      terms: ["예외 처리(try/except)", "sys.stderr", "if __name__", "raise SystemExit"],
      lines: [
        { at: "args = parse_args()", text: "명령줄 옵션(--input, --output)을 읽음." },
        { at: "input_path = resolve_path(args.input)", text: "문자열 경로를 절대 Path 객체로 변환함." },
        { at: "convert_pdf_to_markdown(input_path, output_path)", text: "★핵심★ PDF → 마크다운 변환을 실행함." },
        { at: 'print(f"[ERROR] {exc}", file=sys.stderr)', text: "오류 메시지를 표준 오류(stderr)에 출력하고 종료 코드 1을 반환함." },
        { at: 'print(f"[OK] 변환 완료: {input_path}")', text: "성공 시 어떤 파일을 변환했고 어디에 저장했는지 알려줌." },
      ],
      code:
`def main() -> int:
    """CLI 진입점. 변환을 실행하고 성공 시 0, 오류 시 1을 반환함."""
    args = parse_args()
    input_path = resolve_path(args.input)
    output_path = resolve_path(args.output)

    try:
        convert_pdf_to_markdown(input_path, output_path)
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print(f"[OK] 변환 완료: {input_path}")
    print(f"[OK] 마크다운 저장: {output_path}")
    return 0


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    raise SystemExit(main())`,
    },
  ],

  glossary: {
    "pdfplumber": "PDF 파일에서 텍스트·표·도형 정보를 파이썬으로 추출할 수 있게 해주는 라이브러리. 페이지 자르기(crop), 텍스트 추출(extract_text), 표 탐지(find_tables) 등 기능을 제공함.",
    "argparse": "'python 파일.py --옵션 값' 형태의 명령줄 입력을 정의하고 해석해 주는 파이썬 표준 도구.",
    "마크다운(Markdown)": "# 제목, **굵게**, | 표 | 같은 기호로 서식을 표현하는 가벼운 문서 형식. 텍스트 에디터로 읽기 쉽고, GitHub 등에서 자동으로 보기 좋게 렌더링됨.",
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .resolve().parent를 붙이면 이 파일이 든 폴더의 절대경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "타입 힌트": "변수·함수에 자료의 종류(str, Path, list 등)를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "리스트 컴프리헨션": "[표현식 for 항목 in 목록 if 조건] 형태로, 반복문을 한 줄로 짧게 써서 새 목록을 만드는 파이썬 문법.",
    "리스트(list)": "여러 값을 순서대로 담는 목록. [\"a\", \"b\"]처럼 대괄호로 표현함.",
    "set(집합)": "{ }로 묶은 '중복 없는 값들의 모음'. 'x in 집합'으로 들어있는지 매우 빠르게 확인할 수 있어, 반복 줄 필터링에 적합함.",
    "Counter(빈도 계산기)": "목록에서 각 항목이 몇 번 등장했는지 자동으로 세주는 딕셔너리. from collections import Counter로 가져옴. Counter(['a','b','a'])는 {'a':2, 'b':1}을 반환함.",
    "math.ceil()": "소수점 이하를 올림해서 정수로 만드는 함수. math.ceil(2.1)은 3을 반환함.",
    "crop()": "pdfplumber 페이지 객체에서 특정 사각형 영역만 잘라낸 새 객체를 반환하는 함수. (x0, y0, x1, y1) 좌표로 영역을 지정함.",
    "bbox(경계상자)": "Bounding Box(경계 상자)의 줄임말. 도형이나 페이지 영역의 (x0, y0, x1, y1) 좌표를 담은 사각형 정보임.",
    "cursor(커서)": "처리 위치를 나타내는 변수. 텍스트 커서처럼, 위→아래로 이동하며 어디까지 처리했는지 추적함.",
    "find_tables()": "pdfplumber가 페이지에서 선(line)을 분석해 표의 위치를 자동으로 탐지하는 함수. TABLE_SETTINGS로 탐지 방법을 세밀하게 조정할 수 있음.",
    "enumerate()": "목록을 돌면서 '번호와 값'을 함께 꺼내주는 함수. start=1을 주면 1번부터 셈.",
    "re.sub(정규식)": "re.sub(패턴, 대체문자, 문자열)은 패턴과 일치하는 부분을 대체 문자로 바꿈. '\\s+'는 공백 1개 이상을 뜻하는 패턴임.",
    "strip()": "문자열 앞뒤의 공백(스페이스·탭·줄바꿈)을 제거하는 문자열 메서드.",
    "불릿(bullet)": "목록 앞에 붙는 기호. PDF에서는 '•', 마크다운에서는 '-' 또는 '*'를 씀.",
    "이스케이프(escape)": "특수 문자가 원래 역할을 하지 않도록 앞에 역슬래시(\\)를 붙이는 것. 마크다운 테이블에서 '|'는 열 구분자이므로 '\\|'로 이스케이프해야 일반 문자로 표시됨.",
    "Sequence(시퀀스)": "파이썬에서 순서가 있는 자료(list, tuple 등)를 통칭하는 타입. typing.Sequence로 타입 힌트에 사용함.",
    "with open(rb)": "with 블록으로 파일을 열면 블록을 벗어날 때 파일이 자동으로 닫힘. pdfplumber.open()도 같은 방식으로 동작함.",
    "mkdir": "폴더를 만드는 Path 메서드. parents=True는 중간 폴더까지, exist_ok=True는 이미 있어도 오류 없이 넘어가게 함.",
    "write_text": "문자열을 파일에 통째로 쓰는 Path의 기능. encoding='utf-8'로 한글이 깨지지 않게 저장함.",
    "FileNotFoundError": "찾는 파일이 없을 때 나는 오류. 여기서는 입력 PDF가 없을 때 분명히 알려주려고 일부러 발생시킴.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "sys.stderr": "오류 메시지를 내보내는 통로(표준 에러). 일반 출력(stdout)과 구분해 오류만 따로 보낼 수 있음.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
    "raise SystemExit": "프로그램을 끝내면서 종료 코드를 운영체제에 알림. main()의 반환값(0=성공, 1=실패)을 종료 코드로 씀.",
  },
};
