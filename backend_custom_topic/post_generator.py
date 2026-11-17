"""from llm_helper import llm
from few_shot import FewShotPosts

few_shot = FewShotPosts()


def get_length_str(length):
    if length == "Short":
        return "1 to 5 lines"
    if length == "Medium":
        return "6 to 10 lines"
    if length == "Long":
        return "11 to 15 lines"


def generate_post(length, language, tag):
    prompt = get_prompt(length, language, tag)
    response = llm.invoke(prompt)
    return response.content


def get_prompt(length, language, tag):
    length_str = get_length_str(length)

    prompt = f'''
    Generate a LinkedIn post using the below information. No preamble.

    1) Topic: {tag}
    2) Length: {length_str}
    3) Language: {language}
    If Language is Hinglish then it means it is a mix of Hindi and English. 
    The script for the generated post should always be English.
    '''
    # prompt = prompt.format(post_topic=tag, post_length=length_str, post_language=language)

    examples = few_shot.get_filtered_posts(length, language, tag)

    if len(examples) > 0:
        prompt += "4) Use the writing style as per the following examples."

    for i, post in enumerate(examples):
        post_text = post['text']
        prompt += f'\n\n Example {i+1}: \n\n {post_text}'

        if i == 1: # Use max two samples
            break

    return prompt


if __name__ == "__main__":
    print(generate_post("Medium", "English", "Mental Health"))
"""


from llm_helper import llm
from few_shot import FewShotPosts
from database import PostDatabase

few_shot = FewShotPosts()
db = PostDatabase()


def get_length_str(length):

    if length == "Short":
        return "1 to 5 lines"

    if length == "Medium":
        return "6 to 10 lines"

    if length == "Long":
        return "11 to 15 lines"


def generate_post(length, language, tag):

    prompt = get_prompt(
        length,
        language,
        tag
    )

    response = llm.invoke(prompt)

    generated_post = response.content
    hashtags = generate_hashtags(
        tag,
        generated_post
    )

    final_output = (
        generated_post
        + "\n\n"
        + hashtags
    )
    db.save_post(
        topic=tag,
        language=language,
        length=length,
        post=generated_post
    )

    return final_output


def get_prompt(length, language, tag):

    length_str = get_length_str(length)

    prompt = f"""
    Generate a professional and engaging LinkedIn post.

    No preamble.
    No title.
    No explanation.

    Topic: {tag}

    Length: {length_str}

    Language: {language}

    If language is Hinglish,
    use a mix of Hindi and English
    but always write using English script.

    Use the retrieved writing briefs only
    as guidance for structure, tone and formatting.

    Do NOT copy any brief word for word.
    Write an original LinkedIn post about the Topic above.
    """

    # -------------------------
    # RAG Retrieval using ChromaDB
    # -------------------------

    examples = few_shot.get_similar_posts(
        tag=tag,
        language=language,
        length=length,
        n_results=3
    )

    print("\n" + "=" * 50)
    print("RAG RETRIEVED POSTS")
    print("=" * 50)

    for i, post in enumerate(examples):

        print(f"\n--- Retrieved Post {i+1} ---\n")
        print(post["text"])

    if len(examples) > 0:

        prompt += """

        Below are some retrieved writing briefs
        for similar LinkedIn posts.

        They are instructions that describe a good post,
        NOT finished posts. Use them only for
        structure, hook style, tone and formatting.

        Do NOT answer or repeat the briefs.
        Write the finished LinkedIn post itself,
        and only about the Topic stated above.
        """

    for i, post in enumerate(examples):

        post_text = post["text"]

        prompt += f"""

        Brief {i+1}

        {post_text}
        """

    return prompt

def generate_hashtags(tag, post_content):

    prompt = f"""
    Generate 5 professional LinkedIn hashtags.

    Topic: {tag}

    Post:
    {post_content}

    Rules:
    - Return only hashtags
    - No explanation
    - One line only
    - Format:
      #Tag1 #Tag2 #Tag3 #Tag4 #Tag5
    """

    response = llm.invoke(prompt)

    return response.content.strip()


if __name__ == "__main__":

    print(
        generate_post(
            "Medium",
            "English",
            "Mental Health"
        )
    )
