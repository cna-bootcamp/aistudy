"""Export real run data to web/data.js so web/index.html can visualize how
attention_demo.py, train.py and translate.py actually behave, without
needing a local HTTP server.

The data is written as a plain ``<script>``-loadable JS assignment
(``window.VIZ_DATA = {...}``) rather than a JSON file fetched with
``fetch()`` -- browsers block fetch() of local files under the ``file://``
protocol (CORS), but a ``<script src="data.js">`` tag loads fine, so the
page works by simply double-clicking web/index.html.

Usage (run after training so checkpoint.pt exists):
    python train.py
    python generate_web_data.py
"""

import json
from pathlib import Path

import torch

from attention_demo import multi_head_shape_demo, self_attention_walkthrough
from transformer_lab.tokenizer import tokenize
from translate import CHECKPOINT_PATH, load_model, translate

WEB_DIR = Path(__file__).parent / "web"
DATA_JS_PATH = WEB_DIR / "data.js"

# Curated so the page shows the same honest picture as the README: a seen
# sentence, a held-out sentence that generalizes correctly, the one held-out
# sentence that is known to mistranslate, and a fully unused combination.
EXAMPLE_SENTENCES = [
    {"sentence": "고객이 쿠폰을 취소한다", "split": "train", "note": "학습 문장 — 정확히 재현"},
    {"sentence": "상담원이 배송을 등록한다", "split": "heldout", "note": "학습에 없던 조합 — 정확히 일반화"},
    {"sentence": "결제가 지연된다", "split": "heldout", "note": "학습에 없던 조합 — 목적어를 혼동해 오역(문형은 정확)"},
    {"sentence": "고객이 결제를 발송한다", "split": "unused", "note": "글로서리 미사용 조합 — 정확히 생성"},
]


def build_attention_data() -> dict:
    x, self_attn = self_attention_walkthrough()
    multi_head = multi_head_shape_demo(x)
    return {"self_attention": self_attn, "multi_head": multi_head}


def build_training_data() -> list:
    ckpt = torch.load(CHECKPOINT_PATH, map_location="cpu", weights_only=True)
    return ckpt.get("loss_history", [])


def build_translation_data(device: torch.device) -> list:
    model, src_vocab, tgt_vocab = load_model(CHECKPOINT_PATH, device)
    results = []
    for example in EXAMPLE_SENTENCES:
        generated, cross_attn = translate(model, src_vocab, tgt_vocab, example["sentence"], device)
        weights = cross_attn[0].mean(dim=0).tolist()  # (tgt_len, src_len), averaged over heads
        results.append(
            {
                "source": example["sentence"],
                "source_tokens": tokenize(example["sentence"]),
                "translation": tgt_vocab.decode(generated),
                "generated_tokens": [tgt_vocab.itos[i] for i in generated[1:]],  # drop leading <sos>
                "cross_attention": weights,
                "split": example["split"],
                "note": example["note"],
            }
        )
    return results


def main() -> None:
    if not Path(CHECKPOINT_PATH).exists():
        raise SystemExit(f"{CHECKPOINT_PATH} not found -- run `python train.py` first")

    device = torch.device("cpu")
    data = {
        "attention": build_attention_data(),
        "training": build_training_data(),
        "translations": build_translation_data(device),
    }

    WEB_DIR.mkdir(exist_ok=True)
    js = "window.VIZ_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n"
    DATA_JS_PATH.write_text(js, encoding="utf-8")
    print(f"wrote {DATA_JS_PATH}")


if __name__ == "__main__":
    main()
