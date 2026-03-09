from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_baseline_quick_workflow.sh"
)


def test_baseline_quick_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_baseline_quick_workflow_orders_commands():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    lint_index = content.index("npm run lint")
    typecheck_index = content.index("npm run typecheck")
    build_index = content.index("npm run build")
    test_index = content.index("npm run test")
    smoke_sales_index = content.index("npm run verify:smoke:sales")
    assert lint_index < typecheck_index < build_index < test_index < smoke_sales_index
