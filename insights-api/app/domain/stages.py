from enum import StrEnum


class Stage(StrEnum):
    """Pipeline stages of a job application, in funnel order."""

    APPLIED = "applied"
    SCREEN = "screen"
    INTERVIEW = "interview"
    OFFER = "offer"
    REJECTED = "rejected"


FINAL_STAGES: frozenset[Stage] = frozenset({Stage.OFFER, Stage.REJECTED})


def is_final(stage: Stage) -> bool:
    """A final stage ends the pipeline for that application."""
    return stage in FINAL_STAGES
