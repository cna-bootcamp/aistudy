# -*- coding: utf-8 -*-
"""example.ipynb (전체 필사형 자습 노트북) 빌더.

단위마다 3종 세트를 배치한다:
    (a) 마크다운: 설명 + 입력할 코드(읽기용, 라인별 주석)
    (b) 빈 코드 셀: 학생이 직접 타이핑
    (c) (핵심 단위만) self-check assert (미리 채워 제공)

동시에 '학생이 전부 타이핑한 상태'를 재현한 검증 스크립트도 뽑아, 로컬 venv 실행으로
노트북이 오류 없이 완주하는지 확인한다(정답 코드는 마크다운에만, 빈 셀엔 넣지 않음).
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
EX_DIR = os.path.normpath(os.path.join(HERE, "..", "example"))
NB_PATH = os.path.join(EX_DIR, "example.ipynb")
VERIFY_PATH = os.path.join(HERE, "_verify_example_typed.py")

NB = []       # (kind, source)
VERIFY = []   # 학생이 타이핑할 실제 코드(+체크)를 순서대로 모음

TYPE_HINT = "# 👆 위 코드를 그대로 입력한 뒤 ▶(Shift+Enter) 실행하세요\n"


def md(text):
    NB.append(("markdown", text))


def unit(explain, code, check=None):
    """설명+읽기용코드 마크다운 → 빈 입력 셀 → (선택) self-check."""
    code = code.strip("\n")
    md(explain.rstrip() + "\n\n**아래 코드를 직접 입력하고 ▶ 실행하세요:**\n\n```python\n" + code + "\n```")
    NB.append(("code", TYPE_HINT))          # 빈 셀(정답 미포함)
    VERIFY.append(code)                      # 검증용: 학생이 친 코드로 간주
    if check:
        check = check.strip("\n")
        NB.append(("code", check + "\n"))    # self-check는 제공(미리 채움)
        VERIFY.append(check)


# ============================================================ 인트로
md("""# 🌧️ 손으로 익히는 미니 트랜스포머 — "하늘에 먹구름이 많아지면 뭐가 생각나?"

> ✍️ **자습 방법**: 이 노트북은 **직접 타이핑**하며 배웁니다. 각 단계마다
> ① 설명과 **입력할 코드**가 보이고 → ② 바로 아래 **빈 셀에 그대로 입력**하고 ▶ 실행하면 됩니다.
> 위에서 아래로 순서대로 진행하세요. ✅ 표시가 나오면 잘 된 것입니다.

