from app.modules.products.import_service import ImportFileError, parse_product_file


def test_bangla_csv_headers_are_normalized() -> None:
    content = (
        "পণ্যের নাম,ক্যাটাগরি,ইউনিট,ক্রয় মূল্য,বিক্রয় মূল্য,sku,ওপেনিং স্টক\nমিনিকেট চাল,চাল,kg,70,80,RICE-1,10\n"
    ).encode()
    rows = parse_product_file("products.csv", content)
    assert len(rows) == 1
    assert rows[0]["product_name"] == "মিনিকেট চাল"
    assert rows[0]["sku"] == "RICE-1"
    assert rows[0]["errors"] == []


def test_import_rejects_missing_required_columns() -> None:
    try:
        parse_product_file("products.csv", b"product_name,sku\nTest,SKU-1\n")
    except ImportFileError as exc:
        assert "Missing required columns" in str(exc)
    else:
        raise AssertionError("Missing columns must be rejected")
