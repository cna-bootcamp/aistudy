# Output (출력)

## 개요

Output node(이전의 "End")는 사용자에게 반환될 데이터를 명시적으로 정의하는 선택적 workflow 구성요소임.

## 주요 사항

**목적**: Output node는 LLM 응답과 같이 최종 사용자에게 반환되어야 하는 workflow 데이터를 지정함.

**요구사항**: "최소 하나의 출력 변수를 지정해야 함; 그렇지 않으면 아무것도 반환되지 않음."

**애플리케이션 유형**:
- Output node는 Workflow 애플리케이션에 적용됨
- Chatflow는 대화 응답을 위해 대신 Answer node를 사용함

**API 동작**: Output node가 없는 Workflow는 백엔드 서비스 API로 노출될 때 값을 제공하지 않음.

**구성**: 사용자는 Output node에 출력 변수를 추가하여 전달될 정보를 결정함.

문서는 이 구성요소가 이전 명명 규칙에서의 변화를 나타내며,
이름이 변경된 node가 이제 workflow 아키텍처에서 보다 명시적으로 정의된 목적을 제공한다고 설명함.
