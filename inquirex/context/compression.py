"""Context compression utilities for GPT Researcher.

This module provides classes for compressing and retrieving relevant
context from documents using embeddings and similarity filtering.

The compression pipeline:
1. Splits documents into chunks
2. Filters chunks by embedding similarity to the query
3. Returns the most relevant chunks as context

Classes:
    VectorstoreCompressor: Retrieves context from a vector store.
    ContextCompressor: Compresses raw documents using embedding similarity.
    WrittenContentCompressor: Compresses previously written content sections.
"""

import asyncio
import os
from typing import Optional

from langchain_classic.retrievers import ContextualCompressionRetriever
from langchain_classic.retrievers.document_compressors import (
    DocumentCompressorPipeline,
    EmbeddingsFilter,
)
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from ..memory.embeddings import OPENAI_EMBEDDING_MODEL
from ..prompts import PromptFamily
from ..utils.costs import estimate_embedding_cost
from ..vector_store import VectorStoreWrapper
from .retriever import SearchAPIRetriever, SectionRetriever
import logging
import re

logger = logging.getLogger(__name__)

STOPWORDS = {
    'in', 'the', 'a', 'an', 'of', 'for', 'to', 'and', 'on', 'with', 'is', 'are',
    'about', 'how', 'what', 'why', 'when', 'where', 'who', 'which', 'from', 'by',
    'as', 'at', 'or', 'its', 'it', 'that', 'this', 'into', 'within', 'across',
    'report', 'analysis', 'overview', 'summary', 'research', 'guide', 'study', 'details'
}

def extract_core_entities(query: str) -> list[str]:
    """Extract substantive entity tokens from a query for relevance checking."""
    words = re.findall(r"[a-zA-Z0-9_\-]+", query.lower())
    return [w for w in words if w not in STOPWORDS and len(w) >= 3]

def has_entity_overlap(content: str, title: str, source: str, core_entities: list[str]) -> bool:
    """Return True if content/title/source has at least one core entity keyword.

    If core_entities is empty (e.g. abstract or short test queries), returns True to avoid over-filtering.
    If core_entities are present, drops chunks that share 0 semantic/keyword overlap with the core entity.
    """
    if not core_entities:
        return True
    blob = f"{title} {source} {content}".lower()
    return any(re.search(r'\b' + re.escape(entity) + r'\b', blob) for entity in core_entities)



class VectorstoreCompressor:
    """Retrieves and compresses context from a vector store.

    Uses similarity search on an existing vector store to find
    relevant documents for a given query.

    Attributes:
        vector_store: The vector store wrapper to search.
        max_results: Maximum number of results to return.
        filter: Optional filter for vector store queries.
    """

    def __init__(
        self,
        vector_store: VectorStoreWrapper,
        max_results: int = 10,
        filter: Optional[dict] = None,
        prompt_family: type[PromptFamily] | PromptFamily = PromptFamily,
        **kwargs,
    ):
        """Initialize the VectorstoreCompressor.

        Args:
            vector_store: The vector store to search.
            max_results: Maximum number of results to return.
            filter: Optional filter dictionary for queries.
            prompt_family: Prompt family for formatting output.
            **kwargs: Additional keyword arguments.
        """
        self.vector_store = vector_store
        self.max_results = max_results
        self.filter = filter
        self.kwargs = kwargs
        self.prompt_family = prompt_family

    async def async_get_context(self, query: str, max_results: int = 10) -> str:
        """Get relevant context from the vector store.

        Args:
            query: The search query.
            max_results: Maximum number of results to return.

        Returns:
            Formatted string of relevant document content.
        """
        results = await self.vector_store.asimilarity_search(query=query, k=max_results, filter=self.filter)
        core_entities = extract_core_entities(query)
        validated_results = []
        for doc in results:
            content = doc.page_content or ''
            title = doc.metadata.get('title', '') or ''
            source = doc.metadata.get('source', '') or ''
            if has_entity_overlap(content, title, source, core_entities):
                validated_results.append(doc)
            else:
                logger.warning(
                    f"RAG Filter: Dropping vectorstore result with 0 entity overlap for query '{query}': title='{title}', source='{source}'"
                )
        return self.prompt_family.pretty_print_docs(validated_results)


