import os
import sys

base_dir = os.path.dirname(__file__)

# 1. Update schemas.py
schemas_path = os.path.join(base_dir, "app", "models", "schemas.py")
with open(schemas_path, "r", encoding="utf-8") as f:
    sc = f.read()

if "entry_timing: Optional[str] = None" not in sc:
    old_target = "    learning_bonus: Optional[float] = 0.0"
    new_target = """    learning_bonus: Optional[float] = 0.0
    entry_timing: Optional[str] = None
    time_based_exit: Optional[str] = None
    target_price_tp2: Optional[float] = None
    prediction_barriers: Optional[Dict[str, Any]] = None
    macro_trend: Optional[str] = None"""
    assert old_target in sc
    sc = sc.replace(old_target, new_target, 1)
    with open(schemas_path, "w", encoding="utf-8") as f:
        f.write(sc)
    print("schemas.py patched successfully.")
else:
    print("schemas.py already has entry_timing.")

# 2. Update database.py save_prediction & init_db
db_path = os.path.join(base_dir, "app", "core", "database.py")
with open(db_path, "r", encoding="utf-8") as f:
    dbc = f.read()

# Make sure table creation has new columns
if "entry_timing VARCHAR(128)," not in dbc:
    old_pg_table = "time_horizon VARCHAR(64) NOT NULL,\n                        thesis_reason TEXT NOT NULL,"
    new_pg_table = """time_horizon VARCHAR(64) NOT NULL,
                        thesis_reason TEXT NOT NULL,
                        entry_timing VARCHAR(128),
                        time_based_exit VARCHAR(256),
                        target_price_tp2 DOUBLE PRECISION,
                        macro_trend VARCHAR(128),
                        prediction_barriers TEXT,"""
    if old_pg_table in dbc:
        dbc = dbc.replace(old_pg_table, new_pg_table, 1)

    old_sq_table = "time_horizon TEXT NOT NULL,\n                        thesis_reason TEXT NOT NULL,"
    new_sq_table = """time_horizon TEXT NOT NULL,
                        thesis_reason TEXT NOT NULL,
                        entry_timing TEXT,
                        time_based_exit TEXT,
                        target_price_tp2 REAL,
                        macro_trend TEXT,
                        prediction_barriers TEXT,"""
    if old_sq_table in dbc:
        dbc = dbc.replace(old_sq_table, new_sq_table, 1)

# Update save_prediction
old_save_pred = """            insert_query = f\"\"\"
            INSERT INTO eod_predictions (
                scan_id, scan_date, symbol, name, category, current_price, action,
                confidence, target_price, stop_loss, recommended_shares, allocated_amount,
                time_horizon, thesis_reason, technical_summary, model_used, status
            ) VALUES ({', '.join([param_char] * 17)})
            \"\"\"
            cursor.execute(insert_query, (
                pred.get("scan_id", f"SCAN-{int(time.time())}"),
                pred.get("scan_date", datetime.now().strftime("%Y-%m-%d")),
                pred["symbol"],
                pred["name"],
                pred.get("category", "NSE_EQUITIES"),
                float(pred["current_price"]),
                pred["action"].upper(),
                float(pred["confidence"]),
                float(pred["target_price"]),
                float(pred["stop_loss"]),
                float(pred["recommended_shares"]),
                float(pred["allocated_amount"]),
                pred.get("time_horizon", "1-3 Days Swing"),
                pred["thesis_reason"],
                pred.get("technical_summary", ""),
                pred.get("model_used", "ollama-local"),
                "ACTIVE"
            ))"""

new_save_pred = """            import json
            barriers_val = pred.get("prediction_barriers")
            barriers_json = json.dumps(barriers_val) if isinstance(barriers_val, dict) else (barriers_val or "{}")

            insert_query = f\"\"\"
            INSERT INTO eod_predictions (
                scan_id, scan_date, symbol, name, category, current_price, action,
                confidence, target_price, stop_loss, recommended_shares, allocated_amount,
                time_horizon, thesis_reason, technical_summary, model_used, status,
                entry_timing, time_based_exit, target_price_tp2, macro_trend, prediction_barriers
            ) VALUES ({', '.join([param_char] * 22)})
            \"\"\"
            cursor.execute(insert_query, (
                pred.get("scan_id", f"SCAN-{int(time.time())}"),
                pred.get("scan_date", datetime.now().strftime("%Y-%m-%d")),
                pred["symbol"],
                pred["name"],
                pred.get("category", "NSE_EQUITIES"),
                float(pred["current_price"]),
                pred["action"].upper(),
                float(pred["confidence"]),
                float(pred["target_price"]),
                float(pred["stop_loss"]),
                float(pred["recommended_shares"]),
                float(pred["allocated_amount"]),
                pred.get("time_horizon", "1-3 Days Swing"),
                pred["thesis_reason"],
                pred.get("technical_summary", ""),
                pred.get("model_used", "ollama-local"),
                "ACTIVE",
                pred.get("entry_timing", "EXECUTE NOW (Market Entry)"),
                pred.get("time_based_exit", "EXIT BY: Session Close or 15m EMA breakdown"),
                float(pred["target_price_tp2"]) if pred.get("target_price_tp2") is not None else None,
                pred.get("macro_trend", "1M: Neutral"),
                barriers_json
            ))"""

if old_save_pred in dbc:
    dbc = dbc.replace(old_save_pred, new_save_pred, 1)
    with open(db_path, "w", encoding="utf-8") as f:
        f.write(dbc)
    print("database.py patched successfully.")
else:
    print("old_save_pred not found in database.py")
