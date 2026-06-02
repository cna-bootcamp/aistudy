/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../03.summary/exaone/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "EXAONE 로컬 LLM 텍스트 요약 예제 설명",
    entry: "summary.py",
  },

  files: [
    { id: "main", label: "summary.py", role: "단일 파일 · 로컬 LLM(EXAONE)으로 마크다운 문서를 한국어 요약" },
  ],

  flow: [
    {
      step: 1,
      title: "실행 시작",
      summary: "main()이 진입점으로 호출되어 입출력 경로·모델 이름을 준비함",
      detail: "프로그램의 '시작 버튼'이 main() 함수임. 이 파일이 있는 폴더를 기준으로 입력 파일(result_Docling.md)과 출력 파일(summary.txt) 경로를 자동으로 계산하고, 사용할 모델 이름을 정해 둠.",
    },
    {
      step: 2,
      title: "입력 파일 읽기",
      summary: "load_input_file()이 여러 인코딩을 순서대로 시도해 마크다운 문서를 읽음",
      detail: "파일을 읽을 때 '어떤 글자 방식(인코딩)인지' 모르는 경우가 많음. UTF-8부터 cp949 등을 차례로 시도해, 처음 성공한 인코딩으로 내용을 읽음. 마치 자물쇠를 모를 때 열쇠를 하나씩 끼워보는 것과 같음.",
    },
    {
      step: 3,
      title: "디바이스 확인",
      summary: "GPU(CUDA)를 쓸 수 있으면 cuda, 없으면 cpu로 디바이스를 정함",
      detail: "AI 모델 계산을 GPU에서 하면 CPU보다 수십 배 빠름. torch.cuda.is_available()로 GPU 사용 가능 여부를 확인하고, 불가능하면 CPU를 사용함. 어느 환경에서든 동작하도록 자동으로 선택함.",
    },
    {
      step: 4,
      title: "모델 로드",
      summary: "AutoTokenizer·AutoModelForCausalLM으로 EXAONE 모델을 로컬에 내려받아 메모리에 올림",
      detail: "모델을 처음 실행하면 인터넷에서 자동으로 다운로드함(수 GB). 이후 실행부터는 캐시에서 빠르게 불러옴. GPU가 있으면 float16(메모리 절약), CPU면 float32(정확도 우선)로 로드함.",
    },
    {
      step: 5,
      title: "요약 프롬프트 생성",
      summary: "create_summary_prompt()가 문서 내용을 감싼 '요약 요청 지침서'를 만듦",
      detail: "AI에게 '이 문서를 이런 항목으로 요약해줘'라고 부탁하는 편지를 작성하는 단계임. 회사 개요·핵심 가치·실적 등 요약해야 할 항목을 미리 정해 프롬프트(요청문)에 담음.",
    },
    {
      step: 6,
      title: "Chat 템플릿 적용 및 토큰화",
      summary: "tokenizer.apply_chat_template()으로 대화 형식을 만들고, 텍스트를 숫자 배열(토큰)로 변환함",
      detail: "EXAONE은 '사용자와 AI의 대화 형식'을 기대함. apply_chat_template()이 프롬프트를 이 대화 형식으로 바꾸고, tokenizer()가 텍스트를 모델이 이해하는 숫자 배열(토큰)로 변환함. 모델에게 보내기 직전의 '번역 작업'임.",
    },
    {
      step: 7,
      title: "텍스트 생성(요약)",
      summary: "model.generate()가 입력 토큰을 이어받아 요약 텍스트를 새 토큰으로 순서대로 생성함",
      detail: "AI 모델이 실제로 요약을 만드는 핵심 단계임. model.generate()는 다음에 올 가능성이 높은 토큰을 하나씩 이어 붙여 문장을 완성함. temperature·top_k·top_p 등 설정값이 '창의성'과 '일관성'의 균형을 조절함.",
    },
    {
      step: 8,
      title: "토큰 디코딩",
      summary: "생성된 숫자 배열(토큰)을 다시 읽을 수 있는 문자열로 변환함",
      detail: "모델이 만든 것은 숫자 배열임. tokenizer.decode()가 이 숫자들을 한국어 텍스트로 되돌려줌. 입력으로 넣은 토큰은 제외하고 새로 생성된 토큰만 디코딩함.",
    },
    {
      step: 9,
      title: "결과 저장 및 출력",
      summary: "save_output_file()이 요약 결과를 summary.txt에 저장하고, 화면에도 출력함",
      detail: "완성된 요약을 파일로 보관하는 단계임. 저장 폴더가 없으면 자동으로 만들고, UTF-8로 저장해 한글이 깨지지 않게 함. 화면에도 결과를 출력해 즉시 확인할 수 있음.",
    },
  ],

  functions: [
    {
      id: "load_input_file",
      name: "load_input_file(input_path)",
      fileId: "main",
      summary: "여러 인코딩을 순서대로 시도해 파일을 읽어 내용을 반환함. 한글 파일의 인코딩이 달라도 잘 동작함.",
      how: "파일을 읽을 때 인코딩이 맞지 않으면 글자가 깨짐. 이 함수는 utf-8, cp949, euc-kr, latin-1 순서로 시도해 처음 성공하면 그 내용을 반환함. 모두 실패하면 utf-8로 강제 읽어 손실 가능성을 알려줌. try/except로 실패해도 멈추지 않고 다음 인코딩을 시도하는 것이 핵심임.",
      terms: ["인코딩(encoding)", "예외 처리(try/except)", "with open(rb)", "타입 힌트"],
      lines: [
        { at: 'encodings = ["utf-8", "cp949"', text: "시도할 인코딩 목록을 순서대로 정해둠. UTF-8이 가장 흔하므로 맨 먼저 시도함." },
        { at: 'for encoding in encodings:', text: "인코딩 목록을 하나씩 꺼내 순서대로 시도함." },
        { at: 'with open(input_path, "r", encoding=encoding) as f:', text: "with 블록으로 파일을 열면 블록을 벗어날 때 파일이 자동으로 닫힘. 'r'은 읽기 모드임." },
        { at: 'except UnicodeDecodeError:', text: "인코딩이 맞지 않아 글자를 해석하지 못하면 UnicodeDecodeError가 남. continue로 다음 인코딩을 시도함." },
        { at: 'with open(input_path, "r", encoding="utf-8", errors="ignore")', text: "모든 인코딩이 실패하면 utf-8로 읽되, 해석 못하는 글자는 그냥 버림(errors='ignore')." },
      ],
      code:
`def load_input_file(input_path: str) -> str:
    """입력 파일을 읽어 내용을 반환함. 여러 인코딩을 순차적으로 시도하여 한글 호환성 확보."""
    encodings = ["utf-8", "cp949", "euc-kr", "latin-1"]

    for encoding in encodings:
        try:
            # with 블록을 벗어나면 파일이 자동으로 닫힘
            with open(input_path, "r", encoding=encoding) as f:
                content = f.read()
                print(f"   - 인코딩: {encoding}")
                return content
        except UnicodeDecodeError:
            continue

    with open(input_path, "r", encoding="utf-8", errors="ignore") as f:
        print("   - 인코딩: utf-8 (일부 문자 손실 가능)")
        return f.read()`,
    },
    {
      id: "save_output_file",
      name: "save_output_file(output_path, content)",
      fileId: "main",
      summary: "결과 문자열을 UTF-8로 파일에 저장함. 저장할 폴더가 없으면 자동으로 만듦.",
      how: "os.path.dirname()으로 저장 폴더 경로를 꺼내고, os.makedirs()로 폴더를 만듦. exist_ok=True를 쓰면 폴더가 이미 있어도 오류가 나지 않음. UTF-8로 저장해 한글이 깨지지 않게 함.",
      terms: ["os.makedirs", "with open(rb)", "인코딩(encoding)", "f-string"],
      lines: [
        { at: 'output_dir = os.path.dirname(output_path)', text: "저장 경로에서 '폴더 부분'만 꺼냄. 예: '/a/b/out.txt' → '/a/b'" },
        { at: 'os.makedirs(output_dir, exist_ok=True)', text: "폴더가 없으면 만들고, 이미 있어도(exist_ok=True) 오류 없이 넘어감." },
        { at: 'with open(output_path, "w", encoding="utf-8") as f:', text: "'w'는 쓰기 모드. UTF-8로 저장해 한글 깨짐을 방지함." },
        { at: 'f.write(content)', text: "준비한 문자열을 파일에 통째로 씀." },
      ],
      code:
`def save_output_file(output_path: str, content: str) -> None:
    """결과 파일을 UTF-8로 저장함. 출력 디렉터리가 없으면 자동 생성."""
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)`,
    },
    {
      id: "create_summary_prompt",
      name: "create_summary_prompt(text)",
      fileId: "main",
      summary: "문서 내용을 받아, AI에게 요약을 부탁하는 프롬프트(지시문)를 만들어 반환함.",
      how: "AI가 요약을 잘 하려면 '무엇을, 어떻게 정리해줘'라는 구체적인 지침이 필요함. 회사 개요·핵심 가치·실적·팀 구성원·교육 내용 5가지를 요구 항목으로 나열하고, 문서 내용을 그 안에 끼워 넣어 완성된 요청문을 만듦. f-string을 이용해 text 변수를 문자열 안에 자연스럽게 삽입함.",
      terms: ["f-string", "프롬프트(prompt)"],
      lines: [
        { at: 'return f"""다음 문서를 읽고', text: "f-string 삼중 따옴표로 여러 줄짜리 프롬프트를 만듦. {text} 자리에 실제 문서 내용이 들어감." },
      ],
      code:
`def create_summary_prompt(text: str) -> str:
    """요약 항목(회사 개요, 핵심 가치 등)을 포함한 요약 요청 프롬프트를 생성함."""
    return f"""다음 문서를 읽고 핵심 내용을 한국어로 요약해 주세요.

요약 요구사항:
1. 회사 개요 (회사명, 설립일, 주요 사업)
2. 핵심 가치와 행동 원칙
3. 주요 수행 실적
4. 팀 구성원 정보
5. 교육 프로그램의 주요 내용과 기대효과

문서 내용:
{text}

---
위 문서의 요약:"""`,
    },
    {
      id: "summarize_text",
      name: "summarize_text(model, tokenizer, text, max_new_tokens)",
      fileId: "main",
      summary: "EXAONE 모델에 프롬프트를 넣어 요약 텍스트를 생성하고 반환함. 토큰화→생성→디코딩 전 과정을 담당함.",
      how: "①프롬프트를 만들고 → ②chat 템플릿을 적용해 대화 형식으로 바꾸고 → ③tokenizer로 숫자 배열(토큰)로 변환하고 → ④model.generate()로 새 토큰을 생성하고 → ⑤입력 토큰을 제외한 생성 토큰만 디코딩해 문자열로 돌려줌. temperature·top_k·top_p는 '창의성'을 조절하는 설정임.",
      terms: ["토크나이저(tokenizer)", "토큰(token)", "apply_chat_template", "model.generate()", "temperature", "top_k", "top_p", "AutoModelForCausalLM", "AutoTokenizer", "attention_mask", "pad_token_id", "repetition_penalty"],
      lines: [
        { at: 'messages = [{"role": "user", "content": prompt}]', text: "프롬프트를 '사용자 메시지' 형식으로 담음. EXAONE은 대화 형식을 기대하므로 role/content 구조가 필요함." },
        { at: 'formatted_prompt = tokenizer.apply_chat_template(', text: "apply_chat_template이 메시지 목록을 EXAONE이 기대하는 대화 형식 문자열로 변환함." },
        { at: 'enable_thinking=False,', text: "enable_thinking=False: EXAONE 4.0의 '추론 모드'를 끔. 켜면 모델이 추론 과정을 길게 출력해 요약이 느려짐." },
        { at: 'model_inputs = tokenizer(', text: "tokenizer()가 대화 형식 문자열을 모델이 처리할 숫자 배열(토큰)로 변환함. return_tensors='pt'는 PyTorch 텐서로 받겠다는 뜻." },
        { at: ').to(model.device)', text: "모델이 올라간 장치(GPU/CPU)로 입력 데이터를 이동함. 모델과 입력이 같은 장치에 있어야 계산 가능함." },
        { at: 'generated_ids = model.generate(', text: "★핵심★ 모델이 입력 토큰을 이어받아 새 토큰을 하나씩 예측하며 요약 텍스트를 생성함." },
        { at: 'temperature=0.1,  # 한국어 요약 일관성', text: "temperature=0.1: 낮을수록 '일관되고 예측 가능한' 출력. 여기서는 한영 혼용 방지를 위해 낮게 설정함." },
        { at: 'generated_ids = generated_ids[:, model_inputs.input_ids.shape[1]:]', text: "입력으로 넣은 토큰 수만큼 앞부분을 잘라냄. 새로 생성된 요약 토큰만 남김." },
        { at: 'response = tokenizer.decode(generated_ids[0], skip_special_tokens=True)', text: "숫자 배열(토큰)을 다시 한국어 텍스트로 변환함. skip_special_tokens=True는 [EOS] 같은 특수 기호를 제거함." },
      ],
      code:
`def summarize_text(
    model: AutoModelForCausalLM,
    tokenizer: AutoTokenizer,
    text: str,
    max_new_tokens: int = 4096,
) -> str:
    """EXAONE 모델로 입력 텍스트를 요약하여 반환함."""
    prompt = create_summary_prompt(text)

    # Chat 템플릿 적용 (EXAONE 4.0은 Instruction-tuned 모델, reasoning 모드 비활성화)
    messages = [{"role": "user", "content": prompt}]
    # 모델이 기대하는 대화 형식(chat template)으로 프롬프트를 변환함
    formatted_prompt = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
        enable_thinking=False,
    )

    # 토큰화 (attention_mask 명시적 반환)
    model_inputs = tokenizer(
        formatted_prompt,
        return_tensors="pt",
        return_attention_mask=True,
    ).to(model.device)

    print("요약 생성 중...")
    # 모델이 입력 토큰을 이어받아 새 토큰을 순차적으로 생성함
    generated_ids = model.generate(
        model_inputs.input_ids,
        attention_mask=model_inputs.attention_mask,
        max_new_tokens=max_new_tokens,
        do_sample=True,
        temperature=0.1,  # 한국어 요약 일관성 (한영 섞임 방지)
        top_k=50,
        top_p=0.95,
        pad_token_id=tokenizer.eos_token_id,
        repetition_penalty=1.1,
    )

    # 입력 토큰 제외, 생성 토큰만 추출
    generated_ids = generated_ids[:, model_inputs.input_ids.shape[1]:]
    response = tokenizer.decode(generated_ids[0], skip_special_tokens=True)

    return response`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "전체 작업을 순서대로 지휘하는 진입점. 파일 읽기→디바이스 확인→모델 로드→요약 생성→저장.",
      how: "프로그램의 '지휘자'임. Path(__file__).parent로 이 파일이 있는 폴더를 기준으로 경로를 잡음. GPU 여부에 따라 float16/float32로 모델을 다르게 로드함. 요약 결과를 파일로 저장하고 화면에도 출력함.",
      terms: ["Path(__file__)", "AutoTokenizer", "AutoModelForCausalLM", "CUDA", "float16 / float32", "device_map", "if __name__"],
      lines: [
        { at: 'base_dir = Path(__file__).parent', text: "Path(__file__)은 '이 파일 자체'. .parent로 이 파일이 있는 폴더 경로를 구함. 어디서 실행해도 경로가 맞음." },
        { at: 'model_id = "LGAI-EXAONE/EXAONE-4.0-1.2B"', text: "Hugging Face Hub에 올라간 모델의 이름. 처음 실행 시 이 이름으로 자동 다운로드됨." },
        { at: 'device = "cuda" if torch.cuda.is_available() else "cpu"', text: "GPU(CUDA)를 쓸 수 있으면 'cuda', 없으면 'cpu'. GPU가 있으면 수십 배 빠름." },
        { at: 'tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)', text: "AutoTokenizer가 모델에 맞는 토크나이저를 자동으로 선택·다운로드함. trust_remote_code=True는 모델 제공자의 커스텀 코드를 허용함." },
        { at: 'if device == "cuda":', text: "GPU 사용 가능 시 float16으로 메모리를 절약. CPU는 float32로 정확도를 우선함." },
        { at: 'dtype=torch.float16,', text: "float16: 소수점 정밀도를 낮춰 GPU 메모리 사용량을 절반으로 줄임. CPU에서는 지원이 불안정해 float32를 씀." },
        { at: '# 사용 가능한 GPU에 모델 레이어를 자동으로 분산 배치함', text: "device_map='auto': 사용 가능한 GPU에 모델 레이어를 자동으로 분산 배치함. GPU가 여러 개여도 알아서 분배함." },
        { at: 'summary = summarize_text(model, tokenizer, input_text)', text: "모델·토크나이저·입력 텍스트를 넘겨 요약을 생성함. 실제 AI 추론이 이 한 줄에서 일어남." },
        { at: 'save_output_file(str(output_path), summary)', text: "요약 결과를 summary.txt에 저장함." },
      ],
      code:
`def main():
    """메인 실행 함수: 파일 로드 → 모델 로드 → 요약 생성 → 결과 저장 순서로 수행."""
    # 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
    base_dir = Path(__file__).parent
    input_path = base_dir / "result_Docling.md"
    output_path = base_dir / "summary.txt"

    model_id = "LGAI-EXAONE/EXAONE-4.0-1.2B"

    print("=" * 60)
    print("EXAONE-4.0-1.2B 텍스트 요약 예제")
    print("=" * 60)
    print(f"모델: {model_id}")
    print(f"입력 파일: {input_path}")
    print(f"출력 파일: {output_path}")
    print("=" * 60)

    # 1. 입력 파일 확인
    if not input_path.exists():
        raise FileNotFoundError(f"입력 파일을 찾을 수 없습니다: {input_path}")

    # 2. 입력 파일 읽기
    print("\\n1. 입력 파일 읽는 중...")
    input_text = load_input_file(str(input_path))
    print(f"   - 문서 길이: {len(input_text)} 문자")

    # 3. 디바이스 설정
    # GPU(CUDA) 사용 가능 여부 확인. 불가능하면 CPU 사용
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\\n2. 디바이스: {device}")

    # 4. 모델 로드 (transformers >= 4.54.0 필요, dtype 사용)
    print("\\n3. 모델 로딩 중... (처음 실행 시 다운로드 필요)")
    # AutoTokenizer: 텍스트를 모델이 처리할 수 있는 숫자(토큰) 배열로 변환하는 도구
    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)

    if device == "cuda":
        # GPU: float16으로 메모리 절약
        # AutoModelForCausalLM: 텍스트 생성(다음 토큰 예측) 전용 언어 모델을 자동으로 선택·로드함
        model = AutoModelForCausalLM.from_pretrained(
            model_id,
            dtype=torch.float16,
            # 사용 가능한 GPU에 모델 레이어를 자동으로 분산 배치함
            device_map="auto",
            trust_remote_code=True,
        )
    else:
        # CPU: float32 (정확도 우선)
        model = AutoModelForCausalLM.from_pretrained(
            model_id,
            dtype=torch.float32,
            device_map="auto",
            trust_remote_code=True,
        )
    print("   - 모델 로드 완료!")

    # 5. 요약 생성
    print("\\n4. 요약 생성 중...")
    summary = summarize_text(model, tokenizer, input_text)

    # 6. 결과 저장
    print("\\n5. 결과 저장 중...")
    save_output_file(str(output_path), summary)
    print(f"   - 저장 완료: {output_path}")

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
    "인코딩(encoding)": "글자를 컴퓨터가 저장하는 숫자로 바꾸는 방식. UTF-8·cp949 등 방식이 여러 가지라, 파일을 쓸 때와 읽을 때 방식이 다르면 글자가 깨짐.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "with open(rb)": "with 블록으로 파일을 열면, 블록을 벗어날 때 파일이 자동으로 닫힘. 수동으로 close()를 부를 필요가 없어 안전함.",
    "타입 힌트": "변수나 함수에 '이건 문자열(str)이야, 결과는 정수(int)야'처럼 자료의 종류를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "os.makedirs": "폴더를 만드는 함수. parents=True를 주면 중간 폴더까지, exist_ok=True를 주면 이미 있어도 오류 없이 넘어감.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
    "프롬프트(prompt)": "AI 모델에게 '이렇게 해줘'라고 입력하는 지시문. 구체적이고 명확할수록 원하는 결과를 얻기 쉬움.",
    "토크나이저(tokenizer)": "텍스트(글자)를 AI 모델이 이해하는 숫자 배열(토큰)로 바꾸거나, 반대로 토큰을 글자로 되돌리는 도구.",
    "토큰(token)": "AI 모델이 처리하는 텍스트의 최소 단위. 영어는 단어나 단어 조각, 한국어는 음절·형태소 등으로 나뉨. '안녕하세요'가 여러 개의 토큰으로 나뉠 수 있음.",
    "apply_chat_template": "메시지 목록(role/content)을 특정 모델이 기대하는 대화 형식 문자열로 변환하는 토크나이저 메서드. 모델마다 형식이 달라 이 함수가 알맞은 형식을 자동으로 적용함.",
    "model.generate()": "AI 모델이 입력 토큰에 이어 새 토큰을 하나씩 예측·추가하며 텍스트를 생성하는 메서드. 이 한 줄이 실제 AI 추론을 수행함.",
    "temperature": "AI 답변의 '창의성/무작위성' 정도(보통 0~1). 0에 가까울수록 매번 비슷하고 일관된 답을, 높을수록 다양하고 창의적인 답을 냄.",
    "top_k": "다음 토큰 후보 중 확률이 높은 상위 k개만 고려하는 설정. k=50이면 가장 가능성 높은 50개 중에서만 고름.",
    "top_p": "다음 토큰 후보를 누적 확률이 p(예: 0.95)가 될 때까지만 고려하는 설정. top_k와 함께 써서 품질을 조절함.",
    "AutoModelForCausalLM": "Hugging Face의 '텍스트 생성 전용 언어 모델'을 자동으로 선택·로드하는 클래스. 모델 이름만 주면 알맞은 구조를 자동으로 찾아 불러옴.",
    "AutoTokenizer": "Hugging Face의 '자동 토크나이저 선택' 클래스. 모델 이름만 주면 그 모델에 맞는 토크나이저를 자동으로 불러옴.",
    "attention_mask": "토큰 배열에서 '실제 내용'과 '채움(padding)'을 구분하는 표시. 1은 실제 내용, 0은 무시할 부분. 모델이 올바른 위치만 집중하게 함.",
    "pad_token_id": "배열 길이를 맞추기 위해 빈 자리를 채우는 특수 토큰의 번호. 여기서는 문장 끝 토큰(eos_token_id)을 패딩 토큰으로 재사용함.",
    "repetition_penalty": "이미 생성한 단어를 또 반복하지 않도록 억제하는 설정. 1.0이면 페널티 없음, 높을수록 반복을 강하게 막음.",
    "CUDA": "NVIDIA GPU를 프로그래밍 언어에서 활용하게 해주는 기술. PyTorch에서 torch.cuda.is_available()로 사용 가능 여부를 확인함.",
    "float16 / float32": "소수점 숫자를 저장하는 정밀도. float16은 메모리를 절반만 써 GPU에서 유리하고, float32는 더 정밀해 CPU에서 주로 씀.",
    "device_map": "모델의 각 레이어를 GPU/CPU 중 어디에 올릴지 지정하는 옵션. 'auto'로 설정하면 사용 가능한 GPU에 자동으로 분산 배치함.",
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .parent를 붙이면 이 파일이 든 폴더의 경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함. 다른 파일이 import할 때는 실행 안 됨.",
  },
};
