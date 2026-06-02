# Hugging Face

**Bundles**는 Langflow와 특정 타사 통합을 지원하는 커스텀 컴포넌트를 포함

**Hugging Face** 번들의 컴포넌트는 Hugging Face API 액세스 필요

Hugging Face 컴포넌트가 사용하는 기능에 대한 자세한 내용은
[Hugging Face 문서](https://huggingface.co/docs) 참조

---

## Hugging Face 텍스트 생성

**Hugging Face** 컴포넌트는 Hugging Face API에 요청을 전송하여 지정된 모델로 텍스트 생성
Hugging Face에서 호스팅되는 모델을 위한 호스팅 추론 API 사용
인증 필요

### 출력 타입

이 컴포넌트는 두 가지 출력 타입 지원:

1. **Model Response** (`Message` 타입)
2. **Language Model** (`LanguageModel` 타입)
   - `ChatHuggingFace` 인스턴스로 구성됨
   - Agent 또는 Smart Transform 같은 LLM 기반 컴포넌트에서 Hugging Face 모델을 LLM으로 사용할 때 활용

자세한 내용은 [Language model components](/components-models) 참조

### 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨겨져 있음
컴포넌트 헤더 메뉴의 **Controls**를 통해 모든 파라미터 수정 가능

| Name | Type | Description |
|------|------|-------------|
| model_id | String | Hugging Face Hub의 모델 ID (예: "gpt2", "facebook/bart-large") |
| huggingfacehub_api_token | SecretString | 인증을 위한 [Hugging Face API 토큰](https://huggingface.co/docs/hub/security-tokens) |
| temperature | Float | 출력의 무작위성 제어. 범위: [0.0, 1.0]. 기본값: 0.7 |
| max_new_tokens | Integer | 생성할 최대 토큰 수. 기본값: 512 |
| top_p | Float | Nucleus 샘플링 파라미터. 범위: [0.0, 1.0]. 기본값: 0.95 |
| top_k | Integer | Top-k 샘플링 파라미터. 기본값: 50 |
| model_kwargs | Dictionary | 모델에 전달할 추가 키워드 인수 |

---

## Hugging Face Embeddings Inference

**Hugging Face Embeddings Inference** 컴포넌트는 Hugging Face의 호스팅 모델 또는
로컬에서 호스팅되는 자체 모델로 임베딩 생성

[Hugging Face Inference API 모델](https://huggingface.co/models)을 사용하여 임베딩 생성
로컬 모델을 사용하지 않을 경우 인증 필요

플로우에서 임베딩 모델 컴포넌트 사용에 대한 자세한 내용은
[Embedding model components](/components-embedding-models) 및
[로컬 Hugging Face 임베딩 모델 사용](#로컬-hugging-face-임베딩-모델-사용) 참조

### 파라미터

| Name | Display Name | Info |
|------|--------------|------|
| api_key | API Key | Hugging Face Inference API 액세스를 위한 [Hugging Face API 토큰](https://huggingface.co/docs/hub/security-tokens) (필요 시). 로컬 추론 모델은 API 키 불필요 |
| api_url | API URL | Hugging Face Inference API의 URL |
| model_name | Model Name | 임베딩에 사용할 모델 이름 |

---

## 로컬 Hugging Face 임베딩 모델 사용

로컬 Hugging Face 모델을 **Hugging Face Embeddings Inference** 컴포넌트에 연결하여
플로우에서 사용하는 방법:

### STEP 1. 로컬 모델 실행

[로컬 Hugging Face 임베딩 추론](https://huggingface.co/docs/text-embeddings-inference/local_cpu) 실행

### STEP 2. 플로우 생성

**Vector Store RAG** 템플릿에서 플로우 생성

### STEP 3. 컴포넌트 교체

두 개의 **OpenAI Embeddings** 컴포넌트를 **Hugging Face Embeddings Inference** 컴포넌트로 교체

각 **Embeddings Inference** 컴포넌트의 **Embedding Model** 포트를
해당 **Astra DB** 컴포넌트에 다시 연결

### STEP 4. 벡터 스토어 구성

**Astra DB** 컴포넌트를 Astra 조직에 연결하도록 구성하거나,
두 **Astra DB** 컴포넌트를 다른 벡터 스토어 컴포넌트로 교체

### STEP 5. 로컬 모델 연결

각 **Hugging Face Embeddings Inference** 컴포넌트를 로컬 추론 모델에 연결:

- **Inference Endpoint**: 로컬 추론 모델의 URL 입력
- **API Key**: 로컬 추론의 경우 비워둘 수 있음
- **Model Name**: 자동으로 감지되지 않는 경우 로컬 추론 모델 이름 입력

### STEP 6. 테스트

**Playground**를 클릭한 다음 텍스트를 입력하여 임베딩 생성 테스트

---

## 참조

- [Hugging Face 문서](https://huggingface.co/docs)
- [Hugging Face Hub](https://huggingface.co/models)
- [Hugging Face API 토큰](https://huggingface.co/docs/hub/security-tokens)
- [ChatHuggingFace](https://docs.langchain.com/oss/python/integrations/chat/huggingface)
