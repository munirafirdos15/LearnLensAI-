
"""Learning engine: persist attempts, update BKT mastery and detect misconceptions."""

import json

from app.bkt import DEFAULT_MASTERY, update_mastery, mastery_level
from app.database import get_connection


def record_attempt(
    student_id: int,
    question_id: str,
    selected_answer: str,
    workings: str | None = None,
    response_time_ms: int | None = None,
) -> dict:
    """Save one answer and update the student's concept mastery."""

    selected_answer = selected_answer.strip().upper()

    if selected_answer not in {"A", "B", "C", "D"}:
        raise ValueError("selected_answer must be A, B, C, or D.")

    if response_time_ms is not None and response_time_ms < 0:
        raise ValueError("response_time_ms cannot be negative.")

    conn = get_connection()

    try:
        # Validate student and question.
        student = conn.execute(
            "SELECT id FROM students WHERE id = ?",
            (student_id,),
        ).fetchone()

        if student is None:
            raise ValueError(f"Student {student_id} does not exist.")

        question = conn.execute(
            """
            SELECT id, concept_id, correct_answer, misconception_tags_json,
                   explanation
            FROM question_bank
            WHERE id = ?
            """,
            (question_id,),
        ).fetchone()

        if question is None:
            raise ValueError(f"Question '{question_id}' does not exist.")

        concept_id = question["concept_id"]
        correct_answer = question["correct_answer"]
        is_correct = selected_answer == correct_answer

        tags = json.loads(question["misconception_tags_json"] or "{}")
        misconception_tag = None if is_correct else tags.get(selected_answer)

        mastery_row = conn.execute(
            """
            SELECT p_mastery, attempts, correct_attempts
            FROM student_mastery
            WHERE student_id = ? AND concept_id = ?
            """,
            (student_id, concept_id),
        ).fetchone()

        if mastery_row is None:
            prior = DEFAULT_MASTERY
            attempts_before = 0
            correct_before = 0
        else:
            prior = mastery_row["p_mastery"]
            attempts_before = mastery_row["attempts"]
            correct_before = mastery_row["correct_attempts"]

        new_mastery = update_mastery(prior, is_correct)

        # Persist the attempt and updated mastery in one transaction.
        with conn:
            conn.execute(
                """
                INSERT INTO learning_attempts (
                    student_id, question_id, selected_answer, is_correct,
                    workings, response_time_ms, misconception_tag
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    student_id,
                    question_id,
                    selected_answer,
                    int(is_correct),
                    workings,
                    response_time_ms,
                    misconception_tag,
                ),
            )

            conn.execute(
                """
                INSERT INTO student_mastery (
                    student_id, concept_id, p_mastery, attempts,
                    correct_attempts, updated_at
                )
                VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(student_id, concept_id) DO UPDATE SET
                    p_mastery = excluded.p_mastery,
                    attempts = student_mastery.attempts + 1,
                    correct_attempts =
                        student_mastery.correct_attempts
                        + excluded.correct_attempts,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    student_id,
                    concept_id,
                    new_mastery,
                    int(is_correct),
                ),
            )

            if misconception_tag:
                previous = conn.execute(
                    """
                    SELECT COUNT(*) FROM misconception_events
                    WHERE student_id = ?
                      AND concept_id = ?
                      AND misconception_tag = ?
                    """,
                    (student_id, concept_id, misconception_tag),
                ).fetchone()[0]

                confidence = (
                    "high" if previous >= 2
                    else "medium" if previous >= 1
                    else "low"
                )

                conn.execute(
                    """
                    INSERT INTO misconception_events (
                        student_id, concept_id, question_id,
                        misconception_tag, evidence, confidence
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        student_id,
                        concept_id,
                        question_id,
                        misconception_tag,
                        f"Selected {selected_answer}; expected {correct_answer}",
                        confidence,
                    ),
                )

        return {
            "student_id": student_id,
            "question_id": question_id,
            "concept_id": concept_id,
            "selected_answer": selected_answer,
            "correct_answer": correct_answer,
            "is_correct": is_correct,
            "explanation": question["explanation"],
            "previous_mastery": round(prior, 4),
            "mastery": round(new_mastery, 4),
            "mastery_percent": round(new_mastery * 100, 1),
            "mastery_level": mastery_level(new_mastery),
            "attempts": attempts_before + 1,
            "correct_attempts": correct_before + int(is_correct),
            "misconception_tag": misconception_tag,
        }

    finally:
        conn.close()
