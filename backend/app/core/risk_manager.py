import uuid
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from app.models.schemas import Position, StrategySettings, AccountSummary, TickerSnapshot
from app.config import SUPPORTED_ASSETS, settings

logger = logging.getLogger("RiskManager")

class RiskAndExecutionManager:
    def __init__(self):
        self.balance_inr = settings.DEFAULT_BALANCE_INR
        self.balance_usd = settings.DEFAULT_BALANCE_USD
        self.initial_balance_inr = settings.DEFAULT_BALANCE_INR
        self.initial_balance_usd = settings.DEFAULT_BALANCE_USD
        self.open_positions: Dict[str, Position] = {}
        self.closed_positions: List[Position] = []
        self.daily_pnl_inr = 0.0
        self.daily_pnl_usd = 0.0
        self.strategy_settings = StrategySettings()

        # Restore persistent trade records from database
        self._load_positions_from_db()

    def _get_usd_to_inr_rate(self) -> float:
        try:
            from app.core.data_feed import data_feed
            rate = data_feed.latest_prices.get("USDINR=X")
            if rate and float(rate) > 0:
                return float(rate)
        except Exception:
            pass
        return 96.07

    def _load_positions_from_db(self):
        try:
            from app.core.database import db
            # Restore open trades from DB
            db_open = db.get_open_trades()
            for row in db_open:
                p = Position(
                    id=row["order_id"],
                    symbol=row["symbol"],
                    currency=row["currency"],
                    side=row["side"],
                    shares=float(row["shares"]),
                    entry_price=float(row["entry_price"]),
                    current_price=float(row.get("close_price") or row["entry_price"]),
                    stop_loss=float(row["stop_loss"]),
                    take_profit=float(row["take_profit"]),
                    unrealized_pnl=float(row.get("realized_pnl") or 0.0),
                    pnl_pct=float(row.get("pnl_pct") or 0.0),
                    status="OPEN",
                    opened_at=row.get("opened_at", "")
                )
                self.open_positions[p.id] = p

            # Restore recent closed trades
            db_closed = db.get_closed_trades(limit=30)
            for row in reversed(db_closed):
                p = Position(
                    id=row["order_id"],
                    symbol=row["symbol"],
                    currency=row["currency"],
                    side=row["side"],
                    shares=float(row["shares"]),
                    entry_price=float(row["entry_price"]),
                    current_price=float(row.get("close_price") or row["entry_price"]),
                    close_price=float(row.get("close_price") or row["entry_price"]),
                    stop_loss=float(row["stop_loss"]),
                    take_profit=float(row["take_profit"]),
                    unrealized_pnl=0.0,
                    pnl_pct=float(row.get("pnl_pct") or 0.0),
                    realized_pnl=float(row.get("realized_pnl") or 0.0),
                    status="CLOSED",
                    opened_at=row.get("opened_at", ""),
                    closed_at=row.get("closed_at", "")
                )
                self.closed_positions.append(p)
                # Historical trades are stored for history/stats; daily_pnl is preserved for today's active session
            if db_open or db_closed:
                logger.info(f"Restored {len(db_open)} open and {len(db_closed)} closed trades from database.")
        except Exception as e:
            logger.warning(f"Could not restore trades from database: {e}")

    def get_account_summary(self, currency: str = "INR") -> AccountSummary:
        usd_rate = self._get_usd_to_inr_rate()
        
        # Calculate open positions unrealized PnL and margin in INR
        open_pnl_inr = 0.0
        margin_used_inr = 0.0
        for p in self.open_positions.values():
            conv = 1.0 if p.currency == "INR" else usd_rate
            open_pnl_inr += (p.unrealized_pnl * conv)
            margin_used_inr += (p.shares * p.entry_price * 0.1 * conv)

        current_balance_inr = self.initial_balance_inr + self.daily_pnl_inr
        equity_inr = current_balance_inr + open_pnl_inr
        total_daily_pnl_inr = self.daily_pnl_inr + open_pnl_inr

        # Historical win rate encompasses ALL executed trades
        total_closed = len(self.closed_positions)
        win_count = sum(1 for p in self.closed_positions if (p.realized_pnl or 0) > 0)
        win_rate = (win_count / total_closed * 100) if total_closed > 0 else 0.0

        if currency == "USD":
            return AccountSummary(
                currency="USD",
                balance=round(current_balance_inr / usd_rate, 2),
                equity=round(equity_inr / usd_rate, 2),
                margin_used=round(margin_used_inr / usd_rate, 2),
                free_margin=round((equity_inr - margin_used_inr) / usd_rate, 2),
                daily_pnl=round(total_daily_pnl_inr / usd_rate, 2),
                win_rate=round(win_rate, 1),
                total_trades=total_closed + len(self.open_positions)
            )

        return AccountSummary(
            currency="INR",
            balance=round(current_balance_inr, 2),
            equity=round(equity_inr, 2),
            margin_used=round(margin_used_inr, 2),
            free_margin=round(equity_inr - margin_used_inr, 2),
            daily_pnl=round(total_daily_pnl_inr, 2),
            win_rate=round(win_rate, 1),
            total_trades=total_closed + len(self.open_positions)
        )

    def calculate_order_parameters(
        self, 
        snapshot: TickerSnapshot, 
        side: str, 
        sl_type: str = "ATR", 
        risk_pct: float = 1.0, 
        tp_ratio: float = 2.0,
        active_strategy: str = "TREND_TRADING"
    ) -> Tuple[float, float, float]:
        """Calculates (quantity, stop_loss, take_profit) tailored to the active strategy (Trend, Range, Breakout, Scalping)"""
        curr_price = snapshot.last_price
        indicators = snapshot.indicators
        atr = indicators.atr if indicators and indicators.atr else (curr_price * 0.005)
        
        is_fx = "=X" in snapshot.symbol or (curr_price < 50 and not snapshot.symbol.endswith(".NS"))
        is_crypto = "-USD" in snapshot.symbol
        decimals = 4 if is_fx else 2
        if is_fx and "JPY" in snapshot.symbol:
            decimals = 3

        strat = (active_strategy or "TREND_TRADING").upper()
        if "SCALP" in strat:
            # Scalping: Ultra-tight SL & TP for rapid micro-execution
            if is_fx:
                sl_distance = round(max(0.0008, min(0.0018, atr * 0.5)), decimals)
            elif is_crypto:
                sl_distance = round(curr_price * 0.008, decimals)
            else:
                sl_distance = round(max(curr_price * 0.006, min(curr_price * 0.015, atr * 0.6)), decimals)
            effective_tp_ratio = tp_ratio if tp_ratio else 1.5
        elif "RANGE" in strat:
            # Range Trading: Boundary-targeted SL
            if is_fx:
                sl_distance = round(max(0.0015, min(0.0030, atr * 0.8)), decimals)
            elif is_crypto:
                sl_distance = round(curr_price * 0.018, decimals)
            else:
                sl_distance = round(max(curr_price * 0.025, min(curr_price * 0.038, atr * 1.0)), decimals)
            effective_tp_ratio = tp_ratio if tp_ratio else 1.5
        elif "BREAKOUT" in strat:
            # Breakout Trading: Buffer below breakout line, high R:R
            if is_fx:
                sl_distance = round(max(0.0020, min(0.0040, atr * 1.0)), decimals)
            elif is_crypto:
                sl_distance = round(curr_price * 0.025, decimals)
            else:
                sl_distance = round(max(curr_price * 0.030, min(curr_price * 0.045, atr * 1.3)), decimals)
            effective_tp_ratio = tp_ratio if tp_ratio else 3.0
        else:
            # Trend Trading (Default): Riding dominant trend with swing ATR SL
            if is_fx:
                sl_distance = round(max(0.0020, min(0.0045, atr * 1.0)), decimals)
            elif is_crypto:
                sl_distance = round(max(curr_price * 0.02, min(curr_price * 0.035, atr * 1.2)), decimals)
            else:
                # Indian Stocks (NSE): Realistic Stop Loss (e.g. ~5.5-6% like 30 pts on 510 stock)
                sl_distance = round(max(curr_price * 0.045, min(curr_price * 0.065, (atr * 2.0) if atr else (curr_price * 0.055))), decimals)
            effective_tp_ratio = tp_ratio if (tp_ratio is not None and tp_ratio >= 1.0) else 2.0

        clean_side = "BUY" if "BUY" in side.upper() else "SELL"
        if clean_side == "BUY":
            stop_loss = round(curr_price - sl_distance, decimals)
            take_profit = round(curr_price + (sl_distance * effective_tp_ratio), decimals)
        else:
            stop_loss = round(curr_price + sl_distance, decimals)
            take_profit = round(max(curr_price * 0.001, curr_price - (sl_distance * effective_tp_ratio)), decimals)

        # Capital Risk calculation
        curr_balance = self.balance_inr if snapshot.currency == "INR" else self.balance_usd
        risk_amount = curr_balance * (risk_pct / 100.0)

        # Quantity sizing
        loss_per_share = abs(curr_price - stop_loss)
        if loss_per_share > 0:
            raw_qty = risk_amount / loss_per_share
            if snapshot.currency == "INR" and not snapshot.symbol.endswith("=X"):
                # Indian stocks: discrete integer shares
                shares = max(1.0, float(int(raw_qty)))
            else:
                # Forex: fractional lots or micro-units
                shares = round(max(0.01, raw_qty), 2)
        else:
            shares = 1.0

        return shares, stop_loss, take_profit

    def open_trade(
        self, 
        symbol: str, 
        side: str, 
        snapshot: TickerSnapshot, 
        sl: Optional[float] = None, 
        tp: Optional[float] = None, 
        shares: Optional[float] = None
    ) -> Position:
        # Check circuit breaker advisory (non-blocking for trade executions)
        limit_pct = settings.DAILY_DRAWDOWN_LIMIT_PCT
        init_bal = self.initial_balance_inr if snapshot.currency == "INR" else self.initial_balance_usd
        daily_loss = -(self.daily_pnl_inr if snapshot.currency == "INR" else self.daily_pnl_usd)
        if daily_loss >= (init_bal * limit_pct / 100.0):
            logger.warning(f"Daily drawdown advisory: {limit_pct}% threshold reached. Orders proceed with caution.")

        entry_price = float(snapshot.last_price)
        clean_side = "BUY" if "BUY" in side.upper() else "SELL"

        calc_shares, calc_sl, calc_tp = self.calculate_order_parameters(
            snapshot, 
            clean_side, 
            sl_type=self.strategy_settings.sl_type, 
            risk_pct=self.strategy_settings.risk_per_trade_pct, 
            tp_ratio=self.strategy_settings.tp_multiplier,
            active_strategy=self.strategy_settings.active_strategy
        )

        final_shares = shares if shares is not None and shares > 0 else calc_shares

        # Rigorous validation for Stop-Loss and Take-Profit
        # For BUY: SL must be strictly below entry_price, TP must be strictly above entry_price
        # For SELL: SL must be strictly above entry_price, TP must be strictly below entry_price
        final_sl = sl
        final_tp = tp

        if clean_side == "BUY":
            if final_sl is None or final_sl <= 0 or final_sl >= entry_price:
                final_sl = calc_sl
            if final_tp is None or final_tp <= 0 or final_tp <= entry_price:
                final_tp = calc_tp
        else:  # SELL
            if final_sl is None or final_sl <= 0 or final_sl <= entry_price:
                final_sl = calc_sl
            if final_tp is None or final_tp <= 0 or final_tp >= entry_price:
                final_tp = calc_tp

        order_id = f"TRD-{uuid.uuid4().hex[:6].upper()}"
        pos = Position(
            id=order_id,
            symbol=symbol,
            currency=snapshot.currency,
            side=clean_side,
            shares=final_shares,
            entry_price=entry_price,
            current_price=entry_price,
            stop_loss=final_sl,
            take_profit=final_tp,
            unrealized_pnl=0.0,
            pnl_pct=0.0,
            status="OPEN",
            opened_at=datetime.now().strftime("%H:%M:%S")
        )
        self.open_positions[order_id] = pos

        # Persist opened trade to database for tracking and model reinforcement training
        try:
            from app.core.database import db
            ind_snap = snapshot.indicators.dict() if snapshot.indicators else {}
            db.record_opened_trade({
                "order_id": order_id,
                "symbol": symbol,
                "name": getattr(snapshot, "name", symbol),
                "currency": snapshot.currency,
                "side": clean_side,
                "shares": final_shares,
                "entry_price": entry_price,
                "stop_loss": final_sl,
                "take_profit": final_tp,
                "opened_at": pos.opened_at,
                "indicators_snapshot": ind_snap
            })
        except Exception as e:
            logger.error(f"Failed to record opened trade to database: {e}")

        return pos

    def update_positions_on_tick(self, symbol: str, current_price: float) -> List[Position]:
        """Evaluates open positions for Stop-Loss and Take-Profit breaches"""
        closed_this_tick = []
        for pos_id, pos in list(self.open_positions.items()):
            if pos.symbol != symbol:
                continue

            pos.current_price = current_price
            if pos.side == "BUY":
                pos.unrealized_pnl = round((current_price - pos.entry_price) * pos.shares, 2)
                pos.pnl_pct = round(((current_price - pos.entry_price) / pos.entry_price) * 100, 2)
                # Check TP hit (ensure TP is valid above entry)
                if pos.take_profit > pos.entry_price and current_price >= pos.take_profit:
                    self._close_position(pos_id, current_price, "TAKE_PROFIT")
                    closed_this_tick.append(pos)
                # Check SL hit (ensure SL is valid below entry)
                elif pos.stop_loss < pos.entry_price and current_price <= pos.stop_loss:
                    self._close_position(pos_id, current_price, "STOP_LOSS")
                    closed_this_tick.append(pos)
            else:  # SELL
                pos.unrealized_pnl = round((pos.entry_price - current_price) * pos.shares, 2)
                pos.pnl_pct = round(((pos.entry_price - current_price) / pos.entry_price) * 100, 2)
                # Check TP hit (ensure TP is valid below entry)
                if pos.take_profit < pos.entry_price and current_price <= pos.take_profit:
                    self._close_position(pos_id, current_price, "TAKE_PROFIT")
                    closed_this_tick.append(pos)
                # Check SL hit (ensure SL is valid above entry)
                elif pos.stop_loss > pos.entry_price and current_price >= pos.stop_loss:
                    self._close_position(pos_id, current_price, "STOP_LOSS")
                    closed_this_tick.append(pos)

        return closed_this_tick

    def _close_position(self, pos_id: str, exit_price: float, reason: str = "MANUAL"):
        if pos_id not in self.open_positions:
            return None
        pos = self.open_positions.pop(pos_id)
        pos.status = "CLOSED"
        pos.closed_at = datetime.now().strftime("%H:%M:%S")
        pos.close_price = exit_price

        if pos.side == "BUY":
            raw_diff = (exit_price - pos.entry_price) * pos.shares
            pnl_pct = round(((exit_price - pos.entry_price) / pos.entry_price) * 100, 2) if pos.entry_price > 0 else 0.0
        else:
            raw_diff = (pos.entry_price - exit_price) * pos.shares
            pnl_pct = round(((pos.entry_price - exit_price) / pos.entry_price) * 100, 2) if pos.entry_price > 0 else 0.0

        usd_rate = self._get_usd_to_inr_rate()
        if pos.currency == "INR":
            realized_inr = raw_diff
            realized_usd = raw_diff / usd_rate
        else:
            realized_usd = raw_diff
            realized_inr = raw_diff * usd_rate

        # All calculations after exit are in Rupees (INR)
        pos.realized_pnl = round(realized_inr, 2)
        pos.pnl_pct = pnl_pct
        pos.unrealized_pnl = 0.0

        self.balance_inr += realized_inr
        self.daily_pnl_inr += realized_inr
        self.balance_usd += realized_usd
        self.daily_pnl_usd += realized_usd

        self.closed_positions.append(pos)

        # Update database with closed trade outcome, profit/loss in Rupees, and original USD
        try:
            from app.core.database import db
            db.record_closed_trade(
                order_id=pos_id,
                close_price=exit_price,
                realized_pnl=pos.realized_pnl,
                pnl_pct=pos.pnl_pct,
                exit_reason=reason,
                closed_at=pos.closed_at,
                realized_pnl_usd=round(realized_usd, 2)
            )
        except Exception as e:
            logger.error(f"Failed to record closed trade to database: {e}")

        return pos

    def close_position(self, pos_id: str, exit_price: Optional[float] = None, reason: str = "MANUAL"):
        if pos_id not in self.open_positions:
            return None
        price = exit_price if exit_price is not None else self.open_positions[pos_id].current_price
        return self._close_position(pos_id, price, reason)

    def close_all_positions(self, symbol: Optional[str] = None):
        for pos_id, pos in list(self.open_positions.items()):
            if symbol is None or pos.symbol == symbol:
                self._close_position(pos_id, pos.current_price, "MANUAL")

    def reset_account(self):
        """Resets account balance, daily PnL, and clears active open positions"""
        self.balance_inr = settings.DEFAULT_BALANCE_INR
        self.balance_usd = settings.DEFAULT_BALANCE_USD
        self.initial_balance_inr = settings.DEFAULT_BALANCE_INR
        self.initial_balance_usd = settings.DEFAULT_BALANCE_USD
        self.daily_pnl_inr = 0.0
        self.daily_pnl_usd = 0.0
        self.open_positions.clear()
        logger.info("Account balance and daily PnL reset to initial defaults.")
        return self.get_account_summary()

risk_manager = RiskAndExecutionManager()
