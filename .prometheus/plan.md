# نقشه راه جامع فاز ۲ (Roadmap Master) – نسخه Handoff برای ایجنت ثانویه
تاریخ به‌روزرسانی: 29 سپتامبر 2025

> این سند فقط DESIGN & PLANNING است. هیچ Migration جدید (به‌جز DDL Draft ها) بدون تأیید اجرا نشده. هدف: شفاف‌سازی کامل وضعیت کنونی + مسیر باقی‌مانده با حداقل ریسک و حفظ Invariants.

---
## 0. اصول تغییرناپذیر (Invariant Principles)
1. Enhance Not Eliminate – حذف قابلیت ممنوع؛ فقط توسعه تدریجی با پرچم‌ها.
2. جداسازی لایه‌ها: Domain ≠ Persistence ≠ Presentation.
3. حاکمیت مالی: Truth = Ledger + Invariants + Reconciliation (Phase B تثبیت شده).
4. هر فاز اتمیک + قابلیت Rollback (Feature / Multi-Stage Flags = Gate).
5. Traceability: هر آیتم در review.md و memory.md قابل رجوع.
6. Fail Containment: خطای یک زیرسیستم (مثلاً Outbox) نباید کل سیستم را Block کند.
7. Progressive Hardening: Security/Performance در زمان مناسب – نه زود، نه دیر.
8. عدم ورود Feature جدید خارج از این سند بدون ثبت تصمیم.

---
## 1. وضعیت کلان فازها
| Phase | وزن | پیشرفت | یادداشت |
|-------|-----|---------|----------|
| A | 25% | 100% | Ledger + Dual Write پایه کامل |
| B | 40% | 100% | Reconciliation + KPI + Performance پایدار |
| C | 35% | ≈21% | تمرکز Outbox SLA + Alerting پایه |
| D | 15% | 0% | آماده بعد از Reliability |

Overall ≈ 25 + 40 + (0.21 * 35=7.35) = 72.35% → 72.3%.

---
## 2. تمرکز فعال: Phase C – Reliability & Observability
اهداف فاز C:
- E-C1: تضمین تحویل Telegram (Outbox Pattern + Retry + SLA Metrics)
- E-C3: Backup Automation + WAL Archiving (هنوز شروع نشده)
- E-C4: Integrity Alerting & SLA Dashboard (هسته آستانه Outbox فعال)
- E-C6: Ingestion Progress State Machine (Groundwork 30%)

### 2.1 ماتریس اپیک‌های فعال
| Epic | کد | Progress | Done Highlights | Remaining Core |
|------|----|----------|-----------------|----------------|
| Outbox & Retry | E-C1 | 0.75 | Worker + AutoStart + Window Metrics + P50/P95 + Alert Wiring | Idempotency Key (شرطی) + E-C6 Hook + Optional p99 |
| Integrity Alerting & SLA | E-C4 | 0.30 | threshold_config Draft + Transition-Based Outbox Alerts | Dynamic Threshold Load (DB) + SLA Dash Wiring |
| Ingestion Progress SM | E-C6 | 0.30 | Seq groundwork (NDJSON pattern reused) | Persisted State Table + Resume Logic Sketch |
| Backup & WAL | E-C3 | 0.0 | - | Design + retention policy |
| Activity Log Partitioning | E-C5 | 0.0 | - | Volume & query profile study |
| Domain Event Stream | E-C2 | 0.0 | Deferred | Start بعد تثبیت Outbox |

---
## 3. جزئیات E-C1 (Outbox)
### 3.1 انجام‌شده (✅)
- Service + Worker + API Routes (`/api/outbox/*`)
- Feature Flag Gate: `outbox_enabled` (multi-stage: off|on)
- Auto-start Worker هنگام `on`
- Retry با Exponential Backoff (Max 5)
- Health Enrichment: queueDepth, retryingCount, cancelledCount, lastBatchProcessedAt
- Rolling Window Metrics (failure_rate_window, avg_retry_window)
- Latency Buckets & Percentiles (P50/P95) – منبع: `guard_metrics_events`
- Draft DDL: `threshold_config` (NOT APPLIED)
- Dynamic Threshold Loader Stub (cache 60s)
- OutboxMonitor (Alert Wiring: failure_rate / avg_retry / p95) – Transition-based noise suppression

### 3.2 باقی‌مانده (Code Scope)
| آیتم | توضیح | نوع |
|------|-------|------|
| Idempotency Key | فقط در صورت مشاهده پیام تکراری ناشی از Retry (ستون اضافه + UNIQUE جزئی) | Conditional |
| E-C6 Hook | Interface برای persist/resume batch processing (Outbox Worker Recovery) | Core |
| p99 Latency (اختیاری) | فقط در صورت توزیع Heavy Tail | Optional |

### 3.3 ضد-دام (Do NOT)
- افزودن queue خارجی (Rabbit / Redis) – خارج از دامنه.
- تغییر Max Retry بدون Threshold Calibration.
- اجرای Migration جدول `threshold_config` قبل از تثبیت مقادیر.

