import matplotlib
matplotlib.use('Agg')  # 검증 시 창 안 띄움
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

assert len(DATA) == 6
print("✅ 데이터 OK")

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

src_vocab = Vocab([q for q, _ in DATA])         # 질문 단어장
tgt_vocab = Vocab([a for _, a in DATA])         # 답 단어장
print("질문 단어", len(src_vocab), "| 답 단어", len(tgt_vocab))

assert src_vocab.pad_id == 0 and tgt_vocab.sos_id == 1
print("✅ 사전 OK")

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

def scaled_dot_product_attention(q, k, v, mask=None, dropout=None):
    d_k = q.size(-1)
    scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(d_k)   # 관련도 점수
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float("-inf"))        # 가릴 곳은 -무한대
    attn = torch.softmax(scores, dim=-1)                             # 합=1 비율로
    if dropout is not None:
        attn = dropout(attn)
    return torch.matmul(attn, v), attn                               # V를 비율대로 가중합

_c, _w = scaled_dot_product_attention(torch.ones(1, 1, 2, 4), torch.ones(1, 1, 2, 4),
                                      torch.arange(8.).reshape(1, 1, 2, 4))
assert torch.allclose(_w, torch.full((1, 1, 2, 2), 0.5))   # 점수가 같으면 0.5씩 균등
print("✅ 어텐션 공식 OK")

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

_m = MultiHeadAttention(8, 4, 0.0)
assert _m(torch.randn(1, 3, 8), torch.randn(1, 3, 8), torch.randn(1, 3, 8)).shape == (1, 3, 8)
print("✅ 멀티헤드 OK")

class PositionwiseFeedForward(nn.Module):
    def __init__(self, d_model, d_ff, dropout=0.1):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d_model, d_ff), nn.ReLU(),
                                 nn.Dropout(dropout), nn.Linear(d_ff, d_model))
    def forward(self, x):
        return self.net(x)

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

def make_padding_mask(seq, pad_id):
    return (seq != pad_id).unsqueeze(1).unsqueeze(2)              # 패딩 위치 가림
def make_causal_mask(seq_len, device):
    return torch.tril(torch.ones(seq_len, seq_len, device=device)).bool().unsqueeze(0).unsqueeze(0)
def make_decoder_mask(tgt, pad_id):
    return make_padding_mask(tgt, pad_id) & make_causal_mask(tgt.size(1), tgt.device)

assert make_causal_mask(3, torch.device("cpu")).sum().item() == 6   # 1+2+3
print("✅ 마스크 OK")

def build_batches(pairs, sv, tv):
    src = [torch.tensor(sv.encode(q, add_special=False)) for q, _ in pairs]
    tgt = [torch.tensor(tv.encode(a, add_special=True)) for _, a in pairs]
    src = pad_sequence(src, batch_first=True, padding_value=sv.pad_id)   # 길이 맞추기
    tgt = pad_sequence(tgt, batch_first=True, padding_value=tv.pad_id)
    return src, tgt

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

assert loss.item() < 0.5
print("✅ 학습 완료! 최종 loss", round(loss.item(), 4))

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

q = "하늘에 먹구름이 보이면 뭐가 생각나"
steps, ans, cross = answer(model, src_vocab, tgt_vocab, q)
print("질문:", q)
for seen, nxt in steps:
    print(f"  '{seen or '<sos>'}'  →  {nxt}")
print("답:", ans)

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

show_attention(q, ans, cross)

for q in ["하늘에 먹구름이 보이면 뭐가 생각나",
          "하늘에 별이 보이면 뭐가 생각나",
          "하늘에 해가 보이면 뭐가 생각나"]:
    _, a, _ = answer(model, src_vocab, tgt_vocab, q)
    print(f"{tokenize(q)[1]:<6} → {a}")
