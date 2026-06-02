# AI Agent Development Guide

## Overview

This is an **AI agent development guide** focused on training developers in AI, Agile, and Cloud Native Application development. It contains educational examples for LLM API usage, chatbots, text summarization, and speech processing.

**Primary Language**: Python
**Target Audience**: Bootcamp students learning AI agent development

---

## Project Structure

```
aistudy/
├── agentic-ai/examples/    # Main examples directory
│   ├── .env                   # API keys (OPENAI, CLAUDE, GEMINI)
│   ├── chatbot/               # Streamlit chatbot examples
│   ├── multiturn/             # Multi-turn conversation examples
│   ├── pdf/                   # PDF processing examples
│   ├── prompt/                # Prompt engineering examples
│   ├── stt/                   # Speech-to-text examples
│   ├── summary_exaone/        # EXAONE summarization
│   ├── summary_kobart/        # KoBART summarization
│   └── tts/                   # Text-to-speech examples
├── claude/                    # WhisperX audio processing utilities
├── planning/                  # Research documents
└── start-here/                # Beginner materials
```

---

## Build/Run Commands

### Virtual Environment Setup (Per Example)

```bash
# Navigate to example directory
cd agentic-ai/examples/<example_name>

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (macOS/Linux)
source venv/bin/activate
```

### Common Dependencies

```bash
# LLM APIs
pip install openai anthropic google-genai python-dotenv

# Streamlit apps
pip install streamlit

# Local models (EXAONE, KoBART)
pip install torch transformers accelerate sentencepiece

# Audio processing
pip install whisperx torchaudio pyannote.audio
```

### Running Examples

```bash
# Multi-turn chatbot (console)
cd agentic-ai/examples
python multiturn/travel_planner.py

# Streamlit chatbot (web UI)
cd agentic-ai/examples/chatbot
streamlit run travel_planner.py

# Summarization
cd agentic-ai/examples/summary_exaone
python summary.py
```

### No Tests

This repository does not have a test suite. Examples are run manually for educational purposes.

---

## Code Style Guidelines

### Python Standards

- **Version**: Python 3.10+
- **Encoding**: UTF-8 with Korean comment support
- **Docstrings**: Korean docstrings with function/module descriptions

### Import Order

```python
# 1. Standard library
import os
import argparse
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, Union, List

# 2. Third-party libraries
import numpy as np
import pandas as pd
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

# 3. Local imports
from whisperx.audio import load_audio
from whisperx.schema import TranscriptionResult
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Functions | snake_case | `load_input_file()`, `create_chat_session()` |
| Variables | snake_case | `model_name`, `input_text` |
| Constants | UPPER_SNAKE | `SYSTEM_PROMPT`, `SAMPLE_RATE` |
| Classes | PascalCase | `DiarizationPipeline`, `BeamState` |
| Files | snake_case | `travel_planner.py`, `summary.py` |

### Type Hints

Use type hints for function signatures:

```python
def load_align_model(
    language_code: str,
    device: str,
    model_name: Optional[str] = None,
    model_dir=None
) -> tuple:
    ...

def summarize_text(
    model: AutoModelForCausalLM,
    tokenizer: AutoTokenizer,
    text: str,
    max_new_tokens: int = 4096
) -> str:
    ...
```

### Error Handling

```python
try:
    response = client.chat.completions.create(...)
    assistant_message = response.choices[0].message.content
except Exception as e:
    print(f"Error: {e}")
    # Remove failed message from history
    messages.pop()
```

### Environment Variables

```python
from pathlib import Path
from dotenv import load_dotenv
import os

# Load from parent .env file
load_dotenv(Path(__file__).parent.parent / ".env")

# Access keys
api_key = os.environ.get("OPENAI_API_KEY")
```

---

## LLM API Patterns

### OpenAI Chat Completions

```python
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

response = client.chat.completions.create(
    model="gpt-4o-mini",
    temperature=0.7,
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_input}
    ]
)
result = response.choices[0].message.content
```

### Google Gemini Chat

```python
from google import genai

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

chat = client.chats.create(
    model="gemini-2.0-flash",
    config={"system_instruction": SYSTEM_PROMPT}
)
response = chat.send_message(user_input)
result = response.text
```

### Anthropic Claude

```python
import anthropic

client = anthropic.Anthropic(api_key=os.environ.get("CLAUDE_API_KEY"))

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    system=SYSTEM_PROMPT,
    messages=[{"role": "user", "content": user_input}]
)
result = response.content[0].text
```

---

## Streamlit Patterns

### Session State Management

```python
import streamlit as st

def initialize_session_state():
    if "messages" not in st.session_state:
        st.session_state.messages = []
    if "chat_session" not in st.session_state:
        st.session_state.chat_session = None
```

### Chat Interface

```python
# Display chat history
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# User input
if prompt := st.chat_input("Enter message..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
```

---

## Local Model Patterns (Transformers)

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

model_id = "LGAI-EXAONE/EXAONE-4.0-1.2B"

tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    torch_dtype=torch.float16,
    device_map="auto",
    trust_remote_code=True
)

# Generate
model_inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
generated_ids = model.generate(
    model_inputs.input_ids,
    max_new_tokens=1024,
    temperature=0.7,
    do_sample=True
)
output = tokenizer.decode(generated_ids[0], skip_special_tokens=True)
```

---

## File I/O Patterns

### Multi-encoding File Read

```python
def load_input_file(input_path: str) -> str:
    encodings = ["utf-8", "cp949", "euc-kr", "latin-1"]
    for encoding in encodings:
        try:
            with open(input_path, "r", encoding=encoding) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    # Fallback with error ignore
    with open(input_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()
```

### Path Handling

```python
from pathlib import Path

base_dir = Path(__file__).parent.parent
input_path = base_dir / "pdf" / "document.md"
output_path = base_dir / "summary" / "result.txt"

os.makedirs(output_path.parent, exist_ok=True)
```

---

## Git Conventions

- **Commit messages**: Write in Korean
- **Commands**:
  - `pull`: Git pull with auto-merge on conflicts
  - `push` or `푸시`: git add, commit, push sequence

---

## API Key Configuration

Create `.env` in `agentic-ai/examples/`:

```
OPENAI_API_KEY=sk-...
CLAUDE_API_KEY=sk-ant-...
GEMINI_API_KEY=AI...
```

**Never commit `.env` files** - they are gitignored.

---

## Common Pitfalls

1. **Virtual environments**: Each example may need its own venv
2. **Korean encoding**: Always handle cp949/euc-kr for Korean text files
3. **GPU memory**: Use `torch.float16` or `bfloat16` for local models
4. **trust_remote_code**: Required for EXAONE and some HuggingFace models
5. **API rate limits**: Add retry logic for production use
