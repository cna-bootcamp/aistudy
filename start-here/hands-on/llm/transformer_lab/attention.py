"""Scaled dot-product attention and multi-head attention, implemented from
scratch (no ``nn.MultiheadAttention``) so every step is visible:

    Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) V

Multi-head attention runs several of these in parallel on different learned
projections of Q/K/V ("different points of view"), then concatenates and
projects the results back to ``d_model``.

This mirrors PyTorch's own reference implementation of
``torch.nn.functional.scaled_dot_product_attention`` step for step (same
QK^T scaling, same boolean-mask-as-``-inf`` convention). For production
code, call that fused/optimized function directly instead of this manual
version -- it dispatches to FlashAttention-2 or memory-efficient kernels.
It is reimplemented here so every intermediate value stays inspectable.
"""

import math

import torch
from torch import nn


def scaled_dot_product_attention(
    q: torch.Tensor,
    k: torch.Tensor,
    v: torch.Tensor,
    mask: torch.Tensor | None = None,
    dropout: nn.Dropout | None = None,
) -> tuple[torch.Tensor, torch.Tensor]:
    """q, k, v: (batch, num_heads, seq_len, head_dim)

    Returns (context, attn_weights) where attn_weights has shape
    (batch, num_heads, q_len, k_len) and is what gets plotted as an
    attention heatmap.
    """
    d_k = q.size(-1)
    scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(d_k)

    if mask is not None:
        scores = scores.masked_fill(mask == 0, float("-inf"))

    attn_weights = torch.softmax(scores, dim=-1)
    if dropout is not None:
        attn_weights = dropout(attn_weights)

    context = torch.matmul(attn_weights, v)
    return context, attn_weights


class MultiHeadAttention(nn.Module):
    def __init__(self, d_model: int, num_heads: int, dropout: float = 0.1):
        super().__init__()
        assert d_model % num_heads == 0, "d_model must be divisible by num_heads"
        self.d_model = d_model
        self.num_heads = num_heads
        self.head_dim = d_model // num_heads

        self.w_q = nn.Linear(d_model, d_model)
        self.w_k = nn.Linear(d_model, d_model)
        self.w_v = nn.Linear(d_model, d_model)
        self.w_o = nn.Linear(d_model, d_model)
        self.dropout = nn.Dropout(dropout)

        self.last_attn_weights: torch.Tensor | None = None

    def _split_heads(self, x: torch.Tensor) -> torch.Tensor:
        batch, seq_len, _ = x.shape
        x = x.view(batch, seq_len, self.num_heads, self.head_dim)
        return x.transpose(1, 2)  # (batch, num_heads, seq_len, head_dim)

    def _merge_heads(self, x: torch.Tensor) -> torch.Tensor:
        batch, _, seq_len, _ = x.shape
        x = x.transpose(1, 2).contiguous()
        return x.view(batch, seq_len, self.d_model)

    def forward(
        self,
        query: torch.Tensor,
        key: torch.Tensor,
        value: torch.Tensor,
        mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        q = self._split_heads(self.w_q(query))
        k = self._split_heads(self.w_k(key))
        v = self._split_heads(self.w_v(value))

        context, attn_weights = scaled_dot_product_attention(q, k, v, mask, self.dropout)
        self.last_attn_weights = attn_weights.detach()

        merged = self._merge_heads(context)
        return self.w_o(merged)
