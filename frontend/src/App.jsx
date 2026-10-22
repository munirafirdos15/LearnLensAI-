import { useEffect, useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

export default function App() {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState(null);
  const [topics, setTopics] = useState([]);
  const [topicId, setTopicId] = useState("");
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);

  const [learningGaps, setLearningGaps] = useState([]);
  const [showGaps, setShowGaps] = useState(false);
  const [gapsLoading, setGapsLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/topics`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load topics");
        return res.json();
      })
      .then(setTopics)
      .catch(() =>
        setError("Cannot connect to the backend. Is FastAPI running?")
      );
  }, []);

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

        if (!response.ok) throw new Error("Could not create student profile");
        const student = await response.json();
        id = student.id;
        setStudentId(id);
      }

      const url = topicId
        ? `${API}/questions?topic_id=${topicId}`
        : `${API}/questions`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not load questions");

      const data = await response.json();
      if (!data.length) throw new Error("No questions found for this topic");

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
      setAnswered((n) => n + 1);
      if (result.is_correct) setScore((n) => n + 1);
    } catch (err) {
      setError(err.message || "Answer submission failed");
    } finally {
      setLoading(false);
    }
  }

  function nextQuestion() {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }

    setIndex((n) => n + 1);
    setSelected("");
    setFeedback(null);
    setError("");
  }

  async function loadLearningGaps() {
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
      setLearningGaps(data.learning_gaps);
      setShowGaps(true);
    } catch (err) {
      setError(err.message || "Failed to load learning gaps");
    } finally {
      setGapsLoading(false);
    }
  }

  function backToSetup() {
    setQuestions([]);
    setFinished(false);
    setFeedback(null);
    setSelected("");
    setError("");
    setShowGaps(false);
    setLearningGaps([]);
  }

  const current = questions[index];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">L</div>
        <div>
          <h1>LearnWise AI</h1>
          <p>Understand your gaps. Learn at your pace.</p>
        </div>
        <span className="status-pill">Learning platform</span>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {!questions.length ? (
        <section className="setup-card">
          <span className="eyebrow">YOUR LEARNING JOURNEY</span>
          <h2>Find out what you know.</h2>
          <p className="muted">
            Take a short Python assessment to begin your personalised learning
            journey.
          </p>

          <form onSubmit={startQuiz}>
            <label htmlFor="student-name">Your name</label>
            <input
              id="student-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
              maxLength={100}
            />

            <label htmlFor="topic">Choose a learning topic</label>
            <select
              id="topic"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
            >
              <option value="">All Python topics</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>

            <button className="primary-button" disabled={loading}>
              {loading ? "Preparing quiz..." : "Start assessment →"}
            </button>
          </form>

          <div className="setup-note">
            <span>✓</span> Your answers help identify topics to practise.
          </div>
        </section>
      ) : finished ? (
        <section className="result-card">
          <div className="result-icon">✓</div>
          <span className="eyebrow">ASSESSMENT COMPLETE</span>
          <h2>Well done, {name.trim()}!</h2>
          <p className="muted">Here is your assessment summary.</p>

          <div className="score-circle">
            <strong>{Math.round((score / questions.length) * 100)}%</strong>
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
              <strong>{questions.length}</strong>
              <span>Questions</span>
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

                    {gap.accuracy === null ? (
                      <p className="muted">
                        Complete questions on this topic to assess your
                        knowledge.
                      </p>
                    ) : (
                      <>
                        <div className="gap-progress">
                          <div
                            className="gap-progress-fill"
                            style={{ width: `${gap.accuracy}%` }}
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

          <button className="primary-button" onClick={backToSetup}>
            Take another assessment
          </button>
        </section>
      ) : (
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
            {Object.entries(current.options).map(([key, value]) => {
              const isSelected = selected === key;

              let className = "option";
              if (isSelected) className += " selected";
              if (feedback && isSelected) {
                className += feedback.is_correct ? " correct" : " incorrect";
              }

              return (
                <button
                  key={key}
                  className={className}
                  onClick={() => setSelected(key)}
                  disabled={!!feedback || loading}
                >
                  <span className="option-letter">{key}</span>
                  <span>{value}</span>
                  {isSelected && <span className="option-check">✓</span>}
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
                {feedback.is_correct ? "Correct answer!" : "Not quite yet"}
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
              <button className="primary-button" onClick={nextQuestion}>
                {index + 1 === questions.length
                  ? "View results →"
                  : "Next question →"}
              </button>
            )}
          </div>
        </section>
      )}

      <footer>LearnWise AI · Personalised learning through gap detection</footer>
    </main>
  );
}