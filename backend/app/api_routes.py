
"""FastAPI endpoints for LearnLens AI's adaptive learning system."""

import json
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.bkt import DEFAULT_MASTERY, mastery_level
from app.database import get_connection
from app.learning_engine import record_attempt

router = APIRouter(prefix="/api", tags=["Adaptive Learning"])


class StudentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class AnswerSubmission(BaseModel):
    student_id: int = Field(gt=0)
    question_id: str = Field(min_length=1)
    selected_answer: str = Field(pattern=r"^[A-Da-d]$")
    workings: Optional[str] = Field(default=None, max_length=5000)
    response_time_ms: Optional[int] = Field(default=None, ge=0)


@router.get("/health")
def api_health():
    return {"status": "ok", "service": "LearnLens AI"}


@router.post("/students", status_code=201)
def create_student(payload: StudentCreate):
    name = payload.name.strip()

    if not name:
        raise HTTPException(status_code=422, detail="Name cannot be blank.")

    conn = get_connection()
    try:
        with conn:
            cursor = conn.execute(
                "INSERT INTO students (name) VALUES (?)",
                (name,),
            )
            student_id = cursor.lastrowid

        return {"id": student_id, "name": name}
    finally:
        conn.close()


@router.get("/students")
def list_students():
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT id, name, created_at FROM students ORDER BY id DESC"
        ).fetchall()

        return [dict(row) for row in rows]
    finally:
        conn.close()


@router.get("/questions/next")
def next_question(student_id: int = Query(gt=0)):
    """Choose an unseen question for the student's least-mastered concept."""

    conn = get_connection()
    try:
        student = conn.execute(
            "SELECT id FROM students WHERE id = ?",
            (student_id,),
        ).fetchone()

        if not student:
            raise HTTPException(status_code=404, detail="Student not found.")

        concepts = conn.execute(
            "SELECT id, name, display_order FROM concepts ORDER BY display_order"
        ).fetchall()

        if not concepts:
            raise HTTPException(status_code=503, detail="Curriculum is empty.")

        mastery_rows = conn.execute(
            """
            SELECT concept_id, p_mastery
            FROM student_mastery
            WHERE student_id = ?
            """,
            (student_id,),
        ).fetchall()

        mastery = {
            row["concept_id"]: row["p_mastery"]
            for row in mastery_rows
        }

        prerequisites = conn.execute(
            "SELECT concept_id, prerequisite_id FROM concept_prerequisites"
        ).fetchall()

        prerequisite_map = {}

        for row in prerequisites:
            prerequisite_map.setdefault(
                row["concept_id"], []
            ).append(row["prerequisite_id"])

        # A concept is eligible when all prerequisites have at least
        # 50% estimated mastery.
        eligible = []

        for concept_row in concepts:
            prereqs = prerequisite_map.get(concept_row["id"], [])

            prerequisites_mastered = all(
                mastery.get(prerequisite_id, DEFAULT_MASTERY) >= 0.5
                for prerequisite_id in prereqs
            )

            if prerequisites_mastered:
                eligible.append(concept_row)

        # Keep the system usable if no concept meets the prerequisite rule.
        if not eligible:
            eligible = list(concepts)

        # Choose the least-mastered eligible concept.
        concept = min(
            eligible,
            key=lambda item: (
                mastery.get(item["id"], DEFAULT_MASTERY),
                item["display_order"],
            ),
        )

        probability = mastery.get(concept["id"], DEFAULT_MASTERY)

        if probability < 0.35:
            preferred_difficulty = "beginner"
        elif probability < 0.70:
            preferred_difficulty = "intermediate"
        else:
            preferred_difficulty = "advanced"

        # Prefer an unseen question at the selected difficulty.
        row = conn.execute(
            """
            SELECT q.id, q.concept_id, q.difficulty, q.question_text,
                   q.options_json, c.name AS concept_name
            FROM question_bank q
            JOIN concepts c ON c.id = q.concept_id
            WHERE q.concept_id = ?
              AND q.id NOT IN (
                  SELECT question_id
                  FROM learning_attempts
                  WHERE student_id = ?
              )
            ORDER BY
              CASE WHEN q.difficulty = ? THEN 0 ELSE 1 END,
              CASE q.difficulty
                WHEN 'beginner' THEN 1
                WHEN 'intermediate' THEN 2
                ELSE 3
              END,
              q.id
            LIMIT 1
            """,
            (concept["id"], student_id, preferred_difficulty),
        ).fetchone()

        if row is None:
            # If the chosen concept is exhausted, try any unseen question.
            row = conn.execute(
                """
                SELECT q.id, q.concept_id, q.difficulty, q.question_text,
                       q.options_json, c.name AS concept_name
                FROM question_bank q
                JOIN concepts c ON c.id = q.concept_id
                WHERE q.id NOT IN (
                    SELECT question_id
                    FROM learning_attempts
                    WHERE student_id = ?
                )
                ORDER BY q.id
                LIMIT 1
                """,
                (student_id,),
            ).fetchone()

        if row is None:
            return {
                "completed": True,
                "message": "All available questions have been attempted.",
            }

        return {
            "completed": False,
            "id": row["id"],
            "concept_id": row["concept_id"],
            "concept": row["concept_name"],
            "difficulty": row["difficulty"],
            "question": row["question_text"],
            "options": json.loads(row["options_json"]),
            "estimated_mastery": round(probability, 4),
        }
    finally:
        conn.close()


