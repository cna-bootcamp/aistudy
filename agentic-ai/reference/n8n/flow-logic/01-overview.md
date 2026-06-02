# Flow Logic 개요

n8n은 workflow에서 복잡한 로직을 표현할 수 있는 기능을 제공함

이 섹션에서 다루는 내용:

- 조건부 분기 (Splitting with conditionals)
- 데이터 병합 (Merging data)
- 루핑 (Looping)
- 대기 (Waiting)
- 서브 워크플로우 (Sub-workflows)
- 오류 처리 (Error handling)
- 다중 브랜치 워크플로우의 실행 순서 (Execution order in multi-branch workflows)

## 관련 섹션

n8n의 데이터 구조 (Data structure) 및 node 내 데이터 흐름 (Data flow within nodes)에 대한 이해 필요

로직 구축 시 사용하는 n8n의 Core nodes:

- 분기: IF 및 Switch
- 병합: Merge, Compare Datasets, Code
- 루핑: IF 및 Loop Over Items
- 대기: Wait
- 서브 워크플로우 생성: Execute Workflow 및 Execute Workflow Trigger
- 오류 처리: Stop And Error 및 Error Trigger
