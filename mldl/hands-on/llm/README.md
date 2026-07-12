# Transformer Lab: 텍스트 기반 언어모델 실습 샘플앱

Self-Attention부터 인코더-디코더 Transformer까지 PyTorch로 직접 구현하여 동작 원리를 눈으로 확인하는 실습용
샘플앱임. "종합실습: 간단한 언어모델 구현(텍스트 기반, 3.5시간)" 세션에서 바로 시연 가능한 형태로 구성함.

## 참고 자료

트랜스포머 개념 설명·수식·예시는 아래 자료의 "언어 모델을 위한 ANN: 어텐션 메커니즘과 트랜스포머" 섹션을
참고함.

- <https://github.com/cna-bootcamp/aistudy/blob/main/start-here/혼자서공부하는%20MLDL.md>

본 샘플앱은 위 자료의 다음 요소를 코드로 그대로 재현함.

- Self-Attention 수식: `Attention(Q, K, V) = softmax(QK^T / √d_k) × V`
- Multi-Head Attention: d_model을 num_heads개로 분할 후 병렬 계산·연결(concat)
- 위치 인코딩(Positional Encoding): sin/cos 고정 함수 방식(원조 Transformer 방식)
- 인코더 블록: Multi-Head Self-Attention → Add & Norm → FFN → Add & Norm
- 디코더 블록: Masked Self-Attention → Add & Norm → Cross-Attention → Add & Norm → FFN → Add & Norm
- Feed Forward Network: `FFN(x) = ReLU(xW1 + b1)W2 + b2` (d_model → d_model×4 → d_model)
- 가중치 공유(Weight Tying): 디코더 입력 임베딩과 출력 projection 가중치 공유

## 이 샘플앱이 하는 일

**이커머스 상품 문의(고객 지원)** 도메인 글로서리(`data/glossary.json`)로 한국어→영어 문장 100개를 자동
생성하고, 미니 Transformer를 처음부터(from scratch) 학습시켜 아래를 실습함.

1. 문장이 토큰화·임베딩되어 Self-Attention으로 문맥을 얻는 과정
2. Multi-Head Attention이 여러 헤드로 분할·병렬 계산되는 과정
3. 디코더가 Masked Self-Attention으로 미래 토큰을 가리고, Cross-Attention으로 인코더 출력을 참조하며 한
   단어씩 순차 생성(auto-regressive)하는 과정
4. 학습된 모델이 Cross-Attention 가중치를 실제로 어떻게 분배하는지 확인
5. 학습 데이터에서 일부 조합을 held-out으로 빼두고, 모델이 처음 보는 조합을 얼마나 정확히 번역하는지
   확인(일반화 vs 암기의 경계를 눈으로 확인)

`nn.Transformer`나 HuggingFace `transformers` 라이브러리를 쓰지 않고 Q/K/V, 스케일링, softmax, 마스킹을
직접 텐서 연산으로 구현함 — "동작 원리 이해"가 목적이므로 내부가 보이는 코드로 작성함.

## 도메인 데이터 생성 방식

문장을 하나씩 손으로 쓰는 대신, 도메인 개체를 사전(글로서리) 형태로 정의하고 문형 템플릿에 조합해 자동
생성함.

- `data/glossary.json`: 주체(고객/구매자/상담원/판매자), 대상(주문/배송/환불/교환/재고/리뷰/쿠폰/결제),
  술어(문의하다/요청하다/확인하다/취소하다/처리하다/등록하다/발송하다 + 상태술어 지연되다/완료되다)를
  KO/EN 쌍으로 정의
- `data/build_dataset.py`: 글로서리를 두 문형 템플릿에 조합해 문장을 생성함
  - A. 행위형: `{주체}{이/가} {대상}{을/를} {술어}` — 예) 고객이 배송을 문의한다 → the customer inquires
    about the delivery
  - B. 상태형: `{대상}{이/가} {상태술어}` — 예) 배송이 지연된다 → the delivery is delayed
  - 한국어 조사(이/가, 을/를)는 앞 글자의 받침(Hangul 종성) 유무를 유니코드로 계산해 자동 선택함 —
    글로서리에는 사전형만 저장하면 됨
- 조합 가능한 전체 240문장 중 100문장은 학습(`ko_en_pairs.txt`), 20문장은 held-out
  (`ko_en_pairs_heldout.txt`)으로 무작위 분리(seed 고정, 재현 가능)

다른 도메인으로 바꾸려면 `glossary.json`의 단어 목록만 교체하고 `python data/build_dataset.py`를 다시
실행하면 됨 — 토크나이저·모델 코드는 변경할 필요 없음(여전히 공백 구분 단어 수준이면 됨).

## 파일 구성