> 🚀 **Colab에서 열기**: 이 `example.ipynb` 를 [Google Colab](https://colab.research.google.com) 에
> 업로드하거나, 저장소에 올린 뒤 `File ▸ Open notebook ▸ GitHub` 로 열면 됩니다.

트랜스포머의 핵심 직관을 한 문장으로 익힙니다 — 답 "**비**"를 만들려면 질문의 "**먹구름**"에 **주목**해야 합니다.
이게 바로 **어텐션**이 하는 일이에요. CPU로 수 초면 끝납니다(GPU 불필요).""")

# ============================================================ 0. 환경
md("## 0️⃣ 준비 — 라이브러리 & 한글 폰트")
unit(
    "그래프에 한글이 깨지지 않도록 폰트를 설정하고, 필요한 도구를 불러옵니다.",
    """
!apt-get -qq -y install fonts-nanum > /dev/null 2>&1   # 그래프용 한글 폰트 (Colab)
import math, random, logging                            # 기본 도구
import torch                                            # 딥러닝 프레임워크
from torch import nn                                    # 신경망 부품
from torch.nn.utils.rnn import pad_sequence             # 길이 맞추기(패딩)
import matplotlib.pyplot as plt                         # 그래프
from matplotlib import font_manager                     # 폰트 관리

logging.getLogger("matplotlib.mathtext").setLevel(logging.ERROR)  # 사소한 폰트 경고 숨김
plt.rcParams["axes.unicode_minus"] = False                        # 마이너스 기호 깨짐 방지
try:
    font_manager.fontManager.addfont("/usr/share/fonts/truetype/nanum/NanumGothic.ttf")
    plt.rcParams["font.family"] = "NanumGothic"                   # Colab: 나눔고딕
except Exception:
    for _n in ["Malgun Gothic", "AppleGothic", "NanumGothic"]:    # 로컬 폴백
        if _n in {f.name for f in font_manager.fontManager.ttflist}:
            plt.rcParams["font.family"] = _n
            break
print("준비 완료! PyTorch", torch.__version__)
""",
)

# ============================================================ 1. 데이터
md("""## 1️⃣ 데이터 — 질문 → 답 6쌍

문장 틀은 **똑같이** 두고 **'대상' 단어만** 바꿉니다(먹구름/별/해/…). 그래야 답을 가르는
유일한 단서가 '대상'이 되어, 모델이 **반드시 그 단어에 주목**하게 됩니다.""")
unit(
    "질문→답 6쌍을 만듭니다.",
    """
DATA = [
    ("하늘에 먹구름이 보이면 뭐가 생각나", "비가 올 것 같아"),
    ("하늘에 별이 보이면 뭐가 생각나", "밤이 깊었나 봐"),
    ("하늘에 해가 보이면 뭐가 생각나", "아침이 밝았구나"),
    ("하늘에 무지개가 보이면 뭐가 생각나", "비가 그쳤나 봐"),
    ("하늘에 눈송이가 보이면 뭐가 생각나", "겨울이 왔구나"),
    ("하늘에 노을이 보이면 뭐가 생각나", "저녁이 되었네"),
]
for q, a in DATA[:3]:
    print(q, "→", a)
""",
    check='assert len(DATA) == 6\nprint("✅ 데이터 OK")',
)

# ============================================================ 2. 토큰화·사전
md("""## 2️⃣ 토큰화 & 단어장

컴퓨터는 글자를 못 읽으니 **단어를 번호로** 바꿉니다. 문장을 공백으로 자르고(토큰화),
단어↔번호 사전(Vocab)을 만듭니다. `<pad>/<sos>/<eos>/<unk>` 는 특수 토큰이에요.""")
unit(
    "토큰화 함수와 단어장(Vocab) 클래스를 정의합니다.",
    """
PAD, SOS, EOS, UNK = "<pad>", "<sos>", "<eos>", "<unk>"   # 특수 토큰
SPECIALS = [PAD, SOS, EOS, UNK]

def tokenize(s):
    return s.strip().split()                    # 공백 단위로 자르기

class Vocab:
    def __init__(self, sentences):
        toks = sorted({t for s in sentences for t in tokenize(s)})
        self.itos = SPECIALS + toks             # 번호 → 단어
        self.stoi = {t: i for i, t in enumerate(self.itos)}   # 단어 → 번호
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
    def encode(self, s, add_special=True):
        ids = [self.stoi.get(t, self.stoi[UNK]) for t in tokenize(s)]
        return [self.sos_id] + ids + [self.eos_id] if add_special else ids
    def decode(self, ids):
        return " ".join(self.itos[i] for i in ids if self.itos[i] not in (PAD, SOS, EOS))
""",
)
unit(
    "질문용·답용 단어장을 각각 만듭니다.",
    """
src_vocab = Vocab([q for q, _ in DATA])         # 질문 단어장
tgt_vocab = Vocab([a for _, a in DATA])         # 답 단어장
print("질문 단어", len(src_vocab), "| 답 단어", len(tgt_vocab))
""",
    check='assert src_vocab.pad_id == 0 and tgt_vocab.sos_id == 1\nprint("✅ 사전 OK")',
)

# ============================================================ 3. 모델
md("""## 3️⃣ 모델 부품 만들기

이제 트랜스포머의 부품을 하나씩 직접 만듭니다. **위치 인코딩 → 어텐션 → 멀티헤드 →
FFN → 인코더/디코더 블록 → 마스크 → 전체 조립** 순서예요. 조금 길지만, 손으로 치면 구조가 몸에 남습니다. 💪""")

unit(
    "**위치 인코딩** — 어텐션은 순서를 모릅니다. sin/cos 파도무늬로 '몇 번째 단어인지'를 심어 줍니다.",
    """
class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=128, dropout=0.1):
        super().__init__()
        self.dropout = nn.Dropout(dropout)
        pe = torch.zeros(max_len, d_model)                      # 빈 표
        pos = torch.arange(0, max_len).float().unsqueeze(1)     # 위치 0,1,2,...
        div = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(pos * div)     # 짝수 차원 = sin
        pe[:, 1::2] = torch.cos(pos * div)     # 홀수 차원 = cos
        self.register_buffer("pe", pe.unsqueeze(0))
    def forward(self, x):
        return self.dropout(x + self.pe[:, :x.size(1)])   # 임베딩 + 위치 파도
