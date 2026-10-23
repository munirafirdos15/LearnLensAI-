import json

from app.database import get_connection, initialize_database
from pathlib import Path

CURRICULUM_PATH = Path(__file__).resolve().parent / "curriculum.json"


def apply_phase1():
    if not CURRICULUM_PATH.exists():
        raise FileNotFoundError(f"Missing curriculum file: {CURRICULUM_PATH}")

    data = json.loads(CURRICULUM_PATH.read_text(encoding="utf-8-sig"))

    concepts = data["concepts"]
    prerequisites = data["prerequisites"]
    questions = data["questions"]

    # Preserve and initialize the existing database schema.
    initialize_database()

    with get_connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS concepts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                difficulty_range TEXT,
                lesson TEXT,
                worked_example TEXT,
                practice_hint TEXT,
                display_order INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS concept_prerequisites (
                concept_id TEXT NOT NULL,
                prerequisite_id TEXT NOT NULL,
                PRIMARY KEY (concept_id, prerequisite_id),
                FOREIGN KEY (concept_id) REFERENCES concepts(id),
                FOREIGN KEY (prerequisite_id) REFERENCES concepts(id),
                CHECK (concept_id <> prerequisite_id)
            );

            CREATE TABLE IF NOT EXISTS question_bank (
                id TEXT PRIMARY KEY,
                concept_id TEXT NOT NULL,
                difficulty TEXT NOT NULL
                    CHECK (difficulty IN ('beginner','intermediate','advanced')),
                question_text TEXT NOT NULL,
                options_json TEXT NOT NULL,
                correct_answer TEXT NOT NULL
                    CHECK (correct_answer IN ('A','B','C','D')),
                explanation TEXT,
                misconception_tags_json TEXT NOT NULL DEFAULT '{}',
                FOREIGN KEY (concept_id) REFERENCES concepts(id)
            );

            CREATE TABLE IF NOT EXISTS learning_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                question_id TEXT NOT NULL,
                selected_answer TEXT NOT NULL,
                is_correct INTEGER NOT NULL CHECK (is_correct IN (0,1)),
                workings TEXT,
                response_time_ms INTEGER,
                misconception_tag TEXT,
                attempted_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students(id),
                FOREIGN KEY (question_id) REFERENCES question_bank(id)
            );

            CREATE TABLE IF NOT EXISTS student_mastery (
                student_id INTEGER NOT NULL,
                concept_id TEXT NOT NULL,
                p_mastery REAL NOT NULL DEFAULT 0.2
                    CHECK (p_mastery >= 0 AND p_mastery <= 1),
                attempts INTEGER NOT NULL DEFAULT 0,
                correct_attempts INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (student_id, concept_id),
                FOREIGN KEY (student_id) REFERENCES students(id),
                FOREIGN KEY (concept_id) REFERENCES concepts(id)
            );

            CREATE TABLE IF NOT EXISTS misconception_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                concept_id TEXT NOT NULL,
                question_id TEXT NOT NULL,
                misconception_tag TEXT NOT NULL,
                evidence TEXT,
                confidence TEXT NOT NULL DEFAULT 'medium'
                    CHECK (confidence IN ('low','medium','high')),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students(id),
                FOREIGN KEY (concept_id) REFERENCES concepts(id),
                FOREIGN KEY (question_id) REFERENCES question_bank(id)
            );

            CREATE INDEX IF NOT EXISTS idx_attempts_student_time
                ON learning_attempts(student_id, attempted_at);
            CREATE INDEX IF NOT EXISTS idx_attempts_question
                ON learning_attempts(question_id);
            CREATE INDEX IF NOT EXISTS idx_misconceptions_student_time
                ON misconception_events(student_id, created_at);
        """)

        for concept in concepts:
            conn.execute("""
                INSERT INTO concepts (
                    id, name, description, difficulty_range, lesson,
                    worked_example, practice_hint, display_order
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,
                    description=excluded.description,
                    difficulty_range=excluded.difficulty_range,
                    lesson=excluded.lesson,
                    worked_example=excluded.worked_example,
                    practice_hint=excluded.practice_hint,
                    display_order=excluded.display_order
            """, (
                concept["id"], concept["name"], concept.get("description", ""),
                concept.get("difficulty_range", "beginner-to-advanced"),
                concept.get("lesson", ""), concept.get("worked_example", ""),
                concept.get("practice_hint", ""), concept.get("display_order", 0)
            ))

        for link in prerequisites:
            conn.execute("""
                INSERT OR IGNORE INTO concept_prerequisites
                (concept_id, prerequisite_id)
                VALUES (?, ?)
            """, (link["concept_id"], link["prerequisite_id"]))

        for question in questions:
            conn.execute("""
                INSERT INTO question_bank (
                    id, concept_id, difficulty, question_text, options_json,
                    correct_answer, explanation, misconception_tags_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    concept_id=excluded.concept_id,
                    difficulty=excluded.difficulty,
                    question_text=excluded.question_text,
                    options_json=excluded.options_json,
                    correct_answer=excluded.correct_answer,
                    explanation=excluded.explanation,
                    misconception_tags_json=excluded.misconception_tags_json
            """, (
                question["id"], question["concept_id"], question["difficulty"],
                question["question"], json.dumps(question["options"]),
                question["correct_answer"], question.get("explanation", ""),
                json.dumps(question.get("misconception_tags", {}))
            ))

        concept_count = conn.execute(
            "SELECT COUNT(*) FROM concepts"
        ).fetchone()[0]
        question_count = conn.execute(
            "SELECT COUNT(*) FROM question_bank"
        ).fetchone()[0]
        prerequisite_count = conn.execute(
            "SELECT COUNT(*) FROM concept_prerequisites"
        ).fetchone()[0]

    print(
        "Phase 1 applied successfully. "
        f"Concepts: {concept_count}; questions: {question_count}; "
        f"prerequisite links: {prerequisite_count}."
    )


if __name__ == "__main__":
    apply_phase1()