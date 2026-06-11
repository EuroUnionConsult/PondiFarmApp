import subprocess
import textwrap
import unittest
from pathlib import Path


class MainImportSmokeTests(unittest.TestCase):
    def test_import_main_does_not_require_database_env(self):
        backend_dir = Path(__file__).resolve().parent.parent
        python_executable = backend_dir / ".venv" / "Scripts" / "python.exe"

        script = textwrap.dedent(
            """
            import os
            import pathlib

            for key in (
                "DATABASE_URL",
                "AZURE_SQL_SERVER",
                "AZURE_SQL_DATABASE",
                "AZURE_SQL_USERNAME",
                "AZURE_SQL_PASSWORD",
                "AZURE_SQL_DRIVER",
                "AZURE_SQL_ENCRYPT",
                "AZURE_SQL_TRUST_SERVER_CERTIFICATE",
            ):
                os.environ.pop(key, None)

            original_exists = pathlib.Path.exists

            def patched_exists(path):
                if path.name == ".env" and path.parent.name == "backend":
                    return False
                return original_exists(path)

            pathlib.Path.exists = patched_exists

            import main

            print("import-ok")
            """,
        )

        completed = subprocess.run(
            [str(python_executable), "-c", script],
            capture_output=True,
            text=True,
            cwd=backend_dir,
            check=False,
        )

        if completed.returncode != 0:
            self.fail(
                "Import smoke test failed.\n"
                f"STDOUT:\n{completed.stdout}\n"
                f"STDERR:\n{completed.stderr}",
            )

        self.assertIn("import-ok", completed.stdout)


if __name__ == "__main__":
    unittest.main()
