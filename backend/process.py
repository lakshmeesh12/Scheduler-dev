from datetime import datetime
import os
from collections import defaultdict
import re
from typing import Dict, List, Optional
import asyncio
import aiofiles
import time
import json
import tempfile
import shutil
from pathlib import Path
from uuid import uuid4
import logging
from typing import List, Dict, Any
from fastapi import FastAPI, File, UploadFile
from pydantic import BaseModel, Field


class ResumeProcessor:
    """Class to handle resume processing operations"""
    
    ALLOWED_EXTENSIONS = {'pdf', 'docx'}
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB per file
    MAX_FILES = 500  # Maximum number of files to process
    TEMP_DIR = "temp"
    
    def __init__(self):
        self.ensure_temp_directory()
    
    def ensure_temp_directory(self):
        """Ensure temp directory exists"""
        os.makedirs(self.TEMP_DIR, exist_ok=True)
    
    def validate_file(self, file: UploadFile) -> Dict[str, Any]:
        """Validate individual file"""
        if not file.filename:
            return {"valid": False, "error": "File has no name"}
        
        # Check file extension
        file_extension = file.filename.split('.')[-1].lower()
        if file_extension not in self.ALLOWED_EXTENSIONS:
            return {
                "valid": False, 
                "error": f"Invalid file type: {file_extension}. Allowed types: {', '.join(self.ALLOWED_EXTENSIONS)}"
            }
        
        # Check file size (note: this is approximate as we haven't read the file yet)
        if hasattr(file, 'size') and file.size and file.size > self.MAX_FILE_SIZE:
            return {
                "valid": False, 
                "error": f"File too large: {file.size} bytes. Maximum allowed: {self.MAX_FILE_SIZE} bytes"
            }
        
        return {"valid": True}
    
    async def save_uploaded_file(self, file: UploadFile) -> Dict[str, Any]:
        """Save uploaded file to temp directory"""
        try:
            file_path = os.path.join(self.TEMP_DIR, file.filename)
            
            # Read file content and check actual size
            content = await file.read()
            if len(content) > self.MAX_FILE_SIZE:
                return {
                    "success": False, 
                    "error": f"File too large: {len(content)} bytes. Maximum allowed: {self.MAX_FILE_SIZE} bytes"
                }
            
            # Save file
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(content)
            
            return {"success": True, "path": file_path}
        
        except Exception as e:
            logger.error(f"Error saving file {file.filename}: {str(e)}")
            return {"success": False, "error": f"Failed to save file: {str(e)}"}
    
    async def read_file_async(self, file_path: str) -> Dict[str, Any]:
        """Read file content asynchronously"""
        try:
            if not os.path.exists(file_path):
                return {"success": False, "error": f"File not found: {file_path}"}
            
            async with aiofiles.open(file_path, mode='r', encoding='utf-8') as f:
                content = await f.read()
                return {"success": True, "content": content}
        
        except UnicodeDecodeError:
            # Try reading as binary if UTF-8 fails
            try:
                async with aiofiles.open(file_path, mode='rb') as f:
                    content = await f.read()
                    return {"success": True, "content": content.decode('utf-8', errors='ignore')}
            except Exception as e:
                return {"success": False, "error": f"Error reading file as binary: {str(e)}"}
        
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {str(e)}")
            return {"success": False, "error": f"Error reading file: {str(e)}"}
    
    async def read_multiple_files(self, file_paths: List[str]) -> Dict[str, Any]:
        """Read multiple files concurrently"""
        tasks = [self.read_file_async(file_path) for file_path in file_paths]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        successful_files = {}
        failed_files = {}
        
        for file_path, result in zip(file_paths, results):
            if isinstance(result, Exception):
                failed_files[file_path] = f"Exception occurred: {str(result)}"
            elif result["success"]:
                successful_files[file_path] = result["content"]
            else:
                failed_files[file_path] = result["error"]
        
        return {"successful": successful_files, "failed": failed_files}
    
    def cleanup_files(self, file_paths: List[str]):
        """Clean up temporary files"""
        for file_path in file_paths:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                logger.warning(f"Failed to clean up file {file_path}: {str(e)}")

