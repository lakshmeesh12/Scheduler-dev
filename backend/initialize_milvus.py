from datetime import datetime
import re
import nest_asyncio
import asyncio
import os
import json
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
from db.mongo.config import db as mongo_db
from langchain_core.documents import Document

uri = os.environ['MILVUS_URI']
user = os.environ['MILVUS_USER']
password = os.environ['MILVUS_PASSWORD']
collection_name = os.environ['MILVUS_COLLECTION']
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

def process_education(records):
    if records:
        text = ""
        for rec in records:
            if isinstance(rec, dict):
                text += f"\n{rec.get('degree', '')} degree in {rec.get('institution', '')} institution in {rec.get('domain', '')} domain"
            elif isinstance(rec, str):
                text += rec
        return text.lstrip("\n").lower()

def process_projects(records):
    if records:
        text = ""
        for rec in records:
            if isinstance(rec, dict):
                skills = ", ".join(rec.get('skills/tools', ''))
                text += f"\n\nperformed {rec.get('title', '')} using {skills} skills.\n{rec.get('description', '')}\n{rec.get('impact', '')}"
            elif isinstance(rec, str):
                text += rec
        return text.lstrip("\n\n").lower()

def process_experience(record):
    if record:
        text = ""
        for rec in record:
            if isinstance(rec, dict):
                text += f"\nWorked in {rec.get('company', '')} as {rec.get('designation', '')}.\n{rec.get('description', '')}"
            elif isinstance(rec, str):
                text += rec
        return text.lstrip("\n").lower()

def fetch_job_title(record):
    if record:
        job_title = [rec['designation'] for rec in record if isinstance(rec, dict) and rec.get('designation')]
        return ", ".join(job_title).lower()

def process_skills(record):
    if isinstance(record, dict):
        text = ""
        for k,v in record['primary_skills'].items():
            for x,y in v.items():
                text  += "\n" + k + ":\n " + x + ": " + ", ".join(y)
        
        for k,v in record['secondary_skills'].items():
            for x,y in v.items():
                text  += "\n" + k + ":\n " + x + ": " + ", ".join(y)
        
        return text.lstrip("\n").lower()

def process_certs(record):
    if record:
        text = ""
        for rec in record:
            if isinstance(rec, list):
                text += ", ".join(rec)        
            elif isinstance(rec, dict):
                text += rec.get("name", "")
            elif isinstance(record, str):
                text += record
        return record

def process_education(record):
    if record:
        text = ""
        for rec in record:
            if isinstance(rec, dict):
                text += f'\n{rec.get("degree", "")} degree from {rec.get("institution", "")} in {rec.get("domain", "")}'
        return text.lstrip("\n").lower()

async def fetch_profiles():
    profiles = await mongo_db['profiles'].find({},{"_id": 0, "processed_at": 0}).to_list()
    return profiles

profiles = asyncio.run(fetch_profiles())   


vector_dense_index_params = {
    "metric_type": "COSINE",        # use true cosine if embeddings aren’t strictly length‑normalized
    "index_type": "HNSW",
    "params": {
        "M": 48,                    # a bit lower than 64 to reduce graph‐degree overhead
        "efConstruction": 512,      # higher builds a more connected graph for better recall
        "efSearch": 12000           # ≥ k (10 000) → ensures you explore enough neighbors at query time
    },
}


def create_dataset(df):
    
    static_fields = ['name', 'total_experience', "job_title", "profile_id", "status", "active", "campaign_id", "client_id"]
    
    df['skills'] = df.apply(process_skills, axis=1)
    df['projects'] = df['projects'].map(process_projects)
    df['work_history'] = df['work_history'].map(process_experience)
    df['certifications'] = df['certifications'].map(process_certs)
    df['education'] = df['education'].map(process_education)
    df['job_title'] = df['work_history'].map(fetch_job_title)
    df['education'] = df['education'].map(process_education)
    
    df['type'] = "common"
    if "campaign_id" not in df.columns:
        df['campaign_id'] = "1234"
    if "client_id" not in df.columns:
        df['client_id'] = None
    df['total_experience'] = df['total_experience'].fillna(0)
    df = df.fillna("")

    df["learning"] = df['education'].map(str) + "\n\n" + df['certifications'].map(str)
    df["experience"] = df['work_history'] + "\n\n" + df['projects'] + "\n\n" + df['skills']

    meta_fields = static_fields + ['content']

    dataset1 = df[static_fields+['learning']].rename(columns={"learning": "content"})
    dataset1['type'] = "learning"
    dataset1 = dataset1.dropna(subset="content").apply(lambda x: Document(page_content=x['content'], metadata=dict(x)), axis=1)
    dataset2 = df[static_fields+['experience']].rename(columns={"experience": "content"})
    dataset2['type'] = "experience"
    dataset2 = dataset2.dropna(subset="content").apply(lambda x: Document(page_content=x['content'], metadata=dict(x)), axis=1)

    dataset = pd.concat([dataset1, dataset2]).values.tolist()

    return dataset


index_params = vector_dense_index_params
embedding_functions = dense_embedding

vector_store = Milvus(
            collection_name=collection_name,
            connection_args={"uri": uri, "user": user, "password": password, "token": token},
            index_params=index_params,
            search_params=index_params,
            vector_field='content_dense',
            drop_old=True,
            auto_id=True,
            consistency_level=0,
            embedding_function=embedding_functions
        )

print("Loaded vector store!")

if profiles:
    df = pd.DataFrame(profiles)
    print(df.columns)
    print(df.shape)
    dataset = create_dataset(df)
    print(len(dataset))

    vector_store.add_documents(dataset,
                connection_args={"uri": uri, "user": user, "password": password, "token": token},
                collection_name=collection_name,
                primary_field='id',
                text_field="content",
                partition_key_field="123",
                vector_field='content_dense',
                search_params=index_params,
                embedding=embedding_functions,
                index_params=index_params
    )

    ids = vector_store.get_pks("content==''")
    if ids:
        vector_store.delete(ids=ids)

else:
    print("No profiles found for initialization")