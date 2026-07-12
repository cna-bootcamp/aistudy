"""Word-level tokenizer and vocabulary for the toy KO->EN corpus.

Korean/English text in ``data/ko_en_pairs.txt`` is already whitespace
separated, so a simple ``str.split()`` is enough for this educational
example. A production tokenizer (BPE, SentencePiece, ...) is out of scope.
"""

PAD, SOS, EOS, UNK = "<pad>", "<sos>", "<eos>", "<unk>"
SPECIAL_TOKENS = [PAD, SOS, EOS, UNK]


def tokenize(sentence: str) -> list[str]:
    return sentence.strip().split()


class Vocab:
    """Maps tokens <-> integer ids for one language."""

    def __init__(self, sentences: list[str] | None = None, itos: list[str] | None = None):
        if itos is not None:
            self.itos = list(itos)
        else:
            tokens = sorted({tok for sent in (sentences or []) for tok in tokenize(sent)})
            self.itos = list(SPECIAL_TOKENS) + tokens
        self.stoi = {tok: idx for idx, tok in enumerate(self.itos)}

    @classmethod
    def from_itos(cls, itos: list[str]) -> "Vocab":
        return cls(itos=itos)

    def __len__(self) -> int:
        return len(self.itos)

    @property
    def pad_id(self) -> int:
        return self.stoi[PAD]

    @property
    def sos_id(self) -> int:
        return self.stoi[SOS]

    @property
    def eos_id(self) -> int:
        return self.stoi[EOS]

    def encode(self, sentence: str, add_special: bool = True) -> list[int]:
        ids = [self.stoi.get(tok, self.stoi[UNK]) for tok in tokenize(sentence)]
        if add_special:
            ids = [self.sos_id] + ids + [self.eos_id]
        return ids

    def decode(self, ids: list[int]) -> str:
        tokens = []
        for i in ids:
            tok = self.itos[i]
            if tok in (PAD, SOS, EOS):
                continue
            tokens.append(tok)
        return " ".join(tokens)


def load_pairs(path: str) -> list[tuple[str, str]]:
    pairs = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line.strip():
                continue
            src, tgt = line.split("\t")
            pairs.append((src, tgt))
    return pairs