class JobRequirements(BaseModel):
    """Model for job requirements"""
    skills: List[str] = Field(..., min_items=1, description="Required skills")
    experience_years: Optional[int] = Field(None, ge=0, le=50, description="Required years of experience")
    education: Optional[str] = Field(None, max_length=200, description="Education requirements")
    certifications: Optional[List[str]] = Field(default=[], description="Required certifications")
    
    # @validator('skills')
    # def validate_skills(cls, v):
    #     if not v or all(not skill.strip() for skill in v):
    #         raise ValueError('At least one valid skill is required')
    #     return [skill.strip() for skill in v if skill.strip()]

class JobDescription(BaseModel):
    """Model for job description data validation"""
    job_title: str = Field(..., min_length=2, max_length=200, description="Job title")
    company_name: str = Field(..., min_length=2, max_length=200, description="Company name")
    job_description: str = Field(..., min_length=10, max_length=5000, description="Detailed job description")
    location: Optional[str] = Field(None, max_length=200, description="Job location")
    employment_type: Optional[str] = Field(None, description="Employment type (full-time, part-time, contract, etc.)")
    salary_range: Optional[str] = Field(None, max_length=100, description="Salary range")
    requirements: JobRequirements = Field(..., description="Job requirements")
    responsibilities: Optional[List[str]] = Field(default=[], description="Job responsibilities")
    benefits: Optional[List[str]] = Field(default=[], description="Job benefits")
    
    # @validator('job_title', 'company_name', 'job_description')
    # def validate_strings(cls, v):
    #     if not v or not v.strip():
    #         raise ValueError('Field cannot be empty or whitespace only')
    #     return v.strip()
    
    # @validator('employment_type')
    # def validate_employment_type(cls, v):
    #     if v:
    #         valid_types = ['full-time', 'part-time', 'contract', 'temporary', 'internship', 'freelance']
    #         if v.lower() not in valid_types:
    #             raise ValueError(f'Employment type must be one of: {", ".join(valid_types)}')
    #         return v.lower()
    #     return v

class JDProcessor:
    """Class to handle Job Description processing operations"""
    
    def __init__(self):
        self.processed_jds = {}  # In-memory storage for processed JDs
    
    def validate_jd_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate job description data"""
        try:
            # Parse and validate using Pydantic model
            jd_model = JobDescription(**data)
            return {"valid": True, "data": jd_model.dict()}
        except Exception as e:
            return {"valid": False, "error": str(e)}
    
    def generate_jd_summary(self, jd_data: JobDescription) -> Dict[str, Any]:
        """Generate a summary of the job description for matching purposes"""
        try:
            summary = {
                "jd_id": str(uuid4()),
                "job_title": jd_data.job_title,
                "company_name": jd_data.company_name,
                "key_skills": jd_data.requirements.skills,
                "experience_required": jd_data.requirements.experience_years,
                "education_required": jd_data.requirements.education,
                "location": jd_data.location,
                "employment_type": jd_data.employment_type,
                "total_requirements": len(jd_data.requirements.skills) + len(jd_data.requirements.certifications),
                "created_at": time.time(),
                "word_count": len(jd_data.job_description.split()),
                "responsibilities_count": len(jd_data.responsibilities),
                "benefits_count": len(jd_data.benefits)
            }
            return {"success": True, "summary": summary}
        except Exception as e:
            print(f"Error generating JD summary: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def store_jd_temporarily(self, jd_id: str, jd_data: Dict[str, Any], summary: Dict[str, Any]):
        """Store JD data temporarily in memory"""
        self.processed_jds[jd_id] = {
            "jd_data": jd_data,
            "summary": summary,
            "processed_at": time.time(),
            "status": "active"
        }
        print(f"JD {jd_id} stored temporarily for processing")
    
    def get_jd(self, jd_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve stored JD by ID"""
        return self.processed_jds.get(jd_id)
    
    def get_all_active_jds(self) -> List[Dict[str, Any]]:
        """Get all active JDs"""
        return [
            {
                "jd_id": jd_id,
                **jd_info["summary"]
            }
            for jd_id, jd_info in self.processed_jds.items()
            if jd_info["status"] == "active"
        ]
    
    def cleanup_old_jds(self, max_age_hours: int = 24):
        """Clean up JDs older than specified hours"""
        current_time = time.time()
        max_age_seconds = max_age_hours * 3600
        
        expired_jds = [
            jd_id for jd_id, jd_info in self.processed_jds.items()
            if current_time - jd_info["processed_at"] > max_age_seconds
        ]
        
        for jd_id in expired_jds:
            del self.processed_jds[jd_id]
        
        if expired_jds:
            print(f"Cleaned up {len(expired_jds)} expired JDs")


