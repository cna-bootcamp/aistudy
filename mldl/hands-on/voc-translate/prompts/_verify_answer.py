import matplotlib
matplotlib.use('Agg')
# 한글 폰트 설치 (그래프의 한글 라벨이 □□로 깨지지 않게 함) — Colab에서만 동작

import math, random, hashlib
import torch
from torch import nn
from torch.nn.utils.rnn import pad_sequence
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm

# 한글 폰트 적용 (설치 실패해도 실습에는 지장 없음)
try:
    fm.fontManager.addfont('/usr/share/fonts/truetype/nanum/NanumGothic.ttf')
    plt.rcParams['font.family'] = 'NanumGothic'
except Exception:
    print("⚠️ 한글 폰트 설정 실패 — 그래프의 한글 라벨이 깨질 수 있습니다(실습 진행에는 지장 없음).")
plt.rcParams['axes.unicode_minus'] = False
import logging
logging.getLogger('matplotlib.mathtext').setLevel(logging.ERROR)  # 로그 스케일 그래프의 U+2212(−) 글리프 경고 숨김

def set_seed(seed=42):
    random.seed(seed); torch.manual_seed(seed)

print("PyTorch 버전:", torch.__version__, "| GPU 필요 없음 (CPU로 충분합니다)")


# 참고: 리포의 data/glossary.json 이 원본(SoT)입니다. 아래 인라인 dict는 실습 자기완결용 사본이며
#       조합 생성에 쓰이지 않는 'domain' 키만 생략했습니다(결과 문장은 원본과 100% 동일).
GLOSSARY = {
    "subjects": [{"ko":"고객","en":"the customer"},{"ko":"구매자","en":"the buyer"},
                 {"ko":"상담원","en":"the agent"},{"ko":"판매자","en":"the seller"}],
    "objects": [{"ko":"주문","en":"the order"},{"ko":"배송","en":"the delivery"},
                {"ko":"환불","en":"the refund"},{"ko":"교환","en":"the exchange"},
                {"ko":"재고","en":"the stock"},{"ko":"리뷰","en":"the review"},
                {"ko":"쿠폰","en":"the coupon"},{"ko":"결제","en":"the payment"}],
    "transitive_predicates": [{"ko":"문의하다","en":"inquires about"},{"ko":"요청하다","en":"requests"},
                {"ko":"확인하다","en":"checks"},{"ko":"취소하다","en":"cancels"},
                {"ko":"처리하다","en":"processes"},{"ko":"등록하다","en":"registers"},
                {"ko":"발송하다","en":"sends out"}],
    "status_predicates": [{"ko":"지연되다","en":"is delayed"},{"ko":"완료되다","en":"is completed"}],
}

def has_final_consonant(w):
    code = ord(w[-1]) - 0xAC00
    return code % 28 != 0 if 0 <= code < 11172 else False
def subj_particle(w): return w + ("이" if has_final_consonant(w) else "가")
def obj_particle(w):  return w + ("을" if has_final_consonant(w) else "를")
def conjugate(f):
    if f.endswith("하다"): return f[:-2] + "한다"
    if f.endswith("되다"): return f[:-2] + "된다"
    raise ValueError(f)

def build_pairs(g):
    pairs = []
    for s in g["subjects"]:
        for o in g["objects"]:
            for p in g["transitive_predicates"]:
                ko = f"{subj_particle(s['ko'])} {obj_particle(o['ko'])} {conjugate(p['ko'])}"
                pairs.append((ko, f"{s['en']} {p['en']} {o['en']}"))
    for o in g["objects"]:
        for p in g["status_predicates"]:
            pairs.append((f"{subj_particle(o['ko'])} {conjugate(p['ko'])}", f"{o['en']} {p['en']}"))
    return pairs

all_pairs = build_pairs(GLOSSARY)
assert len(set(all_pairs)) == len(all_pairs), "중복 문장쌍 발생!"
random.seed(42)                 # 셔플 직전 시드 재고정 → 이 셀만 다시 실행해도 항상 같은 결과
random.shuffle(all_pairs)
train_pairs, heldout_pairs = all_pairs[:100], all_pairs[100:120]

