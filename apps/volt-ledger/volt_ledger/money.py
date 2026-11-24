"""Money handling. Amounts are integers in minor units (cents); floating point is never used.

Text -> Decimal -> int. A value with more decimals than its currency allows is an error, not a rounding.
"""
from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

MINOR_UNITS: dict[str, int] = {"USD": 2, "CAD": 2, "EUR": 2, "GBP": 2, "CHF": 2, "AUD": 2, "JPY": 0, "KWD": 3}

_WIRE = re.compile(r"-?[0-9]+")


class AmountError(ValueError):
    """An amount that cannot be read exactly."""


def minor_units(currency: str) -> int:
    try:
        return MINOR_UNITS[currency]
    except KeyError:
        raise AmountError(f"unknown currency {currency!r}") from None


def parse_amount(text: str, currency: str) -> int:
    """'1,234.56' USD -> 123456. Accepts thousands separators, a leading minus, or brackets for negatives.
    Blank text is an error: the caller decides whether blank means zero."""
    places = minor_units(currency)
    raw = (text or "").strip()
    if not raw:
        raise AmountError("blank amount")
    negative = False
    if raw.startswith("(") and raw.endswith(")"):
        negative, raw = True, raw[1:-1].strip()
    if raw.startswith("-"):
        if negative:
            raise AmountError(f"double negative in {text!r}")
        negative, raw = True, raw[1:].strip()
    raw = raw.replace(",", "")
    if not re.fullmatch(r"[0-9]+(\.[0-9]+)?", raw):
        raise AmountError(f"not a number: {text!r}")
    try:
        value = Decimal(raw)
    except InvalidOperation:
        raise AmountError(f"not a number: {text!r}") from None
    scaled = value.scaleb(places)
    if scaled != scaled.to_integral_value():
        raise AmountError(f"{text!r} has more than {places} decimals for {currency}")
    minor = int(scaled)
    return -minor if negative else minor


def format_amount(minor: int, currency: str) -> str:
    """123456 USD -> '1,234.56'; negatives get a leading minus."""
    if not isinstance(minor, int) or isinstance(minor, bool):
        raise AmountError("amount must be an int of minor units")
    places = minor_units(currency)
    sign = "-" if minor < 0 else ""
    whole, frac = divmod(abs(minor), 10**places)
    body = f"{whole:,}"
    return f"{sign}{body}.{frac:0{places}d}" if places else f"{sign}{body}"


def to_wire(minor: int) -> str:
    """JSON-safe form for JavaScript callers: an integer string."""
    if not isinstance(minor, int) or isinstance(minor, bool):
        raise AmountError("amount must be an int of minor units")
    return str(minor)


def from_wire(text: str) -> int:
    if not isinstance(text, str) or not _WIRE.fullmatch(text):
        raise AmountError(f"wire amount must be an integer string, got {text!r}")
    return int(text)
