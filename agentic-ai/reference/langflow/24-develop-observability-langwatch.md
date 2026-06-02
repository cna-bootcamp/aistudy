# LangWatch

[LangWatch](https://app.langwatch.ai/): 올인원 LLMOps 플랫폼.
모니터링, 관찰성, 분석, 평가 및 알림 기능 제공.
사용자 인사이트를 얻고 LLM 워크플로우 개선 지원.

## Integrate LangWatch observability

LangWatch API 키를 Langflow 환경 변수로 추가하여 통합.

### 설정 단계

1. LangWatch 계정에서 API 키 획득

2. Langflow `.env` 파일에 키 추가:
   ```bash
   LANGWATCH_API_KEY="API_KEY_STRING"
   ```

   **터미널에서 직접 설정 (대안):**
   ```bash
   export LANGWATCH_API_KEY="API_KEY_STRING"
   ```

3. `.env` 파일 수정 시 Langflow 재시작:
   ```bash
   langflow run --env-file .env
   ```

4. Flow 실행

5. LangWatch 대시보드에서 모니터링 및 관찰성 확인

## Use the LangWatch Evaluator

Flow에서 **LangWatch Evaluator** 컴포넌트 사용 가능.

**기능:**
- LangWatch의 평가 엔드포인트를 사용하여 모델 성능 평가

**위치:**
- **LangWatch** [번들](/components-bundle-components)에서 사용 가능

## 환경 변수 요약

| 변수 | 설명 |
|------|------|
| `LANGWATCH_API_KEY` | LangWatch API 키 |

## See also

- [LangWatch](https://app.langwatch.ai/)
- [Bundle components](/components-bundle-components)
