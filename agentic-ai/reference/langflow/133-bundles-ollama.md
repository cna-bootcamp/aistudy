# Ollama

**Bundles**는 Langflow와 특정 서드파티 통합을 지원하는 커스텀 컴포넌트 포함

본 페이지는 **Ollama** 번들에서 사용 가능한 컴포넌트 설명

Ollama 기능에 대한 자세한 내용은 [Ollama 문서](https://ollama.com/) 참조

## Ollama 텍스트 생성

[Ollama 언어 모델](https://ollama.com/library)을 사용하여 텍스트 생성

Langflow를 로컬에서 실행 중인 Ollama 서버에 연결하고 모델 선택:

1. 플로우에 **Ollama** 컴포넌트 추가
2. **Base URL** 필드에 로컬에서 실행 중인 Ollama 서버 주소 입력
   이 값은 Ollama의 `OLLAMA_HOST` 환경 변수로 설정
   기본 Base URL: `http://127.0.0.1:11434`
3. 연결이 설정되면 **Model Name** 필드에서 모델 선택 (예: `llama3.2:latest`)
   서버의 모델 목록을 새로고침하려면 **Refresh** 클릭
4. (선택 사항) temperature, max tokens 등 추가 파라미터 구성하려면 컴포넌트 헤더 메뉴에서 **Controls** 클릭
5. **Ollama** 컴포넌트를 플로우의 다른 컴포넌트에 연결
   언어 모델 컴포넌트는 **Model Response** (`Message`) 또는 **Language Model** (`LanguageModel`) 출력 가능
   다른 LLM 기반 컴포넌트(예: **Agent**, **Smart Transform**)의 LLM으로 Ollama 모델을 사용하려면 **Language Model** 출력 사용
   자세한 내용은 [Language model components](https://docs.langflow.org/components-models) 참조

### 플로우 예시

다음 예시는 `LanguageModel` 출력을 사용하여 [Agent 컴포넌트](https://docs.langflow.org/components-agents)의 LLM으로 Ollama 모델 사용

![Ollama component used as the LLM in an agent flow](https://docs.langflow.org/assets/images/component-ollama-model-00cbcbb06b64bebeb27c9b0092f62c59.png)

## Ollama Embeddings

[Ollama 임베딩 모델](https://ollama.com/search?c=embedding)을 사용하여 임베딩 생성

Langflow를 로컬에서 실행 중인 Ollama 서버에 연결하고 임베딩 모델 선택:

1. 플로우에 **Ollama Embeddings** 컴포넌트 추가
2. **Ollama Base URL** 필드에 로컬에서 실행 중인 Ollama 서버 주소 입력
   이 값은 Ollama의 `OLLAMA_HOST` 환경 변수로 설정
   기본 Base URL: `http://127.0.0.1:11434`
3. 연결이 설정되면 **Ollama Model** 필드에서 모델 선택 (예: `all-minilm:latest`)
   서버의 모델 목록을 새로고침하려면 **Refresh** 클릭
4. (선택 사항) temperature, max tokens 등 추가 파라미터 구성하려면 컴포넌트 헤더 메뉴에서 **Controls** 클릭
   사용 가능한 파라미터는 선택한 모델에 따라 다름
5. **Ollama Embeddings** 컴포넌트를 플로우의 다른 컴포넌트에 연결
   플로우에서 임베딩 모델 컴포넌트 사용에 대한 자세한 내용은 [Embedding model components](https://docs.langflow.org/components-embedding-models) 참조

### 플로우 예시

다음 예시는 PDF 파일에서 추출한 텍스트 청크의 임베딩을 생성하고, 임베딩과 청크를 Chroma DB 벡터 스토어에 저장

![Ollama Embeddings component in an embedding generation flow](https://docs.langflow.org/assets/images/component-ollama-embeddings-chromadb-00cbcbb06b64bebeb27c9b0092f62c59.png)
