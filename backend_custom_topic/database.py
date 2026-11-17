import sqlite3
import os

print("Database Path:", os.path.abspath("post_history.db"))


class PostDatabase:

    def __init__(self):
        self.conn = sqlite3.connect(
            "post_history.db",
            check_same_thread=False
        )

        self.cursor = self.conn.cursor()

        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS post_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT,
            language TEXT,
            length TEXT,
            post TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        self.conn.commit()

    def save_post(self, topic, language, length, post):

        print("Saving post to database...")

        self.cursor.execute("""
        INSERT INTO post_history
        (topic, language, length, post)
        VALUES (?, ?, ?, ?)
        """, (topic, language, length, post))

        self.conn.commit()

    def get_all_posts(self):

        conn = sqlite3.connect("post_history.db")
        cursor = conn.cursor()

        cursor.execute("""
        SELECT *
        FROM post_history
        ORDER BY created_at DESC
        """)

        posts = cursor.fetchall()

        conn.close()

        return posts

    # ==========================
    # ANALYTICS FUNCTIONS
    # ==========================

    def get_total_posts(self):

        self.cursor.execute("""
        SELECT COUNT(*)
        FROM post_history
        """)

        return self.cursor.fetchone()[0]

    def get_most_used_topic(self):

        self.cursor.execute("""
        SELECT topic, COUNT(*)
        FROM post_history
        GROUP BY topic
        ORDER BY COUNT(*) DESC
        LIMIT 1
        """)

        result = self.cursor.fetchone()

        if result:
            return result[0]

        return "N/A"

    def get_most_used_language(self):

        self.cursor.execute("""
        SELECT language, COUNT(*)
        FROM post_history
        GROUP BY language
        ORDER BY COUNT(*) DESC
        LIMIT 1
        """)

        result = self.cursor.fetchone()

        if result:
            return result[0]

        return "N/A"

    def get_posts_today(self):

        self.cursor.execute("""
        SELECT COUNT(*)
        FROM post_history
        WHERE DATE(created_at)=DATE('now')
        """)

        return self.cursor.fetchone()[0]

    def get_topic_distribution(self):

        self.cursor.execute("""
        SELECT topic, COUNT(*)
        FROM post_history
        GROUP BY topic
        """)

        return self.cursor.fetchall()

    def get_language_distribution(self):

        self.cursor.execute("""
        SELECT language, COUNT(*)
        FROM post_history
        GROUP BY language
        """)

        return self.cursor.fetchall()