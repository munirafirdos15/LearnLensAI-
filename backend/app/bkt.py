
"""Bayesian Knowledge Tracing for LearnLens AI."""

DEFAULT_MASTERY = 0.20
DEFAULT_LEARN = 0.15
DEFAULT_SLIP = 0.10
DEFAULT_GUESS = 0.20


def update_mastery(
    prior_mastery: float,
    is_correct: bool,
    learn: float = DEFAULT_LEARN,
    slip: float = DEFAULT_SLIP,
    guess: float = DEFAULT_GUESS,
) -> float:
    """Return estimated mastery after one observed answer."""

    prior = max(0.0, min(1.0, float(prior_mastery)))

    if not (0 <= learn <= 1 and 0 <= slip < 1 and 0 <= guess < 1):
        raise ValueError("Invalid BKT parameters.")

    # Estimate mastery after observing the answer.
    if is_correct:
        numerator = prior * (1 - slip)
        denominator = numerator + (1 - prior) * guess
    else:
        numerator = prior * slip
        denominator = numerator + (1 - prior) * (1 - guess)

    posterior = numerator / denominator if denominator else prior

    # Account for the possibility of learning during the attempt.
    updated = posterior + (1 - posterior) * learn

    return max(0.0, min(1.0, updated))


def mastery_level(probability: float) -> str:
    """Convert the mastery estimate into a readable label."""

    if probability >= 0.80:
        return "mastered"
    if probability >= 0.50:
        return "developing"
    return "needs_practice"
