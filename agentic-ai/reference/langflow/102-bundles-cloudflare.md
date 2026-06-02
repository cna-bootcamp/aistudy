# Cloudflare

**Cloudflare** 번들은 Cloudflare Workers AI와의 통합을 지원하는 컴포넌트 제공.

## Cloudflare Workers AI Embeddings

[Cloudflare Workers AI 모델](https://developers.cloudflare.com/workers-ai/)을 사용하여 임베딩 생성.

Flow에서 임베딩 모델 컴포넌트 사용 방법: [Embedding model components](/components-embedding-models) 참조.

### 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Display Name | 설명 |
|------|--------------|------|
| `account_id` | Cloudflare account ID | (입력) [Cloudflare 계정 ID](https://developers.cloudflare.com/fundamentals/setup/find-account-and-zone-ids/#find-account-id-workers-and-pages) |
| `api_token` | Cloudflare API token | (입력) [Cloudflare API 토큰](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) |
| `model_name` | Model Name | (입력) 임베딩 생성에 [지원되는 모델](https://developers.cloudflare.com/workers-ai/models/#text-embeddings) |
| `strip_new_lines` | Strip New Lines | (입력) 입력 텍스트에서 줄바꿈 제거 여부 |
| `batch_size` | Batch Size | (입력) 각 배치에서 임베딩할 텍스트 수 |
| `api_base_url` | Cloudflare API base URL | (입력) Cloudflare API 기본 URL |
| `headers` | Headers | (입력) 임베딩 생성 API 요청에 대한 추가 헤더 |