""",
)

unit(
    "**어텐션 핵심 공식** — 관련도 점수(QKᵀ/√d)를 softmax로 비율화해 V를 가중합합니다.",
    """
def scaled_dot_product_attention(q, k, v, mask=None, dropout=None):
    d_k = q.size(-1)
    scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(d_k)   # 관련도 점수
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float("-inf"))        # 가릴 곳은 -무한대
    attn = torch.softmax(scores, dim=-1)                             # 합=1 비율로
    if dropout is not None:
        attn = dropout(attn)
    return torch.matmul(attn, v), attn                               # V를 비율대로 가중합
""",
    check="""
_c, _w = scaled_dot_product_attention(torch.ones(1, 1, 2, 4), torch.ones(1, 1, 2, 4),
                                      torch.arange(8.).reshape(1, 1, 2, 4))
assert torch.allclose(_w, torch.full((1, 1, 2, 2), 0.5))   # 점수가 같으면 0.5씩 균등
print("✅ 어텐션 공식 OK")
""",
)

unit(
    "**멀티헤드 어텐션** — 여러 관점(헤드)으로 나눠 동시에 주목하고 합칩니다.",
    """
class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, num_heads, dropout=0.1):
        super().__init__()
        self.h, self.dk = num_heads, d_model // num_heads
        self.wq = nn.Linear(d_model, d_model); self.wk = nn.Linear(d_model, d_model)
        self.wv = nn.Linear(d_model, d_model); self.wo = nn.Linear(d_model, d_model)
        self.dropout = nn.Dropout(dropout)
        self.last_attn_weights = None                 # 시각화용 보관
    def split(self, x):
        b, s, _ = x.shape
        return x.view(b, s, self.h, self.dk).transpose(1, 2)   # (B, 헤드, 길이, dk)
    def merge(self, x):
        b, _, s, _ = x.shape
        return x.transpose(1, 2).contiguous().view(b, s, self.h * self.dk)
    def forward(self, q, k, v, mask=None):
        q, k, v = self.split(self.wq(q)), self.split(self.wk(k)), self.split(self.wv(v))
        ctx, attn = scaled_dot_product_attention(q, k, v, mask, self.dropout)
        self.last_attn_weights = attn.detach()
        return self.wo(self.merge(ctx))
""",
    check="""
_m = MultiHeadAttention(8, 4, 0.0)
assert _m(torch.randn(1, 3, 8), torch.randn(1, 3, 8), torch.randn(1, 3, 8)).shape == (1, 3, 8)
print("✅ 멀티헤드 OK")
""",
)

unit(
    "**FFN** — 각 단어를 혼자 더 깊이 곱씹는 작은 신경망입니다.",
    """
class PositionwiseFeedForward(nn.Module):
    def __init__(self, d_model, d_ff, dropout=0.1):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d_model, d_ff), nn.ReLU(),
                                 nn.Dropout(dropout), nn.Linear(d_ff, d_model))
    def forward(self, x):
        return self.net(x)
""",
)

unit(
    "**인코더 블록** — 셀프어텐션 → (원본 더하기+정규화) → FFN → (더하기+정규화).",
    """
class EncoderLayer(nn.Module):
    def __init__(self, d_model, num_heads, d_ff, dropout=0.1):
        super().__init__()
        self.attn = MultiHeadAttention(d_model, num_heads, dropout)
        self.ffn = PositionwiseFeedForward(d_model, d_ff, dropout)
        self.n1 = nn.LayerNorm(d_model); self.n2 = nn.LayerNorm(d_model)
        self.drop = nn.Dropout(dropout)
    def forward(self, x, mask):
        x = self.n1(x + self.drop(self.attn(x, x, x, mask)))   # 잔차 + 정규화
        x = self.n2(x + self.drop(self.ffn(x)))
        return x
""",
)

unit(
    "**디코더 블록** — 마스크드 셀프어텐션 → 크로스어텐션(질문 곁눈질) → FFN.",
    """
class DecoderLayer(nn.Module):
    def __init__(self, d_model, num_heads, d_ff, dropout=0.1):
        super().__init__()
        self.self_attn = MultiHeadAttention(d_model, num_heads, dropout)
        self.cross_attn = MultiHeadAttention(d_model, num_heads, dropout)
        self.ffn = PositionwiseFeedForward(d_model, d_ff, dropout)
        self.n1 = nn.LayerNorm(d_model); self.n2 = nn.LayerNorm(d_model); self.n3 = nn.LayerNorm(d_model)
        self.drop = nn.Dropout(dropout)
    def forward(self, x, enc, tgt_mask, src_mask):
        x = self.n1(x + self.drop(self.self_attn(x, x, x, tgt_mask)))       # 미래 가림
        x = self.n2(x + self.drop(self.cross_attn(x, enc, enc, src_mask)))  # 질문 곁눈질
        x = self.n3(x + self.drop(self.ffn(x)))
        return x
