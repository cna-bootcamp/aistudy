"""Full encoder-decoder Transformer, assembled from the pieces in this package.

Pipeline (mirrors the reference material step by step):
  token ids -> embedding (+ sqrt(d_model) scale) -> positional encoding
  -> N encoder layers -> encoder output (context-aware source representation)
  -> N decoder layers (masked self-attn + cross-attn to encoder output)
  -> linear projection to vocab size -> softmax over next-token probabilities

``tie_weights=True`` reuses the target embedding matrix as the output
projection ("Weight Tying"): the same matrix that turns a token id into a
vector is transposed and reused to turn a vector back into vocabulary
scores, which saves parameters and keeps input/output in the same
semantic space.
"""

import math

import torch
from torch import nn

from .layers import DecoderLayer, EncoderLayer
from .positional_encoding import PositionalEncoding


class Encoder(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        d_model: int,
        num_heads: int,
        num_layers: int,
        d_ff: int,
        dropout: float,
        max_len: int,
    ):
        super().__init__()
        self.d_model = d_model
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.pos_encoding = PositionalEncoding(d_model, max_len, dropout)
        self.layers = nn.ModuleList(
            [EncoderLayer(d_model, num_heads, d_ff, dropout) for _ in range(num_layers)]
        )

    def forward(self, src_ids: torch.Tensor, src_mask: torch.Tensor) -> torch.Tensor:
        x = self.embedding(src_ids) * math.sqrt(self.d_model)
        x = self.pos_encoding(x)
        for layer in self.layers:
            x = layer(x, src_mask)
        return x


class Decoder(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        d_model: int,
        num_heads: int,
        num_layers: int,
        d_ff: int,
        dropout: float,
        max_len: int,
    ):
        super().__init__()
        self.d_model = d_model
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.pos_encoding = PositionalEncoding(d_model, max_len, dropout)
        self.layers = nn.ModuleList(
            [DecoderLayer(d_model, num_heads, d_ff, dropout) for _ in range(num_layers)]
        )

    def forward(
        self,
        tgt_ids: torch.Tensor,
        enc_out: torch.Tensor,
        tgt_mask: torch.Tensor,
        src_mask: torch.Tensor,
    ) -> torch.Tensor:
        x = self.embedding(tgt_ids) * math.sqrt(self.d_model)
        x = self.pos_encoding(x)
        for layer in self.layers:
            x = layer(x, enc_out, tgt_mask, src_mask)
        return x


class Transformer(nn.Module):
    def __init__(
        self,
        src_vocab_size: int,
        tgt_vocab_size: int,
        d_model: int = 128,
        num_heads: int = 4,
        num_layers: int = 2,
        d_ff: int = 512,
        dropout: float = 0.1,
        max_len: int = 32,
        tie_weights: bool = True,
    ):
        super().__init__()
        self.encoder = Encoder(src_vocab_size, d_model, num_heads, num_layers, d_ff, dropout, max_len)
        self.decoder = Decoder(tgt_vocab_size, d_model, num_heads, num_layers, d_ff, dropout, max_len)
        self.output_proj = nn.Linear(d_model, tgt_vocab_size, bias=False)

        if tie_weights:
            self.output_proj.weight = self.decoder.embedding.weight

    def forward(
        self,
        src_ids: torch.Tensor,
        tgt_ids: torch.Tensor,
        src_mask: torch.Tensor,
        tgt_mask: torch.Tensor,
    ) -> torch.Tensor:
        enc_out = self.encoder(src_ids, src_mask)
        dec_out = self.decoder(tgt_ids, enc_out, tgt_mask, src_mask)
        return self.output_proj(dec_out)

    def encode(self, src_ids: torch.Tensor, src_mask: torch.Tensor) -> torch.Tensor:
        return self.encoder(src_ids, src_mask)

    def decode_step(
        self,
        tgt_ids: torch.Tensor,
        enc_out: torch.Tensor,
        tgt_mask: torch.Tensor,
        src_mask: torch.Tensor,
    ) -> torch.Tensor:
        dec_out = self.decoder(tgt_ids, enc_out, tgt_mask, src_mask)
        return self.output_proj(dec_out)
