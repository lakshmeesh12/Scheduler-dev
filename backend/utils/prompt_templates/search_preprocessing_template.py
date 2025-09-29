from ..chatgpt import run_chatgpt_prompt


class SearchProcessTemplate:
    def __init__(self, query):
        self.system_prompt = """You are an expert in natural language processing, specializing in intent recognition and keyword extraction. 
        Your task is to analyze queries that seek to identify user profiles with particular characteristics, 
        such as work experience and geographic locations. 
        """
        self.user_prompt = f"""**Input:** You will receive a user query (`{query}`) related to searching for user profiles. These queries typically mention skills, job titles, work experience attributes, project details, specific locations (City, State, country), and sometimes person names.

        **Core Task:**
        Analyze the query and generate a Python list of dictionaries. Each dictionary in the list represents a distinct search criterion or a combination of criteria found in the query (e.g., a specific skill linked to a specific location).

        **Output Format:**
        - A Python list `[]`.
        - Each element inside the list must be a dictionary.
        - Each dictionary can contain the following keywords, **only if** the corresponding information is present for that specific extracted criterion:
            `keywords`: A list of strings. Include meaningful search terms (nouns, noun chunks/phrases, organization name, key concepts, skills, technologies, job titles) extracted from the query.
                * **Crucially:** Convert verbs to their root form by removing common suffixes like `-ing` or `-ed` (e.g., "managing" -> "manage", "developed" -> "develop", "capping" -> "cap").
                * *Example Query:* "looking for project managers experienced in software development" -> `keywords: ['project manager', 'software develop']`
            
            
        **Instructions & Constraints:**

        1.  **Decomposition:** Break down the query. If a query mentions multiple distinct criteria create a *separate dictionary* for each distinct criterion set within the output list. Do not combine unrelated keywords and locations into a single dictionary record.
        2.  **Keyword Processing:** 
            * If there is a single word or a bigram or  short phrase in the query distinguish whether they are casual words or search terms and add them to keywords if they are not generic words like is, the, projects, etc
            * Strictly adhere to the verb root form conversion (remove `-ing`, `-ed`). Only include specific, meaningful keywords, excluding the generic terms listed above and any other simple/common words.
            * If any nouns containing any organization, location, association names or any specific entity name are provided add them to keywords.
            
        
        **Query:**
        {query}

        ** keywords considerations and constraints **

        Given a keyword containing a phrase or n-gram
            * if the n-gram is a specific term or a prpper noun refering to a specific organization, client name
            -> add a key `split` with boolean value `False` to the corresponding dictionary.
            * else if the keywords contain any action or any combinational terms which are not proper noun-chunk
            -> add a key `split` with boolean value `True` to the corresponding dictionary

        # Ignore generic words like experience, work, team, project, of, in, etc

        # Note -  The input query is not case sensitive

        example of keyword consideration cases: 
            query: Who has experience implementing RAG applications?
            dict(keywords: [RAG, Retrieval Augmented Generation, vector database], split: False)

        ** Keyword phrase Samples **
        Construction oversight, Construction administration, Construction management, Cost estimate, Engineer of Record (EOR), 
        Feasibility study, Groundwater-surface water interactions, Surface water permitting, Slope stability, Soft sediment, 
        Treatability study, Professional engineer, Professional geologist, Project manager, Remedial investigation, 
        Risk assessment, Water rights, Water quality.

        *Note* - Do not include generic words like experience, projects, work, certificate, design, etc in keywords field.

        **Example Scenarios:**

        * **Query:** "who is professional Engineer in Baltimore maryland with bridge design experience?"
            **Output:** `[{{'field_location': ('Baltimore Maryland', 'Baltimore MD'), 'keywords': ['professional engineer', 'bridge design']}}]`
        * **Query:** "find me experts in sediment capping or soil remediation in Houston TX and also project managers in Chicago Illinois"
            **Output:** `[{{'field_location': ('Houston, Texas', 'Houston, TX'), 'keywords': ['sediment cap', 'soil remediation']}}, {{'field_location': ('Chicago, Illinois', 'Chicago, IL'), 'keywords': ['project manager']}}]`
        * **Query:** "profiles mentioning machine learning"
            **Output:** `[{{'keywords': ['machine learn']}}]`
        * **Query:** "Verduin"
            **Output:** `[{{'names': ['verduin']}}]`
        * **Query:** "underpier"
            **Output:** [{{'keywords': ['underpier']}}]
        * **Query:** "who has American society of civil engineers association/organization?"
           **Output:** `[{{'keywords': ['American society of civil engineers']}}]`
        * **Query:** "Team members currently located in Seattle Washington"
            **Output:** `[{{'location': ('Seattle, Washington', 'Seattle, WA')}}]`
        * **Query:** "Purdue university and Bringham university"
            **Output:** `[{{'education': ['purdue university', 'Bringham university']}}]`
        """
        
if __name__ == "__main__":
    query = "who is Professional Engineer in the state of Maine?"
    filters = {"location": "L.A US"}
    template = SearchProcessTemplate(query, filters=filters)
    result = run_chatgpt_prompt(template.user_prompt, template.system_prompt)
    print(result)