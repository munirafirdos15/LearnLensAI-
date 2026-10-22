
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.database import get_connection, initialize_database

app = FastAPI(title="Personalised Learning API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StudentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class AnswerSubmission(BaseModel):
    student_id: int
    question_id: int
    selected_answer: str = Field(pattern=r"^[ABCD]$")


@app.on_event("startup")
def startup():
    initialize_database()
    import_question_bank()


def import_question_bank():
    path = Path(__file__).resolve().parent / "questions.json"
    data = json.loads(path.read_text(encoding="utf-8"))

    with get_connection() as conn:
        for item in data:
            conn.execute(
                "INSERT OR IGNORE INTO topics (name, description) VALUES (?, ?)",
                (item["topic"], item["description"]),
            )

            topic = conn.execute(
                "SELECT id FROM topics WHERE name = ?",
                (item["topic"],),
            ).fetchone()

            conn.execute(
                """
                INSERT INTO questions (
                    topic_id, question_text, option_a, option_b,
                    option_c, option_d, correct_answer,
                    difficulty, explanation
                )
                SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
                WHERE NOT EXISTS (
                    SELECT 1 FROM questions
                    WHERE topic_id = ? AND question_text = ?
                )
                """,
                (
                    topic["id"],
                    item["question"],
                    item["options"]["A"],
                    item["options"]["B"],
                    item["options"]["C"],
                    item["options"]["D"],
                    item["correct_answer"],
                    item["difficulty"],
                    item["explanation"],
                    topic["id"],
                    item["question"],
                ),
            )


@app.get("/")
def home():
    return {"message": "Personalised Learning API is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/topics")
def get_topics():
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, name, description FROM topics ORDER BY id"
        ).fetchall()
    return [dict(row) for row in rows]


@app.post("/students", status_code=201)
def create_student(student: StudentCreate):
    name = student.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name cannot be empty")

    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO students (name) VALUES (?)", (name,)
        )
        student_id = cursor.lastrowid

    return {"id": student_id, "name": name}


@app.get("/questions")
def get_questions(topic_id: int | None = None):
    sql = """
        SELECT q.id, q.topic_id, t.name AS topic,
               q.question_text, q.option_a, q.option_b,
               q.option_c, q.option_d, q.difficulty
        FROM questions q
        JOIN topics t ON t.id = q.topic_id
    """
    params = ()

    if topic_id is not None:
        sql += " WHERE q.topic_id = ?"
        params = (topic_id,)

    sql += " ORDER BY q.id"

    with get_connection() as conn:
        rows = conn.execute(sql, params).fetchall()

    return [
        {
            "id": row["id"],
            "topic_id": row["topic_id"],
            "topic": row["topic"],
            "question": row["question_text"],
            "options": {
                "A": row["option_a"],
                "B": row["option_b"],
                "C": row["option_c"],
                "D": row["option_d"],
            },
            "difficulty": row["difficulty"],
        }
        for row in rows
    ]


@app.post("/submit-answer")
def submit_answer(answer: AnswerSubmission):
    with get_connection() as conn:
        student = conn.execute(
            "SELECT id FROM students WHERE id = ?",
            (answer.student_id,),
        ).fetchone()

        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        question = conn.execute(
            """
            SELECT id, correct_answer, explanation
            FROM questions WHERE id = ?
            """,
            (answer.question_id,),
        ).fetchone()

        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        is_correct = (
            answer.selected_answer == question["correct_answer"]
        )

        conn.execute(
            """
            INSERT INTO quiz_attempts (
                student_id, question_id, selected_answer, is_correct
            ) VALUES (?, ?, ?, ?)
            """,
            (
                answer.student_id,
                answer.question_id,
                answer.selected_answer,
                int(is_correct),
            ),
        )

    return {
        "question_id": answer.question_id,
        "selected_answer": answer.selected_answer,
        "is_correct": is_correct,
        "explanation": question["explanation"],
        "message": "Correct answer!" if is_correct else "Try reviewing this concept.",
    }