class GenericSkillMatcher:
    def __init__(self, priority_weights: Dict[str, float] = None, category_weights: Dict[str, float] = None):
        self.priority_weights = priority_weights or {}
        self.category_weights = category_weights or {}
        
        self.default_category_weights = {
            'languages': 1.5,
            'frameworks': 1.5,
            'libraries': 1.0,
            'technologies': 1.0,
            'tools': 1,
            'concepts': 0.8,
        }
    
    def normalize_text(self, text: str) -> str:
        return re.sub(r'[^\w\s]', '', text.lower().strip())
    
    def extract_all_skills(self, skills_data: Dict) -> Dict[str, List[str]]:
        flattened_skills = defaultdict(list)
        
        for domain, categories in skills_data.items():
            for category, skills_list in categories.items():
                normalized_category = self.normalize_text(category)
                flattened_skills[normalized_category].extend(skills_list)
        
        return dict(flattened_skills)
    
    def get_skill_priority(self, skill: str) -> float:
        normalized_skill = self.normalize_text(skill)
        return self.priority_weights.get(normalized_skill, 1.0)
    
    def get_category_weight(self, category: str) -> float:
        normalized_category = self.normalize_text(category)
        return (self.category_weights.get(normalized_category) or 
                self.default_category_weights.get(normalized_category, 1.0))
    
    def find_exact_matches(self, resume_skills: List[str], job_skills: List[str]) -> List[tuple]:
        matches = []
        resume_normalized = {self.normalize_text(skill): skill for skill in resume_skills}
        
        for job_skill in job_skills:
            normalized_job_skill = self.normalize_text(job_skill)
            
            if normalized_job_skill in resume_normalized:
                priority = self.get_skill_priority(job_skill)
                matches.append((resume_normalized[normalized_job_skill], job_skill, priority))
        
        return matches
    
    def calculate_category_metrics(self, matches: List[tuple], total_job_skills: int, category: str) -> Dict:
        if total_job_skills == 0:
            return {
                'matched_count': 0,
                'total_required': 0,
                'coverage_ratio': 0.0,
                'priority_score': 0.0,
                'weighted_score': 0.0,
                'high_priority_coverage': 0.0,
                'matches': []
            }
        
        matched_count = len(matches)
        coverage_ratio = matched_count / total_job_skills
        
        if matches:
            total_priority = sum(priority for _, _, priority in matches)
            max_possible_priority = sum(self.get_skill_priority(skill) 
                                      for _, skill, _ in matches) if matches else 0
            priority_score = total_priority / max_possible_priority if max_possible_priority > 0 else 0.0
        else:
            priority_score = 0.0
        
        high_priority_matches = [m for m in matches if m[2] > 1.0]
        high_priority_coverage = len(high_priority_matches) / matched_count if matched_count > 0 else 0.0
        
        category_weight = self.get_category_weight(category)
        weighted_score = (coverage_ratio * 0.4 + priority_score * 0.6) * category_weight
        
        return {
            'matched_count': matched_count,
            'total_required': total_job_skills,
            'coverage_ratio': coverage_ratio,
            'priority_score': priority_score,
            'weighted_score': weighted_score,
            'high_priority_coverage': high_priority_coverage,
            'matches': matches,
            'category_weight': category_weight
        }
    
    def calculate_average_coverage_ratio(self, resume_skills: Dict, job_skills: Dict, 
                                        category_weights: Dict[str, float] = None) -> Dict:
        """
        Calculate average coverage ratio based on category-level matching.
        
        Coverage Logic:
        - For each domain, check if ALL categories have at least one skill match
        - If all categories in a domain are covered: domain coverage = 1.0
        - If any category is missing matches: domain coverage = 0.0
        - Average coverage = weighted average of all domain coverages
        
        Args:
            resume_skills: Skills from resume in nested format
            job_skills: Required skills from job in nested format  
            category_weights: Optional weights for specific categories
            
        Returns:
            Dict containing coverage details and weighted average
        """
        if not job_skills:
            return {
                'average_coverage_ratio': 0.0,
                'domain_coverage': {},
                'category_match_details': {},
                'total_domains': 0,
                'covered_domains': 0,
                'weighted_coverage': 0.0
            }
        
        category_weights = category_weights or {}
        domain_coverage = {}
        category_match_details = {}
        
        # Process each domain in job skills
        for domain, job_categories in job_skills.items():
            resume_domain_skills = resume_skills.get(domain, {})
            domain_categories_covered = 0
            total_domain_categories = len(job_categories)
            
            domain_details = {
                'total_categories': total_domain_categories,
                'covered_categories': 0,
                'category_matches': {}
            }
            
            # Check each category within the domain
            for category, job_skills_list in job_categories.items():
                resume_skills_list = resume_domain_skills.get(category, [])
                
                # Check if any skill in this category matches
                category_has_match = False
                matched_skills = []
                
                if resume_skills_list:
                    # Normalize skills for comparison
                    resume_normalized = {self.normalize_text(skill): skill 
                                       for skill in resume_skills_list}
                    
                    for job_skill in job_skills_list:
                        normalized_job_skill = self.normalize_text(job_skill)
                        if normalized_job_skill in resume_normalized:
                            category_has_match = True
                            matched_skills.append(job_skill)
                
                # Record category match details
                domain_details['category_matches'][category] = {
                    'has_match': category_has_match,
                    'matched_skills': matched_skills,
                    'required_skills': job_skills_list,
                    'total_required': len(job_skills_list),
                    'total_matched': len(matched_skills)
                }
                
                if category_has_match:
                    domain_categories_covered += 1
            
            # Domain is covered only if ALL categories have at least one match
            domain_is_fully_covered = (domain_categories_covered == total_domain_categories)
            domain_coverage[domain] = 1.0 if domain_is_fully_covered else 0.0
            
            domain_details['covered_categories'] = domain_categories_covered
            domain_details['is_fully_covered'] = domain_is_fully_covered
            domain_details['coverage_ratio'] = domain_categories_covered / total_domain_categories
            
            category_match_details[domain] = domain_details
        
        # Calculate weighted average coverage
        total_weight = 0.0
        weighted_sum = 0.0
        
        for domain, coverage in domain_coverage.items():
            # Get weight for this domain (default 1.0)
            weight = category_weights.get(self.normalize_text(domain), 1.0)
            weighted_sum += coverage * weight
            total_weight += weight
        
        # Calculate averages
        average_coverage = sum(domain_coverage.values()) / len(domain_coverage) if domain_coverage else 0.0
        weighted_coverage = weighted_sum / total_weight if total_weight > 0 else 0.0
        covered_domains = sum(1 for coverage in domain_coverage.values() if coverage == 1.0)
        
        return {
            'average_coverage_ratio': round(average_coverage, 3),
            'weighted_coverage_ratio': round(weighted_coverage, 3),
            'domain_coverage': domain_coverage,
            'category_match_details': category_match_details,
            'total_domains': len(domain_coverage),
            'covered_domains': covered_domains,
            'coverage_summary': {
                'fully_covered_domains': [domain for domain, coverage in domain_coverage.items() if coverage == 1.0],
                'partially_covered_domains': [domain for domain, details in category_match_details.items() 
                                            if details['covered_categories'] > 0 and not details['is_fully_covered']],
                'uncovered_domains': [domain for domain, coverage in domain_coverage.items() if coverage == 0.0]
            }
        }
    
    def calculate_skill_match_score(self, resume_skills: Dict, job_skills: Dict) -> Dict:
        try:
            resume_by_category = self.extract_all_skills(resume_skills)
            job_by_category = self.extract_all_skills(job_skills)
            
            category_results = {}
            all_matches = []
            total_weighted_score = 0.0
            total_categories = 0
            
            for category, job_category_skills in job_by_category.items():
                resume_category_skills = resume_by_category.get(category, [])
                matches = self.find_exact_matches(resume_category_skills, job_category_skills)
                category_metrics = self.calculate_category_metrics(matches, len(job_category_skills), category)
                
                category_results[category] = category_metrics
                all_matches.extend(matches)
                total_weighted_score += category_metrics['weighted_score']
                total_categories += 1
            
            overall_score = total_weighted_score / total_categories if total_categories > 0 else 0.0
            total_required_skills = sum(len(skills) for skills in job_by_category.values())
            total_matched_skills = sum(result['matched_count'] for result in category_results.values())
            overall_coverage = total_matched_skills / total_required_skills if total_required_skills > 0 else 0.0
            
            if all_matches:
                total_priority_score = sum(priority for _, _, priority in all_matches)
                max_priority = len(all_matches)
                overall_priority_quality = total_priority_score / max_priority
            else:
                overall_priority_quality = 0.0
            
            high_priority_required = sum(1 for _, _, priority in 
                                    [(cat, skill, self.get_skill_priority(skill)) 
                                        for cat, skills in job_by_category.items() 
                                        for skill in skills] if priority > 1.0)
            
            high_priority_matched = sum(1 for _, _, priority in all_matches if priority > 1.0)
            high_priority_ratio = (high_priority_matched / high_priority_required 
                                if high_priority_required > 0 else 1.0)
            

            coverage_result = self.calculate_average_coverage_ratio(resume_skills, job_skills)
            
            return {
                'overall_score': round(overall_score, 2),
                'coverage_score': round(overall_coverage, 2),
                'high_priority_match_ratio': round(high_priority_ratio, 2),
                'average_coverage_ratio': coverage_result['average_coverage_ratio'],
                'weighted_coverage_ratio': coverage_result['weighted_coverage_ratio'],
                'skill_counts': {
                    'total_matched': total_matched_skills,
                    'total_required': total_required_skills,
                    'high_priority_matched': high_priority_matched,
                    'high_priority_required': high_priority_required
                },
                'coverage_details': coverage_result
            }
        except Exception as err:
            print(err)
            return {}


