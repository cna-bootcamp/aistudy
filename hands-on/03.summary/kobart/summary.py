"""
KoBART 모델을 활용한 뉴스 URL 요약 예제

gogamza/kobart-summarization 모델로 뉴스 URL의 본문을 크롤링 후 요약함.
BART 기반 한국어 전용 seq2seq 모델을 로컬에서 로드하여 텍스트를 요약함.

사용법:
    python summary.py --url https://news.example.com/article/12345

입력: --url 커맨드라인 인자 (뉴스 URL)
출력: ./summary.txt
"""

import argparse
import re
import sys
from pathlib import Path

import requests
import torch
from bs4 import BeautifulSoup
from transformers import BartForConditionalGeneration, PreTrainedTokenizerFast

# Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

MODEL_ID = "gogamza/kobart-summarization"
# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
OUTPUT_PATH = Path(__file__).parent / "summary.txt"

# KoBART BART 모델 최대 입력 토큰 수 (BOS/EOS 포함 1026이므로 본문은 1022)
MAX_INPUT_TOKENS = 1022


def crawl_news(url: str) -> str:
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

    return text


def preprocess(text: str) -> str:
    """본문 텍스트의 불필요한 공백·특수문자를 정리하여 반환함.
    탭·줄바꿈 제거, 연속 공백 축소, 한글·영문·숫자·기본 구두점만 유지."""
    # 탭·줄바꿈을 공백으로 치환
    text = re.sub(r"[\t\r\n]+", " ", text)
    # 연속 공백 제거
    text = re.sub(r" {2,}", " ", text)
    # 특수문자 정리 (한글·영문·숫자·기본 구두점만 유지)
    text = re.sub(r"[^가-힣ᄀ-ᇿ㄰-㆏a-zA-Z0-9\s.,!?%\-–—:;\"'()\[\]]", "", text)
    return text.strip()


def truncate_to_tokens(tokenizer: PreTrainedTokenizerFast, text: str, max_tokens: int) -> str:
    """토큰 수가 max_tokens를 초과할 경우 앞부분만 남겨 반환함.
    KoBART 최대 입력(1024 토큰) 초과 방지 목적."""
    token_ids = tokenizer.encode(text)
    if len(token_ids) > max_tokens:
        print(f"   - 토큰 수 {len(token_ids)} → {max_tokens}으로 truncation")
        token_ids = token_ids[:max_tokens]
        text = tokenizer.decode(token_ids, skip_special_tokens=True)
    return text


def summarize(model: BartForConditionalGeneration, tokenizer: PreTrainedTokenizerFast, text: str, device: str) -> str:
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
    return decoded.replace("▁", " ").strip()


def summarize_chunks(
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

    return " ".join(summaries)


def main():
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
    print("\n1. 뉴스 본문 크롤링 중...")
    raw_text = crawl_news(args.url)
    print(f"   - 크롤링 완료: {len(raw_text)} 문자")

    # 2. 전처리
    print("\n2. 텍스트 전처리 중...")
    clean_text = preprocess(raw_text)
    print(f"   - 전처리 완료: {len(clean_text)} 문자")

    if not clean_text:
        print("오류: 본문 텍스트를 추출할 수 없습니다.")
        sys.exit(1)

    # 3. 디바이스 설정
    # GPU(CUDA) 사용 가능 여부 확인. 불가능하면 CPU 사용
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\n3. 디바이스: {device}")

    # 4. 모델 로드
    print("\n4. 모델 로딩 중... (처음 실행 시 다운로드 필요, 약 500MB)")
    # PreTrainedTokenizerFast: 텍스트를 KoBART가 처리할 수 있는 토큰 배열로 변환하는 고속 토크나이저
    tokenizer = PreTrainedTokenizerFast.from_pretrained(MODEL_ID)
    # BartForConditionalGeneration: 입력 시퀀스를 받아 요약문 시퀀스를 생성하는 seq2seq 모델
    model = BartForConditionalGeneration.from_pretrained(MODEL_ID)
    model = model.to(device)
    model.eval()
    print("   - 모델 로드 완료!")

    # 5. 요약 생성 (청크 분할)
    print("\n5. 청크 분할 요약 중...")
    # torch.no_grad(): 추론 시 기울기 계산을 비활성화하여 메모리 절약
    with torch.no_grad():
        summary = summarize_chunks(model, tokenizer, clean_text, device)

    # 6. 결과 저장
    print("\n6. 결과 저장 중...")
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    # with 블록을 벗어나면 파일이 자동으로 닫힘
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(f"[입력 URL]\n{args.url}\n\n")
        f.write(f"[요약 결과]\n{summary}\n")
    print(f"   - 저장 완료: {OUTPUT_PATH}")

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
