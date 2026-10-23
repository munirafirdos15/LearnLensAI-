
import { useEffect, useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

// =====================================================
// TEACHER ANALYTICS DASHBOARD
// =====================================================

function TeacherAnalytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadAnalytics() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/analytics/teacher"
      );

      if (!response.ok) {
        throw new Error(`Analytics API failed: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(
        `${err.message}. Check that the FastAPI backend is running.`
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <section className="teacher-analytics">
        <h2>📊 Teacher Analytics Dashboard</h2>
        <p>Loading analytics data...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="teacher-analytics">
        <h2>📊 Teacher Analytics Dashboard</h2>
        <p className="analytics-error">{error}</p>
        <button className="primary-button" onClick={loadAnalytics}>
          Retry
        </button>
      </section>
    );
  }

  // These keys match the actual FastAPI response.
  const students = data.student_count ?? 0;
  const attempts = data.attempt_count ?? 0;
  const accuracy = data.overall_accuracy_percent ?? 0;
  const concepts = data.concepts ?? [];
  const misconceptions = data.top_misconceptions ?? [];

  return (
    <section className="teacher-analytics">
      <div className="teacher-heading">
        <div>
          <span className="eyebrow">EDUCATOR WORKSPACE</span>
          <h2>📊 Teacher Analytics Dashboard</h2>
          <p className="muted">
            Monitor student participation, performance and learning gaps.
          </p>
        </div>

        <button className="primary-button" onClick={loadAnalytics}>
          Refresh Data
        </button>
      </div>

      <div className="teacher-metrics">
        <article className="teacher-metric">
          <span className="metric-icon">👨‍🎓</span>
          <span className="metric-label">Total Students</span>
          <strong>{students}</strong>
        </article>

        <article className="teacher-metric">
          <span className="metric-icon">📝</span>
          <span className="metric-label">Total Attempts</span>
          <strong>{attempts}</strong>
        </article>

        <article className="teacher-metric">
          <span className="metric-icon">🎯</span>
          <span className="metric-label">Overall Accuracy</span>
          <strong>{Number(accuracy).toFixed(1)}%</strong>
        </article>

        <article className="teacher-metric">
          <span className="metric-icon">🧠</span>
          <span className="metric-label">Concepts Tracked</span>
          <strong>{concepts.length}</strong>
        </article>
      </div>

      <div className="analytics-details">
        <h3>📚 Concept Performance</h3>

        {concepts.length === 0 ? (
          <p>No concept data available yet.</p>
        ) : (
          <div className="analytics-table-wrapper">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Concept</th>
                  <th>Attempts</th>
                  <th>Accuracy</th>
                </tr>
              </thead>

              <tbody>
                {concepts.map((item) => (
                  <tr key={item.concept_id}>
                    <td>{item.concept}</td>
                    <td>{item.attempts}</td>
                    <td>
                      {item.accuracy_percent == null
                        ? "No attempts yet"
                        : `${Number(item.accuracy_percent).toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="analytics-details">
        <h3>🔍 Common Misconceptions</h3>

        {misconceptions.length === 0 ? (
          <p>No misconception events recorded yet.</p>
        ) : (
          <ul className="misconceptions-list">
            {misconceptions.map((item, index) => (
              <li key={`${item.misconception_tag}-${index}`}>
                <span>{item.misconception_tag}</span>
                <strong>{item.occurrences} occurrences</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// =====================================================
// MAIN LEAR N LENS AI APPLICATION
// =====================================================
export default function App() {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState(null);

  // Existing assessment state
  const [topics, setTopics] = useState([]);
  const [topicId, setTopicId] = useState("");
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [finished, setFinished] = useState(false);

  // General UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Learning-gap state
  const [learningGaps, setLearningGaps] = useState([]);
  const [showGaps, setShowGaps] = useState(false);
  const [gapsLoading, setGapsLoading] = useState(false);

  // Knowledge graph state
  const [knowledgeGraph, setKnowledgeGraph] = useState(null);
  const [showGraph, setShowGraph] = useState(false);
  const [graphLoading, setGraphLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
const [recommendationsLoading, setRecommendationsLoading] = useState(false);

async function loadRecommendations() {
  if (!studentId) return;

  setRecommendationsLoading(true);

  try {
    const response = await fetch(
      `${API}/api/recommendations/${studentId}`
    );

    if (!response.ok) {
      throw new Error("Could not load recommendations");
    }

    const data = await response.json();

    setRecommendations(
      Array.isArray(data) ? data : data.recommendations || []
    );
  } catch (err) {
    setError(err.message);
  } finally {
    setRecommendationsLoading(false);
  }
}
  // Load existing topics
  useEffect(() => {
    fetch(`${API}/topics`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load topics");
        return res.json();
      })
      .then(setTopics)
      .catch(() => {
        setError("Cannot connect to the backend. Is FastAPI running?");
      });
  }, []);

  // Start assessment
  async function startQuiz(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      let id = studentId;

      if (!id) {
        const response = await fetch(`${API}/students`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });

        if (!response.ok) {
          throw new Error("Could not create student profile");
        }

        const student = await response.json();
        id = student.id;
        setStudentId(id);
      }

      const url = topicId
        ? `${API}/questions?topic_id=${topicId}`
        : `${API}/questions`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Could not load questions");
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("No questions found for this topic");
      }

      setQuestions(data);
      setIndex(0);
      setSelected("");
      setFeedback(null);
      setScore(0);
      setAnswered(0);
      setFinished(false);
      setShowGaps(false);
      setLearningGaps([]);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Submit answer
  async function submitAnswer() {
    if (!selected || feedback || !questions[index]) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/submit-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          question_id: questions[index].id,
          selected_answer: selected,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Could not submit answer");
      }

      setFeedback(result);
      setAnswered((count) => count + 1);

      if (result.is_correct) {
        setScore((count) => count + 1);
      }
    } catch (err) {
      setError(err.message || "Answer submission failed");
    } finally {
      setLoading(false);
    }
  }

  // Move to next question
  function nextQuestion() {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }

    setIndex((currentIndex) => currentIndex + 1);
    setSelected("");
    setFeedback(null);
    setError("");
  }

  // Load learning gaps
  async function loadLearningGaps() {
    if (!studentId) return;

    setGapsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/students/${studentId}/learning-gaps`
      );

      if (!response.ok) {
        throw new Error("Could not load learning gaps");
      }

      const data = await response.json();
      setLearningGaps(data.learning_gaps || []);
      setShowGaps(true);
    } catch (err) {
      setError(err.message || "Failed to load learning gaps");
    } finally {
      setGapsLoading(false);
    }
  }

  // Load knowledge graph
  async function loadKnowledgeGraph() {
    if (!studentId) return;

    setGraphLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/api/graph/${studentId}`);

      if (!response.ok) {
        throw new Error("Could not load knowledge graph");
      }

      const data = await response.json();
      setKnowledgeGraph(data);
      setShowGraph(true);
    } catch (err) {
      setError(err.message || "Failed to load knowledge graph");
    } finally {
      setGraphLoading(false);
    }
  }

  // Reset assessment
  function backToSetup() {
    setQuestions([]);
    setIndex(0);
    setFinished(false);
    setFeedback(null);
    setSelected("");
    setScore(0);
    setAnswered(0);
    setError("");
    setShowGaps(false);
    setLearningGaps([]);
  }

  const current = questions[index];

  return (
    <main className="app-shell">
      {/* Header */}
      <header className="topbar">
        <div className="brand-mark">L</div>

        <div>
          <h1>LearnLens AI</h1>
          <p>Understand your gaps. Learn at your pace.</p>
        </div>

        <span className="status-pill">Adaptive learning platform</span>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {/* Knowledge graph */}
      {studentId && (
        <section className="graph-panel">
          <div className="graph-panel-heading">
            <div>
              <span className="eyebrow">YOUR LEARNING PROGRESS</span>
              <h2>Knowledge Graph</h2>
              <p className="muted">
                Explore mastery and concept prerequisites.
              </p>
            </div>

            <button
              className="primary-button"
              onClick={loadKnowledgeGraph}
              disabled={graphLoading}
            >
              {graphLoading
                ? "Loading..."
                : showGraph
                  ? "Refresh Graph"
                  : "View Knowledge Graph"}
            </button>
          </div>

          {showGraph && knowledgeGraph && (
            <>
              <div className="graph-legend">
                <span>
                  <i className="legend-dot mastered-dot" />
                  Mastered: 80%+
                </span>
                <span>
                  <i className="legend-dot developing-dot" />
                  Developing: 50–79%
                </span>
                <span>
                  <i className="legend-dot practice-dot" />
                  Needs practice: below 50%
                </span>
              </div>

              <div className="graph-nodes">
                {(knowledgeGraph.nodes || []).map((node) => {
                  const mastery = Number(node.mastery) || 0;
                  const percent = Math.max(
                    0,
                    Math.min(100, mastery * 100)
                  );

                  const statusClass =
                    mastery >= 0.8
                      ? "mastered"
                      : mastery >= 0.5
                        ? "developing"
                        : "needs-practice";

                  const prerequisites = (knowledgeGraph.edges || [])
                    .filter((edge) => edge.target === node.id)
                    .map((edge) =>
                      knowledgeGraph.nodes.find(
                        (item) => item.id === edge.source
                      )?.label
                    )
                    .filter(Boolean);

                  const nextConcepts = (knowledgeGraph.edges || [])
                    .filter((edge) => edge.source === node.id)
                    .map((edge) =>
                      knowledgeGraph.nodes.find(
                        (item) => item.id === edge.target
                      )?.label
                    )
                    .filter(Boolean);

                  return (
                    <article
                      className={`graph-node ${statusClass}`}
                      key={node.id}
                    >
                      <div className="graph-node-top">
                        <span className="graph-node-icon">
                          {mastery >= 0.8
                            ? "✓"
                            : mastery >= 0.5
                              ? "↗"
                              : "◎"}
                        </span>
                        <span className={`mastery-badge ${statusClass}`}>
                          {(node.mastery_level || "unassessed")
                            .replaceAll("_", " ")}
                        </span>
                      </div>

                      <h3>{node.label}</h3>

                      <div className="mastery-number">
                        {percent.toFixed(1)}%
                        <span> mastery</span>
                      </div>

                      <div
                        className="graph-progress"
                        role="progressbar"
                        aria-label={`${node.label} mastery`}
                        aria-valuenow={Math.round(percent)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="graph-progress-fill"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="graph-connections">
                        <p>
                          <strong>Prerequisites</strong>
                          <span>
                            {prerequisites.length
                              ? prerequisites.join(", ")
                              : "None"}
                          </span>
                        </p>
                        <p>
                          <strong>Unlocks</strong>
                          <span>
                            {nextConcepts.length
                              ? nextConcepts.join(", ")
                              : "No linked concepts"}
                          </span>
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="graph-edges">
                <h3>Prerequisite Relationships</h3>
                <p className="muted">
                  Arrows point from prerequisites to dependent concepts.
                </p>

                {(knowledgeGraph.edges || []).length ? (
                  <ul>
                    {knowledgeGraph.edges.map((edge) => {
                      const source = knowledgeGraph.nodes.find(
                        (node) => node.id === edge.source
                      );
                      const target = knowledgeGraph.nodes.find(
                        (node) => node.id === edge.target
                      );

                      return (
                        <li key={`${edge.source}-${edge.target}`}>
                          <span>{source?.label || edge.source}</span>
                          <span className="edge-arrow">→</span>
                          <span>{target?.label || edge.target}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p>No prerequisite relationships found.</p>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* Assessment setup */}
      {!questions.length ? (
        <section className="setup-card">
          <span className="eyebrow">YOUR LEARNING JOURNEY</span>
          <h2>Find out what you know.</h2>

          <p className="muted">
            Take a short Python assessment to begin your personalised
            learning journey.
          </p>

          <form onSubmit={startQuiz}>
            <label htmlFor="student-name">Your name</label>
            <input
              id="student-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your name"
              required
              maxLength={100}
            />

            <label htmlFor="topic">Choose a learning topic</label>
            <select
              id="topic"
              value={topicId}
              onChange={(event) => setTopicId(event.target.value)}
            >
              <option value="">All Python topics</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>

            <button
              className="primary-button"
              type="submit"
              disabled={loading}
            >
              {loading ? "Preparing quiz..." : "Start assessment →"}
            </button>
          </form>

          <div className="setup-note">
            <span>✓</span> Your answers help identify topics to practise.
          </div>
        </section>
      ) : finished ? (
        /* Assessment results */
        <section className="result-card">
          <div className="result-icon">✓</div>
          <span className="eyebrow">ASSESSMENT COMPLETE</span>

          <h2>Well done, {name.trim() || "learner"}!</h2>
          <p className="muted">Here is your assessment summary.</p>

          <div className="score-circle">
            <strong>
              {questions.length
                ? Math.round((score / questions.length) * 100)
                : 0}
              %
            </strong>
            <span>Score</span>
          </div>

          <div className="stats-row">
            <div>
              <strong>{score}</strong>
              <span>Correct</span>
            </div>
            <div>
              <strong>{questions.length - score}</strong>
              <span>Incorrect</span>
            </div>
            <div>
              <strong>{answered}</strong>
              <span>Answered</span>
            </div>
          </div>

          <button
            className="primary-button"
            onClick={loadLearningGaps}
            disabled={gapsLoading}
          >
            {gapsLoading ? "Analyzing..." : "Analyze my learning gaps"}
          </button>

          {showGaps && (
            <section className="gaps-section">
              <h3>Your Learning-Gap Analysis</h3>
              <p className="muted">
                Understand which topics need more practice.
              </p>

              <div className="gaps-list">
                {learningGaps.map((gap) => (
                  <div className="gap-item" key={gap.topic_id}>
                    <div className="gap-heading">
                      <strong>{gap.topic}</strong>
                      <span
                        className={`gap-status ${
                          gap.status === "Weak"
                            ? "status-weak"
                            : gap.status === "Strong"
                              ? "status-strong"
                              : gap.status === "Developing"
                                ? "status-developing"
                                : "status-unassessed"
                        }`}
                      >
                        {gap.status}
                      </span>
                    </div>

                    {gap.accuracy == null ? (
                      <p className="muted">
                        Complete questions on this topic to assess
                        your knowledge.
                      </p>
                    ) : (
                      <>
                        <div className="gap-progress">
                          <div
                            className="gap-progress-fill"
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(100, Number(gap.accuracy) || 0)
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="muted">
                          {gap.accuracy}% accuracy · {gap.correct_answers}/
                          {gap.attempts} correct answers
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <button
            className="primary-button"
            onClick={backToSetup}
          >
            Take another assessment
          </button>
        </section>
      ) : (
        /* Existing Python quiz */
        <section className="quiz-card">
          <div className="quiz-meta">
            <span>{current.topic}</span>
            <span>
              Question {index + 1} of {questions.length}
            </span>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${((index + 1) / questions.length) * 100}%`,
              }}
            />
          </div>

          <span className="eyebrow">PYTHON ASSESSMENT</span>
          <h2>{current.question}</h2>

          <div className="options-list">
            {Object.entries(current.options || {}).map(([key, value]) => {
              const isSelected = selected === key;
              let className = "option";

              if (isSelected) className += " selected";

              if (feedback && isSelected) {
                className += feedback.is_correct
                  ? " correct"
                  : " incorrect";
              }

              return (
                <button
                  key={key}
                  type="button"
                  className={className}
                  onClick={() => setSelected(key)}
                  disabled={!!feedback || loading}
                >
                  <span className="option-letter">{key}</span>
                  <span>{value}</span>
                  {isSelected && (
                    <span className="option-check">✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {feedback && (
            <div
              className={
                feedback.is_correct
                  ? "feedback correct-box"
                  : "feedback wrong-box"
              }
            >
              <strong>
                {feedback.is_correct
                  ? "Correct answer!"
                  : "Not quite yet"}
              </strong>
              <p>{feedback.explanation}</p>
            </div>
          )}

          <div className="quiz-footer">
            <span className="muted">
              {feedback ? "Answer recorded" : "Choose one answer"}
            </span>

            {!feedback ? (
              <button
                className="primary-button"
                onClick={submitAnswer}
                disabled={!selected || loading}
              >
                {loading ? "Checking..." : "Submit answer"}
              </button>
            ) : (
              <button
                className="primary-button"
                onClick={nextQuestion}
              >
                {index + 1 === questions.length
                  ? "View results →"
                  : "Next question →"}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Personalized learning recommendations */}
      {studentId && (
        <section className="teacher-analytics">
          <div className="teacher-heading">
            <div>
              <span className="eyebrow">NEXT STEPS</span>
              <h2>🎯 Personalized Learning Plan</h2>
              <p className="muted">
                Practice concepts based on your current mastery and learning gaps.
              </p>
            </div>
            <button
              className="primary-button"
              onClick={loadRecommendations}
              disabled={recommendationsLoading}
            >
              {recommendationsLoading ? "Generating..." : "Generate Learning Plan"}
            </button>
          </div>

          {recommendations.length > 0 ? (
            <div className="teacher-metrics">
              {recommendations.map((item, index) => {
                const masteryValue = item.mastery_percent != null
                  ? Number(item.mastery_percent)
                  : item.mastery != null
                    ? Number(item.mastery) * 100
                    : null;
                const title = item.concept_name || item.label || item.concept_id || item.topic || `Recommendation ${index + 1}`;
                const advice = item.targeted_remediation || item.recommendation || item.reason || item.description;

                return (
                  <article className="teacher-metric" key={item.concept_id || item.topic_id || index}>
                    <span className="metric-label">Recommended concept</span>
                    <strong>{title}</strong>
                    <p>
                      Mastery: {masteryValue == null ? "Not available" : `${masteryValue.toFixed(1)}%`}
                    </p>
                    {advice && <p>{advice}</p>}
                    {item.common_misconception && (
                      <p><b>Common misconception:</b> {item.common_misconception}</p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="muted">
              Click “Generate Learning Plan” to load recommendations from the backend.
            </p>
          )}
        </section>
      )}

      {/* Teacher analytics */}
      <TeacherAnalytics />

      <footer>
        LearnLens AI · Personalised learning through knowledge
        tracking and gap detection
      </footer>
    </main>
  );
}