class SkillPriority(BaseModel):
    high_priority_skills: Optional[List[str]] = []
    medium_priority_skills: Optional[List[str]] = []
    category_weights: Optional[Dict[str, float]] = {}


def extract_skill_names(skills_dict: Dict) -> List[str]:
    """Extract all skill names from nested skills dictionary"""
    all_skills = []
    for domain, categories in skills_dict.items():
        for category, skills_list in categories.items():
            all_skills.extend(skills_list)
    return all_skills

class SkillMatchDetails(BaseModel):
    matched_skills: List[str]
    missing_skills: List[str]
    total_matched: int
    total_required: int
    match_percentage: float

class AggregatedScore(BaseModel):
    resume_name: str
    resume_id: str
    aggregated_score: float
    score_breakdown: Dict[str, float]
    primary_vs_primary: SkillMatchDetails
    secondary_vs_secondary: SkillMatchDetails
    rank: Optional[int] = None

class MatchingResponse(BaseModel):
    jd_text: str
    job_title: str
    total_resumes_processed: int
    matching_results: List[AggregatedScore]
    timestamp: datetime
    execution_time_ms: float

def get_skill_match_details(resume_skills: Dict, job_skills: Dict, matcher: GenericSkillMatcher) -> SkillMatchDetails:
    """Get detailed skill matching information including matched and missing skills"""
    resume_skill_names = set(extract_skill_names(resume_skills))
    job_skill_names = set(extract_skill_names(job_skills))
    
    # Find matched skills (case-insensitive)
    resume_normalized = {matcher.normalize_text(skill): skill for skill in resume_skill_names}
    job_normalized = {matcher.normalize_text(skill): skill for skill in job_skill_names}
    
    matched_skills = []
    missing_skills = []
    
    for normalized_job_skill, original_job_skill in job_normalized.items():
        if normalized_job_skill in resume_normalized:
            matched_skills.append(original_job_skill)
        else:
            missing_skills.append(original_job_skill)
    
    total_required = len(job_skill_names)
    total_matched = len(matched_skills)
    match_percentage = (total_matched / total_required) if total_required > 0 else 0.0
    
    return SkillMatchDetails(
        matched_skills=sorted(matched_skills),
        missing_skills=sorted(missing_skills),
        total_matched=total_matched,
        total_required=total_required,
        match_percentage=round(match_percentage, 2)
    )

def create_skill_matcher(job_description: Dict, skill_priorities: SkillPriority = None) -> GenericSkillMatcher:
    """Create a skill matcher based on job requirements and optional priorities"""
    priority_weights = {}
    category_weights = {}
    
    if skill_priorities:
        # High priority skills (weight: 1.5)
        for skill in skill_priorities.high_priority_skills:
            priority_weights[skill.lower().strip()] = 1.5
        
        # Medium priority skills (weight: 1.2)
        for skill in skill_priorities.medium_priority_skills:
            priority_weights[skill.lower().strip()] = 1.2