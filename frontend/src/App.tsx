
import { useCallback, useEffect, useState } from "react";
import "./App.css";

const API_BASE = "http://127.0.0.1:8000";

type Role = "Student" | "Instructor";
type JsonObject = Record<string, unknown>;

type Question = {
  id?: string | number;
  question_id?: string | number;
  concept_id?: string | number;
  concept_name?: string;
  concept?: string;
  difficulty?: string | number;
  question?: string;
  question_text?: string;
  options?: Record<string, string> | string[];
  estimated_mastery?: number;
};

type MasteryItem = {
  concept_id?: string | number;
  concept?: string;
  concept_name?: string;
  name?: string;
  mastery?: number;
  mastery_probability?: number;
  probability?: number;
  accuracy?: number;
  status?: string;
  attempts?: number;
  correct_answers?: number;
};

type Recommendation = {
  concept?: string;
  concept_name?: string;
  topic?: string;
  title?: string;
  reason?: string;
  recommended_action?: string;
  action?: string;
  study_concepts?: string[];
  practice_task?: string;
  status?: string;
  accuracy?: number;
};

type GraphNode = {
  id?: string | number;
  name?: string;
  label?: string;
  concept_name?: string;
  mastery?: number;
};

type GraphEdge = {
  source?: string | number;
  target?: string | number;
  from?: string | number;
  to?: string | number;
  source_id?: string | number;
  target_id?: string | number;
};

const studentNav = [
  { id: "overview", label: "My Progress", icon: "📊" },
  { id: "diagnostic", label: "Start Diagnostic", icon: "🧠" },
  { id: "gaps", label: "My Learning Gaps", icon: "🔎" },
  { id: "remediation", label: "Concept Remediation", icon: "📘" },
  { id: "reassessment", label: "Mastery Reassessment", icon: "🎯" },
];

const instructorNav = [
  { id: "overview", label: "Class Overview", icon: "📊" },
  { id: "misconceptions", label: "Misconception Analysis", icon: "🧠" },
  { id: "gaps", label: "Prerequisite Gap Map", icon: "🔗" },
  { id: "cohort", label: "Cohort Heatmap", icon: "🗺️" },
  { id: "interventions", label: "Teaching Interventions", icon: "📚" },
  { id: "reassessment", label: "Reassessment Results", icon: "🎯" },
];

const pageTitles: Record<string, string> = {
  overview: "Learning Overview",
  diagnostic: "Misconception Detective",
  gaps: "Prerequisite Learning Gaps",
  remediation: "Concept Remediation",
  reassessment: "Mastery Reassessment",
  misconceptions: "Misconception Analysis",
  cohort: "Cohort Learning Patterns",
  interventions: "Teaching Interventions",
};

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object"
    ? (value as JsonObject)
    : {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function readText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

function readNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  const percentage = value <= 1 ? value * 100 : value;
  return `${Math.round(percentage)}%`;
}

function getOptions(question: Question): [string, string][] {
  if (!question.options) return [];

  if (Array.isArray(question.options)) {
    return question.options.map((option, index) => [
      ["A", "B", "C", "D"][index] ?? String(index + 1),
      String(option),
    ]);
  }

  return Object.entries(question.options).map(([key, value]) => [
    key,
    String(value),
  ]);
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const data = asObject(body);
    const detail = readText(data.detail, data.message);
    throw new Error(detail || `Request failed (${response.status})`);
  }

  return body as T;
}

