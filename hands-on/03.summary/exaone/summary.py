"""
EXAONE-4.0-1.2B 모델을 활용한 텍스트 요약 예제

LG AI Research의 EXAONE-4.0-1.2B 모델로 마크다운 문서를 요약함.
transformers 라이브러리로 로컬 LLM을 로드하여 텍스트를 생성함.

사용법:
    python summary.py

입력: ./result_Docling.md
출력: ./summary.txt
"""

import os
import sys
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

# Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def load_input_file(input_path: str) -> str:
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
        return f.read()


def save_output_file(output_path: str, content: str) -> None:
    """결과 파일을 UTF-8로 저장함. 출력 디렉터리가 없으면 자동 생성."""
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)


def create_summary_prompt(text: str) -> str:
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
위 문서의 요약:"""


def summarize_text(
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

    return response


def main():
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
    print("\n1. 입력 파일 읽는 중...")
    input_text = load_input_file(str(input_path))
    print(f"   - 문서 길이: {len(input_text)} 문자")

    # 3. 디바이스 설정
    # GPU(CUDA) 사용 가능 여부 확인. 불가능하면 CPU 사용
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\n2. 디바이스: {device}")

    # 4. 모델 로드 (transformers >= 4.54.0 필요, dtype 사용)
    print("\n3. 모델 로딩 중... (처음 실행 시 다운로드 필요)")
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
    print("\n4. 요약 생성 중...")
    summary = summarize_text(model, tokenizer, input_text)

    # 6. 결과 저장
    print("\n5. 결과 저장 중...")
    save_output_file(str(output_path), summary)
    print(f"   - 저장 완료: {output_path}")

    # 7. 결과 출력
    print("\n" + "=" * 60)
    print("요약 결과")
    print("=" * 60)
    print(summary)
    print("=" * 60)

    print("\n완료!")


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
