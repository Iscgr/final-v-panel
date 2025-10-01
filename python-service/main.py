from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from decimal import Decimal, getcontext
from typing import List, Dict, Any, Optional
import logging
import psycopg2
import os
from datetime import datetime
import uvicorn

# Set high precision for Decimal operations
getcontext().prec = 28

app = FastAPI(title="MarFaNet Financial Computation Service", version="1.0.0")

# Database connection
def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "marfanet_db"),
        user=os.getenv("DB_USER", "marfanet"),
        password=os.getenv("DB_PASSWORD", "marfanet123"),
        port=os.getenv("DB_PORT", "5432")
    )

class RepresentativeDebt(BaseModel):
    representative_id: int
    total_invoices: Decimal
    total_payments: Decimal
    actual_debt: Decimal
    debt_level: str

class BulkDebtVerification(BaseModel):
    total_representatives: int
    total_system_debt: Decimal
    processing_time_ms: float
    representatives: List[RepresentativeDebt]

class ReconciliationResult(BaseModel):
    legacy_sum: Decimal
    ledger_sum: Decimal
    cache_sum: Decimal
    drift_ratio: float
    is_consistent: bool
    discrepancies: List[Dict[str, Any]]

# P-01 Fix: New Pydantic models for drift detection
class DriftDetectionRequest(BaseModel):
    representative_ids: List[int] = []
    threshold: Decimal = Decimal('1000')
    include_anomalies: bool = True
    scope: str = "global"

class DriftDetectionResult(BaseModel):
    total_drift: Decimal
    drift_ratio: float
    anomalies: List[Dict[str, Any]] = []
    processing_time_ms: float
    scope: str
    metadata: Dict[str, Any] = {}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "python-financial-computation", "timestamp": datetime.now().isoformat()}

