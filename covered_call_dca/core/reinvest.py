from __future__ import annotations

from enum import Enum


class ReinvestMode(str, Enum):
    """분배금 재투자 시나리오."""

    NO_REINVEST = "no_reinvest"
    SELF_REINVEST = "self_reinvest"
    DISTILL_QQQI70_SPYI30 = "distill_qqqi70_spyi30"


DISTILL_LEG1 = "QQQI"
DISTILL_LEG2 = "SPYI"
DISTILL_W1 = 0.70
DISTILL_W2 = 0.30
