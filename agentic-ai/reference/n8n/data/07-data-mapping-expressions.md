# 표현식 편집기에서 매핑 (Mapping in the Expressions Editor)

## 개요

표현식 편집기에서 링크된 아이템에 액세스하는 방법을 설명함.
표현식에 대한 자세한 정보(내장 변수 및 메서드 포함)는 expressions 문서를 참조할 것.
매핑 및 아이템 링킹 오류는 Item linking errors를 참조할 것.

## 이전 노드 출력의 링크된 아이템 액세스

n8n은 아이템 링킹 체인을 거슬러 올라가 지정된 노드에서 부모 아이템을 찾음:

```javascript
// 링크된 아이템 반환
{{ $("<node-name>").item }}
```

### 확장 예시

워크플로우 초기의 노드가 다음 출력 데이터를 가진 경우:

```json
[
  { "id": "23423532", "name": "Jay Gatsby" },
  { "id": "23423533", "name": "José Arcadio Buendía" },
  { "id": "23423534", "name": "Max Sendak" },
  { "id": "23423535", "name": "Zaphod Beeblebrox" },
  { "id": "23423536", "name": "Edmund Pevensie" }
]
```

이름을 추출하려면 다음 표현식을 사용:

```javascript
{{ $("<node-name>").item.json.name }}
```

## 현재 노드 입력의 링크된 아이템 액세스

노드 내에서 입력 아이템을 찾는 경우 (출력 아이템에 연결된 입력 아이템):

```javascript
// 링크된 아이템 반환
{{ $input.item }}
```

### 확장 예시

현재 노드의 입력 데이터가 위와 같은 경우, 이름을 추출하려면:

```javascript
{{ $input.item.json.name }}
```

일반적으로 드래그 앤 드롭 데이터 매핑을 사용하지만,
위와 같은 표현식을 직접 작성하는 것도 가능함.
