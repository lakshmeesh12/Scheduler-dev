import os
import json
import logging
import time
import asyncio
import concurrent.futures
from pathlib import Path
from typing import Iterable, List, Dict, Union, Tuple, Optional
from dataclasses import dataclass
from io import BytesIO
import multiprocessing as mp
from functools import partial
import threading
from queue import Queue
import tempfile
import uuid

import aiofiles
import yaml
from tqdm.asyncio import tqdm
import warnings
warnings.filterwarnings("ignore")

from docling.document_converter import DocumentConverter
from docling_core.transforms.chunker import HierarchicalChunker
from docling.backend.msword_backend import MsWordDocumentBackend
from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
from docling.datamodel.base_models import InputFormat
from docling.document_converter import (
    DocumentConverter,
    PdfFormatOption,
    WordFormatOption,
)
from docling.datamodel.base_models import ConversionStatus
from docling.datamodel.document import ConversionResult
from docling.pipeline.simple_pipeline import SimplePipeline
from docling.pipeline.standard_pdf_pipeline import StandardPdfPipeline

_log = logging.getLogger("rms.log")


@dataclass
class DocumentInput:
    """Enhanced document input class to support both files and bytes"""
    data: Union[Path, bytes]
    filename: str
    format_type: InputFormat
    is_bytes: bool = False


class CustomMsWordBackend(MsWordDocumentBackend):
    """Thread-safe custom MS Word backend with improved error handling"""
    
    def __init__(self):
        super().__init__()
        self._lock = threading.RLock()  # Thread-safe operations
    
    def get_label_and_level(self, paragraph):
        with self._lock:
            label = paragraph.style.name
            # Handle cases where the label contains unexpected text
            if " Staff Name" in label:
                return label, 1
                
            # Original logic for other cases
            parts = label.split(".")
            if len(parts) == 2:
                try:
                    return parts[0], max(int(parts[1]), 1)
                except ValueError:
                    return parts[0], 1
                    
            parts = label.split(" ")
            if len(parts) == 2:
                try:
                    return parts[0], max(int(parts[1]), 1)
                except ValueError:
                    return parts[0], 1
                    
            return label, 1

import fitz  # PyMuPDF
from docx import Document
import io
import asyncio
from concurrent.futures import ThreadPoolExecutor

