from utils.chatgpt import run_chatgpt_prompt


class JobDescriptionTemplate:
    def __init__(self, jd):
        self.system_prompt = """ You are expert in translating resume schema from json fields to a well formated 
        markdown template resume.
        """
        self.jd_prompt = f"""Process the below given job description as following:

        ** Extract the criteria based on the following fields and create a python dictionary with following fields:
            job_title: string # identify the job title for which the job description is all about
            primary_skills: dict(domain: dict(:libraries: [], tools: [],concepts: [], etc..)) # identify all primary skills/concepts and tools, etc. used in the projects or previous experience 
            secondary_skills: dict(domain: dict(:libraries: [], tools: [],concepts: [], etc..)) # other skills/tools mentioned in job description, projects, etc. Excluding primary skills
            experience: consolidated text requesting information on specific experience, projects, management experience, etc.
            learning: consolidated text requiring information on education specifics, course/certification, publications information.
            other_specifications: list[points containing requirements]

        * other_specifications criteria:
            points containing requirements such as good to have experience or tools exposure or any other educational requirements or projects

            {jd}

        """
        self.instructions = """
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


        ### For each of the extracted skill convert shortflorm to longform example: NLP - > Natual Language Processing ###
        ### For primary skills select only the skills/tools/concepts which are stressed or termed as must to have ###
        ### Return only python dictionary and do not assign any variable ###
        ### strictly avoid syntax issues while generating the output dictionary###
        ### The generated output should be directly consumable by the json.loads method ###
        """
        self.prompt = self.jd_prompt + self.instructions


if __name__ == "__main__":
    query = {     "education": [         {             "institution": "Texas A&M University",             "degree": "BS",             "grade": "",             "start_year": 2017,             "end_year": 2017         }     ],     "work_history": [         {             "user_id": "8dff2f50-02d5-42d4-9672-889994cfc4bd",             "email": "mailto:nanderson@anchorqea.com",             "company": "Anchor QEA, LLC",             "designation": "Scientist",             "description": "",             "location": "",             "start_year": 2020,             "end_year": "present",             "duration": ""         },         {             "user_id": "8dff2f50-02d5-42d4-9672-889994cfc4bd",             "email": "mailto:nanderson@anchorqea.com",             "company": "Perennial Environmental Services",             "designation": "Scientist",             "description": "",             "location": "",             "start_year": 2019,             "end_year": 2020,             "duration": ""         }     ],     "certifications": [         {             "user_id": "8dff2f50-02d5-42d4-9672-889994cfc4bd",             "email": "mailto:nanderson@anchorqea.com",             "title": "PADI open water diver"         },         {             "user_id": "8dff2f50-02d5-42d4-9672-889994cfc4bd",             "email": "mailto:nanderson@anchorqea.com",             "title": "OSHA 29 CFR 1910.120(e) Hazardous Waste Site Training Course, 40-Hour Training"         }     ],     "projects": [         {             "user_id": "8dff2f50-02d5-42d4-9672-889994cfc4bd",             "email": "mailto:nanderson@anchorqea.com",             "title": "Harbor Deepening and Land Expansion",             "institute": "Calhoun Port Authority",             "description": "Anchor QEA led environmental assessments, mitigation evaluations, selection, and design; USACE permitting for deepening the waterway; placing 4 million cubic yards of dredged material; and creating 40 acres of new emergent industrial land from dredged material within wetlands and submerged lands. The USACE permit was issued in September 2020, and construction began in early 2021. Anchor QEA designed of a 14-acre beneficial use marsh mitigation site. Nick is currently monitoring ongoing construction of the mitigation site. Nick has collected water samples, and elevational data at the mitigation site.",             "location": "Point Comfort, Texas",             "start_date": "",             "end_date": "",             "duration": ""         },         {             "user_id": "8dff2f50-02d5-42d4-9672-889994cfc4bd",             "email": "mailto:nanderson@anchorqea.com",             "title": "Cedar Bayou Restoration",             "institute": "Aransas County",             "description": "Insert a brief project description text here. Project descriptions should be concise but complete. The basic formula should be to set the stage, state the challenge, explain the solution, and then describe the result. The reader should be able to understand what we provided and how we specifically helped the client. Include your role, the scope, innovative solutions, obstacles overcome, etc.",             "location": "Rockport, Texas",             "start_date": "",             "end_date": "",             "duration": ""         }     ],     "userId": "8dff2f50-02d5-42d4-9672-889994cfc4bd",     "email": "mailto:nanderson@anchorqea.com" }
 