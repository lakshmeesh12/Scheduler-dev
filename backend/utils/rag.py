import re
from langchain_community.vectorstores import Milvus
from typing import List, Dict, Any
from collections import Counter, defaultdict
from typing import List, Dict, Any
from dataclasses import dataclass
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EnhancedMilvusSearch:
    def __init__(self, vector_store: Milvus, filter_fields: List[str]):
        self.vector_store = vector_store
        self.filter_fields = filter_fields
        logger.info(f"Initialized EnhancedMilvusSearch with filter_fields: {filter_fields}")
        
    def analyze_keyword_matches(
        self, 
        query: str, 
        doc: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze keyword matches in document fields"""
        # Extract keywords from query
        keywords = set(re.findall(r'\b\w+\b', query.lower()))
        matches = {field: 0 for field in self.filter_fields}
        total_matches = 0
        
        # Count matches in each field
        for field in self.filter_fields:
            if field in doc:
                field_text = str(doc[field]).lower()
                field_matches = sum(1 for kw in keywords if kw in field_text)
                matches[field] = field_matches
                total_matches += field_matches
                
        return {
            "field_matches": matches,
            "total_matches": total_matches,
            "match_ratio": total_matches / len(keywords) if keywords else 0
        }

    def hybrid_search_with_analytics(
        self,
        query: str,
        k: int = 10,
        filter_expr: str = None,
        score_threshold: float = 0.25,
        field_weights: Dict[str, float] = None
    ) -> List[Dict[str, Any]]:
        """Enhanced hybrid search with keyword matching analysis"""
        # Default field weights
        if field_weights is None:
            field_weights = {field: 1.0 for field in self.filter_fields}

        logger.info(f"Performing hybrid search with query: {query[:100]}..., k={k}, filter_expr={filter_expr}, text_field='content'")

        # Perform vector search
        try:
            vector_results = self.vector_store.similarity_search_with_relevance_scores(
                query,
                k=k,
                filter=filter_expr,
                text_field="content"  # Explicitly specify the text field
            )
            logger.info(f"Hybrid search returned {len(vector_results)} results")
        except Exception as e:
            logger.error(f"Hybrid search failed: {str(e)}")
            raise

        enhanced_results = []
        for doc, vector_score in vector_results:
            # Analyze keyword matches
            keyword_analysis = self.analyze_keyword_matches(query, doc.metadata)
            
            # Calculate weighted keyword score
            weighted_keyword_score = sum(
                field_weights.get(field, 1.0) * matches 
                for field, matches in keyword_analysis["field_matches"].items()
            ) / sum(field_weights.values())

            # Normalize vector score (assuming cosine similarity)
            norm_vector_score = 1 - (vector_score / 2)

            # Combined scoring
            combined_score = (norm_vector_score + weighted_keyword_score) / 2

            if combined_score >= score_threshold:
                enhanced_results.append({
                    "document": doc,
                    "vector_score": norm_vector_score,
                    "keyword_analysis": keyword_analysis,
                    "weighted_keyword_score": weighted_keyword_score,
                    "combined_score": combined_score
                })

        # Sort by combined score
        enhanced_results.sort(key=lambda x: x["combined_score"], reverse=True)
        return enhanced_results

    def get_match_highlights(
        self, 
        query: str, 
        doc: Dict[str, Any]
    ) -> Dict[str, List[str]]:
        """Extract matching context snippets"""
        keywords = set(re.findall(r'\b\w+\b', query.lower()))
        highlights = {}

        for field in self.filter_fields:
            if field in doc:
                text = str(doc[field])
                matches = []
                
                # Extract context around matches
                for keyword in keywords:
                    pattern = re.compile(f'[^.]*{keyword}[^.]*\.', re.I)
                    matches.extend(pattern.findall(text))
                
                if matches:
                    highlights[field] = matches

        return highlights


async def merge_unique_results(results_list: List[List[Dict]], top_k: int = 10) -> List[Dict]:
    """
    Merge multiple result lists and return unique results based on user_id
    
    :param results_list: List of result lists from different collections
    :param top_k: Number of top results to return
    :return: List of unique merged results
    """
    try:
        merged_dict = {}
        
        # Process each result list
        for collection_results in results_list:
            for result in collection_results:
                user_id = result['document'].metadata.get('user_id')
                
                if user_id not in merged_dict:
                    # First occurrence of this user_id
                    merged_dict[user_id] = {
                        'metadata': result['document'].metadata,
                        'page_content': result['document'].page_content,
                        'best_vector_score': result['vector_score'],
                        'best_keyword_score': result['weighted_keyword_score'],
                        'best_combined_score': result['combined_score'],
                        'keyword_analyses': [result['keyword_analysis']],
                        'appearance_count': 1
                    }
                else:
                    # Update existing record if better scores are found
                    existing = merged_dict[user_id]
                    
                    # Update best scores
                    if result['vector_score'] > existing['best_vector_score']:
                        existing['best_vector_score'] = result['vector_score']
                    
                    if result['weighted_keyword_score'] > existing['best_keyword_score']:
                        existing['best_keyword_score'] = result['weighted_keyword_score']
                    
                    if result['combined_score'] > existing['best_combined_score']:
                        existing['best_combined_score'] = result['combined_score']
                        # Update metadata and page content from the best result
                        existing['metadata'] = result['document'].metadata
                        existing['page_content'] = result['document'].page_content
                    
                    # Add keyword analysis
                    existing['keyword_analyses'].append(result['keyword_analysis'])
                    existing['appearance_count'] += 1
        
        # Convert to list and calculate final scores
        final_results = []
        for user_id, data in merged_dict.items():
            # Calculate aggregate keyword analysis
            total_matches = sum(ka['total_matches'] for ka in data['keyword_analyses'])
            avg_match_ratio = sum(ka['match_ratio'] for ka in data['keyword_analyses']) / len(data['keyword_analyses'])
            
            # Create final result entry
            final_result = {
                'user_id': user_id,
                'metadata': data['metadata'],
                'page_content': data['page_content'],
                'scores': {
                    'final_score': (data['best_combined_score'] * 
                                (1 + 0.1 * (data['appearance_count'] - 1)))  # Boost for multiple appearances
                },
                'search_metrics': {
                    'appearance_count': data['appearance_count'],
                    'total_keyword_matches': total_matches,
                    'average_match_ratio': avg_match_ratio
                }
            }
            final_results.append(final_result)
        
        # Sort by final score and return top_k
        sorted_results = sorted(
            final_results,
            key=lambda x: x['scores']['final_score'],
            reverse=True
        )[:top_k]
        
        return sorted_results
    except Exception as e:
        logger.error(f"Error while merging results: {str(e)}")
        return []