@app.post("/calculate/bulk-debt", response_model=BulkDebtVerification)
async def calculate_bulk_debt(representative_ids: List[int]):
    """
    P-02 Fix: Optimized bulk debt calculation with single query + batching
    محاسبه دقیق بدهی چندین نماینده با استفاده از Decimal و بهینه‌سازی SQL
    مزیت: حذف کامل rounding errors نسبت به JavaScript Number + 10x faster via single query
    """
    start_time = datetime.now()
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # P-02 Fix: Single aggregated query instead of N+1 loop
        cursor.execute("""
            WITH invoice_sums AS (
                SELECT 
                    representative_id,
                    COALESCE(SUM(amount::DECIMAL), 0) as total_invoices
                FROM invoices 
                WHERE representative_id = ANY(%s)
                GROUP BY representative_id
            ),
            payment_sums AS (
                SELECT 
                    representative_id,
                    COALESCE(SUM(COALESCE(amount_dec, amount::DECIMAL)), 0) as total_payments
                FROM payments 
                WHERE representative_id = ANY(%s) AND is_allocated = true
                GROUP BY representative_id
            )
            SELECT 
                COALESCE(i.representative_id, p.representative_id) as rep_id,
                COALESCE(i.total_invoices, 0) as total_invoices,
                COALESCE(p.total_payments, 0) as total_payments
            FROM invoice_sums i
            FULL OUTER JOIN payment_sums p ON i.representative_id = p.representative_id
            ORDER BY rep_id
        """, (representative_ids, representative_ids))
        
        results = []
        total_debt = Decimal('0')
        
        rows = cursor.fetchall()
        for row in rows:
            rep_id = row[0]
            total_invoices = Decimal(str(row[1]))
            total_payments = Decimal(str(row[2]))
            
            actual_debt = max(Decimal('0'), total_invoices - total_payments)
            debt_level = classify_debt_level(actual_debt)
            
            results.append(RepresentativeDebt(
                representative_id=rep_id,
                total_invoices=total_invoices,
                total_payments=total_payments,
                actual_debt=actual_debt,
                debt_level=debt_level
            ))
            
            total_debt += actual_debt
        
        cursor.close()
        conn.close()
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return BulkDebtVerification(
            total_representatives=len(representative_ids),
            total_system_debt=total_debt,
            processing_time_ms=processing_time,
            representatives=results
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

def classify_debt_level(debt: Decimal) -> str:
    """طبقه‌بندی سطح بدهی مطابق منطق unified-financial-engine"""
    if debt == 0:
        return "HEALTHY"
    elif debt <= Decimal('100000'):
        return "MODERATE" 
    elif debt <= Decimal('500000'):
        return "HIGH"
    else:
        return "CRITICAL"

@app.post("/reconcile/drift-detection", response_model=DriftDetectionResult)
async def reconcile_drift_detection(request: DriftDetectionRequest):
    """
    P-01 Fix: Enhanced drift detection with JSON body support
    تشخیص drift بین legacy، ledger و cache با دقت بالا و پشتیبانی از فیلتر نمایندگان
    """
    start_time = datetime.now()
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Build WHERE clause for representative filtering
        rep_filter = ""
        if request.representative_ids and len(request.representative_ids) > 0:
            rep_ids_str = ','.join(str(rid) for rid in request.representative_ids)
            rep_filter = f"AND r.id IN ({rep_ids_str})"
        
        # Legacy sum از representatives table
        cursor.execute(f"SELECT COALESCE(SUM(total_debt::DECIMAL), 0) FROM representatives r WHERE is_active = true {rep_filter}")
        legacy_result = cursor.fetchone()
        legacy_sum = Decimal(str(legacy_result[0] if legacy_result else 0))
        
        # Ledger sum از payment_allocations
        cursor.execute(f"""
            SELECT COALESCE(
                SUM(i.amount::DECIMAL) - SUM(COALESCE(pa.allocated_amount, 0)), 
                0
            )
            FROM invoices i
            LEFT JOIN payment_allocations pa ON pa.invoice_id = i.id
            JOIN representatives r ON r.id = i.representative_id
            WHERE r.is_active = true {rep_filter}
        """)
        ledger_result = cursor.fetchone()
        ledger_sum = Decimal(str(ledger_result[0] if ledger_result else 0))
        
        # Cache sum از invoice_balance_cache
        cursor.execute(f"""
            SELECT COALESCE(SUM(ibc.remaining_amount), 0)
            FROM invoice_balance_cache ibc
            JOIN invoices i ON i.id = ibc.invoice_id
            JOIN representatives r ON r.id = i.representative_id
            WHERE r.is_active = true {rep_filter}
        """)
        cache_result = cursor.fetchone()
        cache_sum = Decimal(str(cache_result[0] if cache_result else 0))
        
        # محاسبه total drift
        max_sum = max(legacy_sum, ledger_sum, cache_sum)
        total_drift = max(abs(legacy_sum - ledger_sum), abs(ledger_sum - cache_sum), abs(legacy_sum - cache_sum))
        drift_ratio = float(total_drift / max_sum) if max_sum > 0 else 0.0
        
        # Detect anomalies if requested
        anomalies = []
        if request.include_anomalies and drift_ratio > float(request.threshold) / 1000000:
            anomalies.append({
                "type": "legacy_vs_ledger",
                "legacy_sum": float(legacy_sum),
                "ledger_sum": float(ledger_sum),
                "cache_sum": float(cache_sum),
                "difference": float(abs(legacy_sum - ledger_sum)),
                "percentage": float(abs(legacy_sum - ledger_sum) / max_sum * 100) if max_sum > 0 else 0
            })
        
        cursor.close()
        conn.close()
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return DriftDetectionResult(
            total_drift=total_drift,
            drift_ratio=drift_ratio,
            anomalies=anomalies,
            processing_time_ms=processing_time,
            scope=request.scope,
            metadata={
                "legacy_sum": float(legacy_sum),
                "ledger_sum": float(ledger_sum),
                "cache_sum": float(cache_sum),
                "is_consistent": drift_ratio < 0.001,
                "representatives_count": len(request.representative_ids) if request.representative_ids else "all"
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Drift detection error: {str(e)}")

# Legacy endpoint for backward compatibility
@app.get("/reconcile/drift-detection-legacy", response_model=ReconciliationResult)
async def reconcile_drift_detection_legacy(scope: str = "global"):
    """
    Legacy endpoint برای سازگاری با نسخه‌های قدیمی
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT COALESCE(SUM(total_debt::DECIMAL), 0) FROM representatives WHERE is_active = true")
        legacy_result = cursor.fetchone()
        legacy_sum = Decimal(str(legacy_result[0] if legacy_result else 0))
        
        cursor.execute("""
            SELECT COALESCE(
                SUM(i.amount::DECIMAL) - SUM(COALESCE(pa.allocated_amount, 0)), 
                0
            )
            FROM invoices i
            LEFT JOIN payment_allocations pa ON pa.invoice_id = i.id
            JOIN representatives r ON r.id = i.representative_id
            WHERE r.is_active = true
        """)
        ledger_result = cursor.fetchone()
        ledger_sum = Decimal(str(ledger_result[0] if ledger_result else 0))
        
        cursor.execute("""
            SELECT COALESCE(SUM(ibc.remaining_amount), 0)
            FROM invoice_balance_cache ibc
            JOIN invoices i ON i.id = ibc.invoice_id
            JOIN representatives r ON r.id = i.representative_id
            WHERE r.is_active = true
        """)
        cache_result = cursor.fetchone()
        cache_sum = Decimal(str(cache_result[0] if cache_result else 0))
        
        cursor.close()
        conn.close()
        
        max_sum = max(legacy_sum, ledger_sum, cache_sum)
        if max_sum > 0:
            max_drift = max(abs(legacy_sum - ledger_sum), abs(ledger_sum - cache_sum), abs(legacy_sum - cache_sum))
            drift_ratio = float(max_drift / max_sum)
        else:
            drift_ratio = 0.0
            
        is_consistent = drift_ratio < 0.001
        
        discrepancies = []
        if not is_consistent:
            discrepancies.append({
                "type": "legacy_vs_ledger",
                "difference": float(abs(legacy_sum - ledger_sum)),
                "percentage": float(abs(legacy_sum - ledger_sum) / max_sum * 100) if max_sum > 0 else 0
            })
        
        return ReconciliationResult(
            legacy_sum=legacy_sum,
            ledger_sum=ledger_sum, 
            cache_sum=cache_sum,
            drift_ratio=drift_ratio,
            is_consistent=is_consistent,
            discrepancies=discrepancies
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reconciliation error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")