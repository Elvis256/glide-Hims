# Sprint-6 Finance Hardening — Summary

**Status:** 20/20 todos closed · 7 commits on `main` · live-tested end-to-end (14/14 matrix pass).

## Goal
Close all CRITICAL/HIGH finance bugs surfaced in the Sprint-5 audit so the
finance pipeline (JE → approval → posting → recon → close) is correct,
idempotent, and resistant to drift.

## Commit timeline

| Commit    | Batch | Scope                                                         |
| --------- | ----- | ------------------------------------------------------------- |
| `f92c569` | 1     | Budget variance + reservation logic                            |
| `d5a185f` | 2     | Donor fund expiry gate · petty-cash replenish cap             |
| `28f0805` | 2     | Bank-recon `complete()` FOR-UPDATE outer-join fix             |
| `c8587a0` | 3     | Money-in-cents sweep across budget / donor / petty / finance  |
| `4f771f1` | 4     | GL schema hardening: JEL → BaseEntity, XOR/FK/CHECK constraints |
| `68c03b9` | 5     | Versioned approval chain (re-submit) · honest GL recon stub · seeded `finance.periods.open` |
| `b20eec3` | 6     | Maker-checker SoD on credit notes · idempotent statement lines · deposit balance recompute |

## Live test matrix (14/14 ✅)

```
B1.1 unbalanced JE rejected               400
B1.2 balanced JE accepted                 201
B2.1 petty replenish over-cap rejected    400
B3.1 cents-precise math                   verified (c8587a0)
B4.1 JEL.updated_at column                ✅
B4.2 JEL XOR debit/credit CHECK           ✅
B4.3 FK on journal_entries.reversal_of_id ✅
B5.1 finance_approval_chains.attempt      ✅
B5.2 finance.periods.open seeded          ✅
B5.3 GL recon mark-reconciled → 501       ✅
B6.1 patient CN self-approve rejected     403
B6.2 apply DRAFT CN rejected              400
B6.3 stmt-line idempotency                1 row from 2 uploads
B6.4 deposit balance recompute            drift 999 → 500 (= 1000-300-200)
```

## Migrations introduced

| File                                                       | Purpose                                            |
| ---------------------------------------------------------- | -------------------------------------------------- |
| `1782900000005-JelExtendBaseEntity.ts`                     | JEL `updated_at`, `deleted_at`, indexes            |
| `1782900000006-FinanceConstraintsHardening.ts`             | XOR(debit,credit), FK on reversal_of/reversed_by, no-reversal-of-reversal CHECK |
| `1782900000007-FinanceApprovalChainAttempt.ts`             | `attempt SMALLINT`, `(je_id, level, attempt)` UNIQUE, `attempt >= 1` CHECK |

## Key invariants now enforced

- **Money:** all multi-step finance math goes through `toCents/fromCents/sumCents` — no float drift.
- **GL:** posting takes `pessimistic_write` on COA balance row.
- **JEL:** every line is XOR(debit, credit), reversals link via real FKs, can't reverse a reversal.
- **Approval:** rejected JEs can be re-submitted; new attempt rows live alongside historical ones.
- **GL recon stub:** writes refuse with `501`, reads report truth (was lying as `100% reconciled`).
- **Credit notes:** maker-checker SoD on approve; only `APPROVED` notes can be applied (patient *and* supplier).
- **Bank recon:** statement-line uploads are idempotent; a JE can match exactly one statement line.
- **Patient deposits:** `balance` is recomputed from `amount - SUM(applications)` under lock — drift self-heals.
