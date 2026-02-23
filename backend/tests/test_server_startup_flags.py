from server import _is_truthy


def test_is_truthy_true_values():
    for value in ("1", "true", "TRUE", " yes ", "On"):
        assert _is_truthy(value) is True


def test_is_truthy_false_values():
    for value in (None, "", "0", "false", "off", "no", "random"):
        assert _is_truthy(value) is False