# 데이터가 원본과 100% 동일하게 재현됐는지 내용 해시로 확인
# (글로서리/템플릿을 수정했다면 이 해시는 당연히 달라집니다 → data/build_dataset.py 로 새 해시를 구해 아래 값을 갱신하세요)
_hash = hashlib.sha256("|".join(f"{k}->{v}" for k,v in train_pairs).encode()).hexdigest()[:12]
assert len(all_pairs)==240 and len(train_pairs)==100 and len(heldout_pairs)==20, "문장 수 확인!"
assert _hash == "ed82e8d012d0", f"데이터 재현 실패(해시={_hash}). 글로서리를 바꾸지 않았다면 이 셀을 처음부터 다시 실행하세요."
print(f"전체 조합 {len(all_pairs)}개 | 학습 {len(train_pairs)} | held-out {len(heldout_pairs)}")
print("학습 문장 예시:")
for ko, en in train_pairs[:5]:
    print(f"  {ko}  →  {en}")


PAD, SOS, EOS, UNK = "<pad>", "<sos>", "<eos>", "<unk>"
SPECIAL = [PAD, SOS, EOS, UNK]
def tokenize(s): return s.strip().split()

class Vocab:
    # 단어 <-> 정수 id 를 서로 변환하는 사전
    def __init__(self, sentences=None, itos=None):
        if itos is not None:
            self.itos = list(itos)
        else:
            toks = sorted({t for s in (sentences or []) for t in tokenize(s)})
            self.itos = list(SPECIAL) + toks
        self.stoi = {t:i for i,t in enumerate(self.itos)}
    def __len__(self): return len(self.itos)
    @property
    def pad_id(self): return self.stoi[PAD]
    @property
    def sos_id(self): return self.stoi[SOS]
    @property
    def eos_id(self): return self.stoi[EOS]
    def encode(self, s, add_special=True):
        ids = [self.stoi.get(t, self.stoi[UNK]) for t in tokenize(s)]
        return [self.sos_id]+ids+[self.eos_id] if add_special else ids
    def decode(self, ids):
        return " ".join(self.itos[i] for i in ids if self.itos[i] not in (PAD,SOS,EOS))

src_vocab = Vocab([k for k,_ in train_pairs])
tgt_vocab = Vocab([v for _,v in train_pairs])
print(f"한국어 단어장 크기={len(src_vocab)}, 영어 단어장 크기={len(tgt_vocab)}")


# 학습 루프의 핵심: (1) 예측 → (2) 정답과 비교해 loss 계산 → (3) loss만큼 가중치 수정
# 아래 함수는 '정의'만 합니다. 실제 실행은 7번 캡스톤에서!
def build_batches(pairs, sv, tv):
    sb = [torch.tensor(sv.encode(s, add_special=False)) for s,_ in pairs]  # 인코더 입력엔 <sos>/<eos> 불필요
    tb = [torch.tensor(tv.encode(t)) for _,t in pairs]                      # 디코더는 <sos>로 시작·<eos>로 끝
    si = pad_sequence(sb, batch_first=True, padding_value=sv.pad_id)
    ti = pad_sequence(tb, batch_first=True, padding_value=tv.pad_id)
    return si, ti

def train_model(pairs, sv, tv, epochs=400, d_model=64, num_heads=4, num_layers=2, d_ff=256, lr=3e-4, seed=42):
    set_seed(seed)                                   # 재실행해도 같은 결과가 나오도록 시드 고정
    src_ids, tgt_ids = build_batches(pairs, sv, tv)
    max_len = max(src_ids.size(1), tgt_ids.size(1)) + 2
    model = Transformer(len(sv), len(tv), d_model, num_heads, num_layers, d_ff, max_len=max_len)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    crit = nn.CrossEntropyLoss(ignore_index=tv.pad_id)
    dec_in, dec_tgt = tgt_ids[:, :-1], tgt_ids[:, 1:]
    src_mask = make_padding_mask(src_ids, sv.pad_id)
    history = []
    model.train()
    for ep in range(1, epochs+1):
        tgt_mask = make_decoder_mask(dec_in, tv.pad_id)     # 학습: 패딩 + 미래가림(causal) 둘 다
        logits = model(src_ids, dec_in, src_mask, tgt_mask)
        loss = crit(logits.reshape(-1, logits.size(-1)), dec_tgt.reshape(-1))   # (2) 정답과 비교
        opt.zero_grad(); loss.backward(); opt.step()        # (3) 가중치 수정
        history.append(loss.item())
        if ep % 100 == 0 or ep == 1:
            print(f"epoch {ep:4d} | loss {loss.item():.4f}")
    return model, history

