# 노드 내 데이터 흐름 (Data Flow Within Nodes)

## 개요

노드는 여러 아이템을 처리할 수 있음.
예를 들어, Trello 노드를 `Create-Card`로 설정하고
수신 데이터의 `name-input-value` 속성을 사용하는 표현식으로 Name을 설정하면,
노드는 각 아이템에 대해 카드를 생성하며, 항상 현재 아이템의 `name-input-value`를 선택함.

## 예시

아래 입력은 두 개의 카드를 생성함. 하나는 `test1`, 다른 하나는 `test2`로 명명됨:

```json
[
  {
    "name-input-value": "test1"
  },
  {
    "name-input-value": "test2"
  }
]
```

## 핵심 개념

- 노드는 입력 아이템을 순회하며 각 아이템에 대해 동일한 작업을 수행함
- 표현식(Expression)은 현재 처리 중인 아이템의 데이터를 참조함
- 다중 아이템 입력 시 노드는 각 아이템에 대해 한 번씩 작업을 실행함
