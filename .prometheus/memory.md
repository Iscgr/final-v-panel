# memory.md – حافظه طراحی و تصمیمات (Handoff Edition)
تاریخ به‌روزرسانی: 29 سپتامبر 2025

هدف: فراهم‌سازی مرجع زنده برای ایجنت جدید جهت درک «چرا» پشت تغییرات و مسیر باقی‌مانده بدون تکرار زائد plan/review. هر تغییر کدنویسی باید ابتدا با این Invariants هم‌راستا بررسی شود.

---
## 1. Snapshot پیشرفت
Phase A: 100% | Phase B: 100% | Phase C: ≈21% | Phase D: 0%  
Overall ≈ 72.3%  
E-C1: 0.75 | E-C4: 0.30 | E-C6: 0.30

---
## 2. Log افزایشی E-C1 (Outbox)
| Step | توضیح | نتیجه | Progress |
|------|-------|-------|----------|
| C1-10 | health enrichment (lastBatchProcessedAt) | پایه مانیتورینگ | 0.52 |
| C1-11 | /status route counters | دید عملیاتی | 0.55 |
| C1-12 | Auto-start + P50/P95 | SLA baseline | 0.65 |
| C1-13 | Retry escalation test scaffold | پایه ارزیابی | 0.66 |
| C1-14 | threshold_config DDL + loader stub | مسیر Alert پویا | 0.68 |
| C1-15 | OutboxMonitor wiring (failure_rate/avg_retry/p95) | SLA breach detection | 0.75 |

---
## 3. تصمیمات کلیدی (Phase C Focus)
| ID | تصمیم | دلیل | اثر | بازبینی |
|----|-------|------|-----|---------|
| DC1 | Shadow خروجی Outbox پیش از enforce | کمینه‌سازی Blast Radius | rollout ایمن | بعد از داده واقعی |
| DC2 | استفاده از guard_metrics_events مشترک | جلوگیری از شتاب‌دهی زودهنگام DB | توسعه سریع | اگر حجم ↑ rollup |
| DC3 | تعویق Idempotency Key | YAGNI تا مشاهده Duplicate | کاهش پیچیدگی | پس از تحلیل Retry burst |
| DC4 | Buckets + Percentiles با هم | Shape + SLA | پوشش تحلیلی | بعد از p99 ارزیابی |
| DC5 | Multi-Stage Flags | rollback سریع | ایمنی مهاجرت | دائمی (الگو ثابت) |
| DC6 | Window محاسبات ساده (Query-time) | پرهیز از premature aggregation | کاهش ریسک | اگر latency ↑ rollup |
| DC7 | Transition-based Alert Emission | حذف نویز (عدم Spam) | Alert قابل اعتماد | بعد از Load واقعی |

---
## 4. ریسک‌ها و وضعیت فعلی
| Risk | توضیح | Status | کاهش کنونی | Remaining Concern |
|------|-------|--------|------------|------------------|
| R15 | عدم تشخیص Fail تجمعی | Mitigated | OutboxMonitor فعال | Threshold دقیق آینده |
| R16 | نبود دید Tail Latency | Reduced | p95 فعال | تصمیم p99 پس از تحلیل |
| R17 | پوشش تست رسمی پایین | Accepted | لاگ + Smoke | افزودن spec در نوسان |

---
## 5. طراحی Idempotency (پیشنهادی – هنوز اعمال نشده)
Trigger Condition: مشاهده ارسال تکراری (Telegram API double dispatch) یا Retry با Side Effect.  
Draft Column (outbox): `idempotency_key TEXT NULL` + `UNIQUE(idempotency_key) WHERE idempotency_key IS NOT NULL`.  
Source Generation: hash(payload.recipient + payload.message).  
Conflict Policy: اگر موجود → تبدیل به NO-OP + ثبت متریک `OUTBOX_DUPLICATE_SUPPRESSED`.

---
## 6. طراحی پیشنهادی E-C6 State Persistence (Sketch)
Table: `ingestion_progress_state`
| Column | Type | Note |
|--------|------|------|
| id | SERIAL PK | - |
| process_code | TEXT UNIQUE | e.g. 'OUTBOX_WORKER' / 'INGESTION_PIPE' |
| last_cursor | JSONB | نوع cursor (id/time/window) |
| meta | JSONB | retry offsets, batch hints |
| updated_at | TIMESTAMP | heartbeat/update |

