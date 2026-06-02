# Jina

**번들 페이지 없음**

요청된 URL `https://docs.langflow.org/bundles-jina`는 존재하지 않음 (404 오류)

Langflow 공식 문서에서 Jina 관련 번들을 찾을 수 없음

---

## Jina AI 개요

Jina AI는 다음 기능을 제공하는 AI 검색 및 임베딩 플랫폼:

### 주요 기능
- **검색**: 웹 검색 및 콘텐츠 크롤링
- **임베딩**: 텍스트/이미지 임베딩 생성
- **리랭킹**: 검색 결과 재정렬
- **리더**: 웹 페이지 콘텐츠 추출

---

## 대체 방법

Jina AI 기능을 Langflow에서 사용하려면:

### 1. API Request 컴포넌트 사용
Langflow의 **API Request** 코어 컴포넌트로 Jina AI API 직접 호출

```
엔드포인트: https://api.jina.ai/v1/embeddings
헤더: Authorization: Bearer {JINA_API_KEY}
```

### 2. Custom Component 생성
Jina AI SDK를 사용한 커스텀 Python 컴포넌트 개발

### 3. 유사 기능 번들 사용
- **OpenAI Embeddings**: 임베딩 생성
- **Cohere Rerank**: 검색 결과 리랭킹
- **DuckDuckGo/Serper**: 웹 검색

---

## Jina AI API 예시

### 임베딩 생성
```bash
curl https://api.jina.ai/v1/embeddings \
  -H "Authorization: Bearer {JINA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "input": ["텍스트 내용"],
    "model": "jina-embeddings-v2-base-en"
  }'
```

### 웹 검색
```bash
curl https://s.jina.ai/{URL}
```

---

## 참조

- [Jina AI 공식 문서](https://jina.ai/docs/)
- [Jina AI Embeddings](https://jina.ai/embeddings/)
- [Langflow API Request 컴포넌트](https://docs.langflow.org/api-request)
- [Langflow Custom Components](https://docs.langflow.org/components-custom-components)
