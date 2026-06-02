# Ollama 서버 배포 가이드

## 수동 실행

```bash
# 서버 시작 (기본 포트: 11434)
ollama serve

# 외부 접근 허용 (0.0.0.0 바인딩)
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

## 서버 상태 확인 및 재시작

### Windows (Git Bash)

```bash
# 실행 상태 확인 (Git Bash의 ps는 Windows 프로세스를 표시하지 않으므로 tasklist 사용)
tasklist | grep -i ollama

# API 응답 확인
curl -s http://localhost:11434/api/version

# 서버 중지 (ollama app.exe + ollama.exe 모두 종료)
taskkill //IM "ollama app.exe" //F
taskkill //IM "ollama.exe" //F

# 서버 시작 (트레이 앱으로 실행)
"$LOCALAPPDATA/Programs/Ollama/ollama app.exe" &

# 재시작 (중지 → 시작)
taskkill //IM "ollama app.exe" //F; taskkill //IM "ollama.exe" //F
sleep 2
"$LOCALAPPDATA/Programs/Ollama/ollama app.exe" &
```

> Git Bash에서 `taskkill` 옵션은 `/F`가 아닌 `//F`로 슬래시를 이중으로 사용.
> `$LOCALAPPDATA`는 Git Bash에서 `C:\Users\{사용자}\AppData\Local`로 자동 변환됨.

### Linux (systemd)

```bash
# 실행 상태 확인
systemctl status ollama

# 서버 중지
sudo systemctl stop ollama

# 서버 시작
sudo systemctl start ollama

# 재시작
sudo systemctl restart ollama
```

### macOS

```bash
# 실행 상태 확인
pgrep -l ollama

# 데스크톱 앱으로 설치한 경우: 재시작
pkill ollama
open -a Ollama

# LaunchDaemon으로 등록한 경우: 재시작
sudo launchctl stop com.ollama
sudo launchctl start com.ollama
```

### OS별 재시작 명령 요약

| OS | 프로세스 확인 | 중지 | 시작 | 재시작 |
|----|---------------|------|------|--------|
| **Windows** (Git Bash) | `tasklist \| grep -i ollama` | `taskkill //IM "ollama app.exe" //F`<br>`taskkill //IM "ollama.exe" //F` | `"$LOCALAPPDATA/Programs/Ollama/ollama app.exe" &` | 중지 → `sleep 2` → 시작 |
| **Linux** | `systemctl status ollama` | `sudo systemctl stop ollama` | `sudo systemctl start ollama` | `sudo systemctl restart ollama` |
| **macOS** (앱) | `pgrep -l ollama` | `pkill ollama` | `open -a Ollama` | 중지 → 시작 |
| **macOS** (daemon) | `pgrep -l ollama` | `sudo launchctl stop com.ollama` | `sudo launchctl start com.ollama` | 중지 → 시작 |

## PC 시작 시 자동 실행

### Windows

Ollama 설치 시 기본적으로 시작 프로그램에 자동 등록됨.
수동 확인/설정 방법:

```
# 시작 프로그램 폴더 열기
Win + R → shell:startup → Enter

# Ollama.lnk 바로가기가 있으면 자동 실행 활성화 상태
# 없으면 Ollama 실행 파일의 바로가기를 이 폴더에 추가
```

**자동 실행 제어**:

| 방법 | 절차 |
|------|------|
| 작업 관리자 | Ctrl+Shift+Esc → 시작프로그램 탭 → Ollama 사용/사용 안 함 |
| 시작 폴더 | `shell:startup`에서 Ollama.lnk 추가/삭제 |

> Windows에서 Ollama는 트레이 아이콘으로 백그라운드 실행됨.
> 별도 로그인 없이 부팅 시 자동 시작하려면 Windows 서비스로 등록 필요
> (AlwaysUp 등 서드파티 도구 사용).

### Linux (systemd)

Ollama 공식 설치 스크립트(`curl -fsSL https://ollama.ai/install.sh | sh`) 실행 시
systemd 서비스가 자동 생성됨. 수동 설정 방법:

```ini
# /etc/systemd/system/ollama.service
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
# 환경 변수 설정 (외부 접근 허용 등)
Environment="OLLAMA_HOST=0.0.0.0"

[Install]
WantedBy=default.target
```

```bash
# 서비스 등록 및 시작
sudo systemctl daemon-reload
sudo systemctl enable ollama    # 부팅 시 자동 시작 등록
sudo systemctl start ollama     # 즉시 시작

# 상태 확인
sudo systemctl status ollama

# 자동 시작 해제
sudo systemctl disable ollama
```

**환경 변수 커스터마이징**:

```bash
# systemd 서비스 오버라이드 편집
sudo systemctl edit ollama

# [Service] 섹션에 환경 변수 추가
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
Environment="OLLAMA_ORIGINS=*"
Environment="OLLAMA_NUM_PARALLEL=4"
```

### macOS (launchd)

macOS에서 Ollama 데스크톱 앱 설치 시 기본 자동 시작됨.
헤드리스 서버 또는 커스텀 설정이 필요한 경우 LaunchDaemon 등록:

```xml
<!-- /Library/LaunchDaemons/com.ollama.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ollama</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/ollama</string>
        <string>serve</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>EnvironmentVariables</key>
    <dict>
        <key>OLLAMA_HOST</key>
        <string>0.0.0.0</string>
    </dict>
</dict>
</plist>
```

```bash
# 권한 설정 및 서비스 등록
sudo chown root:wheel /Library/LaunchDaemons/com.ollama.plist
sudo chmod 644 /Library/LaunchDaemons/com.ollama.plist
sudo launchctl load /Library/LaunchDaemons/com.ollama.plist

# 서비스 해제
sudo launchctl unload /Library/LaunchDaemons/com.ollama.plist
```

| 설정 항목 | 설명 |
|-----------|------|
| `RunAtLoad` | true: 부팅 시 자동 시작 |
| `KeepAlive` | true: 비정상 종료 시 자동 재시작 |
| `EnvironmentVariables` | 환경 변수 설정 (OLLAMA_HOST 등) |

### OS별 자동 실행 요약

| OS | 방법 | 기본 자동 실행 | 서비스 관리 명령 |
|----|------|:-:|------|
| **Windows** | 시작 프로그램 폴더 | O (설치 시 등록) | 작업 관리자 → 시작프로그램 |
| **Linux** | systemd | O (공식 스크립트) | `systemctl enable/disable ollama` |
| **macOS** | launchd | O (데스크톱 앱) | `launchctl load/unload` |

## Docker 배포

```dockerfile
# Dockerfile
FROM ollama/ollama:latest

# 모델 사전 다운로드
RUN ollama pull qwen3:8b
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: always           # 컨테이너 자동 재시작
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

volumes:
  ollama_data:
```

> Docker Compose에서 `restart: always` 설정 시
> Docker 서비스가 시작되면 Ollama 컨테이너도 자동 시작됨.
