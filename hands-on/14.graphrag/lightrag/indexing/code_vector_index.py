"""예제코드 벡터 인덱싱 모듈 — qwen3-embedding + nano-vectordb (KG 미생성)

절차적인 예제코드는 관계 그래프보다 벡터 유사도 검색이 적합하므로, LightRAG insert()를 거치지 않고
코드 청크를 직접 임베딩하여 별도 nano-vectordb(store/vector/code/vdb_code.json)에 저장함.
교재 KG와 저장소를 분리해 검색 단계에서 용도별로 선택 가능하게 함.

[동기 인터페이스] kg_builder와 동일하게 공개 메서드 build_from_documents()는 동기지만
내부에서 asyncio.run()으로 비동기 임베딩을 구동함.
"""
import asyncio
import hashlib
import logging

import numpy as np  # nano-vectordb가 요구하는 float32 벡터 배열 처리용
# NanoVectorDB: 단일 JSON 파일에 벡터+메타데이터를 저장하는 경량 벡터 DB (외부 서버 불필요)
from nano_vectordb import NanoVectorDB

from config.settings import Settings
from llm_func import create_embed_callable

logger = logging.getLogger(__name__)


class CodeVectorIndexer:
    """예제코드를 청킹·임베딩하여 nano-vectordb에 저장하는 인덱서."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._embed = create_embed_callable(settings)  # 교재 인덱싱과 동일한 임베딩 함수 재사용

    def build_from_documents(self, docs: list[dict]) -> dict:
        """예제코드 문서로 코드 벡터 인덱스를 구축함 (동기 인터페이스)."""
        return asyncio.run(self._build_async(docs))

    async def _build_async(self, docs: list[dict]) -> dict:
        """코드 청킹 → 임베딩 → nano-vectordb upsert → JSON 저장."""
        self.settings.code_vector_dir.mkdir(parents=True, exist_ok=True)
        # NanoVectorDB(차원, storage_file): 기존 파일이 있으면 자동 로드, 없으면 새로 생성
        db = NanoVectorDB(
            self.settings.embedding_dim,
            storage_file=str(self.settings.code_vdb_file),
        )

        records: list[dict] = []
        success, skipped = 0, []
        for doc in docs:
            path = doc["file_path"]
            try:
                chunks = self._chunk_code(doc["content"])
                vectors = await self._embed_in_batches(chunks)
                for idx, (text, vec) in enumerate(zip(chunks, vectors)):
                    records.append({
                        # __id__: nano-vectordb의 레코드 식별자 (결정적 ID로 재실행 시 중복 방지)
                        "__id__": self._chunk_id(path, idx, text),
                        # __vector__: nano-vectordb가 유사도 계산에 사용하는 임베딩 벡터
                        "__vector__": vec,
                        "content": text,
                        "file_path": path,
                        "chunk_index": idx,
                    })
                success += 1
            except Exception as exc:  # noqa: BLE001 - 한 파일 임베딩 실패는 스킵하고 계속 진행
                logger.warning("코드 임베딩 실패, 스킵: %s (%s)", path, exc)
                skipped.append(path)

        if records:
            db.upsert(records)
            db.save()   # JSON 파일로 영속화
        logger.info(
            "코드 벡터 인덱싱 완료: 파일 성공 %d, 스킵 %d, 청크 %d",
            success, len(skipped), len(records),
        )
        return {"success": success, "skipped": skipped, "chunks": len(records), "total": len(docs)}

    def _chunk_code(self, content: str) -> list[str]:
        """코드 본문을 문자 길이 기준으로 겹침을 두고 분할.

        토큰 기반이 아닌 단순 문자 기반 슬라이딩 윈도우라 의존성 없이 동작함.
        """
        size = self.settings.code_chunk_size
        overlap = self.settings.code_chunk_overlap
        if len(content) <= size:
            return [content]
        chunks: list[str] = []
        start = 0
        while start < len(content):
            chunk = content[start:start + size]
            chunks.append(chunk)
            if start + size >= len(content):
                break
            # 다음 청크 시작점을 overlap만큼 앞당겨 문맥 연속성을 유지함
            start += size - overlap
        return chunks

    async def _embed_in_batches(self, chunks: list[str]) -> list:
        """청크를 배치로 나눠 임베딩 (대량 입력 시 요청 크기 관리)."""
        out: list = []
        batch_size = self.settings.embed_batch_size
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            vecs = await self._embed(batch)   # (배치크기, 4096) ndarray
            # 각 행(1차원 4096 벡터)을 float32로 변환해 개별 레코드 벡터로 사용
            out.extend(np.asarray(vecs, dtype=np.float32))
        return out

    @staticmethod
    def _chunk_id(file_path: str, index: int, text: str) -> str:
        """파일경로+청크번호+내용 해시로 결정적 ID 생성 (재실행 시 중복 upsert 방지)."""
        # hashlib.md5: 동일 입력에 항상 동일 해시 → idempotent upsert 키로 활용
        raw = f"{file_path}::{index}::{text}".encode("utf-8")
        return hashlib.md5(raw).hexdigest()
