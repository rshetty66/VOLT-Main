import pytest

from volt_ledger.money import AmountError, format_amount, from_wire, parse_amount, to_wire


@pytest.mark.parametrize("text,cur,expected", [
    ("1,234.56", "USD", 123456), ("(1,234.56)", "USD", -123456), ("-0.01", "USD", -1),
    ("1250000000.00", "USD", 125000000000), ("7", "USD", 700), ("1000", "JPY", 1000), ("1.234", "KWD", 1234),
])
def test_parse(text, cur, expected):
    assert parse_amount(text, cur) == expected


@pytest.mark.parametrize("text", ["", "abc", "10.005", "1.2.3", "--5", "1e5", "(-5)"])
def test_parse_rejects(text):
    with pytest.raises(AmountError):
        parse_amount(text, "USD")


def test_unknown_currency():
    with pytest.raises(AmountError):
        parse_amount("1", "XXX")


def test_format_and_wire():
    assert format_amount(123456, "USD") == "1,234.56"
    assert format_amount(-5, "USD") == "-0.05"
    assert to_wire(-123) == "-123" and from_wire("-123") == -123
    with pytest.raises(AmountError):
        from_wire("1.5")
    with pytest.raises(AmountError):
        to_wire(1.5)  # type: ignore[arg-type]
