import os
import json
import logging
import time
from pathlib import Path
from typing import Iterable
import aiofiles
import yaml
import asyncio

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

_log = logging.getLogger(__name__)


class CustomMsWordBackend(MsWordDocumentBackend):
    def get_label_and_level(self, paragraph):
        label = paragraph.style.name
        # Handle cases where the label contains unexpected text
        if " Staff Name" in label:
            # Adjust the logic to handle this specific case
            # For example, you can return a default level or extract the level using a different method
            return label, 1 # or any other default level
        # Original logic for other cases
        parts = label.split(".")
        if len(parts) == 2:
            try:
                return parts[0], max(int(parts[1]),1)
            except ValueError:
                # Handle cases where the second part is not an integer
                # For example, you can log a warning or return a default level
                return parts[0], 1 # or any other default level
        parts = label.split(" ")
        if len(parts) == 2:
            try:
                return parts[0], max(int(parts[1]),1)
            except ValueError:
                # Handle cases where the second part is not an integer
                # For example, you can log a warning or return a default level
                return parts[0], 1 # or any other default level
        return label, 1


start = time.time()

converter = DocumentConverter(
    allowed_formats=[
        InputFormat.PDF,
        InputFormat.IMAGE,
        InputFormat.DOCX,
        InputFormat.HTML,
    ],
    format_options={
        InputFormat.PDF: PdfFormatOption(
            pipeline_cls=StandardPdfPipeline, backend=PyPdfiumDocumentBackend
        ),
        InputFormat.DOCX: WordFormatOption(
            pipeline_cls=SimplePipeline, backend=CustomMsWordBackend # use the custom backend
        ),
    },
)

end = time.time()

duration = end-start

print("Model loaded! in ", duration)


# def export_documents(conv_results: Iterable[ConversionResult], output_dir: Path):
#     """
#     The `export_documents` function processes conversion results and exports documents to various
#     formats based on the status of the conversion.
    
#     :param conv_results: The `conv_results` parameter in the `export_documents` function is expected to
#     be an iterable containing `ConversionResult` objects. Each `ConversionResult` object represents the
#     result of a document conversion process and includes information such as the status of the
#     conversion (success, partial success, or failure), the
#     :type conv_results: Iterable[ConversionResult]
#     :param output_dir: The `output_dir` parameter in the `export_documents` function is the directory
#     where the exported documents will be saved. It is of type `Path` and should be a valid path in the
#     file system where the documents will be written to. The function creates this directory if it
#     doesn't exist and
#     :type output_dir: Path
#     :return: The `export_documents` function returns a tuple containing the counts of successful
#     conversions, partially successful conversions, and failed conversions.
#     """

#     output_dir.mkdir(parents=True, exist_ok=True)

#     success_count = 0
#     failure_count = 0
#     partial_success_count = 0
#     failed_files = []
#     file_names = []
#     content = []

#     for conv_res in conv_results:
#         if conv_res.status == ConversionStatus.SUCCESS:
#             success_count += 1
#             doc_filename = conv_res.input.file.stem

#             data = conv_res.document.export_to_document_tokens()
#             data = bytes(data, 'utf-8').decode('utf-8', 'ignore')

#             # file_names.append(Path(str(output_dir).split('/',1)[1] + f"{doc_filename}.doctags.txt"))
#             content.append(data)
#             # Export Docling document format to doctags:
#             with (output_dir / f"{doc_filename}.doctags.txt").open("w", encoding="utf-8") as fp:
#                 fp.write(data)

#             # Export Docling document format to markdown:
#             # with (output_dir / f"{doc_filename}.md").open("w", encoding="utf-8") as fp:
#             #     fp.write(data)

#             # Export Docling document format to text:
#             # with (output_dir / f"{doc_filename}.txt").open("w") as fp:
#             #     fp.write(conv_res.document.export_to_markdown(strict_text=True))

#         elif conv_res.status == ConversionStatus.PARTIAL_SUCCESS:
#             print(
#                 f"Document {conv_res.input.file} was partially converted with the following errors:"
#             )
#             for item in conv_res.errors:
#                 print(f"\t{item.error_message}")
#             partial_success_count += 1
#         else:
#             print(f"Document {conv_res.input.file} failed to convert.")
#             failure_count += 1
#             failed_files.append(conv_res.input.file)