class OptimizedDocumentConverter:
    def __init__(self, max_workers: Optional[int] = None, batch_size: int = 10):
        self.max_workers = max_workers or min(32, (os.cpu_count() or 1) * 2)
        self.batch_size = batch_size
        self.thread_pool = ThreadPoolExecutor(max_workers=self.max_workers)
        self.semaphore = asyncio.Semaphore(16)  # Limit concurrent tasks
        _log.info(f"Initialized converter with {self.max_workers} threads")

    def _detect_format(self, filename: str) -> InputFormat:
        """Detect input format from filename"""
        ext = Path(filename).suffix.lower()
        format_map = {
            '.pdf': InputFormat.PDF,
            '.docx': InputFormat.DOCX,
            '.doc': InputFormat.DOCX,
        }
        return format_map.get(ext, InputFormat.PDF)  # Default to PDF

    async def _extract_pdf_text(self, content: bytes, filename: str) -> Tuple[str, Optional[str], str, Optional[Exception]]:
        """Extract text from PDF using PyMuPDF"""
        async with self.semaphore:
            try:
                pdf = fitz.open(stream=content, filetype="pdf")
                texts = []
                for page_num in range(len(pdf)):
                    page = pdf[page_num]
                    text = await asyncio.get_event_loop().run_in_executor(
                        self.thread_pool,
                        lambda: page.get_text("text").replace("\n", " ").strip()
                    )
                    texts.append(text)
                pdf.close()
                content = " ".join(texts)
                return filename, content, "SUCCESS", None
            except Exception as e:
                _log.error(f"Error extracting PDF {filename}: {str(e)}")
                return filename, None, "FAILURE", e

    async def _extract_docx_text(self, content: bytes, filename: str) -> Tuple[str, Optional[str], str, Optional[Exception]]:
        """Extract text from DOCX using python-docx"""
        async with self.semaphore:
            try:
                doc = await asyncio.get_event_loop().run_in_executor(
                    self.thread_pool,
                    lambda: Document(io.BytesIO(content))
                )
                texts = [para.text.strip() for para in doc.paragraphs if para.text.strip()]
                content = " ".join(texts)
                return filename, content, "SUCCESS", None
            except Exception as e:
                _log.error(f"Error extracting DOCX {filename}: {str(e)}")
                return filename, None, "FAILURE", e

    async def _process_single_document(self, doc_input: DocumentInput) -> Tuple[str, Optional[str], str, Optional[Exception]]:
        """Process a single document based on format"""
        try:
            if doc_input.format_type == InputFormat.PDF:
                return await self._extract_pdf_text(doc_input.data, doc_input.filename)
            elif doc_input.format_type == InputFormat.DOCX:
                return await self._extract_docx_text(doc_input.data, doc_input.filename)
            else:
                return doc_input.filename, None, "FAILURE", ValueError(f"Unsupported format: {doc_input.format_type}")
        except Exception as e:
            _log.error(f"Error processing {doc_input.filename}: {str(e)}")
            return doc_input.filename, None, "FAILURE", e

    async def _process_batch(self, batch: List[DocumentInput]) -> List[Tuple[str, Optional[str], str, Optional[Exception]]]:
        """Process a batch of documents concurrently"""
        tasks = [self._process_single_document(doc_input) for doc_input in batch]
        return await asyncio.gather(*tasks, return_exceptions=False)

    async def convert_all_optimized(self, doc_inputs: List[DocumentInput]) -> Dict:
        """Convert all documents with optimal batching and parallelization"""
        start_time = time.time()
        
        success_count = 0
        failure_count = 0
        failed_files = []
        parsed_content = {}
        
        batches = [doc_inputs[i:i + self.batch_size] for i in range(0, len(doc_inputs), self.batch_size)]
        
        for batch in batches:
            batch_results = await self._process_batch(batch)
            
            for filename, content, status, error in batch_results:
                if status == "SUCCESS":
                    success_count += 1
                    parsed_content[filename] = content
                else:
                    failure_count += 1
                    failed_files.append(filename)
                    _log.error(f"Document {filename} failed: {error}")
        
        total_count = success_count + failure_count
        end_time = time.time() - start_time
        
        _log.info(f"Document conversion complete in {end_time:.2f} seconds.")
        _log.info(f"Processed {total_count} docs: {success_count} success, {failure_count} failed")
        
        message = "Parsing completed successfully without errors!" if failure_count == 0 else "Parsing completed with errors!"
        
        return {
            "message": message,
            "stats": {
                "success_count": success_count,
                "failure_count": failure_count,
                "total_count": total_count,
                "failed_files": failed_files,
                "parsed_content": parsed_content,
                "processing_time": end_time
            }
        }

    def close(self):
        """Clean up resources"""
        self.thread_pool.shutdown(wait=True)


