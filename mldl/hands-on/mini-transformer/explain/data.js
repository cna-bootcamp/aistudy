// 미니 트랜스포머(인코더-디코더) 예제 설명 데이터.
// file:// 에서도 안전하도록 window 전역 할당만 함(fetch/import 미사용).
window.EXPLAIN_DATA = {
  meta: {
    title: "미니 트랜스포머 — '하늘에 먹구름이 보이면?' 질문→답 예제",
    entry: "demo.py",
  },

  // ── 좌측 그룹 = 파일 ──────────────────────────────────────────────
  files: [
    { id: "demo", label: "demo.py", role: "데이터·학습·생성·어텐션 히트맵 (실행 진입점)" },
    { id: "model", label: "mini_transformer.py", role: "미니 트랜스포머 모델(어텐션·인코더/디코더·마스크)" },
  ],

  // ── 처리 흐름(실행 진입 → 준비 → 학습 → 생성 → 표시) ───────────────
  flow: [
    {
      step: 1,
      title: "진입 & 준비",
      label: "① 진입·준비",
      summary: "main()이 시작해 한글 폰트를 잡고, 질문/답 단어 사전(Vocab)을 만든다.",
      detail: "프로그램의 시작점 main()이 실행된다. 먼저 그래프에 한글이 깨지지 않게 폰트를 찾고, " +
        "학습 데이터에 등장하는 모든 단어를 모아 '단어↔번호' 사전 두 개(질문용·답용)를 만든다. " +
        "컴퓨터는 글자를 모르므로, 모든 단어를 먼저 번호로 바꿔야 계산할 수 있다.",
      refs: ["main", "set_korean_font", "vocab", "demo_setup"],
    },
    {
      step: 2,
      title: "토큰화 & 배치",
      label: "② 토큰화·배치",
      summary: "문장을 단어로 쪼개 번호로 바꾸고, 길이를 맞춰(패딩) 한 덩어리(배치)로 만든다.",
      detail: "문장을 공백 기준으로 단어(토큰)로 자르고, 사전을 이용해 번호 목록으로 바꾼다. " +
        "문장마다 길이가 다르므로 짧은 문장 뒤에 '빈칸(<pad>)'을 채워 길이를 맞춘 뒤, " +
        "여러 문장을 하나의 표(텐서)로 쌓는다. 이렇게 해야 여러 문장을 한꺼번에 계산할 수 있다.",
      refs: ["tokenize", "build_batches"],
    },
    {
      step: 3,
      title: "모델 조립",
      label: "③ 모델 조립",
      summary: "인코더(질문 읽기) + 디코더(답 쓰기)를 합쳐 미니 트랜스포머를 만든다.",
      detail: "부품을 조립하듯 모델을 만든다. 인코더는 질문을 읽어 '의미 요약'을 만들고, " +
        "디코더는 그 요약을 참고하며 답을 한 단어씩 쓴다. 마지막에 단어 후보 점수를 내는 출력층을 붙인다.",
      refs: ["transformer", "encoder", "decoder"],
    },
    {
      step: 4,
      title: "순서 정보 주입",
      label: "④ 위치 인코딩",
      summary: "단어 번호만으로는 순서를 모르므로, sin/cos 파도무늬로 '몇 번째 단어'인지 더해 준다.",
      detail: "트랜스포머는 단어를 동시에(병렬로) 보기 때문에 '순서' 개념이 없다. " +
        "그래서 위치마다 다른 sin/cos 파도무늬 값을 단어 벡터에 더해 '이건 1번째, 이건 2번째'라는 " +
        "순서 힌트를 심어 준다.",
      refs: ["positional_encoding"],
    },
    {
      step: 5,
      title: "어텐션(주목)",
      label: "⑤ 어텐션",
      summary: "핵심! 각 단어가 다른 어떤 단어에 얼마나 주목할지 점수를 매겨 정보를 모은다.",
      detail: "어텐션은 '지금 이 단어를 이해하려면 문장의 어느 단어를 봐야 할까?'를 점수로 계산한다. " +
        "질문(Q)과 열쇠(K)를 비교해 관련도 점수를 내고(softmax로 확률화), 그 비율로 값(V)을 섞는다. " +
        "여러 관점으로 동시에 보도록 '멀티헤드'로 나눠 계산한다.",
      refs: ["sdpa", "multihead"],
    },
    {
      step: 6,
      title: "블록 통과 (Add&Norm·FFN)",
      label: "⑥ 인코더/디코더 블록",
      summary: "어텐션으로 모은 정보를 잔차+정규화로 안정화하고, 작은 신경망(FFN)으로 더 곱씹는다.",
      detail: "인코더/디코더는 '어텐션 → 원본 더하기(잔차) → 정규화 → FFN → 다시 더하기·정규화' 블록을 쌓은 것이다. " +
        "잔차(원본을 더함)는 깊은 층에서도 학습이 잘 되게 하고, 정규화는 숫자 크기를 고르게 만든다. " +
        "디코더에는 '원문을 곁눈질하는' 크로스 어텐션이 하나 더 있다.",
      refs: ["encoder_layer", "decoder_layer", "ffn"],
    },
    {
      step: 7,
      title: "학습 (teacher forcing)",
      label: "⑦ 학습",
      summary: "정답을 한 칸 밀어 넣어(teacher forcing) 예측과 정답의 오차를 줄이도록 반복 훈련한다.",
      detail: "정답 문장을 디코더 입력으로 주되 한 칸 밀어(다음 단어를 맞히게) 넣고, " +
        "모델이 낸 단어 점수와 진짜 정답의 오차(loss)를 계산한다. 그 오차를 역전파해 가중치를 조금씩 고치는 일을 " +
        "여러 번(epoch) 반복하면 질문→답 규칙을 배운다. 미래 단어를 미리 못 보게 마스크를 씌운다.",
      refs: ["train", "make_padding_mask", "make_decoder_mask"],
    },
    {
      step: 8,
      title: "답 생성 (greedy·마스킹)",
      label: "⑧ 답 생성",
      summary: "<sos>부터 시작해 앞말만 보고(마스킹) 가장 점수 높은 단어를 하나씩 이어 붙인다.",
      detail: "학습이 끝나면 진짜로 답을 만들어 본다. '시작(<sos>)' 토큰 하나로 출발해, " +
        "지금까지 만든 답만 보고(미래 마스킹) 다음 단어 후보 중 최고점(argmax)을 골라 이어 붙인다. " +
        "'끝(<eos>)' 토큰이 나오면 멈춘다. 이것이 트랜스포머가 문장을 만드는 방식이다.",
      refs: ["answer", "make_causal_mask"],
    },
    {
      step: 9,
      title: "어텐션 시각화",
      label: "⑨ 히트맵 저장",
      summary: "답의 각 단어가 질문의 어느 단어를 봤는지 크로스 어텐션을 히트맵 그림으로 저장한다.",
      detail: "답을 만들 때 디코더가 질문의 어느 단어에 주목했는지를 색의 밝기로 그린다(히트맵). " +
        "답의 첫 단어가 질문의 '먹구름이'에 가장 밝게 쏠리면, 모델이 제대로 '주목'한 것이다. " +
        "그림은 attention_heatmap.png 파일로 저장된다.",
      refs: ["plot_attention"],
    },
  ],

  // ── 함수/블록별 소스 + 줄별 풀이 ──────────────────────────────────
  functions: [
    // ===================== demo.py =====================
    {
      id: "demo_setup",
      name: "import · 특수 토큰 · 학습 데이터",
      fileId: "demo",
      summary: "필요한 라이브러리를 불러오고, 특수 토큰과 6쌍의 질문→답 학습 데이터를 정의한다.",
      how: "파이썬은 파일 맨 위에서 import 로 외부 도구를 가져온다. 여기서는 딥러닝 도구 torch, " +
        "그래프 도구 matplotlib, 그리고 옆 파일 mini_transformer.py의 모델 부품을 가져온다. " +
        "학습 데이터는 문장 틀을 똑같이 두고 '대상' 단어만 바꿔, 모델이 그 단어에 주목하도록 설계했다.",
      terms: ["import", "torch", "matplotlib", "Agg 백엔드", "pad", "sos", "eos", "unk", "토큰"],
      lines: [
        { at: "import logging", text: "로그(실행 기록) 출력을 다루는 표준 도구를 가져온다." },
        { at: "import os", text: "파일 경로 등 운영체제 기능을 쓰기 위한 표준 도구." },
        { at: "import random", text: "난수(무작위 수) 도구. 뒤에서 결과 재현을 위해 시드를 고정할 때 쓴다." },
        { at: "import torch", text: "딥러닝 핵심 라이브러리 PyTorch. 텐서 계산과 신경망을 담당한다." },
        { at: "from torch import nn", text: "신경망 부품 모음(nn) — Linear·Embedding·LayerNorm 등을 여기서 꺼내 쓴다." },
        { at: "from torch.nn.utils.rnn import pad_sequence", text: "길이가 다른 문장들을 뒤에 빈칸을 채워 같은 길이로 맞춰 주는 도구." },
        { at: 'matplotlib.use("Agg")', text: "그래프를 화면 창 없이 파일로만 저장하는 모드로 설정(서버·자동실행에서 안전)." },
        { at: "import matplotlib.pyplot", text: "실제로 그림을 그리는 도구(plt)를 가져온다." },
        { at: "from matplotlib import font_manager", text: "시스템에 설치된 글꼴 목록을 조회하는 도구(한글 폰트 탐지용)." },
        { at: "from mini_transformer import (", text: "옆 파일의 모델과 마스크 함수들을 가져온다(로컬 모듈)." },
        { at: "    Transformer,", text: "인코더+디코더를 합친 모델 클래스." },
        { at: "    make_causal_mask,", text: "미래 단어를 못 보게 가리는 마스크 함수." },
        { at: "    make_decoder_mask,", text: "패딩+미래 가림을 합친 디코더용 마스크 함수." },
        { at: "    make_padding_mask,", text: "빈칸(<pad>) 위치를 가리는 마스크 함수." },
        { at: "특수 토큰", text: "아래 4개는 문장 자체가 아니라 '표식' 역할을 하는 특별한 토큰이다." },
        { at: "PAD, SOS, EOS, UNK =", text: "빈칸·시작·끝·모르는단어 4개 특수 토큰의 실제 글자를 한 줄로 정의." },
        { at: "SPECIALS = ", text: "특수 토큰 4개를 한 목록으로 묶는다(사전을 만들 때 맨 앞에 넣기 위함)." },
        { at: "학습 데이터", text: "아래는 모델을 가르칠 '질문→답' 예시 모음이다." },
        { at: "{대상}", text: "문장 틀은 '하늘에 __ 보이면 뭐가 생각나'로 고정하고, __(대상)만 바꾼다." },
        { at: "문장 틀을 완전히", text: "틀을 똑같이 두는 이유: 답을 가르는 유일한 단서가 '대상' 단어가 되게 하려고." },
        { at: "판별 토큰이", text: "그 결과 모델이 반드시 '대상' 단어에 주목하게 되어 어텐션 시연이 선명해진다." },
        { at: "DATA = [", text: "질문/답 6쌍을 담는 목록의 시작." },
        { at: '"비가 올 것 같아"', text: "예: '먹구름이'가 보이면 → '비가 올 것 같아' (한 쌍의 학습 예시)." },
      ],
      code: `import logging
import os
import random

import torch
from torch import nn
from torch.nn.utils.rnn import pad_sequence

import matplotlib
matplotlib.use("Agg")  # 창을 띄우지 않고 파일로 저장
import matplotlib.pyplot as plt
from matplotlib import font_manager

from mini_transformer import (
    Transformer,
    make_causal_mask,
    make_decoder_mask,
    make_padding_mask,
)

# ----------------------------------------------------------------- 특수 토큰
PAD, SOS, EOS, UNK = "<pad>", "<sos>", "<eos>", "<unk>"
SPECIALS = [PAD, SOS, EOS, UNK]

# ----------------------------------------------------------------- 학습 데이터
# "하늘에 {대상} 보이면 뭐가 생각나" → 답.
# 문장 틀을 완전히 동일하게 두고 오직 '대상' 단어만 바꾼다. 그러면 답을 가르는 유일한
# 판별 토큰이 '대상'이 되어, 모델이 반드시 그 단어에 주목하게 된다(어텐션 시연이 선명해짐).
DATA = [
    ("하늘에 먹구름이 보이면 뭐가 생각나", "비가 올 것 같아"),
    ("하늘에 별이 보이면 뭐가 생각나", "밤이 깊었나 봐"),
    ("하늘에 해가 보이면 뭐가 생각나", "아침이 밝았구나"),
    ("하늘에 무지개가 보이면 뭐가 생각나", "비가 그쳤나 봐"),
    ("하늘에 눈송이가 보이면 뭐가 생각나", "겨울이 왔구나"),
    ("하늘에 노을이 보이면 뭐가 생각나", "저녁이 되었네"),
]`,
    },
    {
      id: "tokenize",
      name: "tokenize()",
      fileId: "demo",
      summary: "문장을 공백 기준으로 단어(토큰) 목록으로 자른다.",
      how: "가장 단순한 토큰화. '하늘에 먹구름이 보이면' → ['하늘에','먹구름이','보이면']. " +
        "실무의 한국어 토큰화는 더 정교하지만, 교육용이라 공백 분리로 충분하다.",
      terms: ["토큰", "def"],
      lines: [
        { at: "def tokenize", text: "함수 정의. sentence(문장 하나)를 받아 처리한다." },
        { at: '"""공백 단위 토큰화', text: "함수 설명글(docstring). 이 함수가 무엇을 하는지 적어 둔 것." },
        { at: "return sentence.strip().split()", text: "앞뒤 공백을 지우고(strip) 공백으로 쪼갠(split) 단어 목록을 돌려준다." },
      ],
      code: `def tokenize(sentence: str):
    """공백 단위 토큰화."""
    return sentence.strip().split()`,
    },
    {
      id: "vocab",
      name: "Vocab (단어↔번호 사전)",
      fileId: "demo",
      summary: "학습 데이터의 모든 단어를 모아 '단어→번호', '번호→단어' 사전을 만든다.",
      how: "컴퓨터는 글자를 직접 계산하지 못하므로 모든 단어에 고유 번호를 매긴다. " +
        "itos(번호→단어)와 stoi(단어→번호) 두 방향 표를 만들고, 특수 토큰의 번호를 편하게 꺼내는 " +
        "지름길(pad_id 등)과 문장을 번호로 바꾸는 encode/decode를 제공한다.",
      terms: ["vocab", "특수토큰", "property", "인코딩", "디코딩"],
      lines: [
        { at: "class Vocab:", text: "'사전' 역할을 하는 클래스(관련 데이터+기능 묶음)를 정의한다." },
        { at: "단어 ↔ 정수 id", text: "이 클래스의 목적 설명: 단어와 정수 번호를 서로 바꿔 준다." },
        { at: "def __init__(self, sentences)", text: "사전을 만들 때 호출되는 초기화 함수. 문장 목록을 받는다." },
        { at: "toks = sorted({t for s in sentences", text: "모든 문장을 단어로 쪼개 중복을 없애고({}) 정렬한다." },
        { at: "self.itos = list(SPECIALS) + toks", text: "번호→단어 표. 특수 토큰 4개를 맨 앞(0~3번)에 두고 뒤에 실제 단어를 붙인다." },
        { at: "self.stoi = {t: i for i, t in enumerate", text: "단어→번호 표. itos를 뒤집어 각 단어에 순번을 매긴다." },
        { at: "def __len__(self)", text: "len(vocab)을 하면 호출되는 함수. 사전 크기를 알려 준다." },
        { at: "return len(self.itos)", text: "사전에 든 단어(특수 토큰 포함) 총개수를 돌려준다." },
        { at: "def pad_id(self)", text: "빈칸(<pad>) 토큰의 번호를 편하게 꺼내는 지름길(@property)." },
        { at: "return self.stoi[PAD]", text: "'<pad>' 글자에 매겨진 번호를 돌려준다." },
        { at: "def sos_id(self)", text: "시작(<sos>) 토큰의 번호 지름길." },
        { at: "return self.stoi[SOS]", text: "'<sos>' 글자에 매겨진 번호를 돌려준다(답 생성의 출발점)." },
        { at: "def eos_id(self)", text: "끝(<eos>) 토큰의 번호 지름길." },
        { at: "return self.stoi[EOS]", text: "'<eos>' 글자에 매겨진 번호를 돌려준다(생성 종료 신호)." },
        { at: "def encode(self, sentence, add_special=True)", text: "문장을 번호 목록으로 바꾸는 함수." },
        { at: "ids = [self.stoi.get(t, self.stoi[UNK])", text: "각 단어의 번호를 찾되, 사전에 없으면 <unk>(모르는 단어) 번호로 대체한다." },
        { at: "return [self.sos_id] + ids + [self.eos_id]", text: "옵션이 켜져 있으면 앞뒤에 <sos>/<eos>를 붙여 돌려준다(아니면 번호만)." },
        { at: "def decode(self, ids)", text: "번호 목록을 다시 사람이 읽는 문장으로 되돌리는 함수." },
        { at: 'return " ".join(self.itos[i]', text: "번호를 단어로 바꾸되 특수 토큰은 빼고 공백으로 이어 붙인다." },
      ],
      code: `class Vocab:
    """단어 ↔ 정수 id 사전."""

    def __init__(self, sentences):
        toks = sorted({t for s in sentences for t in tokenize(s)})
        self.itos = list(SPECIALS) + toks
        self.stoi = {t: i for i, t in enumerate(self.itos)}

    def __len__(self):
        return len(self.itos)

    @property
    def pad_id(self):
        return self.stoi[PAD]

    @property
    def sos_id(self):
        return self.stoi[SOS]

    @property
    def eos_id(self):
        return self.stoi[EOS]

    def encode(self, sentence, add_special=True):
        ids = [self.stoi.get(t, self.stoi[UNK]) for t in tokenize(sentence)]
        return [self.sos_id] + ids + [self.eos_id] if add_special else ids

    def decode(self, ids):
        return " ".join(self.itos[i] for i in ids if self.itos[i] not in (PAD, SOS, EOS))`,
    },
    {
      id: "set_seed",
      name: "set_seed()",
      fileId: "demo",
      summary: "난수 시드를 고정해, 실행할 때마다 같은 결과가 나오게 한다.",
      how: "딥러닝은 가중치를 무작위로 초기화하는 등 무작위성이 많다. 시드(씨앗 숫자)를 고정하면 " +
        "'무작위'가 매번 똑같이 재현되어, 수업에서 결과를 비교하기 좋다.",
      terms: ["seed", "torch"],
      lines: [
        { at: "def set_seed(seed=42)", text: "시드 값을 받아 고정하는 함수(기본값 42)." },
        { at: "random.seed(seed)", text: "파이썬 기본 난수의 시드를 고정." },
        { at: "torch.manual_seed(seed)", text: "PyTorch 난수(가중치 초기화 등)의 시드를 고정." },
      ],
      code: `def set_seed(seed=42):
    random.seed(seed)
    torch.manual_seed(seed)`,
    },
    {
      id: "set_korean_font",
      name: "set_korean_font()",
      fileId: "demo",
      summary: "그래프 라벨의 한글이 깨지지 않도록 시스템의 한글 폰트를 찾아 적용한다.",
      how: "matplotlib은 기본 폰트에 한글이 없어 □로 깨질 수 있다. 설치된 폰트를 뒤져 " +
        "한글 폰트가 있으면 그것을 쓰도록 설정한다.",
      terms: ["matplotlib", "폰트"],
      lines: [
        { at: "def set_korean_font", text: "한글 폰트를 찾아 적용하는 함수." },
        { at: "그래프의 한글이 깨지지", text: "함수 설명글: 그래프 한글 깨짐 방지가 목적." },
        { at: 'logging.getLogger("matplotlib.mathtext")', text: "일부 특수문자(−) 관련 경고 메시지를 숨긴다(보기 깔끔하게)." },
        { at: 'plt.rcParams["axes.unicode_minus"]', text: "마이너스 기호가 깨지지 않도록 설정." },
        { at: "installed = {f.name for f in font_manager", text: "지금 컴퓨터에 설치된 폰트 이름을 모두 모은다." },
        { at: 'for name in ["Malgun Gothic"', text: "대표 한글 폰트 후보들을 순서대로 확인한다(윈도·맥·나눔 등)." },
        { at: "if name in installed:", text: "후보 폰트가 실제로 설치돼 있으면," },
        { at: 'plt.rcParams["font.family"] = name', text: "그 폰트를 그래프 기본 글꼴로 지정하고," },
        { at: "return name", text: "적용한 폰트 이름을 돌려주며 끝낸다." },
        { at: "return None", text: "한글 폰트를 하나도 못 찾으면 None을 돌려준다(라벨이 □로 보일 수 있음)." },
      ],
      code: `def set_korean_font():
    """그래프의 한글이 깨지지 않도록 시스템의 한글 폰트를 탐지해 적용."""
    logging.getLogger("matplotlib.mathtext").setLevel(logging.ERROR)  # U+2212 글리프 경고 숨김
    plt.rcParams["axes.unicode_minus"] = False
    installed = {f.name for f in font_manager.fontManager.ttflist}
    for name in ["Malgun Gothic", "AppleGothic", "NanumGothic", "Noto Sans CJK KR"]:
        if name in installed:
            plt.rcParams["font.family"] = name
            return name
    return None  # 한글 폰트를 못 찾으면 라벨이 □로 보일 수 있음(실행에는 지장 없음)`,
    },
    {
      id: "build_batches",
      name: "build_batches()",
      fileId: "demo",
      summary: "질문/답 문장들을 번호 텐서로 바꾸고, 길이를 맞춰(패딩) 한 배치로 쌓는다.",
      how: "문장마다 단어 수가 다르므로 짧은 문장 뒤에 <pad>를 채워 길이를 통일한 뒤, " +
        "여러 문장을 하나의 사각형 텐서로 만든다. 그래야 GPU/CPU가 한꺼번에 계산할 수 있다.",
      terms: ["텐서", "pad_sequence", "패딩", "배치", "인코딩"],
      lines: [
        { at: "def build_batches", text: "질문·답 쌍 목록과 두 사전을 받아 배치 텐서를 만드는 함수." },
        { at: "질문/답을 id 텐서로", text: "함수 설명글: 문장을 번호 텐서로 바꾸고 패딩한다." },
        { at: "src = [torch.tensor(src_vocab.encode", text: "질문(원문)들을 번호로 바꿔 텐서 목록으로 만든다(특수토큰 없이)." },
        { at: "tgt = [torch.tensor(tgt_vocab.encode", text: "답들을 번호로 바꿔 텐서 목록으로 만든다(<sos>/<eos> 포함)." },
        { at: "src_ids = pad_sequence(", text: "질문들의 길이를 맞춰(뒤에 <pad>) 하나의 사각형 텐서로 쌓는다." },
        { at: "tgt_ids = pad_sequence(", text: "답들도 같은 방식으로 패딩해 하나의 텐서로 쌓는다." },
        { at: "return src_ids, tgt_ids", text: "질문 배치와 답 배치 두 텐서를 돌려준다." },
      ],
      code: `def build_batches(pairs, src_vocab, tgt_vocab):
    """질문/답을 id 텐서로 바꾸고 패딩해 배치로 만든다."""
    src = [torch.tensor(src_vocab.encode(q, add_special=False)) for q, _ in pairs]
    tgt = [torch.tensor(tgt_vocab.encode(a, add_special=True)) for _, a in pairs]
    src_ids = pad_sequence(src, batch_first=True, padding_value=src_vocab.pad_id)
    tgt_ids = pad_sequence(tgt, batch_first=True, padding_value=tgt_vocab.pad_id)
    return src_ids, tgt_ids`,
    },
    {
      id: "train",
      name: "train()",
      fileId: "demo",
      summary: "teacher forcing으로 질문→답 매핑을 여러 epoch 반복 학습하고 loss 이력을 반환한다.",
      how: "정답을 한 칸 밀어(다음 단어를 맞히게) 디코더에 넣고, 예측과 정답의 오차(loss)를 계산해 " +
        "역전파로 가중치를 조금씩 고친다. 이 과정을 epochs번(여기선 400번) 반복하면 규칙을 배운다. " +
        "미래 단어를 미리 못 보게 마스크를 씌우는 것이 핵심.",
      terms: ["teacher forcing", "손실", "CrossEntropyLoss", "Adam", "역전파", "epoch", "logits", "마스킹"],
      lines: [
        { at: "def train(pairs, src_vocab, tgt_vocab, epochs", text: "학습 함수. 데이터·사전과 반복 횟수(epochs)·학습률(lr)을 받는다." },
        { at: "teacher forcing 으로", text: "함수 설명글: teacher forcing 방식으로 학습하고 loss 이력을 반환." },
        { at: "set_seed(seed)", text: "결과 재현을 위해 난수 시드를 고정한다." },
        { at: "src_ids, tgt_ids = build_batches(", text: "질문·답을 번호 텐서 배치로 변환한다." },
        { at: "# 위치 인코딩 용량은 생성 길이", text: "설명 주석: 위치 인코딩 길이를 생성 길이(최대 20)까지 넉넉히 잡는 이유." },
        { at: "max_len = max(src_ids.size(1)", text: "질문·답·생성 길이 중 가장 긴 것에 여유(+2)를 둬 위치 인코딩 용량을 정한다." },
        { at: "model = Transformer(len(src_vocab)", text: "질문 사전·답 사전 크기에 맞춰 미니 트랜스포머 모델을 만든다." },
        { at: "opt = torch.optim.Adam(", text: "가중치를 어떻게 고칠지 정하는 최적화기 Adam을 준비한다." },
        { at: "crit = nn.CrossEntropyLoss(", text: "예측과 정답의 오차를 재는 기준. <pad> 위치는 채점에서 제외(ignore_index)." },
        { at: "dec_in, dec_tgt = tgt_ids[:, :-1]", text: "디코더 입력은 답의 마지막을 뺀 것, 정답은 답을 한 칸 민 것(다음 단어 맞히기)." },
        { at: "src_mask = make_padding_mask(src_ids, src_vocab.pad_id)", text: "질문의 <pad> 위치를 어텐션에서 무시하도록 마스크를 만든다." },
        { at: "history = []", text: "매 epoch의 loss를 기록할 빈 목록." },
        { at: "model.train()", text: "모델을 '학습 모드'로 전환(dropout 등이 켜짐)." },
        { at: "for ep in range(1, epochs + 1):", text: "1부터 epochs까지 학습을 반복한다(한 바퀴 = 1 epoch)." },
        { at: "tgt_mask = make_decoder_mask(dec_in", text: "디코더용 마스크(패딩+미래 가림)를 만든다 — 미래 단어를 못 보게." },
        { at: "logits = model(src_ids, dec_in, src_mask, tgt_mask)", text: "모델에 통과시켜 각 위치의 다음 단어 후보 점수(logits)를 얻는다." },
        { at: "loss = crit(logits.reshape(-1", text: "예측 점수와 실제 정답 사이의 오차(loss)를 계산한다." },
        { at: "opt.zero_grad()", text: "이전 단계에서 쌓인 기울기 값을 0으로 초기화." },
        { at: "loss.backward()", text: "오차를 거꾸로 전파(역전파)해 각 가중치의 기울기를 계산." },
        { at: "opt.step()", text: "계산된 기울기 방향으로 가중치를 실제로 조금 고친다." },
        { at: "history.append(", text: "이번 epoch의 loss 숫자를 기록에 추가." },
        { at: "if ep == 1 or ep % 100 == 0:", text: "첫 번째와 100 단위 epoch일 때만," },
        { at: 'print(f"  epoch {ep:4d}', text: "진행 상황(epoch 번호와 loss)을 화면에 출력한다." },
        { at: "return model, history", text: "학습된 모델과 loss 이력을 돌려준다." },
      ],
      code: `def train(pairs, src_vocab, tgt_vocab, epochs=400, lr=3e-4, seed=42):
    """teacher forcing 으로 질문→답 매핑을 학습. loss 이력을 반환."""
    set_seed(seed)
    src_ids, tgt_ids = build_batches(pairs, src_vocab, tgt_vocab)
    # 위치 인코딩 용량은 생성 길이(answer()의 max_len=20)까지 넉넉히 확보 — 짧은 답에서도 안전
    max_len = max(src_ids.size(1), tgt_ids.size(1), 20) + 2
    model = Transformer(len(src_vocab), len(tgt_vocab), max_len=max_len)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    crit = nn.CrossEntropyLoss(ignore_index=tgt_vocab.pad_id)

    dec_in, dec_tgt = tgt_ids[:, :-1], tgt_ids[:, 1:]
    src_mask = make_padding_mask(src_ids, src_vocab.pad_id)
    history = []
    model.train()
    for ep in range(1, epochs + 1):
        tgt_mask = make_decoder_mask(dec_in, tgt_vocab.pad_id)  # 패딩 + 미래 가림
        logits = model(src_ids, dec_in, src_mask, tgt_mask)
        loss = crit(logits.reshape(-1, logits.size(-1)), dec_tgt.reshape(-1))
        opt.zero_grad()
        loss.backward()
        opt.step()
        history.append(loss.item())
        if ep == 1 or ep % 100 == 0:
            print(f"  epoch {ep:4d} | loss {loss.item():.4f}")
    return model, history`,
    },
    {
      id: "answer",
      name: "answer()",
      fileId: "demo",
      summary: "질문을 받아 greedy로 한 단어씩 답을 생성하고, 생성 로그·답·크로스 어텐션을 반환한다.",
      how: "학습 때와 달리 정답이 없다. <sos>로 시작해, 지금까지 만든 답만 보고(미래 마스킹) " +
        "다음 단어로 가장 점수 높은 것(argmax)을 골라 이어 붙인다. <eos>가 나오면 멈춘다. " +
        "마지막에 완성된 답 전체로 한 번 더 통과시켜 시각화용 크로스 어텐션을 안정적으로 얻는다.",
      terms: ["no_grad", "eval", "greedy", "argmax", "마스킹", "크로스어텐션"],
      lines: [
        { at: "@torch.no_grad()", text: "이 함수 안에서는 기울기 계산을 끈다(학습이 아니라 '생성'이라 불필요·빠름)." },
        { at: "def answer(model, src_vocab, tgt_vocab, question", text: "학습된 모델과 질문을 받아 답을 만드는 함수." },
        { at: "질문에 대한 답을 greedy", text: "함수 설명글: greedy(매 순간 최고점) 방식으로 한 단어씩 생성." },
        { at: "model.eval()", text: "모델을 '평가 모드'로(dropout을 꺼 결과를 안정화)." },
        { at: "src_ids = torch.tensor([src_vocab.encode(question", text: "질문을 번호 텐서로 바꾼다(배치 크기 1)." },
        { at: "src_mask = make_padding_mask(src_ids, src_vocab.pad_id)", text: "질문의 <pad> 위치를 무시할 마스크를 만든다." },
        { at: "enc = model.encode(src_ids, src_mask)", text: "인코더로 질문을 한 번만 읽어 '의미 요약'을 만들어 둔다(생성 내내 재사용)." },
        { at: "gen = [tgt_vocab.sos_id]", text: "생성 결과를 담을 목록. 시작 토큰 <sos> 하나로 출발한다." },
        { at: "steps = []", text: "'지금까지 입력 → 새로 고른 단어'를 기록할 목록(마스킹 시연용)." },
        { at: "for _ in range(max_len):", text: "최대 max_len(20)번까지 한 단어씩 반복 생성한다." },
        { at: "logits = model.decode_step(tgt, enc, tgt_mask, src_mask)", text: "현재까지의 답으로 디코더를 돌려 다음 단어 후보 점수를 얻는다." },
        { at: "nxt = logits[0, -1].argmax().item()", text: "마지막 위치에서 가장 점수 높은 단어의 번호를 고른다(greedy)." },
        { at: "steps.append(", text: "'현재까지 만든 답'과 '새로 고른 단어'를 기록에 남긴다." },
        { at: "gen.append(nxt)", text: "고른 단어를 답 목록에 이어 붙인다." },
        { at: "if nxt == tgt_vocab.eos_id:", text: "고른 단어가 끝(<eos>) 토큰이면," },
        { at: "            break", text: "생성을 멈춘다(문장 완성)." },
        { at: "# 완성된 답 전체로 다시", text: "이 아래는 완성된 답 전체로 한 번 더 통과시켜 크로스 어텐션을 안정적으로 얻는 부분." },
        { at: "cross = model.decoder.layers[-1].cross_attn", text: "마지막 디코더 층의 크로스 어텐션(여러 헤드 평균)을 꺼낸다 — 히트맵 재료." },
        { at: "return steps, tgt_vocab.decode(gen), cross", text: "생성 로그, 완성된 답(문장), 크로스 어텐션을 함께 돌려준다." },
      ],
      code: `@torch.no_grad()
def answer(model, src_vocab, tgt_vocab, question, max_len=20):
    """질문에 대한 답을 greedy 로 한 단어씩 생성. (생성 스텝 로그, 답, 크로스 어텐션) 반환."""
    model.eval()
    src_ids = torch.tensor([src_vocab.encode(question, add_special=False)])
    src_mask = make_padding_mask(src_ids, src_vocab.pad_id)
    enc = model.encode(src_ids, src_mask)

    gen = [tgt_vocab.sos_id]
    steps = []  # (지금까지 입력, 새로 고른 단어) — 마스킹 시연용
    for _ in range(max_len):
        tgt = torch.tensor([gen])
        tgt_mask = make_causal_mask(tgt.size(1), tgt.device)
        logits = model.decode_step(tgt, enc, tgt_mask, src_mask)
        nxt = logits[0, -1].argmax().item()  # 마지막 위치의 최고점 단어
        steps.append((tgt_vocab.decode(gen), tgt_vocab.itos[nxt]))
        gen.append(nxt)
        if nxt == tgt_vocab.eos_id:
            break

    # 완성된 답 전체로 다시 한 번 통과시켜 크로스 어텐션을 안정적으로 확보
    tgt = torch.tensor([gen])
    tgt_mask = make_causal_mask(tgt.size(1), tgt.device)
    model.decode_step(tgt, enc, tgt_mask, src_mask)
    cross = model.decoder.layers[-1].cross_attn.last_attn_weights[0].mean(0)  # (tgt_len, src_len)
    return steps, tgt_vocab.decode(gen), cross`,
    },
    {
      id: "plot_attention",
      name: "plot_attention()",
      fileId: "demo",
      summary: "답의 각 단어가 질문의 어느 단어에 주목했는지 크로스 어텐션을 히트맵 그림으로 저장한다.",
      how: "가로축=질문 단어, 세로축=답 단어인 격자에, 주목 정도를 색의 밝기로 칠한다. " +
        "밝을수록 그 질문 단어를 많이 봤다는 뜻. 결과를 PNG 파일로 저장한다.",
      terms: ["히트맵", "matplotlib", "크로스어텐션"],
      lines: [
        { at: "def plot_attention", text: "질문·답·크로스어텐션·저장경로를 받아 히트맵을 그리는 함수." },
        { at: "답의 각 단어가 질문의", text: "함수 설명글: 어느 단어에 주목했는지 히트맵으로 저장." },
        { at: "q_tokens = tokenize(question)", text: "질문을 단어 목록으로 쪼갠다(가로축 라벨)." },
        { at: "a_tokens = tokenize(answer_text)", text: "답을 단어 목록으로 쪼갠다(세로축 라벨)." },
        { at: "if not a_tokens or not q_tokens:", text: "질문이나 답이 비어 있으면 그릴 것이 없으므로," },
        { at: "        return False", text: "그리지 않고 False를 돌려주며 끝낸다(방어 코드)." },
        { at: "# row i (입력 위치 i)", text: "설명 주석: 답의 i번째 단어를 예측한 행을 앞에서부터 사용한다는 뜻." },
        { at: "weights = cross[: len(a_tokens)", text: "어텐션 값에서 답·질문 길이만큼 잘라 그릴 격자(숫자표)를 만든다." },
        { at: "fig, ax = plt.subplots(", text: "그림 도화지(fig)와 그래프 영역(ax)을 단어 수에 맞춰 만든다." },
        { at: "im = ax.imshow(weights", text: "격자 값을 색 이미지(히트맵)로 그린다(viridis 색상)." },
        { at: "ax.set_xticks(range(len(q_tokens)))", text: "가로축 눈금 위치를 질문 단어 수만큼 잡는다." },
        { at: "ax.set_xticklabels(q_tokens", text: "가로축 눈금에 질문 단어를 라벨로 붙인다(비스듬히)." },
        { at: "ax.set_yticks(range(len(a_tokens)))", text: "세로축 눈금 위치를 답 단어 수만큼 잡는다." },
        { at: "ax.set_yticklabels(a_tokens)", text: "세로축 눈금에 답 단어를 라벨로 붙인다." },
        { at: 'ax.set_xlabel("질문 토큰', text: "가로축 제목을 '질문 토큰(원문)'으로." },
        { at: 'ax.set_ylabel("생성한 답 토큰")', text: "세로축 제목을 '생성한 답 토큰'으로." },
        { at: 'ax.set_title(f"크로스 어텐션', text: "그래프 제목을 만든 답 문장으로 붙인다." },
        { at: "fig.colorbar(im", text: "색이 값의 크기를 뜻하도록 옆에 색 막대(범례)를 붙인다." },
        { at: "fig.tight_layout()", text: "라벨이 잘리지 않게 여백을 자동 정리." },
        { at: "fig.savefig(out_path", text: "완성된 그림을 지정한 경로에 PNG로 저장한다." },
        { at: "plt.close(fig)", text: "메모리 절약을 위해 그림 객체를 닫는다." },
        { at: "    return True", text: "그리기에 성공했음을 True로 알린다." },
      ],
      code: `def plot_attention(question, answer_text, cross, out_path):
    """답의 각 단어가 질문의 어느 단어에 주목했는지 히트맵으로 저장."""
    q_tokens = tokenize(question)
    a_tokens = tokenize(answer_text)
    if not a_tokens or not q_tokens:  # 답이 비면 그릴 것이 없음(방어)
        return False
    # row i (입력 위치 i) 가 답의 i번째 단어를 예측 → 앞에서부터 len(a_tokens)개 행을 사용
    weights = cross[: len(a_tokens), : len(q_tokens)].numpy()

    fig, ax = plt.subplots(figsize=(1.1 * len(q_tokens) + 1, 0.7 * len(a_tokens) + 1))
    im = ax.imshow(weights, aspect="auto", cmap="viridis")
    ax.set_xticks(range(len(q_tokens)))
    ax.set_xticklabels(q_tokens, rotation=30, ha="right")
    ax.set_yticks(range(len(a_tokens)))
    ax.set_yticklabels(a_tokens)
    ax.set_xlabel("질문 토큰 (원문)")
    ax.set_ylabel("생성한 답 토큰")
    ax.set_title(f"크로스 어텐션 — '{answer_text}' 이(가) 주목한 곳")
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(out_path, dpi=120)
    plt.close(fig)
    return True`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "demo",
      summary: "전체 시나리오를 순서대로 실행: 준비 → 학습 → 순차 생성 시연 → 히트맵 → 대조 예시.",
      how: "이 함수가 예제의 '대본'이다. 사전을 만들고, 모델을 학습하고, 주인공 질문으로 " +
        "한 단어씩 생성 과정을 보여 주고, 어텐션 히트맵을 저장한 뒤, 키워드만 바꾼 대조 예시로 마무리한다.",
      terms: ["main", "히트맵", "greedy"],
      lines: [
        { at: "def main():", text: "프로그램의 시작점(대본) 함수." },
        { at: 'print("워밍업:', text: "제목 줄을 '=' 선으로 감싸 화면에 크게 출력한다." },
        { at: "font = set_korean_font()", text: "그래프용 한글 폰트를 찾아 적용하고 이름을 받는다." },
        { at: 'print(f"[폰트]', text: "어떤 한글 폰트를 쓰는지(또는 못 찾았는지) 알려 준다." },
        { at: "src_vocab = Vocab([q for q, _ in DATA])", text: "질문들로 질문용 단어 사전을 만든다." },
        { at: "tgt_vocab = Vocab([a for _, a in DATA])", text: "답들로 답용 단어 사전을 만든다." },
        { at: 'print(f"[사전]', text: "질문·답 단어 수와 학습 쌍 개수를 출력한다." },
        { at: 'print("[학습] teacher', text: "이제 학습을 시작한다는 안내 출력." },
        { at: "model, history = train(DATA", text: "데이터로 모델을 학습해 학습된 모델과 loss 이력을 받는다." },
        { at: 'print(f"[학습] 최종', text: "학습이 끝난 뒤 최종 loss 값을 출력한다." },
        { at: "# (1) 주인공 질문", text: "설명 주석: 아래는 대표 질문으로 순차 생성+히트맵을 보여 주는 부분." },
        { at: "main_q = ", text: "시연에 쓸 대표 질문을 정한다('먹구름이' 버전)." },
        { at: "steps, ans, cross = answer(model", text: "그 질문의 답을 생성하고, 생성 로그·답·어텐션을 받는다." },
        { at: 'print("[생성]', text: "'한 단어씩 생성' 시연을 시작한다는 안내." },
        { at: 'print(f"  질문:', text: "다룰 질문을 출력한다." },
        { at: "for seen, nxt in steps:", text: "생성 로그를 한 스텝씩 돌면서," },
        { at: "shown = seen if seen else", text: "아직 만든 답이 없으면 <sos>로 표시하고," },
        { at: "다음 단어: {nxt}", text: "'지금까지 답 → 새로 고른 단어'를 한 줄씩 출력한다." },
        { at: 'print(f"  답  :', text: "최종 완성된 답을 출력한다." },
        { at: "out_path = os.path.join(", text: "히트맵을 저장할 파일 경로(이 스크립트 폴더/attention_heatmap.png)를 만든다." },
        { at: "plot_attention(main_q, ans, cross, out_path)", text: "크로스 어텐션 히트맵을 그려 파일로 저장한다." },
        { at: 'print(f"[어텐션]', text: "히트맵이 저장된 경로를 알려 준다." },
        { at: "(답의 첫 단어가", text: "성공 판정 힌트: 답 첫 단어가 '먹구름이'에 밝게 쏠리면 성공." },
        { at: "# (2) 대조", text: "설명 주석: 아래는 키워드만 바꿔 답이 달라지는 걸 보여 주는 부분." },
        { at: 'print("[대조]', text: "대조 시연 안내 출력." },
        { at: "for q in [", text: "세 가지 질문을 차례로 처리한다." },
        { at: "별이 보이면", text: "대조 질문 2: '별이' 버전." },
        { at: "해가 보이면", text: "대조 질문 3: '해가' 버전." },
        { at: "_, a, _ = answer(model", text: "각 질문의 답만 생성해 받는다(로그·어텐션은 버림)." },
        { at: "keyword = tokenize(q)", text: "질문의 두 번째 단어(하늘의 '대상')를 꺼낸다." },
        { at: "{keyword:<6}", text: "대상 단어 → 답을 한 줄로 정렬해 출력한다." },
        { at: "완료! 히트맵", text: "모든 시연을 마쳤다는 안내와 함께 히트맵 확인을 권한다." },
      ],
      code: `def main():
    print("=" * 60)
    print("워밍업: '하늘에 먹구름이 많아지면 뭐가 생각나?' 미니 트랜스포머")
    print("=" * 60)

    font = set_korean_font()
    print(f"[폰트] 그래프 한글 폰트: {font or '못 찾음(라벨이 □로 보일 수 있음)'}")

    src_vocab = Vocab([q for q, _ in DATA])
    tgt_vocab = Vocab([a for _, a in DATA])
    print(f"[사전] 질문 단어 {len(src_vocab)}개, 답 단어 {len(tgt_vocab)}개, 학습 쌍 {len(DATA)}개\\n")

    print("[학습] teacher forcing 으로 질문→답 매핑 학습")
    model, history = train(DATA, src_vocab, tgt_vocab)
    print(f"[학습] 최종 loss = {history[-1]:.4f}\\n")

    # (1) 주인공 질문 — 순차 생성(마스킹) 시연 + 어텐션 히트맵
    main_q = "하늘에 먹구름이 보이면 뭐가 생각나"
    steps, ans, cross = answer(model, src_vocab, tgt_vocab, main_q)
    print("[생성] 한 단어씩(마스킹): 앞말만 보고 다음 단어를 고른다")
    print(f"  질문: {main_q}")
    for seen, nxt in steps:
        shown = seen if seen else "<sos>"
        print(f"    '{shown}'  →  다음 단어: {nxt}")
    print(f"  답  : {ans}\\n")

    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "attention_heatmap.png")
    plot_attention(main_q, ans, cross, out_path)
    print(f"[어텐션] 히트맵 저장 → {out_path}")
    print("  (답의 첫 단어가 질문의 '먹구름이'에 가장 밝게 주목하면 성공)\\n")

    # (2) 대조 — 키워드가 바뀌면 주목 대상과 답이 함께 바뀐다
    print("[대조] 문장 구조는 같아도 키워드에 따라 답이 달라진다")
    for q in [
        "하늘에 먹구름이 보이면 뭐가 생각나",
        "하늘에 별이 보이면 뭐가 생각나",
        "하늘에 해가 보이면 뭐가 생각나",
    ]:
        _, a, _ = answer(model, src_vocab, tgt_vocab, q)
        keyword = tokenize(q)[1]  # 두 번째 단어 = 하늘의 대상
        print(f"    {keyword:<6} → {a}")

    print("\\n완료! 히트맵(attention_heatmap.png)을 열어 어텐션이 어디에 쏠렸는지 확인하세요.")`,
    },

    // ===================== mini_transformer.py =====================
    {
      id: "positional_encoding",
      name: "PositionalEncoding",
      fileId: "model",
      summary: "단어 순서를 sin/cos 파도무늬 값으로 만들어 임베딩에 더해 주는 층.",
      how: "트랜스포머는 단어를 동시에 봐서 순서 개념이 없다. 위치마다 다른 sin/cos 값을 미리 표로 " +
        "만들어(pe) 단어 벡터에 더하면, 모델이 '몇 번째 단어인지'를 알 수 있다. 이 표는 학습하지 않는 " +
        "고정값이라 register_buffer로 저장한다.",
      terms: ["위치인코딩", "sincos", "임베딩", "register_buffer", "nnModule", "forward"],
      lines: [
        { at: "class PositionalEncoding", text: "위치 정보를 더해 주는 층을 정의한다(nn.Module 상속)." },
        { at: "단어 순서를 sin/cos", text: "이 층의 목적 설명: 순서를 파도무늬로 임베딩에 더한다." },
        { at: "def __init__(self, d_model: int, max_len", text: "차원 수·최대 길이·dropout 비율을 받아 초기화." },
        { at: "super().__init__()", text: "부모 클래스(nn.Module)의 초기화를 먼저 실행(필수 준비)." },
        { at: "self.dropout = nn.Dropout(dropout)", text: "과적합을 줄이려 일부 값을 무작위로 0으로 만드는 dropout 준비." },
        { at: "pe = torch.zeros(max_len, d_model)", text: "위치×차원 크기의 빈(0) 표를 만든다 — 여기에 파도무늬를 채운다." },
        { at: "position = torch.arange(0, max_len", text: "0,1,2,... 위치 번호를 세로로 세운다." },
        { at: "div_term = torch.exp(", text: "차원마다 파도의 주파수를 다르게 하는 계수를 계산한다." },
        { at: "torch.arange(0, d_model, 2, dtype=torch.float32)", text: "짝수 차원 인덱스마다 서로 다른 파장을 갖도록 만든다." },
        { at: "pe[:, 0::2] = torch.sin(", text: "짝수 번째 차원은 sin 파도무늬로 채운다." },
        { at: "pe[:, 1::2] = torch.cos(", text: "홀수 번째 차원은 cos 파도무늬로 채운다." },
        { at: 'self.register_buffer("pe"', text: "이 표를 '학습하지 않는 고정 값'으로 모델에 저장(저장/이동 시 함께 따라감)." },
        { at: "def forward(self, x: torch.Tensor)", text: "입력 임베딩 x가 들어오면 실행되는 함수." },
        { at: "return self.dropout(x + self.pe", text: "임베딩에 위치 파도무늬를 더하고 dropout을 적용해 돌려준다." },
      ],
      code: `class PositionalEncoding(nn.Module):
    """단어 순서를 sin/cos 파도무늬로 임베딩에 더해 주는 층."""

    def __init__(self, d_model: int, max_len: int = 128, dropout: float = 0.1):
        super().__init__()
        self.dropout = nn.Dropout(dropout)
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float32).unsqueeze(1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2, dtype=torch.float32) * (-math.log(10000.0) / d_model)
        )
        pe[:, 0::2] = torch.sin(position * div_term)  # 짝수 인덱스 = sin
        pe[:, 1::2] = torch.cos(position * div_term)  # 홀수 인덱스 = cos
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.dropout(x + self.pe[:, : x.size(1)])`,
    },
    {
      id: "sdpa",
      name: "scaled_dot_product_attention()",
      fileId: "model",
      summary: "어텐션의 핵심 공식 softmax(QKᵀ/√dₖ)·V — 관련도 점수로 값(V)을 가중합한다.",
      how: "질문(Q)과 열쇠(K)를 곱해 '얼마나 관련 있나' 점수를 낸다. 값이 너무 커지지 않게 √dₖ로 나누고, " +
        "가릴 곳은 -무한대로 만들어 softmax 후 0이 되게 한다. softmax로 점수를 비율(확률)로 바꾼 뒤 " +
        "그 비율대로 값(V)을 섞어 최종 문맥 벡터를 만든다.",
      terms: ["어텐션", "QKV", "softmax", "스케일링", "마스킹"],
      lines: [
        { at: "def scaled_dot_product_attention", text: "어텐션 계산 함수. q,k,v와 마스크·dropout을 받는다." },
        { at: "어텐션 = softmax", text: "함수 설명글: 어텐션의 수학 공식을 직접 구현했다는 뜻." },
        { at: "torch.nn.functional.scaled_dot_product_attention", text: "참고: 실무에서는 PyTorch의 내장 고속 구현을 쓴다는 안내." },
        { at: "d_k = q.size(-1)", text: "각 헤드의 차원 크기(dₖ)를 구한다 — 아래 스케일링에 사용." },
        { at: "scores = torch.matmul(q, k.transpose", text: "Q와 K를 곱해 단어쌍 사이의 관련도 점수를 만들고 √dₖ로 나눈다." },
        { at: "if mask is not None:", text: "마스크가 주어졌으면(가릴 위치가 있으면)," },
        { at: "scores = scores.masked_fill(", text: "가릴 위치의 점수를 -무한대로 만든다 → softmax 후 0이 됨." },
        { at: "torch.softmax(scores, dim=-1)", text: "점수를 합이 1인 비율(확률)로 바꾼다 = 주목 가중치." },
        { at: "if dropout is not None:", text: "학습 중이면(dropout 지정) 주목 가중치 일부를 무작위로 끈다." },
        { at: "dropout(attn_weights)", text: "과적합을 줄이기 위한 dropout 적용." },
        { at: "context = torch.matmul(attn_weights, v)", text: "주목 비율대로 값(V)을 가중합해 문맥 벡터를 만든다." },
        { at: "return context, attn_weights", text: "문맥 벡터와 주목 가중치(시각화용)를 함께 돌려준다." },
      ],
      code: `def scaled_dot_product_attention(q, k, v, mask=None, dropout=None):
    """어텐션 = softmax(QKᵀ/√dₖ)·V. 관련도 점수로 V를 가중합한다.

    학습용으로 수식을 직접 구현한 것. 실무에서는 PyTorch 2.0+ 의 융합·고속 구현
    \`\`torch.nn.functional.scaled_dot_product_attention\`\` 을 쓴다(마스크는 True=주목 관례로 동일).
    """
    d_k = q.size(-1)
    scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(d_k)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float("-inf"))  # 가릴 위치는 -무한대 → softmax 후 0
    attn_weights = torch.softmax(scores, dim=-1)
    if dropout is not None:
        attn_weights = dropout(attn_weights)
    context = torch.matmul(attn_weights, v)
    return context, attn_weights`,
    },
    {
      id: "multihead",
      name: "MultiHeadAttention",
      fileId: "model",
      summary: "d_model 차원을 여러 헤드로 나눠, 서로 다른 관점으로 동시에 주목한 뒤 다시 합친다.",
      how: "하나의 어텐션만 쓰면 관점이 하나뿐이다. 차원을 num_heads개로 쪼개 각각 따로 어텐션을 하고" +
        "(여러 관점 동시 관찰) 결과를 다시 이어 붙인 뒤 마지막 선형층(w_o)으로 정리한다. " +
        "시각화를 위해 마지막 주목 가중치를 보관해 둔다.",
      terms: ["멀티헤드", "QKV", "nnLinear", "transpose", "어텐션"],
      lines: [
        { at: "class MultiHeadAttention", text: "멀티헤드 어텐션 층을 정의한다." },
        { at: "d_model 차원을 여러 헤드", text: "이 층의 목적: 여러 관점(헤드)으로 동시에 주목." },
        { at: "assert d_model % num_heads", text: "차원이 헤드 수로 나눠떨어지는지 확인(안 되면 오류로 멈춤)." },
        { at: "self.d_model, self.num_heads, self.head_dim", text: "전체 차원·헤드 수·헤드당 차원을 한 줄로 저장." },
        { at: "self.w_q = nn.Linear", text: "입력을 질문(Q)으로 바꾸는 학습 가능한 선형 변환." },
        { at: "self.w_k = nn.Linear", text: "입력을 열쇠(K)로 바꾸는 선형 변환." },
        { at: "self.w_v = nn.Linear", text: "입력을 값(V)으로 바꾸는 선형 변환." },
        { at: "self.w_o = nn.Linear", text: "여러 헤드 결과를 합친 뒤 정리하는 출력 선형 변환." },
        { at: "self.dropout = nn.Dropout(dropout)", text: "어텐션 가중치에 적용할 dropout." },
        { at: "self.last_attn_weights = None", text: "시각화를 위해 마지막 주목 가중치를 담아 둘 자리(처음엔 비어 있음)." },
        { at: "def _split_heads", text: "하나의 텐서를 여러 헤드로 쪼개는 도우미 함수." },
        { at: "b, s, _ = x.shape", text: "배치 크기(b)와 문장 길이(s)를 꺼낸다." },
        { at: "return x.view(b, s, self.num_heads", text: "차원을 헤드 수만큼 나눠 (배치, 헤드, 길이, 헤드차원) 모양으로 바꾼다." },
        { at: "def _merge_heads", text: "쪼갰던 헤드들을 다시 하나로 합치는 도우미 함수." },
        { at: "b, _, s, _ = x.shape", text: "배치 크기와 문장 길이를 꺼낸다(헤드 축은 곧 합쳐짐)." },
        { at: "return x.transpose(1, 2).contiguous()", text: "축 순서를 되돌리고 이어 붙여 원래 (배치, 길이, 차원) 모양으로 복원." },
        { at: "def forward(self, query, key, value", text: "질문·열쇠·값과 마스크를 받아 어텐션을 수행하는 함수." },
        { at: "q = self._split_heads(self.w_q(query))", text: "query를 Q로 변환하고 헤드별로 쪼갠다." },
        { at: "k = self._split_heads(self.w_k(key))", text: "key를 K로 변환하고 헤드별로 쪼갠다." },
        { at: "v = self._split_heads(self.w_v(value))", text: "value를 V로 변환하고 헤드별로 쪼갠다." },
        { at: "context, attn = scaled_dot_product_attention", text: "핵심 어텐션 공식을 호출해 문맥 벡터와 주목 가중치를 얻는다." },
        { at: "self.last_attn_weights = attn.detach()", text: "주목 가중치를 시각화용으로 저장(계산 그래프에서 떼어 냄)." },
        { at: "return self.w_o(self._merge_heads(context))", text: "헤드들을 합치고 출력 선형층을 통과시켜 돌려준다." },
      ],
      code: `class MultiHeadAttention(nn.Module):
    """d_model 차원을 여러 헤드로 나눠 서로 다른 관점으로 동시에 주목."""

    def __init__(self, d_model: int, num_heads: int, dropout: float = 0.1):
        super().__init__()
        assert d_model % num_heads == 0, "d_model 은 num_heads 로 나눠떨어져야 함"
        self.d_model, self.num_heads, self.head_dim = d_model, num_heads, d_model // num_heads
        self.w_q = nn.Linear(d_model, d_model)
        self.w_k = nn.Linear(d_model, d_model)
        self.w_v = nn.Linear(d_model, d_model)
        self.w_o = nn.Linear(d_model, d_model)
        self.dropout = nn.Dropout(dropout)
        self.last_attn_weights = None  # 시각화용: 마지막 forward의 어텐션 가중치 보관

    def _split_heads(self, x: torch.Tensor) -> torch.Tensor:
        b, s, _ = x.shape
        return x.view(b, s, self.num_heads, self.head_dim).transpose(1, 2)

    def _merge_heads(self, x: torch.Tensor) -> torch.Tensor:
        b, _, s, _ = x.shape
        return x.transpose(1, 2).contiguous().view(b, s, self.d_model)

    def forward(self, query, key, value, mask=None) -> torch.Tensor:
        q = self._split_heads(self.w_q(query))
        k = self._split_heads(self.w_k(key))
        v = self._split_heads(self.w_v(value))
        context, attn = scaled_dot_product_attention(q, k, v, mask, self.dropout)
        self.last_attn_weights = attn.detach()  # (B, heads, tgt_len, src_len)
        return self.w_o(self._merge_heads(context))`,
    },
    {
      id: "ffn",
      name: "PositionwiseFeedForward",
      fileId: "model",
      summary: "각 단어를 독립적으로 더 깊이 변환하는 작은 신경망(d_model → d_ff → d_model).",
      how: "어텐션이 '단어끼리 정보를 섞는' 단계라면, FFN은 각 단어가 '혼자 더 곱씹는' 단계다. " +
        "차원을 넓혔다가(ReLU로 비선형 추가) 다시 줄여 표현력을 높인다.",
      terms: ["FFN", "nnSequential", "nnReLU", "nnLinear"],
      lines: [
        { at: "class PositionwiseFeedForward", text: "위치별 피드포워드 신경망 층을 정의한다." },
        { at: "각 단어를 독립적으로", text: "이 층의 목적: 각 단어를 따로따로 더 깊이 변환." },
        { at: "def __init__(self, d_model: int, d_ff=None", text: "입력 차원과 은닉 차원(d_ff)을 받아 초기화." },
        { at: "super().__init__()", text: "부모 클래스 초기화 실행." },
        { at: "d_ff = d_ff or d_model * 4", text: "은닉 차원이 지정 안 되면 입력의 4배로 정한다(관례)." },
        { at: "self.net = nn.Sequential(", text: "여러 층을 순서대로 통과하도록 묶는다." },
        { at: "nn.Linear(d_model, d_ff), nn.ReLU()", text: "넓혔다가(Linear) 비선형(ReLU)·dropout 후 다시 줄이는(Linear) 2단 신경망." },
        { at: "def forward(self, x: torch.Tensor)", text: "입력 x를 받아 실행되는 함수." },
        { at: "return self.net(x)", text: "묶어 둔 신경망에 x를 통과시켜 돌려준다." },
      ],
      code: `class PositionwiseFeedForward(nn.Module):
    """각 단어를 독립적으로 더 깊이 변환하는 작은 신경망 (d_model → d_ff → d_model)."""

    def __init__(self, d_model: int, d_ff=None, dropout: float = 0.1):
        super().__init__()
        d_ff = d_ff or d_model * 4
        self.net = nn.Sequential(
            nn.Linear(d_model, d_ff), nn.ReLU(), nn.Dropout(dropout), nn.Linear(d_ff, d_model)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)`,
    },
    {
      id: "encoder_layer",
      name: "EncoderLayer",
      fileId: "model",
      summary: "인코더 블록 하나: Self-Attention → Add&Norm → FFN → Add&Norm.",
      how: "질문 안의 단어들이 서로를 참고(셀프 어텐션)한 뒤, 원본을 더하고(잔차) 정규화하고, " +
        "FFN으로 한 번 더 곱씹고 다시 더하고 정규화한다. 이 블록을 여러 개 쌓아 인코더를 만든다.",
      terms: ["셀프어텐션", "잔차", "레이어정규화", "FFN", "AddNorm"],
      lines: [
        { at: "class EncoderLayer", text: "인코더 블록 하나를 정의한다." },
        { at: "인코더 블록:", text: "블록 구성 설명: Self-Attention→Add&Norm→FFN→Add&Norm." },
        { at: "super().__init__()", text: "부모 클래스 초기화 실행." },
        { at: "self.self_attn = MultiHeadAttention", text: "질문 단어끼리 서로 참고하는 셀프 어텐션 준비." },
        { at: "self.ffn = PositionwiseFeedForward", text: "각 단어를 더 곱씹는 FFN 준비." },
        { at: "self.norm1 = nn.LayerNorm", text: "첫 번째 정규화 층(어텐션 뒤)." },
        { at: "self.norm2 = nn.LayerNorm", text: "두 번째 정규화 층(FFN 뒤)." },
        { at: "self.dropout = nn.Dropout(dropout)", text: "각 하위층 뒤에 적용할 dropout." },
        { at: "def forward(self, x, src_mask)", text: "입력 x와 질문 마스크를 받아 블록을 통과시키는 함수." },
        { at: "attn_out = self.self_attn(x, x, x, src_mask)", text: "셀프 어텐션: x가 스스로(Q=K=V=x)를 참고한다." },
        { at: "x = self.norm1(x + self.dropout(attn_out))", text: "원본 x를 더하고(잔차) 정규화한다 = Add&Norm." },
        { at: "x = self.norm2(x + self.dropout(self.ffn(x)))", text: "FFN을 통과한 뒤 다시 더하고 정규화한다." },
        { at: "        return x", text: "블록을 통과한 결과를 돌려준다." },
      ],
      code: `class EncoderLayer(nn.Module):
    """인코더 블록: Self-Attention → Add&Norm → FFN → Add&Norm."""

    def __init__(self, d_model, num_heads, d_ff, dropout=0.1):
        super().__init__()
        self.self_attn = MultiHeadAttention(d_model, num_heads, dropout)
        self.ffn = PositionwiseFeedForward(d_model, d_ff, dropout)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, src_mask):
        attn_out = self.self_attn(x, x, x, src_mask)
        x = self.norm1(x + self.dropout(attn_out))            # 잔차(원본 x) + 정규화
        x = self.norm2(x + self.dropout(self.ffn(x)))
        return x`,
    },
    {
      id: "decoder_layer",
      name: "DecoderLayer",
      fileId: "model",
      summary: "디코더 블록: Masked Self-Attn → Cross-Attn(원문 참고) → FFN, 각 뒤에 Add&Norm.",
      how: "디코더는 세 단계다. ① 지금까지 만든 답끼리 참고하되 미래는 가림(masked self-attn), " +
        "② 인코더가 만든 질문 요약을 곁눈질(cross-attn), ③ FFN으로 곱씹기. 각 단계 뒤 Add&Norm.",
      terms: ["셀프어텐션", "크로스어텐션", "마스킹", "잔차", "레이어정규화"],
      lines: [
        { at: "class DecoderLayer", text: "디코더 블록 하나를 정의한다." },
        { at: "디코더 블록:", text: "블록 구성 설명: Masked Self-Attn→Cross-Attn→FFN." },
        { at: "super().__init__()", text: "부모 클래스 초기화 실행." },
        { at: "self.self_attn = MultiHeadAttention", text: "답 단어끼리 참고하는 셀프 어텐션(미래는 마스크로 가림)." },
        { at: "self.cross_attn = MultiHeadAttention", text: "질문(인코더 출력)을 곁눈질하는 크로스 어텐션." },
        { at: "self.ffn = PositionwiseFeedForward", text: "각 답 단어를 더 곱씹는 FFN." },
        { at: "self.norm1 = nn.LayerNorm", text: "첫 번째 정규화(셀프 어텐션 뒤)." },
        { at: "self.norm2 = nn.LayerNorm", text: "두 번째 정규화(크로스 어텐션 뒤)." },
        { at: "self.norm3 = nn.LayerNorm", text: "세 번째 정규화(FFN 뒤)." },
        { at: "self.dropout = nn.Dropout(dropout)", text: "각 하위층 뒤 dropout." },
        { at: "def forward(self, x, enc_out, tgt_mask, src_mask)", text: "답 표현 x·인코더 출력·두 마스크를 받는 함수." },
        { at: "self.self_attn(x, x, x, tgt_mask)", text: "답끼리 셀프 어텐션(tgt_mask로 미래 단어를 가림) 후 Add&Norm." },
        { at: "self.cross_attn(x, enc_out, enc_out, src_mask)", text: "Q=답, K=V=질문요약으로 크로스 어텐션(원문 참고) 후 Add&Norm." },
        { at: "x = self.norm3(x + self.dropout(self.ffn(x)))", text: "FFN 통과 후 Add&Norm." },
        { at: "        return x", text: "블록을 통과한 답 표현을 돌려준다." },
      ],
      code: `class DecoderLayer(nn.Module):
    """디코더 블록: Masked Self-Attn → Cross-Attn(원문 참고) → FFN, 각 뒤에 Add&Norm."""

    def __init__(self, d_model, num_heads, d_ff, dropout=0.1):
        super().__init__()
        self.self_attn = MultiHeadAttention(d_model, num_heads, dropout)
        self.cross_attn = MultiHeadAttention(d_model, num_heads, dropout)
        self.ffn = PositionwiseFeedForward(d_model, d_ff, dropout)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.norm3 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, enc_out, tgt_mask, src_mask):
        x = self.norm1(x + self.dropout(self.self_attn(x, x, x, tgt_mask)))               # 미래 가림
        x = self.norm2(x + self.dropout(self.cross_attn(x, enc_out, enc_out, src_mask)))  # 질문 참고
        x = self.norm3(x + self.dropout(self.ffn(x)))
        return x`,
    },
    {
      id: "encoder",
      name: "Encoder",
      fileId: "model",
      summary: "질문을 임베딩+위치인코딩한 뒤 여러 EncoderLayer를 통과시켜 문맥 표현으로 인코딩한다.",
      how: "단어 번호를 벡터로 바꾸고(임베딩), 순서 정보를 더하고(위치 인코딩), 인코더 블록을 " +
        "num_layers개 쌓아 차례로 통과시킨다. √d_model을 곱하는 것은 임베딩과 위치값의 크기를 맞추는 관례.",
      terms: ["인코더", "임베딩", "위치인코딩", "nnEmbedding", "nnModuleList"],
      lines: [
        { at: "class Encoder(nn.Module)", text: "질문을 읽는 인코더 전체를 정의한다." },
        { at: "질문을 읽고", text: "이 모듈의 목적: 질문을 문맥 표현으로 인코딩." },
        { at: "super().__init__()", text: "부모 클래스 초기화 실행." },
        { at: "self.d_model = d_model", text: "차원 크기를 저장(아래 √d_model 스케일링에 사용)." },
        { at: "self.embedding = nn.Embedding", text: "단어 번호를 의미 벡터로 바꾸는 임베딩 표." },
        { at: "self.pos = PositionalEncoding", text: "순서 정보를 더해 주는 위치 인코딩 층." },
        { at: "self.layers = nn.ModuleList", text: "인코더 블록들을 목록으로 담는다." },
        { at: "[EncoderLayer(d_model, num_heads", text: "num_layers 개수만큼 인코더 블록을 만들어 쌓는다." },
        { at: "def forward(self, src, src_mask)", text: "질문 번호(src)와 마스크를 받아 통과시키는 함수." },
        { at: "x = self.pos(self.embedding(src)", text: "임베딩(×√d_model)에 위치 인코딩을 더해 시작 표현을 만든다." },
        { at: "for layer in self.layers:", text: "쌓아 둔 인코더 블록들을 순서대로," },
        { at: "x = layer(x, src_mask)", text: "하나씩 통과시키며 표현을 다듬는다." },
        { at: "        return x", text: "질문의 최종 문맥 표현을 돌려준다." },
      ],
      code: `class Encoder(nn.Module):
    """질문을 읽고 문맥 표현으로 인코딩."""

    def __init__(self, vocab, d_model, num_heads, num_layers, d_ff, dropout, max_len):
        super().__init__()
        self.d_model = d_model
        self.embedding = nn.Embedding(vocab, d_model)
        self.pos = PositionalEncoding(d_model, max_len, dropout)
        self.layers = nn.ModuleList(
            [EncoderLayer(d_model, num_heads, d_ff, dropout) for _ in range(num_layers)]
        )

    def forward(self, src, src_mask):
        x = self.pos(self.embedding(src) * math.sqrt(self.d_model))
        for layer in self.layers:
            x = layer(x, src_mask)
        return x`,
    },
    {
      id: "decoder",
      name: "Decoder",
      fileId: "model",
      summary: "인코딩된 질문을 참고해 답을 한 단어씩 만들 표현으로 디코딩한다(구조는 인코더와 대칭).",
      how: "답 번호를 임베딩+위치인코딩한 뒤 DecoderLayer들을 통과시킨다. 각 블록은 인코더 출력을 " +
        "함께 받아 크로스 어텐션으로 질문을 참고한다.",
      terms: ["디코더", "임베딩", "위치인코딩", "크로스어텐션", "nnModuleList"],
      lines: [
        { at: "class Decoder(nn.Module)", text: "답을 만드는 디코더 전체를 정의한다." },
        { at: "인코딩된 질문을 참고", text: "이 모듈의 목적: 질문 요약을 참고해 답 표현을 디코딩." },
        { at: "super().__init__()", text: "부모 클래스 초기화 실행." },
        { at: "self.d_model = d_model", text: "차원 크기를 저장(√d_model 스케일링용)." },
        { at: "self.embedding = nn.Embedding", text: "답 단어 번호를 의미 벡터로 바꾸는 임베딩 표." },
        { at: "self.pos = PositionalEncoding", text: "답에도 순서 정보를 더해 주는 위치 인코딩." },
        { at: "self.layers = nn.ModuleList", text: "디코더 블록들을 목록으로 담는다." },
        { at: "[DecoderLayer(d_model, num_heads", text: "num_layers 개수만큼 디코더 블록을 만들어 쌓는다." },
        { at: "def forward(self, tgt, enc_out, tgt_mask, src_mask)", text: "답 번호·인코더 출력·두 마스크를 받는 함수." },
        { at: "x = self.pos(self.embedding(tgt)", text: "답 임베딩(×√d_model)에 위치 인코딩을 더한다." },
        { at: "for layer in self.layers:", text: "쌓아 둔 디코더 블록들을 순서대로," },
        { at: "x = layer(x, enc_out, tgt_mask, src_mask)", text: "인코더 출력을 함께 넣어 하나씩 통과시킨다(질문을 참고)." },
        { at: "        return x", text: "답을 예측할 최종 표현을 돌려준다." },
      ],
      code: `class Decoder(nn.Module):
    """인코딩된 질문을 참고해 답을 한 단어씩 만들 표현으로 디코딩."""

    def __init__(self, vocab, d_model, num_heads, num_layers, d_ff, dropout, max_len):
        super().__init__()
        self.d_model = d_model
        self.embedding = nn.Embedding(vocab, d_model)
        self.pos = PositionalEncoding(d_model, max_len, dropout)
        self.layers = nn.ModuleList(
            [DecoderLayer(d_model, num_heads, d_ff, dropout) for _ in range(num_layers)]
        )

    def forward(self, tgt, enc_out, tgt_mask, src_mask):
        x = self.pos(self.embedding(tgt) * math.sqrt(self.d_model))
        for layer in self.layers:
            x = layer(x, enc_out, tgt_mask, src_mask)
        return x`,
    },
    {
      id: "transformer",
      name: "Transformer",
      fileId: "model",
      summary: "인코더+디코더+출력층을 합친 전체 모델. 출력층은 디코더 임베딩과 가중치를 공유(weight tying).",
      how: "인코더와 디코더를 조립하고, 디코더 출력을 단어 후보 점수(logits)로 바꾸는 출력층을 붙인다. " +
        "출력층 가중치를 디코더 임베딩과 공유하면(weight tying) 파라미터가 줄고 학습이 안정된다. " +
        "학습용 forward, 생성용 encode/decode_step을 따로 제공한다.",
      terms: ["트랜스포머", "인코더", "디코더", "weight_tying", "logits", "nnLinear"],
      lines: [
        { at: "class Transformer(nn.Module)", text: "인코더-디코더 전체 모델을 정의한다." },
        { at: "인코더-디코더 미니 트랜스포머", text: "이 모델의 목적과 weight tying 사용을 설명." },
        { at: "def __init__(self, src_vocab, tgt_vocab", text: "질문·답 사전 크기와 각종 크기 설정을 받아 초기화." },
        { at: "d_ff=256, dropout=0.1, max_len=32, tie=True", text: "은닉 차원·dropout·최대 길이·가중치 공유 여부 기본값." },
        { at: "self.encoder = Encoder(", text: "질문을 읽는 인코더를 만든다." },
        { at: "self.decoder = Decoder(", text: "답을 만드는 디코더를 만든다." },
        { at: "self.output_proj = nn.Linear(d_model, tgt_vocab, bias=False)", text: "디코더 출력을 단어 후보 점수(logits)로 바꾸는 출력층." },
        { at: "if tie:", text: "가중치 공유 옵션이 켜져 있으면," },
        { at: "self.output_proj.weight = self.decoder.embedding.weight", text: "출력층과 디코더 임베딩이 같은 가중치를 쓰게 한다(weight tying)." },
        { at: "def forward(self, src, tgt, src_mask, tgt_mask)", text: "학습용: 질문·답을 함께 넣어 단어 점수를 내는 함수." },
        { at: "enc = self.encoder(src, src_mask)", text: "먼저 질문을 인코딩하고," },
        { at: "def encode(self, src, src_mask)", text: "생성용: 질문만 인코딩해 두는 함수(생성 내내 재사용)." },
        { at: "return self.encoder(src, src_mask)", text: "질문의 인코딩 결과만 돌려준다." },
        { at: "def decode_step(self, tgt, enc, tgt_mask, src_mask)", text: "생성용: 현재까지의 답으로 다음 단어 점수를 한 스텝 내는 함수." },
      ],
      code: `class Transformer(nn.Module):
    """인코더-디코더 미니 트랜스포머. 출력층은 디코더 임베딩과 가중치 공유(weight tying)."""

    def __init__(self, src_vocab, tgt_vocab, d_model=64, num_heads=4, num_layers=2,
                 d_ff=256, dropout=0.1, max_len=32, tie=True):
        super().__init__()
        self.encoder = Encoder(src_vocab, d_model, num_heads, num_layers, d_ff, dropout, max_len)
        self.decoder = Decoder(tgt_vocab, d_model, num_heads, num_layers, d_ff, dropout, max_len)
        self.output_proj = nn.Linear(d_model, tgt_vocab, bias=False)
        if tie:
            self.output_proj.weight = self.decoder.embedding.weight

    def forward(self, src, tgt, src_mask, tgt_mask):
        enc = self.encoder(src, src_mask)
        return self.output_proj(self.decoder(tgt, enc, tgt_mask, src_mask))

    def encode(self, src, src_mask):
        return self.encoder(src, src_mask)

    def decode_step(self, tgt, enc, tgt_mask, src_mask):
        return self.output_proj(self.decoder(tgt, enc, tgt_mask, src_mask))`,
    },
    {
      id: "make_padding_mask",
      name: "make_padding_mask()",
      fileId: "model",
      summary: "빈칸(<pad>) 토큰 위치를 어텐션에서 무시하도록 True/False 마스크를 만든다.",
      how: "길이를 맞추려 채운 <pad>는 진짜 단어가 아니므로 주목 대상에서 빼야 한다. " +
        "pad가 아닌 곳은 True, pad인 곳은 False인 표를 만들어 어텐션에 넘긴다.",
      terms: ["패딩", "마스킹", "unsqueeze"],
      lines: [
        { at: "def make_padding_mask", text: "패딩 마스크를 만드는 함수. 번호 텐서와 pad 번호를 받는다." },
        { at: "패딩 토큰 위치를 가리는", text: "함수 설명글: <pad> 위치를 가리는 마스크." },
        { at: "return (seq != pad_id)", text: "pad가 아니면 True(주목 허용), pad면 False로 만들고 축을 늘려 돌려준다." },
      ],
      code: `def make_padding_mask(seq, pad_id):
    """패딩 토큰 위치를 가리는 마스크 (B, 1, 1, seq_len)."""
    return (seq != pad_id).unsqueeze(1).unsqueeze(2)`,
    },
    {
      id: "make_causal_mask",
      name: "make_causal_mask()",
      fileId: "model",
      summary: "미래 단어를 못 보게 하는 하삼각(causal) 마스크를 만든다.",
      how: "답을 생성할 때는 아직 안 나온 미래 단어를 보면 안 된다(반칙). 아래쪽 삼각형만 True인 " +
        "표를 만들어, 각 위치가 자기 자신과 그 앞 단어까지만 볼 수 있게 한다.",
      terms: ["causal", "마스킹", "unsqueeze"],
      lines: [
        { at: "def make_causal_mask", text: "미래 가림 마스크 함수. 길이와 장치(cpu/gpu)를 받는다." },
        { at: "미래를 못 보게", text: "함수 설명글: 미래를 못 보게 하는 하삼각 마스크." },
        { at: "mask = torch.tril(", text: "1로 채운 정사각형에서 아래쪽 삼각형만 남기고(True) 나머지는 False로." },
        { at: "return mask.unsqueeze(0)", text: "배치·헤드 축을 늘려 어텐션에 넣을 모양으로 돌려준다." },
      ],
      code: `def make_causal_mask(seq_len, device):
    """미래를 못 보게 하는 하삼각(causal) 마스크 (1, 1, seq_len, seq_len)."""
    mask = torch.tril(torch.ones(seq_len, seq_len, device=device)).bool()
    return mask.unsqueeze(0).unsqueeze(0)`,
    },
    {
      id: "make_decoder_mask",
      name: "make_decoder_mask()",
      fileId: "model",
      summary: "디코더용 마스크 = 패딩 마스크 AND 미래 가림 마스크(둘 다 만족하는 곳만 True).",
      how: "디코더는 두 가지를 동시에 지켜야 한다: <pad>를 무시하고(패딩), 미래 단어도 가린다(causal). " +
        "두 마스크를 AND(&)로 합쳐 한 장으로 만든다.",
      terms: ["패딩", "causal", "마스킹"],
      lines: [
        { at: "def make_decoder_mask", text: "디코더용 합성 마스크 함수. 답 번호와 pad 번호를 받는다." },
        { at: "디코더 마스크 =", text: "함수 설명글: 패딩 마스크 AND 미래 가림 마스크." },
        { at: "return make_padding_mask(tgt, pad_id) &", text: "패딩 마스크와 causal 마스크를 AND로 합쳐 돌려준다." },
      ],
      code: `def make_decoder_mask(tgt, pad_id):
    """디코더 마스크 = 패딩 마스크 AND 미래 가림 마스크."""
    return make_padding_mask(tgt, pad_id) & make_causal_mask(tgt.size(1), tgt.device)`,
    },
  ],

  // ── 용어 사전(우측 툴팁) ──────────────────────────────────────────
  glossary: {
    "import": "파이썬에서 외부 도구(라이브러리)나 다른 파일의 기능을 가져다 쓰는 명령.",
    "def": "함수를 정의하는 키워드. 'def 이름(입력):' 형태로 재사용 가능한 코드 묶음을 만든다.",
    "torch": "PyTorch. 페이스북(메타)이 만든 대표 딥러닝 라이브러리. 텐서 계산과 신경망을 담당.",
    "matplotlib": "파이썬 대표 그래프 그리기 라이브러리. 여기선 어텐션 히트맵을 그린다.",
    "Agg 백엔드": "matplotlib이 화면 창 없이 그림을 '파일로만' 그리는 모드. 서버·자동 실행에서 안전.",
    "텐서": "숫자를 여러 줄·여러 층으로 담는 다차원 배열. 딥러닝의 기본 데이터 그릇(엑셀 표의 확장판).",
    "토큰": "문장을 잘게 나눈 조각(여기선 공백으로 나눈 단어). 모델이 다루는 최소 단위.",
    "pad": "<pad>. 문장 길이를 맞추려고 뒤에 채우는 '빈칸' 특수 토큰. 실제 뜻은 없다.",
    "sos": "<sos>. Start Of Sentence. 답 생성을 시작하는 신호 토큰.",
    "eos": "<eos>. End Of Sentence. 문장이 끝났다는 신호 토큰.",
    "unk": "<unk>. Unknown. 사전에 없는(모르는) 단어를 대신하는 토큰.",
    "특수토큰": "<pad>·<sos>·<eos>·<unk>처럼 실제 단어가 아니라 표식 역할을 하는 토큰.",
    "vocab": "어휘 사전. 모든 단어에 고유 번호를 매겨 '단어↔번호'를 오가게 해 준다.",
    "property": "@property. 함수를 마치 값처럼 괄호 없이 꺼내 쓰게 해 주는 파이썬 문법(vocab.pad_id).",
    "인코딩": "여기선 문장(글자)을 모델이 계산할 수 있는 번호(또는 벡터)로 바꾸는 것.",
    "디코딩": "반대로 번호(또는 벡터)를 사람이 읽는 문장으로 되돌리는 것.",
    "seed": "난수의 '씨앗' 숫자. 고정하면 무작위 결과가 매번 똑같이 재현된다.",
    "폰트": "글꼴. 여기선 그래프 라벨의 한글이 깨지지 않도록 한글 폰트를 지정한다.",
    "pad_sequence": "길이가 다른 문장들 뒤에 <pad>를 채워 같은 길이로 맞춰 하나의 텐서로 쌓아 주는 도구.",
    "패딩": "짧은 문장 뒤에 빈칸(<pad>)을 채워 길이를 맞추는 것.",
    "배치": "여러 데이터(문장)를 하나로 묶어 한꺼번에 계산하는 단위. 속도를 높인다.",
    "임베딩": "단어 번호를 '의미 좌표(숫자 벡터)'로 바꾸는 표. 비슷한 뜻의 단어는 가까운 벡터가 된다.",
    "nnEmbedding": "nn.Embedding. 단어 번호→의미 벡터 변환을 담당하는 학습 가능한 표(임베딩 층).",
    "위치인코딩": "단어의 순서 정보를 벡터에 더해 주는 기법. 트랜스포머엔 순서 개념이 없어서 필요하다.",
    "sincos": "위치마다 다른 sin·cos 파도무늬 값. 이를 더해 '몇 번째 단어인지'를 표현한다.",
    "register_buffer": "학습하지 않는 고정 값을 모델에 저장하는 방법. 모델을 저장/이동할 때 함께 따라간다.",
    "nnModule": "nn.Module. 모든 PyTorch 신경망 부품의 부모 클래스. 상속해서 층·모델을 만든다.",
    "forward": "입력이 들어왔을 때 실제 계산을 수행하는 함수. 모델을 호출하면 자동으로 실행된다.",
    "어텐션": "'지금 단어를 이해하려면 어느 단어를 봐야 하나'를 점수로 계산해 정보를 모으는 핵심 기법.",
    "셀프어텐션": "한 문장 안의 단어들이 서로를 참고하는 어텐션(Q·K·V가 모두 같은 문장).",
    "크로스어텐션": "디코더가 답을 만들며 인코더가 만든 질문 요약을 참고하는 어텐션(원문 곁눈질).",
    "QKV": "Query(질문)·Key(열쇠)·Value(값). 어텐션의 세 재료. Q와 K로 관련도를 재고 그 비율로 V를 섞는다.",
    "softmax": "여러 점수를 합이 1인 비율(확률)로 바꾸는 함수. 큰 점수는 더 크게 강조된다.",
    "스케일링": "어텐션 점수를 √dₖ로 나눠 값이 너무 커지지 않게 하는 것(학습 안정화).",
    "멀티헤드": "어텐션을 여러 개(헤드)로 나눠 서로 다른 관점으로 동시에 주목한 뒤 합치는 방식.",
    "nnLinear": "nn.Linear. 입력에 가중치를 곱하고 더하는 기본 선형 변환 층(완전연결층).",
    "transpose": "텐서의 축(차원) 순서를 바꾸는 연산. 헤드로 쪼개고 합칠 때 모양을 맞추는 데 쓴다.",
    "FFN": "Position-wise Feed-Forward Network. 각 단어를 독립적으로 더 깊이 변환하는 작은 2층 신경망.",
    "nnSequential": "nn.Sequential. 여러 층을 순서대로 통과하도록 묶어 주는 컨테이너.",
    "nnReLU": "nn.ReLU. 음수는 0으로, 양수는 그대로 두는 비선형 함수. 표현력을 높인다.",
    "잔차": "잔차 연결(residual). 층의 출력에 원래 입력을 더하는 것. 깊은 신경망도 학습이 잘 되게 한다.",
    "레이어정규화": "LayerNorm. 각 단어 벡터의 숫자 분포를 고르게 맞춰 학습을 안정시키는 정규화.",
    "AddNorm": "'입력을 더하고(Add=잔차) 정규화(Norm)'하는 트랜스포머의 표준 마무리 단계.",
    "nnModuleList": "nn.ModuleList. 여러 층(블록)을 목록으로 담아 반복 통과시킬 수 있게 하는 컨테이너.",
    "인코더": "입력(질문/원문)을 읽어 의미를 요약한 표현으로 바꾸는 부분.",
    "디코더": "인코더 요약을 참고해 출력(답/번역)을 한 단어씩 만들어 내는 부분.",
    "트랜스포머": "어텐션을 핵심으로 하는 딥러닝 모델 구조. 번역·챗봇·LLM의 기반이 된다.",
    "weight_tying": "출력층 가중치를 임베딩과 공유하는 기법. 파라미터가 줄고 학습이 안정된다.",
    "logits": "softmax를 거치기 전, 각 단어가 정답일 '점수'. 가장 높은 것을 다음 단어로 고른다.",
    "손실": "loss. 모델 예측이 정답과 얼마나 다른지를 나타내는 숫자. 작을수록 잘 맞힌 것.",
    "CrossEntropyLoss": "분류 문제의 대표 손실 함수. '정답 단어'를 얼마나 확신했는지로 오차를 잰다.",
    "Adam": "대표적인 최적화기(옵티마이저). 기울기를 보며 가중치를 얼마나 고칠지 똑똑하게 정한다.",
    "역전파": "backward. 오차를 출력에서 입력 방향으로 거꾸로 전파해 각 가중치의 기울기를 구하는 과정.",
    "epoch": "전체 학습 데이터를 한 바퀴 다 학습하는 것을 1 epoch라 한다. 여러 번 반복해 학습한다.",
    "teacher forcing": "학습 때 정답을 한 칸 밀어 디코더 입력으로 주고 '다음 단어'를 맞히게 하는 방식.",
    "greedy": "매 순간 가장 점수 높은 단어 하나만 골라 이어 붙이는 가장 단순한 생성 방식.",
    "argmax": "여러 점수 중 '가장 큰 값의 위치(번호)'를 고르는 연산. greedy 생성의 핵심.",
    "마스킹": "어텐션에서 특정 위치를 못 보게 가리는 것. 패딩 무시·미래 가림 두 용도로 쓴다.",
    "causal": "인과(causal) 마스크. 각 위치가 자기와 앞 단어까지만 보게 하는 하삼각 마스크(미래 가림).",
    "unsqueeze": "텐서에 크기 1짜리 새 축(차원)을 끼워 넣는 연산. 마스크 모양을 맞출 때 쓴다.",
    "no_grad": "@torch.no_grad(). 기울기 계산을 꺼서 메모리를 아끼고 빠르게 만드는 설정(생성·평가용).",
    "eval": "model.eval(). 모델을 '평가 모드'로. dropout 등을 꺼 결과를 안정적으로 만든다.",
    "히트맵": "값의 크기를 색의 밝기로 표현한 격자 그림. 여기선 어텐션이 어디에 쏠렸는지 보여 준다.",
    "main": "프로그램의 시작점 함수. 파일을 직접 실행하면 맨 마지막의 __main__ 블록이 이 함수를 부른다.",
    "d_model": "모델이 각 단어를 표현하는 벡터의 길이(차원). 이 예제에선 64.",
  },
};
