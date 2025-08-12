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
        - Each dictionary can contain the following keys, **only if** the corresponding information is present for that specific extracted criterion:
            1.  `field_location`: Use this key **only** when a location (City, State) is explicitly associated with a specific skill, experience, project, or attribute mentioned in the query. The value must be a tuple containing the full location string and an abbreviated version: `('City StateName', 'City ST')`.
                * *Example Query:* "find engineers with bridge design experience in Sacramento California" -> `field_location: ('Sacramento California', 'Sacramento CA')`
            2.  `location`: Use this key **only** when the query asks for the *current* location of individuals (City, State, country) and it's *not* directly tied to a specific experience/project mentioned in the *same phrase*. The value format is the same tuple as `field_location`: `('City StateName', 'City ST')`.
                * *Example Query:* "who lives in Austin Texas?" -> `location: ('Austin Texas', 'Austin TX')`
            3.  `keywords`: A list of strings. Include meaningful search terms (nouns, noun chunks/phrases, organization name, key concepts, skills, technologies, job titles) extracted from the query.
                * **Crucially:** Convert verbs to their root form by removing common suffixes like `-ing` or `-ed` (e.g., "managing" -> "manage", "developed" -> "develop", "capping" -> "cap").
                * **Exclude:** Locations (handled by `location`/`field_location`), names (handled by `names`), and keywords generic/common words (e.g., 'experience', 'projects', 'certification', 'publications', 'team', 'work', 'professional', 'people', 'person', 'with', 'in', 'who', 'are', 'the', 'a', 'is', etc.). Focus on the *specific* distinguishing terms.
                * *Example Query:* "looking for project managers experienced in software development" -> `keywords: ['project manager', 'software develop']`
            4.  `names`: A list of strings containing any person names or anything that may look like names mentioned in the query. Extract names case-insensitively but preserve original casing in the output list.
                * *Example Query:* "find projects by John Verduin in Boston MA" -> `names: ['John Verduin']`
                   (Note: If any keyword or term in un-identified consider it to be name)
            6.  `education`: If the query keywords contains institution/university name or degree name like Bachelors or masters then add them under the education section as individual terms in list.
                * *Example Query:* "bachelors in computer science in California university" -> `education`: ['Bachelors', 'computer science', 'california universiry']

        **Instructions & Constraints:**

        1.  **Decomposition:** Break down the query. If a query mentions multiple distinct criteria (e.g., Skill A in Location X *and* Skill B in Location Y), create a *separate dictionary* for each distinct criterion set within the output list. Do not combine unrelated keywords and locations into a single dictionary record.
        2.  **Keyword Processing:** 
            * If there is a single word or a bigram or  short phrase in the query distinguish whether they are casual words or search terms and add them to keywords if they are not generic words like is, the, projects, etc
            * Strictly adhere to the verb root form conversion (remove `-ing`, `-ed`). Only include specific, meaningful keywords, excluding the generic terms listed above and any other simple/common words.
            * If any nouns containing any organization, location, association names or any specific entity name are provided add them to keywords.
            
        3.  **Location Specificity:**
            * `location` and `field_location` keys are **strictly** for locations mentioned as City, State.
            * field location can contain long form or short form of state names if mentioned do consider both long and short forms in search
            * Use `field_location` if the location is tied to a keyword/experience in the phrase.
            * Use `location` only for current/general location requests not tied to a specific experience keyword in the same phrase.
            * Always use the tuple format `('City StateName', 'City ST')` for states. You may need internal knowledge or a tool to map state names to abbreviations.
        4.  **Field Presence:** Only include a key (`location`, `field_location`, `keywords`, `names`) in a dictionary if relevant information is actually found for that specific criterion set in the query. Do not include keys with empty values (e.g., `keywords: []` if no keywords apply to that specific record).
        5.  **No Extra Output:** Generate *only* the Python list of dictionaries. Do not include any introductory text, explanations, or concluding remarks.
        6.  **Case Handling:** Keyword extraction should generally be case-insensitive, but the output keywords should preferably be lowercase. Names should be extracted case-insensitively but outputted with original casing.
        7.  **Names:** Strictly capture names if present in query.
        
        **Query:**
        {query}

        ** keywords considerations and constraints **

        Given a keyword containing a phrase or n-gram
            * if the n-gram is a specific term or a prpper noun refering to a specific organization, client name, or name of place (port, forest, etc)
            -> add a key `split` with boolean value `False` to the corresponding dictionary.
            * else if the keywords contain any action or any combinational terms which are not proper noun-chunk
            -> add a key `split` with boolean value `True` to the corresponding dictionary

        # Ignore generic words like experience, work, team, project, of, in, etc

        # Note -  The input query is not case sensitive

        example of keyword consideration cases: 
            query: Who has experience working in National park service?
            dict(keywords: [national park service], split: False)

            query: who has sediment capping experience in Texas?
            dict(keywords: [sediment cap], split: True)

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