# 🔎 즉시 확인: 'loss = 얼마나 틀렸나' 를 장난감 예제로 느껴보기
demo_logits = torch.tensor([[0.1, 0.2, 0.9, 0.3, 0.1]])   # 5개 후보 단어에 대한 점수(랜덤=학습 전 상태)
demo_target = torch.tensor([2])                            # 정답은 인덱스 2번 단어
print("학습 전 예측의 loss:", round(nn.CrossEntropyLoss()(demo_logits, demo_target).item(), 4),
      "→ 학습이 진행되면 이 값이 점점 0에 가까워집니다.")


# 🔎 즉시 확인: 토큰화 & 임베딩
sentence = "고객이 배송을 문의한다"
token_ids = torch.tensor([src_vocab.encode(sentence, add_special=False)])
print("토큰:", tokenize(sentence))
print("토큰 id:", token_ids.tolist())
demo_embed = nn.Embedding(len(src_vocab), 64)     # 각 단어를 64차원 벡터로
print("임베딩 결과 shape:", tuple(demo_embed(token_ids).shape), "(문장1개, 단어3개, 64차원)")


pe_choice = "A) 짝수 인덱스=sin, 홀수 인덱스=cos" #@param ["선택하세요", "A) 짝수 인덱스=sin, 홀수 인덱스=cos", "B) 짝수 인덱스=cos, 홀수 인덱스=sin", "C) 모든 인덱스=sin"]

class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=128, dropout=0.1):
        super().__init__()
        self.dropout = nn.Dropout(dropout)
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float32).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2, dtype=torch.float32) * (-math.log(10000.0)/d_model))
        if pe_choice.startswith("A)"):
            pe[:, 0::2] = torch.sin(position * div_term)   # 짝수 인덱스 = sin
            pe[:, 1::2] = torch.cos(position * div_term)   # 홀수 인덱스 = cos
        elif pe_choice.startswith("B)"):
            pe[:, 0::2] = torch.cos(position * div_term)
            pe[:, 1::2] = torch.sin(position * div_term)
        elif pe_choice.startswith("C)"):
            pe[:, 0::2] = torch.sin(position * div_term)
            pe[:, 1::2] = torch.sin(position * div_term)
        else:
            raise AssertionError("드롭다운에서 A)/B)/C) 중 하나를 선택하세요.")
        self.register_buffer("pe", pe.unsqueeze(0))
    def forward(self, x):
        return self.dropout(x + self.pe[:, :x.size(1)])

# ✅ 자기검증: 선택한 공식이 실제로 올바른 파도무늬를 만드는지 골든 값과 대조
_pe = PositionalEncoding(8, max_len=5, dropout=0.0)(torch.zeros(1,5,8))
_GOLD = torch.tensor([0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.841471, 0.540302, 0.099833, 0.995004, 0.01, 0.99995, 0.001, 1.0, 0.909297, -0.416147, 0.198669, 0.980067, 0.019999, 0.9998, 0.002, 0.999998, 0.14112, -0.989992, 0.29552, 0.955337, 0.029995, 0.99955, 0.003, 0.999996, -0.756802, -0.653644, 0.389418, 0.921061, 0.039989, 0.9992, 0.004, 0.999992]).reshape((1, 5, 8))
assert torch.allclose(_pe, _GOLD, atol=1e-4), \
    "위치 인코딩 값이 다릅니다. 짝수 인덱스(0,2,4..)=sin, 홀수 인덱스(1,3,5..)=cos 인지 확인하세요."
print("✅ 위치 인코딩 정답! (짝수=sin, 홀수=cos)")

# 🔎 즉시 확인: 위치 인코딩의 파도무늬를 그림으로 보기
_pe_full = PositionalEncoding(64, max_len=30, dropout=0.0).pe[0].numpy()
plt.figure(figsize=(7,3))
plt.imshow(_pe_full.T, aspect='auto', cmap='RdBu')
plt.xlabel("위치(몇 번째 단어)"); plt.ylabel("차원"); plt.title("위치 인코딩 파도무늬 (sin/cos)")
plt.colorbar(); plt.tight_layout(); plt.show()


def scaled_dot_product_attention(q, k, v, mask=None, dropout=None):
    d_k = q.size(-1)
    # ① QKᵀ 를 √dₖ 로 나눠 관련도 점수 계산
    scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(d_k)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float("-inf"))   # 가릴 위치는 -무한대 → softmax 후 0
    # ③④ softmax 로 비율(합=1) 만든 뒤 V 를 그 비율대로 가중합
    attn_weights = torch.softmax(scores, dim=-1)
    if dropout is not None:
        attn_weights = dropout(attn_weights)
    context = torch.matmul(attn_weights, v)
    assert attn_weights is not ... and context is not ..., "❗ 위 TODO(주관식) 빈칸(scores/attn_weights/context)을 먼저 채우세요."
    return context, attn_weights

