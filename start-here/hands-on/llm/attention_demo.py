"""Standalone, no-training-required walkthrough of Self-Attention and
Multi-Head Attention, using this project's real attention code
(``transformer_lab.attention``) instead of a hand-derived toy formula.

Mirrors the worked example in the reference material (see README "참고 자료"):
sentence "나는 사과를 먹었다", focusing on how the word "먹었다" attends to
"나는", "사과를" and itself:

    Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) V

Run with no arguments -- nothing needs to be trained first:
    python attention_demo.py
"""

import torch
from torch import nn

from transformer_lab.attention import MultiHeadAttention, scaled_dot_product_attention
from transformer_lab.tokenizer import Vocab

torch.manual_seed(7)

TOKENS = ["나는", "사과를", "먹었다"]


def fmt_row(values) -> str:
    return "  ".join(f"{v:7.3f}" for v in values)


def self_attention_walkthrough():
    print("=" * 70)
    print("STEP 1. Self-Attention: 'Attention = softmax(QK^T / sqrt(d_k)) x V'")
    print("=" * 70)

    vocab = Vocab([" ".join(TOKENS)])
    d_model = 4  # small, matches the reference doc's toy 4-dim example
    embedding = nn.Embedding(len(vocab), d_model)
    w_q, w_k, w_v = (nn.Linear(d_model, d_model, bias=False) for _ in range(3))

    token_ids = torch.tensor([[vocab.stoi[tok] for tok in TOKENS]])
    x = embedding(token_ids)  # (1, 3, d_model)
    q, k, v = w_q(x), w_k(x), w_v(x)

    print(f"\ntoken embeddings x (d_model={d_model}):")
    for tok, vec in zip(TOKENS, x[0].tolist()):
        print(f"  {tok:6s} {fmt_row(vec)}")

    # ① QK^T : dot product between "먹었다"'s query and every token's key
    query_word_idx = TOKENS.index("먹었다")
    raw_scores = (q[0, query_word_idx] @ k[0].T)
    print(f"\n① QK^T  (query='먹었다' vs. each key):")
    print(f"  {fmt_row(raw_scores.tolist())}   (order: {', '.join(TOKENS)})")

    # ② scale by sqrt(d_k)
    scaled_scores = raw_scores / (d_model ** 0.5)
    print(f"\n② scaled by 1/sqrt(d_k)={1 / d_model ** 0.5:.3f}:")
    print(f"  {fmt_row(scaled_scores.tolist())}")

    # ③ softmax -> attention weights that sum to 1
    attn_weights = torch.softmax(scaled_scores, dim=-1)
    print(f"\n③ softmax (attention weights, sum=1):")
    for tok, w in zip(TOKENS, attn_weights.tolist()):
        print(f"  {tok:6s} {w * 100:5.1f}%")

    # ④ weighted sum of values -> new context vector for "먹었다"
    context = attn_weights @ v[0]
    print(f"\n④ weighted sum of V -> new context vector for '먹었다':")
    print(f"  {fmt_row(context.tolist())}")

    # Sanity check: the library function must produce the identical result.
    lib_context, lib_weights = scaled_dot_product_attention(
        q[:, None, query_word_idx : query_word_idx + 1], k[:, None], v[:, None]
    )
    assert torch.allclose(lib_context[0, 0, 0], context, atol=1e-5)
    assert torch.allclose(lib_weights[0, 0, 0], attn_weights, atol=1e-5)
    print("\n[OK] transformer_lab.attention.scaled_dot_product_attention() matches this walkthrough.")

    data = {
        "tokens": TOKENS,
        "d_model": d_model,
        "query_word": TOKENS[query_word_idx],
        "embeddings": x[0].tolist(),
        "values": v[0].tolist(),  # each token's V-vector, so step 4 can show the actual mixing recipe
        "raw_scores": raw_scores.tolist(),
        "scale_factor": 1 / d_model**0.5,
        "scaled_scores": scaled_scores.tolist(),
        "attn_weights": attn_weights.tolist(),
        "context": context.tolist(),
    }
    return x, data


def multi_head_shape_demo(x: torch.Tensor):
    print()
    print("=" * 70)
    print("STEP 2. Multi-Head Attention: same idea, several heads in parallel")
    print("=" * 70)

    d_model, num_heads = 8, 4
    embedding = nn.Embedding(x.size(1) + 1, d_model)  # re-embed at the real d_model size
    token_ids = torch.arange(x.size(1)).unsqueeze(0)
    x_full = embedding(token_ids)

    mha = MultiHeadAttention(d_model=d_model, num_heads=num_heads, dropout=0.0)
    out = mha(x_full, x_full, x_full)

    head_dim = d_model // num_heads
    print(f"\nd_model={d_model} split into num_heads={num_heads} x head_dim={head_dim}")
    print(f"input shape  : {tuple(x_full.shape)}   (batch, seq_len, d_model)")
    print(f"output shape : {tuple(out.shape)}   (concat of all heads, projected back to d_model)")
    print(f"attention weights shape per head: {tuple(mha.last_attn_weights.shape)}"
          " (batch, num_heads, seq_len, seq_len)")
    for h in range(num_heads):
        print(f"  head {h}: {fmt_row(mha.last_attn_weights[0, h, TOKENS.index('먹었다')].tolist())}"
              f"   (order: {', '.join(TOKENS)})")
    print("\nEach head attends to the same tokens with a different learned Q/K/V "
          "projection -- e.g. one head can end up specializing in subject-verb "
          "relations while another focuses on object-verb relations.")

    return {
        "tokens": TOKENS,
        "d_model": d_model,
        "num_heads": num_heads,
        "head_dim": head_dim,
        "query_word": TOKENS[TOKENS.index("먹었다")],
        "head_weights": [
            mha.last_attn_weights[0, h, TOKENS.index("먹었다")].tolist() for h in range(num_heads)
        ],
    }


if __name__ == "__main__":
    x, _self_attn_data = self_attention_walkthrough()
    multi_head_shape_demo(x)
