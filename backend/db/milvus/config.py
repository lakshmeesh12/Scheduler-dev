from datetime import datetime
import re
import sys
import nest_asyncio
import asyncio
import json
import os
import ast
from uuid import uuid4
from langchain_milvus.vectorstores import Milvus
from pymilvus import (
    Collection,
    CollectionSchema,
    DataType,
    FieldSchema,
    MilvusClient,
    connections,
    utility
)
import pandas as pd
from tqdm.auto import tqdm
from langchain_core.documents import Document
from langchain_milvus.utils.sparse import BM25SparseEmbedding
from langchain_milvus import MilvusCollectionHybridSearchRetriever
from pymilvus import WeightedRanker

uri = os.environ['MILVUS_URI']
user = os.environ['MILVUS_USER']
password = os.environ['MILVUS_PASSWORD']
token = f"{user}:{password}"

connections.connect(
    uri=uri,
    user=user,
    password=password,
    token=token
)

milvus_client = MilvusClient(
    uri=uri,
    user=user,
    password=password,
    token=token
)

from utils.chatgpt import dense_embedding

nest_asyncio.apply()

collection_name = os.environ['MILVUS_COLLECTION']

vector_store = None

vector_store_collection = {}


vector_dense_index_params = {
    "metric_type": "COSINE",        # use true cosine if embeddings aren’t strictly length‑normalized
    "index_type": "HNSW",
    "params": {
        "M": 48,                    # a bit lower than 64 to reduce graph‐degree overhead
        "efConstruction": 512,      # higher builds a more connected graph for better recall
        "efSearch": 12000           # ≥ k (10 000) → ensures you explore enough neighbors at query time
    },
}

vector_sparse_index_params = {
    "metric_type": "IP",
    "index_type": "SPARSE_INVERTED_INDEX",
    "params": {"drop_ratio_build": 0.2}
}

metadata_fields = [
    FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
    FieldSchema(name="name", dtype=DataType.STRING),
    FieldSchema(name="profile_id", dtype=DataType.STRING),
    FieldSchema(name='type', dtype=DataType.STRING),
    FieldSchema(name='status', dtype=DataType.STRING),
    FieldSchema(name='active', dtype=DataType.BOOL),
    FieldSchema(name="total_experience", dtype=DataType.INT32, is_nullable=True),
    FieldSchema(name="job_title", dtype=DataType.VARCHAR, max_length=200),
    FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=1500, enable_analyzer=True, enable_match=True)
]

# Define the dense vector fields (experience, projects, education, course/certifications, achievements)
dense_vector_fields = [
    FieldSchema(name="experience", dtype=DataType.FLOAT_VECTOR, dim=1596),  # assuming 768 dimensions for the dense vector
    FieldSchema(name="projects", dtype=DataType.FLOAT_VECTOR, dim=1596),
    FieldSchema(name="education", dtype=DataType.FLOAT_VECTOR, dim=1596),
    FieldSchema(name="course_certifications", dtype=DataType.FLOAT_VECTOR, dim=1596),
    FieldSchema(name="achievements", dtype=DataType.FLOAT_VECTOR, dim=1596),
]

# Define the sparse vector fields (primary_skills, secondary_skills)
sparse_vector_fields = [
    FieldSchema(name="primary_skills", dtype=DataType.FLOAT_VECTOR, dim=128, is_vector=True),
    FieldSchema(name="secondary_skills", dtype=DataType.FLOAT_VECTOR, dim=128, is_vector=True),
]

dense_vector_fields = [
    FieldSchema(name='page_content', dtype=DataType.FLOAT_VECTOR, dim=1596)
]

# # Combine the metadata, dense vectors, and sparse vectors into one complete schema
# fields = metadata_fields + dense_vector_fields

# # Create the collection schema
# schema = CollectionSchema(fields, description="Schema for LangChain Milvus Vector Store")

# if utility.has_collection(collection_name):
#     print("Collection exists!")
#     collection = Collection(name=collection_name)

