"""
Gemini Vision API를 활용한 이미지 분석 예제

Google Gemini Vision API로 이미지를 분석하여 한국어 설명을 생성함.
이미지 파일 경로를 입력받아 Gemini API에 전송하고 분석 결과를 출력함.

사용법:
    python vlm.py                          # 대화형 파일 경로 입력
    python vlm.py --input ./image.jpg      # 파일 경로 직접 지정
    python vlm.py --input ./image.jpg --prompt "이 이미지의 색상을 설명해 주세요."
"""

import os
import sys
import argparse
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
# Google Gen AI SDK의 핵심 클라이언트 — Gemini Vision API 호출에 사용됨
from google import genai
from google.genai import types

# Windows 콘솔 한글 출력 오류 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

DEFAULT_MODEL = "gemini-2.5-flash"
DEFAULT_PROMPT = "이 이미지를 자세히 설명해 주세요."
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}
MIME_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
}


def load_api_key() -> str:
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
    return api_key


def parse_args() -> argparse.Namespace:
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


def analyze_image(
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

    return response.text.strip()


def main() -> None:
    """메인 실행 함수."""
    args = parse_args()

    print("=" * 60)
    print("Gemini Vision 이미지 분석 예제")
    print("=" * 60)

    # 1. API 키 로드
    try:
        api_key = load_api_key()
    except EnvironmentError as e:
        print(f"\n[오류] {e}")
        sys.exit(1)

    # 2. 이미지 경로 획득
    try:
        image_path = get_image_path(args.input)
    except (FileNotFoundError, ValueError) as e:
        print(f"\n[오류] {e}")
        sys.exit(1)

    print(f"\n이미지: {image_path}")
    print(f"프롬프트: {args.prompt}")
    print(f"모델: {args.model}")
    print("=" * 60)

    # 3. Gemini 클라이언트 초기화
    print("\n1. Gemini API 클라이언트 초기화 중...")
    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        print(f"\n[오류] 클라이언트 초기화 실패: {e}")
        sys.exit(1)
    print("   - 초기화 완료!")

    # 4. 이미지 분석
    print("\n2. 이미지 분석 중...")
    try:
        result = analyze_image(client, image_path, args.prompt, args.model, args.max_tokens)
    except Exception as e:
        print(f"\n[오류] 이미지 분석 실패: {e}")
        sys.exit(1)

    # 5. 결과 출력
    print("\n" + "=" * 60)
    print("분석 결과")
    print("=" * 60)
    print(result)
    print("=" * 60)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
