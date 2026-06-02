# Deploy Langflow on a remote server

원격 서버에 [Docker](https://docs.docker.com/)로 Langflow 설정하고
[Caddy](https://caddyserver.com/docs/)로 보안 웹 액세스 설정.

## Prerequisites

- 듀얼 코어 CPU 및 최소 2GB RAM 서버
- 예시: [Hetzner cloud](https://www.hetzner.com/) 호스팅

## Connect to your remote server with SSH

1. **SSH 키 생성:**
   ```bash
   ssh-keygen -t ed25519 -C "DANA@EXAMPLE.COM"
   ```
   `DANA@EXAMPLE.COM`을 SSH 키와 연결할 이메일 주소로 교체.

2. **공개 키 복사:**
   ```bash
   cat ~/Downloads/host-lf.pub | pbcopy
   ```

3. **원격 서버에 SSH 키 추가:**
   서버 설정에서 **Server** → **SSH keys** 선택하여 SSH 키 추가.

4. **SSH로 서버 연결:**
   ```bash
   ssh -i PATH_TO_PRIVATE_KEY/PRIVATE_KEY_NAME root@SERVER_IP_ADDRESS
   ```

   | 변수 | 설명 |
   |------|------|
   | `PATH_TO_PRIVATE_KEY/PRIVATE_KEY_NAME` | 서버에 추가한 공개 키와 일치하는 개인 SSH 키 파일 경로 |
   | `SERVER_IP_ADDRESS` | 서버의 IP 주소 |

5. **키 지문 확인 시 `yes` 입력**

**성공 시 출력 예시:**
```
System information as of Mon May 19 04:34:44 PM UTC 2025

System load: 0.0             Processes: 129
Usage of /: 1.5% of 74.79GB  Users logged in: 0
Memory usage: 5%             IPv4 address for eth0: 5.161.250.132
Swap usage: 0%               IPv6 address for eth0: 2a01:4ff:f0:4de7::1
```

## Deploy Langflow on your server

로컬 머신이 SSH로 원격 서버에 연결된 후 Docker 설치, `docker-compose.yml` 파일 생성,
Caddy 리버스 프록시로 공개 서비스.

1. **Docker 설치:**
   ```bash
   snap install docker
   ```
   > Ubuntu가 아닌 경우 [공식 Docker 설치 가이드](https://docs.docker.com/get-started/get-docker/) 참조.

2. **docker-compose.yml 파일 생성:**
   ```bash
   touch docker-compose.yml && nano docker-compose.yml
   ```

3. **docker-compose.yml 내용 추가:**

   > **Tip**: [host-langflow](https://github.com/datastax/host-langflow) 리포지토리에서
   > `docker-compose.yml` 및 `Caddyfile`의 미리 빌드된 복사본 제공.

   ```yaml
   version: "3.8"

   services:
     langflow:
       image: langflowai/langflow:latest
       ports:
         - "7860:7860"
       environment:
         - LANGFLOW_HOST=0.0.0.0
         - LANGFLOW_PORT=7860

     caddy:
       image: caddy:latest
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./Caddyfile:/etc/caddy/Caddyfile
         - caddy_data:/data
         - caddy_config:/config
       depends_on:
         - langflow

   volumes:
     caddy_data:
     caddy_config:
   ```

4. **Caddyfile 생성:**
   ```bash
   touch Caddyfile && nano Caddyfile
   ```

5. **Caddyfile 내용 추가:**

   포트 80에서 수신하고 모든 요청을 Langflow 서비스 포트 7860으로 전달:
   ```
   :80 {
       reverse_proxy langflow:7860
   }
   ```

6. **서버 배포:**
   ```bash
   docker-compose up
   ```

   `Welcome to Langflow` 메시지 표시 시 Docker 네트워크 내부에서
   `http://0.0.0.0:7860`으로 Langflow 실행 및 접근 가능.

7. **공용 인터넷 접근:**
   서버의 공용 IP 주소로 이동 (예: `http://5.161.250.132`).
   HTTPS가 아직 활성화되지 않아 HTTP 사용.

8. **(권장) HTTPS 활성화:**

   a. 도메인의 A 레코드를 서버 IP 주소로 설정:
   ```
   Type: A
   Name: langflow
   Value: 5.161.250.132  # 서버 IP 주소로 설정
   ```

   b. 서버 중지

   c. Caddyfile 수정 (포트 443 추가):
   ```
   :80, :443 {
       reverse_proxy langflow:7860
   }
   ```

   d. 서버 시작

   사용자가 도메인 방문 시 Caddy가 트래픽을 인식하고
   보안 암호화 연결로 자동 라우팅.

9. **SSH 세션 종료:**
   ```bash
   exit
   ```

## See also

- [Containerize a Langflow application](/develop-application): 로컬 Flow를 커스텀 Docker 이미지로 패키징
- [How to Host Langflow Anywhere](https://www.youtube.com/watch?v=q4qt5hSnte4): fly.io, Flightcontrol.dev 배포 포함 단계별 가이드