# ✅ 자기검증: 고정 입력에 대한 정답 값과 대조
_q = torch.tensor([[[[1.,0,0,0],[0,1,0,0],[0,0,1,0]]]])
_k = torch.tensor([[[[1.,0,0,0],[1,0,0,0],[0,1,0,0]]]])
_v = torch.tensor([[[[10.,0,0,0],[0,20,0,0],[0,0,30,0]]]])
_ctx, _w = scaled_dot_product_attention(_q, _k, _v)
assert torch.allclose(_w, torch.tensor([0.383652, 0.383652, 0.232697, 0.274069, 0.274069, 0.451863, 0.333333, 0.333333, 0.333333]).reshape((1, 1, 3, 3)), atol=1e-4), \
    "attention 가중치가 다릅니다. 힌트: scores=matmul(q, k.transpose(-2,-1))/sqrt(d_k), 그다음 softmax(dim=-1)."
assert torch.allclose(_ctx, torch.tensor([3.836517, 7.673035, 6.980896, 0.0, 2.740686, 5.481372, 13.555882, 0.0, 3.333333, 6.666667, 10.0, 0.0]).reshape((1, 1, 3, 4)), atol=1e-4), \
    "context 가 다릅니다. 힌트: context = matmul(attn_weights, v)."
print("✅ Self-Attention 공식 정답!")

split_choice = "B) view(b, s, num_heads, head_dim) 후 transpose(1,2)" #@param ["선택하세요", "A) view(b, s, head_dim, num_heads) 후 transpose(1,2)", "B) view(b, s, num_heads, head_dim) 후 transpose(1,2)", "C) view(b, num_heads, s, head_dim)"]

class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, num_heads, dropout=0.1):
        super().__init__()
        assert d_model % num_heads == 0, "d_model 은 num_heads 로 나눠떨어져야 합니다"
        self.d_model, self.num_heads, self.head_dim = d_model, num_heads, d_model // num_heads
        self.w_q = nn.Linear(d_model, d_model); self.w_k = nn.Linear(d_model, d_model)
        self.w_v = nn.Linear(d_model, d_model); self.w_o = nn.Linear(d_model, d_model)
        self.dropout = nn.Dropout(dropout); self.last_attn_weights = None
    def _split_heads(self, x):
        b, s, _ = x.shape
        if split_choice.startswith("A)"):
            return x.view(b, s, self.head_dim, self.num_heads).transpose(1, 2)
        elif split_choice.startswith("B)"):
            return x.view(b, s, self.num_heads, self.head_dim).transpose(1, 2)
        elif split_choice.startswith("C)"):
            return x.view(b, self.num_heads, s, self.head_dim)
        else:
            raise AssertionError("드롭다운에서 A)/B)/C) 중 하나를 선택하세요.")
    def _merge_heads(self, x):
        b, _, s, _ = x.shape
        return x.transpose(1, 2).contiguous().view(b, s, self.d_model)
    def forward(self, query, key, value, mask=None):
        q = self._split_heads(self.w_q(query)); k = self._split_heads(self.w_k(key)); v = self._split_heads(self.w_v(value))
        context, attn = scaled_dot_product_attention(q, k, v, mask, self.dropout)
        self.last_attn_weights = attn.detach()
        return self.w_o(self._merge_heads(context))

# ✅ 자기검증: (1,3,8)을 4개 헤드로 쪼갠 결과가 올바른지 골든 값과 대조
_m = MultiHeadAttention(8, 4, dropout=0.0)
_split = _m._split_heads(torch.arange(24, dtype=torch.float32).reshape(1,3,8))
assert _split.shape == (1,4,3,2) and torch.allclose(_split, torch.tensor([0.0, 1.0, 8.0, 9.0, 16.0, 17.0, 2.0, 3.0, 10.0, 11.0, 18.0, 19.0, 4.0, 5.0, 12.0, 13.0, 20.0, 21.0, 6.0, 7.0, 14.0, 15.0, 22.0, 23.0]).reshape((1, 4, 3, 2)), atol=1e-4), \
    "헤드 분할이 틀렸습니다. 힌트: 먼저 (b, s, num_heads, head_dim)로 view 한 뒤 transpose(1,2)."