class DocumentParser:
    """Main parser class with support for both files and bytes"""
    
    def __init__(self, max_workers: Optional[int] = None, batch_size: int = 10):
        self.converter = OptimizedDocumentConverter(max_workers=max_workers, batch_size=batch_size)
        _log.info("Document parser initialized")
    
    def _prepare_file_inputs(self, files: List[Union[str, Path]]) -> List[DocumentInput]:
        """Prepare file path inputs"""
        doc_inputs = []
        for file_path in files:
            path_obj = Path(file_path)
            if path_obj.exists():
                format_type = self.converter._detect_format(path_obj.name)
                doc_inputs.append(DocumentInput(
                    data=path_obj,
                    filename=path_obj.stem,
                    format_type=format_type,
                    is_bytes=False
                ))
            else:
                _log.warning(f"File not found: {file_path}")
        return doc_inputs
    
    def _prepare_bytes_inputs(self, bytes_data: List[Tuple[bytes, str]]) -> List[DocumentInput]:
        """Prepare bytes inputs with filenames"""
        doc_inputs = []
        for data, filename in bytes_data:
            format_type = self.converter._detect_format(filename)
            # Use stem of filename without extension for identification
            file_stem = Path(filename).stem
            doc_inputs.append(DocumentInput(
                data=data,
                filename=file_stem,
                format_type=format_type,
                is_bytes=True
            ))
        return doc_inputs
    
    async def parse_files(self, files: List[Union[str, Path]], raise_error: bool = False) -> Dict:
        """Parse files from file paths"""
        doc_inputs = self._prepare_file_inputs(files)
        return await self.converter.convert_all_optimized(doc_inputs)
    
    async def parse_bytes(self, bytes_data: List[Tuple[bytes, str]], raise_error: bool = False) -> Dict:
        """
        Parse documents from bytes data
        
        Args:
            bytes_data: List of tuples containing (bytes_content, filename)
            raise_error: Whether to raise errors or continue processing
        
        Returns:
            Dictionary with parsing results and statistics
        """
        doc_inputs = self._prepare_bytes_inputs(bytes_data)
        return await self.converter.convert_all_optimized(doc_inputs)
    
    async def parse_mixed(self, files: List[Union[str, Path]], bytes_data: List[Tuple[bytes, str]], raise_error: bool = False) -> Dict:
        """Parse both files and bytes data together"""
        file_inputs = self._prepare_file_inputs(files)
        bytes_inputs = self._prepare_bytes_inputs(bytes_data)
        all_inputs = file_inputs + bytes_inputs
        return await self.converter.convert_all_optimized(all_inputs)
    
    def close(self):
        """Clean up resources"""
        self.converter.close()


# Convenience functions for backward compatibility and easy usage
async def parse_files_optimized(files: List[Union[str, Path]], max_workers: Optional[int] = None, raise_error: bool = False) -> Dict:
    """
    Optimized file parsing function
    
    Args:
        files: List of file paths to parse
        max_workers: Number of worker threads (auto-detected if None)
        raise_error: Whether to raise errors or continue processing
    
    Returns:
        Dictionary with parsing results and statistics
    """
    parser = DocumentParser(max_workers=max_workers)
    try:
        return await parser.parse_files(files, raise_error=raise_error)
    finally:
        parser.close()


async def parse_bytes_optimized(bytes_data: List[Tuple[bytes, str]], max_workers: Optional[int] = None, raise_error: bool = False) -> Dict:
    """
    Optimized bytes parsing function
    
    Args:
        bytes_data: List of tuples containing (bytes_content, filename)
        max_workers: Number of worker threads (auto-detected if None)
        raise_error: Whether to raise errors or continue processing
    
    Returns:
        Dictionary with parsing results and statistics
    """
    parser = DocumentParser(max_workers=max_workers)
    try:
        return await parser.parse_bytes(bytes_data, raise_error=raise_error)
    finally:
        parser.close()


# Example usage and demonstration
async def main():
    """Example usage of the optimized parser"""
    
    # Example 1: Parse files
    file_paths = os.listdir("resumes/")[:4]
    file_paths = ["resumes/"+f for f in file_paths]
    
    print("Parsing files...")
    start_time = time.time()
    results = await parse_files_optimized(file_paths)
    print(f"File parsing completed in {time.time() - start_time:.2f} seconds")
    print(f"Results: {results['message']}")
    
    # Example 2: Parse bytes data
    bytes_data = []
    # Simulate reading files into bytes
    for file_path in file_paths:
        try:
            with open(file_path, 'rb') as f:
                file_bytes = f.read()
                bytes_data.append((file_bytes, Path(file_path).name))
        except FileNotFoundError:
            print(f"File {file_path} not found, skipping...")
            continue
    
    if bytes_data:
        print("Parsing bytes data...")
        start_time = time.time()
        results = await parse_bytes_optimized(bytes_data)
        print(f"Bytes parsing completed in {time.time() - start_time:.2f} seconds")
        print(f"Results: {results['message']}")
    
    # Example 3: Using the parser class directly for more control
    parser = DocumentParser(max_workers=16, batch_size=5)
    try:
        # Mix of files and bytes
        mixed_results = await parser.parse_mixed(file_paths[:1], bytes_data[:2])
        print(f"Mixed parsing results: {mixed_results['message']}")
    finally:
        parser.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    asyncio.run(main())
