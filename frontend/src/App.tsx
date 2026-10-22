
import { useState } from "react";
import "./App.css";

type Role = "Student" | "Instructor";

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

function App() {
  const [role, setRole] = useState<Role>("Student");
  const [activePage, setActivePage] = useState("overview");
  const [answer, setAnswer] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [feedback, setFeedback] = useState("");
  const [reassessed, setReassessed] = useState(false);

  const navigation = role === "Student" ? studentNav : instructorNav;

  function changeRole(nextRole: Role) {
    setRole(nextRole);
    setActivePage("overview");
    setFeedback("");
  }

  function submitDiagnostic() {
    if (!answer.trim()) {
      setFeedback("Please enter your answer first.");
      return;
    }

    if (answer.trim() === "2/5") {
      setFeedback(
        "Likely misconception: independent numerator-denominator addition. You added the numerators and denominators directly. This is a rule-based demo diagnosis, not a live AI result."
      );
    } else if (
      answer.trim() === "5/6" ||
      answer.trim() === "5 / 6"
    ) {
      setFeedback(
        "Correct! You found a common denominator. Try explaining why both fractions must be converted before adding."
      );
    } else {
      setFeedback(
        "Answer recorded locally. Review equivalent fractions and common denominators, then try again. This prototype does not send your answer to the backend yet."
      );
    }
  }

  function submitReassessment() {
    if (!answer.trim()) {
      setFeedback("Enter an answer before checking your understanding.");
      return;
    }

    const correct =
      answer.trim() === "5/6" || answer.trim() === "5 / 6";

    setReassessed(correct);
    setFeedback(
      correct
        ? "Correct! You demonstrated understanding on this practice question. This is a local demo result, not a validated mastery score."
        : "Not quite yet. Review the common-denominator method in Concept Remediation and try again."
    );
  }

  function renderStudentPage() {
    switch (activePage) {
      case "diagnostic":
        return (
          <section className="panel">
            <span className="eyebrow">STEP 01 · DIAGNOSE</span>
            <h2>Let's understand how you think</h2>
            <p className="muted">
              Solve the question and explain your reasoning. Your reasoning
              helps identify the learning gap behind an incorrect answer.
            </p>
            <div className="question-card">
              <span className="eyebrow">FRACTIONS · GRADE 6</span>
              <h3>What is 1/2 + 1/3?</h3>
              <label htmlFor="diagnostic-answer">Your answer</label>
              <input
                id="diagnostic-answer"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Example: 5/6"
              />
              <label htmlFor="diagnostic-reasoning">
                How did you solve it?
              </label>
              <textarea
                id="diagnostic-reasoning"
                value={reasoning}
                onChange={(event) => setReasoning(event.target.value)}
                placeholder="Explain your steps in your own words..."
                rows={3}
              />
              <button className="primary-button" onClick={submitDiagnostic}>
                Analyse my answer →
              </button>
              {feedback && <p className="feedback">{feedback}</p>}
            </div>
            <p className="note">
              Prototype mode: diagnosis uses a simple local rule. Connect the
              backend to enable server-side diagnosis and reasoning analysis.
            </p>
          </section>
        );

      case "gaps":
        return (
          <>
            <section className="panel">
              <span className="eyebrow">YOUR LEARNING MAP</span>
              <h2>Find the concept behind the mistake</h2>
              <p className="muted">
                Example learning path for adding fractions. These are
                illustrative demo findings, not your actual assessment results.
              </p>
              <div className="learning-path">
                <div className="path-node completed">
                  <span>✓</span>
                  <div>
                    <strong>Understand fractions</strong>
                    <p>Foundational concept</p>
                  </div>
                </div>
                <div className="path-line" />
                <div className="path-node attention">
                  <span>!</span>
                  <div>
                    <strong>Equivalent fractions</strong>
                    <p>Review recommended</p>
                  </div>
                </div>
                <div className="path-line" />
                <div className="path-node attention">
                  <span>!</span>
                  <div>
                    <strong>Common denominators</strong>
                    <p>Practice recommended</p>
                  </div>
                </div>
                <div className="path-line" />
                <div className="path-node upcoming">
                  <span>4</span>
                  <div>
                    <strong>Add fractions confidently</strong>
                    <p>Reassess after practice</p>
                  </div>
                </div>
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  setActivePage("remediation");
                  setFeedback("");
                }}
              >
                Work on these concepts →
              </button>
            </section>
          </>
        );

      case "remediation":
        return (
          <section className="panel">
            <span className="eyebrow">STEP 03 · REPAIR</span>
            <h2>Learn the method, not just the answer</h2>
            <div className="lesson-card">
              <h3>Adding fractions with different denominators</h3>
              <ol>
                <li>Find a common denominator for both fractions.</li>
                <li>
                  Convert 1/2 to 3/6 and 1/3 to 2/6.
                </li>
                <li>Add the numerators: 3/6 + 2/6 = 5/6.</li>
                <li>Keep the common denominator and simplify if needed.</li>
              </ol>
              <div className="worked-example">
                <span>Remember</span>
                <strong>
                  1/2 + 1/3 = 3/6 + 2/6 = 5/6
                </strong>
                <p>
                  Add the numerators only after converting the fractions to
                  the same denominator.
                </p>
              </div>
            </div>
            <button
              className="primary-button"
              onClick={() => {
                setActivePage("reassessment");
                setAnswer("");
                setFeedback("");
              }}
            >
              Check my understanding →
            </button>
          </section>
        );

      case "reassessment":
        return (
          <section className="panel">
            <span className="eyebrow">STEP 04 · REASSESS</span>
            <h2>Can you apply what you've learned?</h2>
            <p className="muted">
              Try this practice question. A real reassessment should use a
              new question served by the backend.
            </p>
            <div className="question-card">
              <h3>What is 1/2 + 1/3?</h3>
              <label htmlFor="reassessment-answer">Your answer</label>
              <input
                id="reassessment-answer"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Example: 5/6"
              />
              <button className="primary-button" onClick={submitReassessment}>
                Check answer →
              </button>
              {feedback && <p className="feedback">{feedback}</p>}
              {reassessed && (
                <p className="note">
                  You can now connect this result to a persistent mastery
                  record when the API integration is added.
                </p>
              )}
            </div>
          </section>
        );

      default:
        return (
          <>
            <section className="welcome-card">
              <div>
                <span className="eyebrow">YOUR PERSONAL LEARNING SPACE</span>
                <h2>Learn why, not just what.</h2>
                <p>
                  Identify misconceptions, strengthen prerequisite concepts,
                  and check your understanding through reassessment.
                </p>
                <button
                  className="light-button"
                  onClick={() => {
                    setActivePage("diagnostic");
                    setAnswer("");
                    setFeedback("");
                  }}
                >
                  Start a diagnostic →
                </button>
              </div>
              <div className="welcome-art" aria-hidden="true">
                <span>½</span>
                <span>+</span>
                <span>⅓</span>
                <span>=</span>
                <span>⅚</span>
              </div>
            </section>

            <div className="section-heading">
              <div>
                <h2>Your learning snapshot</h2>
                <p>Illustrative demo data until your assessment history is connected.</p>
              </div>
            </div>
            <div className="stats-grid">
              <article className="stat-card">
                <span className="stat-icon">🎯</span>
                <p>Concepts mastered</p>
                <h3>—</h3>
                <small>Complete a diagnostic to begin</small>
              </article>
              <article className="stat-card">
                <span className="stat-icon">🔎</span>
                <p>Gaps identified</p>
                <h3>2 demo</h3>
                <small>Equivalent fractions, common denominators</small>
              </article>
              <article className="stat-card">
                <span className="stat-icon">📘</span>
                <p>Practice status</p>
                <h3>Ready</h3>
                <small>Targeted practice available</small>
              </article>
            </div>
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Recommended next step</h2>
                  <p>Build the foundation before moving ahead.</p>
                </div>
              </div>
              <div className="recommendation-row">
                <div className="recommendation-icon">✦</div>
                <div>
                  <strong>Review equivalent fractions</strong>
                  <p>
                    Learn how fractions can have different numerators and
                    denominators but represent the same value.
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => setActivePage("remediation")}
                >
                  Start practice
                </button>
              </div>
            </section>
          </>
        );
    }
  }

  function renderInstructorPage() {
    switch (activePage) {
      case "misconceptions":
        return (
          <section className="panel">
            <span className="eyebrow">DIAGNOSTIC INSIGHTS</span>
            <h2>Which errors need attention?</h2>
            <p className="muted">
              Illustrative patterns only. Real frequencies require aggregated
              diagnostic responses from the backend.
            </p>
            <div className="insight-list">
              <div className="insight-row">
                <div>
                  <strong>Adding numerators and denominators independently</strong>
                  <p>Possible root cause: common denominators not understood.</p>
                </div>
                <span className="status-pill warning">Investigate</span>
              </div>
              <div className="insight-row">
                <div>
                  <strong>Difficulty finding equivalent fractions</strong>
                  <p>Possible root cause: weak fraction equivalence skills.</p>
                </div>
                <span className="status-pill warning">Review</span>
              </div>
              <div className="insight-row">
                <div>
                  <strong>Incorrect simplification</strong>
                  <p>Possible root cause: incomplete understanding of factors.</p>
                </div>
                <span className="status-pill">Monitor</span>
              </div>
            </div>
          </section>
        );

      case "gaps":
        return (
          <section className="panel">
            <span className="eyebrow">PREREQUISITE GRAPH</span>
            <h2>Trace learning blockers</h2>
            <p className="muted">
              Example curriculum dependency map. Replace this with the
              prerequisite graph and learner data supplied by the backend.
            </p>
            <div className="learning-path">
              <div className="path-node completed">
                <span>1</span>
                <div>
                  <strong>Fraction fundamentals</strong>
                  <p>Prerequisite concept</p>
                </div>
              </div>
              <div className="path-line" />
              <div className="path-node attention">
                <span>2</span>
                <div>
                  <strong>Equivalent fractions</strong>
                  <p>Potential blocker</p>
                </div>
              </div>
              <div className="path-line" />
              <div className="path-node attention">
                <span>3</span>
                <div>
                  <strong>Common denominators</strong>
                  <p>Potential blocker</p>
                </div>
              </div>
              <div className="path-line" />
              <div className="path-node upcoming">
                <span>4</span>
                <div>
                  <strong>Fraction addition</strong>
                  <p>Target learning outcome</p>
                </div>
              </div>
            </div>
          </section>
        );

      case "cohort":
        return (
          <section className="panel">
            <span className="eyebrow">COHORT TELEMETRY</span>
            <h2>Explore patterns across concepts</h2>
            <p className="muted">
              Demo heatmap layout. No real student data is loaded yet.
            </p>
            <div className="heatmap-wrap">
              <table className="heatmap">
                <thead>
                  <tr>
                    <th>Concept</th>
                    <th>Group A</th>
                    <th>Group B</th>
                    <th>Group C</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Fraction basics", "low", "low", "medium"],
                    ["Equivalent fractions", "high", "medium", "high"],
                    ["Common denominators", "high", "high", "medium"],
                    ["Fraction addition", "medium", "high", "high"],
                  ].map((row) => (
                    <tr key={row[0]}>
                      <td>{row[0]}</td>
                      {row.slice(1).map((level, index) => (
                        <td key={index}>
                          <span className={`heat-cell ${level}`}>
                            {level === "low"
                              ? "Strong"
                              : level === "medium"
                                ? "Mixed"
                                : "Needs support"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">
              Heatmap values are illustrative labels, not measured class
              performance.
            </p>
          </section>
        );

      case "interventions":
        return (
          <section className="panel">
            <span className="eyebrow">ACTIONABLE TEACHING SUPPORT</span>
            <h2>Suggested classroom interventions</h2>
            <p className="muted">
              Example recommendations based on the demo misconception taxonomy.
            </p>
            <div className="intervention-card">
              <span className="priority">PRIORITY 1</span>
              <h3>Reteach equivalent fractions</h3>
              <p>
                Use visual fraction strips to show how 1/2 and 1/3 can be
                represented in sixths before adding them.
              </p>
              <span className="intervention-meta">Target: prerequisite understanding</span>
            </div>
            <div className="intervention-card">
              <span className="priority">PRIORITY 2</span>
              <h3>Use a short worked-example exercise</h3>
              <p>
                Ask students to explain why denominators must match and then
                solve a new problem independently.
              </p>
              <span className="intervention-meta">Target: conceptual explanation</span>
            </div>
          </section>
        );

      case "reassessment":
        return (
          <section className="panel">
            <span className="eyebrow">MASTERY CHECK</span>
            <h2>Evaluate learning after intervention</h2>
            <p className="muted">
              The table below shows the structure for reporting reassessment.
              Connect real results before using it to make teaching decisions.
            </p>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Measure</th>
                    <th>Current status</th>
                    <th>Next action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Initial diagnostic</td>
                    <td>Demo only</td>
                    <td>Collect responses</td>
                  </tr>
                  <tr>
                    <td>Targeted remediation</td>
                    <td>Example lesson</td>
                    <td>Deliver intervention</td>
                  </tr>
                  <tr>
                    <td>Follow-up assessment</td>
                    <td>Not connected</td>
                    <td>Measure change</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        );

      default:
        return (
          <>
            <section className="welcome-card">
              <div>
                <span className="eyebrow">INSTRUCTOR WORKSPACE</span>
                <h2>Turn learning signals into action.</h2>
                <p>
                  Explore misconceptions, trace prerequisite gaps, and plan
                  focused interventions using evidence from student responses.
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
                <p>These are feature previews, not live class statistics.</p>
              </div>
            </div>
            <div className="stats-grid">
              <article className="stat-card">
                <span className="stat-icon">👥</span>
                <p>Students assessed</p>
                <h3>—</h3>
                <small>Awaiting assessment API</small>
              </article>
              <article className="stat-card">
                <span className="stat-icon">🧠</span>
                <p>Misconception patterns</p>
                <h3>3 demo</h3>
                <small>Example error categories</small>
              </article>
              <article className="stat-card">
                <span className="stat-icon">🔗</span>
                <p>Prerequisite map</p>
                <h3>Ready</h3>
                <small>Illustrative curriculum graph</small>
              </article>
            </div>
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Recommended teaching focus</h2>
                  <p>Example intervention for the fraction-addition unit.</p>
                </div>
              </div>
              <div className="recommendation-row">
                <div className="recommendation-icon">✦</div>
                <div>
                  <strong>Review equivalent fractions and common denominators</strong>
                  <p>
                    Use diagnostic evidence to confirm the root cause before
                    selecting a class-wide intervention.
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => setActivePage("interventions")}
                >
                  View actions
                </button>
              </div>
            </section>
          </>
        );
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">L</div>
          <div>
            <strong>LearnLens <span>AI</span></strong>
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
                setFeedback("");
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
            Prototype mode
          </div>
          <p>Personalized learning through misconception detection.</p>
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
                {role === "Student" ? "YOUR LEARNING JOURNEY" : "CLASS INTELLIGENCE"}
              </span>
              <h1>{pageTitles[activePage]}</h1>
            </div>
            <span className="prototype-badge">DEMO DATA</span>
          </div>

          {role === "Student" ? renderStudentPage() : renderInstructorPage()}

          <footer className="page-footer">
            <span>LearnLens AI</span>
            <span>Prototype · Sample data only</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
