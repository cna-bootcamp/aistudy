# 🧑‍🏫 강사용 안내 (비공개 — public repo에 포함하지 말 것)

> 이 문서와 `transformer_translate_colab_answers.ipynb`, `prompts/` 는 정답·설계 내부 자료입니다.
> **public repo(unicorn-campus/voc-translate)에는 학생용 파일만 올립니다.** (제외 목록은 아래 참고)

## 정답본
- `transformer_translate_colab_answers.ipynb` — 모든 빈칸이 채워진 실행검증본
- 학생용(`transformer_translate_colab.ipynb`)과 **셀 구조가 100% 동일**하며, 7개 빈칸 셀의
  소스만 다릅니다(주관식=정답 코드, 객관식=정답 드롭다운 기본값).

## 정답 요약 (객관식)
| 항목 | 변수 | 정답 |
|---|---|---|
| 위치 인코딩 | `pe_choice` | **A** (짝수=sin, 홀수=cos) |
| 헤드 분할 | `split_choice` | **B** (view(b,s,heads,head_dim)→transpose(1,2)) |
| 인코더 잔차 순서 | `enc_resid` | **A** (norm1(x + attn)) |
| greedy 다음 단어 | `greedy_choice` | **C** (logits[0,-1].argmax()) |
| 디코더 블록 순서 | `dec_order` | **A** (self→norm1 · cross→norm2 · ffn→norm3) |

주관식(3): ① `scores = matmul(q, k.transpose(-2,-1))/sqrt(d_k)` ② `attn_weights = softmax(scores, -1)`,
`context = matmul(attn_weights, v)` ③ causal mask `= torch.tril(torch.ones(seq_len, seq_len, device=device)).bool()`

## 자기검증(assert) 설계
- **주관식**: 고정 입력에 대한 **골든 텐서 대조**(`torch.allclose`). 순환참조가 없도록 라이브러리 대조 대신
  하드코딩 골든 사용. 미기입(`...`) 시 friendly 가드가 "빈칸을 채우세요" 안내.
- **객관식**: 선택이 실제 `if` 분기로 forward에 반영되고, 오답 선택 시 골든/미니검증이 **실제로 실패**함
  (PE·EncoderLayer·greedy로 실증 완료). 미선택("선택하세요") 시 friendly 안내.
- **캡스톤 게이트**: 학습 후 `final_loss < 0.5` + 학습 문장 번역 정확 일치 → 앞 빈칸이 모두 정답일 때만 통과.

## ⚠️ 골든 텐서와 Colab torch 버전 (롤아웃 전 필독)
- 골든은 **PyTorch 2.6.0(CPU)** 에서 계산했습니다. PE·attention·causal·split 골든은 순수 연산/고정 입력이라
  버전 독립입니다. **EncoderLayer/DecoderLayer 골든은 `torch.manual_seed(0)` 랜덤 init 에 의존**합니다.
- `nn.Linear` init(`kaiming_uniform_`)과 CPU RNG(MT19937)는 버전 간 안정적이라 실무상 문제없지만,
  **롤아웃 전 실제 Colab 런타임에서 `_answers.ipynb`를 [모두 실행]** 하여 모든 `✅`가 통과하는지 1회
  확인하시길 권장합니다. 만약 Colab torch 버전이 달라 오탐이 나면, Colab에서 나온 값으로
  EncoderLayer/DecoderLayer 골든만 갱신하세요(atol=1e-3).

## 학생본 재생성 / 드리프트 방지
- 두 노트북은 **단일 소스 빌더 `prompts/build_notebooks.py`** 에서 생성되어 빈칸 외 셀 구조가 동일합니다.
  수정 시 개별 `.ipynb`를 직접 고치지 말고 빌더를 고친 뒤 `python prompts/build_notebooks.py` 로 두 노트북을
  함께 재생성하세요(드리프트 방지). 빌더는 골든 텐서·정답/학생 빈칸 쌍을 모두 보유합니다.
- 데이터 재현 해시: 학습 100문장 SHA-256[:12] = `ed82e8d012d0` (리포 `data/ko_en_pairs.txt`와 일치).
  글로서리를 바꾸면 `data/build_dataset.py`로 새 해시를 구해 데이터 셀 assert 값을 갱신하세요.

## 채점 기준 (colab-guide §8)
- 빈칸(주관식·객관식) 정답 여부 + 노트북 전체 완주(6개 항목 실행 완료, 마지막 `🎉` 도달) 함께 평가.
- 순회 지도: 학생이 막히면 assert 실패 메시지의 힌트를 함께 읽어 유도.

## public repo 제외 목록
```
transformer_translate_colab_answers.ipynb   # 정답본
INSTRUCTOR_NOTES.md                          # 본 문서
prompts/                                     # 내부 설계 프롬프트·가이드
```