print("✅ 헤드 분할 정답! shape =", tuple(_split.shape))

# 🔎 즉시 확인: "나는 사과를 먹었다"에서 '먹었다'가 각 단어에 주목하는 정도 (4단계 + 4개 헤드)
set_seed(7)
demo_tokens = ["나는", "사과를", "먹었다"]
demo_vocab = Vocab([" ".join(demo_tokens)])
emb = nn.Embedding(len(demo_vocab), 8)
ids = torch.tensor([[demo_vocab.stoi[t] for t in demo_tokens]])
mha_demo = MultiHeadAttention(8, 4, dropout=0.0)
_ = mha_demo(emb(ids), emb(ids), emb(ids))
w = mha_demo.last_attn_weights[0]                  # (heads=4, seq=3, seq=3)
qi = demo_tokens.index("먹었다")
fig, axes = plt.subplots(1, 4, figsize=(11, 2.6), sharey=True)
for h in range(4):
    axes[h].bar(demo_tokens, (w[h, qi]*100).tolist(), color="#4C78A8")
    axes[h].set_title(f"헤드 {h}"); axes[h].set_ylabel("주목도(%)")
fig.suptitle("'먹었다'가 각 단어에 주목하는 비율 — 헤드마다 관점이 다릅니다")
plt.tight_layout(); plt.show()
print("→ 헤드마다 주목 대상이 다릅니다. 이것이 '여러 관점으로 동시에 읽기'입니다.")


# FFN: 각 단어를 독립적으로 더 깊이 변환 (d_model → d_model×4 → d_model)
class PositionwiseFeedForward(nn.Module):
    def __init__(self, d_model, d_ff=None, dropout=0.1):
        super().__init__()
        d_ff = d_ff or d_model * 4
        self.net = nn.Sequential(nn.Linear(d_model, d_ff), nn.ReLU(), nn.Dropout(dropout), nn.Linear(d_ff, d_model))
    def forward(self, x): return self.net(x)


enc_resid = "A) norm1(x + 어텐션결과)  ← 잔차+정규화" #@param ["선택하세요", "A) norm1(x + 어텐션결과)  ← 잔차+정규화", "B) norm1(어텐션결과)  ← 잔차 없음", "C) x + norm1(어텐션결과)  ← 정규화 후 더하기"]

class EncoderLayer(nn.Module):
    def __init__(self, d_model, num_heads, d_ff, dropout=0.1):
        super().__init__()
        self.self_attn = MultiHeadAttention(d_model, num_heads, dropout)
        self.ffn = PositionwiseFeedForward(d_model, d_ff, dropout)
        self.norm1 = nn.LayerNorm(d_model); self.norm2 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)
    def forward(self, x, src_mask):
        attn_out = self.self_attn(x, x, x, src_mask)
        if enc_resid.startswith("A)"):
            x = self.norm1(x + self.dropout(attn_out))       # 잔차(원본 x 더하기) + 정규화
        elif enc_resid.startswith("B)"):
            x = self.norm1(self.dropout(attn_out))
        elif enc_resid.startswith("C)"):
            x = x + self.norm1(self.dropout(attn_out))
        else:
            raise AssertionError("드롭다운에서 A)/B)/C) 중 하나를 선택하세요.")
        x = self.norm2(x + self.dropout(self.ffn(x)))
        return x

# ✅ 자기검증: 선택한 순서가 올바른지 골든 값과 대조
torch.manual_seed(0)
_enc = EncoderLayer(8, 2, 16, dropout=0.0)
_out = _enc(torch.randn(1,3,8), None)
assert torch.allclose(_out, torch.tensor([-1.341918, 1.056999, -0.727253, 1.465761, -0.423974, 0.859138, 0.294468, -1.183221, -0.543981, -1.594923, 0.282059, 2.104143, 0.068767, 0.285857, 0.138157, -0.74008, -1.033261, 0.676117, 0.396787, -0.260653, 0.224093, 1.193256, -2.02297, 0.826631]).reshape((1, 3, 8)), atol=1e-3), \
    "잔차+정규화 순서가 틀렸습니다. 힌트: 원본 x 를 더한 뒤 정규화 → norm1(x + dropout(attn_out))."
print("✅ 인코더 블록 정답! 출력 shape =", tuple(_out.shape))

