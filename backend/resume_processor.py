import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
import fitz  # PyMuPDF
import docx
from PIL import Image
import io
import pytesseract
import re
import logging
from db.mongo.config import db as mongo_db
from langchain.text_splitter import RecursiveCharacterTextSplitter
import tiktoken
from typing import Dict, List, Tuple, Any
import hashlib
from datetime import datetime, timezone
from utils.chatgpt import run_chatgpt
import tempfile
import zipfile
from uuid import uuid4
from utils.helper import compute_duration
import json
import time
from tenacity import retry, stop_after_attempt, wait_exponential
from bson import ObjectId

# Configure pytesseract path (update based on your system)
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChunkingPromptTemplate:
    def __init__(self, data):
        self.structure = f"""Extract resume details from below doctage text and convert into a python dictionary.

         ** Extract contents based on titles and their datatypes mentioned below
            name: str, 
            total_experience: int/None, 
            email: str, 
            linkedin_url: str/None, 
            github_url: str/None, 
            projects: dict(title, description, skills/tools, impact, start_date, end_date), 
            work_history: dict(company, designation, description, start_date, end_date), 
            primary_skills: dict(domain: dict(:libraries: [], tools: [],concepts: [], etc..)) # identify all primary skills/concepts and tools, etc. used in the projects or previous experience 
            secondary_skills: dict(domain: dict(:libraries: [], tools: [],concepts: [], etc..)) # other skills/tools mentioned in job description, projects, etc. Excluding primary skills
            course: dict(institution, domain, level), 
            certifications: list[certifications], 
            education: dict(institution, degree, domain)

         Input doctext:
         {data}
        """

        self.skills_instructions = """
        **Skills instructions and structure example**
         {
      "Programming Languages": {
         "Languages": ["Python", "Java", "C++", "C", "C#", "JavaScript", "TypeScript", "Go", "Rust", "Kotlin", "Swift", "Ruby", "PHP", "R", "Scala", "Perl", "MATLAB", "SQL", "Bash"]
      },
      "Data Structures & Algorithms": {
         "Data Structures": ["Array", "Linked List", "Stack", "Queue", "Tree", "Graph", "Hash Table", "Heap", "Trie"],
         "Algorithms": ["Binary Search", "Quick Sort", "Merge Sort", "Heap Sort", "Bubble Sort", "Insertion Sort", "Selection Sort", "Breadth-First Search (BFS)", "Depth-First Search (DFS)", "Dijkstra's Algorithm", "A* Search Algorithm", "Dynamic Programming", "Greedy Algorithms", "Backtracking"]
      },
      "Databases": {
         "Relational Databases": ["MySQL", "PostgreSQL", "Oracle", "SQL Server", "SQLite"],
         "NoSQL Databases": ["MongoDB", "Cassandra", "Redis", "CouchDB", "Neo4j", "Elasticsearch"],
         "Concepts": ["SQL", "ACID", "CAP Theorem", "Database Normalization", "Transactions", "Indexing"]
      },
      "Big Data": {
         "Frameworks": ["Hadoop", "Apache Spark", "Apache Flink", "Apache Kafka"],
         "Tools": ["Hive", "HBase", "Apache Pig"],
         "Concepts": ["Distributed Computing", "MapReduce", "ETL (Extract, Transform, Load)", "HDFS"]
      },
      "Machine Learning": {
         "Concepts": ["Supervised Learning", "Unsupervised Learning", "Reinforcement Learning", "Feature Engineering", "Model Evaluation", "Overfitting", "Underfitting", "Bias-Variance Tradeoff", "Cross-Validation", "Dimensionality Reduction", "Regularization", "Ensemble Methods", "Hyperparameter Tuning"],
         "Algorithms": ["Linear Regression", "Logistic Regression", "Decision Trees", "Random Forest", "Support Vector Machines (SVM)", "K-Nearest Neighbors (KNN)", "K-Means Clustering", "Hierarchical Clustering", "Naive Bayes", "Gradient Boosting", "XGBoost", "LightGBM", "CatBoost", "AdaBoost"],
         "Libraries": ["scikit-learn", "Spark MLlib", "H2O.ai", "Weka"]
      }

        ** other instructions and constraints **

        ### Do not add any own data other than that is present in the data. ###
        ### For each of the extracted skill convert shortform to longform example: NLP -> Natural Language Processing ###
        ### Maintain consistency in the output. ###
        ### return only dictionary and not a variable along with dictionary ###
        ### Return proper python dictionary without any syntactic errors that can be convertible by json.loads ###
        """
        self.prompt = self.structure + self.skills_instructions

