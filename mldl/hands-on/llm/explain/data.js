window.EXPLAIN_DATA = {
  "meta": {
    "title": "Transformer Lab — 밑바닥부터 만드는 미니 언어모델",
    "entry": "attention_demo.py · train.py · translate.py"
  },
  "files": [
    {
      "id": "builddata",
      "label": "data/build_dataset.py",
      "role": "글로서리 단어를 문형에 조합해 한↔영 학습 문장을 자동 생성"
    },
    {
      "id": "tokenizer",
      "label": "transformer_lab/tokenizer.py",
      "role": "문장을 단어로 쪼개고 단어↔숫자(id)로 바꾸는 사전"
    },
    {
      "id": "attention",
      "label": "transformer_lab/attention.py",
      "role": "핵심: Self-Attention 계산과 Multi-Head Attention"
    },
    {
      "id": "posenc",
      "label": "transformer_lab/positional_encoding.py",
      "role": "단어 순서(위치) 정보를 sin/cos로 더해줌"
    },
    {
      "id": "ffn",
      "label": "transformer_lab/feed_forward.py",
      "role": "단어별로 따로 한 번 더 변환하는 작은 신경망"
    },
    {
      "id": "masks",
      "label": "transformer_lab/masks.py",
      "role": "빈칸·미래 단어를 못 보게 가리는 마스크"
    },
    {
      "id": "layers",
      "label": "transformer_lab/layers.py",
      "role": "인코더 블록 1개·디코더 블록 1개 조립"
    },
    {
      "id": "transformer",
      "label": "transformer_lab/transformer.py",
      "role": "인코더+디코더를 합친 전체 Transformer"
    },
    {
      "id": "demo",
      "label": "attention_demo.py",
      "role": "학습 없이 Attention 계산 과정을 숫자로 보여주는 데모"
    },
    {
      "id": "train",
      "label": "train.py",
      "role": "toy 데이터로 모델을 학습시키고 checkpoint 저장"
    },
    {
      "id": "translate",
      "label": "translate.py",
      "role": "학습된 모델로 한 문장을 번역 + Cross-Attention 출력"
    },
    {
      "id": "genweb",
      "label": "generate_web_data.py",
      "role": "실행 결과를 모아 web/data.js로 내보내 시각화"
    }
  ],
  "flow": [
    {
      "step": 1,
      "label": "1. 데이터 만들기",
      "title": "도메인 문장쌍 자동 생성",
      "summary": "단어 사전(글로서리)을 문형 틀에 조합해 한국어→영어 문장 100개를 만든다",
      "detail": "번역기를 학습시키려면 '한국어 문장 ↔ 정답 영어 문장' 쌍이 필요합니다. 문장을 손으로 다 쓰는 대신, 주어·목적어·서술어 단어 목록을 정해두고 틀(템플릿)에 끼워 조합해 자동으로 만듭니다. 마치 '주어+목적어+동사' 빈칸 채우기로 문장을 대량 생산하는 것과 같습니다.",
      "refs": [
        "bd_conjugate",
        "bd_transitive",
        "bd_status",
        "bd_main"
      ]
    },
    {
      "step": 2,
      "label": "2. 단어→숫자",
      "title": "토크나이저와 사전(Vocab)",
      "summary": "컴퓨터는 글자를 모른다. 단어마다 고유 번호를 붙여 숫자로 바꾼다",
      "detail": "신경망은 숫자만 다룹니다. 그래서 문장을 공백으로 잘라 단어로 만들고(토크나이즈), 각 단어에 고유 번호를 매깁니다. 사전(Vocab)이 '단어↔번호' 변환표 역할을 합니다. 문장 시작/끝을 알리는 특수 표식(<sos>, <eos>)도 함께 넣습니다.",
      "refs": [
        "tk_tokenize",
        "tk_vocab",
        "tk_loadpairs"
      ]
    },
    {
      "step": 3,
      "label": "3. Self-Attention",
      "title": "핵심 원리: Self-Attention",
      "summary": "각 단어가 문장 속 다른 단어를 얼마나 참고할지 계산한다",
      "detail": "Transformer의 심장입니다. 한 단어(예: '먹었다')가 문장의 다른 단어들을 얼마나 '주목(attention)'할지 점수로 계산합니다. Q(질문)·K(열쇠)를 곱해 점수를 내고 → 크기 조절 → softmax로 비율(합=100%)로 바꾼 뒤 → V(값)를 그 비율로 섞습니다.",
      "refs": [
        "at_sdpa",
        "demo_selfattn"
      ]
    },
    {
      "step": 4,
      "label": "4. Multi-Head",
      "title": "여러 관점으로 보기: Multi-Head",
      "summary": "같은 attention을 여러 개(head) 병렬로 돌려 다양한 관계를 포착한다",
      "detail": "한 번만 보면 놓치는 관계가 있어서, attention을 여러 개(head)로 나눠 동시에 계산합니다. 한 head는 '주어-동사' 관계에, 다른 head는 '목적어-동사' 관계에 집중하는 식입니다. 결과를 이어붙여 하나로 합칩니다.",
      "refs": [
        "at_mha",
        "demo_multihead"
      ]
    },
    {
      "step": 5,
      "label": "5. 위치 정보",
      "title": "단어 순서 알려주기",
      "summary": "Attention은 순서를 모른다. sin/cos 값을 더해 위치를 표시한다",
      "detail": "Attention은 단어를 '집합'처럼 봐서 '나는 너를'과 '너를 나는'을 구분 못 합니다. 그래서 각 위치마다 고유한 sin/cos 파형 값을 단어 벡터에 더해 '몇 번째 단어인지' 신호를 넣어줍니다.",
      "refs": [
        "pe_posenc"
      ]
    },
    {
      "step": 6,
      "label": "6. FFN",
      "title": "단어별 추가 변환(FFN)",
      "summary": "각 단어 벡터를 개별적으로 한 번 더 가공하는 작은 신경망",
      "detail": "Attention으로 문맥을 섞은 뒤, 각 단어를 따로따로 한 번 더 변환합니다(단어끼리 섞지 않음). 차원을 4배로 늘렸다가 다시 줄이며 표현력을 높입니다.",
      "refs": [
        "ff_ffn"
      ]
    },
    {
      "step": 7,
      "label": "7. 마스크",
      "title": "가림막(Mask)",
      "summary": "빈칸(<pad>)과 아직 안 나온 미래 단어를 못 보게 가린다",
      "detail": "두 종류의 가림막이 있습니다. ①패딩 마스크: 길이 맞추려 넣은 빈칸을 무시. ②인과(causal) 마스크: 디코더가 답을 만들 때 '아직 안 만든 미래 단어'를 미리 훔쳐보지 못하게 가림(커닝 방지).",
      "refs": [
        "mk_padding",
        "mk_causal",
        "mk_decoder"
      ]
    },
    {
      "step": 8,
      "label": "8. 블록 조립",
      "title": "인코더/디코더 블록",
      "summary": "Attention·FFN에 잔차연결·정규화를 붙여 한 블록으로 만든다",
      "detail": "앞의 부품들을 한 덩어리로 조립합니다. 인코더 블록 = 자기어텐션→더하기&정규화→FFN→더하기&정규화. 디코더 블록은 여기에 인코더 출력을 참고하는 Cross-Attention이 추가됩니다. '더하기(잔차연결)'는 원본 신호를 잃지 않게, '정규화'는 값의 크기를 안정시킵니다.",
      "refs": [
        "ly_encoder",
        "ly_decoder"
      ]
    },
    {
      "step": 9,
      "label": "9. 전체 조립",
      "title": "전체 Transformer",
      "summary": "임베딩→위치인코딩→인코더 N개→디코더 N개→단어 확률로 조립",
      "detail": "부품을 모두 이어 완성된 번역기를 만듭니다. 입력 문장은 인코더가 '뜻이 담긴 벡터'로 바꾸고, 디코더는 그것을 참고하며 정답 단어를 하나씩 확률로 뽑습니다. 입력 임베딩과 출력 층 가중치를 공유(weight tying)해 파라미터를 아낍니다.",
      "refs": [
        "tf_encoder",
        "tf_decoder",
        "tf_transformer"
      ]
    },
    {
      "step": 10,
      "label": "10. 학습",
      "title": "모델 학습시키기",
      "summary": "정답과 예측의 오차(loss)를 줄이는 방향으로 가중치를 반복 조정",
      "detail": "문장쌍 100개를 넣고, 모델의 예측이 정답에 가까워지도록 오차(loss)를 계산해 가중치를 조금씩 고칩니다(400번 반복). loss가 점점 줄어드는 것이 '학습이 되고 있다'는 증거입니다. 결과는 checkpoint.pt 파일로 저장합니다.",
      "refs": [
        "tr_setseed",
        "tr_batches",
        "tr_main"
      ]
    },
    {
      "step": 11,
      "label": "11. 번역",
      "title": "번역 + Cross-Attention",
      "summary": "<sos>부터 시작해 단어를 하나씩 생성(auto-regressive)한다",
      "detail": "학습된 모델을 불러와 실제로 번역합니다. 시작 표식(<sos>)부터 시작해, 매 단계에서 가장 확률 높은 다음 단어를 골라 붙이고, 그 결과를 다시 입력으로 넣어 다음 단어를 뽑습니다(자기회귀). 각 단어가 원문의 어느 단어를 참고했는지(Cross-Attention)도 함께 보여줍니다.",
      "refs": [
        "tl_loadmodel",
        "tl_translate",
        "tl_crossattn",
        "tl_main"
      ]
    },
    {
      "step": 12,
      "label": "12. 시각화 내보내기",
      "title": "웹 시각화 데이터 생성",
      "summary": "attention·학습·번역 실제 결과를 web/data.js로 저장",
      "detail": "위 단계들의 실제 실행 결과(attention 숫자, loss 곡선, 번역·Cross-Attention)를 모아 web/data.js 파일로 내보냅니다. 그러면 별도 서버 없이 web/index.html을 열어 그래프·히트맵으로 확인할 수 있습니다.",
      "refs": [
        "gw_attn",
        "gw_train",
        "gw_trans",
        "gw_main"
      ]
    }
  ],
  "functions": [
    {
      "id": "bd_final",
      "name": "has_final_consonant()",
      "fileId": "builddata",
      "summary": "한글 단어의 마지막 글자에 받침이 있는지 판별한다.",
      "how": "한글은 유니코드에서 '초성·중성·종성'을 수식으로 조합해 코드가 정해집니다. 코드를 28로 나눈 나머지가 0이면 받침이 없는 것입니다. 이걸로 뒤에 붙일 조사(이/가, 을/를)를 자동으로 고릅니다.",
      "terms": [
        "유니코드",
        "받침",
        "ord"
      ],
      "lines": [
        {
          "at": "code = ord(word[-1]) - 0xAC00",
          "text": "단어의 마지막 글자를 한글 코드 번호로 바꾼다(0xAC00은 '가'의 코드)."
        },
        {
          "at": "return code % 28 != 0",
          "text": "28로 나눈 나머지가 0이 아니면 받침이 있다는 뜻(→ True)."
        }
      ],
      "code": "def has_final_consonant(word: str) -> bool:\n    \"\"\"Hangul syllable code = (initial*21 + medial)*28 + final + 0xAC00.\n\n    final == 0 means the syllable has no trailing consonant (받침).\n    \"\"\"\n    code = ord(word[-1]) - 0xAC00\n    if not (0 <= code < 11172):\n        return False  # non-Hangul character; not expected in this glossary\n    return code % 28 != 0"
    },
    {
      "id": "bd_particle",
      "name": "attach_subject/object_particle()",
      "fileId": "builddata",
      "summary": "받침 유무에 맞는 조사(이/가, 을/를)를 단어 뒤에 붙인다.",
      "how": "받침이 있으면 '이/을', 없으면 '가/를'을 붙입니다. 사전에는 '고객', '배송'처럼 조사 없는 형태만 저장해두면 되고, 조사는 여기서 자동으로 골라집니다.",
      "terms": [],
      "lines": [
        {
          "at": "return word + (\"이\" if has_final_consonant(word) else \"가\")",
          "text": "주어 조사: 받침 있으면 '이', 없으면 '가'."
        },
        {
          "at": "return word + (\"을\" if has_final_consonant(word) else \"를\")",
          "text": "목적어 조사: 받침 있으면 '을', 없으면 '를'."
        }
      ],
      "code": "def attach_subject_particle(word: str) -> str:\n    return word + (\"이\" if has_final_consonant(word) else \"가\")\n\n\ndef attach_object_particle(word: str) -> str:\n    return word + (\"을\" if has_final_consonant(word) else \"를\")"
    },
    {
      "id": "bd_conjugate",
      "name": "conjugate_present()",
      "fileId": "builddata",
      "summary": "'~하다/~되다' 사전형을 '~한다/~된다' 현재형으로 바꾼다.",
      "how": "글로서리에는 '문의하다', '지연되다'처럼 기본형만 저장하고, 문장을 만들 때 현재형('문의한다', '지연된다')으로 자동 변환합니다.",
      "terms": [],
      "lines": [
        {
          "at": "if dict_form.endswith(\"하다\"):",
          "text": "'~하다'로 끝나면"
        },
        {
          "at": "return dict_form[:-2] + \"한다\"",
          "text": "'하다'를 떼고 '한다'를 붙인다."
        },
        {
          "at": "raise ValueError",
          "text": "지원하지 않는 어미면 에러를 내 실수를 빨리 잡는다."
        }
      ],
      "code": "def conjugate_present(dict_form: str) -> str:\n    \"\"\"'~하다' -> '~한다', '~되다' -> '~된다' (both stems end in a vowel, so\n    the plain-present ending '-ㄴ다' attaches directly).\"\"\"\n    if dict_form.endswith(\"하다\"):\n        return dict_form[:-2] + \"한다\"\n    if dict_form.endswith(\"되다\"):\n        return dict_form[:-2] + \"된다\"\n    raise ValueError(f\"unsupported predicate ending: {dict_form}\")"
    },
    {
      "id": "bd_transitive",
      "name": "build_transitive_pairs()",
      "fileId": "builddata",
      "summary": "행위형 문장(주어가 목적어를 ~한다)의 한↔영 쌍을 모두 만든다.",
      "how": "주어·목적어·서술어 목록을 3중 반복문으로 전부 조합합니다. 한국어는 조사·현재형을 붙여 만들고, 영어는 '주어 동사 목적어' 순서로 만듭니다.",
      "terms": [
        "for 반복문",
        "리스트"
      ],
      "lines": [
        {
          "at": "for subj in glossary[",
          "text": "모든 주어에 대해"
        },
        {
          "at": "for obj in glossary[",
          "text": "모든 목적어에 대해"
        },
        {
          "at": "en = f\"{subj[",
          "text": "영어는 주어+동사+목적어 어순으로 조립(한국어와 어순이 다름)."
        },
        {
          "at": "pairs.append((ko, en))",
          "text": "만든 (한국어, 영어) 쌍을 목록에 추가."
        }
      ],
      "code": "def build_transitive_pairs(glossary: dict) -> list[tuple[str, str]]:\n    pairs = []\n    for subj in glossary[\"subjects\"]:\n        for obj in glossary[\"objects\"]:\n            for pred in glossary[\"transitive_predicates\"]:\n                ko = (\n                    f\"{attach_subject_particle(subj['ko'])} \"\n                    f\"{attach_object_particle(obj['ko'])} \"\n                    f\"{conjugate_present(pred['ko'])}\"\n                )\n                en = f\"{subj['en']} {pred['en']} {obj['en']}\"\n                pairs.append((ko, en))\n    return pairs"
    },
    {
      "id": "bd_status",
      "name": "build_status_pairs()",
      "fileId": "builddata",
      "summary": "상태형 문장(대상이 지연된다/완료된다)의 한↔영 쌍을 만든다.",
      "how": "행위형과 달리 주어 없이 '대상 + 상태서술어'만 조합합니다. 이 유형은 조합 수가 적어(대상 8 × 상태 2 = 16개) 학습 노출이 희소하다는 점이 README의 한계 사례와 연결됩니다.",
      "terms": [],
      "lines": [
        {
          "at": "for pred in glossary[\"status_predicates\"]:",
          "text": "각 대상마다 상태 서술어를 조합."
        },
        {
          "at": "en = f\"{obj[",
          "text": "영어는 '대상 is delayed' 형태."
        }
      ],
      "code": "def build_status_pairs(glossary: dict) -> list[tuple[str, str]]:\n    pairs = []\n    for obj in glossary[\"objects\"]:\n        for pred in glossary[\"status_predicates\"]:\n            ko = f\"{attach_subject_particle(obj['ko'])} {conjugate_present(pred['ko'])}\"\n            en = f\"{obj['en']} {pred['en']}\"\n            pairs.append((ko, en))\n    return pairs"
    },
    {
      "id": "bd_main",
      "name": "main()  ·  데이터 생성 실행",
      "fileId": "builddata",
      "summary": "글로서리를 읽어 전체 문장을 만들고 학습/held-out으로 나눠 파일로 저장한다.",
      "how": "전체 조합 240개를 만든 뒤 seed를 고정해 섞고, 앞 100개는 학습용, 다음 20개는 '한 번도 안 본 조합' 테스트용(held-out)으로 분리 저장합니다. seed 고정 덕분에 매번 같은 결과가 재현됩니다.",
      "terms": [
        "seed(시드)",
        "shuffle",
        "held-out"
      ],
      "lines": [
        {
          "at": "all_pairs = build_transitive_pairs(glossary) + build_status_pairs(glossary)",
          "text": "행위형+상태형 문장을 모두 합친다."
        },
        {
          "at": "assert len(set(all_pairs)) == total_pool",
          "text": "중복 문장이 없는지 검사(같은 문장이 두 번 생기면 에러)."
        },
        {
          "at": "random.seed(SEED)",
          "text": "무작위 순서를 고정해 '재현 가능'하게 만든다."
        },
        {
          "at": "train_pairs = all_pairs[:TRAIN_COUNT]",
          "text": "앞 100개는 학습용."
        },
        {
          "at": "heldout_pairs = all_pairs[TRAIN_COUNT : TRAIN_COUNT + HELDOUT_COUNT]",
          "text": "다음 20개는 학습에 안 쓰는 일반화 테스트용."
        }
      ],
      "code": "def main() -> None:\n    glossary = json.loads(GLOSSARY_PATH.read_text(encoding=\"utf-8\"))\n\n    all_pairs = build_transitive_pairs(glossary) + build_status_pairs(glossary)\n    total_pool = len(all_pairs)\n    assert len(set(all_pairs)) == total_pool, \"glossary produced duplicate sentence pairs\"\n\n    random.seed(SEED)\n    random.shuffle(all_pairs)\n\n    train_pairs = all_pairs[:TRAIN_COUNT]\n    heldout_pairs = all_pairs[TRAIN_COUNT : TRAIN_COUNT + HELDOUT_COUNT]\n    unused = total_pool - len(train_pairs) - len(heldout_pairs)\n\n    TRAIN_PATH.write_text(\"\\n\".join(f\"{ko}\\t{en}\" for ko, en in train_pairs) + \"\\n\", encoding=\"utf-8\")\n    HELDOUT_PATH.write_text(\"\\n\".join(f\"{ko}\\t{en}\" for ko, en in heldout_pairs) + \"\\n\", encoding=\"utf-8\")\n\n    print(f\"glossary combinations available: {total_pool}\")\n    print(f\"  train   : {len(train_pairs):3d} -> {TRAIN_PATH.relative_to(Path.cwd())}\")\n    print(f\"  heldout : {len(heldout_pairs):3d} -> {HELDOUT_PATH.relative_to(Path.cwd())}\")\n    print(f\"  unused  : {unused:3d} (left in the glossary's combinatorial pool, not written out)\")"
    },
    {
      "id": "tk_tokenize",
      "name": "tokenize()  ·  특수 토큰",
      "fileId": "tokenizer",
      "summary": "문장을 공백 기준으로 잘라 단어 목록으로 만든다.",
      "how": "이 예제의 문장은 이미 공백으로 단어가 나뉘어 있어 split() 하나로 충분합니다. 실제 서비스는 BPE·SentencePiece 같은 더 정교한 토크나이저가 필요합니다. <pad>(빈칸 채우기), <sos>(시작), <eos>(끝), <unk>(모르는 단어) 4개의 특수 표식도 정의합니다.",
      "terms": [
        "토큰(token)",
        "split",
        "<pad>/<sos>/<eos>/<unk>"
      ],
      "lines": [
        {
          "at": "PAD, SOS, EOS, UNK = \"<pad>\"",
          "text": "4가지 특수 표식을 정의(빈칸/시작/끝/미지의단어)."
        },
        {
          "at": "return sentence.strip().split()",
          "text": "앞뒤 공백을 없애고 공백으로 잘라 단어 리스트로."
        }
      ],
      "code": "PAD, SOS, EOS, UNK = \"<pad>\", \"<sos>\", \"<eos>\", \"<unk>\"\nSPECIAL_TOKENS = [PAD, SOS, EOS, UNK]\n\n\ndef tokenize(sentence: str) -> list[str]:\n    return sentence.strip().split()"
    },
    {
      "id": "tk_vocab",
      "name": "class Vocab  ·  단어↔번호 사전",
      "fileId": "tokenizer",
      "summary": "단어를 정수 id로, id를 다시 단어로 바꾸는 양방향 사전.",
      "how": "itos는 '번호→단어' 목록, stoi는 '단어→번호' 표입니다. encode()는 문장을 번호 리스트로(앞뒤에 <sos>/<eos> 추가), decode()는 번호를 다시 문장으로 되돌리되 특수 표식은 지웁니다.",
      "terms": [
        "딕셔너리(dict)",
        "encode/decode",
        "@property"
      ],
      "lines": [
        {
          "at": "self.itos = list(SPECIAL_TOKENS) + tokens",
          "text": "특수 표식을 앞에 두고 정렬된 단어를 붙여 '번호→단어' 목록 완성."
        },
        {
          "at": "self.stoi = {tok: idx for idx, tok in enumerate(self.itos)}",
          "text": "반대 방향 '단어→번호' 표를 만든다."
        },
        {
          "at": "ids = [self.stoi.get(tok, self.stoi[UNK]) for tok in tokenize(sentence)]",
          "text": "각 단어를 번호로. 사전에 없으면 <unk> 번호를 쓴다."
        },
        {
          "at": "ids = [self.sos_id] + ids + [self.eos_id]",
          "text": "문장 앞뒤에 시작·끝 표식을 붙인다."
        },
        {
          "at": "if tok in (PAD, SOS, EOS):",
          "text": "되돌릴 때 특수 표식은 건너뛴다."
        }
      ],
      "code": "class Vocab:\n    \"\"\"Maps tokens <-> integer ids for one language.\"\"\"\n\n    def __init__(self, sentences: list[str] | None = None, itos: list[str] | None = None):\n        if itos is not None:\n            self.itos = list(itos)\n        else:\n            tokens = sorted({tok for sent in (sentences or []) for tok in tokenize(sent)})\n            self.itos = list(SPECIAL_TOKENS) + tokens\n        self.stoi = {tok: idx for idx, tok in enumerate(self.itos)}\n\n    @classmethod\n    def from_itos(cls, itos: list[str]) -> \"Vocab\":\n        return cls(itos=itos)\n\n    def __len__(self) -> int:\n        return len(self.itos)\n\n    @property\n    def pad_id(self) -> int:\n        return self.stoi[PAD]\n\n    @property\n    def sos_id(self) -> int:\n        return self.stoi[SOS]\n\n    @property\n    def eos_id(self) -> int:\n        return self.stoi[EOS]\n\n    def encode(self, sentence: str, add_special: bool = True) -> list[int]:\n        ids = [self.stoi.get(tok, self.stoi[UNK]) for tok in tokenize(sentence)]\n        if add_special:\n            ids = [self.sos_id] + ids + [self.eos_id]\n        return ids\n\n    def decode(self, ids: list[int]) -> str:\n        tokens = []\n        for i in ids:\n            tok = self.itos[i]\n            if tok in (PAD, SOS, EOS):\n                continue\n            tokens.append(tok)\n        return \" \".join(tokens)"
    },
    {
      "id": "tk_loadpairs",
      "name": "load_pairs()",
      "fileId": "tokenizer",
      "summary": "파일에서 '한국어[탭]영어' 문장쌍을 읽어 리스트로 만든다.",
      "how": "build_dataset.py가 저장한 텍스트 파일을 한 줄씩 읽어, 탭(\\t)으로 나눠 (한국어, 영어) 쌍으로 담습니다.",
      "terms": [
        "with open",
        "encoding=utf-8"
      ],
      "lines": [
        {
          "at": "with open(path, encoding=\"utf-8\") as f:",
          "text": "한글이 깨지지 않게 utf-8로 파일을 연다."
        },
        {
          "at": "src, tgt = line.split(\"\\t\")",
          "text": "탭을 기준으로 한국어(src)와 영어(tgt)로 나눈다."
        }
      ],
      "code": "def load_pairs(path: str) -> list[tuple[str, str]]:\n    pairs = []\n    with open(path, encoding=\"utf-8\") as f:\n        for line in f:\n            line = line.rstrip(\"\\n\")\n            if not line.strip():\n                continue\n            src, tgt = line.split(\"\\t\")\n            pairs.append((src, tgt))\n    return pairs"
    },
    {
      "id": "at_sdpa",
      "name": "scaled_dot_product_attention()",
      "fileId": "attention",
      "summary": "Attention의 핵심 공식 softmax(QK^T/√d_k)·V 를 그대로 계산한다.",
      "how": "① Q와 K를 곱해 '단어끼리 얼마나 관련 있나' 점수를 냅니다. ② √d_k로 나눠 값이 너무 커지지 않게 조절합니다. ③ softmax로 점수를 비율(합=1)로 바꿉니다. ④ 그 비율로 V를 가중합해 문맥이 담긴 새 벡터를 만듭니다. mask가 있으면 가릴 위치를 -무한대로 만들어 softmax에서 0이 되게 합니다.",
      "terms": [
        "Q/K/V",
        "행렬곱(matmul)",
        "softmax",
        "d_k(√d_k 스케일링)"
      ],
      "lines": [
        {
          "at": "scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(d_k)",
          "text": "①② Q·K를 곱해 점수를 내고 √d_k로 나눠 크기를 조절."
        },
        {
          "at": "scores = scores.masked_fill(mask == 0, float(\"-inf\"))",
          "text": "가릴 위치는 -무한대로 → softmax 후 0(못 봄)이 됨."
        },
        {
          "at": "attn_weights = torch.softmax(scores, dim=-1)",
          "text": "③ 점수를 합이 1인 비율(주목도)로 변환."
        },
        {
          "at": "context = torch.matmul(attn_weights, v)",
          "text": "④ 비율대로 V를 섞어 문맥 벡터를 만든다."
        }
      ],
      "code": "def scaled_dot_product_attention(\n    q: torch.Tensor,\n    k: torch.Tensor,\n    v: torch.Tensor,\n    mask: torch.Tensor | None = None,\n    dropout: nn.Dropout | None = None,\n) -> tuple[torch.Tensor, torch.Tensor]:\n    \"\"\"q, k, v: (batch, num_heads, seq_len, head_dim)\n\n    Returns (context, attn_weights) where attn_weights has shape\n    (batch, num_heads, q_len, k_len) and is what gets plotted as an\n    attention heatmap.\n    \"\"\"\n    d_k = q.size(-1)\n    scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(d_k)\n\n    if mask is not None:\n        scores = scores.masked_fill(mask == 0, float(\"-inf\"))\n\n    attn_weights = torch.softmax(scores, dim=-1)\n    if dropout is not None:\n        attn_weights = dropout(attn_weights)\n\n    context = torch.matmul(attn_weights, v)\n    return context, attn_weights"
    },
    {
      "id": "at_mha",
      "name": "class MultiHeadAttention",
      "fileId": "attention",
      "summary": "여러 head가 서로 다른 관점으로 동시에 attention을 수행한다.",
      "how": "d_model 차원을 num_heads개로 쪼개(_split_heads) 각각 attention을 병렬 계산한 뒤, 다시 이어붙이고(_merge_heads) w_o로 한 번 더 변환합니다. w_q/w_k/w_v는 입력을 Q/K/V로 바꾸는 학습되는 변환입니다. last_attn_weights에 주목도를 저장해두어 나중에 히트맵으로 시각화합니다.",
      "terms": [
        "head(헤드)",
        "nn.Linear",
        "head_dim",
        "transpose/view"
      ],
      "lines": [
        {
          "at": "self.head_dim = d_model // num_heads",
          "text": "전체 차원을 head 개수로 나눠 head당 크기를 정함."
        },
        {
          "at": "self.w_q = nn.Linear(d_model, d_model)",
          "text": "입력을 Q로 바꾸는 학습되는 변환(K·V·최종용도 각각 있음)."
        },
        {
          "at": "return x.transpose(1, 2)  # (batch, num_heads, seq_len, head_dim)",
          "text": "차원을 head별로 쪼개 나란히 놓는다."
        },
        {
          "at": "context, attn_weights = scaled_dot_product_attention(q, k, v, mask, self.dropout)",
          "text": "쪼갠 head들에 대해 attention을 한 번에 계산."
        },
        {
          "at": "self.last_attn_weights = attn_weights.detach()",
          "text": "시각화용으로 주목도를 따로 저장."
        },
        {
          "at": "return self.w_o(merged)",
          "text": "이어붙인 결과를 마지막 변환으로 정리해 내보낸다."
        }
      ],
      "code": "class MultiHeadAttention(nn.Module):\n    def __init__(self, d_model: int, num_heads: int, dropout: float = 0.1):\n        super().__init__()\n        assert d_model % num_heads == 0, \"d_model must be divisible by num_heads\"\n        self.d_model = d_model\n        self.num_heads = num_heads\n        self.head_dim = d_model // num_heads\n\n        self.w_q = nn.Linear(d_model, d_model)\n        self.w_k = nn.Linear(d_model, d_model)\n        self.w_v = nn.Linear(d_model, d_model)\n        self.w_o = nn.Linear(d_model, d_model)\n        self.dropout = nn.Dropout(dropout)\n\n        self.last_attn_weights: torch.Tensor | None = None\n\n    def _split_heads(self, x: torch.Tensor) -> torch.Tensor:\n        batch, seq_len, _ = x.shape\n        x = x.view(batch, seq_len, self.num_heads, self.head_dim)\n        return x.transpose(1, 2)  # (batch, num_heads, seq_len, head_dim)\n\n    def _merge_heads(self, x: torch.Tensor) -> torch.Tensor:\n        batch, _, seq_len, _ = x.shape\n        x = x.transpose(1, 2).contiguous()\n        return x.view(batch, seq_len, self.d_model)\n\n    def forward(\n        self,\n        query: torch.Tensor,\n        key: torch.Tensor,\n        value: torch.Tensor,\n        mask: torch.Tensor | None = None,\n    ) -> torch.Tensor:\n        q = self._split_heads(self.w_q(query))\n        k = self._split_heads(self.w_k(key))\n        v = self._split_heads(self.w_v(value))\n\n        context, attn_weights = scaled_dot_product_attention(q, k, v, mask, self.dropout)\n        self.last_attn_weights = attn_weights.detach()\n\n        merged = self._merge_heads(context)\n        return self.w_o(merged)"
    },
    {
      "id": "pe_posenc",
      "name": "class PositionalEncoding",
      "fileId": "posenc",
      "summary": "위치마다 다른 sin/cos 값을 만들어 단어 벡터에 더한다.",
      "how": "짝수 차원에는 sin, 홀수 차원에는 cos를 넣어 각 위치를 고유한 파형으로 표시합니다. 이 값은 학습되지 않는 고정값(원조 Transformer 방식)이라 register_buffer로 저장합니다. forward에서 입력 길이만큼 잘라 더해줍니다.",
      "terms": [
        "sin/cos 위치인코딩",
        "register_buffer",
        "arange"
      ],
      "lines": [
        {
          "at": "pe = torch.zeros(max_len, d_model)",
          "text": "위치×차원 크기의 표를 0으로 초기화."
        },
        {
          "at": "pe[:, 0::2] = torch.sin(position * div_term)",
          "text": "짝수 번째 차원은 sin 값으로 채운다."
        },
        {
          "at": "pe[:, 1::2] = torch.cos(position * div_term)",
          "text": "홀수 번째 차원은 cos 값으로 채운다."
        },
        {
          "at": "self.register_buffer(\"pe\", pe.unsqueeze(0))",
          "text": "학습하지 않는 고정값으로 저장(buffer)."
        },
        {
          "at": "x = x + self.pe[:, :seq_len]",
          "text": "단어 벡터에 위치 값을 더해 순서 정보를 주입."
        }
      ],
      "code": "class PositionalEncoding(nn.Module):\n    def __init__(self, d_model: int, max_len: int = 128, dropout: float = 0.1):\n        super().__init__()\n        self.dropout = nn.Dropout(dropout)\n\n        pe = torch.zeros(max_len, d_model)\n        position = torch.arange(0, max_len, dtype=torch.float32).unsqueeze(1)\n        div_term = torch.exp(\n            torch.arange(0, d_model, 2, dtype=torch.float32) * (-math.log(10000.0) / d_model)\n        )\n        pe[:, 0::2] = torch.sin(position * div_term)\n        pe[:, 1::2] = torch.cos(position * div_term)\n        self.register_buffer(\"pe\", pe.unsqueeze(0))  # (1, max_len, d_model)\n\n    def forward(self, x: torch.Tensor) -> torch.Tensor:\n        # x: (batch, seq_len, d_model)\n        seq_len = x.size(1)\n        x = x + self.pe[:, :seq_len]\n        return self.dropout(x)"
    },
    {
      "id": "ff_ffn",
      "name": "class PositionwiseFeedForward",
      "fileId": "ffn",
      "summary": "각 단어 벡터를 개별적으로 확장→활성화→축소하는 작은 신경망.",
      "how": "차원을 4배(d_ff)로 늘렸다가 ReLU를 거쳐 다시 원래 크기로 줄입니다. 단어끼리 섞지 않고 위치(단어)별로 똑같이 적용됩니다 — 단어 간 정보 교환은 attention이 담당합니다.",
      "terms": [
        "FFN",
        "ReLU",
        "nn.Sequential",
        "Dropout"
      ],
      "lines": [
        {
          "at": "d_ff = d_ff or d_model * 4",
          "text": "중간 층 크기를 기본 4배로(원조 논문과 동일)."
        },
        {
          "at": "nn.Linear(d_model, d_ff),",
          "text": "차원을 크게 확장."
        },
        {
          "at": "nn.ReLU(),",
          "text": "음수를 0으로 만드는 비선형(표현력을 높임)."
        },
        {
          "at": "nn.Linear(d_ff, d_model),",
          "text": "다시 원래 차원으로 축소."
        }
      ],
      "code": "class PositionwiseFeedForward(nn.Module):\n    def __init__(self, d_model: int, d_ff: int | None = None, dropout: float = 0.1):\n        super().__init__()\n        d_ff = d_ff or d_model * 4\n        self.net = nn.Sequential(\n            nn.Linear(d_model, d_ff),\n            nn.ReLU(),\n            nn.Dropout(dropout),\n            nn.Linear(d_ff, d_model),\n        )\n\n    def forward(self, x):\n        return self.net(x)"
    },
    {
      "id": "mk_padding",
      "name": "make_padding_mask()",
      "fileId": "masks",
      "summary": "길이를 맞추려 넣은 빈칸(<pad>)을 attention이 무시하게 만든다.",
      "how": "문장마다 길이가 달라 빈칸으로 채우는데, 그 빈칸은 의미가 없으므로 True/False 표로 '실제 단어=True, 빈칸=False'를 표시합니다. 나중에 False 위치의 점수가 -무한대가 됩니다.",
      "terms": [
        "mask(마스크)",
        "unsqueeze",
        "브로드캐스트"
      ],
      "lines": [
        {
          "at": "mask = (seq != pad_id).unsqueeze(1).unsqueeze(2)",
          "text": "빈칸이 아닌 위치만 True로 표시(차원을 늘려 head/쿼리에 맞춤)."
        }
      ],
      "code": "def make_padding_mask(seq: torch.Tensor, pad_id: int) -> torch.Tensor:\n    # seq: (batch, seq_len) -> (batch, 1, 1, seq_len), broadcastable over heads/queries\n    mask = (seq != pad_id).unsqueeze(1).unsqueeze(2)\n    return mask"
    },
    {
      "id": "mk_causal",
      "name": "make_causal_mask()",
      "fileId": "masks",
      "summary": "미래 단어를 못 보게 하는 삼각형 가림막(커닝 방지).",
      "how": "디코더가 답을 만들 때 아직 만들지 않은 뒤쪽(미래) 단어를 미리 보면 안 됩니다. 아래쪽 삼각형만 True인 표를 만들어 'i번째 단어는 자기 이전(j<=i)만 볼 수 있게' 합니다.",
      "terms": [
        "causal mask",
        "torch.tril(하삼각)"
      ],
      "lines": [
        {
          "at": "mask = torch.tril(torch.ones(seq_len, seq_len, device=device)).bool()",
          "text": "아래 삼각형만 True → 과거·현재만 보이고 미래는 가려짐."
        }
      ],
      "code": "def make_causal_mask(seq_len: int, device: torch.device) -> torch.Tensor:\n    # (1, 1, seq_len, seq_len) lower-triangular: position i can only see j <= i\n    mask = torch.tril(torch.ones(seq_len, seq_len, device=device)).bool()\n    return mask.unsqueeze(0).unsqueeze(0)"
    },
    {
      "id": "mk_decoder",
      "name": "make_decoder_mask()",
      "fileId": "masks",
      "summary": "패딩 마스크와 미래 마스크를 합쳐 디코더용 마스크를 만든다.",
      "how": "빈칸 가림(padding)과 미래 가림(causal)을 AND(&)로 합칩니다. 둘 다 통과(True)한 위치만 실제로 볼 수 있습니다.",
      "terms": [
        "논리 AND(&)"
      ],
      "lines": [
        {
          "at": "return pad_mask & causal_mask",
          "text": "두 마스크를 모두 만족(둘 다 True)하는 위치만 허용."
        }
      ],
      "code": "def make_decoder_mask(tgt: torch.Tensor, pad_id: int) -> torch.Tensor:\n    pad_mask = make_padding_mask(tgt, pad_id)\n    causal_mask = make_causal_mask(tgt.size(1), tgt.device)\n    return pad_mask & causal_mask"
    },
    {
      "id": "ly_encoder",
      "name": "class EncoderLayer",
      "fileId": "layers",
      "summary": "인코더 블록 1개: 자기어텐션 → Add&Norm → FFN → Add&Norm.",
      "how": "입력 문장 자신에 attention을 걸어 문맥을 섞고, 원본을 더한 뒤(잔차연결) 정규화합니다. 이어 FFN으로 각 단어를 가공하고 다시 더하기·정규화합니다. '더하기'는 학습을 안정시키는 지름길 역할을 합니다.",
      "terms": [
        "잔차연결(residual)",
        "LayerNorm",
        "self-attention"
      ],
      "lines": [
        {
          "at": "attn_out = self.self_attn(x, x, x, src_mask)",
          "text": "입력 자신을 Q·K·V로 써서 문맥을 섞음(self-attention)."
        },
        {
          "at": "x = self.norm1(x + self.dropout(attn_out))",
          "text": "원본 x를 더하고(잔차) 크기를 정규화."
        },
        {
          "at": "ffn_out = self.ffn(x)",
          "text": "단어별 추가 변환(FFN)."
        }
      ],
      "code": "class EncoderLayer(nn.Module):\n    def __init__(self, d_model: int, num_heads: int, d_ff: int, dropout: float = 0.1):\n        super().__init__()\n        self.self_attn = MultiHeadAttention(d_model, num_heads, dropout)\n        self.ffn = PositionwiseFeedForward(d_model, d_ff, dropout)\n        self.norm1 = nn.LayerNorm(d_model)\n        self.norm2 = nn.LayerNorm(d_model)\n        self.dropout = nn.Dropout(dropout)\n\n    def forward(self, x: torch.Tensor, src_mask: torch.Tensor) -> torch.Tensor:\n        attn_out = self.self_attn(x, x, x, src_mask)\n        x = self.norm1(x + self.dropout(attn_out))\n\n        ffn_out = self.ffn(x)\n        x = self.norm2(x + self.dropout(ffn_out))\n        return x"
    },
    {
      "id": "ly_decoder",
      "name": "class DecoderLayer",
      "fileId": "layers",
      "summary": "디코더 블록 1개: 마스크 자기어텐션 → Cross-Attention → FFN.",
      "how": "① 지금까지 만든 답에 미래를 가린 self-attention. ② 인코더 출력을 K·V로 참고하는 Cross-Attention(원문을 '보는' 단계). ③ FFN. 각 단계마다 더하기·정규화가 붙습니다. Cross-Attention이 '번역 시 원문의 어느 단어를 봤나'를 결정합니다.",
      "terms": [
        "Cross-Attention",
        "Masked Self-Attention"
      ],
      "lines": [
        {
          "at": "self_attn_out = self.self_attn(x, x, x, tgt_mask)",
          "text": "①만든 답끼리 self-attention(미래는 tgt_mask로 가림)."
        },
        {
          "at": "cross_attn_out = self.cross_attn(x, enc_out, enc_out, src_mask)",
          "text": "②Q=디코더, K·V=인코더 출력 → 원문을 참고."
        },
        {
          "at": "ffn_out = self.ffn(x)",
          "text": "③단어별 추가 변환."
        }
      ],
      "code": "class DecoderLayer(nn.Module):\n    def __init__(self, d_model: int, num_heads: int, d_ff: int, dropout: float = 0.1):\n        super().__init__()\n        self.self_attn = MultiHeadAttention(d_model, num_heads, dropout)\n        self.cross_attn = MultiHeadAttention(d_model, num_heads, dropout)\n        self.ffn = PositionwiseFeedForward(d_model, d_ff, dropout)\n        self.norm1 = nn.LayerNorm(d_model)\n        self.norm2 = nn.LayerNorm(d_model)\n        self.norm3 = nn.LayerNorm(d_model)\n        self.dropout = nn.Dropout(dropout)\n\n    def forward(\n        self,\n        x: torch.Tensor,\n        enc_out: torch.Tensor,\n        tgt_mask: torch.Tensor,\n        src_mask: torch.Tensor,\n    ) -> torch.Tensor:\n        self_attn_out = self.self_attn(x, x, x, tgt_mask)\n        x = self.norm1(x + self.dropout(self_attn_out))\n\n        cross_attn_out = self.cross_attn(x, enc_out, enc_out, src_mask)\n        x = self.norm2(x + self.dropout(cross_attn_out))\n\n        ffn_out = self.ffn(x)\n        x = self.norm3(x + self.dropout(ffn_out))\n        return x"
    },
    {
      "id": "tf_encoder",
      "name": "class Encoder",
      "fileId": "transformer",
      "summary": "입력 문장을 임베딩+위치인코딩 후 인코더 블록 N개에 통과시킨다.",
      "how": "단어 번호를 벡터로 바꾸고(임베딩), √d_model을 곱해 크기를 맞춘 뒤 위치 정보를 더합니다. 그 다음 EncoderLayer 여러 개를 차례로 통과시켜 '문맥이 반영된 원문 표현'을 만듭니다.",
      "terms": [
        "nn.Embedding",
        "nn.ModuleList",
        "임베딩 스케일(√d_model)"
      ],
      "lines": [
        {
          "at": "self.embedding = nn.Embedding(vocab_size, d_model)",
          "text": "단어 번호를 학습되는 벡터로 바꾸는 표."
        },
        {
          "at": "x = self.embedding(src_ids) * math.sqrt(self.d_model)",
          "text": "임베딩에 √d_model을 곱해 위치인코딩과 크기를 맞춤."
        },
        {
          "at": "for layer in self.layers:",
          "text": "인코더 블록 N개를 순서대로 통과."
        }
      ],
      "code": "class Encoder(nn.Module):\n    def __init__(\n        self,\n        vocab_size: int,\n        d_model: int,\n        num_heads: int,\n        num_layers: int,\n        d_ff: int,\n        dropout: float,\n        max_len: int,\n    ):\n        super().__init__()\n        self.d_model = d_model\n        self.embedding = nn.Embedding(vocab_size, d_model)\n        self.pos_encoding = PositionalEncoding(d_model, max_len, dropout)\n        self.layers = nn.ModuleList(\n            [EncoderLayer(d_model, num_heads, d_ff, dropout) for _ in range(num_layers)]\n        )\n\n    def forward(self, src_ids: torch.Tensor, src_mask: torch.Tensor) -> torch.Tensor:\n        x = self.embedding(src_ids) * math.sqrt(self.d_model)\n        x = self.pos_encoding(x)\n        for layer in self.layers:\n            x = layer(x, src_mask)\n        return x"
    },
    {
      "id": "tf_decoder",
      "name": "class Decoder",
      "fileId": "transformer",
      "summary": "정답(지금까지 생성분) + 인코더 출력을 받아 디코더 블록 N개를 통과시킨다.",
      "how": "구조는 인코더와 비슷하지만, 각 블록이 인코더 출력(enc_out)을 함께 받아 Cross-Attention에 사용합니다.",
      "terms": [
        "디코더",
        "enc_out"
      ],
      "lines": [
        {
          "at": "x = self.embedding(tgt_ids) * math.sqrt(self.d_model)",
          "text": "정답 쪽 단어도 벡터로 바꾸고 스케일 적용."
        },
        {
          "at": "x = layer(x, enc_out, tgt_mask, src_mask)",
          "text": "각 블록에 인코더 출력을 함께 넘겨 원문을 참고."
        }
      ],
      "code": "class Decoder(nn.Module):\n    def __init__(\n        self,\n        vocab_size: int,\n        d_model: int,\n        num_heads: int,\n        num_layers: int,\n        d_ff: int,\n        dropout: float,\n        max_len: int,\n    ):\n        super().__init__()\n        self.d_model = d_model\n        self.embedding = nn.Embedding(vocab_size, d_model)\n        self.pos_encoding = PositionalEncoding(d_model, max_len, dropout)\n        self.layers = nn.ModuleList(\n            [DecoderLayer(d_model, num_heads, d_ff, dropout) for _ in range(num_layers)]\n        )\n\n    def forward(\n        self,\n        tgt_ids: torch.Tensor,\n        enc_out: torch.Tensor,\n        tgt_mask: torch.Tensor,\n        src_mask: torch.Tensor,\n    ) -> torch.Tensor:\n        x = self.embedding(tgt_ids) * math.sqrt(self.d_model)\n        x = self.pos_encoding(x)\n        for layer in self.layers:\n            x = layer(x, enc_out, tgt_mask, src_mask)\n        return x"
    },
    {
      "id": "tf_transformer",
      "name": "class Transformer  ·  전체 조립",
      "fileId": "transformer",
      "summary": "인코더+디코더+출력층을 합친 완성 모델. 학습·추론 진입점 제공.",
      "how": "forward는 학습용(전체를 한 번에), encode/decode_step은 번역용(원문은 한 번만 인코딩하고 단어를 하나씩 생성)으로 나눠 제공합니다. tie_weights로 디코더 임베딩과 출력층 가중치를 공유해 파라미터를 줄입니다. 마지막 output_proj가 벡터를 '단어별 점수'로 바꿉니다.",
      "terms": [
        "output projection",
        "weight tying(가중치 공유)",
        "logits"
      ],
      "lines": [
        {
          "at": "self.output_proj = nn.Linear(d_model, tgt_vocab_size, bias=False)",
          "text": "디코더 출력을 '단어 사전 크기'의 점수로 바꾸는 층."
        },
        {
          "at": "self.output_proj.weight = self.decoder.embedding.weight",
          "text": "입력 임베딩과 출력층의 가중치를 하나로 공유(weight tying)."
        },
        {
          "at": "enc_out = self.encoder(src_ids, src_mask)",
          "text": "학습: 원문을 인코딩."
        },
        {
          "at": "def encode(self, src_ids: torch.Tensor, src_mask: torch.Tensor) -> torch.Tensor:",
          "text": "번역용: 원문을 한 번만 인코딩해 재사용."
        },
        {
          "at": "def decode_step(",
          "text": "번역용: 다음 단어 하나를 예측하는 한 스텝."
        }
      ],
      "code": "class Transformer(nn.Module):\n    def __init__(\n        self,\n        src_vocab_size: int,\n        tgt_vocab_size: int,\n        d_model: int = 128,\n        num_heads: int = 4,\n        num_layers: int = 2,\n        d_ff: int = 512,\n        dropout: float = 0.1,\n        max_len: int = 32,\n        tie_weights: bool = True,\n    ):\n        super().__init__()\n        self.encoder = Encoder(src_vocab_size, d_model, num_heads, num_layers, d_ff, dropout, max_len)\n        self.decoder = Decoder(tgt_vocab_size, d_model, num_heads, num_layers, d_ff, dropout, max_len)\n        self.output_proj = nn.Linear(d_model, tgt_vocab_size, bias=False)\n\n        if tie_weights:\n            self.output_proj.weight = self.decoder.embedding.weight\n\n    def forward(\n        self,\n        src_ids: torch.Tensor,\n        tgt_ids: torch.Tensor,\n        src_mask: torch.Tensor,\n        tgt_mask: torch.Tensor,\n    ) -> torch.Tensor:\n        enc_out = self.encoder(src_ids, src_mask)\n        dec_out = self.decoder(tgt_ids, enc_out, tgt_mask, src_mask)\n        return self.output_proj(dec_out)\n\n    def encode(self, src_ids: torch.Tensor, src_mask: torch.Tensor) -> torch.Tensor:\n        return self.encoder(src_ids, src_mask)\n\n    def decode_step(\n        self,\n        tgt_ids: torch.Tensor,\n        enc_out: torch.Tensor,\n        tgt_mask: torch.Tensor,\n        src_mask: torch.Tensor,\n    ) -> torch.Tensor:\n        dec_out = self.decoder(tgt_ids, enc_out, tgt_mask, src_mask)\n        return self.output_proj(dec_out)"
    },
    {
      "id": "demo_selfattn",
      "name": "self_attention_walkthrough()",
      "fileId": "demo",
      "summary": "'먹었다'가 다른 단어를 주목하는 과정을 4단계 숫자로 출력한다.",
      "how": "실제 라이브러리 코드로 QK^T→스케일링→softmax→가중합을 한 단계씩 출력해 눈으로 확인합니다. 마지막에 라이브러리 함수 결과와 수동 계산이 일치하는지 assert로 검증합니다(둘이 같아야 구현이 맞음).",
      "terms": [
        "임베딩",
        "@ (행렬곱 연산자)",
        "assert/allclose"
      ],
      "lines": [
        {
          "at": "raw_scores = (q[0, query_word_idx] @ k[0].T)",
          "text": "①'먹었다'의 Q와 모든 단어의 K를 곱해 점수."
        },
        {
          "at": "scaled_scores = raw_scores / (d_model ** 0.5)",
          "text": "②√d_k로 나눠 스케일 조절."
        },
        {
          "at": "attn_weights = torch.softmax(scaled_scores, dim=-1)",
          "text": "③softmax로 비율(%)로 변환."
        },
        {
          "at": "context = attn_weights @ v[0]",
          "text": "④비율대로 V를 섞어 새 문맥 벡터."
        },
        {
          "at": "assert torch.allclose(lib_context[0, 0, 0], context, atol=1e-5)",
          "text": "라이브러리 결과와 수동 계산이 같은지 검증."
        }
      ],
      "code": "def self_attention_walkthrough():\n    print(\"=\" * 70)\n    print(\"STEP 1. Self-Attention: 'Attention = softmax(QK^T / sqrt(d_k)) x V'\")\n    print(\"=\" * 70)\n\n    vocab = Vocab([\" \".join(TOKENS)])\n    d_model = 4  # small, matches the reference doc's toy 4-dim example\n    embedding = nn.Embedding(len(vocab), d_model)\n    w_q, w_k, w_v = (nn.Linear(d_model, d_model, bias=False) for _ in range(3))\n\n    token_ids = torch.tensor([[vocab.stoi[tok] for tok in TOKENS]])\n    x = embedding(token_ids)  # (1, 3, d_model)\n    q, k, v = w_q(x), w_k(x), w_v(x)\n\n    print(f\"\\ntoken embeddings x (d_model={d_model}):\")\n    for tok, vec in zip(TOKENS, x[0].tolist()):\n        print(f\"  {tok:6s} {fmt_row(vec)}\")\n\n    # ① QK^T : dot product between \"먹었다\"'s query and every token's key\n    query_word_idx = TOKENS.index(\"먹었다\")\n    raw_scores = (q[0, query_word_idx] @ k[0].T)\n    print(f\"\\n① QK^T  (query='먹었다' vs. each key):\")\n    print(f\"  {fmt_row(raw_scores.tolist())}   (order: {', '.join(TOKENS)})\")\n\n    # ② scale by sqrt(d_k)\n    scaled_scores = raw_scores / (d_model ** 0.5)\n    print(f\"\\n② scaled by 1/sqrt(d_k)={1 / d_model ** 0.5:.3f}:\")\n    print(f\"  {fmt_row(scaled_scores.tolist())}\")\n\n    # ③ softmax -> attention weights that sum to 1\n    attn_weights = torch.softmax(scaled_scores, dim=-1)\n    print(f\"\\n③ softmax (attention weights, sum=1):\")\n    for tok, w in zip(TOKENS, attn_weights.tolist()):\n        print(f\"  {tok:6s} {w * 100:5.1f}%\")\n\n    # ④ weighted sum of values -> new context vector for \"먹었다\"\n    context = attn_weights @ v[0]\n    print(f\"\\n④ weighted sum of V -> new context vector for '먹었다':\")\n    print(f\"  {fmt_row(context.tolist())}\")\n\n    # Sanity check: the library function must produce the identical result.\n    lib_context, lib_weights = scaled_dot_product_attention(\n        q[:, None, query_word_idx : query_word_idx + 1], k[:, None], v[:, None]\n    )\n    assert torch.allclose(lib_context[0, 0, 0], context, atol=1e-5)\n    assert torch.allclose(lib_weights[0, 0, 0], attn_weights, atol=1e-5)\n    print(\"\\n[OK] transformer_lab.attention.scaled_dot_product_attention() matches this walkthrough.\")\n\n    data = {\n        \"tokens\": TOKENS,\n        \"d_model\": d_model,\n        \"query_word\": TOKENS[query_word_idx],\n        \"embeddings\": x[0].tolist(),\n        \"values\": v[0].tolist(),  # each token's V-vector, so step 4 can show the actual mixing recipe\n        \"raw_scores\": raw_scores.tolist(),\n        \"scale_factor\": 1 / d_model**0.5,\n        \"scaled_scores\": scaled_scores.tolist(),\n        \"attn_weights\": attn_weights.tolist(),\n        \"context\": context.tolist(),\n    }\n    return x, data"
    },
    {
      "id": "demo_multihead",
      "name": "multi_head_shape_demo()",
      "fileId": "demo",
      "summary": "Multi-Head Attention의 입출력 모양과 head별 주목도를 보여준다.",
      "how": "d_model=8을 head 4개로 쪼개 각 head가 같은 단어들을 서로 다르게 주목하는 것을 출력합니다. 입력/출력 텐서의 shape 변화를 함께 보여줘 '쪼갰다 합치는' 과정을 체감하게 합니다.",
      "terms": [
        "shape(텐서 모양)",
        "head별 주목도"
      ],
      "lines": [
        {
          "at": "d_model, num_heads = 8, 4",
          "text": "8차원을 head 4개로 나눔."
        },
        {
          "at": "out = mha(x_full, x_full, x_full)",
          "text": "self-attention 실행."
        },
        {
          "at": "for h in range(num_heads):",
          "text": "head마다 '먹었다'의 주목도를 따로 출력."
        }
      ],
      "code": "def multi_head_shape_demo(x: torch.Tensor):\n    print()\n    print(\"=\" * 70)\n    print(\"STEP 2. Multi-Head Attention: same idea, several heads in parallel\")\n    print(\"=\" * 70)\n\n    d_model, num_heads = 8, 4\n    embedding = nn.Embedding(x.size(1) + 1, d_model)  # re-embed at the real d_model size\n    token_ids = torch.arange(x.size(1)).unsqueeze(0)\n    x_full = embedding(token_ids)\n\n    mha = MultiHeadAttention(d_model=d_model, num_heads=num_heads, dropout=0.0)\n    out = mha(x_full, x_full, x_full)\n\n    head_dim = d_model // num_heads\n    print(f\"\\nd_model={d_model} split into num_heads={num_heads} x head_dim={head_dim}\")\n    print(f\"input shape  : {tuple(x_full.shape)}   (batch, seq_len, d_model)\")\n    print(f\"output shape : {tuple(out.shape)}   (concat of all heads, projected back to d_model)\")\n    print(f\"attention weights shape per head: {tuple(mha.last_attn_weights.shape)}\"\n          \" (batch, num_heads, seq_len, seq_len)\")\n    for h in range(num_heads):\n        print(f\"  head {h}: {fmt_row(mha.last_attn_weights[0, h, TOKENS.index('먹었다')].tolist())}\"\n              f\"   (order: {', '.join(TOKENS)})\")\n    print(\"\\nEach head attends to the same tokens with a different learned Q/K/V \"\n          \"projection -- e.g. one head can end up specializing in subject-verb \"\n          \"relations while another focuses on object-verb relations.\")\n\n    return {\n        \"tokens\": TOKENS,\n        \"d_model\": d_model,\n        \"num_heads\": num_heads,\n        \"head_dim\": head_dim,\n        \"query_word\": TOKENS[TOKENS.index(\"먹었다\")],\n        \"head_weights\": [\n            mha.last_attn_weights[0, h, TOKENS.index(\"먹었다\")].tolist() for h in range(num_heads)\n        ],\n    }"
    },
    {
      "id": "tr_setseed",
      "name": "set_seed()",
      "fileId": "train",
      "summary": "무작위성을 고정해 매 실행 결과를 재현 가능하게 만든다.",
      "how": "가중치 초기화 등에 쓰이는 난수를 같은 seed로 고정하면 학습 결과가 매번 동일하게 재현됩니다.",
      "terms": [
        "seed(시드)",
        "manual_seed"
      ],
      "lines": [
        {
          "at": "torch.manual_seed(seed)",
          "text": "PyTorch 난수 생성기를 고정."
        }
      ],
      "code": "def set_seed(seed: int) -> None:\n    random.seed(seed)\n    torch.manual_seed(seed)"
    },
    {
      "id": "tr_batches",
      "name": "build_batches()",
      "fileId": "train",
      "summary": "문장쌍들을 숫자 텐서로 바꾸고 길이를 맞춰(pad) 하나로 묶는다.",
      "how": "인코더 입력(원문)에는 <sos>/<eos>가 필요 없지만, 디코더 입력(정답)에는 시작·끝 표식이 필요합니다. 길이가 다른 문장들을 pad_sequence로 빈칸을 채워 같은 길이의 행렬로 만듭니다.",
      "terms": [
        "pad_sequence",
        "텐서(tensor)",
        "배치(batch)"
      ],
      "lines": [
        {
          "at": "src_batch = [torch.tensor(src_vocab.encode(src, add_special=False)) for src, _ in pairs]",
          "text": "원문은 특수표식 없이 번호로 변환."
        },
        {
          "at": "tgt_batch = [torch.tensor(tgt_vocab.encode(tgt)) for _, tgt in pairs]",
          "text": "정답은 <sos>/<eos>를 포함해 변환."
        },
        {
          "at": "src_ids = pad_sequence(src_batch, batch_first=True, padding_value=src_vocab.pad_id).to(device)",
          "text": "짧은 문장을 <pad>로 채워 길이를 맞춘다."
        }
      ],
      "code": "def build_batches(pairs, src_vocab, tgt_vocab, device):\n    # Encoder input needs only the source tokens (no <sos>/<eos>): it does\n    # not generate anything, so it has no \"start\"/\"stop\" signal to encode.\n    # The decoder DOES need them: <sos> kicks off generation and <eos> is\n    # the training target that teaches the model when to stop.\n    src_batch = [torch.tensor(src_vocab.encode(src, add_special=False)) for src, _ in pairs]\n    tgt_batch = [torch.tensor(tgt_vocab.encode(tgt)) for _, tgt in pairs]\n    src_ids = pad_sequence(src_batch, batch_first=True, padding_value=src_vocab.pad_id).to(device)\n    tgt_ids = pad_sequence(tgt_batch, batch_first=True, padding_value=tgt_vocab.pad_id).to(device)\n    return src_ids, tgt_ids"
    },
    {
      "id": "tr_main",
      "name": "main()  ·  학습 루프",
      "fileId": "train",
      "summary": "데이터·모델·옵티마이저를 준비하고 400번 반복하며 loss를 줄인다.",
      "how": "정답을 한 칸 밀어 '입력'과 '맞혀야 할 다음 단어'로 나눕니다(teacher forcing). 매 epoch마다 예측→loss 계산→역전파(backward)→가중치 갱신(step)을 반복합니다. loss가 줄면 학습이 되는 것이고, 끝나면 checkpoint.pt로 저장합니다.",
      "terms": [
        "옵티마이저(Adam)",
        "CrossEntropyLoss",
        "역전파(backward)",
        "teacher forcing",
        "epoch"
      ],
      "lines": [
        {
          "at": "criterion = nn.CrossEntropyLoss(ignore_index=tgt_vocab.pad_id)",
          "text": "예측과 정답의 오차를 재는 함수(빈칸은 제외)."
        },
        {
          "at": "decoder_input = tgt_ids[:, :-1]",
          "text": "정답에서 마지막을 뺀 것이 디코더 '입력'."
        },
        {
          "at": "decoder_target = tgt_ids[:, 1:]",
          "text": "한 칸 민 것이 '맞혀야 할 다음 단어'."
        },
        {
          "at": "logits = model(src_ids, decoder_input, src_mask, tgt_mask)",
          "text": "모델이 다음 단어 점수를 예측."
        },
        {
          "at": "loss.backward()",
          "text": "오차를 거꾸로 흘려 각 가중치의 수정 방향을 계산(역전파)."
        },
        {
          "at": "optimizer.step()",
          "text": "계산된 방향으로 가중치를 조금 움직임."
        },
        {
          "at": "torch.save(",
          "text": "학습 결과·사전·설정을 checkpoint 파일로 저장."
        }
      ],
      "code": "def main():\n    parser = argparse.ArgumentParser(description=__doc__)\n    parser.add_argument(\"--epochs\", type=int, default=400)\n    parser.add_argument(\"--d-model\", type=int, default=64)\n    parser.add_argument(\"--num-heads\", type=int, default=4)\n    parser.add_argument(\"--num-layers\", type=int, default=2)\n    parser.add_argument(\"--d-ff\", type=int, default=256)\n    parser.add_argument(\"--lr\", type=float, default=3e-4)\n    parser.add_argument(\"--seed\", type=int, default=42)\n    parser.add_argument(\"--log-every\", type=int, default=20)\n    args = parser.parse_args()\n\n    set_seed(args.seed)\n    device = torch.device(\"cuda\" if torch.cuda.is_available() else \"cpu\")\n\n    pairs = load_pairs(DATA_PATH)\n    src_vocab = Vocab([src for src, _ in pairs])\n    tgt_vocab = Vocab([tgt for _, tgt in pairs])\n    print(f\"loaded {len(pairs)} sentence pairs | src_vocab={len(src_vocab)} tgt_vocab={len(tgt_vocab)}\")\n\n    src_ids, tgt_ids = build_batches(pairs, src_vocab, tgt_vocab, device)\n    max_len = max(src_ids.size(1), tgt_ids.size(1)) + 2\n\n    model = Transformer(\n        src_vocab_size=len(src_vocab),\n        tgt_vocab_size=len(tgt_vocab),\n        d_model=args.d_model,\n        num_heads=args.num_heads,\n        num_layers=args.num_layers,\n        d_ff=args.d_ff,\n        max_len=max_len,\n    ).to(device)\n\n    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)\n    criterion = nn.CrossEntropyLoss(ignore_index=tgt_vocab.pad_id)\n\n    decoder_input = tgt_ids[:, :-1]\n    decoder_target = tgt_ids[:, 1:]\n\n    src_mask = make_padding_mask(src_ids, src_vocab.pad_id)\n\n    loss_history = []  # kept alongside the checkpoint so web/generate_web_data.py can plot it\n\n    model.train()\n    for epoch in range(1, args.epochs + 1):\n        tgt_mask = make_decoder_mask(decoder_input, tgt_vocab.pad_id)\n\n        logits = model(src_ids, decoder_input, src_mask, tgt_mask)\n        loss = criterion(logits.reshape(-1, logits.size(-1)), decoder_target.reshape(-1))\n\n        optimizer.zero_grad()\n        loss.backward()\n        optimizer.step()\n\n        loss_history.append({\"epoch\": epoch, \"loss\": loss.item()})\n        if epoch % args.log_every == 0 or epoch == 1:\n            print(f\"epoch {epoch:4d} | loss {loss.item():.4f}\")\n\n    torch.save(\n        {\n            \"model_state\": model.state_dict(),\n            \"src_itos\": src_vocab.itos,\n            \"tgt_itos\": tgt_vocab.itos,\n            \"loss_history\": loss_history,\n            \"config\": {\n                \"d_model\": args.d_model,\n                \"num_heads\": args.num_heads,\n                \"num_layers\": args.num_layers,\n                \"d_ff\": args.d_ff,\n                \"max_len\": max_len,\n            },\n        },\n        CHECKPOINT_PATH,\n    )\n    print(f\"saved checkpoint to {CHECKPOINT_PATH}\")"
    },
    {
      "id": "tl_loadmodel",
      "name": "load_model()",
      "fileId": "translate",
      "summary": "저장된 checkpoint를 안전하게 불러와 모델을 복원한다.",
      "how": "학습 때 저장한 사전·설정으로 똑같은 구조의 모델을 만들고 가중치를 채웁니다. weights_only=True는 악의적 체크포인트의 코드 실행을 막는 최신 권장 방식입니다. eval()로 추론 모드(드롭아웃 끔)로 전환합니다.",
      "terms": [
        "checkpoint",
        "torch.load",
        "weights_only",
        "eval()"
      ],
      "lines": [
        {
          "at": "ckpt = torch.load(checkpoint_path, map_location=device, weights_only=True)",
          "text": "체크포인트를 안전 모드로 로드."
        },
        {
          "at": "model.load_state_dict(ckpt[\"model_state\"])",
          "text": "학습된 가중치를 모델에 채운다."
        },
        {
          "at": "model.eval()",
          "text": "추론 모드로 전환(드롭아웃 등 학습 전용 동작 끔)."
        }
      ],
      "code": "def load_model(checkpoint_path: str, device: torch.device):\n    # weights_only=True (PyTorch >= 2.6 default) blocks arbitrary code execution\n    # from a malicious checkpoint by only unpickling tensors and plain\n    # str/list/dict/int values -- exactly what train.py saves here.\n    ckpt = torch.load(checkpoint_path, map_location=device, weights_only=True)\n    src_vocab = Vocab.from_itos(ckpt[\"src_itos\"])\n    tgt_vocab = Vocab.from_itos(ckpt[\"tgt_itos\"])\n    cfg = ckpt[\"config\"]\n\n    model = Transformer(\n        src_vocab_size=len(src_vocab),\n        tgt_vocab_size=len(tgt_vocab),\n        d_model=cfg[\"d_model\"],\n        num_heads=cfg[\"num_heads\"],\n        num_layers=cfg[\"num_layers\"],\n        d_ff=cfg[\"d_ff\"],\n        max_len=cfg[\"max_len\"],\n    ).to(device)\n    model.load_state_dict(ckpt[\"model_state\"])\n    model.eval()\n    return model, src_vocab, tgt_vocab"
    },
    {
      "id": "tl_translate",
      "name": "translate()  ·  한 단어씩 생성",
      "fileId": "translate",
      "summary": "원문을 인코딩하고 <sos>부터 단어를 하나씩 이어붙여 번역한다.",
      "how": "원문은 한 번만 인코딩해 재사용하고, 매 단계 지금까지의 결과로 다음 단어를 예측해 가장 확률 높은 단어(argmax)를 붙입니다. <eos>가 나오면 멈춥니다. 이 '하나씩 생성'이 자기회귀(auto-regressive)입니다.",
      "terms": [
        "auto-regressive(자기회귀)",
        "argmax",
        "greedy decoding",
        "@torch.no_grad"
      ],
      "lines": [
        {
          "at": "enc_out = model.encode(src_ids, src_mask)",
          "text": "원문을 한 번만 인코딩(반복 안 함)."
        },
        {
          "at": "generated = [tgt_vocab.sos_id]",
          "text": "시작 표식 <sos>로 생성을 시작."
        },
        {
          "at": "next_id = logits[0, -1].argmax().item()",
          "text": "마지막 위치에서 가장 점수 높은 단어를 고름."
        },
        {
          "at": "if next_id == tgt_vocab.eos_id:",
          "text": "끝 표식이 나오면 생성을 멈춘다."
        },
        {
          "at": "cross_attn = model.decoder.layers[-1].cross_attn.last_attn_weights",
          "text": "마지막 디코더 층의 Cross-Attention을 꺼내 시각화용으로 반환."
        }
      ],
      "code": "@torch.no_grad()\ndef translate(model, src_vocab, tgt_vocab, sentence: str, device, max_len: int = 20):\n    src_ids = torch.tensor([src_vocab.encode(sentence, add_special=False)], device=device)\n    src_mask = make_padding_mask(src_ids, src_vocab.pad_id)\n    enc_out = model.encode(src_ids, src_mask)\n\n    generated = [tgt_vocab.sos_id]\n    for _ in range(max_len):\n        tgt_ids = torch.tensor([generated], device=device)\n        tgt_mask = make_causal_mask(tgt_ids.size(1), device)\n        logits = model.decode_step(tgt_ids, enc_out, tgt_mask, src_mask)\n        next_id = logits[0, -1].argmax().item()\n        generated.append(next_id)\n        if next_id == tgt_vocab.eos_id:\n            break\n\n    cross_attn = model.decoder.layers[-1].cross_attn.last_attn_weights  # (1, heads, tgt_len, src_len)\n    return generated, cross_attn"
    },
    {
      "id": "tl_crossattn",
      "name": "print_cross_attention()",
      "fileId": "translate",
      "summary": "생성한 단어별로 원문 단어를 얼마나 참고했는지 표로 출력한다.",
      "how": "여러 head의 주목도를 평균 내고, 생성된 단어마다 '원문 각 단어를 몇 % 봤는지'를 줄 맞춰 표로 보여줍니다. README의 '먹었다가 사과를 31% 주목' 같은 분석과 같은 형식입니다.",
      "terms": [
        "Cross-Attention 비율",
        "mean(평균)"
      ],
      "lines": [
        {
          "at": "weights = cross_attn[0].mean(dim=0)",
          "text": "head들의 주목도를 평균내 한 장의 표로."
        },
        {
          "at": "for row_idx, tok in enumerate(gen_tokens):",
          "text": "생성된 단어마다 한 줄씩 출력."
        }
      ],
      "code": "def print_cross_attention(generated_ids, src_tokens, tgt_vocab, cross_attn):\n    # average over heads, drop the leading <sos> row -> one row per generated word\n    weights = cross_attn[0].mean(dim=0)  # (tgt_len, src_len)\n    gen_tokens = [tgt_vocab.itos[i] for i in generated_ids[1:]]\n\n    header = \"generated word\".ljust(12) + \"\".join(tok.rjust(10) for tok in src_tokens)\n    print(header)\n    for row_idx, tok in enumerate(gen_tokens):\n        row = weights[row_idx].tolist()\n        line = tok.ljust(12) + \"\".join(f\"{p * 100:9.1f}%\" for p in row)\n        print(line)"
    },
    {
      "id": "tl_main",
      "name": "main()  ·  번역 실행",
      "fileId": "translate",
      "summary": "명령행 인자로 받은 문장을 번역하고 결과·Cross-Attention을 출력한다.",
      "how": "--sentence로 받은 한국어 문장을 번역해 출력하고, 이어서 어느 원문 단어를 참고했는지 표로 보여줍니다.",
      "terms": [
        "argparse",
        "명령행 인자"
      ],
      "lines": [
        {
          "at": "parser.add_argument(\"--sentence\", default=\"나는 사과를 먹었다\")",
          "text": "번역할 문장을 명령행 옵션으로 받음."
        },
        {
          "at": "translation = tgt_vocab.decode(generated)",
          "text": "생성된 번호들을 다시 영어 문장으로 되돌림."
        }
      ],
      "code": "def main():\n    parser = argparse.ArgumentParser(description=__doc__)\n    parser.add_argument(\"--sentence\", default=\"나는 사과를 먹었다\")\n    parser.add_argument(\"--checkpoint\", default=CHECKPOINT_PATH)\n    parser.add_argument(\"--max-len\", type=int, default=20)\n    args = parser.parse_args()\n\n    device = torch.device(\"cuda\" if torch.cuda.is_available() else \"cpu\")\n    model, src_vocab, tgt_vocab = load_model(args.checkpoint, device)\n\n    generated, cross_attn = translate(model, src_vocab, tgt_vocab, args.sentence, device, args.max_len)\n    translation = tgt_vocab.decode(generated)\n\n    print(f\"입력(source) : {args.sentence}\")\n    print(f\"번역(output) : {translation}\")\n    print()\n    print(\"Cross-Attention (decoder query -> encoder source tokens):\")\n    print_cross_attention(generated, tokenize(args.sentence), tgt_vocab, cross_attn)"
    },
    {
      "id": "gw_attn",
      "name": "build_attention_data()",
      "fileId": "genweb",
      "summary": "attention 데모를 실제로 돌려 self/multi-head 결과를 모은다.",
      "how": "attention_demo.py의 함수를 그대로 호출해 실제 계산 결과(숫자)를 얻어 딕셔너리로 담습니다.",
      "terms": [],
      "lines": [
        {
          "at": "x, self_attn = self_attention_walkthrough()",
          "text": "Self-Attention 데모 실행 결과를 가져옴."
        },
        {
          "at": "multi_head = multi_head_shape_demo(x)",
          "text": "Multi-Head 데모 결과를 가져옴."
        }
      ],
      "code": "def build_attention_data() -> dict:\n    x, self_attn = self_attention_walkthrough()\n    multi_head = multi_head_shape_demo(x)\n    return {\"self_attention\": self_attn, \"multi_head\": multi_head}"
    },
    {
      "id": "gw_train",
      "name": "build_training_data()",
      "fileId": "genweb",
      "summary": "checkpoint에 저장된 epoch별 loss 기록을 읽어온다.",
      "how": "학습 때 함께 저장해둔 loss_history를 그대로 꺼내 loss 곡선 그래프용 데이터로 씁니다.",
      "terms": [
        "loss_history"
      ],
      "lines": [
        {
          "at": "return ckpt.get(\"loss_history\", [])",
          "text": "저장된 loss 기록을 반환(없으면 빈 목록)."
        }
      ],
      "code": "def build_training_data() -> list:\n    ckpt = torch.load(CHECKPOINT_PATH, map_location=\"cpu\", weights_only=True)\n    return ckpt.get(\"loss_history\", [])"
    },
    {
      "id": "gw_trans",
      "name": "build_translation_data()",
      "fileId": "genweb",
      "summary": "엄선한 예문 4개를 번역하며 Cross-Attention까지 수집한다.",
      "how": "학습 문장·일반화 성공·오역 사례·미사용 조합 4가지를 골라 번역 결과와 원문별 주목도를 모읍니다. README와 같은 '정직한 그림'(성공과 실패 모두)을 보여주기 위한 큐레이션입니다.",
      "terms": [
        "큐레이션",
        "Cross-Attention"
      ],
      "lines": [
        {
          "at": "for example in EXAMPLE_SENTENCES:",
          "text": "엄선한 예문들을 하나씩 번역."
        },
        {
          "at": "weights = cross_attn[0].mean(dim=0).tolist()",
          "text": "head 평균 주목도를 시각화용 숫자로 변환."
        }
      ],
      "code": "def build_translation_data(device: torch.device) -> list:\n    model, src_vocab, tgt_vocab = load_model(CHECKPOINT_PATH, device)\n    results = []\n    for example in EXAMPLE_SENTENCES:\n        generated, cross_attn = translate(model, src_vocab, tgt_vocab, example[\"sentence\"], device)\n        weights = cross_attn[0].mean(dim=0).tolist()  # (tgt_len, src_len), averaged over heads\n        results.append(\n            {\n                \"source\": example[\"sentence\"],\n                \"source_tokens\": tokenize(example[\"sentence\"]),\n                \"translation\": tgt_vocab.decode(generated),\n                \"generated_tokens\": [tgt_vocab.itos[i] for i in generated[1:]],  # drop leading <sos>\n                \"cross_attention\": weights,\n                \"split\": example[\"split\"],\n                \"note\": example[\"note\"],\n            }\n        )\n    return results"
    },
    {
      "id": "gw_main",
      "name": "main()  ·  data.js 내보내기",
      "fileId": "genweb",
      "summary": "세 종류 데이터를 모아 web/data.js로 저장한다.",
      "how": "attention·학습·번역 데이터를 한 딕셔너리로 묶고, fetch 없이 <script>로 바로 읽히도록 'window.VIZ_DATA = {...}' 형태의 JS 파일로 저장합니다(file:// 환경에서도 동작).",
      "terms": [
        "json.dumps",
        "window 전역 할당",
        "file:// / CORS"
      ],
      "lines": [
        {
          "at": "raise SystemExit(f\"{CHECKPOINT_PATH} not found",
          "text": "먼저 학습(checkpoint)이 있어야 함을 안내하며 중단."
        },
        {
          "at": "js = \"window.VIZ_DATA = \" + json.dumps(data, ensure_ascii=False, indent=2) + \";\\n\"",
          "text": "fetch 없이 로드되도록 window 전역 할당 JS로 만든다."
        },
        {
          "at": "DATA_JS_PATH.write_text(js, encoding=\"utf-8\")",
          "text": "web/data.js 파일로 저장."
        }
      ],
      "code": "def main() -> None:\n    if not Path(CHECKPOINT_PATH).exists():\n        raise SystemExit(f\"{CHECKPOINT_PATH} not found -- run `python train.py` first\")\n\n    device = torch.device(\"cpu\")\n    data = {\n        \"attention\": build_attention_data(),\n        \"training\": build_training_data(),\n        \"translations\": build_translation_data(device),\n    }\n\n    WEB_DIR.mkdir(exist_ok=True)\n    js = \"window.VIZ_DATA = \" + json.dumps(data, ensure_ascii=False, indent=2) + \";\\n\"\n    DATA_JS_PATH.write_text(js, encoding=\"utf-8\")\n    print(f\"wrote {DATA_JS_PATH}\")"
    }
  ],
  "glossary": {
    "유니코드": "전 세계 모든 글자에 고유 번호를 매긴 표준. 한글 글자도 하나의 번호로 표현된다.",
    "받침": "한글 한 글자의 아래에 붙는 자음(예: '강'의 ㅇ). 있고 없고에 따라 조사가 달라진다.",
    "ord": "파이썬 내장 함수. 글자 하나를 그 유니코드 번호(정수)로 바꾼다.",
    "for 반복문": "목록의 원소를 하나씩 꺼내 같은 일을 반복하는 문법.",
    "리스트": "여러 값을 순서대로 담는 파이썬 기본 자료형([...]).",
    "seed(시드)": "난수(무작위 값)의 출발점. 같은 seed면 매번 같은 무작위 결과가 나와 재현이 가능.",
    "shuffle": "목록의 순서를 무작위로 섞는 것.",
    "held-out": "학습에 일부러 쓰지 않고 빼둔 데이터. 모델이 '처음 보는 것'도 맞히는지(일반화) 확인용.",
    "토큰(token)": "문장을 잘게 나눈 조각. 이 예제에서는 공백으로 나눈 '단어'가 토큰.",
    "split": "문자열을 특정 기준(기본은 공백)으로 잘라 리스트로 만드는 파이썬 함수.",
    "<pad>/<sos>/<eos>/<unk>": "특수 표식: 빈칸 채우기 / 문장 시작 / 문장 끝 / 사전에 없는 단어.",
    "딕셔너리(dict)": "'열쇠(key)→값(value)' 짝으로 저장하는 자료형. 여기선 단어→번호 표.",
    "encode/decode": "encode=문장을 숫자로, decode=숫자를 다시 문장으로 되돌리기.",
    "@property": "메서드를 속성처럼 괄호 없이 쓰게 해주는 파이썬 문법(예: vocab.pad_id).",
    "with open": "파일을 열고 작업이 끝나면 자동으로 닫아주는 안전한 파일 열기 문법.",
    "encoding=utf-8": "한글이 깨지지 않도록 문자 인코딩을 UTF-8로 지정.",
    "Q/K/V": "Query(질문)·Key(열쇠)·Value(값). 각 단어를 세 역할의 벡터로 바꿔 attention을 계산.",
    "행렬곱(matmul)": "여러 숫자를 한꺼번에 곱해 더하는 행렬 연산. 신경망 계산의 기본.",
    "softmax": "여러 점수를 합이 1인 비율(확률)로 바꾸는 함수. 큰 값일수록 큰 비율.",
    "d_k(√d_k 스케일링)": "Key 벡터의 차원 수. 점수를 √d_k로 나눠 값이 너무 커지는 것을 막음.",
    "head(헤드)": "Multi-Head Attention에서 서로 다른 관점으로 attention을 보는 병렬 단위.",
    "nn.Linear": "입력에 가중치를 곱하고 더하는 학습되는 선형 변환 층.",
    "head_dim": "전체 차원(d_model)을 head 개수로 나눈, head 하나가 맡는 차원 수.",
    "transpose/view": "텐서(다차원 배열)의 축 순서·모양을 바꾸는 연산.",
    "sin/cos 위치인코딩": "sin·cos 파형으로 각 위치를 고유하게 표시하는 방식(학습 안 함).",
    "register_buffer": "학습되지 않지만 모델과 함께 저장·이동되는 값을 등록하는 PyTorch 기능.",
    "arange": "0,1,2,... 처럼 연속된 숫자 배열을 만드는 함수.",
    "FFN": "Feed-Forward Network. 각 단어를 개별적으로 변환하는 작은 신경망.",
    "ReLU": "음수는 0으로, 양수는 그대로 두는 간단한 비선형 함수.",
    "nn.Sequential": "여러 층을 순서대로 쌓아 한 번에 통과시키는 컨테이너.",
    "Dropout": "학습 중 일부 값을 무작위로 0으로 꺼서 과적합을 막는 기법.",
    "mask(마스크)": "특정 위치를 '보임/가림'으로 표시하는 True/False 표.",
    "unsqueeze": "텐서에 크기 1인 새 축을 끼워 넣어 모양을 맞추는 연산.",
    "브로드캐스트": "모양이 다른 텐서끼리 자동으로 크기를 맞춰 계산하는 규칙.",
    "causal mask": "미래(뒤쪽) 토큰을 가리는 삼각형 마스크. 디코더의 커닝 방지.",
    "torch.tril(하삼각)": "행렬의 아래쪽 삼각형만 남기는 함수.",
    "논리 AND(&)": "둘 다 참(True)일 때만 참이 되는 연산.",
    "잔차연결(residual)": "층의 출력에 입력 원본을 더하는 것. 깊은 신경망 학습을 안정화.",
    "LayerNorm": "값들의 크기(평균·분산)를 정규화해 학습을 안정시키는 층.",
    "self-attention": "문장이 자기 자신에게 attention을 거는 것(Q·K·V가 모두 같은 입력).",
    "Cross-Attention": "디코더가 인코더 출력을 참고하는 attention(원문을 '보는' 단계).",
    "Masked Self-Attention": "미래 단어를 가린 채 수행하는 디코더의 self-attention.",
    "nn.Embedding": "단어 번호를 학습되는 벡터로 바꾸는 조회 표.",
    "nn.ModuleList": "여러 층(모듈)을 리스트처럼 담아 반복 사용하게 하는 컨테이너.",
    "임베딩 스케일(√d_model)": "임베딩 값에 √d_model을 곱해 위치인코딩과 크기를 맞추는 관례.",
    "디코더": "인코더가 만든 표현을 참고해 정답을 한 단어씩 생성하는 부분.",
    "enc_out": "인코더가 출력한, 문맥이 반영된 원문 표현 벡터.",
    "output projection": "디코더 출력 벡터를 '단어 사전 크기'의 점수로 바꾸는 마지막 층.",
    "weight tying(가중치 공유)": "입력 임베딩과 출력층이 같은 가중치를 공유해 파라미터를 절약.",
    "logits": "softmax 전의 원점수. 각 단어가 정답일 가능성의 크기.",
    "임베딩": "단어(또는 번호)를 의미가 담긴 숫자 벡터로 바꾼 것.",
    "@ (행렬곱 연산자)": "파이썬에서 행렬곱을 뜻하는 기호(a @ b).",
    "assert/allclose": "조건이 참인지 확인하는 검사. allclose는 두 값이 거의 같은지 판단.",
    "shape(텐서 모양)": "텐서의 각 축 크기(예: (배치, 길이, 차원)).",
    "head별 주목도": "각 head가 계산한, 단어별 attention 비율.",
    "manual_seed": "PyTorch의 난수 출발점을 고정하는 함수.",
    "pad_sequence": "길이가 다른 문장들을 <pad>로 채워 같은 길이 행렬로 만드는 함수.",
    "텐서(tensor)": "PyTorch의 다차원 숫자 배열. 모든 계산의 기본 단위.",
    "배치(batch)": "여러 문장을 한 번에 묶어 처리하는 단위.",
    "옵티마이저(Adam)": "loss를 줄이도록 가중치를 어떻게 고칠지 정하는 알고리즘.",
    "CrossEntropyLoss": "분류(다음 단어 맞히기) 문제에서 예측과 정답의 오차를 재는 함수.",
    "역전파(backward)": "오차를 거꾸로 흘려 각 가중치의 수정 방향을 계산하는 과정.",
    "teacher forcing": "학습 때 이전 단계 정답을 그대로 입력으로 넣어 학습을 돕는 방법.",
    "epoch": "전체 학습 데이터를 한 번 다 훑는 것을 1 epoch이라 함.",
    "checkpoint": "학습된 가중치·설정을 저장한 파일(.pt).",
    "torch.load": "저장된 checkpoint 파일을 불러오는 함수.",
    "weights_only": "torch.load 옵션. True면 코드 실행 없이 안전하게 텐서·기본값만 로드.",
    "eval()": "모델을 추론 모드로 전환(드롭아웃 등 학습 전용 동작을 끔).",
    "auto-regressive(자기회귀)": "이전에 만든 단어를 다시 입력으로 넣어 다음 단어를 만드는 방식.",
    "argmax": "여러 점수 중 가장 큰 값의 위치(번호)를 고르는 것.",
    "greedy decoding": "매 단계 가장 확률 높은 단어만 고르는 가장 단순한 생성 방식.",
    "@torch.no_grad": "추론 시 기울기 계산을 꺼서 메모리·속도를 아끼는 표시.",
    "Cross-Attention 비율": "번역 단어가 원문 각 단어를 참고한 정도(%).",
    "mean(평균)": "여러 값을 더해 개수로 나눈 값.",
    "argparse": "명령행 옵션(--sentence 등)을 편하게 받게 해주는 표준 라이브러리.",
    "명령행 인자": "프로그램 실행 시 뒤에 붙여 넘기는 옵션 값.",
    "loss_history": "epoch마다 기록한 loss 값들의 목록(학습 곡선용).",
    "큐레이션": "의도를 가지고 예시를 엄선하는 것.",
    "json.dumps": "파이썬 자료를 JSON 문자열로 바꾸는 함수.",
    "window 전역 할당": "브라우저 전역 객체(window)에 값을 담아 <script>로 바로 읽게 하는 방식.",
    "file:// / CORS": "로컬 파일을 브라우저로 직접 열 때의 프로토콜. fetch는 보안(CORS)으로 막히므로 <script> 로드를 씀."
  }
};