Resume API Contract (Concept):
```
interface ProgressStateStore {
  load(processCode: string): Promise<State | null>;
  save(processCode: string, state: State): Promise<void>;
}
```
Outbox Hook: save آخرین message id processed هر N پیام (مثلاً 50) یا بعد از batch.

---
## 7. Threshold های Outbox (فعلی در Mapping Static)
| Metric | warn | critical | واحد | یادداشت |
|--------|------|----------|------|---------|
| outbox_failure_rate | 1 | 2 | percent | بالاتر → بررسی شبکه یا Token |
| outbox_avg_retry | 1.5 | 2.5 | average count | انفجار Retry = احتمال خطای پایدار |
| outbox_latency_p95 | 5000 | 8000 | ms | SLA نخستین (پیش‌فرض محافظه‌کارانه) |

(در زمان APPLY واقعی: مقادیر در `threshold_config` نوشته و loader به حالت DB تغییر.)

---
## 8. Backlog طبقه‌بندی‌شده (مرجع مشترک)
| دسته | آیتم | Priority | وضعیت |
|------|------|----------|--------|
| Outbox | Idempotency Key | High | Pending Decision |
| Outbox | p99 Latency Probe | Medium | Deferred |
| Alerting | Dynamic Threshold Load | High | Draft موجود |
| Alerting | SLA Dashboard | Medium | Not Started |
| Ingestion | State Persistence Table | High | Design Sketch |
| Backup | WAL Archiving Plan | Medium | Not Started |
| Partitioning | Activity Log Strategy | Low | Not Started |

---
## 9. Anti-Patterns اجتنابی
| مورد | توضیح |
|------|-------|
| Migration زودهنگام threshold_config | تا نهایی‌سازی مقادیر |
| افزودن Message Broker | خارج دامنه فعلی |
| Alert Flood | ممنوع – فقط Transition Emission |
| Test گسترده Premature | فقط Targeted Spec در صورت ریسک |

---
## 10. نشانه‌های پایش در زمان اجرا (Runtime Indicators)
| Indicator | منبع | آستانه هشدار | اقدام |
|-----------|------|--------------|-------|
| failure_rate_window | getWindowMetrics | >1% warn | بررسی log خطا |
| avg_retry_window | getWindowMetrics | >2.0 warn | بررسی latency API |
| p95 latency | getLatencyPercentiles | >5000ms warn | ارزیابی Bottleneck |
| CANCELLED count رشد | /api/outbox/status | نسبت به baseline | بررسی Token / Rate Limit |

---
## 11. مسیر اعمال Dynamic Threshold (چک لیست کوتاه)
1. APPLY Migration: ساخت جدول `threshold_config` (مقادیر Seed).  
2. افزودن Loader واقعی: SELECT + Populate Cache.  
3. Invalid Cache: TTL = 60s (قابل تنظیم).  
4. اضافه کردن متریک `THRESHOLD_SOURCE=dynamic` در context رویداد Alert برای قابلیت تفکیک.

---
## 12. مسیر Fast-Fail در صورت ناپایداری Outbox
| سناریو | عمل فوری | Flag اقدام |
|--------|----------|------------|
| Spike failure_rate | بررسی Token / شبکه | در صورت نیاز outbox_enabled=off |
| Latency انفجاری | تعلیق موقت Worker | outbox_enabled=off + تحلیل DB |
| Alert طوفانی | کاهش سطح Critical → افزایش warn | ویرایش map موقت |

---
## 13. نقاط همگام‌سازی بین فایل‌ها
| ناحیه | plan.md | review.md | memory.md |
|-------|---------|-----------|-----------|
| پیشرفت E-C1 | 0.75 | 0.75 | 0.75 | 
| Alert Wiring وضعیت | Done | Done | Logged (C1-15) |
| Idempotency | Remaining | Remaining | Design rationale (DC3) |

---
## 14. آینده نزدیک (Next Logical Micro-Steps)
1. Draft Idempotency Column & Guard (بدون Apply).
2. Draft E-C6 Table SQL (فقط در دایرکتوری .prometheus). 
3. تصمیم درباره p99 پس از جمع حداقل 500 نمونه latency.

---
## 15. یادداشت پایانی Handoff
- تمام اعمال جدید باید: (۱) Flag-Gated، (۲) Reversible، (۳) در این فایل ثبت + sync با plan/review.
- هر تغییری در Threshold باید همراه Commit Message حاوی Reason & Evidence باشد.

(پایان حافظه – آماده ادامه توسط ایجنت جدید)