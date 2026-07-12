"""Load a trained checkpoint and translate one Korean sentence, greedily,
one token at a time -- the same auto-regressive loop described in the
reference material's decoder walkthrough (<sos> -> "i" -> "ate" -> ...).

Also prints the decoder's Cross-Attention weights (source-token share of
attention for each generated word), the same style of analysis as the
reference doc's "'먹었다'가 '사과를'에 31% 집중" example.

Usage:
    python train.py                              # train first, writes checkpoint.pt
    python translate.py --sentence "나는 사과를 먹었다"
"""

import argparse

import torch

from transformer_lab.masks import make_causal_mask, make_padding_mask
from transformer_lab.tokenizer import Vocab, tokenize
from transformer_lab.transformer import Transformer

CHECKPOINT_PATH = "checkpoint.pt"


def load_model(checkpoint_path: str, device: torch.device):
    # weights_only=True (PyTorch >= 2.6 default) blocks arbitrary code execution
    # from a malicious checkpoint by only unpickling tensors and plain
    # str/list/dict/int values -- exactly what train.py saves here.
    ckpt = torch.load(checkpoint_path, map_location=device, weights_only=True)
    src_vocab = Vocab.from_itos(ckpt["src_itos"])
    tgt_vocab = Vocab.from_itos(ckpt["tgt_itos"])
    cfg = ckpt["config"]

    model = Transformer(
        src_vocab_size=len(src_vocab),
        tgt_vocab_size=len(tgt_vocab),
        d_model=cfg["d_model"],
        num_heads=cfg["num_heads"],
        num_layers=cfg["num_layers"],
        d_ff=cfg["d_ff"],
        max_len=cfg["max_len"],
    ).to(device)
    model.load_state_dict(ckpt["model_state"])
    model.eval()
    return model, src_vocab, tgt_vocab


@torch.no_grad()
def translate(model, src_vocab, tgt_vocab, sentence: str, device, max_len: int = 20):
    src_ids = torch.tensor([src_vocab.encode(sentence, add_special=False)], device=device)
    src_mask = make_padding_mask(src_ids, src_vocab.pad_id)
    enc_out = model.encode(src_ids, src_mask)

    generated = [tgt_vocab.sos_id]
    for _ in range(max_len):
        tgt_ids = torch.tensor([generated], device=device)
        tgt_mask = make_causal_mask(tgt_ids.size(1), device)
        logits = model.decode_step(tgt_ids, enc_out, tgt_mask, src_mask)
        next_id = logits[0, -1].argmax().item()
        generated.append(next_id)
        if next_id == tgt_vocab.eos_id:
            break

    cross_attn = model.decoder.layers[-1].cross_attn.last_attn_weights  # (1, heads, tgt_len, src_len)
    return generated, cross_attn


def print_cross_attention(generated_ids, src_tokens, tgt_vocab, cross_attn):
    # average over heads, drop the leading <sos> row -> one row per generated word
    weights = cross_attn[0].mean(dim=0)  # (tgt_len, src_len)
    gen_tokens = [tgt_vocab.itos[i] for i in generated_ids[1:]]

    header = "generated word".ljust(12) + "".join(tok.rjust(10) for tok in src_tokens)
    print(header)
    for row_idx, tok in enumerate(gen_tokens):
        row = weights[row_idx].tolist()
        line = tok.ljust(12) + "".join(f"{p * 100:9.1f}%" for p in row)
        print(line)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sentence", default="나는 사과를 먹었다")
    parser.add_argument("--checkpoint", default=CHECKPOINT_PATH)
    parser.add_argument("--max-len", type=int, default=20)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model, src_vocab, tgt_vocab = load_model(args.checkpoint, device)

    generated, cross_attn = translate(model, src_vocab, tgt_vocab, args.sentence, device, args.max_len)
    translation = tgt_vocab.decode(generated)

    print(f"입력(source) : {args.sentence}")
    print(f"번역(output) : {translation}")
    print()
    print("Cross-Attention (decoder query -> encoder source tokens):")
    print_cross_attention(generated, tokenize(args.sentence), tgt_vocab, cross_attn)


if __name__ == "__main__":
    main()