def make_padding_mask(seq, pad_id):
    return (seq != pad_id).unsqueeze(1).unsqueeze(2)

def make_causal_mask(seq_len, device):
    # TODO 정답: 아래쪽 삼각형(자기 자신·이전 위치)만 볼 수 있게 하는 하삼각 행렬
    mask = torch.tril(torch.ones(seq_len, seq_len, device=device)).bool()
    assert mask is not ..., "❗ 위 TODO(주관식) 빈칸(causal mask)을 먼저 채우세요. 힌트: torch.tril(torch.ones(seq_len, seq_len)).bool()"
    return mask.unsqueeze(0).unsqueeze(0)

def make_decoder_mask(tgt, pad_id):
    return make_padding_mask(tgt, pad_id) & make_causal_mask(tgt.size(1), tgt.device)

# ✅ 자기검증: 4x4 하삼각 행렬이 맞는지 대조
_cm_raw = make_causal_mask(4, torch.device("cpu"))
assert _cm_raw.dtype == torch.bool, "마스크는 True/False(bool) 여야 합니다. 힌트: 끝에 .bool() 을 붙이세요."
_cm = _cm_raw.float()
assert torch.allclose(_cm, torch.tensor([1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0]).reshape((1, 1, 4, 4)), atol=1e-4), \
    "마스크가 틀렸습니다. 힌트: torch.tril(torch.ones(seq_len, seq_len)) 로 하삼각 행렬을 만드세요."
print("✅ 미래 가림 마스크 정답!")

# 🔎 즉시 확인: 미래 가림 마스크 모양 (노란색=볼 수 있음, 보라색=가림)
_cm = make_causal_mask(6, torch.device("cpu"))[0,0].float()
plt.figure(figsize=(3.2,3))
plt.imshow(_cm, cmap='viridis')
plt.xlabel("바라보는 위치(K)"); plt.ylabel("현재 단어(Q)"); plt.title("미래 가림 마스크(하삼각)")
plt.tight_layout(); plt.show()


greedy_choice = "C) logits[0, -1].argmax()  ← 마지막 위치에서 최고점 단어" #@param ["선택하세요", "A) logits[0, 0].argmax()", "B) logits.argmax()", "C) logits[0, -1].argmax()  ← 마지막 위치에서 최고점 단어"]

@torch.no_grad()
def translate(model, sv, tv, sentence, max_len=20):
    model.eval()                                     # dropout 끄기 → 항상 같은 번역
    src_ids = torch.tensor([sv.encode(sentence, add_special=False)])
    src_mask = make_padding_mask(src_ids, sv.pad_id)
    enc = model.encode(src_ids, src_mask)
    gen = [tv.sos_id]
    for _ in range(max_len):
        tgt = torch.tensor([gen])
        tgt_mask = make_causal_mask(tgt.size(1), torch.device("cpu"))
        logits = model.decode_step(tgt, enc, tgt_mask, src_mask)
        if greedy_choice.startswith("A)"):   nxt = logits[0, 0].argmax().item()
        elif greedy_choice.startswith("B)"): nxt = logits.argmax().item()
        elif greedy_choice.startswith("C)"): nxt = logits[0, -1].argmax().item()
        else: raise AssertionError("드롭다운에서 A)/B)/C) 중 하나를 선택하세요.")
        gen.append(nxt)
        if nxt == tv.eos_id: break
    cross = model.decoder.layers[-1].cross_attn.last_attn_weights
    return gen, cross

# 🔎 즉시 확인: '마지막 위치에서 최고점 단어 고르기'를 장난감 logits로 연습
_toy = torch.tensor([[[0.1,0.2,0.9,0.3],[0.5,0.1,0.2,0.8]]])   # (1, 2위치, 4단어)
if greedy_choice.startswith("A)"):   _pick = _toy[0, 0].argmax().item()
elif greedy_choice.startswith("B)"): _pick = _toy.argmax().item()
elif greedy_choice.startswith("C)"): _pick = _toy[0, -1].argmax().item()
else: raise AssertionError("드롭다운에서 A)/B)/C) 중 하나를 선택하세요.")
assert _pick == 3, "다음 단어는 '마지막 위치(-1)'의 최고점이어야 합니다. (A=첫 위치, B=전체 평탄화 → 오답)"
print("✅ greedy 선택 정답! 마지막 위치의 최고점 단어 인덱스 =", _pick)