""",
)

unit(
    "**인코더** — 임베딩+위치인코딩 후, 인코더 블록을 여러 겹 통과시켜 질문을 이해합니다.",
    """
class Encoder(nn.Module):
    def __init__(self, vocab, d_model, num_heads, num_layers, d_ff, dropout, max_len):
        super().__init__()
        self.d_model = d_model
        self.emb = nn.Embedding(vocab, d_model)
        self.pos = PositionalEncoding(d_model, max_len, dropout)
        self.layers = nn.ModuleList([EncoderLayer(d_model, num_heads, d_ff, dropout)
                                     for _ in range(num_layers)])
    def forward(self, src, mask):
        x = self.pos(self.emb(src) * math.sqrt(self.d_model))
        for l in self.layers:
            x = l(x, mask)
        return x
""",
)

unit(
    "**디코더** — 인코딩된 질문을 참고해 답을 만들 표현으로 바꿉니다.",
    """
class Decoder(nn.Module):
    def __init__(self, vocab, d_model, num_heads, num_layers, d_ff, dropout, max_len):
        super().__init__()
        self.d_model = d_model
        self.emb = nn.Embedding(vocab, d_model)
        self.pos = PositionalEncoding(d_model, max_len, dropout)
        self.layers = nn.ModuleList([DecoderLayer(d_model, num_heads, d_ff, dropout)
                                     for _ in range(num_layers)])
    def forward(self, tgt, enc, tgt_mask, src_mask):
        x = self.pos(self.emb(tgt) * math.sqrt(self.d_model))
        for l in self.layers:
            x = l(x, enc, tgt_mask, src_mask)
        return x
""",
)

unit(
    "**전체 조립** — 인코더+디코더+출력층. 출력층은 디코더 임베딩과 가중치를 공유(weight tying)합니다.",
    """
class Transformer(nn.Module):
    def __init__(self, src_vocab, tgt_vocab, d_model=64, num_heads=4,
                 num_layers=2, d_ff=256, dropout=0.1, max_len=32):
        super().__init__()
        self.encoder = Encoder(src_vocab, d_model, num_heads, num_layers, d_ff, dropout, max_len)
        self.decoder = Decoder(tgt_vocab, d_model, num_heads, num_layers, d_ff, dropout, max_len)
        self.out = nn.Linear(d_model, tgt_vocab, bias=False)
        self.out.weight = self.decoder.emb.weight     # weight tying(가중치 공유)
    def forward(self, src, tgt, src_mask, tgt_mask):
        return self.out(self.decoder(tgt, self.encoder(src, src_mask), tgt_mask, src_mask))
    def encode(self, src, src_mask):
        return self.encoder(src, src_mask)
    def decode_step(self, tgt, enc, tgt_mask, src_mask):
        return self.out(self.decoder(tgt, enc, tgt_mask, src_mask))
""",
)

unit(
    "**마스크** — 패딩 자리를 가리고(padding), 미래 단어를 못 보게(causal) 합니다.",
    """
def make_padding_mask(seq, pad_id):
    return (seq != pad_id).unsqueeze(1).unsqueeze(2)              # 패딩 위치 가림
def make_causal_mask(seq_len, device):
    return torch.tril(torch.ones(seq_len, seq_len, device=device)).bool().unsqueeze(0).unsqueeze(0)
def make_decoder_mask(tgt, pad_id):
    return make_padding_mask(tgt, pad_id) & make_causal_mask(tgt.size(1), tgt.device)
""",
    check="""
assert make_causal_mask(3, torch.device("cpu")).sum().item() == 6   # 1+2+3
print("✅ 마스크 OK")
""",
)

# ============================================================ 4. 학습
md("""## 4️⃣ 학습 — "틀린 만큼 조금씩 고치기"

학습은 **(1) 예측 → (2) 정답과 비교해 loss 계산 → (3) loss만큼 가중치 수정** 의 반복입니다.
loss 숫자가 점점 0에 가까워지면 잘 배우는 중이에요.""")
unit(
    "질문/답을 번호 텐서로 바꾸고 길이를 맞추는 함수입니다.",
    """
