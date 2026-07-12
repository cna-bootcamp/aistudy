"""Attention masks.

- padding mask: hide <pad> positions so attention never looks at filler tokens
- causal (subsequent) mask: hide future tokens during decoder self-attention,
  the "no cheating" mask described as Masked Self-Attention
"""

import torch


def make_padding_mask(seq: torch.Tensor, pad_id: int) -> torch.Tensor:
    # seq: (batch, seq_len) -> (batch, 1, 1, seq_len), broadcastable over heads/queries
    mask = (seq != pad_id).unsqueeze(1).unsqueeze(2)
    return mask


def make_causal_mask(seq_len: int, device: torch.device) -> torch.Tensor:
    # (1, 1, seq_len, seq_len) lower-triangular: position i can only see j <= i
    mask = torch.tril(torch.ones(seq_len, seq_len, device=device)).bool()
    return mask.unsqueeze(0).unsqueeze(0)


def make_decoder_mask(tgt: torch.Tensor, pad_id: int) -> torch.Tensor:
    pad_mask = make_padding_mask(tgt, pad_id)
    causal_mask = make_causal_mask(tgt.size(1), tgt.device)
    return pad_mask & causal_mask
