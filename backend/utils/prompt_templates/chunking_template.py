import os
import json
 
 
# with open("./json_schema.json", "r") as f:
#     schema = json.load(f)
 
 
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
      ### For each of the extracted skill convert shortflorm to longform example: NLP - > Natual Language Processing ###
      ### Maintain consistency in the output. ###
      ### return only dictionary and not a variable along with dictuinary ###
      ### Return proper python dictionary without any syntatic errors that can be convertable by json.loads ### 
      """
      self.prompt = self.structure + self.skills_instructions