def build_batches(pairs, sv, tv):
    src = [torch.tensor(sv.encode(q, add_special=False)) for q, _ in pairs]
    tgt = [torch.tensor(tv.encode(a, add_special=True)) for _, a in pairs]
    src = pad_sequence(src, batch_first=True, padding_value=sv.pad_id)   # 길이 맞추기
    tgt = pad_sequence(tgt, batch_first=True, padding_value=tv.pad_id)
    return src, tgt
""",
)
unit(
    "모델을 만들고 400번 학습합니다(수 초). loss가 쑥쑥 내려가는지 보세요.",
    """
torch.manual_seed(42)                                    # 재현성(같은 결과)
src_ids, tgt_ids = build_batches(DATA, src_vocab, tgt_vocab)
max_len = max(src_ids.size(1), tgt_ids.size(1), 20) + 2
model = Transformer(len(src_vocab), len(tgt_vocab), max_len=max_len)
opt = torch.optim.Adam(model.parameters(), lr=3e-4)
crit = nn.CrossEntropyLoss(ignore_index=tgt_vocab.pad_id)
dec_in, dec_tgt = tgt_ids[:, :-1], tgt_ids[:, 1:]        # 입력은 <sos>부터, 정답은 한 칸 뒤
src_mask = make_padding_mask(src_ids, src_vocab.pad_id)
model.train()
for ep in range(1, 401):
    tgt_mask = make_decoder_mask(dec_in, tgt_vocab.pad_id)
    logits = model(src_ids, dec_in, src_mask, tgt_mask)                    # (1) 예측
    loss = crit(logits.reshape(-1, logits.size(-1)), dec_tgt.reshape(-1))  # (2) 정답과 비교
    opt.zero_grad(); loss.backward(); opt.step()                          # (3) 가중치 수정
    if ep % 100 == 0 or ep == 1:
        print(f"epoch {ep:4d} | loss {loss.item():.4f}")
""",
    check='assert loss.item() < 0.5\nprint("✅ 학습 완료! 최종 loss", round(loss.item(), 4))',
)

# ============================================================ 5. 생성
md("""## 5️⃣ 답 만들기 — 한 단어씩(마스킹)

답은 `<sos>`부터 **한 단어씩** 만듭니다. 다음 단어를 고를 땐 **앞말만** 볼 수 있어요(미래는 마스킹).
끝말잇기랑 비슷하죠!""")
unit(
    "질문을 받아 답을 greedy로 한 단어씩 생성하는 함수입니다(어텐션도 함께 뽑아 둠).",
    """
@torch.no_grad()
def answer(model, sv, tv, question, max_len=20):
    model.eval()
    src = torch.tensor([sv.encode(question, add_special=False)])
    src_mask = make_padding_mask(src, sv.pad_id)
    enc = model.encode(src, src_mask)
    gen, steps = [tv.sos_id], []
    for _ in range(max_len):
        tgt = torch.tensor([gen])
        tgt_mask = make_causal_mask(tgt.size(1), tgt.device)
        logits = model.decode_step(tgt, enc, tgt_mask, src_mask)
        nxt = logits[0, -1].argmax().item()               # 마지막 위치의 최고점 단어
        steps.append((tv.decode(gen), tv.itos[nxt]))
        gen.append(nxt)
        if nxt == tv.eos_id:
            break
    tgt = torch.tensor([gen]); tgt_mask = make_causal_mask(tgt.size(1), tgt.device)
    model.decode_step(tgt, enc, tgt_mask, src_mask)       # 어텐션 확보용 한 번 더
    cross = model.decoder.layers[-1].cross_attn.last_attn_weights[0].mean(0)
    return steps, tv.decode(gen), cross
""",
)
unit(
    "먹구름 질문에 답해 보고, 한 단어씩 만들어지는 과정을 출력합니다.",
    """
q = "하늘에 먹구름이 보이면 뭐가 생각나"
steps, ans, cross = answer(model, src_vocab, tgt_vocab, q)
print("질문:", q)
for seen, nxt in steps:
    print(f"  '{seen or '<sos>'}'  →  {nxt}")
print("답:", ans)
""",
)

# ============================================================ 6. 히트맵
md("""## 6️⃣ 어텐션 히트맵 — 답이 어디에 주목했나?

