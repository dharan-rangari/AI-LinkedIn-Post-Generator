import json
import chromadb

client = chromadb.PersistentClient(path="./chroma_db")

try:
    client.delete_collection("linkedin_posts")
except:
    pass

collection = client.get_or_create_collection(
    name="linkedin_posts"
)

with open(
    "data/processed_posts.json",
    "r",
    encoding="utf-8"
) as f:
    posts = json.load(f)

for idx, post in enumerate(posts):

    print(type(post))
    print(post)

    collection.add(
        ids=[str(idx)],
        documents=[str(post["text"])],
        metadatas=[{
            "language": str(post["language"]),
            "tags": ",".join(post["tags"]),
            "line_count": int(post["line_count"])
        }]
    )

    

print("Vector database created successfully.")