class ContextCompressor:
    """Compresses raw documents to extract relevant context.

    Uses embedding similarity to filter document chunks and return
    only the most relevant content for a given query.

    Attributes:
        documents: List of documents to compress.
        embeddings: Embedding model for similarity calculation.
        max_results: Maximum number of results to return.
        similarity_threshold: Minimum similarity score for inclusion.
    """

    def __init__(
        self,
        documents,
        embeddings,
        max_results: int = 10,
        similarity_threshold: float | None = None,
        prompt_family: type[PromptFamily] | PromptFamily = PromptFamily,
        **kwargs,
    ):
        """Initialize the ContextCompressor.

        Args:
            documents: List of documents to compress.
            embeddings: Embedding model instance.
            max_results: Maximum number of results to return.
            similarity_threshold: Minimum similarity score for inclusion.
                Falls back to the SIMILARITY_THRESHOLD env var when not given.
            prompt_family: Prompt family for formatting output.
            **kwargs: Additional keyword arguments.
        """
        self.max_results = max_results
        self.documents = documents
        self.kwargs = kwargs
        self.embeddings = embeddings
        if similarity_threshold is None:
            similarity_threshold = float(os.environ.get("SIMILARITY_THRESHOLD", 0.25))
        self.similarity_threshold = similarity_threshold
        self.prompt_family = prompt_family

    def __get_contextual_retriever(self):
        """Build the contextual compression retriever pipeline.

        Returns:
            A ContextualCompressionRetriever configured with text splitting
            and embedding-based filtering.
        """
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        relevance_filter = EmbeddingsFilter(embeddings=self.embeddings,
                                            similarity_threshold=self.similarity_threshold)
        pipeline_compressor = DocumentCompressorPipeline(
            transformers=[splitter, relevance_filter]
        )
        base_retriever = SearchAPIRetriever(
            pages=self.documents
        )
        contextual_retriever = ContextualCompressionRetriever(
            base_compressor=pipeline_compressor, base_retriever=base_retriever
        )
        return contextual_retriever

    async def async_get_context(self, query: str, max_results: int = 10, cost_callback=None) -> str:
        """Get relevant context from documents asynchronously.

        Optimization: Skip expensive compression pipeline for small document sets.
        When documents are already concise, directly use them without embedding-based filtering.

        Args:
            query: The search query.
            max_results: Maximum number of results to return.
            cost_callback: Optional callback for tracking embedding costs.

        Returns:
            Formatted string of relevant document content.
        """
        # Optimization: Calculate total content size
        total_chars = sum(len(str(doc.get('raw_content', ''))) for doc in self.documents)
        chunk_threshold = int(os.environ.get("COMPRESSION_THRESHOLD", "8000"))

        core_entities = extract_core_entities(query)

        # If total content is small, skip expensive compression and return directly
        if total_chars < chunk_threshold and len(self.documents) <= max_results:
            # Fast path: filter by entity relevance before converting to Documents
            direct_docs = []
            for doc in self.documents[:max_results]:
                content = doc.get('raw_content', '') or ''
                title = doc.get('title', '') or ''
                source = doc.get('source') or doc.get('url') or ''
                if has_entity_overlap(content, title, source, core_entities):
                    direct_docs.append(
                        Document(
                            page_content=content,
                            metadata={
                                "title": title,
                                "source": source,
                            },
                        )
                    )
                else:
                    logger.warning(
                        f"RAG Filter: Dropping chunk with 0 entity overlap for query '{query}': title='{title}', source='{source}'"
                    )
            return self.prompt_family.pretty_print_docs(direct_docs, max_results)

        # Standard path: use compression for large content
        compressed_docs = self.__get_contextual_retriever()
        if cost_callback:
            cost_callback(estimate_embedding_cost(model=OPENAI_EMBEDDING_MODEL, docs=self.documents))
        relevant_docs = await asyncio.to_thread(compressed_docs.invoke, query, **self.kwargs)

        # RAG Context Validation: Filter out chunks with 0 entity overlap
        validated_docs = []
        for doc in relevant_docs:
            content = doc.page_content or ''
            title = doc.metadata.get('title', '') or ''
            source = doc.metadata.get('source', '') or ''
            if has_entity_overlap(content, title, source, core_entities):
                validated_docs.append(doc)
            else:
                logger.warning(
                    f"RAG Filter: Dropping compressed chunk with 0 entity overlap for query '{query}': title='{title}', source='{source}'"
                )

        return self.prompt_family.pretty_print_docs(validated_docs, max_results)


