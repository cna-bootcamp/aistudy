# Write File

Langflow 1.7.0에서 **Save File**에서 **Write File**로 이름 변경.

다른 컴포넌트에서 생성된 데이터가 포함된 파일 생성.
여러 파일 형식 지원, [Langflow 스토리지](/memory), AWS S3, Google Drive, 로컬 파일 시스템에 저장 가능.

## Flow에서 사용

1. **다른 컴포넌트의 출력 연결:**
   - `DataFrame`, `Data`, `Message` 출력을 **Write File** 컴포넌트의 **Input** 포트에 연결
   - 동일한 출력을 여러 Write File 컴포넌트에 연결하여 여러 파일 생성, 다른 형식으로 저장, 여러 위치에 저장 가능

2. **Storage Location 선택:**
   - **Local**, **AWS**, **Google Drive** 선택
   - 필요 시 클라우드 제공자 자격 증명 입력
   - 참조: [Configure file storage](/concepts-file-management#configure-file-storage)

3. **File Name 입력:**
   파일 이름과 선택적 경로 입력.

   | 위치 | 설명 | 예시 |
   |------|------|------|
   | **기본 위치** | 파일 이름만 제공 시 Langflow 데이터 디렉토리에 저장 | macOS: `~/Library/Caches/langflow/data` |
   | **하위 디렉토리** | 경로를 File Name에 추가. 존재하지 않는 하위 디렉토리는 자동 생성 | `files/my_file` → `/data/files/my_file` |
   | **절대/상대 경로** | 환경 또는 로컬 파일 스토리지의 다른 위치 지정 | `~/Desktop/my_file` |

   > **Note**: 파일 이름에 확장자 포함하지 않음. 포함 시 파일 이름의 일부로 처리되며 **File Format**에 영향 없음.

4. **파일 형식 선택:**

   입력 데이터 타입에 따라 사용 가능한 형식 다름:

   | 입력 타입 | 사용 가능한 형식 |
   |----------|-----------------|
   | `DataFrame` | CSV (기본값), Excel (`openpyxl` 의존성 필요), JSON (대체 기본값), Markdown |
   | `Data` | CSV, Excel (`openpyxl` 의존성 필요), JSON (기본값), Markdown |
   | `Message` | TXT, JSON (기본값), Markdown |

   > **Warning - 덮어쓰기 허용:**
   > 동일한 파일 이름, 경로, 확장자를 가진 여러 Write File 컴포넌트가 있으면 가장 최근 실행 데이터만 파일에 포함.
   > Langflow는 일치하는 파일이 이미 존재해도 덮어쓰기를 차단하지 않음.
   > 의도치 않은 덮어쓰기 방지를 위해 고유한 파일 이름과 경로 사용.

5. **테스트:**
   - **Run component** 클릭
   - **Inspect output**으로 파일이 저장된 경로 확인

## 출력

원본 데이터 타입, 파일 이름 및 확장자, File Name 파라미터 기반 절대 경로가 포함된 `Message` 출력.

```
DataFrame saved successfully as 'my_file.csv' at /Users/user.name/Library/Caches/langflow/data/my_file.csv
```

하위 디렉토리 또는 다른 비기본 경로가 포함된 경우:
```
DataFrame saved successfully as '/Users/user.name/Desktop/my_file.csv' at /Users/user.name/Desktop/my_file.csv
```

**(선택)** 저장된 파일을 Flow에서 사용하려면 API 호출 또는 다른 컴포넌트로 주어진 경로에서 파일 검색 필요.