이제 핵심! 답의 각 단어가 **질문의 어느 단어를 봤는지** 색으로 봅니다.
'먹구름이' 열이 가장 **밝으면** 성공 — 모델이 먹구름에 주목해 '비'를 떠올린 거예요. 🌧️""")
unit(
    "답 토큰이 질문 토큰에 준 어텐션을 히트맵으로 그립니다.",
    """
def show_attention(question, answer_text, cross):
    qs, ans_toks = tokenize(question), tokenize(answer_text)
    w = cross[:len(ans_toks), :len(qs)].numpy()
    plt.figure(figsize=(1.1 * len(qs) + 1, 0.7 * len(ans_toks) + 1))
    plt.imshow(w, aspect="auto", cmap="viridis")
    plt.xticks(range(len(qs)), qs, rotation=30, ha="right")
    plt.yticks(range(len(ans_toks)), ans_toks)
    plt.xlabel("질문 토큰"); plt.ylabel("생성한 답 토큰")
    plt.title(f"'{answer_text}' 이(가) 주목한 곳")
    plt.colorbar(); plt.tight_layout(); plt.show()
""",
)
unit(
    "히트맵을 그려 봅니다. '먹구름이' 열이 환하게 빛나면 성공!",
    """
show_attention(q, ans, cross)
""",
)

# ============================================================ 7. 대조
md("""## 7️⃣ 대조 — 키워드가 바뀌면 답도 바뀐다

문장 틀은 똑같은데 '대상' 단어만 바꾸면, 모델이 주목하는 곳이 옮겨가고 답도 달라집니다.""")
unit(
    "세 가지 질문에 답해 보고 비교합니다.",
    """
for q in ["하늘에 먹구름이 보이면 뭐가 생각나",
          "하늘에 별이 보이면 뭐가 생각나",
          "하늘에 해가 보이면 뭐가 생각나"]:
    _, a, _ = answer(model, src_vocab, tgt_vocab, q)
    print(f"{tokenize(q)[1]:<6} → {a}")
""",
)

# ============================================================ 8. 정리
md("""## 8️⃣ 정리 & 다음 단계 🎉

수고했어요! 방금 여러분은 트랜스포머를 **손으로 직접 만들어** 봤습니다.

- **어텐션** = 답을 만들 때 중요한 단어(먹구름)에 **밑줄 긋기**
- **마스킹 디코딩** = 답을 **한 단어씩**, 미래는 못 보고 만들기
- **크로스 어텐션** = 답을 쓰는 내내 **질문을 곁눈질**

➡️ 다음은 본 과제 **한국어→영어 번역 미니 트랜스포머**입니다. 구조는 똑같고,
**질문→답**이 **한국어→영어**로 바뀔 뿐이에요. 여기서 익힌 감각으로 바로 도전해 보세요!""")

# ============================================================ emit ipynb
def to_lines(src):
    lines = src.split("\n")
    return [l + "\n" for l in lines[:-1]] + [lines[-1]]


cells = []
for kind, src in NB:
    if kind == "markdown":
        cells.append({"cell_type": "markdown", "metadata": {}, "source": to_lines(src)})
    else:
        cells.append({"cell_type": "code", "metadata": {}, "execution_count": None,
                      "outputs": [], "source": to_lines(src)})

nb = {
    "cells": cells,
    "metadata": {
        "colab": {"provenance": [], "toc_visible": True},
        "kernelspec": {"name": "python3", "display_name": "Python 3"},
        "language_info": {"name": "python"},
    },
    "nbformat": 4, "nbformat_minor": 5,
}
os.makedirs(EX_DIR, exist_ok=True)
with open(NB_PATH, "w", encoding="utf-8") as f:
    json.dump(nb, f, ensure_ascii=False, indent=1)

# ============================================================ emit verify script
verify_lines = ["import matplotlib", "matplotlib.use('Agg')  # 검증 시 창 안 띄움"]
for block in VERIFY:
    for line in block.split("\n"):
        s = line.lstrip()
        if s.startswith("!") or s.startswith("%"):   # 셸 매직은 로컬 실행에서 제외
            continue
        verify_lines.append(line)
    verify_lines.append("")
with open(VERIFY_PATH, "w", encoding="utf-8") as f:
    f.write("\n".join(verify_lines))

n_code = sum(1 for k, _ in NB if k == "code")
n_md = sum(1 for k, _ in NB if k == "markdown")
print(f"notebook -> {NB_PATH}")
print(f"cells: {len(cells)} (markdown {n_md}, code {n_code})")
print(f"verify  -> {VERIFY_PATH}")