```
output/llm/
├── requirements.txt
├── data/
│   ├── glossary.json             # 도메인 언어사전(주체/대상/술어, KO-EN)
│   ├── build_dataset.py          # 글로서리 → 문장 쌍 자동 생성 스크립트
│   ├── ko_en_pairs.txt           # 학습용 100문장 (생성됨)
│   └── ko_en_pairs_heldout.txt   # 일반화 테스트용 20문장 (생성됨, 학습에 사용 안 함)
├── transformer_lab/
│   ├── tokenizer.py              # 공백 기준 word-level 토크나이저·Vocab
│   ├── positional_encoding.py    # sin/cos 위치 인코딩
│   ├── attention.py              # scaled_dot_product_attention, MultiHeadAttention
│   ├── feed_forward.py           # PositionwiseFeedForward
│   ├── masks.py                  # padding mask, causal(미래 차단) mask
│   ├── layers.py                 # EncoderLayer, DecoderLayer
│   └── transformer.py            # Encoder, Decoder, Transformer(weight tying 포함)
├── attention_demo.py             # 학습 불필요 — Self-/Multi-Head Attention 수치 워크스루
├── train.py                      # 데이터로 모델 학습, checkpoint.pt·loss 기록 저장
├── translate.py                  # 학습된 모델로 번역 + Cross-Attention 출력
├── generate_web_data.py          # 실제 실행 데이터를 모아 web/data.js로 내보냄
└── web/
    ├── index.html                # 시각화 페이지 (웹 서버로 열기 — "실행 방법" 5번 참고)
    ├── style.css
    ├── app.js
    └── data.js                   # generate_web_data.py가 생성 (재실행 시 갱신)
```

## 설치

Python 3.10 이상 필요(타입 힌트에 `X | None` 문법 사용). PyTorch(CPU 버전)만 있으면 실행 가능하며, GPU는
필요하지 않음.

### 1) 가상환경(venv) 생성

```bash
cd output/llm
python -m venv venv
```

### 2) 가상환경 활성화 (OS·셸별)

| 환경 | 활성화 명령 |
|---|---|
| Windows + Git Bash | `source venv/Scripts/activate` |
| Windows + PowerShell | `.\venv\Scripts\Activate.ps1` |
| macOS | `source venv/bin/activate` |
| Linux | `source venv/bin/activate` |

PowerShell에서 스크립트 실행이 차단되면(실행 정책 오류) 아래 명령을 한 번 실행한 뒤 다시 활성화함.

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

활성화되면 프롬프트 앞에 `(venv)`가 표시됨. 작업을 마친 뒤에는 `deactivate` 명령으로 빠져나옴.

### 3) 의존성 설치

```bash
pip install -r requirements.txt
```

## 실행 방법

아래 각 단계의 **웹 시각화** 링크는 로컬 웹 서버(9090 포트)가 켜져 있어야 열림. 미리 켜두면 편함(자세한
설명은 5번 참고).

```bash
cd web && python -m http.server 9090   # http://localhost:9090 접속
```

### 1) 학습 없이 Attention 원리만 확인 — `attention_demo.py`

"나는 사과를 먹었다" 문장에서 "먹었다"가 다른 토큰을 attention하는 과정을 QK^T → 스케일링 → softmax →
가중합 순서로 그대로 출력함. 참고 자료의 수치 예시와 동일한 단계 구성임.

```bash
python attention_demo.py
```

Windows 콘솔에서 한글이 깨질 경우 아래처럼 UTF-8을 강제함.

```bash
# PowerShell
$env:PYTHONUTF8=1; python attention_demo.py
# Git Bash / cmd
PYTHONUTF8=1 python attention_demo.py
```