class WrittenContentCompressor:
    """Compresses previously written content sections.

    Specialized compressor for finding relevant sections from
    previously written report content, preserving section titles
    and structure.

    Attributes:
        documents: List of written content sections.
        embeddings: Embedding model for similarity calculation.
        similarity_threshold: Minimum similarity score for inclusion.
    """

    def __init__(self, documents, embeddings, similarity_threshold: float, **kwargs):
        """Initialize the WrittenContentCompressor.

        Args:
            documents: List of written content sections.
            embeddings: Embedding model instance.
            similarity_threshold: Minimum similarity score for inclusion.
            **kwargs: Additional keyword arguments.
        """
        normalized_docs = []
        if documents:
            for item in documents:
                if isinstance(item, dict):
                    if item.get("written_content") or item.get("content"):
                        normalized_docs.append(item)
                elif isinstance(item, str):
                    if item.strip():
                        normalized_docs.append({
                            "section_title": "Section",
                            "written_content": item.strip()
                        })
                else:
                    normalized_docs.append(item)
        self.documents = normalized_docs
        self.kwargs = kwargs
        self.embeddings = embeddings
        self.similarity_threshold = similarity_threshold

    def __get_contextual_retriever(self):
        """Build the contextual compression retriever for sections.

        Returns:
            A ContextualCompressionRetriever configured for section retrieval.
        """
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        relevance_filter = EmbeddingsFilter(embeddings=self.embeddings,
                                            similarity_threshold=self.similarity_threshold)
        pipeline_compressor = DocumentCompressorPipeline(
            transformers=[splitter, relevance_filter]
        )
        base_retriever = SectionRetriever(
            sections=self.documents
        )
        contextual_retriever = ContextualCompressionRetriever(
            base_compressor=pipeline_compressor, base_retriever=base_retriever
        )
        return contextual_retriever

    def __pretty_docs_list(self, docs, top_n: int) -> list[str]:
        """Format documents as a list of title/content strings.

        Args:
            docs: List of documents to format.
            top_n: Maximum number of documents to include.

        Returns:
            List of formatted document strings.
        """
        return [f"Title: {d.metadata.get('section_title')}\nContent: {d.page_content}\n" for i, d in enumerate(docs) if i < top_n]

    async def async_get_context(self, query: str, max_results: int = 5, cost_callback=None) -> list[str]:
        """Get relevant written content sections asynchronously.

        Args:
            query: The search query.
            max_results: Maximum number of results to return.
            cost_callback: Optional callback for tracking embedding costs.

        Returns:
            List of formatted section strings.
        """
        if not self.documents:
            return []
        compressed_docs = self.__get_contextual_retriever()
        if cost_callback:
            cost_callback(estimate_embedding_cost(model=OPENAI_EMBEDDING_MODEL, docs=self.documents))
        relevant_docs = await asyncio.to_thread(compressed_docs.invoke, query, **self.kwargs)
        return self.__pretty_docs_list(relevant_docs, max_results)