@router.post("/attempts")
def submit_answer(payload: AnswerSubmission):
    try:
        return record_attempt(
            student_id=payload.student_id,
            question_id=payload.question_id,
            selected_answer=payload.selected_answer,
            workings=payload.workings,
            response_time_ms=payload.response_time_ms,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/mastery/{student_id}")
def get_mastery(student_id: int):
    conn = get_connection()
    try:
        student = conn.execute(
            "SELECT id, name FROM students WHERE id = ?",
            (student_id,),
        ).fetchone()

        if not student:
            raise HTTPException(status_code=404, detail="Student not found.")

        rows = conn.execute(
            """
            SELECT c.id AS concept_id, c.name AS concept,
                   COALESCE(m.p_mastery, ?) AS mastery,
                   COALESCE(m.attempts, 0) AS attempts,
                   COALESCE(m.correct_attempts, 0) AS correct_attempts
            FROM concepts c
            LEFT JOIN student_mastery m
              ON m.concept_id = c.id AND m.student_id = ?
            ORDER BY c.display_order
            """,
            (DEFAULT_MASTERY, student_id),
        ).fetchall()

        result = []

        for row in rows:
            item = dict(row)
            item["mastery_percent"] = round(item["mastery"] * 100, 1)
            item["mastery_level"] = mastery_level(item["mastery"])
            result.append(item)

        return {
            "student": dict(student),
            "mastery": result,
        }
    finally:
        conn.close()


@router.get("/recommendations/{student_id}")
def get_recommendations(student_id: int):
    """Return personalized learning recommendations and misconception guidance."""

    conn = get_connection()
    try:
        student = conn.execute(
            "SELECT id FROM students WHERE id = ?",
            (student_id,),
        ).fetchone()

        if not student:
            raise HTTPException(status_code=404, detail="Student not found.")

        rows = conn.execute(
            """
            SELECT c.id, c.name, c.lesson, c.practice_hint,
                   COALESCE(m.p_mastery, ?) AS mastery,
                   COALESCE(m.attempts, 0) AS attempts
            FROM concepts c
            LEFT JOIN student_mastery m
              ON m.concept_id = c.id AND m.student_id = ?
            ORDER BY mastery ASC, c.display_order ASC
            """,
            (DEFAULT_MASTERY, student_id),
        ).fetchall()

        # Get misconception frequencies for this student.
        misconception_rows = conn.execute(
            """
            SELECT concept_id, misconception_tag, COUNT(*) AS occurrences
            FROM misconception_events
            WHERE student_id = ?
            GROUP BY concept_id, misconception_tag
            ORDER BY occurrences DESC, misconception_tag
            """,
            (student_id,),
        ).fetchall()

        # Keep the most frequent recorded misconception per concept.
        misconception_by_concept = {}

        for event in misconception_rows:
            misconception_by_concept.setdefault(
                event["concept_id"],
                event["misconception_tag"],
            )

        # Targeted guidance for known misconception tags.
        remediation_guidance = {
            "confuses_boolean_and_integer": (
                "Review Python bool and int types. Practise identifying "
                "True, False, and integer values."
            ),
            "confuses_text_and_boolean": (
                "Compare strings such as 'True' with Boolean values True "
                "and False. Practise identifying their data types."
            ),
            "confuses_collection_and_boolean": (
                "Review Boolean values and collection types such as lists, "
                "tuples, and dictionaries."
            ),
            "misunderstands_loop_control": (
                "Practise how loops execute and how break and continue "
                "change loop execution."
            ),
            "ignores_second_assignment": (
                "Trace variable assignments one statement at a time "
                "and record the final value."
            ),
            "confuses_addition_and_multiplication": (
                "Practise evaluating arithmetic expressions and "
                "distinguishing addition from multiplication."
            ),
            "tracks_only_increment": (
                "Trace every assignment and calculate the variable's "
                "final value after all statements."
            ),
        }

        recommendations = []

        for row in rows:
            # Use one consistent variable for mastery probability.
            p = float(row["mastery"])

            misconception_tag = misconception_by_concept.get(row["id"])

            targeted_guidance = (
                remediation_guidance.get(misconception_tag)
                if misconception_tag
                else None
            )

            if p < 0.5:
                action = "Review the lesson and practise beginner questions."
            elif p < 0.8:
                action = "Practise intermediate questions and review mistakes."
            else:
                action = "Try advanced questions to consolidate mastery."

            recommendations.append(
                {
                    "concept_id": row["id"],
                    "concept": row["name"],
                    "mastery_percent": round(p * 100, 1),
                    "attempts": row["attempts"],
                    "recommended_action": action,
                    "lesson": row["lesson"],
                    "practice_hint": row["practice_hint"],
                    "common_misconception": misconception_tag,
                    "targeted_remediation": targeted_guidance,
                }
            )

        return {
            "student_id": student_id,
            "recommendations": recommendations,
        }
    finally:
        conn.close()


@router.get("/graph/{student_id}")
def get_learning_graph(student_id: int):
    """Return concepts and prerequisite edges for the learning graph."""

    conn = get_connection()
    try:
        student = conn.execute(
            "SELECT id FROM students WHERE id = ?",
            (student_id,),
        ).fetchone()

        if not student:
            raise HTTPException(status_code=404, detail="Student not found.")

        concepts = conn.execute(
            """
            SELECT c.id, c.name, COALESCE(m.p_mastery, ?) AS mastery
            FROM concepts c
            LEFT JOIN student_mastery m
              ON m.concept_id = c.id AND m.student_id = ?
            ORDER BY c.display_order
            """,
            (DEFAULT_MASTERY, student_id),
        ).fetchall()

        links = conn.execute(
            "SELECT concept_id, prerequisite_id FROM concept_prerequisites"
        ).fetchall()

        return {
            "nodes": [
                {
                    "id": row["id"],
                    "label": row["name"],
                    "mastery": round(row["mastery"], 4),
                    "mastery_level": mastery_level(row["mastery"]),
                }
                for row in concepts
            ],
            "edges": [
                {
                    "source": row["prerequisite_id"],
                    "target": row["concept_id"],
                }
                for row in links
            ],
        }
    finally:
        conn.close()


@router.get("/analytics/teacher")
def teacher_analytics():
    """Return high-level learning analytics for teachers."""

    conn = get_connection()
    try:
        student_count = conn.execute(
            "SELECT COUNT(*) FROM students"
        ).fetchone()[0]

        attempt_count = conn.execute(
            "SELECT COUNT(*) FROM learning_attempts"
        ).fetchone()[0]

        accuracy = conn.execute(
            "SELECT AVG(is_correct) FROM learning_attempts"
        ).fetchone()[0]

        concepts = conn.execute(
            """
            SELECT c.id, c.name,
                   COUNT(a.id) AS attempts,
                   AVG(a.is_correct) AS accuracy
            FROM concepts c
            LEFT JOIN question_bank q ON q.concept_id = c.id
            LEFT JOIN learning_attempts a ON a.question_id = q.id
            GROUP BY c.id, c.name
            ORDER BY c.name
            """
        ).fetchall()

        misconceptions = conn.execute(
            """
            SELECT misconception_tag, COUNT(*) AS occurrences
            FROM misconception_events
            GROUP BY misconception_tag
            ORDER BY occurrences DESC
            LIMIT 10
            """
        ).fetchall()

        return {
            "student_count": student_count,
            "attempt_count": attempt_count,
            "overall_accuracy_percent": (
                round(accuracy * 100, 1)
                if accuracy is not None
                else 0
            ),
            "concepts": [
                {
                    "concept_id": row["id"],
                    "concept": row["name"],
                    "attempts": row["attempts"],
                    "accuracy_percent": (
                        round(row["accuracy"] * 100, 1)
                        if row["accuracy"] is not None
                        else None
                    ),
                }
                for row in concepts
            ],
            "top_misconceptions": [
                dict(row) for row in misconceptions
            ],
        }
    finally:
        conn.close()
