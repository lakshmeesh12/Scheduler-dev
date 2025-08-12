from ..chatgpt import run_chatgpt_prompt


class QueryRoutePromptTemplate:
    def __init__(self, query, filters={}, add_filters = {}):
        self.system_prompt = """You are expert in understanding milvus schema and can route and create
        proper filter expressions by breaking down natural language query and some crude filter expressions as per schema and also considering additional filters based on
        given schema.
        You are given Environmental Science and Construction Domain related profiles. Understand their work and undersand their requirements and create suitable filters.
        """
        self.user_prompt = f"""You are an expert in translating natural language search queries into filter expressions for Milvus. Your goal is to produce a consistent, dictionary-formatted output that includes both a string expression and a detailed dictionary for field-specific filters.

        Instructions:
        1. **Query Analysis:**
        - Parse the user query (denoted as {query}) to extract keywords and their relationships.
        - Identify if the query targets specific fields or implies a general keyword search (e.g., proper nouns, names).

        2. **Mapping Keywords to Schema:**
        - Map query keywords to the Milvus schema based on the following field definitions:
            - **first_name:** first name of the employee
            - **last_name:** last name of the employee
            - **name:** complete name of the employee
            - **location:** employee’s current location (use when provided in additional filters)
            - **job_title:** current job position (latest) (ex: Construction Manager/Environment Planner) (Use Like to query)
            - **department:** work department (ex: Construction Management)
            - **field_location:** location related to projects, work history, or education (use when the query asks about location aligned with some context)
            - **total_experience:** total experience in years
            - **type:** determines the context of the page_content field (values: bio_sketch, work_history, projects, education, certifications, publications)
            - **content:** text details corresponding to the type
            
        - For ambiguous name searches (e.g., when "name" is mentioned without specifying first or last), use first_name LIKE '%name' OR last_name LIKE '%name'

        3. **Handling Special Keywords:**
        - **Certification Terms:** If the query contains words like “certification” or “certified,” ensure the filter type is  `"type" == "certifications"`.
        - **Publication Terms:** If the query contains words like 'presentation' or 'publication', ensure the filter type is '`"type" == "publications"`.
        - **Location Queries:** 
            - If the query mentions a state (e.g., "Maryland"), convert it to its short form (e.g., "MD") and use the LIKE operator.
            - For city names, determine the corresponding state (e.g., "Baltimore" implies "Baltimore, MD").
            - If the query is about a project or work history location, use **field_location** in combination with the `type` field; otherwise, use **location** if it is from additional filters.
                example: (field_location LIKE '%<location keyword>%' or content LIKE '%<location keyword>%') AND type=='<field type>'
            - Use **location only if asked for current location.

        4. **Filter Expression Creation:**
        - When the provided search term or keyword is identified as name or location consider generating filters.
        - Use brackets wherever required for better queries.
        - Construct filter expressions using the `==` operator for exact matches (never use `=`).
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

        Example output structure for query 'steve working in Newyork':
        (expr: (first_name LIKE '%Steve%' OR last_name LIKE '%Steve%') AND (location LIKE '%NY%' OR location LIKE '%New York%'))

        **Important:**
        - Strictly Use [] to wrap fields when using IN operator.
        - Ensure you use **field_location** if the location is associated with projects or work history, unless the filters indicate a current location search (then use **location**).
        - When using **field_location** also ensure to search in **content** field separated with OR logic # If the location is not eaither state else use only location without searching in content #. 
                 example: if query has location name 'ondonando port' associated with some project or experience -> (field_location LIKE %<Ondonando Port>% OR content LIKE %<Ondonando Port>% OR content LIKE %<ondonando port>%) AND type=='<field type>'
                 example: if query has location name 'Texas' associated with some project or experience ->((field_location LIKE '%Texas%' OR field_location LIKE '%TX%' OR content LIKE '%Texas%' OR content LIKE '%TX%') AND type=='<field type>')
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
    ### When type is declared as work_history also include projects and bio_sketch when asked for any experience on any context other than license, certifications or publications.
    ### Make sure to use field_location for location asked in User Query. Use **location for Additional Filters.
    """
        
if __name__ == "__main__":
    query = "Find candidate with more than 5 years experience in environmental planning."
    filters = {"location": "L.A US"}
    template = QueryRoutePromptTemplate(query, filters=filters)
    result = run_chatgpt_prompt(template.user_prompt, template.system_prompt)
    print(result)