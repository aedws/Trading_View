from __future__ import annotations

from typing import Literal, NamedTuple

import numpy as np

from .metrics import MetricsPack

PERMANENTLY_BANNED = frozenset(
    {
        "ULTY",
        "CONY",
        "YBIT",
        "TSLY",
        "YMAX",
        "NFLY",
        "FBY",
        "APLY",
        "MSFO",
        "MSFY",
        "AIYY",
        "MSTY",
        "JPMO",
    }
)


GradeCode = Literal[
    "PERMANENTLY_BANNED",
    "Aplusplus",
    "Aplus",
    "A",
    "A_minus",
    "B",
    "C1",
    "C1_star",
    "C2",
    "D",
]


class GradeResult(NamedTuple):
    code: GradeCode
    reason: str


def grade_ticker(
    ticker: str,
    metrics: MetricsPack,
) -> GradeResult:
    """
    룰 기반 등급. 레퍼런스 채점표가 있으면 임계값만 조정하면 됩니다.
    PERMANENTLY_BANNED 는 수치와 무관 최하 처리.
    """
    t = ticker.strip().upper()
    if t in PERMANENTLY_BANNED:
        return GradeResult("PERMANENTLY_BANNED", "내장 블랙리스트 종목입니다.")

    irr = metrics.irr
    if not np.isfinite(irr):
        irr = np.nan

    mdd = metrics.mdd
    coc = metrics.cash_on_cash

    # MDD 에 절값 사용(예: -0.132 == -13.2%)
    if irr > 0.35 and np.isfinite(mdd) and mdd > -0.12:
        return GradeResult("Aplusplus", "고IRR·통제된 낙폭 패턴 근처")
    if irr > 0.28:
        return GradeResult("Aplus", "수익률 우수")
    if irr > 0.20:
        return GradeResult("A", "수익률 양호")
    if irr > 0.14:
        return GradeResult("A_minus", "무난—거시 환경 민감")
    if irr > 0.08:
        return GradeResult("B", "보통")
    if np.isfinite(coc) and coc < 0.05:
        return GradeResult("C2", "현금환수율 불안 및 저 IRR")
    if np.isfinite(mdd) and mdd <= -0.35:
        return GradeResult("C1_star", "과도한 에쿼티 MDD 의심")
    if irr > 0.03:
        return GradeResult("C1", "저수익")
    return GradeResult("D", "부진 또는 검증 필요")


def grade_public_label(code: GradeCode) -> str:
    return {
        "PERMANENTLY_BANNED": "PERMANENTLY_BANNED",
        "Aplusplus": "A++",
        "Aplus": "A+",
        "A": "A",
        "A_minus": "A'",
        "B": "B",
        "C1": "C1",
        "C1_star": "C1*",
        "C2": "C2",
        "D": "D",
    }[code]