@app.get("/students/{student_id}/learning-gaps")
def detect_learning_gaps(student_id: int):
    with get_connection() as conn:
        student = conn.execute(
            "SELECT id FROM students WHERE id = ?",
            (student_id,)
        ).fetchone()

        if not student:
            raise HTTPException(
                status_code=404,
                detail="Student not found"
            )

        rows = conn.execute("""
            SELECT
                t.id AS topic_id,
                t.name AS topic,
                COUNT(qa.id) AS total_attempts,
                COALESCE(SUM(qa.is_correct), 0) AS correct_answers
            FROM topics t
            LEFT JOIN questions q ON q.topic_id = t.id
            LEFT JOIN quiz_attempts qa
                ON qa.question_id = q.id
                AND qa.student_id = ?
            GROUP BY t.id, t.name
            ORDER BY t.id
        """, (student_id,)).fetchall()

    results = []

    for row in rows:
        attempts = row["total_attempts"]
        correct = row["correct_answers"]

        # Topics without attempts cannot yet be assessed.
        if attempts == 0:
            accuracy = None
            status = "Not assessed"
        else:
            accuracy = round((correct / attempts) * 100, 2)

            if accuracy < 50:
                status = "Weak"
            elif accuracy < 80:
                status = "Developing"
            else:
                status = "Strong"

        results.append({
            "topic_id": row["topic_id"],
            "topic": row["topic"],
            "attempts": attempts,
            "correct_answers": correct,
            "accuracy": accuracy,
            "status": status
        })

    return {
        "student_id": student_id,
        "learning_gaps": results
    }

@app.get("/students/{student_id}/recommendations")
def get_recommendations(student_id: int):
    # Reuse the existing learning-gap detection endpoint logic.
    gap_data = detect_learning_gaps(student_id)
    gaps = gap_data["learning_gaps"]

    study_resources = {
        "Variables and Data Types": {
            "concepts": [
                "Variables and naming rules",
                "int, float, str and bool data types",
                "Type conversion and type()"
            ],
            "practice": "Solve 5 questions on variables and data types."
        },
        "Conditional Statements": {
            "concepts": [
                "if, elif and else",
                "Comparison operators",
                "Logical operators and nested conditions"
            ],
            "practice": "Practise 5 problems using if-else statements."
        },
        "Loops": {
            "concepts": [
                "for and while loops",
                "range() and loop sequences",
                "break, continue and nested loops"
            ],
            "practice": "Solve 5 problems involving loops and number patterns."
        }
    }

    recommendations = []

    # Prioritise topics that have not been assessed, then weak topics.
    priority_order = {
        "Not assessed": 0,
        "Weak": 1,
        "Developing": 2,
        "Strong": 3
    }

    ordered_gaps = sorted(
        gaps,
        key=lambda gap: (
            priority_order.get(gap["status"], 4),
            gap["accuracy"] if gap["accuracy"] is not None else -1
        )
    )

    for gap in ordered_gaps:
        topic = gap["topic"]
        status = gap["status"]
        resource = study_resources.get(topic)

        if resource is None:
            continue

        if status == "Not assessed":
            action = "Take a short assessment to measure your current knowledge."
            reason = "There is not enough answer history to estimate mastery."
        elif status == "Weak":
            action = "Review the fundamentals, then practise easy questions."
            reason = f"Your current accuracy is {gap['accuracy']}%."
        elif status == "Developing":
            action = "Review mistakes and practise intermediate questions."
            reason = f"Your current accuracy is {gap['accuracy']}%."
        else:
            action = "Try advanced questions to strengthen your mastery."
            reason = f"You achieved {gap['accuracy']}% accuracy."

        recommendations.append({
            "topic_id": gap["topic_id"],
            "topic": topic,
            "status": status,
            "accuracy": gap["accuracy"],
            "reason": reason,
            "recommended_action": action,
            "study_concepts": resource["concepts"],
            "practice_task": resource["practice"]
        })

    return {
        "student_id": student_id,
        "priority_topic": (
            recommendations[0]["topic"]
            if recommendations else None
        ),
        "recommendations": recommendations
    }
