"""
Qwen3-VL을 활용한 이미지 분석 예제

Qwen3-VL 모델로 이미지를 분석하여 설명을 생성함.
이미지 파일 경로를 입력받아 로컬에서 추론하고 분석 결과를 출력함.

사용법:
    python vlm.py                          # 대화형 파일 경로 입력
    python vlm.py --input ./image.jpg      # 파일 경로 직접 지정
    python vlm.py --input ./image.jpg --prompt "이 이미지의 색상을 설명해 주세요."
    python vlm.py --input ./image.jpg --device cuda   # GPU 강제 사용
    python vlm.py --input ./image.jpg --device cpu    # CPU 강제 사용

생성 파라미터:
    --max-tokens         : 최대 생성 토큰 수 (기본값: 4096)
    --temperature        : 출력 다양성, 0.0~1.0 (기본값: 0.7)
    --top-p              : nucleus sampling 확률 임계값 (기본값: 0.9)
    --repetition-penalty : 반복 억제, 1.0 이상 (기본값: 1.1)
    --no-sample          : 샘플링 비활성화 (greedy decoding)

디바이스 선택:
    auto  : GPU(CUDA) 사용 가능 시 자동 선택, 없으면 CPU (기본값)
    cuda  : GPU 강제 사용 (CUDA 미지원 환경에서는 CPU로 자동 전환)
    cpu   : CPU 강제 사용
"""

import sys
import argparse
from pathlib import Path
from typing import Optional

import torch
from PIL import Image
# Qwen3-VL 멀티모달 언어 모델 — 이미지와 텍스트를 함께 입력받아 설명을 생성함
from transformers import Qwen3VLForConditionalGeneration, AutoProcessor

# Windows 콘솔 한글 출력 오류 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

DEFAULT_MODEL = "Qwen/Qwen3-VL-2B-Instruct"
DEFAULT_PROMPT = "이 이미지를 자세히 설명해 주세요."
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}


def parse_args() -> argparse.Namespace:
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
    return parser.parse_args()


def get_image_path(input_arg: Optional[str]) -> Path:
    """CLI 인자 또는 대화형 입력으로 이미지 파일 경로를 획득하고 유효성 검증 후 반환."""
    if input_arg:
        path = Path(input_arg)
    else:
        print("\n이미지 파일 경로를 입력하세요.")
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
    return path


def load_model(model_id: str, device_arg: str = "auto"):
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
    return model, processor


def analyze_image(
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
    return output_text[0].strip()


def main() -> None:
    """메인 실행 함수."""
    args = parse_args()

    print("=" * 60)
    print("Qwen3-VL 이미지 분석 예제")
    print("=" * 60)

    # 1. 이미지 경로 획득
    try:
        image_path = get_image_path(args.input)
    except (FileNotFoundError, ValueError) as e:
        print(f"\n[오류] {e}")
        sys.exit(1)

    print(f"\n이미지: {image_path}")
    print(f"프롬프트: {args.prompt}")
    print(f"모델: {args.model}")
    print(f"디바이스: {args.device}")
    print(f"생성 파라미터: max_tokens={args.max_tokens}, temperature={args.temperature}, "
          f"top_p={args.top_p}, repetition_penalty={args.repetition_penalty}, "
          f"do_sample={not args.no_sample}")
    print("=" * 60)

    # 2. 모델 로드
    print("\n1. 모델 로드 중...")
    print(f"   - {args.model}")
    print("   - 첫 실행 시 모델 다운로드로 시간이 걸릴 수 있음")
    try:
        model, processor = load_model(args.model, args.device)
    except Exception as e:
        print(f"\n[오류] 모델 로드 실패: {e}")
        sys.exit(1)
    print("   - 로드 완료!")

    # 3. 이미지 분석
    print("\n2. 이미지 분석 중...")
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
        print(f"\n[오류] 이미지 분석 실패: {e}")
        sys.exit(1)

    # 4. 결과 출력
    print("\n" + "=" * 60)
    print("분석 결과")
    print("=" * 60)
    print(result)
    print("=" * 60)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
