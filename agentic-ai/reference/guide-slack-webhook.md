# Slack Webhook 설정 가이드

MCP Sampling 실습(`15.MCP.md § 3.3`)에서 Slack 알림을 발송하기 위한 워크스페이스·채널·웹훅 설정 절차.

---

## 1. 워크스페이스 생성

1. 브라우저에서 [https://slack.com/get-started](https://slack.com/get-started) 접속
2. **Create a Workspace** 클릭
3. 이메일 주소 입력 → 인증 코드 확인
4. 워크스페이스 이름 입력: **`voc-inquiry`**
5. 이름과 프로필 사진 추가(옵션)
6. 팀원 초대는 스킵
7. 무료 플랜으로 시작
8. 조직 규모 등 선택하는 박스 나오면 상단 우측의 'X' 눌러 닫음

> 생성 완료 후 `voc-inquiry.slack.com`으로 접근 가능.

---

## 2. 채널 생성

1. 왼쪽 사이드바 **Channels** 섹션 하단 **+** 클릭 → **Create a channel**
2. 채널 이름 입력 → **Create**

| 채널명 | 용도 |
|--------|------|
| `payment` | 결제 문의 알림 |
| `shipping` | 배달 문의 알림 |
| `general` | 일반 문의 알림 |

> `general` 채널은 Slack이 기본 생성하는 경우가 있음. 없으면 동일하게 추가.

---

## 3. Slack 앱 생성 및 Incoming Webhook 활성화

웹훅은 **앱(App)** 단위로 관리됨. 채널 3개에 대해 웹훅 URL 3개를 발급받기 위해 앱 1개를 생성.

### 3.1 앱 생성

1. [https://api.slack.com/apps](https://api.slack.com/apps) 접속 (Slack 계정 로그인 필요)
2. **Create New App** 클릭
3. **From scratch** 선택
4. App Name 입력: `voc-inquiry-bot` (임의 설정 가능)
5. Workspace: **voc-inquiry** 선택 → **Create App**

### 3.2 Incoming Webhooks 활성화

1. 앱 설정 페이지 좌측 메뉴 → **Incoming Webhooks** 클릭
2. **Activate Incoming Webhooks** 토글을 **On**으로 전환

---

## 4. 채널별 웹훅 URL 발급

**Incoming Webhooks** 페이지 하단 **Add New Webhook** 버튼을 클릭하여 채널마다 반복 수행.

### `payment` 채널 웹훅
1. **Add New Webhook** 클릭
2. 채널 선택 창에서 `#payment` 선택 → **Authorize**

### `shipping` 채널 웹훅

1. **Add New Webhook** 클릭
2. `#shipping` 선택 → **Authorize**

### `general` 채널 웹훅

1. **Add New Webhook** 클릭
2. `#general` 선택 → **Authorize**

> 완료 후 **Webhook URL** 섹션에 3개의 URL 목록 확인 가능

---

## 5. .env 파일 설정

발급받은 웹훅 URL 3개를 `hands-on/.env` 파일에 추가.

```dotenv
# Slack Webhook URLs (voc-inquiry workspace)
SLACK_WEBHOOK_PAYMENT=https://hooks.slack.com/services/T.../B.../...
SLACK_WEBHOOK_SHIPPING=https://hooks.slack.com/services/T.../B.../...
SLACK_WEBHOOK_GENERAL=https://hooks.slack.com/services/T.../B.../...
```

> 웹훅 URL은 비밀 키와 동일하게 취급. `.env`는 `.gitignore`에 포함되어야 함.

---

## 6. 웹훅 동작 확인 (선택)

발급 후 curl로 간단히 동작 검증 가능.

```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test webhook for payment channel"}' \
  $SLACK_WEBHOOK_PAYMENT
```

`ok` 응답이 오면 정상. Slack `#payment` 채널에 메시지 수신 확인.

---

## 7. 참고

- Slack 앱 관리 페이지: [https://api.slack.com/apps](https://api.slack.com/apps)
- Incoming Webhooks 공식 문서: [https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks)
- 실습 예제: `hands-on/15.mcp/sampling/`
