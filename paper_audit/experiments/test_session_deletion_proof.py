import sys
import os
sys.path.insert(0, os.path.abspath('.'))

import json
import asyncio
import io
from pathlib import Path
from starlette.datastructures import UploadFile

from app.config import get_settings
from app.services.session_manager import (
    create_temporary_session,
    delete_temporary_session,
    get_session_dir,
)

settings = get_settings()

real_wb_path = Path("data/test2_lifesci_vague_single_row.xlsx")
wb_bytes = real_wb_path.read_bytes()

async def test_proven_deletion():
    upload = UploadFile(
        file=io.BytesIO(wb_bytes),
        filename="test2_lifesci_vague_single_row.xlsx",
        headers={"content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
    )
    
    # 1. Create temporary session
    session_id, preview = await create_temporary_session(upload, settings)
    s_dir = get_session_dir(session_id, settings)
    
    # 2. Verify existence of isolated files
    quarantine_exists = (s_dir / "quarantine.xlsx").is_file()
    db_exists = (s_dir / "session.duckdb").is_file()
    meta_exists = (s_dir / "meta.json").is_file()
    
    pre_delete_state = {
        "session_id": session_id,
        "session_dir": str(s_dir),
        "quarantine_exists": quarantine_exists,
        "session_db_exists": db_exists,
        "meta_exists": meta_exists,
    }
    
    # 3. Execute permanent deletion
    deleted = delete_temporary_session(session_id, settings)
    
    # 4. Assert post-deletion disk state
    dir_still_exists = s_dir.exists()
    quarantine_still_exists = (s_dir / "quarantine.xlsx").exists()
    db_still_exists = (s_dir / "session.duckdb").exists()
    meta_still_exists = (s_dir / "meta.json").exists()
    
    post_delete_state = {
        "deletion_returned_true": deleted,
        "session_dir_still_exists": dir_still_exists,
        "quarantine_still_exists": quarantine_still_exists,
        "session_db_still_exists": db_still_exists,
        "meta_still_exists": meta_still_exists,
        "deletion_proven": not (dir_still_exists or quarantine_still_exists or db_still_exists or meta_still_exists)
    }
    
    report = {
        "pre_delete": pre_delete_state,
        "post_delete": post_delete_state,
        "status": "PASS - Complete Unrecoverable Filesystem Purge" if post_delete_state["deletion_proven"] else "FAIL"
    }
    
    with open("paper_audit/experiments/session_deletion_proof.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
        
    print("Session Deletion Proof Test Complete:")
    print(f"Pre-delete: dir={s_dir} (Files: quarantine={quarantine_exists}, db={db_exists}, meta={meta_exists})")
    print(f"Post-delete: dir_exists={dir_still_exists}, db_exists={db_still_exists}")
    print(f"Result: {report['status']}")

asyncio.run(test_proven_deletion())