dec_order = "A) self-attn→norm1 → cross-attn→norm2 → ffn→norm3" #@param ["선택하세요", "A) self-attn→norm1 → cross-attn→norm2 → ffn→norm3", "B) cross-attn→norm1 → self-attn→norm2 → ffn→norm3", "C) ffn→norm1 → self-attn→norm2 → cross-attn→norm3"]

class DecoderLayer(nn.Module):
    def __init__(self, d_model, num_heads, d_ff, dropout=0.1):
        super().__init__()
        self.self_attn = MultiHeadAttention(d_model, num_heads, dropout)
        self.cross_attn = MultiHeadAttention(d_model, num_heads, dropout)
        self.ffn = PositionwiseFeedForward(d_model, d_ff, dropout)
        self.norm1 = nn.LayerNorm(d_model); self.norm2 = nn.LayerNorm(d_model); self.norm3 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)
    def forward(self, x, enc_out, tgt_mask, src_mask):
        if dec_order.startswith("A)"):
            x = self.norm1(x + self.dropout(self.self_attn(x, x, x, tgt_mask)))
            x = self.norm2(x + self.dropout(self.cross_attn(x, enc_out, enc_out, src_mask)))
            x = self.norm3(x + self.dropout(self.ffn(x)))
        elif dec_order.startswith("B)"):
            x = self.norm1(x + self.dropout(self.cross_attn(x, enc_out, enc_out, src_mask)))
            x = self.norm2(x + self.dropout(self.self_attn(x, x, x, tgt_mask)))
            x = self.norm3(x + self.dropout(self.ffn(x)))
        elif dec_order.startswith("C)"):
            x = self.norm1(x + self.dropout(self.ffn(x)))
            x = self.norm2(x + self.dropout(self.self_attn(x, x, x, tgt_mask)))
            x = self.norm3(x + self.dropout(self.cross_attn(x, enc_out, enc_out, src_mask)))
        else:
            raise AssertionError("드롭다운에서 A)/B)/C) 중 하나를 선택하세요.")
        return x

# ✅ 자기검증: 선택한 순서가 올바른지 골든 값과 대조
torch.manual_seed(0)
_dec = DecoderLayer(8, 2, 16, dropout=0.0)
_out = _dec(torch.randn(1,3,8), torch.randn(1,3,8), None, None)
assert torch.allclose(_out, torch.tensor([1.656027, 0.371586, -0.442332, 1.038609, -0.992158, -1.599823, -0.403735, 0.371827, -0.001764, -0.102933, 0.622162, 1.788792, -1.929451, 0.303549, -0.762144, 0.081788, 0.249386, 0.140076, 0.528946, 0.100698, -1.777341, -1.067899, 1.824512, 0.001624]).reshape((1, 3, 8)), atol=1e-3), \
    "디코더 블록 순서가 틀렸습니다. 힌트: self-attn(norm1) → cross-attn(norm2) → ffn(norm3)."
print("✅ 디코더 블록 정답! 출력 shape =", tuple(_out.shape))

# Encoder / Decoder / Transformer 조립 (완성 코드)
class Encoder(nn.Module):
    def __init__(self, vocab, d_model, num_heads, num_layers, d_ff, dropout, max_len):
        super().__init__()
        self.d_model = d_model
        self.embedding = nn.Embedding(vocab, d_model)
        self.pos = PositionalEncoding(d_model, max_len, dropout)
        self.layers = nn.ModuleList([EncoderLayer(d_model, num_heads, d_ff, dropout) for _ in range(num_layers)])
    def forward(self, src, src_mask):
        x = self.pos(self.embedding(src) * math.sqrt(self.d_model))
        for l in self.layers: x = l(x, src_mask)
        return x

class Decoder(nn.Module):
    def __init__(self, vocab, d_model, num_heads, num_layers, d_ff, dropout, max_len):
        super().__init__()
        self.d_model = d_model
        self.embedding = nn.Embedding(vocab, d_model)
        self.pos = PositionalEncoding(d_model, max_len, dropout)
        self.layers = nn.ModuleList([DecoderLayer(d_model, num_heads, d_ff, dropout) for _ in range(num_layers)])
    def forward(self, tgt, enc_out, tgt_mask, src_mask):
        x = self.pos(self.embedding(tgt) * math.sqrt(self.d_model))
        for l in self.layers: x = l(x, enc_out, tgt_mask, src_mask)
        return x