---
## 4. جزئیات E-C4 (Alerting)
### 4.1 انجام‌شده
- آستانه‌های Outbox به‌صورت Static Map + Draft DDL
- OutboxMonitor → ثبت رویدادهای سطح warn/critical فقط روی Transition
- رویدادهای بازیابی: *_RECOVERED (اطلاعاتی)

### 4.2 باقی‌مانده
| آیتم | اقدام |
|------|-------|
| Activate Dynamic Thresholds | SELECT واقعی از `threshold_config` پس از Apply Migration |
| SLA Dashboard | تجمیع نمایشی Outbox SLA (failure, retry inflation, latency) |
| Cross-Metric Correlation | (Deferred) – بعد از اضافه‌شدن منابع دیگر (Domain Events/WAL) |

---
## 5. E-C6 – State Machine (Groundwork)
- الگوی Seq Streaming در فازهای قبل (Ingestion) موجود.
- لازم: جدول `ingestion_progress_state` (Draft – هنوز طراحی نهایی نشده)
- Hook مورد انتظار برای Outbox: ذخیره آخرین `processed_id` + cursor window.

---
## 6. پرچم‌ها (Feature & Multi-Stage) – وضعیت فعلی
| Flag | State | نقش |
|------|-------|-----|
| outbox_enabled | on/off (فعلاً دستی) | فعال/غیرفعال کل زیرسیستم Outbox |
| guard_metrics_persistence | shadow/enforce/off | کنترل Persist متریک‌ها |
| guard_metrics_alerts | on/off | فعال‌سازی تحلیل Threshold + OutboxMonitor |
| allocation_dual_write | off | Phase A پایان یافته؛ پایدار |
| active_reconciliation | off/dry/enforce | فعلاً خاموش |

---
## 7. Immediate Action Set (فقط کدنویسی – بدون تغییر دامنه)
1. Idempotency Key Specification (شرطی) – Draft Column Plan.
2. E-C6: State Persistence Sketch (Table + Resume Contract) – بدون Implement کامل.
3. Optional: p99 latency decision (Log-only probe toggle).
4. آماده‌سازی Migration واقعی `threshold_config` (در صورت تأیید مقادیر).

---
## 8. Backlog تفکیکی (مرجع برای Agent بعدی)
| دسته | آیتم | وضعیت |
|------|------|--------|
| Reliability | Backup Automation (E-C3) | Not Started |
| Observability | SLA Dashboard (E-C4) | Pending |
| Data Volume | Activity Log Partition Plan (E-C5) | Pending |
| State Progress | Ingestion State Machine Persistence (E-C6) | Design Pending |
| Enhancement Optional | Latency p99 | Deferred |

---
## 9. Test / Validation Backlog (Passive – فعلاً خارج از Scope اجرا)
| نام پیشنهادی | هدف |
|--------------|-----|
| outbox-idempotency.spec.ts | تضمین عدم درج تکراری بعد از Retry | 
| outbox-latency-tail.spec.ts | بررسی توزیع tail (p95→p99 فاصله) |
| threshold-dynamic-load.spec.ts | اطمینان از override صحیح مقادیر Static |
| ingestion-state-resume.spec.ts | بازیابی Cursor پس از Crash |

(این تست‌ها اجرا نشده‌اند؛ فقط بعنوان مسیر آینده ثبت می‌شوند.)

---
## 10. ریسک‌های فعال (به‌روز)
| ID | وضعیت | توضیح | اقدام کاهش |
|----|--------|-------|-------------|
| R15 | Mitigated | عدم کشف Fail تجمعی Outbox | Alert Wiring Transition-Based |
| R16 | Reduced | فقدان دید Tail Latency | امکان p99 در صورت نوسان |
| R17 | Accepted | کاهش پوشش تست رسمی | Log Monitoring + Optional Specs |

---
## 11. معیار عدم انجام (Out of Scope Explicit)
- NO External MQ Migration
- NO Early WAL Archiving Script بدون طراحی Retention
- NO Bulk Refactor UI پیش از SLA Dashboard

---
## 12. Handoff Quick Start برای Agent جدید
1. اگر نیاز به فعال‌سازی Alert: `guard_metrics_alerts` → on + `outbox_enabled` → on.
2. تغییر Threshold فعلاً فقط با ویرایش `guard-metrics-thresholds.ts` (Static) – DDL هنوز Apply نشده.
3. Idempotency: فقط در صورت مشاهده Duplicate (بررسی رویدادهای `OUTBOX_MESSAGE_RETRY_SCHEDULED`).
4. برای توسعه E-C6: از الگوی NDJSON در ingestion scripts الهام بگیر.
5. هر Migration جدید: جدا + Reversible + وابستگی Flag.

---
## 13. خلاصه نهایی پیشرفت
| Item | درصد |
|------|-------|
| Phase Overall | ≈72.3% |
| E-C1 | 0.75 |
| E-C4 | 0.30 |
| Phase C کل | ≈21% |

---
(پایان نسخه Handoff – هر تغییر بعدی باید در هر سه فایل plan.md / review.md / memory.md همگام‌سازی شود.)
