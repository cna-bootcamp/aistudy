# Deploy Langflow with Nginx and SSL

Linux 서버에서 Nginx를 리버스 프록시로, Let's Encrypt로 SSL 인증서를,
Certbot으로 자동 인증서 관리를 사용하여 Langflow 배포.

**장점:**
- 사용자와 Langflow 서버 간 모든 통신 암호화
- 민감한 데이터를 도청 및 변조로부터 보호
- Certbot을 통한 자동 인증서 관리로 수동 SSL 설정 복잡성 제거

## Prerequisites

- Ubuntu 또는 Debian 기반 Linux 서버 (듀얼 코어 CPU, 최소 2GB RAM)
- 외부 DNS 관리 접근이 가능한 도메인 이름
- 서버의 외부 IP 주소를 가리키는 DNS 레코드 설정

**DNS 레코드 예시:**
```
Type: A
Name: langflow.example.com
Value: 203.0.113.1
```

## Connect to your server with SSH

1. **SSH 키 생성:**
   ```bash
   ssh-keygen -t ed25519 -C "DANA@EXAMPLE.COM"
   ```

2. **공개 키 복사:**
   ```bash
   cat ~/Downloads/host-lf.pub | pbcopy
   ```

3. **서버에 SSH 키 추가:**
   서버 생성 시 또는 클라우드 제공자 제어판에서 추가

4. **SSH로 서버 연결:**
   ```bash
   ssh -i PATH_TO_PRIVATE_KEY/PRIVATE_KEY_NAME root@SERVER_IP_ADDRESS
   ```

5. **키 지문 확인 시 `yes` 입력**

## Install Langflow on your server

1. **시스템 패키지 업데이트:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Python 및 pip 설치:**
   ```bash
   sudo apt install python3 python3-pip python3-venv -y
   ```

3. **uv 설치:**
   ```bash
   pip install uv
   ```

4. **가상 환경 생성:**
   ```bash
   uv venv langflow-venv
   source langflow-venv/bin/activate
   ```

5. **Langflow 설치:**
   ```bash
   uv pip install langflow
   ```

6. **(선택) Langflow 시작:**
   ```bash
   uv run langflow run --host 127.0.0.1 --port 7860 &
   ```

## Install Nginx

Nginx: 외부 요청을 받아 Langflow 서버로 전달하는 리버스 프록시.
SSL 종료, 로드 밸런싱, 보안 기능 포함.

1. **Nginx 설치:**
   ```bash
   sudo apt install nginx -y
   ```

2. **Nginx 시작 및 활성화:**
   ```bash
   sudo systemctl start nginx
   sudo systemctl enable nginx
   ```

3. **Nginx 설정 파일 생성:**
   ```bash
   sudo nano /etc/nginx/sites-available/DOMAIN_NAME
   ```

4. **설정 파일 내용:**
   ```nginx
   server {
       listen 80;
       server_name DOMAIN_NAME;

       # 파일 업로드를 위한 클라이언트 본문 크기 증가
       client_max_body_size 100M;

       location / {
           proxy_pass http://127.0.0.1:7860/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;

           # WebSocket 지원
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";

           # 장시간 실행 Flow를 위한 타임아웃 설정
           proxy_connect_timeout 60s;
           proxy_send_timeout 60s;
           proxy_read_timeout 300s;

           # 버퍼 설정
           proxy_buffering off;
           proxy_request_buffering off;
       }
   }
   ```

5. **사이트 설정 활성화 (심볼릭 링크 생성):**
   ```bash
   sudo ln -s /etc/nginx/sites-available/DOMAIN_NAME /etc/nginx/sites-enabled/DOMAIN_NAME
   ```

6. **Nginx 설정 구문 검사:**
   ```bash
   sudo nginx -t
   ```

7. **Nginx 재시작:**
   ```bash
   sudo systemctl restart nginx
   ```

## Install Certbot and obtain SSL certificates

Certbot: Let's Encrypt에서 SSL 인증서를 자동 획득하고 Nginx에 설정.

1. **Certbot 및 Nginx 플러그인 설치:**
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   ```

2. **SSL 인증서 획득:**
   ```bash
   sudo certbot --nginx -d DOMAIN_NAME
   ```

   **성공 시 출력:**
   ```
   Successfully received certificate.
   Certificate is saved at: /etc/letsencrypt/live/DOMAIN_NAME/fullchain.pem
   Key is saved at: /etc/letsencrypt/live/DOMAIN_NAME/privkey.pem
   ```

   > **Note**: `--nginx` 옵션 사용 시 Certbot이 자동으로 Nginx 설정에
   > `ssl_certificate` 및 `ssl_certificate_key` 경로 삽입.

3. **가상 환경에서 Langflow 시작:**
   ```bash
   source langflow-venv/bin/activate
   uv run langflow run --host 127.0.0.1 --port 7860 &
   ```

4. **배포 테스트:**
   브라우저에서 `https://DOMAIN_NAME`으로 이동

5. **SSL 인증서 확인:**
   - URL이 `https://`인지 확인 (`http://` 아님)
   - 주소 표시줄에 🔒 잠금 아이콘 표시
   - 잠금 아이콘 클릭하여 SSL 인증서 상세 정보 확인

## See also

- [Deploy Langflow on a remote server with Caddy](/deployment-caddyfile)
- [Deploy Langflow on Docker](/deployment-docker)

