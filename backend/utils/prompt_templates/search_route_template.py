from ..chatgpt import run_chatgpt_prompt


class QueryRoutePromptTemplate:
    def __init__(self, query, filters={}, add_filters = {}):
        self.system_prompt = """You are expert in understanding milvus schema and can route and create
        proper filter expressions by breaking down natural language query and some crude filter expressions as per schema and also considering additional filters based on
        given schema.
        You are given the profiles containing all the Domains. Understand terminologies/keywords and undersand their requirements and create suitable filters.
        """
        self.user_prompt = f"""You are an expert in translating natural language search queries into filter expressions for Milvus. Your goal is to produce a consistent, dictionary-formatted output that includes both a string expression and a detailed dictionary for field-specific filters.

        Instructions:
        1. **Query Analysis:**
        - Parse the user query (denoted as {query}) to extract keywords and their relationships.
          - If the query is job description text then strictly capture good to have or add on information excluding must have skills information.
          - If it is a sentence or a phrase without detailed job description then extract and categorize the sentence related to `learning` and `experience` as explained below.
        - Identify if the query targets specific fields or implies a general keyword search (e.g., proper nouns, names).
        - Condense the query into only two sentences containing learning information and experience information and then build filter expressions on top of it.

        2. **Mapping Keywords to Schema:**
        - Map query keywords to the Milvus schema based on the following field definitions:
            - **name:** complete name of the employee
            - **job_title:** current job position (latest) (ex: Construction Manager/Environment Planner) (Use Like to query)
            - **total_experience:** total experience in years
            - **type:** determines the context of the page_content field (values: bio_sketch, work_history, projects, education, certifications, publications)
            - **content:** text details corresponding to the type
        
        - The schema is divided into two vertical sections based on the `type` field 
          - `learning`: consists of text from courses, certifications, education information
          - `experience`: consists of text from projects, work history, skills and achievements information

          Thus type=='learning' and type=='experience' can be used to access the relevant fields resepectively. 
            
        3. **Handling Special Keywords:**
        - **Certification Terms:** If the query contains words like “certification” or “certified,” ensure the filter type is  `"type" == "learning"`.
        - **Publication Terms:** If the query contains words like 'presentation' or 'publication', ensure the filter type is '`"type" == "learning"`.

        4. **Filter Expression Creation:**
        - Use brackets wherever required for better queries.
        - Construct filter expressions using the `==` operator for exact matches (never use `=`) or use 'like' operatoe wherever needed.
        - For content fields and less critical filters, build expressions using the OR operator for a broader, exact match.
        - Only create numerical comparisons (e.g., for total_experience) when necessary, based on the schema data type.
        - Merge filters derived from the query with filters (denoted as filters).
        - When searching for work_experience also include type projects
        - User OR logic and Like logic when searching keywords in content field. Use LIKE operator in combination with (unigrams OR bi-grams OR entire searching term) keywords which actually makes sense.
        - Do not search generalized action keywords for searching in content such as design, experience, corporation etc.
        - Use the keys in **additional filter** as type for certifications and use the rest of them for direct keyword comparison.
           

        5. **Output Format:**
        - Your final output must be a dictionary with one key:
            - `"expr"`: A single string representing the combined filter expression.
        - Do not output any extra text; only print the dictionary.

        **Important:**
        - Strictly Use [] to wrap fields when using IN operator.
        - Always prioritize clarity and consistency in filter expression generation.
        - Use the LIKE operator for partial matches in location-related searches, ensuring state names are considered in both state name and abbrevation form (e.g., for query with location Houston TX or Houston Texas -> consider both "Houston, Texas" → "Houston, TX").
        - Strictly use fields like job_title and department only if mentioned
        - Strictly when using like make sure it is '%keyword%' format.
        ### Ensure the syntax of the generated filter to be always correct and is parsable by milvus ###
        
        User Query: {query}
        Filters: {filters}
        Additional Filters: {add_filters}
    
    ### Consider building filters using both the User Query and Additional Filters.
    ### Make sure that the syntax of the generated expression is correct.
    """
        
if __name__ == "__main__":
    query = "Find candidate with more than 5 years experience in environmental planning."
    filters = {"location": "L.A US"}
    template = QueryRoutePromptTemplate(query, filters=filters)
    result = run_chatgpt_prompt(template.user_prompt, template.system_prompt)
    print(result)