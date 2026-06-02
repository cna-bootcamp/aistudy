# Streamlit 주요 명령어 정리

- [Streamlit 주요 명령어 정리](#streamlit-주요-명령어-정리)
  - [1. 텍스트 출력](#1-텍스트-출력)
  - [2. 입력 위젯](#2-입력-위젯)
    - [기본 입력](#기본-입력)
    - [텍스트/숫자 입력](#텍스트숫자-입력)
    - [날짜/시간/파일](#날짜시간파일)
  - [3. 데이터 표시](#3-데이터-표시)
  - [4. 차트](#4-차트)
  - [5. 레이아웃](#5-레이아웃)
    - [컬럼](#컬럼)
    - [탭](#탭)
    - [확장 패널](#확장-패널)
    - [컨테이너](#컨테이너)
    - [사이드바](#사이드바)
  - [6. 상태 메시지](#6-상태-메시지)
  - [7. 세션 상태 (Session State)](#7-세션-상태-session-state)
  - [8. 폼 (Form)](#8-폼-form)
  - [9. 채팅 UI](#9-채팅-ui)
  - [10. 캐싱](#10-캐싱)
  - [11. 페이지 설정](#11-페이지-설정)
  - [12. 앱 실행](#12-앱-실행)
  - [참고 자료](#참고-자료)

Streamlit: Python 기반 데이터 앱 신속 개발 프레임워크.

---

## 1. 텍스트 출력

```python
import streamlit as st

# 제목
st.title("앱 제목")
st.header("헤더")
st.subheader("서브헤더")

# 텍스트
st.text("일반 텍스트")
st.markdown("**마크다운** 지원")
st.write("범용 출력 함수 - 거의 모든 타입 출력 가능")
st.caption("작은 캡션 텍스트")
st.code("print('코드 블록')", language="python")
st.latex(r"E = mc^2")
```

[Top](#streamlit-주요-명령어-정리)

---

## 2. 입력 위젯

### 기본 입력

```python
# 버튼
if st.button("클릭"):
    st.write("버튼 클릭됨!")

# 체크박스
agree = st.checkbox("동의합니다")

# 토글
on = st.toggle("활성화")

# 라디오 버튼
choice = st.radio("선택하세요", ["옵션1", "옵션2", "옵션3"])

# 선택박스
option = st.selectbox("하나 선택", ["A", "B", "C"])

# 다중 선택
options = st.multiselect("여러 개 선택", ["사과", "바나나", "오렌지"])
```

### 텍스트/숫자 입력

```python
# 텍스트 입력
name = st.text_input("이름을 입력하세요")
name = st.text_input("이름", key="name")  # key로 session_state 접근 가능

# 텍스트 영역
text = st.text_area("내용을 입력하세요")

# 숫자 입력
number = st.number_input("숫자 입력", min_value=0, max_value=100, value=50)

# 슬라이더
value = st.slider("값 선택", 0, 100, 50)
```

### 날짜/시간/파일

```python
# 날짜 입력
date = st.date_input("날짜 선택")

# 시간 입력
time = st.time_input("시간 선택")

# 파일 업로드
uploaded_file = st.file_uploader("파일 선택", type=["csv", "txt"])

# 색상 선택
color = st.color_picker("색상 선택", "#00FF00")
```

[Top](#streamlit-주요-명령어-정리)

---

## 3. 데이터 표시

```python
import pandas as pd

df = pd.DataFrame({"A": [1, 2, 3], "B": [4, 5, 6]})

# 데이터프레임 (인터랙티브)
st.dataframe(df)
st.dataframe(df.style.highlight_max(axis=0))  # 스타일 적용

# 테이블 (정적)
st.table(df)

# 데이터 편집기
edited_df = st.data_editor(df)

# 메트릭
st.metric("온도", "25°C", delta="2°C")

# JSON
st.json({"name": "홍길동", "age": 30})
```

[Top](#streamlit-주요-명령어-정리)

---

## 4. 차트

```python
import pandas as pd
import numpy as np

chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])

# 기본 차트
st.line_chart(chart_data)
st.area_chart(chart_data)
st.bar_chart(chart_data)
st.scatter_chart(chart_data)

# 지도
map_data = pd.DataFrame(
    np.random.randn(100, 2) / [50, 50] + [37.5, 127],
    columns=["lat", "lon"]
)
st.map(map_data)
```

[Top](#streamlit-주요-명령어-정리)

---

## 5. 레이아웃

### 컬럼

```python
col1, col2, col3 = st.columns(3)

col1.write("첫 번째 컬럼")
col2.write("두 번째 컬럼")
col3.write("세 번째 컬럼")

# with 구문 사용
with col1:
    st.button("버튼1")
```

### 탭

```python
tab1, tab2 = st.tabs(["탭1", "탭2"])

with tab1:
    st.write("탭1 내용")

with tab2:
    st.write("탭2 내용")
```

### 확장 패널

```python
with st.expander("자세히 보기"):
    st.write("숨겨진 내용")
```

### 컨테이너

```python
container = st.container()
container.write("컨테이너 내용")

# empty로 동적 업데이트
placeholder = st.empty()
placeholder.write("나중에 업데이트됨")
placeholder.markdown("**새 내용**")  # 이전 내용 대체
```

### 사이드바

```python
st.sidebar.title("사이드바")
st.sidebar.button("사이드바 버튼")

# with 구문
with st.sidebar:
    st.selectbox("선택", ["A", "B"])
```

[Top](#streamlit-주요-명령어-정리)

---

## 6. 상태 메시지

```python
st.success("성공!")
st.error("에러 발생!")
st.warning("경고!")
st.info("정보")
st.exception(Exception("예외 발생"))

# 스피너
with st.spinner("처리 중..."):
    time.sleep(2)
st.success("완료!")

# 프로그레스 바
progress = st.progress(0)
for i in range(100):
    progress.progress(i + 1)

# 토스트 메시지
st.toast("알림 메시지!")

# 풍선/눈
st.balloons()
st.snow()
```

[Top](#streamlit-주요-명령어-정리)

---

## 7. 세션 상태 (Session State)

```python
# 초기화
if "count" not in st.session_state:
    st.session_state.count = 0

# 읽기
st.write(st.session_state.count)

# 업데이트
st.session_state.count += 1
st.session_state["count"] = 10  # 딕셔너리 방식도 가능

# 위젯과 연결
st.text_input("이름", key="user_name")
st.write(st.session_state.user_name)  # 위젯 값 접근
```

[Top](#streamlit-주요-명령어-정리)

---

## 8. 폼 (Form)

```python
with st.form("my_form"):
    name = st.text_input("이름")
    email = st.text_input("이메일")
    age = st.number_input("나이", min_value=0)

    submitted = st.form_submit_button("제출")

    if submitted:
        st.write(f"이름: {name}, 이메일: {email}, 나이: {age}")
```

[Top](#streamlit-주요-명령어-정리)

---

## 9. 채팅 UI

```python
# 채팅 메시지 표시
with st.chat_message("user"):
    st.write("안녕하세요!")

with st.chat_message("assistant"):
    st.write("무엇을 도와드릴까요?")

# 채팅 입력
prompt = st.chat_input("메시지를 입력하세요")
if prompt:
    st.write(f"입력: {prompt}")
```

[Top](#streamlit-주요-명령어-정리)

---

## 10. 캐싱

```python
# 데이터 캐싱 (DataFrame, API 응답 등)
@st.cache_data
def load_data():
    return pd.read_csv("data.csv")

# 리소스 캐싱 (DB 연결, ML 모델 등)
@st.cache_resource
def load_model():
    return load_my_model()
```

[Top](#streamlit-주요-명령어-정리)

---

## 11. 페이지 설정

```python
st.set_page_config(
    page_title="앱 제목",
    page_icon="🚀",
    layout="wide",  # "centered" 또는 "wide"
    initial_sidebar_state="expanded"  # "auto", "expanded", "collapsed"
)
```

[Top](#streamlit-주요-명령어-정리)

---

## 12. 앱 실행

```bash
# 기본 실행
streamlit run app.py

# 포트 지정
streamlit run app.py --server.port 8080

# 브라우저 자동 열기 비활성화
streamlit run app.py --server.headless true
```

[Top](#streamlit-주요-명령어-정리)

---

## 참고 자료

- [Streamlit 공식 문서](https://docs.streamlit.io/)
- [API Reference](https://docs.streamlit.io/develop/api-reference)
- [Cheat Sheet](https://docs.streamlit.io/develop/quick-reference/cheat-sheet)

[Top](#streamlit-주요-명령어-정리)
