"""Train the from-scratch mini Transformer on a tiny Korean -> English toy
corpus (data/ko_en_pairs.txt). The dataset is intentionally tiny: the goal
is to *see the mechanism work end to end* (loss going down, attention
weights becoming sharp, greedy decoding producing the right words), not to
build a real translator.

Usage:
    python train.py
    python train.py --epochs 300 --d-model 64 --num-heads 4
"""

import argparse
import random

import torch
from torch import nn
from torch.nn.utils.rnn import pad_sequence

from transformer_lab.masks import make_decoder_mask, make_padding_mask
from transformer_lab.tokenizer import Vocab, load_pairs
from transformer_lab.transformer import Transformer

DATA_PATH = "data/ko_en_pairs.txt"
CHECKPOINT_PATH = "checkpoint.pt"


def set_seed(seed: int) -> None:
    random.seed(seed)
    torch.manual_seed(seed)


def build_batches(pairs, src_vocab, tgt_vocab, device):
    # Encoder input needs only the source tokens (no <sos>/<eos>): it does
    # not generate anything, so it has no "start"/"stop" signal to encode.
    # The decoder DOES need them: <sos> kicks off generation and <eos> is
    # the training target that teaches the model when to stop.
    src_batch = [torch.tensor(src_vocab.encode(src, add_special=False)) for src, _ in pairs]
    tgt_batch = [torch.tensor(tgt_vocab.encode(tgt)) for _, tgt in pairs]
    src_ids = pad_sequence(src_batch, batch_first=True, padding_value=src_vocab.pad_id).to(device)
    tgt_ids = pad_sequence(tgt_batch, batch_first=True, padding_value=tgt_vocab.pad_id).to(device)
    return src_ids, tgt_ids


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--epochs", type=int, default=400)
    parser.add_argument("--d-model", type=int, default=64)
    parser.add_argument("--num-heads", type=int, default=4)
    parser.add_argument("--num-layers", type=int, default=2)
    parser.add_argument("--d-ff", type=int, default=256)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--log-every", type=int, default=20)
    args = parser.parse_args()

    set_seed(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    pairs = load_pairs(DATA_PATH)
    src_vocab = Vocab([src for src, _ in pairs])
    tgt_vocab = Vocab([tgt for _, tgt in pairs])
    print(f"loaded {len(pairs)} sentence pairs | src_vocab={len(src_vocab)} tgt_vocab={len(tgt_vocab)}")

    src_ids, tgt_ids = build_batches(pairs, src_vocab, tgt_vocab, device)
    max_len = max(src_ids.size(1), tgt_ids.size(1)) + 2

    model = Transformer(
        src_vocab_size=len(src_vocab),
        tgt_vocab_size=len(tgt_vocab),
        d_model=args.d_model,
        num_heads=args.num_heads,
        num_layers=args.num_layers,
        d_ff=args.d_ff,
        max_len=max_len,
    ).to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    criterion = nn.CrossEntropyLoss(ignore_index=tgt_vocab.pad_id)

    decoder_input = tgt_ids[:, :-1]
    decoder_target = tgt_ids[:, 1:]

    src_mask = make_padding_mask(src_ids, src_vocab.pad_id)

    loss_history = []  # kept alongside the checkpoint so web/generate_web_data.py can plot it

    model.train()
    for epoch in range(1, args.epochs + 1):
        tgt_mask = make_decoder_mask(decoder_input, tgt_vocab.pad_id)

        logits = model(src_ids, decoder_input, src_mask, tgt_mask)
        loss = criterion(logits.reshape(-1, logits.size(-1)), decoder_target.reshape(-1))

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        loss_history.append({"epoch": epoch, "loss": loss.item()})
        if epoch % args.log_every == 0 or epoch == 1:
            print(f"epoch {epoch:4d} | loss {loss.item():.4f}")

    torch.save(
        {
            "model_state": model.state_dict(),
            "src_itos": src_vocab.itos,
            "tgt_itos": tgt_vocab.itos,
            "loss_history": loss_history,
            "config": {
                "d_model": args.d_model,
                "num_heads": args.num_heads,
                "num_layers": args.num_layers,
                "d_ff": args.d_ff,
                "max_len": max_len,
            },
        },
        CHECKPOINT_PATH,
    )
    print(f"saved checkpoint to {CHECKPOINT_PATH}")


if __name__ == "__main__":
    main()
