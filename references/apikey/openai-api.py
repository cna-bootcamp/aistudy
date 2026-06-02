# 파일 경로 처리를 위한 pathlib 모듈
from pathlib import Path
# 환경변수(.env 파일) 로드를 위한 python-dotenv 라이브러리
from dotenv import load_dotenv
# 환경변수 접근을 위한 os 모듈
import os
# OpenAI API 클라이언트 라이브러리
from openai import OpenAI

# .env 파일 로드: 현재 파일의 부모 디렉토리의 부모 디렉토리에 있는 .env 파일 찾기
# 예: /examples/references/apikey/openai-api.py -> /examples/.env
load_dotenv(Path(__file__).parent.parent / ".env")

# OpenAI 클라이언트 초기화
# api_key: 환경변수 OPENAI_API_KEY에서 API 키를 읽어옴
client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY")
)

# 시스템 메시지: AI의 역할과 행동 방식을 정의
# role: "system"은 AI의 페르소나를 설정하는 역할
# content: AI가 테크 뉴스 전문가로서 정확하고 간결한 요약을 제공하도록 지시
system_message = {
    "role": "system",
    "content": "당신은 정확하고 간결한 AI 뉴스 요약을 제공하는 테크 뉴스 전문가입니다."
}

# 사용자 메시지: 실제 질문 또는 요청 내용
# role: "user"는 사용자의 입력을 나타냄
# content: AI에게 Top 3 AI 뉴스와 요약을 요청
user_message = {
    "role": "user",
    "content": "오늘의 Top 3 AI 뉴스를 알려주세요. 각각 간단한 요약도 포함해 주세요."
}

# OpenAI Chat Completions API 호출
# model: "gpt-4o-mini" - 빠르고 비용 효율적인 GPT-4 계열 모델
# temperature: 0.7 - 응답의 창의성/무작위성 조절 (0.0=결정적, 1.0=창의적)
# messages: 시스템 메시지와 사용자 메시지를 포함한 대화 컨텍스트
response = client.chat.completions.create(
    model="gpt-4o-mini",
    temperature=0.7,
    messages=[system_message, user_message]
)

# 응답 출력
# response.choices[0]: API가 반환한 첫 번째 응답 선택지
# .message.content: 실제 AI가 생성한 텍스트 내용
print(response.choices[0].message.content)