#     print(
#         f"Processed {success_count + partial_success_count + failure_count} docs, "
#         f"of which {failure_count} failed "
#         f"and {partial_success_count} were partially converted."
#     )
#     return (success_count, partial_success_count, failure_count, failed_files, file_names, content)


# def parse_files(files, raise_error=False):
#     # logging.basicConfig(level=logging.INFO)
    
#     input_doc_paths = list(map(lambda x: Path(x),files))

#     # buf = BytesIO(Path("./test/data/2206.01062.pdf").open("rb").read())
#     # docs = [DocumentStream(name="my_doc.pdf", stream=buf)]
#     # input = DocumentConversionInput.from_streams(docs)

#     # # Turn on inline debug visualizations:
#     # settings.debug.visualize_layout = True
#     # settings.debug.visualize_ocr = True
#     # settings.debug.visualize_tables = True
#     # settings.debug.visualize_cells = True

    
#     start_time = time.time()

#     conv_results = converter.convert_all(
#         input_doc_paths,
#         raises_on_error=raise_error,  # to let conversion run through all and examine results at the end
#     )
#     success_count, partial_success_count, failure_count, failed_files, file_names, content = export_documents(
#         conv_results, output_dir=Path("./temp/")
#     )
#     total_count = success_count + partial_success_count + failure_count
#     end_time = time.time() - start_time

#     print(f"Document conversion complete in {end_time:.2f} seconds.")

#     if failure_count > 0:
#         print(
#             f"The example failed converting {failure_count} on {len(input_doc_paths)}."
#         )
#         message = "Parsing completed with errors!"
#     else:
#         message = "Parsing completed successfully without any errors!"
#     return {
#         "message": message,
#         "stats":{
#             "success_count": success_count,
#             "partial_success_count": partial_success_count,
#             "failure_count": failure_count,
#             "total_count": total_count,
#             "failed_files": failed_files,
#             "file_names": file_names,
#             "parsed_content": content
#         } 
#     }

async def async_export_documents(conv_results: Iterable[ConversionResult], output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    success_count = 0
    failure_count = 0
    partial_success_count = 0
    failed_files = []
    file_names = []
    content = []
    tasks = []
    
    for conv_res in conv_results:
        if conv_res.status == ConversionStatus.SUCCESS:
            success_count += 1
            doc_filename = conv_res.input.file.stem
            data = conv_res.document.export_to_document_tokens()
            data = bytes(data, 'utf-8').decode('utf-8', 'ignore')
            content.append(data)
            
            file_path = output_dir / f"{doc_filename}.doctags.txt"
            tasks.append(asyncio.create_task(async_write_file(file_path, data)))
        
        elif conv_res.status == ConversionStatus.PARTIAL_SUCCESS:
            print(f"Document {conv_res.input.file} was partially converted with errors:")
            for item in conv_res.errors:
                print(f"\t{item.error_message}")
            partial_success_count += 1
        
        else:
            print(f"Document {conv_res.input.file} failed to convert.")
            failure_count += 1
            failed_files.append(conv_res.input.file)
    
    await asyncio.gather(*tasks)
    print(f"Processed {success_count + partial_success_count + failure_count} docs, {failure_count} failed, {partial_success_count} partial.")
    return success_count, partial_success_count, failure_count, failed_files, file_names, content

async def async_write_file(path, data):
    async with aiofiles.open(path, "w", encoding="utf-8") as fp:
        await fp.write(data)

async def parse_files(files, raise_error=False):
    input_doc_paths = [Path(x) for x in files]
    start_time = time.time()
    conv_results = converter.convert_all(input_doc_paths, raises_on_error=raise_error)
    success_count, partial_success_count, failure_count, failed_files, file_names, content = await async_export_documents(conv_results, Path("./temp/"))
    total_count = success_count + partial_success_count + failure_count
    end_time = time.time() - start_time
    print(f"Document conversion complete in {end_time:.2f} seconds.")
    message = "Parsing completed successfully without errors!" if failure_count == 0 else "Parsing completed with errors!"
    return {
        "message": message,
        "stats": {
            "success_count": success_count,
            "partial_success_count": partial_success_count,
            "failure_count": failure_count,
            "total_count": total_count,
            "failed_files": failed_files,
            "file_names": file_names,
            "parsed_content": content
        }
    }



if __name__ == "__main__":
    dir = "./data/resumes/"
    files = os.listdir(dir)
    files = [dir+f for f in files]
    result = asyncio.run(parse_files(files))
    print(result)