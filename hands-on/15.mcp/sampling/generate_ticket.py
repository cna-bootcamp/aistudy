"""온라인 쇼핑몰 고객 문의 샘플 데이터 생성기.

MCP Sampling 예제(고객 문의 자동 분류·라우팅)의 입력 데이터를 만드는 프로그램임.
결제/배달/일반 3개 유형의 고객 문의를 각 3건씩, 총 9건을 csr/ 디렉터리에
JSON 파일로 저장함. 외부 의존성 없이 표준 라이브러리만 사용하여 결정적으로 동작함.

[문의 ID 규칙]
  CSR-001 ~ CSR-003 : 결제 관련 (분류 시 → 결제팀 / #cs-결제 채널 기대)
  CSR-004 ~ CSR-006 : 배달 관련 (분류 시 → 배달팀 / #cs-배달 채널 기대)
  CSR-007 ~ CSR-009 : 일반 관련 (분류 시 → 일반팀 / #cs-일반 채널 기대)
ID의 분류 의도는 E2E 테스트에서 LLM 분류 정확도를 확인하는 기준으로도 사용됨.
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import json
from pathlib import Path

# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
PROJECT_DIR = Path(__file__).resolve().parent
# 생성한 고객 문의를 저장할 디렉터리 (csr = Customer Service Request)
CSR_DIR = PROJECT_DIR / "csr"


# 실제 온라인 쇼핑몰에서 접수될 법한 한국어 고객 문의 9건.
# 각 항목은 LLM이 카테고리/긴급도/담당부서를 분류하기에 충분한 맥락을 담음.
# list[dict[str, str]]: 문자열 키-값으로 구성된 dict를 원소로 갖는 리스트 타입
INQUIRIES: list[dict[str, str]] = [
    # --- 결제 관련 (CSR-001 ~ CSR-003) ---
    {
        "id": "CSR-001",
        "customer_name": "김민수",
        "customer_email": "minsu.kim@example.com",
        "subject": "이중 결제 발생, 즉시 취소 요청",
        "content": (
            "어제 주문번호 ORD-20260531-7842로 운동화를 구매했는데 카드 결제가 두 번 처리되었습니다. "
            "89,000원이 두 번 빠져나갔어요. 한 건은 당장 취소해 주세요. 카드값 나가기 전에 급히 처리 부탁드립니다."
        ),
    },
    {
        "id": "CSR-002",
        "customer_name": "박지영",
        "customer_email": "jiyoung.park@example.com",
        "subject": "환불 지연 문의",
        "content": (
            "5월 25일에 반품 완료된 주문 ORD-20260520-3156 건인데 아직 환불이 안 되고 있습니다. "
            "반품 접수 시 3~5 영업일 내 환불이라고 안내받았는데 벌써 7 영업일이 지났어요. 환불 진행 상태 확인 부탁드립니다."
        ),
    },
    {
        "id": "CSR-003",
        "customer_name": "이승호",
        "customer_email": "seungho.lee@example.com",
        "subject": "쿠폰 할인 미적용 결제",
        "content": (
            "노트북을 주문하면서 5,000원 할인 쿠폰을 적용했는데 최종 결제 금액에 할인이 반영되지 않았습니다. "
            "차액을 환불받을 수 있는지, 아니면 재결제해야 하는지 확인 부탁드려요."
        ),
    },
    # --- 배달 관련 (CSR-004 ~ CSR-006) ---
    {
        "id": "CSR-004",
        "customer_name": "최유진",
        "customer_email": "yujin.choi@example.com",
        "subject": "배송 지연, 예정일 초과",
        "content": (
            "주문번호 ORD-20260528-9201 건이 2일 도착 예정이었는데 아직 배송 중입니다. "
            "택배를 추적하니 '간선 상차' 상태에서 3일째 멈춰 있어요. 여행 전에 꼭 받아야 해서 급합니다. 확인 부탁드립니다."
        ),
    },
    {
        "id": "CSR-005",
        "customer_name": "정다은",
        "customer_email": "daeun.jung@example.com",
        "subject": "오배송, 다른 상품 수령",
        "content": (
            "주문번호 ORD-20260530-5567로 에어팟 프로를 주문했는데 상자를 열어보니 블루투스 스피커가 들어 있었습니다. "
            "에어팟 프로를 다시 보내주시고, 잘못 배송된 스피커는 어떻게 반송하면 되는지 알려주세요."
        ),
    },
    {
        "id": "CSR-006",
        "customer_name": "한상우",
        "customer_email": "sangwoo.han@example.com",
        "subject": "배송 중 파손",
        "content": (
            "도자기 식기 세트를 받았는데 택배 상자가 심하게 찌그러져 있고 접시 2개가 깨져 있었습니다. "
            "택배 기사분이 던지듯 놓고 가셨어요. 교환 또는 부분 환불이 가능한지 확인 부탁드립니다."
        ),
    },
    # --- 일반 관련 (CSR-007 ~ CSR-009) ---
    {
        "id": "CSR-007",
        "customer_name": "오하나",
        "customer_email": "hana.oh@example.com",
        "subject": "회원 등급 기준 문의",
        "content": (
            "현재 실버 등급인데 골드 등급으로 올라가려면 얼마나 더 구매해야 하나요? "
            "골드 등급의 적립금 비율과 추가 혜택도 함께 안내받고 싶습니다."
        ),
    },
    {
        "id": "CSR-008",
        "customer_name": "윤서준",
        "customer_email": "seojun.yoon@example.com",
        "subject": "상품 재입고 문의",
        "content": (
            "나이키 에어맥스 270 (블랙, 270mm)이 품절인데 재입고 예정이 있나요? "
            "재입고 알림은 신청해 두었는데 대략 언제쯤 들어올지 궁금합니다. 다른 색상은 재고가 있더라고요."
        ),
    },
    {
        "id": "CSR-009",
        "customer_name": "강예린",
        "customer_email": "yerin.kang@example.com",
        "subject": "마케팅 수신 동의 철회 방법",
        "content": (
            "마케팅 정보 수신 동의를 철회하고 싶은데 설정 메뉴에서 해당 항목을 찾지 못하겠습니다. "
            "수신 거부 방법을 단계별로 안내해 주세요."
        ),
    },
]


def write_inquiries() -> list[Path]:
    """INQUIRIES 정의를 csr/ 디렉터리에 JSON 파일로 저장하고 생성 경로 목록을 반환함."""
    # parents=True: 중간 디렉터리까지 한 번에 생성, exist_ok=True: 이미 있어도 오류 없이 통과
    CSR_DIR.mkdir(parents=True, exist_ok=True)

    created: list[Path] = []
    for inquiry in INQUIRIES:
        file_path = CSR_DIR / f"{inquiry['id']}.json"
        # with 블록을 벗어나면 파일이 자동으로 닫힘. 한글이 깨지지 않도록 UTF-8로 저장함
        with open(file_path, "w", encoding="utf-8") as f:
            # ensure_ascii=False: 한글을 \uXXXX로 이스케이프하지 않고 그대로 저장함
            json.dump(inquiry, f, ensure_ascii=False, indent=2)
        created.append(file_path)
    return created


def main() -> None:
    """문의 샘플을 생성하고 결과를 콘솔에 출력함."""
    created = write_inquiries()
    print(f"고객 문의 샘플 {len(created)}건을 생성했습니다 -> {CSR_DIR}")
    for path in created:
        print(f"  - {path.name}")


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
