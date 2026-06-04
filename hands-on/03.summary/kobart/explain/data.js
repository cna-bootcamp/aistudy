/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../03.summary/kobart/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "KoBART 뉴스 요약 예제 설명",
    entry: "summary.py",
  },

  files: [
    { id: "main", label: "summary.py", role: "단일 파일 CLI 예제 · 뉴스 URL 크롤링 → KoBART 요약 → 저장" },
  ],

  flow: [
    {
      step: 1,
      title: "실행 시작",
      label: "실행 시작",
      refs: ["main"],
      summary: "python summary.py --url <뉴스URL> 실행 → main()이 진입점으로 호출됨",
      detail: "터미널에서 실행하면 맨 아래 if __name__ == '__main__': 가 main()을 호출함. main()이 1~7단계 전체를 순서대로 지휘함. --url 옵션으로 분석할 뉴스 기사 주소를 반드시 넘겨야 함.",
    },
    {
      step: 2,
      title: "뉴스 본문 크롤링",
      label: "뉴스 본문 크롤링",
      refs: ["crawl_news"],
      summary: "crawl_news()가 URL에 접속해 article/p 태그에서 뉴스 본문 텍스트를 추출함",
      detail: "웹사이트에 일반 브라우저인 척 접속해(User-Agent 헤더) 본문을 가져오는 단계임. 사이트마다 HTML 구조가 다르므로 article 태그를 먼저 찾고, 없으면 전체 p 태그를 수집함. script·style 같은 불필요한 태그는 미리 제거함.",
    },
    {
      step: 3,
      title: "텍스트 전처리",
      label: "텍스트 전처리",
      refs: ["preprocess"],
      summary: "preprocess()가 탭·줄바꿈·특수문자를 제거해 KoBART가 읽기 좋은 깨끗한 텍스트로 만듦",
      detail: "요약 품질은 입력 텍스트 품질에 크게 달림. 탭·줄바꿈을 공백으로 바꾸고, 연속 공백을 줄이고, 한글·영문·숫자·기본 구두점 외 특수문자를 지움. 마치 원고지에 쓰기 전 초안을 다듬는 작업임.",
    },
    {
      step: 4,
      title: "디바이스 설정",
      label: "디바이스 설정",
      summary: "GPU(CUDA) 사용 가능 여부를 확인해 'cuda' 또는 'cpu'로 연산 장치를 정함",
      detail: "AI 모델 계산은 GPU가 훨씬 빠름. torch.cuda.is_available()로 GPU가 있는지 자동 확인하고, 있으면 GPU(cuda)를, 없으면 CPU를 씀. CPU는 느리지만 어디서나 동작함.",
    },
    {
      step: 5,
      title: "KoBART 모델 로드",
      label: "KoBART 모델 로드",
      summary: "토크나이저와 BART 모델을 HuggingFace Hub에서 다운로드(최초 1회)하여 메모리에 올림",
      detail: "KoBART는 한국어 전용 요약 AI 모델임. 처음 실행 시 약 500MB 파일을 인터넷에서 받고, 이후엔 로컬 캐시를 씀. model.eval()은 '학습 모드'가 아닌 '추론(사용) 모드'로 전환하는 것임 — 드롭아웃 등 학습용 기능을 꺼서 결과를 안정시킴.",
    },
    {
      step: 6,
      title: "청크 분할 요약",
      label: "청크 분할 요약",
      refs: ["summarize_chunks", "summarize"],
      summary: "summarize_chunks()가 긴 본문을 400 토큰 단위로 나눠 각 조각을 KoBART로 요약함",
      detail: "KoBART는 한 번에 처리할 수 있는 텍스트 길이가 약 1024 토큰으로 제한됨. 뉴스 본문은 대부분 이를 초과하므로, 400 토큰씩 잘라 각 조각을 따로 요약하고 결과를 이어 붙임. 책의 장을 각각 요약한 뒤 합치는 방식임. torch.no_grad()로 기울기 계산을 끄면 메모리를 절약할 수 있음.",
    },
    {
      step: 7,
      title: "결과 저장 및 출력",
      label: "결과 저장·출력",
      summary: "summary.txt에 입력 URL과 요약 결과를 저장하고, 터미널에도 출력함",
      detail: "마지막으로 저장 폴더가 없으면 만들고, 입력 URL과 요약문을 UTF-8로 파일에 씀. 터미널에도 요약 결과를 바로 보여줘 파일을 열지 않아도 확인할 수 있음.",
    },
  ],

  functions: [
    // ===== summary.py (메인) =====
    {
      id: "module_setup",
      name: "모듈 설정 (상수·인코딩)",
      fileId: "main",
      summary: "파일 맨 위에서 한글 출력 깨짐 방지, 출력 경로, 최대 토큰 수 등 기본 설정을 준비함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 준비하는 값들'임. Windows 콘솔에서 한글이 깨지지 않도록 출력 인코딩을 UTF-8로 재설정하고, 결과 파일 경로와 모델 최대 입력 토큰 수를 상수로 정의해 둠.",
      terms: ["sys.stdout.reconfigure", "Path(__file__)", "MODEL_ID"],
      lines: [
        { at: 'if hasattr(sys.stdout, "reconfigure"):', text: "윈도우 콘솔에서 한글 출력이 깨지지 않도록 stdout·stderr 인코딩을 UTF-8로 바꿈." },
        { at: 'OUTPUT_PATH = Path(__file__).parent / "summary.txt"', text: "Path(__file__).parent는 '이 파일이 든 폴더'. 거기에 summary.txt를 이어붙여 출력 경로를 고정함." },
        { at: 'MAX_INPUT_TOKENS = 1022', text: "KoBART가 한 번에 처리할 수 있는 최대 토큰 수. BOS/EOS 토큰 2개를 빼면 본문은 1022개까지 가능." },
      ],
      code:
`# Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

MODEL_ID = "gogamza/kobart-summarization"
# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
OUTPUT_PATH = Path(__file__).parent / "summary.txt"

# KoBART BART 모델 최대 입력 토큰 수 (BOS/EOS 포함 1026이므로 본문은 1022)
MAX_INPUT_TOKENS = 1022`,
    },
    {
      id: "crawl_news",
      name: "crawl_news(url)",
      fileId: "main",
      summary: "뉴스 URL에 접속해 article/p 태그에서 본문 텍스트를 추출하여 반환함.",
      how: "웹사이트는 HTML이라는 구조화된 형식으로 되어 있음. requests로 페이지를 가져오고, BeautifulSoup으로 HTML을 파싱해 필요한 태그만 골라냄. 사이트가 영문 브라우저를 막을 수 있어 User-Agent 헤더로 일반 Chrome인 척 함. 인코딩 감지는 한글 뉴스의 euc-kr 등 다양한 인코딩에 대응하기 위함임.",
      terms: ["requests", "BeautifulSoup", "HTML 파싱", "User-Agent", "인코딩(encoding)", "raise_for_status()"],
      lines: [
        { at: '"User-Agent": (', text: "User-Agent는 '어떤 프로그램이 접속하는지'를 서버에 알려주는 헤더임. Chrome 브라우저처럼 위장해 차단을 우회함." },
        { at: 'response = requests.get(url, headers=headers, timeout=15)', text: "requests.get으로 URL에 HTTP GET 요청을 보냄. timeout=15는 15초 안에 응답이 없으면 포기한다는 뜻임." },
        { at: 'response.raise_for_status()', text: "응답이 실패 상태(404, 500 등)면 오류를 발생시킴. 잘못된 응답을 그냥 쓰지 않게 하는 안전장치임." },
        { at: 'response.encoding = response.apparent_encoding', text: "한글 뉴스는 euc-kr, cp949 등 다양한 인코딩을 쓸 수 있음. apparent_encoding으로 자동 감지해 한글이 깨지지 않게 함." },
        { at: 'soup = BeautifulSoup(response.text, "html.parser")', text: "BeautifulSoup이 HTML 문자열을 파싱해 태그를 쉽게 찾을 수 있는 객체로 만들어 줌." },
        { at: 'for tag in soup(["script", "style", "nav"', text: "광고·메뉴 등 본문과 무관한 태그를 미리 제거(decompose)함. 없애지 않으면 요약에 불필요한 내용이 섞임." },
        { at: 'article = soup.find("article")', text: "article 태그가 있으면 그 안의 p 태그만 모음(뉴스 본문 영역). 없으면 페이지 전체 p 태그를 수집함." },
      ],
      code:
`def crawl_news(url: str) -> str:
    """뉴스 URL에서 본문 텍스트를 크롤링하여 반환함.
    article 태그 우선 추출, 없으면 전체 p 태그를 수집함."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }

    print(f"   - URL 요청: {url}")
    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()

    # 한글 인코딩 자동 감지 (cp949/euc-kr 대응)
    response.encoding = response.apparent_encoding

    soup = BeautifulSoup(response.text, "html.parser")

    # script, style 태그 제거
    for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
        tag.decompose()

    # article > p 태그 우선 추출, 없으면 전체 텍스트
    article = soup.find("article")
    if article:
        paragraphs = article.find_all("p")
        text = " ".join(p.get_text() for p in paragraphs)
    else:
        paragraphs = soup.find_all("p")
        text = " ".join(p.get_text() for p in paragraphs)

    if not text.strip():
        text = soup.get_text(separator=" ")

    return text`,
    },
    {
      id: "preprocess",
      name: "preprocess(text)",
      fileId: "main",
      summary: "본문 텍스트의 탭·줄바꿈·특수문자를 정리해 KoBART 입력에 적합한 깨끗한 텍스트를 반환함.",
      how: "정규표현식(re.sub)으로 세 번 훑어 텍스트를 정리함. ①탭·줄바꿈 → 공백, ②연속 공백 → 1개, ③한글·영문·숫자·기본 구두점 외 제거. 마치 원고 교정처럼 깨끗하게 다듬는 과정임.",
      terms: ["정규표현식(re.sub)", "strip()"],
      lines: [
        { at: 'text = re.sub(r"[\\t\\r\\n]+", " ", text)', text: "탭(\\t)·줄바꿈(\\n\\r)을 모두 공백 한 칸으로 바꿈. '+'는 연속으로 여러 개가 있어도 한 번에 처리함." },
        { at: 'text = re.sub(r" {2,}", " ", text)', text: "공백이 2개 이상 연속되면 1개로 줄임. {2,}은 '2번 이상 반복'을 뜻하는 정규표현식임." },
        { at: 'text = re.sub(r"[^가-힣ᄀ-ᇿ㄰-㆏a-zA-Z0-9', text: "^ 안쪽 목록에 없는 문자는 전부 제거함(부정 문자 클래스). 한글·영문·숫자·기본 구두점만 남김." },
        { at: 'return text.strip()', text: "앞뒤 공백을 최종 제거해 돌려줌." },
      ],
      code:
`def preprocess(text: str) -> str:
    """본문 텍스트의 불필요한 공백·특수문자를 정리하여 반환함.
    탭·줄바꿈 제거, 연속 공백 축소, 한글·영문·숫자·기본 구두점만 유지."""
    # 탭·줄바꿈을 공백으로 치환
    text = re.sub(r"[\\t\\r\\n]+", " ", text)
    # 연속 공백 제거
    text = re.sub(r" {2,}", " ", text)
    # 특수문자 정리 (한글·영문·숫자·기본 구두점만 유지)
    text = re.sub(r"[^가-힣ᄀ-ᇿ㄰-㆏a-zA-Z0-9\\s.,!?%\\-–—:;\\"'()\\[\\]]", "", text)
    return text.strip()`,
    },
    {
      id: "truncate_to_tokens",
      name: "truncate_to_tokens(tokenizer, text, max_tokens)",
      fileId: "main",
      summary: "토큰 수가 max_tokens를 초과하면 앞부분만 남기고 잘라 반환함. KoBART 최대 입력 초과를 막는 안전장치.",
      how: "AI 모델은 텍스트를 '토큰'이라는 조각 단위로 처리함. KoBART는 최대 1024 토큰만 받을 수 있어, 이를 초과하면 오류가 남. tokenizer.encode로 텍스트를 토큰 ID 목록으로 변환하고, 초과분을 잘라낸 뒤 다시 텍스트로 복원함.",
      terms: ["토크나이저(tokenizer)", "토큰(token)", "tokenizer.encode", "tokenizer.decode", "skip_special_tokens"],
      lines: [
        { at: 'token_ids = tokenizer.encode(text)', text: "텍스트를 토큰 ID(숫자) 목록으로 변환함. KoBART는 텍스트 그대로가 아니라 이 숫자 목록을 받음." },
        { at: 'if len(token_ids) > max_tokens:', text: "토큰 수가 한계를 넘으면 자르는 작업을 시작함. 넘지 않으면 그냥 원본을 돌려줌." },
        { at: 'token_ids = token_ids[:max_tokens]', text: "앞에서 max_tokens개만 잘라냄(파이썬 슬라이싱). 뒷부분을 버리는 것임." },
        { at: 'text = tokenizer.decode(token_ids, skip_special_tokens=True)', text: "잘린 토큰 ID를 다시 사람이 읽을 수 있는 텍스트로 복원함. skip_special_tokens=True는 BOS/EOS 같은 특수 토큰을 제외함." },
      ],
      code:
`def truncate_to_tokens(tokenizer: PreTrainedTokenizerFast, text: str, max_tokens: int) -> str:
    """토큰 수가 max_tokens를 초과할 경우 앞부분만 남겨 반환함.
    KoBART 최대 입력(1024 토큰) 초과 방지 목적."""
    token_ids = tokenizer.encode(text)
    if len(token_ids) > max_tokens:
        print(f"   - 토큰 수 {len(token_ids)} → {max_tokens}으로 truncation")
        token_ids = token_ids[:max_tokens]
        text = tokenizer.decode(token_ids, skip_special_tokens=True)
    return text`,
    },
    {
      id: "summarize",
      name: "summarize(model, tokenizer, text, device)",
      fileId: "main",
      summary: "KoBART 모델로 텍스트 한 청크를 요약하여 반환함. BOS/EOS 토큰을 직접 추가한 뒤 빔 서치로 요약문을 생성함.",
      how: "실제로 AI가 요약을 생성하는 핵심 함수임. 텍스트를 토큰으로 변환하고, 문장 시작(BOS)·끝(EOS) 토큰을 앞뒤에 붙여 모델 입력을 만듦. model.generate()가 빔 서치(num_beams=4) 방식으로 여러 후보 요약문을 동시에 탐색해 가장 좋은 것을 고름. 마지막에 KoBART의 특수기호 ▁를 공백으로 바꿔 읽기 좋게 만듦.",
      terms: ["BartForConditionalGeneration", "빔 서치(beam search)", "BOS/EOS 토큰", "torch.tensor", "model.generate", "SentencePiece"],
      lines: [
        { at: 'raw_input_ids = tokenizer.encode(text)', text: "텍스트를 토큰 ID 목록으로 변환함." },
        { at: 'input_ids = [tokenizer.bos_token_id] + raw_input_ids + [tokenizer.eos_token_id]', text: "KoBART는 입력 앞에 BOS(문장 시작), 뒤에 EOS(문장 끝) 토큰이 필요함. 직접 붙여줌." },
        { at: 'input_tensor = torch.tensor([input_ids]).to(device)', text: "파이썬 리스트를 PyTorch 텐서로 변환하고 GPU/CPU로 보냄. [...]로 감싸 배치 차원을 추가함." },
        { at: 'summary_ids = model.generate(', text: "★핵심★ model.generate()가 요약문 토큰을 순차적으로 생성함. 빔 서치로 여러 후보를 동시에 탐색함." },
        { at: 'num_beams=4,', text: "빔 너비 4: 동시에 4개의 후보 요약문을 탐색함. 클수록 품질이 높지만 느려짐." },
        { at: 'length_penalty=2.0,', text: "길이 패널티 2.0: 더 긴 요약문을 선호하게 만드는 조정값임. 너무 짧은 요약을 방지함." },
        { at: 'no_repeat_ngram_size=3,', text: "3단어가 연속으로 반복되지 않게 막음. 같은 문장이 반복되는 현상을 방지함." },
        { at: 'decoded = tokenizer.decode(summary_ids.squeeze().tolist(), skip_special_tokens=True)', text: "생성된 토큰 ID를 텍스트로 복원함. squeeze()는 불필요한 차원을 제거, tolist()로 파이썬 리스트로 바꿈." },
        { at: 'return decoded.replace("▁", " ").strip()', text: "KoBART의 SentencePiece 토크나이저가 단어 경계에 붙이는 ▁ 기호를 공백으로 바꿔 자연스럽게 만듦." },
      ],
      code:
`def summarize(model: BartForConditionalGeneration, tokenizer: PreTrainedTokenizerFast, text: str, device: str) -> str:
    """KoBART 모델로 텍스트 1개 청크를 요약하여 반환함.
    BOS/EOS 토큰을 직접 추가한 뒤 beam search로 요약문을 생성함."""
    raw_input_ids = tokenizer.encode(text)
    input_ids = [tokenizer.bos_token_id] + raw_input_ids + [tokenizer.eos_token_id]
    input_tensor = torch.tensor([input_ids]).to(device)

    # 모델이 입력 토큰을 받아 요약 토큰 시퀀스를 순차적으로 생성함
    summary_ids = model.generate(
        input_tensor,
        max_length=256,
        num_beams=4,
        length_penalty=2.0,
        early_stopping=True,
        no_repeat_ngram_size=3,
    )

    decoded = tokenizer.decode(summary_ids.squeeze().tolist(), skip_special_tokens=True)
    # KoBART SentencePiece ▁ 기호를 공백으로 변환
    return decoded.replace("▁", " ").strip()`,
    },
    {
      id: "summarize_chunks",
      name: "summarize_chunks(model, tokenizer, text, device, chunk_size)",
      fileId: "main",
      summary: "긴 본문을 chunk_size 토큰 단위로 나눠 각 조각을 KoBART로 요약하고 이어붙여 반환함.",
      how: "KoBART가 한 번에 처리할 수 있는 길이 제한을 극복하는 방법임. 전체 텍스트를 토큰으로 바꾸고 400개씩 자른 뒤, 각 조각을 summarize()로 독립적으로 요약한 다음 결과를 공백으로 이어 붙임. 예: 1200 토큰 본문 → 3개 청크 → 3개 요약 → 하나로 합침.",
      terms: ["리스트 컴프리헨션", "토크나이저(tokenizer)", "토큰(token)", "청크(chunk)"],
      lines: [
        { at: 'token_ids = tokenizer.encode(text)', text: "전체 텍스트를 한 번에 토큰 ID 목록으로 변환함." },
        { at: 'chunks = [token_ids[i : i + chunk_size] for i in range(0, total, chunk_size)]', text: "range(0, total, chunk_size)로 0, 400, 800... 씩 건너뛰며 400개씩 자름(리스트 컴프리헨션)." },
        { at: 'chunk_text = tokenizer.decode(chunk, skip_special_tokens=True).replace("▁", " ").strip()', text: "각 청크 토큰을 다시 텍스트로 복원함. ▁ 기호도 공백으로 바꿈." },
        { at: 'summaries.append(summarize(model, tokenizer, chunk_text, device))', text: "각 청크를 summarize()로 요약하고 목록에 추가함." },
        { at: 'return " ".join(summaries)', text: "모든 청크 요약을 공백으로 이어붙여 최종 요약문 하나로 만들어 돌려줌." },
      ],
      code:
`def summarize_chunks(
    model: BartForConditionalGeneration,
    tokenizer: PreTrainedTokenizerFast,
    text: str,
    device: str,
    chunk_size: int = 400,
) -> str:
    """텍스트를 chunk_size 토큰 단위로 분할하여 청크별 요약을 이어붙여 반환함.
    전체 본문을 chunk_size 토큰 단위로 나눠 각 청크를 독립적으로 요약하고
    결과를 이어 붙여 긴 요약문을 생성함."""
    token_ids = tokenizer.encode(text)
    total = len(token_ids)
    chunks = [token_ids[i : i + chunk_size] for i in range(0, total, chunk_size)]
    print(f"   - 전체 토큰: {total}, 청크 수: {len(chunks)} (청크 크기: {chunk_size})")

    summaries = []
    for i, chunk in enumerate(chunks):
        chunk_text = tokenizer.decode(chunk, skip_special_tokens=True).replace("▁", " ").strip()
        if not chunk_text:
            continue
        print(f"   - 청크 {i + 1}/{len(chunks)} 요약 중...")
        summaries.append(summarize(model, tokenizer, chunk_text, device))

    return " ".join(summaries)`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "전체 작업을 순서대로 지휘하는 진입점. URL → 크롤링 → 전처리 → 모델 로드 → 요약 → 저장.",
      how: "프로그램의 '지휘자'임. argparse로 --url 옵션을 받고, 크롤링 → 전처리 → 디바이스 설정 → 모델 로드 → 청크 요약 → 파일 저장 순으로 차례로 실행함. torch.no_grad()로 기울기 계산을 끄면 추론 시 메모리를 절약할 수 있음.",
      terms: ["argparse", "if __name__", "torch.no_grad()", "torch.cuda.is_available()", "PreTrainedTokenizerFast", "BartForConditionalGeneration", "with open(rb)", "sys.exit"],
      lines: [
        { at: 'parser = argparse.ArgumentParser(description="KoBART 뉴스 URL 요약기")', text: "argparse 파서를 만들어 --url 같은 명령줄 옵션을 정의·해석하는 표준 도구임." },
        { at: 'parser.add_argument("--url", required=True', text: "--url 옵션: 반드시 입력해야 하는 필수 인자(required=True). 없으면 오류를 냄." },
        { at: 'raw_text = crawl_news(args.url)', text: "1단계: crawl_news()로 뉴스 URL에서 본문 텍스트를 가져옴." },
        { at: 'clean_text = preprocess(raw_text)', text: "2단계: preprocess()로 텍스트를 깨끗하게 정리함." },
        { at: 'device = "cuda" if torch.cuda.is_available() else "cpu"', text: "GPU(CUDA)가 있으면 'cuda', 없으면 'cpu'. AI 모델 계산은 GPU가 훨씬 빠름." },
        { at: 'tokenizer = PreTrainedTokenizerFast.from_pretrained(MODEL_ID)', text: "HuggingFace Hub에서 KoBART 토크나이저를 가져옴. 처음엔 다운로드, 이후엔 캐시 사용." },
        { at: 'model = BartForConditionalGeneration.from_pretrained(MODEL_ID)', text: "KoBART 요약 모델을 로드함. 약 500MB 파일이며 처음 실행 시 다운로드됨." },
        { at: 'model.eval()', text: "모델을 추론 모드로 전환함. 드롭아웃 등 학습용 기능을 꺼서 결과를 안정시킴." },
        { at: 'with torch.no_grad():', text: "기울기 계산을 비활성화함. 추론(사용)할 때는 학습이 필요 없으므로 메모리를 아낄 수 있음." },
        { at: 'with open(OUTPUT_PATH, "w", encoding="utf-8") as f:', text: "결과 파일을 UTF-8로 열어 씀. with 블록을 벗어나면 파일이 자동으로 닫힘." },
      ],
      code:
`def main():
    """메인 실행 함수: URL 크롤링 → 전처리 → 모델 로드 → 청크 요약 → 저장."""
    parser = argparse.ArgumentParser(description="KoBART 뉴스 URL 요약기")
    parser.add_argument("--url", required=True, help="요약할 뉴스 기사 URL")
    args = parser.parse_args()

    print("=" * 60)
    print("KoBART 뉴스 요약 예제")
    print("=" * 60)
    print(f"모델: {MODEL_ID}")
    print(f"입력 URL: {args.url}")
    print(f"출력 파일: {OUTPUT_PATH}")
    print("=" * 60)

    # 1. 뉴스 본문 크롤링
    print("\\n1. 뉴스 본문 크롤링 중...")
    raw_text = crawl_news(args.url)
    print(f"   - 크롤링 완료: {len(raw_text)} 문자")

    # 2. 전처리
    print("\\n2. 텍스트 전처리 중...")
    clean_text = preprocess(raw_text)
    print(f"   - 전처리 완료: {len(clean_text)} 문자")

    if not clean_text:
        print("오류: 본문 텍스트를 추출할 수 없습니다.")
        sys.exit(1)

    # 3. 디바이스 설정
    # GPU(CUDA) 사용 가능 여부 확인. 불가능하면 CPU 사용
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\\n3. 디바이스: {device}")

    # 4. 모델 로드
    print("\\n4. 모델 로딩 중... (처음 실행 시 다운로드 필요, 약 500MB)")
    # PreTrainedTokenizerFast: 텍스트를 KoBART가 처리할 수 있는 토큰 배열로 변환하는 고속 토크나이저
    tokenizer = PreTrainedTokenizerFast.from_pretrained(MODEL_ID)
    # BartForConditionalGeneration: 입력 시퀀스를 받아 요약문 시퀀스를 생성하는 seq2seq 모델
    model = BartForConditionalGeneration.from_pretrained(MODEL_ID)
    model = model.to(device)
    model.eval()
    print("   - 모델 로드 완료!")

    # 5. 요약 생성 (청크 분할)
    print("\\n5. 청크 분할 요약 중...")
    # torch.no_grad(): 추론 시 기울기 계산을 비활성화하여 메모리 절약
    with torch.no_grad():
        summary = summarize_chunks(model, tokenizer, clean_text, device)

    # 6. 결과 저장
    print("\\n6. 결과 저장 중...")
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    # with 블록을 벗어나면 파일이 자동으로 닫힘
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(f"[입력 URL]\\n{args.url}\\n\\n")
        f.write(f"[요약 결과]\\n{summary}\\n")
    print(f"   - 저장 완료: {OUTPUT_PATH}")

    # 7. 결과 출력
    print("\\n" + "=" * 60)
    print("요약 결과")
    print("=" * 60)
    print(summary)
    print("=" * 60)
    print("\\n완료!")


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()`,
    },
  ],

  glossary: {
    "sys.stdout.reconfigure": "콘솔(터미널) 출력의 글자 인코딩을 바꾸는 기능. 윈도우에서 한글이 깨지지 않도록 UTF-8로 다시 설정함.",
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .parent를 붙이면 이 파일이 든 폴더의 경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "MODEL_ID": "HuggingFace Hub의 모델 이름(경로). 'gogamza/kobart-summarization'처럼 '소유자/모델명' 형식으로 적음. from_pretrained()에 이 값을 주면 자동으로 다운로드·로드함.",
    "requests": "파이썬에서 인터넷 주소로 요청을 보내고 응답을 받는 대표적인 라이브러리(HTTP 통신 도구).",
    "BeautifulSoup": "HTML/XML 문서를 파싱해 원하는 태그·텍스트를 쉽게 찾을 수 있게 해주는 라이브러리. 웹 크롤링에 자주 쓰임.",
    "HTML 파싱": "HTML 문자열을 분석해 태그 구조를 이해할 수 있는 형태로 변환하는 과정. BeautifulSoup이 이 역할을 담당함.",
    "User-Agent": "HTTP 요청 시 '어떤 프로그램이 접속하는지'를 서버에 알려주는 헤더. 브라우저처럼 위장해 차단을 우회할 때 씀.",
    "인코딩(encoding)": "텍스트를 컴퓨터가 저장·전송할 수 있는 숫자로 변환하는 방식. 한글은 UTF-8, euc-kr 등 여러 인코딩이 있어 맞지 않으면 글자가 깨짐.",
    "raise_for_status()": "인터넷 응답이 실패(예: 404 없음, 500 서버오류)면 오류를 발생시키는 점검 장치. 잘못된 응답을 그냥 쓰지 않게 함.",
    "정규표현식(re.sub)": "텍스트에서 특정 패턴을 찾아 바꾸는 도구. re.sub(패턴, 바꿀것, 원본)으로 씀. [\\t\\r\\n]처럼 특수기호로 복잡한 패턴을 표현함.",
    "strip()": "문자열 앞뒤의 공백(스페이스·줄바꿈)을 제거하는 파이썬 기본 메서드.",
    "토크나이저(tokenizer)": "텍스트를 AI 모델이 처리할 수 있는 숫자(토큰 ID) 목록으로 변환하거나, 반대로 복원하는 도구. 각 모델마다 고유한 토크나이저를 씀.",
    "토큰(token)": "AI 모델이 텍스트를 처리하는 기본 단위. 단어 하나가 1개 또는 여러 토큰이 될 수 있음. KoBART는 최대 1024 토큰까지 처리함.",
    "tokenizer.encode": "텍스트 → 토큰 ID 숫자 목록으로 변환하는 함수. AI 모델에 텍스트를 주기 전에 반드시 거침.",
    "tokenizer.decode": "토큰 ID 숫자 목록 → 텍스트로 복원하는 함수. 모델이 생성한 결과를 사람이 읽을 수 있게 변환함.",
    "skip_special_tokens": "decode 시 BOS/EOS 같은 특수 제어 토큰을 결과 텍스트에서 제외하는 옵션. True로 주면 깔끔한 텍스트만 남음.",
    "BartForConditionalGeneration": "BART 기반의 텍스트-투-텍스트 생성 모델 클래스. 요약·번역 등 입력을 받아 다른 텍스트를 생성하는 seq2seq 모델에 사용함.",
    "빔 서치(beam search)": "여러 후보 문장을 동시에 탐색하며 가장 좋은 것을 고르는 생성 전략. num_beams=4면 4개 후보를 동시에 탐색함. 무작위로 한 가지만 택하는 것보다 품질이 좋음.",
    "BOS/EOS 토큰": "BOS(Beginning Of Sentence): 문장 시작 신호, EOS(End Of Sentence): 문장 끝 신호. 모델이 입력의 시작과 끝을 인식하기 위한 특수 기호임.",
    "torch.tensor": "파이썬 리스트를 PyTorch가 연산할 수 있는 텐서(다차원 배열) 객체로 변환하는 함수. AI 모델은 텐서를 입력으로 받음.",
    "model.generate": "AI 모델이 출력 토큰을 순차적으로 생성하는 메서드. max_length·num_beams 등의 옵션으로 생성 방식을 제어함.",
    "SentencePiece": "구글이 만든 서브워드 토크나이저 라이브러리. KoBART가 사용하며, 단어 경계에 ▁ 기호를 붙임. 결과 텍스트에서 이 기호를 공백으로 바꿔야 자연스럽게 읽힘.",
    "리스트 컴프리헨션": "[표현식 for 항목 in 목록 if 조건] 형태로, 반복문을 한 줄로 짧게 써서 새 목록을 만드는 파이썬 문법.",
    "청크(chunk)": "긴 데이터를 일정 크기로 잘라낸 조각. 모델 입력 한계를 넘는 텍스트를 처리할 때 쓰는 방법임.",
    "argparse": "'python 파일.py --옵션 값' 형태의 명령줄 입력을 정의하고 해석해 주는 파이썬 표준 도구.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
    "torch.no_grad()": "with torch.no_grad(): 블록 안에서는 기울기(gradient) 계산을 하지 않음. 추론(모델 사용)할 때는 학습이 불필요하므로 메모리를 절약하기 위해 씀.",
    "torch.cuda.is_available()": "컴퓨터에 CUDA GPU가 있는지 확인하는 함수. True면 GPU, False면 CPU를 사용함.",
    "PreTrainedTokenizerFast": "HuggingFace Transformers 라이브러리의 고속 토크나이저 클래스. Rust로 구현되어 일반 토크나이저보다 빠름. from_pretrained()로 모델에 맞는 토크나이저를 불러옴.",
    "with open(rb)": "with 블록으로 파일을 열면, 블록을 벗어날 때 파일이 자동으로 닫힘. 여기서는 'w'(쓰기), 'utf-8' 인코딩으로 결과를 저장함.",
    "sys.exit": "프로그램을 즉시 종료하는 함수. sys.exit(1)은 '오류로 종료', sys.exit(0)은 '정상 종료'를 의미함.",
  },
};