**웹 시각화**: [http://localhost:9090/#attention](http://localhost:9090/#attention) — 위 4단계를 버튼으로
하나씩(또는 자동 재생으로) 넘겨보며 막대그래프로 확인함. Multi-Head Attention의 4개 헤드 결과도 함께 나옴.

### 2) 도메인 데이터 생성 — `data/build_dataset.py`

```bash
python data/build_dataset.py
```

실제 실행 결과.

```
glossary combinations available: 240
  train   : 100 -> data\ko_en_pairs.txt
  heldout :  20 -> data\ko_en_pairs_heldout.txt
  unused  : 120 (left in the glossary's combinatorial pool, not written out)
```

### 3) 번역 모델 학습 — `train.py`

```bash
python train.py
```

실행 시 epoch별 loss가 출력되고 `checkpoint.pt`가 저장됨. 실제 실행 결과(발췌).

```
loaded 100 sentence pairs | src_vocab=32 tgt_vocab=29
epoch    1 | loss 49.5667
epoch  100 | loss 2.9380
epoch  200 | loss 1.3735
epoch  300 | loss 0.3697
epoch  400 | loss 0.0807
saved checkpoint to checkpoint.pt
```

**웹 시각화**: [http://localhost:9090/#training](http://localhost:9090/#training) — 400 epoch 전체 loss
곡선을 재생 버튼으로 처음부터 그려보며 학습 진행을 눈으로 확인함(로그 스케일 전환 가능).

### 4) 번역 + Cross-Attention 확인 — `translate.py`

학습 문장(정확히 재현)

```bash
python translate.py --sentence "고객이 쿠폰을 취소한다"
```

```
입력(source) : 고객이 쿠폰을 취소한다
번역(output) : the customer cancels the coupon
```

held-out 문장(학습에 없던 조합, 정확히 일반화)

```bash
python translate.py --sentence "상담원이 배송을 등록한다"
```

```
입력(source) : 상담원이 배송을 등록한다
번역(output) : the agent registers the delivery
```

글로서리 조합 중 학습·held-out 어디에도 없던 문장(순수 미사용 조합)도 정확히 생성함.

```bash
python translate.py --sentence "고객이 결제를 발송한다"
```

```
입력(source) : 고객이 결제를 발송한다
번역(output) : the customer sends out the payment
```

**웹 시각화**: [http://localhost:9090/#translate](http://localhost:9090/#translate) — 예문을 골라 실행하면
단어가 한 개씩 생성되는 과정과 Cross-Attention 히트맵을 애니메이션으로 보여줌. `결제가 지연된다` 예문을
고르면 위 오역 사례(아래 "한계 및 주의사항" 참고)를 빨간 note box로 바로 확인할 수 있음.

### 5) 웹 시각화 페이지 생성 — `generate_web_data.py`

`attention_demo.py`·`train.py`(체크포인트의 loss 기록)·`translate.py`(예문 4개의 Cross-Attention)가 만든
실제 데이터를 모아 `web/data.js`로 내보냄. 학습을 다시 하면 이 명령도 다시 실행해야 웹 페이지 숫자가 갱신됨.

```bash
python generate_web_data.py
```

```
wrote web/data.js
```

이후 웹 서버로 `web/` 디렉터리를 서빙해서 브라우저로 접속함.

```bash
cd web && python -m http.server 9090   # http://localhost:9090 접속
```

- 위 각 단계의 "웹 시각화" 링크(`http://localhost:9090/#attention` 등)가 바로 이 서버를 가리킴
- `data.js`를 `<script>` 태그로 불러오는 방식이라 서버 없이 `web/index.html`을 더블클릭해서 열어도 동작은
  하지만, 팀원과 같은 링크를 공유하거나 여러 브라우저 탭에서 앵커(`#attention` 등)로 바로 이동하려면
  서버로 여는 방식을 권장함

## 라이브러리 최신성 검토 (context7 MCP)

context7로 PyTorch 최신 문서(2.12)를 조회하여 아래 항목을 점검·수정함.

- **`torch.load` 보안 설정**: `translate.py`가 `weights_only=False`로 체크포인트를 로드하던 부분을
  `weights_only=True`로 수정함. PyTorch 2.6부터 이 값이 기본값이며, 신뢰할 수 없는 체크포인트로부터의
  임의 코드 실행을 막는 현재 권장 방식임. 본 체크포인트는 tensor·str·list·dict만 담고 있어
  `weights_only=True`로도 정상 로드됨을 실행 확인함.
- **Attention 마스킹 구현 검증**: `transformer_lab/attention.py`의 `masked_fill(mask == 0, float("-inf"))`
  방식과 "True=참여, False=차단" 마스크 규약이 PyTorch 공식 `torch.nn.functional.scaled_dot_product_attention`
  참조 구현과 동일함을 문서 대조로 확인함 — 수정 불필요.
- **프로덕션 대안 명시**: 실제 서비스 코드라면 직접 구현 대신 `F.scaled_dot_product_attention`
  (FlashAttention-2 등 최적화 커널로 자동 디스패치)을 사용해야 함을 `attention.py` 상단 docstring에
  명시함. 본 샘플은 "동작 원리 이해"가 목적이라 의도적으로 각 단계를 수동 구현한 것임.

## 한계 및 주의사항

- 학습 데이터가 100문장(글로서리 조합 240개 중 일부)뿐이라 실제 번역 품질을 보여주는 것이 아니라
  Transformer 내부 동작 원리를 확인하기 위한 교육용 데모임.
- 토크나이저는 공백 분리(word-level)만 지원함. 실제 서비스에는 BPE·SentencePiece 등이 필요함.
- Cross-Attention 비율이 참고 자료의 예시(특정 단어에 90% 이상 집중)처럼 뚜렷하지 않고 20~50% 수준으로
  분산되는 경우가 있음 — 데이터가 작고 문장 길이가 짧아 소스 토큰 간 구분 신호가 약하기 때문임.
- **실제로 확인된 일반화 실패 사례**: held-out 문장 `결제가 지연된다`(the payment is delayed)를
  `the refund is delayed`로 오역함(목적어 혼동, 문형은 정확히 맞춤). 학습을 400 → 800 epoch으로 늘려도
  동일하게 실패함. 원인은 상태형 템플릿(`{대상}이/가 지연되다/완료되다`)의 조합이 8개 대상 × 2개 술어 =
  16개뿐이라 학습 노출이 행위형 템플릿(224개 조합 중 100개 학습)보다 훨씬 희소하기 때문으로 보임 —
  같은 모델이라도 글로서리에서 조합 커버리지가 낮은 슬롯은 일반화가 약해짐을 보여주는 사례임. 이 데모의
  목적(동작 원리·한계 체감)에는 오히려 유용한 관찰이라 그대로 남겨둠. 개선하려면 상태형 템플릿의 조합을
  전부(16개) 학습에 포함하거나, 상태 술어 종류를 늘려 커버리지를 넓히면 됨.