function App() {
  const [role, setRole] = useState<Role>("Student");
  const [activePage, setActivePage] = useState("overview");

  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState<number | null>(() => {
    const saved = sessionStorage.getItem("learnlens_student_id");
    return saved && Number.isFinite(Number(saved)) ? Number(saved) : null;
  });

  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [workings, setWorkings] = useState("");
  const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(
    null,
  );

  const [answerFeedback, setAnswerFeedback] = useState<JsonObject | null>(null);
  const [mastery, setMastery] = useState<MasteryItem[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [teacherAnalytics, setTeacherAnalytics] = useState<JsonObject | null>(
    null,
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const navigation = role === "Student" ? studentNav : instructorNav;

  const clearMessages = () => {
    setError("");
    setNotice("");
  };

  function changeRole(nextRole: Role) {
    setRole(nextRole);
    setActivePage("overview");
    clearMessages();
  }

  const registerStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearMessages();

    if (!studentName.trim()) {
      setError("Please enter your name.");
      return;
    }

    setLoading(true);

    try {
      const result = asObject(
        await apiRequest<unknown>("/api/students", {
          method: "POST",
          body: JSON.stringify({ name: studentName.trim() }),
        }),
      );

      const newId = readNumber(result.id, result.student_id);

      if (newId === null) {
        throw new Error(
          "Student was created, but the response did not contain an id or student_id.",
        );
      }

      setStudentId(newId);
      sessionStorage.setItem("learnlens_student_id", String(newId));
      setNotice(`Welcome! Your student ID is ${newId}.`);
      setStudentName("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not register. Check that the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadQuestion = useCallback(async () => {
    if (studentId === null) {
      setError("Register as a student before starting the quiz.");
      return;
    }

    clearMessages();
    setLoading(true);
    setAnswerFeedback(null);
    setSelectedAnswer("");
    setWorkings("");

    try {
      const result = asObject(
        await apiRequest<unknown>(
          `/api/questions/next?student_id=${encodeURIComponent(studentId)}`,
        ),
      );

      const questionData = asObject(result.question ?? result);
      const nextQuestion = questionData as Question;

      if (
        nextQuestion.id === undefined &&
        nextQuestion.question_id === undefined
      ) {
        if (
          readText(result.message, result.detail) ||
          Object.keys(questionData).length === 0
        ) {
          setQuestion(null);
          setNotice(
            readText(result.message, result.detail) ||
              "No more questions are currently available.",
          );
          return;
        }

        throw new Error("The question response did not include a question ID.");
      }

      setQuestion(nextQuestion);
      setQuestionStartedAt(Date.now());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load the next question.",
      );
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  const loadMastery = useCallback(async () => {
    if (studentId === null) return;

    try {
      const result = asObject(
        await apiRequest<unknown>(`/api/mastery/${studentId}`),
      );

      const items = result.mastery ?? result.concepts ?? result.results;
      setMastery(asArray<MasteryItem>(items));
    } catch (err) {
      setError(
        `Could not load mastery: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
    }
  }, [studentId]);

  const loadRecommendations = useCallback(async () => {
    if (studentId === null) return;

    try {
      const result = asObject(
        await apiRequest<unknown>(`/api/recommendations/${studentId}`),
      );

      setRecommendations(
        asArray<Recommendation>(
          result.recommendations ?? result.items ?? result.results,
        ),
      );
    } catch (err) {
      setError(
        `Could not load recommendations: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
    }
  }, [studentId]);

  const loadGraph = useCallback(async () => {
    if (studentId === null) return;

    try {
      const result = asObject(
        await apiRequest<unknown>(`/api/graph/${studentId}`),
      );

      setGraphNodes(asArray<GraphNode>(result.nodes));
      setGraphEdges(asArray<GraphEdge>(result.edges));
    } catch (err) {
      setError(
        `Could not load the prerequisite graph: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
    }
  }, [studentId]);

  const loadTeacherAnalytics = useCallback(async () => {
    try {
      const result = asObject(
        await apiRequest<unknown>("/api/analytics/teacher"),
      );
      setTeacherAnalytics(result);
    } catch (err) {
      setError(
        `Could not load teacher analytics: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
    }
  }, []);

  useEffect(() => {
    if (role === "Student" && studentId !== null) {
      void loadMastery();
      void loadRecommendations();
      void loadGraph();
    }
  }, [role, studentId, loadMastery, loadRecommendations, loadGraph]);

  useEffect(() => {
    if (role === "Instructor") {
      void loadTeacherAnalytics();
    }
  }, [role, loadTeacherAnalytics]);

  async function submitAnswer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    if (studentId === null) {
      setError("Register as a student before submitting an answer.");
      return;
    }

    if (!question) {
      setError("Load a question first.");
      return;
    }

    if (!selectedAnswer) {
      setError("Select one of the four answer options.");
      return;
    }

    const questionId = question.question_id ?? question.id;

    if (questionId === undefined) {
      setError("This question does not have an ID.");
      return;
    }

    const responseTimeMs =
      questionStartedAt === null ? 0 : Math.max(0, Date.now() - questionStartedAt);

    setLoading(true);

    try {
      const result = asObject(
        await apiRequest<unknown>("/api/attempts", {
          method: "POST",
          body: JSON.stringify({
            student_id: studentId,
            question_id: String(questionId),
            selected_answer: selectedAnswer,
            workings: workings.trim() || null,
            response_time_ms: responseTimeMs,
          }),
        }),
      );

      setAnswerFeedback(result);
      setNotice("Your answer has been submitted.");

      // Refresh data after the backend records the attempt and updates BKT.
      await Promise.all([
        loadMastery(),
        loadRecommendations(),
        loadGraph(),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not submit the answer.",
      );
    } finally {
      setLoading(false);
    }
  }

  function renderRegistration() {
    if (studentId !== null) {
      return (
        <section className="panel">
          <span className="eyebrow">STUDENT SESSION</span>
          <h2>Your learning session is ready</h2>
          <p className="muted">
            Current student ID: <strong>{studentId}</strong>
          </p>
          <button
            className="secondary-button"
            onClick={() => {
              sessionStorage.removeItem("learnlens_student_id");
              setStudentId(null);
              setQuestion(null);
              setAnswerFeedback(null);
              clearMessages();
            }}
          >
            Switch student
          </button>
        </section>
      );
    }

    return (
      <section className="panel">
        <span className="eyebrow">GET STARTED</span>
        <h2>Enter your name to begin</h2>
        <p className="muted">
          Your student ID will be used to load adaptive questions and track
          your learning progress during this session.
        </p>

        <form onSubmit={registerStudent} className="question-card">
          <label htmlFor="student-name">Your name</label>
          <input
            id="student-name"
            value={studentName}
            onChange={(event) => setStudentName(event.target.value)}
            maxLength={100}
            placeholder="Enter your name"
            required
          />
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? "Creating profile..." : "Create student profile →"}
          </button>
        </form>
      </section>
    );
  }

  function renderQuestionPage() {
    if (studentId === null) return renderRegistration();

    return (
      <section className="panel">
        <span className="eyebrow">ADAPTIVE PRACTICE</span>
        <h2>Let's understand how you think</h2>
        <p className="muted">
          Questions are selected by the backend using your estimated mastery
          and prerequisite progress.
        </p>

        {!question && (
          <button
            className="primary-button"
            onClick={() => void loadQuestion()}
            disabled={loading}
          >
            {loading ? "Loading question..." : "Get next question →"}
          </button>
        )}

        {question && (
          <form className="question-card" onSubmit={submitAnswer}>
            <span className="eyebrow">
              {readText(question.concept_name, question.concept, "LEARNING CONCEPT")}
              {" · "}
              {readText(question.difficulty, "Adaptive difficulty")}
            </span>

            <h3>{readText(question.question, question.question_text)}</h3>

            <div className="answer-options">
              {getOptions(question).map(([key, value]) => (
                <label className="answer-option" key={key}>
                  <input
                    type="radio"
                    name="selected-answer"
                    value={key}
                    checked={selectedAnswer === key}
                    onChange={() => setSelectedAnswer(key)}
                    disabled={loading || answerFeedback !== null}
                  />
                  <span>
                    <strong>{key}.</strong> {value}
                  </span>
                </label>
              ))}
            </div>

            <label htmlFor="student-workings">
              How did you solve it? <span className="muted">(optional)</span>
            </label>
            <textarea
              id="student-workings"
              value={workings}
              onChange={(event) => setWorkings(event.target.value)}
              maxLength={5000}
              rows={3}
              placeholder="Explain your steps in your own words..."
              disabled={loading || answerFeedback !== null}
            />

            {!answerFeedback && (
              <button
                className="primary-button"
                type="submit"
                disabled={loading}
              >
                {loading ? "Submitting..." : "Submit answer →"}
              </button>
            )}

            {answerFeedback && (
              <div className="feedback-panel">
                <h3>
                  {answerFeedback.is_correct === true ||
                  answerFeedback.correct === true
                    ? "Correct!"
                    : answerFeedback.is_correct === false ||
                        answerFeedback.correct === false
                      ? "Not quite — review the explanation"
                      : "Answer submitted"}
                </h3>

                <p>
                  {readText(
                    answerFeedback.message,
                    answerFeedback.feedback,
                    "Your answer was sent to the backend.",
                  )}
                </p>

                {readText(answerFeedback.explanation) && (
                  <p>
                    <strong>Explanation:</strong>{" "}
                    {readText(answerFeedback.explanation)}
                  </p>
                )}

                {answerFeedback.updated_mastery !== undefined && (
                  <p>
                    <strong>Updated mastery:</strong>{" "}
                    {typeof answerFeedback.updated_mastery === "number"
                      ? formatPercent(answerFeedback.updated_mastery)
                      : JSON.stringify(answerFeedback.updated_mastery)}
                  </p>
                )}

                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void loadQuestion()}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Next adaptive question →"}
                </button>
              </div>
            )}
          </form>
        )}
      </section>
    );
  }

  function renderStudentOverview() {
    if (studentId === null) return renderRegistration();

    const numericMastery = mastery
      .map((item) =>
        readNumber(
          item.mastery,
          item.mastery_probability,
          item.probability,
          item.accuracy,
        ),
      )
      .filter((value): value is number => value !== null);

    const average =
      numericMastery.length > 0
        ? numericMastery.reduce((sum, value) => sum + value, 0) /
          numericMastery.length
        : null;

    const needsPractice = mastery.filter((item) => {
      const value = readNumber(
        item.mastery,
        item.mastery_probability,
        item.probability,
        item.accuracy,
      );
      return value !== null && (value <= 1 ? value < 0.7 : value < 70);
    }).length;

    return (
      <>
        <section className="welcome-card">
          <div>
            <span className="eyebrow">YOUR PERSONAL LEARNING SPACE</span>
            <h2>Learn why, not just what.</h2>
            <p>
              Practice adaptively, strengthen concepts, and track your mastery
              using your recorded learning attempts.
            </p>
            <button
              className="light-button"
              onClick={() => {
                setActivePage("diagnostic");
                void loadQuestion();
              }}
            >
              Start adaptive practice →
            </button>
          </div>
          <div className="welcome-art" aria-hidden="true">
            <span>🧠</span>
            <span>+</span>
            <span>📘</span>
          </div>
        </section>

        <div className="section-heading">
          <div>
            <h2>Your learning snapshot</h2>
            <p>Based on the mastery data returned by the backend.</p>
          </div>
          <button className="secondary-button" onClick={() => void loadMastery()}>
            Refresh progress
          </button>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <span className="stat-icon">📈</span>
            <p>Average mastery</p>
            <h3>{formatPercent(average)}</h3>
            <small>Across returned concepts</small>
          </article>
          <article className="stat-card">
            <span className="stat-icon">📚</span>
            <p>Concepts tracked</p>
            <h3>{mastery.length || "—"}</h3>
            <small>Mastery records available</small>
          </article>
          <article className="stat-card">
            <span className="stat-icon">🎯</span>
            <p>Need more practice</p>
            <h3>{mastery.length ? needsPractice : "—"}</h3>
            <small>Using a 70% display threshold</small>
          </article>
        </div>

        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Concept-wise mastery</h2>
              <p>Progress for concepts returned by the backend.</p>
            </div>
          </div>

          {mastery.length === 0 ? (
            <p className="muted">
              No mastery records yet. Complete a question to start building
              your learning profile.
            </p>
          ) : (
            <div className="insight-list">
              {mastery.map((item, index) => {
                const value = readNumber(
                  item.mastery,
                  item.mastery_probability,
                  item.probability,
                  item.accuracy,
                );
                const pct =
                  value === null ? 0 : Math.min(100, value <= 1 ? value * 100 : value);

                return (
                  <div
                    className="insight-row"
                    key={String(item.concept_id ?? item.name ?? index)}
                  >
                    <div className="mastery-item">
                      <strong>
                        {readText(
                          item.concept_name,
                          item.concept,
                          item.name,
                          `Concept ${index + 1}`,
                        )}
                      </strong>
                      <div className="mastery-track">
                        <div
                          className="mastery-fill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <small>
                        {formatPercent(value)}
                        {item.status ? ` · ${item.status}` : ""}
                      </small>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Recommended next step</h2>
              <p>Personalized suggestions from the backend.</p>
            </div>
            <button
              className="secondary-button"
              onClick={() => void loadRecommendations()}
            >
              Refresh
            </button>
          </div>

          {recommendations.length === 0 ? (
            <p className="muted">
              Recommendations will appear when the backend returns them.
            </p>
          ) : (
            recommendations.slice(0, 3).map((item, index) => (
              <div className="recommendation-row" key={index}>
                <div className="recommendation-icon">✦</div>
                <div>
                  <strong>
                    {readText(
                      item.concept_name,
                      item.concept,
                      item.topic,
                      item.title,
                      "Recommended practice",
                    )}
                  </strong>
                  <p>
                    {readText(
                      item.reason,
                      item.recommended_action,
                      item.action,
                      item.practice_task,
                      "Review this concept and complete the suggested practice.",
                    )}
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setActivePage("remediation");
                    clearMessages();
                  }}
                >
                  View
                </button>
              </div>
            ))
          )}
        </section>
      </>
    );
  }

  function renderLearningGaps() {
    if (studentId === null) return renderRegistration();

    return (
      <section className="panel">
        <span className="eyebrow">YOUR LEARNING MAP</span>
        <h2>Find the concepts that need attention</h2>
        <p className="muted">
          This section uses concept mastery and prerequisite relationships
          returned by the backend.
        </p>

        <button className="secondary-button" onClick={() => void loadGraph()}>
          Refresh knowledge graph
        </button>

        {graphNodes.length === 0 ? (
          <p className="muted">
            No graph nodes returned yet. Check that your student has been
            created and that the graph endpoint is available.
          </p>
        ) : (
          <div className="learning-path">
            {graphNodes.map((node, index) => (
              <div key={String(node.id ?? index)}>
                <div className="path-node attention">
                  <span>{index + 1}</span>
                  <div>
                    <strong>
                      {readText(
                        node.label,
                        node.name,
                        node.concept_name,
                        `Concept ${index + 1}`,
                      )}
                    </strong>
                    <p>
                      {node.mastery !== undefined
                        ? `Mastery: ${formatPercent(node.mastery)}`
                        : "Concept in the learning graph"}
                    </p>
                  </div>
                </div>
                {index < graphNodes.length - 1 && <div className="path-line" />}
              </div>
            ))}
          </div>
        )}

        <h3>Prerequisite relationships</h3>
        {graphEdges.length === 0 ? (
          <p className="muted">No prerequisite edges returned.</p>
        ) : (
          <div className="insight-list">
            {graphEdges.map((edge, index) => (
              <div className="insight-row" key={index}>
                <div>
                  <strong>
                    {String(edge.source ?? edge.from ?? edge.source_id ?? "?")}
                    {" → "}
                    {String(edge.target ?? edge.to ?? edge.target_id ?? "?")}
                  </strong>
                  <p>Prerequisite relationship returned by the API.</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  function renderRemediation() {
    if (studentId === null) return renderRegistration();

    return (
      <section className="panel">
        <span className="eyebrow">PERSONALIZED PRACTICE</span>
        <h2>Recommended concepts to work on</h2>
        <p className="muted">
          Recommendations below are loaded from the learning engine. Specific
          lesson resources depend on what the backend returns.
        </p>

        <button
          className="secondary-button"
          onClick={() => void loadRecommendations()}
        >
          Refresh recommendations
        </button>

        {recommendations.length === 0 ? (
          <p className="muted">
            No recommendations are available yet. Submit a question first.
          </p>
        ) : (
          <div className="insight-list">
            {recommendations.map((item, index) => (
              <div className="insight-row" key={index}>
                <div>
                  <strong>
                    {readText(
                      item.concept_name,
                      item.concept,
                      item.topic,
                      item.title,
                      `Recommendation ${index + 1}`,
                    )}
                  </strong>
                  <p>
                    {readText(
                      item.reason,
                      item.recommended_action,
                      item.action,
                      "Practice this concept to improve mastery.",
                    )}
                  </p>
                  {item.study_concepts?.length ? (
                    <p>Study concepts: {item.study_concepts.join(", ")}</p>
                  ) : null}
                  {item.practice_task && <p>{item.practice_task}</p>}
                </div>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setActivePage("reassessment");
                    void loadQuestion();
                  }}
                >
                  Practice →
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  function renderReassessment() {
    if (studentId === null) return renderRegistration();

    return (
      <section className="panel">
        <span className="eyebrow">MASTERY REASSESSMENT</span>
        <h2>Check your understanding</h2>
        <p className="muted">
          The next question comes from the adaptive question endpoint. The
          backend determines question selection; this frontend does not
          calculate mastery locally.
        </p>

        <button
          className="primary-button"
          onClick={() => void loadQuestion()}
          disabled={loading}
        >
          {loading ? "Loading..." : "Load reassessment question →"}
        </button>

        {question && (
          <div className="question-card">
            <p>
              {readText(question.concept_name, question.concept)} ·{" "}
              {readText(question.difficulty, "Adaptive difficulty")}
            </p>
            <h3>{readText(question.question, question.question_text)}</h3>
            <p className="muted">
              Answer this question in the Diagnostic page to submit it and
              receive feedback.
            </p>
            <button
              className="secondary-button"
              onClick={() => setActivePage("diagnostic")}
            >
              Open answer form →
            </button>
          </div>
        )}

        <button
          className="secondary-button"
          onClick={() => void loadMastery()}
        >
          Refresh mastery after reassessment
        </button>
      </section>
    );
  }

  function renderStudentPage() {
    switch (activePage) {
      case "diagnostic":
        return renderQuestionPage();
      case "gaps":
        return renderLearningGaps();
      case "remediation":
        return renderRemediation();
      case "reassessment":
        return renderReassessment();
      default:
        return renderStudentOverview();
    }
  }

  function renderTeacherOverview() {
    const data = teacherAnalytics ?? {};
    const students = readNumber(
      data.total_students,
      data.student_count,
      data.totalStudents,
    );
    const attempts = readNumber(
      data.total_attempts,
      data.attempt_count,
      data.totalAttempts,
    );
    const accuracy = readNumber(
      data.accuracy,
      data.overall_accuracy,
      data.average_accuracy,
    );

    return (
      <>
        <section className="welcome-card">
          <div>
            <span className="eyebrow">INSTRUCTOR WORKSPACE</span>
            <h2>Turn learning signals into action.</h2>
            <p>
              Review class performance and common misconceptions using
              analytics returned by the backend.
            </p>
            <button
              className="light-button"
              onClick={() => setActivePage("misconceptions")}
            >
              Explore misconceptions →
            </button>
          </div>
          <div className="welcome-art instructor-art" aria-hidden="true">
            <span>↗</span>
            <span>◎</span>
            <span>⌁</span>
          </div>
        </section>

        <div className="section-heading">
          <div>
            <h2>Class insight summary</h2>
            <p>Live values when the analytics endpoint is available.</p>
          </div>
          <button
            className="secondary-button"
            onClick={() => void loadTeacherAnalytics()}
          >
            Refresh analytics
          </button>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <span className="stat-icon">👥</span>
            <p>Total students</p>
            <h3>{students ?? "—"}</h3>
            <small>From teacher analytics</small>
          </article>
          <article className="stat-card">
            <span className="stat-icon">📝</span>
            <p>Total attempts</p>
            <h3>{attempts ?? "—"}</h3>
            <small>Recorded learning attempts</small>
          </article>
          <article className="stat-card">
            <span className="stat-icon">🎯</span>
            <p>Accuracy</p>
            <h3>{formatPercent(accuracy)}</h3>
            <small>From returned analytics</small>
          </article>
        </div>

        <section className="panel">
          <h2>Teacher analytics data</h2>
          {teacherAnalytics ? (
            <pre className="api-data">
              {JSON.stringify(teacherAnalytics, null, 2)}
            </pre>
          ) : (
            <p className="muted">
              Waiting for the teacher analytics API response.
            </p>
          )}
        </section>
      </>
    );
  }

  function renderTeacherPage() {
    const data = teacherAnalytics ?? {};
    const concepts = asArray<JsonObject>(
      data.concepts ??
        data.concept_statistics ??
        data.concept_stats ??
        data.concept_performance,
    );
    const misconceptions = asArray<JsonObject>(
      data.common_misconceptions ?? data.misconceptions,
    );

    switch (activePage) {
      case "misconceptions":
        return (
          <section className="panel">
            <span className="eyebrow">DIAGNOSTIC INSIGHTS</span>
            <h2>Common misconceptions</h2>
            <p className="muted">
              Misconception patterns from teacher analytics.
            </p>
            {misconceptions.length === 0 ? (
              <p className="muted">
                No misconception list was found in the current analytics
                response. The exact response schema needs verification.
              </p>
            ) : (
              <div className="insight-list">
                {misconceptions.map((item, index) => (
                  <div className="insight-row" key={index}>
                    <div>
                      <strong>
                        {readText(
                          item.name,
                          item.misconception,
                          item.tag,
                          item.label,
                          `Misconception ${index + 1}`,
                        )}
                      </strong>
                      <p>
                        {readText(
                          item.count,
                          item.frequency,
                          item.attempts,
                          item.description,
                          "",
                        )}
                      </p>
                    </div>
                    <span className="status-pill warning">Review</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        );

      case "gaps":
        return (
          <section className="panel">
            <span className="eyebrow">PREREQUISITE GRAPH</span>
            <h2>Explore concept relationships</h2>
            <p className="muted">
              The graph endpoint is student-specific. Select a student session
              in the student view to inspect that student's graph.
            </p>
            <div className="insight-list">
              {graphNodes.map((node, index) => (
                <div className="insight-row" key={String(node.id ?? index)}>
                  <div>
                    <strong>
                      {readText(node.label, node.name, node.concept_name)}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
            <p className="muted">
              Prerequisite relationships returned: {graphEdges.length}
            </p>
          </section>
        );

      case "cohort":
        return (
          <section className="panel">
            <span className="eyebrow">COHORT PERFORMANCE</span>
            <h2>Concept-wise class performance</h2>
            <p className="muted">
              This view displays available concept statistics. A student-level
              mastery graph is not a substitute for class-wide cohort data.
            </p>
            {concepts.length === 0 ? (
              <p className="muted">
                No concept statistics were found in the analytics response.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Concept</th>
                      <th>Accuracy</th>
                      <th>Attempts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {concepts.map((item, index) => (
                      <tr key={index}>
                        <td>
                          {readText(
                            item.name,
                            item.concept,
                            item.concept_name,
                            item.topic,
                            `Concept ${index + 1}`,
                          )}
                        </td>
                        <td>
                          {formatPercent(
                            readNumber(item.accuracy, item.average_accuracy),
                          )}
                        </td>
                        <td>
                          {readText(item.attempts, item.total_attempts, "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );

      case "interventions":
        return (
          <section className="panel">
            <span className="eyebrow">TEACHING INTERVENTIONS</span>
            <h2>Use evidence to plan the next step</h2>
            <p className="muted">
              Use the available concept statistics and misconception data to
              identify where additional instruction may help. Teaching
              interventions are not generated locally by this UI.
            </p>
            {concepts.length > 0 ? (
              <div className="insight-list">
                {concepts.map((item, index) => (
                  <div className="insight-row" key={index}>
                    <div>
                      <strong>
                        {readText(
                          item.name,
                          item.concept,
                          item.concept_name,
                          `Concept ${index + 1}`,
                        )}
                      </strong>
                      <p>
                        Accuracy:{" "}
                        {formatPercent(
                          readNumber(item.accuracy, item.average_accuracy),
                        )}
                      </p>
                    </div>
                    <span className="status-pill warning">Review data</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">
                Concept-level analytics are not available in the current
                response.
              </p>
            )}
          </section>
        );

      case "reassessment":
        return (
          <section className="panel">
            <span className="eyebrow">REASSESSMENT RESULTS</span>
            <h2>Review recorded class performance</h2>
            <p className="muted">
              The currently documented teacher analytics endpoint does not
              guarantee a separate reassessment-history field.
            </p>
            <button
              className="secondary-button"
              onClick={() => void loadTeacherAnalytics()}
            >
              Refresh analytics
            </button>
            <pre className="api-data">
              {JSON.stringify(teacherAnalytics ?? {}, null, 2)}
            </pre>
          </section>
        );

      default:
        return renderTeacherOverview();
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">L</div>
          <div>
            <strong>
              LearnLens <span>AI</span>
            </strong>
            <small>Intelligent learning</small>
          </div>
        </div>

        <div className="workspace-label">
          {role === "Student" ? "MY WORKSPACE" : "TEACHING WORKSPACE"}
        </div>

        <nav className="sidebar-nav" aria-label={`${role} navigation`}>
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? "active" : ""}`}
              onClick={() => {
                setActivePage(item.id);
                clearMessages();
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {activePage === item.id && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="demo-indicator">
            <span />
            {studentId !== null ? `Student ID: ${studentId}` : "Not registered"}
          </div>
          <p>Personalized learning through adaptive question selection.</p>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>LearnLens AI</span>
            <span>/</span>
            <strong>{pageTitles[activePage]}</strong>
          </div>

          <div className="role-switch" aria-label="Switch dashboard">
            <button
              className={role === "Student" ? "selected" : ""}
              onClick={() => changeRole("Student")}
            >
              Student
            </button>
            <button
              className={role === "Instructor" ? "selected" : ""}
              onClick={() => changeRole("Instructor")}
            >
              Instructor
            </button>
          </div>
        </header>

        <div className="page-content">
          <div className="page-intro">
            <div>
              <span className="eyebrow">
                {role === "Student"
                  ? "YOUR LEARNING JOURNEY"
                  : "CLASS INTELLIGENCE"}
              </span>
              <h1>{pageTitles[activePage]}</h1>
            </div>
            <span className="prototype-badge">
              {loading ? "LOADING..." : "API INTEGRATION"}
            </span>
          </div>

          {error && (
            <div className="feedback error-message" role="alert">
              <strong>Request error:</strong> {error}
              <p>
                Confirm that the backend is running at {API_BASE} and that the
                requested route is available.
              </p>
              <button className="secondary-button" onClick={() => setError("")}>
                Dismiss
              </button>
            </div>
          )}

          {notice && (
            <div className="feedback" role="status">
              {notice}
            </div>
          )}

          {role === "Student" ? renderStudentPage() : renderTeacherPage()}

          <footer className="page-footer">
            <span>LearnLens AI</span>
            <span>Adaptive learning · FastAPI integration</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
