import asyncio
from config import *
from pymongo import ReturnDocument
from bson import ObjectId
from fastapi import Depends, HTTPException


def validate_object_id(id: str):
    if ObjectId.is_valid(id):
        return ObjectId(id)
    raise HTTPException(status_code=400, detail="Invalid ObjectId format")


async def create_item(item: dict, session=Depends(mongo_session)):
    result = await session.insert_one(item)
    new_item = await session.find_one({"_id": result.inserted_id})
    if new_item:
        new_item["_id"] = str(new_item["_id"])
    return new_item


async def get_item(item_id: str, session=Depends(mongo_session)):
    object_id = validate_object_id(item_id)
    item = await session.find_one({"_id": object_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item["_id"] = str(item["_id"])
    return item


async def update_item(item_id: str, updated_item: dict, session=Depends(mongo_session)):
    object_id = validate_object_id(item_id)
    updated_doc = await session.find_one_and_update(
        {"_id": object_id},
        {"$set": updated_item},
        return_document=ReturnDocument.AFTER
    )
    if not updated_doc:
        raise HTTPException(status_code=404, detail="Item not found")
    updated_doc["_id"] = str(updated_doc["_id"])
    return updated_doc


async def delete_item(item_id: str, session=Depends(mongo_session)):
    object_id = validate_object_id(item_id)
    result = await session.find_one_and_delete({"_id": object_id})
    if not result:
        raise HTTPException(status_code=404, detail="Item not found")
    result["_id"] = str(result["_id"])
    return {"detail": "Item deleted Successfully!", "item": result}