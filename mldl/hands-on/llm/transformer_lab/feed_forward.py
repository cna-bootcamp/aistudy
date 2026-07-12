"""Position-wise feed-forward network: FFN(x) = ReLU(xW1 + b1)W2 + b2

Each token is transformed independently (no cross-token interaction here —
that is what attention is for). The hidden layer expands d_model by 4x,
matching the original Transformer paper.
"""

from torch import nn


class PositionwiseFeedForward(nn.Module):
    def __init__(self, d_model: int, d_ff: int | None = None, dropout: float = 0.1):
        super().__init__()
        d_ff = d_ff or d_model * 4
        self.net = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(d_ff, d_model),
        )

    def forward(self, x):
        return self.net(x)
