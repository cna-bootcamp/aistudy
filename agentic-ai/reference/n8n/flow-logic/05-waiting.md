# 대기 (Waiting)

대기를 사용하면 workflow 실행을 중간에 일시 중지한 다음 동일한 데이터로 workflow가 중단된 지점에서 재개할 수
있음. 서비스에 대한 호출을 속도 제한하거나 외부 이벤트가 완료될 때까지 기다려야 하는 경우 유용함.
지정된 기간 동안 대기하거나 webhook가 발생할 때까지 대기 가능

## 사용법

workflow를 대기시키려면 Wait node를 사용함. 자세한 사용법은 node 문서 참조

n8n은 Rate limiting 및 외부 이벤트 대기의 기본 예제가 포함된 workflow 템플릿을 제공함
