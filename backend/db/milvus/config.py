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

collection_name = "rms"

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
    FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=False),
    FieldSchema(name="name", dtype=DataType.STRING),
    FieldSchema(name="email", dtype=DataType.STRING),
    FieldSchema(name="number", dtype=DataType.STRING, is_nullable=True),
    FieldSchema(name="linkedin", dtype=DataType.STRING, is_nullable=True),
    FieldSchema(name="GitHub", dtype=DataType.STRING, is_nullable=True),
    FieldSchema(name="website", dtype=DataType.STRING, is_nullable=True),
    FieldSchema(name="total_experience", dtype=DataType.INT32, is_nullable=True),
    FieldSchema(name="job_title", dtype=DataType.VARCHAR, max_length=100),
    FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=1596, enable_analyzer=True, enable_match=True)
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

# Combine the metadata, dense vectors, and sparse vectors into one complete schema
fields = metadata_fields + dense_vector_fields + sparse_vector_fields

# Create the collection schema
schema = CollectionSchema(fields, description="Schema for LangChain Milvus Vector Store")

if utility.has_collection(collection_name):
    print("Collection exists!")

collection = Collection(name=collection_name, schema=schema)


async def create_schema_from_profile(usr, rec):
    try:
        milvus_records = []

        usr['name'] = usr.get('first_name', '') + " " + usr.get('last_name', '')
        usr['name'] = usr['name'].lower()
        
        
        
        insertion = vector_store.add_documents(
            milvus_records,
            connection_args={"uri": uri, "user": user, "password": password, "token": token},
            primary_field='id',
            text_field="content",
            vector_field='content_dense',
            search_params=index_params[0],
            embedding=embedding_functions[0],
            index_params=index_params[0]
        )

        print(insertion)        
        return milvus_records
    except Exception as err:
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        message = f"{fname} : Line no {exc_tb.tb_lineno} - {exc_type} : {err}"
        print("Error in processing milvus records ", err)
        return []


index_params = [vector_dense_index_params, vector_sparse_index_params]
embedding_functions = [dense_embedding]


record_count = collection.num_entities
print(f"The collection '{collection_name}' contains {record_count} records.")

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