def process_education(records):
    if records:
        text = ""
        for rec in records:
            if isinstance(rec, dict):
                text += f"\n{rec.get('degree', '')} degree in {rec.get('institution', '')} institution in {rec.get('domain', '')} domain"
            elif isinstance(rec, str):
                text += rec
        return text.lstrip("\n")

def process_projects(records):
    if records:
        text = ""
        for rec in records:
            if isinstance(rec, dict):
                skills = ", ".join(rec.get('skills/tools', ''))
                text += f"\n\nperformed {rec.get('title', '')} using {skills} skills.\n{rec.get('description', '')}\n{rec.get('impact', '')}"
            elif isinstance(rec, str):
                text += rec
        return text.lstrip("\n\n")

def process_experience(record):
    if record:
        text = ""
        for rec in record:
            if isinstance(rec, dict):
                text += f"\nWorked in {rec.get('company', '')} as {rec.get('designation', '')}.\n{rec.get('description', '')}"
            elif isinstance(rec, str):
                text += rec
        return text.lstrip("\n")

def fetch_job_title(record):
    if record:
        job_title = [rec['designation'] for rec in record if isinstance(rec, dict) and rec.get('designation')]
        return ", ".join(job_title)

def process_skills(record):
    text = ""
    for k,v in record['primary_skills'].items():
        for x,y in v.items():
            text  += "\n" + k + ":\n " + x + ": " + ", ".join(y)
    
    for k,v in record['secondary_skills'].items():
        for x,y in v.items():
            text  += "\n" + k + ":\n " + x + ": " + ", ".join(y)
    
    return text.lstrip("\n")


async def create_dataset(df):
    try:
        if isinstance(df, list):
            df = pd.DataFrame(df)
        
        static_fields = ['name', 'total_experience', "job_title", "profile_id","status", "active", "client_id", "campaign_id"]
        
        df['skills'] = df.apply(process_skills, axis=1)
        df['projects'] = df['projects'].map(process_projects)
        df['work_history'] = df['work_history'].map(process_experience)
        df['certifications'] = df['certifications'].map(lambda x: ", ".join(x))
        df['job_title'] = df['work_history'].map(fetch_job_title)
        df['education'] = df['education'].map(process_education)
        
        df['type'] = "common"
        
        if "campaign_id" not in df.columns:
            df['campaign_id'] = ""
        if "client_id" not in df.columns:
            df['client_id'] = ""
        elif ("client_id" not in df.columns) or ("campaign_id" not in df.columns):
            print("Either client id or capaign id should be provided!")

        df["learning"] = df['education'] + "\n\n" + df['certifications']
        df["experience"] = df['work_history'] + "\n\n" + df['projects'] + "\n\n" + df['skills']

        dataset1 = df[static_fields+['learning']].rename(columns={"learning": "content"})
        dataset1['type'] = "learning"
        dataset1 = dataset1.dropna(subset="content").apply(lambda x: Document(page_content=x['content'], metadata=dict(x)), axis=1)
        dataset2 = df[static_fields+['experience']].rename(columns={"experience": "content"})
        dataset2['type'] = "experience"
        dataset2 = dataset2.dropna(subset="content").apply(lambda x: Document(page_content=x['content'], metadata=dict(x)), axis=1)

        dataset = pd.concat([dataset1, dataset2]).values.tolist()

        return dataset

    except Exception as err:
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        message = f"{fname} : Line no {exc_tb.tb_lineno} - {exc_type} : {err}"
        print(f"Dataset creation failed: {message}")
        return []

index_params = [vector_dense_index_params, vector_sparse_index_params]
embedding_functions = [dense_embedding]

# record_count = collection.num_entities
# print(f"The collection '{collection_name}' contains {record_count} records.")

vector_store = Milvus(
            collection_name=collection_name,
            connection_args={"uri": uri, "user": user, "password": password, "token": token},
            index_params=index_params[0],
            search_params=index_params[0],
            vector_field='content_dense',
            auto_id=True,
            consistency_level=0,
            embedding_function=embedding_functions[0],
            metadata_schema=metadata_fields+dense_vector_fields
        )

print("Milvus vectorstore initialized successfully!")