class Resume:
    """Class to process resume files (PDF/DOCX) with high speed and accuracy, storing results in MongoDB."""

    ALLOWED_EXTENSIONS = {'pdf', 'docx'}
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB per file
    MAX_FILES = 500  # Maximum number of files

    def __init__(self, max_workers: int = None):
        self.executor = ThreadPoolExecutor(max_workers=max_workers or max(os.cpu_count() * 2, 4))
        self.loop = asyncio.get_event_loop()
        self.semaphore = asyncio.Semaphore(16)
        self.db = mongo_db
        self.collection = self.db["profiles"]
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            length_function=self._token_count,
            separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""]
        )
        self.tokenizer = tiktoken.encoding_for_model("text-embedding-3-small")
        logger.info("Initialized ResumeProcessor with MongoDB and text splitter")

    def _token_count(self, text: str) -> int:
        """Count tokens in text using tiktoken."""
        try:
            return len(self.tokenizer.encode(text))
        except Exception as e:
            logger.error(f"Error counting tokens: {str(e)}")
            return 0

    def validate_file(self, file) -> Dict[str, bool | str]:
        """Validate individual file."""
        if not file.filename:
            return {"valid": False, "error": "File has no name"}
        file_ext = file.filename.split('.')[-1].lower()
        if file_ext not in self.ALLOWED_EXTENSIONS:
            return {"valid": False, "error": f"Invalid file type: {file_ext}. Allowed: {', '.join(self.ALLOWED_EXTENSIONS)}"}
        return {"valid": True}

    async def get_text_from_image(self, image_data: bytes) -> str:
        """Extract text from image using pytesseract."""
        try:
            image = Image.open(io.BytesIO(image_data)).convert('RGB')
            text = await self.loop.run_in_executor(
                self.executor, lambda: pytesseract.image_to_string(image, config='--psm 6')
            )
            return re.sub(r'\s+', ' ', text).strip()
        except Exception as e:
            logger.error(f"Error extracting text from image: {e}")
            return ""

    async def get_text_docx(self, file_content: io.BytesIO) -> str:
        """Extract text from DOCX, including paragraphs, tables, and images."""
        try:
            logger.debug("Processing DOCX in-memory")
            doc = await self.loop.run_in_executor(self.executor, lambda: docx.Document(file_content))
            full_text = []

            # Extract text from paragraphs
            for para in doc.paragraphs:
                if para.text.strip():
                    full_text.append(para.text.strip())

            # Extract text from tables
            for table in doc.tables:
                for row in table.rows:
                    for cell in row.cells:
                        if cell.text.strip():
                            full_text.append(cell.text.strip())

            # Extract images from DOCX
            with tempfile.TemporaryDirectory() as temp_dir:
                with zipfile.ZipFile(file_content) as docx_zip:
                    image_tasks = []
                    for file_info in docx_zip.infolist():
                        if file_info.filename.startswith('word/media/'):
                            image_data = docx_zip.read(file_info)
                            image_tasks.append(self.get_text_from_image(image_data))
                    if image_tasks:
                        image_texts = await asyncio.gather(*image_tasks, return_exceptions=True)
                        full_text.extend([text for text in image_texts if isinstance(text, str) and text.strip()])
            return ' '.join(full_text).strip()
        except Exception as e:
            logger.error(f"Error processing DOCX: {e}")
            return ""

    async def get_text_pdf_page(self, page, page_num: int) -> str:
        """Extract text from a single PDF page."""
        async with self.semaphore:
            try:
                text = await self.loop.run_in_executor(
                    self.executor, lambda: page.get_text("text", flags=fitz.TEXTFLAGS_TEXT).replace("\n", " ").replace(" -", "-")
                )
                return re.sub(r'\s+', ' ', text).strip()
            except Exception as e:
                logger.error(f"Error processing PDF page {page_num + 1}: {e}")
                return ""

    async def get_text_pdf(self, file_content: io.BytesIO) -> str:
        """Extract text from PDF in-memory, processing pages in parallel."""
        try:
            logger.debug("Processing PDF in-memory")
            with fitz.open(stream=file_content, filetype="pdf") as pdf:
                total_pages = len(pdf)
                if total_pages == 0:
                    return ""
                batch_size = 50
                all_text = []
                for start in range(0, total_pages, batch_size):
                    end = min(start + batch_size, total_pages)
                    page_tasks = [self.get_text_pdf_page(pdf[page_num], page_num) for page_num in range(start, end)]
                    page_texts = await asyncio.gather(*page_tasks, return_exceptions=True)
                    all_text.extend([t for t in page_texts if isinstance(t, str) and t.strip()])
                return ' '.join(all_text).strip()
        except Exception as e:
            logger.error(f"Error processing PDF: {e}")
            return ""

    async def extract_text(self, filename: str, file_content: io.BytesIO) -> Tuple[str, str]:
        """Extract text from a single file (PDF or DOCX)."""
        try:
            file_ext = filename.split('.')[-1].lower()
            logger.debug(f"Processing file: {filename} ({file_ext})")
            if file_ext == "pdf":
                text = await self.get_text_pdf(file_content)
            elif file_ext == "docx":
                text = await self.get_text_docx(file_content)
            else:
                return filename, ""
            return filename, text
        except Exception as e:
            logger.error(f"Error extracting text from {filename}: {e}")
            return filename, ""

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def _call_chatgpt_with_retry(self, prompt: str, system_message: str, temperature: float) -> str:
        """Call ChatGPT with retry logic."""
        try:
            response = await run_chatgpt(prompt, system_message, temperature)
            if not response:
                raise ValueError("Empty response from ChatGPT")
            return response
        except Exception as e:
            logger.error(f"ChatGPT API call failed: {str(e)}")
            raise

    def _sanitize_skills(self, skills: Any) -> Dict[str, Dict[str, List[str]]]:
        """Sanitize skills field, ensuring nested dictionary structure."""
        sanitized = {}
        if isinstance(skills, dict):
            for domain, categories in skills.items():
                if not isinstance(categories, dict):
                    logger.warning(f"Invalid categories for domain {domain}, expected dict, got {type(categories)}")
                    continue
                sanitized_domain = {}
                for category, skills_list in categories.items():
                    if not isinstance(skills_list, list):
                        logger.warning(f"Invalid skills list for {domain}/{category}, expected list, got {type(skills_list)}")
                        continue
                    sanitized_domain[category] = [str(skill) for skill in skills_list if isinstance(skill, str) and skill.strip()]
                if sanitized_domain:
                    sanitized[domain] = sanitized_domain
        else:
            logger.warning(f"Invalid skills format, expected dict, got {type(skills)}")
        return sanitized

    def _sanitize_json_response(self, response: str) -> str:
        """Sanitize and fix malformed JSON responses."""
        try:
            # Remove code block markers and extra whitespace
            cleaned = response.replace("```json", "").replace("```", "").strip()
            # Fix common JSON issues (e.g., trailing commas, single quotes)
            cleaned = re.sub(r',\s*([}\]])', r'\1', cleaned)  # Remove trailing commas
            cleaned = cleaned.replace("'", '"')  # Replace single quotes with double quotes
            return cleaned
        except Exception as e:
            logger.error(f"Error sanitizing JSON response: {e}")
            return response

    async def process_resume(self, filename: str, content: bytes) -> Dict:
        """Process a single resume, extract text, and structure output."""
        try:
            file_content = io.BytesIO(content)
            _, text = await self.extract_text(filename, file_content)
            if not text:
                logger.warning(f"No text extracted from {filename}")
                return None

            # Split text into chunks for processing
            chunks = self.text_splitter.split_text(text)
            if not chunks:
                logger.warning(f"No chunks created for {filename}")
                return None

            # Process with ChatGPT for structured output
            prompt = ChunkingPromptTemplate(text)
            try:
                response = await self._call_chatgpt_with_retry(
                    prompt.prompt, "You are expert in extracting structured content from resume text", 0.4
                )
                logger.debug(f"Raw ChatGPT response for {filename}: {response}")
            except Exception as e:
                logger.error(f"Failed to get valid ChatGPT response for {filename} after retries: {str(e)}")
                return None

            # Parse and structure response
            cleaned = self._sanitize_json_response(response)
            try:
                parsed = json.loads(cleaned)
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON response for {filename}: {str(e)}. Raw response: {cleaned}")
                # Fallback: Attempt to extract basic information
                parsed = {
                    "name": filename.split('.')[0],
                    "primary_skills": {},
                    "secondary_skills": {},
                    "work_history": [],
                    "education": {},
                    "email": "",
                    "linkedin_url": None,
                    "github_url": None,
                    "projects": [],
                    "course": {},
                    "certifications": [],
                    "raw_text": text
                }

            # Sanitize skills fields to ensure nested dictionary structure
            parsed['primary_skills'] = self._sanitize_skills(parsed.get('primary_skills', {}))
            parsed['secondary_skills'] = self._sanitize_skills(parsed.get('secondary_skills', {}))
            logger.debug(f"Processed skills for {filename}: primary={parsed['primary_skills']}, secondary={parsed['secondary_skills']}")

            # Calculate total experience
            total_exp = 0
            for rec in parsed.get('work_history', []):
                start = rec.get('start_date')
                end = rec.get('end_date') or "Sep 2025"
                if end.lower() == "present":
                    end = "Sep 2025"
                total_exp += compute_duration(start, end)

            # Structure output
            result = {
                'profile_id': str(uuid4()),
                'file_name': filename,
                'file_hash': hashlib.sha256(content).hexdigest(),
                'total_experience': total_exp,
                'processed_at': datetime.now(timezone.utc),
                'status': 'COMPLETED',
                'active': True,
                **parsed
            }
            return result
        except Exception as e:
            logger.error(f"Error processing resume {filename}: {e}")
            return None

    async def process_resumes(self, files: List[Tuple[str, bytes]]) -> Dict:
        """Process multiple resumes in parallel and store in MongoDB."""
        try:
            start_time = time.time()
            results = []
            batch_size = 8  # Optimized batch size
            for i in range(0, len(files), batch_size):
                batch = files[i:i + batch_size]
                batch_start = time.time()
                tasks = [self.process_resume(filename, content) for filename, content in batch]
                batch_results = await asyncio.gather(*tasks, return_exceptions=True)
                results.extend(batch_results)
                logger.info(f"Processed batch of {len(batch)} resumes in {(time.time() - batch_start):.2f} seconds")

            successful = []
            failed = []
            for (filename, _), result in zip(files, results):
                if isinstance(result, Exception) or result is None:
                    failed.append(filename)
                else:
                    # Convert datetime to string before storing
                    if "processed_at" in result and isinstance(result["processed_at"], datetime):
                        result["processed_at"] = result["processed_at"].isoformat()
                    successful.append(result)

            # Store in MongoDB
            if successful:
                mongo_start = time.time()
                insert_result = await self.collection.insert_many(successful)
                # Add MongoDB _id to results
                for i, result in enumerate(successful):
                    result["_id"] = str(insert_result.inserted_ids[i])  # Convert ObjectId to string
                logger.info(f"Stored {len(successful)} resumes in profiles in {(time.time() - mongo_start):.2f} seconds")

            total_time = time.time() - start_time
            return {
                "message": "Parsing completed successfully!" if not failed else "Parsing completed with errors!",
                "stats": {
                    "success_count": len(successful),
                    "failure_count": len(failed),
                    "failed_files": failed,
                    "total_count": len(files),
                    "parsed_content": {r['file_name']: r for r in successful},
                    "processing_time": total_time
                }
            }
        except Exception as e:
            logger.error(f"Error in process_resumes: {e}")
            raise

    def __del__(self):
        """Clean up ThreadPoolExecutor."""
        try:
            self.executor.shutdown(wait=True)
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")