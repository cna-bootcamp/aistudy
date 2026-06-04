/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../07.vlm/qwen3-vl/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "Qwen3-VL 이미지 분석 예제 설명",
    entry: "vlm.py",
  },

  files: [
    { id: "main", label: "vlm.py", role: "단일 파일 CLI 예제 · 이미지를 Qwen3-VL 모델로 분석" },
  ],

  flow: [
    {
      step: 1,
      title: "실행 시작",
      label: "실행 시작",
      refs: ["main"],
      summary: "python vlm.py 실행 → main()이 진입점으로 호출됨",
      detail: "이 예제는 웹이 아니라 '명령줄 프로그램'임. 터미널에서 실행하면 맨 아래 if __name__ == \"__main__\": 가 main()을 호출함. main()이 전체 작업을 순서대로 지휘함."
    },
    {
      step: 2,
      title: "명령줄 옵션 읽기",
      label: "명령줄 옵션 읽기",
      refs: ["parse_args"],
      summary: "parse_args()로 --input(이미지 경로)·--prompt·--device 등 옵션을 읽음",
      detail: "식당 주문서를 받는 단계와 비슷함. argparse가 'python vlm.py --input ./image.jpg' 같은 입력을 해석해, 어떤 이미지를 분석하고 어떤 프롬프트를 쓸지 정함. 옵션을 생략하면 기본값을 씀."
    },
    {
      step: 3,
      title: "이미지 경로 확정",
      label: "이미지 경로 확정",
      refs: ["get_image_path"],
      summary: "get_image_path()가 이미지 파일을 정하고 형식·존재 여부를 검증함",
      detail: "--input으로 파일을 직접 줬으면 그걸 쓰고, 없으면 터미널에 경로를 입력받음. 파일이 실제로 있는지, 지원 형식(.jpg·.png 등)인지 확인한 뒤 경로를 돌려줌."
    },
    {
      step: 4,
      title: "모델 로드",
      label: "모델 로드",
      refs: ["load_model"],
      summary: "load_model()이 Qwen3-VL 모델과 프로세서를 GPU(또는 CPU)에 올림",
      detail: "AI 요리사(모델)를 주방(GPU/CPU)으로 부르는 단계임. 첫 실행 시 인터넷에서 모델을 다운로드하므로 시간이 걸릴 수 있음. GPU가 있으면 GPU(CUDA)를, 없으면 CPU를 자동 선택함."
    },
    {
      step: 5,
      title: "이미지 분석",
      label: "이미지 분석",
      refs: ["analyze_image"],
      summary: "analyze_image()가 이미지와 프롬프트를 모델에 넣어 설명 텍스트를 생성함",
      detail: "이미지를 열어 'user' 역할 메시지로 구성한 뒤, 프로세서가 모델 입력 형태로 변환함. 모델이 새 토큰을 생성하고, 입력 부분을 제거해 실제 답변만 텍스트로 추출함."
    },
    {
      step: 6,
      title: "결과 출력",
      label: "결과 출력",
      summary: "분석된 텍스트를 터미널에 출력하고 종료함",
      detail: "완성된 이미지 설명을 화면에 보여주는 마지막 단계임. 오류가 생기면 오류 메시지를 찍고 sys.exit(1)로 실패 종료함."
    },
  ],

  functions: [
    {
      id: "parse_args",
      name: "parse_args()",
      fileId: "main",
      summary: "CLI 옵션(--input·--prompt·--model·--device 등)을 정의하고 해석하여 Namespace 객체를 반환함.",
      how: "argparse는 'python vlm.py --input a.jpg --device cuda' 같은 명령줄 입력을 처리하는 표준 도구임. 각 옵션의 타입·기본값·도움말을 정의하고, parser.parse_args()로 실제 입력을 해석함.",
      terms: ["argparse", "Namespace", "타입 힌트"],
      lines: [
        { at: 'parser = argparse.ArgumentParser(description="Qwen3-VL', text: "argparse 파서를 만듦. 명령줄 옵션을 정의·해석하는 표준 도구임." },
        { at: 'parser.add_argument("--input", "-i"', text: "--input(-i) 옵션 정의: 분석할 이미지 파일 경로(생략 가능, 없으면 대화형 입력)." },
        { at: '"--prompt", "-p", type=str', text: "--prompt(-p) 옵션 정의: 이미지 분석 질문(기본값: '이 이미지를 자세히 설명해 주세요.')." },
        { at: 'choices=["auto", "cuda", "cpu"]', text: "--device 옵션은 auto·cuda·cpu 세 값만 허용함. choices로 잘못된 입력을 자동 차단함." },
        { at: 'return parser.parse_args()', text: "실제 명령줄을 해석해, 옵션 값들을 담은 Namespace 객체를 돌려줌." },
      ],
      code:
`def parse_args() -> argparse.Namespace:
    """CLI 인자 파싱 후 Namespace 반환."""
    parser = argparse.ArgumentParser(description="Qwen3-VL 이미지 분석")
    parser.add_argument("--input", "-i", type=str, help="분석할 이미지 파일 경로")
    parser.add_argument(
        "--prompt", "-p", type=str, default=DEFAULT_PROMPT, help="이미지 분석 프롬프트"
    )
    parser.add_argument(
        "--model",
        type=str,
        default=DEFAULT_MODEL,
        help=f"사용할 Qwen3-VL 모델 ID (기본값: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--max-tokens", type=int, default=4096, help="최대 생성 토큰 수 (기본값: 4096)"
    )
    parser.add_argument(
        "--temperature", type=float, default=0.1, help="출력 다양성 (0.0~1.0, 기본값: 0.7)"
    )
    parser.add_argument(
        "--top-p", type=float, default=0.9, help="nucleus sampling 확률 임계값 (기본값: 0.9)"
    )
    parser.add_argument(
        "--repetition-penalty", type=float, default=1.1, help="반복 억제 (1.0 이상, 기본값: 1.1)"
    )
    parser.add_argument(
        "--no-sample", action="store_true", help="샘플링 비활성화 (greedy decoding)"
    )
    parser.add_argument(
        "--device",
        type=str,
        default="auto",
        choices=["auto", "cuda", "cpu"],
        help="사용할 디바이스: auto=GPU 우선, cuda=GPU 강제, cpu=CPU 강제 (기본값: auto)",
    )
    return parser.parse_args()`,
    },

    {
      id: "get_image_path",
      name: "get_image_path(input_arg)",
      fileId: "main",
      summary: "CLI 인자 또는 대화형 입력으로 이미지 경로를 받고, 파일 존재·형식을 검증해 Path 객체를 반환함.",
      how: "--input 인자가 있으면 그 경로를 쓰고, 없으면 터미널에 경로를 입력받음. 파일이 실제 존재하는지, 파일인지, 지원 형식인지 세 가지를 확인하고 하나라도 실패하면 오류를 냄.",
      terms: ["Path(__file__)", "Optional", "FileNotFoundError", "ValueError", "타입 힌트"],
      lines: [
        { at: 'if input_arg:', text: "--input 인자가 있으면(None이 아니면) 그 경로를 Path로 변환함." },
        { at: 'raw = input("경로> ")', text: "input()으로 사용자가 키보드로 이미지 경로를 직접 입력하게 함. 앞뒤 공백과 따옴표를 제거함." },
        { at: 'if not path.exists():', text: "파일이 실제로 디스크에 있는지 확인함. 없으면 FileNotFoundError를 냄." },
        { at: 'if not path.is_file():', text: "경로가 파일인지 확인함(폴더이면 오류). 파일이 아니면 ValueError를 냄." },
        { at: 'if path.suffix.lower() not in SUPPORTED_EXTENSIONS:', text: "확장자가 지원 형식(jpg·png·webp 등) 집합에 없으면 ValueError로 알려줌." },
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
      id: "load_model",
      name: "load_model(model_id, device_arg)",
      fileId: "main",
      summary: "Qwen3-VL 모델과 프로세서를 로드하여 (model, processor) 튜플로 반환함. GPU/CPU 자동 선택 포함.",
      how: "먼저 GPU(CUDA)를 쓸 수 있는지 torch.cuda.is_available()로 확인함. device_arg가 'auto'이면 GPU가 있으면 cuda, 없으면 cpu를 씀. 'cuda'를 골랐는데 GPU가 없으면 cpu로 자동 전환함. 모델과 프로세서 두 가지를 함께 로드해 튜플로 돌려줌.",
      terms: ["PyTorch", "CUDA", "GPU", "Hugging Face Transformers", "AutoProcessor", "튜플(tuple)", "타입 힌트"],
      lines: [
        { at: 'cuda_available = torch.cuda.is_available()', text: "torch.cuda.is_available()은 이 컴퓨터에 GPU(CUDA)가 있고 사용 가능한지 True/False로 알려줌." },
        { at: 'if device_arg == "auto":', text: "device_arg가 'auto'이면 GPU 사용 가능 여부에 따라 cuda 또는 cpu를 자동 선택함." },
        { at: 'print("   - 경고: CUDA를 사용할 수 없음', text: "cuda를 강제했는데 GPU가 없으면, 경고를 찍고 cpu로 전환함(오류 대신 안전 처리)." },
        { at: 'model = Qwen3VLForConditionalGeneration.from_pretrained(', text: "Hugging Face에서 Qwen3-VL 모델 가중치를 불러옴. torch_dtype='auto'는 GPU면 float16, CPU면 float32를 자동 선택함." },
        { at: 'processor = AutoProcessor.from_pretrained(model_id)', text: "프로세서는 이미지·텍스트를 모델 입력 형태(토큰)로 변환하는 '통역사' 역할을 함." },
      ],
      code:
`def load_model(model_id: str, device_arg: str = "auto"):
    """Qwen3-VL 모델과 프로세서를 로드하여 (model, processor) 튜플 반환."""
    # GPU(CUDA) 사용 가능 여부 확인
    cuda_available = torch.cuda.is_available()

    if device_arg == "auto":
        device = "cuda" if cuda_available else "cpu"
    elif device_arg == "cuda":
        if not cuda_available:
            print("   - 경고: CUDA를 사용할 수 없음. CPU로 전환")
            device = "cpu"
        else:
            device = "cuda"
    else:
        device = "cpu"

    print(f"   - GPU(CUDA) 사용 가능: {'예' if cuda_available else '아니오'}")
    print(f"   - 사용 디바이스: {device.upper()}")
    if device == "cpu":
        print("   - CPU 환경: 추론 속도가 느릴 수 있음")

    model = Qwen3VLForConditionalGeneration.from_pretrained(
        model_id,
        torch_dtype="auto",
        device_map=device,
    )
    processor = AutoProcessor.from_pretrained(model_id)
    return model, processor`,
    },

    {
      id: "analyze_image",
      name: "analyze_image(model, processor, image_path, prompt, ...)",
      fileId: "main",
      summary: "이미지와 프롬프트를 Qwen3-VL 모델에 넣어 분석 텍스트를 생성하고 반환함.",
      how: "이미지를 PIL로 열어 RGB로 변환하고, '사용자가 이미지를 보여주며 질문하는 대화' 형태(messages)로 구성함. 프로세서가 이 메시지를 토큰(숫자 ID)으로 바꾸고, model.generate()가 새 토큰을 생성함. 입력 토큰 수만큼 앞부분을 잘라내어 새로 생성된 부분만 텍스트로 디코딩함.",
      terms: ["PIL/Pillow", "멀티모달(multimodal)", "토큰(token)", "generate()", "torch.no_grad()", "리스트 컴프리헨션", "temperature", "top_p", "repetition_penalty", "do_sample", "batch_decode", "타입 힌트"],
      lines: [
        { at: 'image = Image.open(image_path).convert("RGB")', text: "PIL(Pillow)로 이미지 파일을 열고 RGB 색상 형식으로 변환함. 모델이 RGB 입력을 기대하기 때문임." },
        { at: '"role": "user"', text: "messages 목록은 ChatGPT처럼 '역할(role) + 내용(content)' 쌍으로 구성함. user가 이미지와 질문을 함께 보냄." },
        { at: '{"type": "image", "image": image}', text: "content 안에 이미지 객체를 그대로 넣음. 텍스트와 이미지를 함께 처리하는 멀티모달 입력 방식임." },
        { at: 'inputs = processor.apply_chat_template(', text: "프로세서가 messages 구조를 모델이 이해하는 토큰(숫자 ID)으로 변환함. return_tensors='pt'는 PyTorch 텐서 형식으로 달라는 뜻임." },
        { at: 'inputs = inputs.to(model.device)', text: "토큰 데이터를 모델이 있는 장치(GPU 또는 CPU)로 옮겨, 같은 곳에서 계산할 수 있게 함." },
        { at: 'with torch.no_grad():', text: "torch.no_grad()는 '추론만 할 테니 기울기(gradient) 계산은 하지 말라'는 뜻. 메모리를 아끼고 속도를 높임." },
        { at: 'generated_ids_trimmed = [', text: "리스트 컴프리헨션으로 (입력, 출력) 쌍을 순회하며 입력 토큰 길이만큼 앞부분을 잘라냄. 새로 생성된 토큰만 남김." },
        { at: 'for in_ids, out_ids in zip(inputs.input_ids, generated_ids)', text: "zip으로 (입력 토큰, 출력 토큰) 쌍을 하나씩 꺼내며, 입력 길이만큼 앞부분을 잘라내어 새로 생성된 토큰만 남김." },
        { at: 'output_text = processor.batch_decode(', text: "batch_decode가 숫자 토큰 배열을 다시 사람이 읽는 텍스트로 변환함. skip_special_tokens=True로 특수 기호를 제거함." },
      ],
      code:
`def analyze_image(
    model,
    processor,
    image_path: Path,
    prompt: str,
    max_tokens: int,
    temperature: float = 0.7,
    top_p: float = 0.9,
    repetition_penalty: float = 1.1,
    do_sample: bool = True,
) -> str:
    """Qwen3-VL 모델로 이미지를 분석하여 생성된 텍스트 반환."""
    image = Image.open(image_path).convert("RGB")

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": prompt},
            ],
        }
    ]

    inputs = processor.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=True,
        return_dict=True,
        return_tensors="pt",
    )
    inputs = inputs.to(model.device)

    with torch.no_grad():
        generated_ids = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            repetition_penalty=repetition_penalty,
            do_sample=do_sample,
        )

    # 생성된 토큰에서 입력 부분 제거 (새로 생성된 부분만 추출)
    # ┌─────────────────────────────────────────────────────────────┐
    # │ inputs.input_ids : [[101, 2054, 2003, ...]]  ← 입력 토큰 (배치)
    # │ generated_ids    : [[101, 2054, 2003, ..., 7592, 1010, ...]]
    # │                     ├── 입력 토큰 ──┤├── 생성 토큰 ──┤
    # │
    # │ zip으로 (입력, 출력) 쌍을 순회:
    # │   in_ids  = [101, 2054, 2003, ...]     ← 입력 토큰 1개
    # │   out_ids = [101, 2054, 2003, ..., 7592, 1010, ...]
    # │
    # │ out_ids[len(in_ids):] → 입력 길이 이후부터 슬라이싱
    # │   = [7592, 1010, ...] ← 새로 생성된 토큰만 추출
    # └─────────────────────────────────────────────────────────────┘
    #
    # 📚 리스트 컴프리헨션(List Comprehension) 문법 설명:
    # ┌─────────────────────────────────────────────────────────────┐
    # │ [ 표현식 for 변수 in 반복가능객체 ]                          │
    # │                                                             │
    # │ 예) [x*2 for x in [1,2,3]] → [2, 4, 6]                      │
    # │                                                             │
    # │ 이 코드의 경우:                                              │
    # │   [out_ids[len(in_ids):] for in_ids, out_ids in zip(...)]  │
    # │    ├─ 표현식 ──────────┤    ├─ 변수들 ─┤    ├─ 반복객체 ─┤  │
    # │                                                             │
    # │ 풀어쓰면:                                                    │
    # │   result = []                                               │
    # │   for in_ids, out_ids in zip(inputs.input_ids, generated): │
    # │       result.append(out_ids[len(in_ids):])                 │
    # │   # result = [[7592, 1010, ...], ...]                       │
    # └─────────────────────────────────────────────────────────────┘
    generated_ids_trimmed = [
        out_ids[len(in_ids):]
        for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
    ]
    output_text = processor.batch_decode(
        generated_ids_trimmed,
        skip_special_tokens=True,
        clean_up_tokenization_spaces=False,
    )
    return output_text[0].strip()`,
    },

    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "전체 작업을 순서대로 실행하는 진입점. 이미지 경로 획득→모델 로드→이미지 분석→결과 출력.",
      how: "프로그램의 '지휘자'임. 옵션 읽기 → 이미지 경로 확정 → 모델 로드 → 이미지 분석 → 결과 출력 순서로 진행함. 각 단계를 try/except로 감싸 오류 시 메시지를 찍고 sys.exit(1)로 실패 종료함.",
      terms: ["예외 처리(try/except)", "sys.exit", "if __name__", "타입 힌트"],
      lines: [
        { at: 'args = parse_args()', text: "먼저 명령줄 옵션을 읽어 args 객체에 담음." },
        { at: 'image_path = get_image_path(args.input)', text: "변환할 이미지 파일 경로를 확정함(인수 또는 대화형 입력). 잘못된 경로·형식이면 여기서 오류가 남." },
        { at: 'model, processor = load_model(args.model, args.device)', text: "Qwen3-VL 모델과 프로세서를 불러옴. 첫 실행 시 다운로드가 있어 시간이 걸릴 수 있음." },
        { at: 'result = analyze_image(', text: "★핵심★ 이미지와 프롬프트를 모델에 넣어 분석 텍스트를 생성함." },
        { at: 'print(f"\\n[오류] 이미지 분석 실패', text: "이미지 분석 중 오류가 나면 메시지를 출력하고 sys.exit(1)로 실패 종료함. 앱이 갑자기 죽지 않게 함." },
      ],
      code:
`def main() -> None:
    """메인 실행 함수."""
    args = parse_args()

    print("=" * 60)
    print("Qwen3-VL 이미지 분석 예제")
    print("=" * 60)

    # 1. 이미지 경로 획득
    try:
        image_path = get_image_path(args.input)
    except (FileNotFoundError, ValueError) as e:
        print(f"\\n[오류] {e}")
        sys.exit(1)

    print(f"\\n이미지: {image_path}")
    print(f"프롬프트: {args.prompt}")
    print(f"모델: {args.model}")
    print(f"디바이스: {args.device}")
    print(f"생성 파라미터: max_tokens={args.max_tokens}, temperature={args.temperature}, "
          f"top_p={args.top_p}, repetition_penalty={args.repetition_penalty}, "
          f"do_sample={not args.no_sample}")
    print("=" * 60)

    # 2. 모델 로드
    print("\\n1. 모델 로드 중...")
    print(f"   - {args.model}")
    print("   - 첫 실행 시 모델 다운로드로 시간이 걸릴 수 있음")
    try:
        model, processor = load_model(args.model, args.device)
    except Exception as e:
        print(f"\\n[오류] 모델 로드 실패: {e}")
        sys.exit(1)
    print("   - 로드 완료!")

    # 3. 이미지 분석
    print("\\n2. 이미지 분석 중...")
    try:
        result = analyze_image(
            model,
            processor,
            image_path,
            args.prompt,
            args.max_tokens,
            temperature=args.temperature,
            top_p=args.top_p,
            repetition_penalty=args.repetition_penalty,
            do_sample=not args.no_sample,
        )
    except Exception as e:
        print(f"\\n[오류] 이미지 분석 실패: {e}")
        sys.exit(1)

    # 4. 결과 출력
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
    "argparse": "'python 파일.py --옵션 값' 형태의 명령줄 입력을 정의하고 해석해 주는 파이썬 표준 도구.",
    "Namespace": "argparse가 돌려주는 객체. args.input, args.device처럼 점(.)으로 옵션 값을 꺼낼 수 있음.",
    "타입 힌트": "변수·함수에 자료의 종류(str, Path, int 등)를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "Optional": "'있어도 되고 없어도 되는' 인자 타입. Optional[str]은 '문자열이거나 None일 수 있다'는 뜻임.",
    "Path(__file__)": "Path는 파일·폴더 경로를 다루는 파이썬 객체. Path(__file__)은 '지금 이 파이썬 파일의 위치'를 나타냄.",
    "FileNotFoundError": "찾는 파일이 없을 때 나는 오류. 여기서는 이미지 파일이 없을 때 분명히 알려주려고 발생시킴.",
    "ValueError": "값이 잘못됐을 때 나는 오류. 여기서는 지원하지 않는 이미지 확장자일 때 발생시킴.",
    "PyTorch": "딥러닝(AI 학습·추론) 계산을 쉽게 할 수 있게 해주는 대표 라이브러리. GPU 가속을 지원함.",
    "CUDA": "NVIDIA GPU로 병렬 계산을 빠르게 수행하게 해주는 기술. torch.cuda.is_available()로 사용 가능 여부를 확인함.",
    "GPU": "그래픽 처리 장치. 수많은 계산을 동시에 처리해 AI 모델 추론을 CPU보다 훨씬 빠르게 함.",
    "Hugging Face Transformers": "다양한 AI 언어·비전 모델을 쉽게 내려받아 쓸 수 있게 해주는 대표 라이브러리. from_pretrained()로 모델을 불러옴.",
    "AutoProcessor": "Hugging Face의 자동 프로세서. 이미지·텍스트를 모델 입력(토큰)으로 변환하는 '통역사' 역할을 함.",
    "튜플(tuple)": "(값1, 값2) 형태로 여러 값을 묶어 돌려주는 자료 구조. 리스트와 달리 값을 바꿀 수 없음. 여기서는 (model, processor) 쌍을 반환함.",
    "PIL/Pillow": "파이썬에서 이미지 파일을 열고 변환하는 대표 라이브러리. Image.open()으로 파일을 읽고 .convert('RGB')로 색상 형식을 바꿈.",
    "멀티모달(multimodal)": "텍스트·이미지·오디오 등 여러 종류의 입력을 함께 처리하는 AI 능력. Qwen3-VL은 이미지와 텍스트를 동시에 이해함.",
    "토큰(token)": "AI 모델이 텍스트를 처리하는 기본 단위. 단어 또는 글자 조각으로 나뉘며, 숫자 ID로 표현됨. 모델은 토큰 단위로 읽고 씀.",
    "generate()": "model.generate()는 입력 토큰 이후로 새 토큰을 하나씩 생성(예측)하는 함수. 텍스트 생성의 핵심임.",
    "torch.no_grad()": "추론(생성) 시 기울기 계산을 끄는 컨텍스트 매니저. 메모리를 아끼고 속도를 높임. 학습이 아닌 추론 때만 씀.",
    "리스트 컴프리헨션": "[표현식 for 항목 in 목록 if 조건] 형태로, 반복문을 한 줄로 짧게 써서 새 목록을 만드는 파이썬 문법.",
    "temperature": "AI 답변의 '창의성/무작위성' 정도(0~1 등). 0에 가까울수록 매번 비슷하고 일관된 답을, 높을수록 다양한 답을 냄.",
    "top_p": "nucleus sampling(누클레우스 샘플링). 확률이 높은 단어들만 남겨 선택 범위를 좁히는 방식. 0.9면 상위 90% 확률 단어에서 고름.",
    "repetition_penalty": "같은 표현이 반복되지 않도록 억제하는 값. 1.0이면 억제 없음, 높을수록 반복을 더 강하게 막음.",
    "do_sample": "토큰을 확률적으로 선택할지(True), 가장 높은 확률 것만 고를지(False=greedy) 결정하는 옵션.",
    "batch_decode": "프로세서의 batch_decode()는 숫자 토큰 배열을 다시 사람이 읽는 텍스트로 변환함. skip_special_tokens=True로 모델 내부 특수 기호를 제거함.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "sys.exit": "프로그램을 즉시 종료하는 함수. sys.exit(0)은 정상 종료, sys.exit(1)은 오류 종료를 운영체제에 알림.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
  },
};
