import os
import time
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, date
from app.config import settings

logger = logging.getLogger("Database")

class Database:
    def __init__(self, database_url: Optional[str] = None):
        self.database_url = database_url or settings.DATABASE_URL
        self.is_postgres = (
            self.database_url.startswith("postgresql://") or 
            self.database_url.startswith("postgres://") or
            self.database_url.startswith("postgresql+psycopg2://")
        )
        if self.is_postgres:
            try:
                import psycopg2
            except ImportError:
                logger.warning("PostgreSQL driver 'psycopg2' not installed. Falling back to local SQLite.")
                self.is_postgres = False
                self.database_url = "sqlite:///./data/trading.db"
        self.init_db()

    def get_connection(self):
        """Returns active connection for PostgreSQL or fallback SQLite"""
        if self.is_postgres:
            try:
                import psycopg2
                from psycopg2.extras import RealDictCursor
                conn = psycopg2.connect(self.database_url, cursor_factory=RealDictCursor)
                return conn
            except Exception as e:
                logger.warning(f"PostgreSQL connection failed ({e}). Falling back to local SQLite.")
                self.is_postgres = False
                self.database_url = "sqlite:///./data/trading.db"
                return self.get_connection()
        else:
            import sqlite3
            raw_path = self.database_url.replace("sqlite:///", "")
            if raw_path.startswith("./") or raw_path.startswith(".\\"):
                base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
                db_path = os.path.abspath(os.path.join(base_dir, raw_path[2:]))
            else:
                db_path = os.path.abspath(raw_path)
            os.makedirs(os.path.dirname(db_path), exist_ok=True)
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            return conn

    def init_db(self):
        """Initializes tables for EOD Predictions and Scan Runs in PostgreSQL or SQLite"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()

                if self.is_postgres:
                    cursor.execute("""
                    CREATE TABLE IF NOT EXISTS eod_predictions (
                        id SERIAL PRIMARY KEY,
                        scan_id VARCHAR(64) NOT NULL,
                        scan_date VARCHAR(16) NOT NULL,
                        symbol VARCHAR(32) NOT NULL,
                        name VARCHAR(128) NOT NULL,
                        category VARCHAR(32) NOT NULL,
                        current_price DOUBLE PRECISION NOT NULL,
                        action VARCHAR(16) NOT NULL,
                        confidence DOUBLE PRECISION NOT NULL,
                        target_price DOUBLE PRECISION NOT NULL,
                        stop_loss DOUBLE PRECISION NOT NULL,
                        recommended_shares DOUBLE PRECISION NOT NULL,
                        allocated_amount DOUBLE PRECISION NOT NULL,
                        time_horizon VARCHAR(64) NOT NULL,
                        thesis_reason TEXT NOT NULL,
                        entry_timing VARCHAR(128),
                        time_based_exit VARCHAR(256),
                        target_price_tp2 DOUBLE PRECISION,
                        macro_trend VARCHAR(128),
                        prediction_barriers TEXT,
                        technical_summary TEXT,
                        model_used VARCHAR(64),
                        status VARCHAR(16) DEFAULT 'ACTIVE',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    """)
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_eod_symbol ON eod_predictions(symbol);")
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_eod_date ON eod_predictions(scan_date);")

                    cursor.execute("""
                    CREATE TABLE IF NOT EXISTS eod_scan_runs (
                        scan_id VARCHAR(64) PRIMARY KEY,
                        scan_date VARCHAR(16) NOT NULL,
                        total_scanned INTEGER NOT NULL,
                        top_picks_count INTEGER NOT NULL,
                        status VARCHAR(32) NOT NULL,
                        duration_seconds DOUBLE PRECISION DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    """)

                    cursor.execute("""
                    CREATE TABLE IF NOT EXISTS executed_trades (
                        id SERIAL PRIMARY KEY,
                        order_id VARCHAR(64) UNIQUE NOT NULL,
                        symbol VARCHAR(32) NOT NULL,
                        name VARCHAR(128),
                        currency VARCHAR(16) NOT NULL,
                        side VARCHAR(16) NOT NULL,
                        shares DOUBLE PRECISION NOT NULL,
                        entry_price DOUBLE PRECISION NOT NULL,
                        close_price DOUBLE PRECISION,
                        stop_loss DOUBLE PRECISION NOT NULL,
                        take_profit DOUBLE PRECISION NOT NULL,
                        realized_pnl DOUBLE PRECISION DEFAULT 0.0,
                        realized_pnl_usd DOUBLE PRECISION,
                        pnl_pct DOUBLE PRECISION DEFAULT 0.0,
                        outcome VARCHAR(16) DEFAULT 'OPEN',
                        exit_reason VARCHAR(32) DEFAULT 'OPEN',
                        status VARCHAR(16) DEFAULT 'OPEN',
                        opened_at VARCHAR(32) NOT NULL,
                        closed_at VARCHAR(32),
                        indicators_snapshot TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    """)
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_trades_symbol ON executed_trades(symbol);")
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_trades_status ON executed_trades(status);")
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_trades_order_id ON executed_trades(order_id);")
                else:
                    cursor.execute("""
                    CREATE TABLE IF NOT EXISTS eod_predictions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        scan_id TEXT NOT NULL,
                        scan_date TEXT NOT NULL,
                        symbol TEXT NOT NULL,
                        name TEXT NOT NULL,
                        category TEXT NOT NULL,
                        current_price REAL NOT NULL,
                        action TEXT NOT NULL,
                        confidence REAL NOT NULL,
                        target_price REAL NOT NULL,
                        stop_loss REAL NOT NULL,
                        recommended_shares REAL NOT NULL,
                        allocated_amount REAL NOT NULL,
                        time_horizon TEXT NOT NULL,
                        thesis_reason TEXT NOT NULL,
                        entry_timing TEXT,
                        time_based_exit TEXT,
                        target_price_tp2 REAL,
                        macro_trend TEXT,
                        prediction_barriers TEXT,
                        technical_summary TEXT,
                        model_used TEXT,
                        status TEXT DEFAULT 'ACTIVE',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    """)
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_eod_symbol ON eod_predictions(symbol);")
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_eod_date ON eod_predictions(scan_date);")

                    cursor.execute("""
                    CREATE TABLE IF NOT EXISTS eod_scan_runs (
                        scan_id TEXT PRIMARY KEY,
                        scan_date TEXT NOT NULL,
                        total_scanned INTEGER NOT NULL,
                        top_picks_count INTEGER NOT NULL,
                        status TEXT NOT NULL,
                        duration_seconds REAL DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    """)

                    cursor.execute("""
                    CREATE TABLE IF NOT EXISTS executed_trades (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        order_id TEXT UNIQUE NOT NULL,
                        symbol TEXT NOT NULL,
                        name TEXT,
                        currency TEXT NOT NULL,
                        side TEXT NOT NULL,
                        shares REAL NOT NULL,
                        entry_price REAL NOT NULL,
                        close_price REAL,
                        stop_loss REAL NOT NULL,
                        take_profit REAL NOT NULL,
                        realized_pnl REAL DEFAULT 0.0,
                        realized_pnl_usd REAL,
                        pnl_pct REAL DEFAULT 0.0,
                        outcome TEXT DEFAULT 'OPEN',
                        exit_reason TEXT DEFAULT 'OPEN',
                        status TEXT DEFAULT 'OPEN',
                        opened_at TEXT NOT NULL,
                        closed_at TEXT,
                        indicators_snapshot TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    """)
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_trades_symbol ON executed_trades(symbol);")
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_trades_status ON executed_trades(status);")
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_trades_order_id ON executed_trades(order_id);")

                # Auto-migrate columns for existing databases
                if self.is_postgres:
                    columns_to_add = [
                        ("eod_predictions", "entry_timing", "VARCHAR(128)"),
                        ("eod_predictions", "time_based_exit", "VARCHAR(256)"),
                        ("eod_predictions", "target_price_tp2", "DOUBLE PRECISION"),
                        ("eod_predictions", "macro_trend", "VARCHAR(128)"),
                        ("eod_predictions", "prediction_barriers", "TEXT"),
                        ("executed_trades", "realized_pnl_usd", "DOUBLE PRECISION"),
                    ]
                    for table, col, col_type in columns_to_add:
                        try:
                            cursor.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_type};")
                        except Exception:
                            pass
                else:
                    cursor.execute("PRAGMA table_info(eod_predictions);")
                    existing_eod_cols = {row[1] for row in cursor.fetchall()}
                    eod_missing = [
                        ("entry_timing", "TEXT"),
                        ("time_based_exit", "TEXT"),
                        ("target_price_tp2", "REAL"),
                        ("macro_trend", "TEXT"),
                        ("prediction_barriers", "TEXT"),
                    ]
                    for col, col_type in eod_missing:
                        if col not in existing_eod_cols:
                            try:
                                cursor.execute(f"ALTER TABLE eod_predictions ADD COLUMN {col} {col_type};")
                            except Exception as ex:
                                logger.debug(f"Failed to add column {col} to eod_predictions: {ex}")

                    cursor.execute("PRAGMA table_info(executed_trades);")
                    existing_trades_cols = {row[1] for row in cursor.fetchall()}
                    if "realized_pnl_usd" not in existing_trades_cols:
                        try:
                            cursor.execute("ALTER TABLE executed_trades ADD COLUMN realized_pnl_usd REAL;")
                        except Exception as ex:
                            logger.debug(f"Failed to add realized_pnl_usd: {ex}")

                conn.commit()
                backend_type = "PostgreSQL" if self.is_postgres else "SQLite"
                logger.info(f"Database initialized and schema verified successfully with {backend_type}.")
        except Exception as e:
            logger.error(f"Database initialization failed: {e}")
            raise e

    def save_prediction(self, pred: Dict[str, Any]):
        """Inserts or updates an active prediction for a symbol"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            param_char = "%s" if self.is_postgres else "?"

            # Retire older active predictions for this symbol
            cursor.execute(
                f"UPDATE eod_predictions SET status = 'SUPERSEDED' WHERE symbol = {param_char} AND status = 'ACTIVE'", 
                (pred["symbol"],)
            )

            import json
            barriers_val = pred.get("prediction_barriers")
            barriers_json = json.dumps(barriers_val) if isinstance(barriers_val, dict) else (barriers_val or "{}")

            insert_query = f"""
            INSERT INTO eod_predictions (
                scan_id, scan_date, symbol, name, category, current_price, action,
                confidence, target_price, stop_loss, recommended_shares, allocated_amount,
                time_horizon, thesis_reason, technical_summary, model_used, status,
                entry_timing, time_based_exit, target_price_tp2, macro_trend, prediction_barriers
            ) VALUES ({', '.join([param_char] * 22)})
            """
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
            ))
            conn.commit()

    @staticmethod
    def _serialize_row(row) -> Optional[Dict[str, Any]]:
        if not row:
            return None
        res = dict(row)
        for k, v in res.items():
            if isinstance(v, (datetime, date)):
                res[k] = v.isoformat()
        return res

    def get_active_predictions(self, category: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetches active high-conviction predictions sorted by confidence descending"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            param_char = "%s" if self.is_postgres else "?"
            if category:
                query = f"""
                SELECT * FROM eod_predictions 
                WHERE status = 'ACTIVE' AND category = {param_char}
                ORDER BY confidence DESC, created_at DESC 
                LIMIT {param_char}
                """
                cursor.execute(query, (category, limit))
            else:
                query = f"""
                SELECT * FROM eod_predictions 
                WHERE status = 'ACTIVE'
                ORDER BY confidence DESC, created_at DESC 
                LIMIT {param_char}
                """
                cursor.execute(query, (limit,))
            rows = cursor.fetchall()
            return [self._serialize_row(r) for r in rows if r]

    def get_prediction_by_symbol(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Retrieves active prediction for a specific ticker symbol"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            param_char = "%s" if self.is_postgres else "?"
            query = f"""
            SELECT * FROM eod_predictions 
            WHERE symbol = {param_char} AND status = 'ACTIVE'
            ORDER BY created_at DESC LIMIT 1
            """
            cursor.execute(query, (symbol,))
            row = cursor.fetchone()
            return self._serialize_row(row)

    def record_scan_run(self, scan_id: str, scan_date: str, total_scanned: int, top_picks_count: int, status: str, duration_sec: float):
        """Records EOD batch run metadata"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            param_char = "%s" if self.is_postgres else "?"
            if self.is_postgres:
                query = f"""
                INSERT INTO eod_scan_runs (scan_id, scan_date, total_scanned, top_picks_count, status, duration_seconds)
                VALUES ({param_char}, {param_char}, {param_char}, {param_char}, {param_char}, {param_char})
                ON CONFLICT (scan_id) DO UPDATE SET 
                status = EXCLUDED.status, 
                duration_seconds = EXCLUDED.duration_seconds;
                """
            else:
                query = f"""
                INSERT OR REPLACE INTO eod_scan_runs (scan_id, scan_date, total_scanned, top_picks_count, status, duration_seconds)
                VALUES ({param_char}, {param_char}, {param_char}, {param_char}, {param_char}, {param_char});
                """
            cursor.execute(query, (scan_id, scan_date, total_scanned, top_picks_count, status, duration_sec))
            conn.commit()

    def get_last_scan_run(self) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM eod_scan_runs ORDER BY created_at DESC LIMIT 1")
            row = cursor.fetchone()
            return self._serialize_row(row)

    def record_opened_trade(self, trade: Dict[str, Any]):
        """Records a newly opened trade in the database for tracking and model training"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            param_char = "%s" if self.is_postgres else "?"
            
            import json
            ind_json = json.dumps(trade.get("indicators_snapshot") or {})
            
            if self.is_postgres:
                query = f"""
                INSERT INTO executed_trades (
                    order_id, symbol, name, currency, side, shares, entry_price,
                    stop_loss, take_profit, realized_pnl, pnl_pct, outcome,
                    exit_reason, status, opened_at, indicators_snapshot
                ) VALUES ({', '.join([param_char] * 16)})
                ON CONFLICT (order_id) DO NOTHING;
                """
            else:
                query = f"""
                INSERT OR IGNORE INTO executed_trades (
                    order_id, symbol, name, currency, side, shares, entry_price,
                    stop_loss, take_profit, realized_pnl, pnl_pct, outcome,
                    exit_reason, status, opened_at, indicators_snapshot
                ) VALUES ({', '.join([param_char] * 16)});
                """

            cursor.execute(query, (
                trade["order_id"],
                trade["symbol"],
                trade.get("name", trade["symbol"]),
                trade.get("currency", "INR"),
                trade["side"].upper(),
                float(trade["shares"]),
                float(trade["entry_price"]),
                float(trade["stop_loss"]),
                float(trade["take_profit"]),
                0.0,
                0.0,
                "OPEN",
                "OPEN",
                "OPEN",
                trade.get("opened_at", datetime.now().strftime("%H:%M:%S")),
                ind_json
            ))
            conn.commit()

    def record_closed_trade(self, order_id: str, close_price: float, realized_pnl: float, pnl_pct: float, exit_reason: str, closed_at: str, realized_pnl_usd: Optional[float] = None):
        """Updates an executed trade with exit price, PnL (in INR), and outcome for training feedback"""
        outcome = "WIN" if realized_pnl > 0.0 else ("LOSS" if realized_pnl < 0.0 else "BREAKEVEN")
        with self.get_connection() as conn:
            cursor = conn.cursor()
            param_char = "%s" if self.is_postgres else "?"
            query = f"""
            UPDATE executed_trades 
            SET status = 'CLOSED',
                close_price = {param_char},
                realized_pnl = {param_char},
                pnl_pct = {param_char},
                outcome = {param_char},
                exit_reason = {param_char},
                closed_at = {param_char},
                realized_pnl_usd = {param_char}
            WHERE order_id = {param_char}
            """
            cursor.execute(query, (
                float(close_price),
                float(realized_pnl),
                float(pnl_pct),
                outcome,
                exit_reason,
                closed_at,
                float(realized_pnl_usd) if realized_pnl_usd is not None else None,
                order_id
            ))
            conn.commit()

    def get_open_trades(self) -> List[Dict[str, Any]]:
        """Retrieves all currently active open trades from the database"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM executed_trades WHERE status = 'OPEN' ORDER BY id ASC")
            rows = cursor.fetchall()
            return [self._serialize_row(r) for r in rows if r]

    def get_closed_trades(self, symbol: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieves historical closed trades from the database"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            param_char = "%s" if self.is_postgres else "?"
            if symbol:
                query = f"SELECT * FROM executed_trades WHERE status = 'CLOSED' AND symbol = {param_char} ORDER BY id DESC LIMIT {param_char}"
                cursor.execute(query, (symbol, limit))
            else:
                query = f"SELECT * FROM executed_trades WHERE status = 'CLOSED' ORDER BY id DESC LIMIT {param_char}"
                cursor.execute(query, (limit,))
            rows = cursor.fetchall()
            return [self._serialize_row(r) for r in rows if r]

    def get_all_executed_trades(self, symbol: Optional[str] = None, status: Optional[str] = None, limit: int = 500) -> List[Dict[str, Any]]:
        """Retrieves all executed trades (both open & closed) for the execution history view"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            param_char = "%s" if self.is_postgres else "?"
            conditions = []
            params = []

            if symbol:
                conditions.append(f"symbol = {param_char}")
                params.append(symbol)
            if status and status.upper() != "ALL":
                conditions.append(f"status = {param_char}")
                params.append(status.upper())

            where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
            query = f"SELECT * FROM executed_trades {where_clause} ORDER BY id DESC LIMIT {param_char}"
            params.append(limit)

            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()
            return [self._serialize_row(r) for r in rows if r]

    def get_trade_learning_stats(self, symbol: Optional[str] = None) -> Dict[str, Any]:
        """
        Synthesizes historical trade outcomes into quantitative reinforcement weights
        to dynamically train and improve JEV AI and EOD ensemble predictions.
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            param_char = "%s" if self.is_postgres else "?"
            
            if symbol:
                cursor.execute(f"SELECT * FROM executed_trades WHERE status = 'CLOSED' AND symbol = {param_char} ORDER BY id DESC", (symbol,))
            else:
                cursor.execute("SELECT * FROM executed_trades WHERE status = 'CLOSED' ORDER BY id DESC")
            
            rows = [self._serialize_row(r) for r in cursor.fetchall() if r]

            total_trades = len(rows)
            if total_trades == 0:
                return {
                    "total_trades": 0,
                    "wins": 0,
                    "losses": 0,
                    "win_rate": 50.0,
                    "total_pnl": 0.0,
                    "buy_total": 0,
                    "buy_win_rate": 50.0,
                    "sell_total": 0,
                    "sell_win_rate": 50.0,
                    "learned_bias": "NEUTRAL",
                    "direction_bias": "NEUTRAL",
                    "confidence_bonus": 0.0,
                    "training_sample_count": 0,
                    "has_learning_data": False
                }

            wins = sum(1 for r in rows if r.get("outcome") == "WIN")
            losses = sum(1 for r in rows if r.get("outcome") == "LOSS")
            win_rate = round((wins / total_trades) * 100, 1)
            total_pnl = round(sum(float(r.get("realized_pnl") or 0.0) for r in rows), 2)

            buy_trades = [r for r in rows if r.get("side") == "BUY"]
            buy_wins = sum(1 for r in buy_trades if r.get("outcome") == "WIN")
            buy_win_rate = round((buy_wins / len(buy_trades)) * 100, 1) if buy_trades else 50.0

            sell_trades = [r for r in rows if r.get("side") == "SELL"]
            sell_wins = sum(1 for r in sell_trades if r.get("outcome") == "WIN")
            sell_win_rate = round((sell_wins / len(sell_trades)) * 100, 1) if sell_trades else 50.0

            # Calculate adaptive machine learning confidence bonus / penalty
            # High win-rate setups get up to +12% confidence reinforcement
            # Poor win-rate setups get penalty and trigger caution/divergence
            if win_rate >= 70.0:
                conf_bonus = round(min(0.12, (win_rate - 50.0) * 0.004), 2)
                learned_bias = "HIGH_CONFIDENCE_REINFORCED"
            elif win_rate <= 35.0 and total_trades >= 3:
                conf_bonus = -0.10
                learned_bias = "HIGH_RISK_CAUTION_PENALIZED"
            else:
                conf_bonus = round((win_rate - 50.0) * 0.002, 2)
                learned_bias = "BALANCED_EQUILIBRIUM"

            # Directional training bias
            if buy_win_rate >= 65.0 and sell_win_rate < 45.0:
                direction_bias = "BULLISH_BIAS_TRAINED"
            elif sell_win_rate >= 65.0 and buy_win_rate < 45.0:
                direction_bias = "BEARISH_BIAS_TRAINED"
            else:
                direction_bias = "NEUTRAL"

            # Last 5 trades outcome sequence
            recent_outcomes = [r.get("outcome") for r in rows[:5]]

            # Generate actionable learning insight
            if win_rate >= 70.0:
                insights = f"AI trained on {total_trades} trades with {win_rate}% win rate (+{int(conf_bonus*100)}% confidence boost applied)."
            elif win_rate <= 40.0 and total_trades >= 3:
                insights = f"AI caution active: {total_trades} past trades showed {win_rate}% win rate ({int(conf_bonus*100)}% defensive penalty)."
            else:
                insights = f"AI model tracking {total_trades} trades with {win_rate}% win rate in database."

            return {
                "total_trades": total_trades,
                "wins": wins,
                "losses": losses,
                "win_rate": win_rate,
                "total_pnl": total_pnl,
                "buy_total": len(buy_trades),
                "buy_win_rate": buy_win_rate,
                "sell_total": len(sell_trades),
                "sell_win_rate": sell_win_rate,
                "learned_bias": learned_bias,
                "direction_bias": direction_bias,
                "confidence_bonus": conf_bonus,
                "recent_outcomes": recent_outcomes,
                "training_sample_count": total_trades,
                "has_learning_data": True,
                "insights": insights
            }

db = Database()
