# 데이터 구조

n8n에서 노드 간에 전달되는 모든 데이터는 객체의 배열임. 다음과 같은 구조를 가짐:

```json
[
	{
		// 대부분의 데이터:
		// 각 항목을 'json' 키를 가진 다른 객체로 감싸기
		"json": {
			// 예시 데이터
			"apple": "beets",
			"carrot": {
				"dill": 1
			}
		},
		// 바이너리 데이터:
		// 각 항목을 'binary' 키를 가진 다른 객체로 감싸기
		"binary": {
			// 예시 데이터
			"apple-picture": {
				"data": "....", // Base64로 인코딩된 바이너리 데이터 (필수)
				"mimeType": "image/png", // 가능한 경우 설정 권장 (선택)
				"fileExtension": "png", // 가능한 경우 설정 권장 (선택)
				"fileName": "example.png", // 가능한 경우 설정 권장 (선택)
			}
		}
	},
]
```

## 참고: `json` 키 및 배열 구문 생략

0.166.0 버전부터 Function 노드 또는 Code 노드를 사용할 때, n8n은 누락된 경우 자동으로 `json` 키를 추가함.
또한 필요한 경우 자동으로 항목을 배열(`[]`)로 감쌈. 이는 Function 또는 Code 노드를 사용하는 경우에만 해당됨.
자체 노드를 구축할 때는 노드가 `json` 키를 포함한 데이터를 반환하도록 해야 함.

## 데이터 항목 처리

노드는 여러 항목을 처리할 수 있음.

예를 들어, Trello 노드를 `Create-Card`로 설정하고, 수신 데이터에서 `name-input-value`라는 속성을 사용하여
`Name`을 설정하는 표현식을 만들면, 노드는 각 항목에 대해 카드를 생성하며, 항상 현재 항목의 `name-input-value`를 선택함.

예를 들어, 다음 입력은 두 개의 카드를 생성함. 하나는 `test1`이라는 이름이고 다른 하나는 `test2`라는 이름임:

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