class Transformer(nn.Module):
    def __init__(self, src_v, tgt_v, d_model=64, num_heads=4, num_layers=2, d_ff=256, dropout=0.1, max_len=32, tie=True):
        super().__init__()
        self.encoder = Encoder(src_v, d_model, num_heads, num_layers, d_ff, dropout, max_len)
        self.decoder = Decoder(tgt_v, d_model, num_heads, num_layers, d_ff, dropout, max_len)
        self.output_proj = nn.Linear(d_model, tgt_v, bias=False)
        if tie:                                          # Weight Tying: 디코더 임베딩과 출력층 가중치 공유
            self.output_proj.weight = self.decoder.embedding.weight
    def forward(self, src, tgt, src_mask, tgt_mask):
        return self.output_proj(self.decoder(tgt, self.encoder(src, src_mask), tgt_mask, src_mask))
    def encode(self, src, src_mask): return self.encoder(src, src_mask)
    def decode_step(self, tgt, enc, tgt_mask, src_mask):
        return self.output_proj(self.decoder(tgt, enc, tgt_mask, src_mask))


# ▶▶ 학습 실행 — 이 그래프가 바로 [학습과정 1: 모델 학습 방법 이해]의 결과입니다
model, history = train_model(train_pairs, src_vocab, tgt_vocab, epochs=400)
final_loss = history[-1]

fig, ax = plt.subplots(1, 2, figsize=(10, 3))
ax[0].plot(history); ax[0].set_title("loss (선형 스케일)"); ax[0].set_xlabel("epoch"); ax[0].set_ylabel("loss")
ax[1].plot(history); ax[1].set_yscale("log"); ax[1].set_title("loss (로그 스케일)"); ax[1].set_xlabel("epoch")
plt.tight_layout(); plt.show()
print(f"최종 loss = {final_loss:.4f}")

# ✅ 통합 게이트: 부품들이 모두 정답이어야 학습이 제대로 수렴합니다
assert final_loss < 0.5, f"학습이 충분히 수렴하지 않았습니다(loss={final_loss:.3f}). 앞 단계 빈칸을 다시 확인하세요."
print("✅ 학습 수렴 확인 (loss가 0에 충분히 가까움)")


# ▶▶ 번역 실행 — 이 과정이 바로 [학습과정 5: 순차 응답 생성]입니다
def show_translation(sentence, note=""):
    gen, cross = translate(model, src_vocab, tgt_vocab, sentence)
    out = tgt_vocab.decode(gen)
    print(f"입력 : {sentence}")
    # 한 단어씩 생성되는 과정
    steps = [tgt_vocab.itos[i] for i in gen[1:] if tgt_vocab.itos[i] != EOS]
    print("생성 : <sos> " + " → ".join(steps) + " <eos>")
    print(f"번역 : {out}   {note}\n")
    # Cross-Attention 히트맵 (생성한 각 영어 단어가 원문 어느 토큰을 봤는지)
    w = cross[0].mean(0)[:len(steps)]        # 헤드 평균, (생성단어수, 원문토큰수)
    src_toks = tokenize(sentence)
    plt.figure(figsize=(1.2+0.8*len(src_toks), 0.6+0.5*len(steps)))
    plt.imshow(w.numpy(), aspect='auto', cmap='viridis')
    plt.xticks(range(len(src_toks)), src_toks); plt.yticks(range(len(steps)), steps)
    plt.xlabel("원문(한국어) 토큰"); plt.ylabel("생성 단어"); plt.title(f"Cross-Attention: {sentence}")
    plt.colorbar(); plt.tight_layout(); plt.show()

show_translation("고객이 쿠폰을 취소한다", "← 학습 문장(정확히 재현)")
show_translation("상담원이 배송을 등록한다", "← held-out(처음 본 조합도 일반화!)")
show_translation("결제가 지연된다", "← 오역 사례: refund로 혼동(데이터 희소 → 한계 관찰)")

# ✅ 통합 게이트: 학습 문장을 정확히 번역해야 통과 (앞 빈칸이 모두 정답일 때만 성공)
_g, _ = translate(model, src_vocab, tgt_vocab, "고객이 쿠폰을 취소한다")
assert tgt_vocab.decode(_g) == "the customer cancels the coupon", \
    "학습 문장 번역이 정확하지 않습니다. 앞 단계(어텐션·마스크·greedy 선택) 빈칸을 다시 확인하세요."
print("🎉 모든 학습과정 완료! 6개 항목의 부품이 하나의 파이프라인에서 학습·번역까지 성공했습니다.")

