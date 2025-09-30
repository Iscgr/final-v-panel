# review.md – گزارش پیشرفت اجرایی (Handoff Edition)
تاریخ: 29 سپتامبر 2025

هدف: Snapshot اجرایی قابل اقدام برای ایجنت بعدی – شامل وضعیت فازها، دلتای آخر، ریسک‌ها، و صف اقدامات کدنویسی باقی‌مانده. این فایل باید همراه plan.md و memory.md خوانده شود.

---
## 1. Executive Snapshot
| Phase | Status | Completion | Notes |
|-------|--------|-----------|-------|
| A | Done | 100% | Ledger + Dual-Write پایدار |
| B | Done | 100% | Reconciliation + KPI + Perf Hardening |
| C | Active | ~21% | E-C1 Outbox: 0.75 / E-C4: 0.30 |
| D | Pending | 0% | شروع پس از تثبیت Reliability |

Overall ≈ 72.3%

---
## 2. Delta (آخرین تغییرات کلیدی)
| تغییر | اثر |
|--------|------|
| افزودن `outbox-monitor.ts` | فعال‌شدن Alert Wiring (failure_rate/avg_retry/p95 latency) |
| Transition-based emission | کاهش نویز Alert – فقط روی تغییر سطح |
| Draft DDL `threshold_config` | آماده‌سازی Activation آتی Threshold پویا |
| Dynamic loader stub | ساختار بارگذاری کش ۶۰ ثانیه‌ای – فعلاً از Static Map تغذیه می‌شود |

---
## 3. وضعیت E-C1 (Outbox)
| Aspect | Status | توضیح |
|--------|--------|-------|
| Worker & Retry Logic | ✅ | MaxRetry=5, Exponential Backoff |
| Health Signals | ✅ | queueDepth, retryingCount, cancelledCount, lastBatchProcessedAt |
| Window Metrics | ✅ | failure_rate_window / avg_retry_window |
| Latency Buckets | ✅ | نگهداری رویداد در guard_metrics_events |
| Percentiles P50/P95 | ✅ | Query percentile_cont (60m) |
| Alert Wiring | ✅ | OutboxMonitor – thresholds: failure_rate / avg_retry / p95 |
| threshold_config Draft | ✅ | DDL موجود (NOT APPLIED) |
| Dynamic Threshold Loader | ✅ | Stub (در حال حاضر static) |
| Idempotency Key | ❌ (Deferred) | نیازمند شواهد تکرار واقعی |
| E-C6 Integration | ❌ | State resume design باقی‌مانده |
| Optional p99 | ❌ | فقط در صورت Tail Anomaly |

Progress: 0.75

---
## 4. وضعیت E-C4 (Integrity Alerting)
| Component | Status | توضیح |
|-----------|--------|-------|
| Static Threshold Mapping | ✅ | guard-metrics-thresholds.ts |
| Outbox Alert Channel | ✅ | Transition-Based Events |
| Dynamic Threshold Table | Draft | DDL جدا (عدم اعمال) |
| SLA Dashboard | Pending | بعد از تثبیت Outbox metrics |

Progress: 0.30

---
## 5. Remaining Action Set (Code-Only)
| Priority | آیتم | توضیح نهایی | نوع |
|----------|------|-------------|-----|
| P1 | Idempotency Key Spec | ستون احتمالی: `idempotency_key TEXT` + UNIQUE(partial) | Conditional |
| P1 | E-C6 State Persistence Sketch | جدول پیشنهادی: `ingestion_progress_state` + interface resume | Design |
| P2 | Dynamic Threshold Activation | Migration + Loader واقعی + invalidate cache | Core |
| P3 | Optional p99 Latency Probe | افزودن percentile_cont(0.99) + threshold ارزیابی | Optional |

(عدم اضافه Feature جدید خارج از این لیست مگر ثبت در memory.md)

---
## 6. ریسک‌ها (Updated)
| ID | Status | توضیح | کاهش کنونی | گام بعدی |
|----|--------|-------|------------|-----------|
| R15 | Mitigated | Silent Outbox Fail Accumulation | Alert Wiring فعال | مانیتور حجم رویداد |
| R16 | Reduced | Latency Tail Blindness | p95 فعال | تصمیم p99 بعد از نمونه واقعی |
| R17 | Accepted | کمبود تست رسمی | Base smoke + logging | افزودن spec در صورت ناپایداری |

---
## 7. پیشنهاد تست‌های بعدی (در حال حاضر اجرا نشده)
| Test Name | هدف |
|-----------|-----|
| outbox-idempotency.spec.ts | تضمین عدم درج تکراری بعد از Crash/Retry |
| threshold-dynamic-load.spec.ts | اعتبار override مقداری از جدول پویا |
| ingestion-state-resume.spec.ts | بازیابی کاری بعد از توقف Worker |
| outbox-latency-tail.spec.ts | فاصله p95 → p99 (Heavy Tail Detection) |

---
## 8. Flag Matrix (Relevant)
| Flag | State | اثر |
|------|-------|-----|
| outbox_enabled | on/off | کنترل Worker + Monitor شروع |
| guard_metrics_alerts | on/off | فعال‌سازی OutboxMonitor |
| guard_metrics_persistence | off/shadow/enforce | کنترل Persist / Summaries |

(برای تولید Alert: هر سه prerequisite: persistence≠off برای داده، alerts=on، outbox_enabled=on)

---
## 9. هماهنگی فایل‌ها
| File | Sync | Notes |
|------|------|-------|
| plan.md | ✅ | نسخه Handoff ساختاری |
| review.md | ✅ | این فایل |
| memory.md | ✅ | Log تا C1-15 ثبت شد |

---
## 10. Quick Handoff Guide
1. نیاز به Threshold پویا؟ Migration `threshold_config` را APPLY کن + Loader را واقعی کن.
2. قبل از اضافه p99: ۲۴ ساعت لاگ p95 پایدار جمع‌آوری شود.
3. اگر Duplicate در Telegram مشاهده شد → Idempotency Key اضافه کن.
4. E-C6 طراحی: Cursor + last_applied_seq → recovery friendly.

---
## 11. خلاصه درصدها
| مورد | مقدار |
|------|-------|
| Overall | ≈72.3% |
| Phase C | ≈21% |
| E-C1 | 0.75 |
| E-C4 | 0.30 |

---
پایان گزارش – آماده ادامه توسط ایجنت بعدی.

