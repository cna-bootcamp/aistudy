# Cloud 데이터 관리

n8n Cloud에서 데이터를 관리, 백업 및 복원하는 방법

## 데이터 유형

### 워크플로우 데이터
- 워크플로우 정의 및 설정
- 노드 구성
- 연결 정보
- 버전 히스토리

### 실행 데이터
- 실행 로그
- 입력/출력 데이터
- 오류 정보
- 실행 시간 및 상태

### 자격 증명
- API 키
- OAuth 토큰
- 데이터베이스 연결 정보
- 암호화되어 저장

### 사용자 데이터
- 사용자 프로필
- 역할 및 권한
- 활동 로그

## 데이터 보존 정책

### 기본 보존 기간

**워크플로우 데이터:**
- 영구 보존
- 삭제 시 30일 휴지통 보관
- 복원 가능

**실행 데이터:**
```
Starter 플랜: 7일
Pro 플랜: 30일
Enterprise 플랜: 90일 이상 (맞춤 설정 가능)
```

**자격 증명:**
- 수동 삭제 시까지 영구 보존
- 암호화된 상태로 저장

### 보존 기간 설정
```
1. Settings > Workspace Settings
2. Data Retention 섹션
3. Execution Data Retention 설정:
   - Keep for: 일수 선택
   - Auto-delete: 활성화/비활성화
4. Save Changes
```

## 데이터 백업

### 자동 백업
```
n8n Cloud 자동 백업 기능:
- 일일 백업 자동 수행
- 지역별 복제
- 재해 복구 보장
- 사용자 조작 불필요
```

### 수동 백업 (내보내기)

**전체 워크플로우 내보내기:**
```
1. Workflows 메뉴 이동
2. "..." 메뉴 클릭
3. "Export All" 선택
4. 형식 선택:
   - JSON (전체 데이터)
   - ZIP (워크플로우 + 자격 증명)
5. Download
```

**개별 워크플로우 내보내기:**
```
1. 워크플로우 열기
2. 우측 상단 "..." 메뉴
3. "Download" 선택
4. JSON 파일 저장
```

**실행 데이터 내보내기:**
```
1. Workflow > Executions 탭
2. 내보낼 실행 선택
3. "Export" 버튼 클릭
4. JSON 또는 CSV 형식 선택
5. Download
```

## 데이터 복원

### 워크플로우 가져오기

**파일에서 가져오기:**
```
1. Workflows 메뉴
2. "Import" 버튼 클릭
3. 파일 선택 (.json 또는 .zip)
4. 가져오기 옵션 설정:
   - Overwrite existing: 기존 워크플로우 덮어쓰기
   - Create new: 새 워크플로우로 생성
5. Import
```

**URL에서 가져오기:**
```
1. Workflows > Import
2. "From URL" 탭 선택
3. 워크플로우 JSON URL 입력
4. Import
```

### 삭제된 워크플로우 복원
```
1. Settings > Trash
2. 복원할 워크플로우 찾기
3. "Restore" 버튼 클릭
4. 원래 위치로 복원
```

## 데이터 내보내기 형식

### JSON 형식
```json
{
  "name": "My Workflow",
  "nodes": [
    {
      "name": "Start",
      "type": "n8n-nodes-base.manualTrigger",
      "position": [250, 300],
      "parameters": {}
    }
  ],
  "connections": {},
  "settings": {},
  "staticData": null
}
```

### 자격 증명 포함 내보내기
```
주의사항:
- 민감한 정보 포함
- 암호화된 형식으로 내보내기
- 안전한 위치에 저장
- 공유 시 주의 필요
```

## 데이터 마이그레이션

### Self-hosted에서 Cloud로 마이그레이션

**1단계: 데이터 내보내기**
```bash
# Self-hosted n8n에서
n8n export:workflow --all --output=./workflows.json
n8n export:credentials --all --output=./credentials.json
```

**2단계: Cloud에 가져오기**
```
1. n8n Cloud 로그인
2. Workflows > Import
3. workflows.json 업로드
4. Credentials 수동 재생성 (보안상 이유로)
```

### Cloud에서 Self-hosted로 마이그레이션

**1단계: Cloud에서 내보내기**
```
1. Export All Workflows
2. 자격 증명 정보 별도 기록
```

**2단계: Self-hosted에 가져오기**
```bash
# Self-hosted n8n에서
n8n import:workflow --input=./workflows.json
# 자격 증명 수동 재생성
```

## 데이터 삭제

### 워크플로우 삭제
```
1. 워크플로우 선택
2. Delete 버튼 클릭
3. 확인
4. 30일간 휴지통 보관
5. 30일 후 영구 삭제
```

### 실행 데이터 삭제

**개별 삭제:**
```
1. Workflow > Executions
2. 삭제할 실행 선택
3. "Delete" 클릭
```

**일괄 삭제:**
```
1. Executions 탭
2. 필터 적용 (날짜 범위 등)
3. "Delete All Filtered" 클릭
4. 확인
```

**자동 삭제 설정:**
```
1. Workspace Settings > Data Retention
2. Auto-delete executions older than: X days
3. Save
```

### 자격 증명 삭제
```
주의: 사용 중인 자격 증명 삭제 시 워크플로우 실행 실패 가능

1. Credentials 메뉴
2. 삭제할 자격 증명 선택
3. "Delete" 버튼
4. 사용 중인 워크플로우 확인
5. 확인 후 삭제
```

## 데이터 보안

### 암호화
```
전송 중 데이터:
- TLS 1.2 이상
- 모든 API 통신 암호화

저장 데이터:
- AES-256 암호화
- 자격 증명 이중 암호화
- 암호화 키 분리 관리
```

### 접근 제어
```
- 역할 기반 접근 제어 (RBAC)
- 최소 권한 원칙
- 감사 로그 기록
- IP 화이트리스트 (Enterprise)
```

### 데이터 주권
```
데이터 센터 위치:
- EU (유럽)
- US (미국)
- 설정에서 선택 가능 (Enterprise)

GDPR 준수:
- 데이터 처리 동의
- 데이터 이동권
- 삭제권 보장
```

## 데이터 감사

### 감사 로그 조회
```
1. Settings > Audit Logs
2. 필터 설정:
   - Event Type: Data Access, Modification, Deletion
   - Date Range: 기간 선택
   - User: 사용자별 필터링
3. 로그 조회
```

### 감사 가능 이벤트
```
- 워크플로우 생성/수정/삭제
- 자격 증명 접근/변경
- 실행 데이터 조회
- 데이터 내보내기
- 사용자 권한 변경
```

## 데이터 복구

### 재해 복구
```
n8n Cloud 재해 복구 절차:
1. 자동 감지 및 알림
2. 백업에서 자동 복구
3. 서비스 재개 (일반적으로 1시간 이내)
4. 데이터 무결성 검증
```

### 사용자 실수 복구
```
시나리오: 실수로 워크플로우 삭제

복구 단계:
1. Settings > Trash 이동
2. 삭제된 워크플로우 찾기
3. Restore 클릭
4. 원래 위치로 복원 확인
```

## 데이터 최적화

### 실행 데이터 최적화
```
1. 불필요한 실행 데이터 정리
2. 보존 기간 적절히 설정
3. 큰 데이터는 외부 저장소 활용
4. Binary 데이터 최소화
```

### 워크플로우 최적화
```
- 사용하지 않는 워크플로우 아카이브
- 중복 워크플로우 통합
- 태그를 이용한 조직화
- 정기적인 리뷰 및 정리
```

## 규정 준수

### GDPR
```
- 개인 데이터 식별 및 관리
- 데이터 처리 목적 명시
- 보존 기간 준수
- 삭제 요청 처리
```

### SOC 2
```
- 보안 제어 구현
- 정기 감사
- 변경 관리 절차
- 사고 대응 계획
```

### HIPAA (Healthcare)
```
Enterprise 플랜:
- BAA (Business Associate Agreement) 체결 가능
- PHI 데이터 안전 처리
- 감사 로그 강화
- 암호화 강화
```

## 관련 문서

- [보안 설정](../security/)
- [워크플로우 관리](../workflows/)
- [백업 및 복구 가이드](../backup-restore/)
- [규정 준수](../compliance/)
