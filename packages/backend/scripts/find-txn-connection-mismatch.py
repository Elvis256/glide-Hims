#!/usr/bin/env python3
"""Find helpers called inside a transaction that use a different connection.

This shape has produced three real bugs in this codebase:

  recalculateInvoice        opened its own transaction and took a lock on the
                            invoice its caller already held — every billable
                            item deadlocked and the request never returned.
  updatePrescriptionStatus  read through the repository from inside the
                            dispensing transaction, so it computed the status
                            from the state before the dispense and lagged by
                            one; a fully dispensed script never reached
                            'dispensed' and its encounter never went to payment.
  findOne (same file)       re-read the prescription the same blind way.

The rule: anything called from inside dataSource.transaction(manager => ...)
must be handed that manager. Look for a `...InTxn` twin before calling a
private helper from within a transaction.

Two things this cannot decide, so read every hit before acting on it:

  * whether the callee touches the SAME rows the transaction wrote. Reading an
    untouched entity on another connection is correct — lab's amendResult reads
    the sample, which it never writes.
  * whether a write escaping the transaction matters. Audit rows and stock
    reversals written on another connection survive a rollback, which is a
    weaker fault than a stale read but still a real one.

Run from packages/backend/src:  python3 ../scripts/find-txn-connection-mismatch.py
"""

import re, pathlib

files = [p for p in pathlib.Path('.').rglob('*.service.ts') if '__tests__' not in str(p)]
DEF = re.compile(r'^\s{2}(?:private |public |protected )?(?:async )?([A-Za-z0-9_]+)\s*\(', re.M)
# Writes inside a transaction rarely read `manager.save(` — they go through
# locals like `const itemRepo = manager.getRepository(X)`. Count any write that
# is not on one of the service's own long-lived repositories.
WRITE = re.compile(r'(?<!this\.)\b[A-Za-z0-9_]*[Rr]epo(?:sitory)?\.(save|update|insert|delete|increment)\(|manager\.(save|update|insert|delete|increment)\(')

def block(text, i, open_c='{', close_c='}'):
    i = text.find(open_c, i)
    if i < 0: return '', -1
    d, j = 0, i
    while j < len(text):
        if text[j] == open_c: d += 1
        elif text[j] == close_c:
            d -= 1
            if d == 0: return text[i:j+1], i
        j += 1
    return text[i:], i

rows = []
waived = []
for f in files:
    text = f.read_text()
    methods = {}
    for m in DEF.finditer(text):
        n = m.group(1)
        if n in ('constructor','if','for','while','switch','catch'): continue
        end = text.find(')', m.end())
        methods[n] = block(text, end)[0]
    for tm in re.finditer(r'dataSource\.transaction\(\s*async\s*\(\s*manager', text):
        cb, cb_start = block(text, tm.end())
        w = WRITE.search(cb)
        first_write = w.start() if w else None
        if first_write is None: continue
        for call in re.finditer(r'await this\.([A-Za-z0-9_]+)\s*\(', cb):
            callee = call.group(1)
            if callee not in methods: continue
            args, _ = block(cb, call.end()-1, '(', ')')     # full balanced args
            if re.search(r'\bmanager\b', args): continue     # manager threaded through
            cbody = methods[callee]
            # No trailing dot required: the manager-aware helpers assign the
            # repo to a local first (`const repo = manager ? ... : this.fooRepo`),
            # and requiring `.` made every one of them invisible here.
            if not re.search(r'this\.[A-Za-z0-9_]*[Rr]epo(sitory)?\b|this\.dataSource\.', cbody): continue
            if call.start() < first_write: continue          # reads committed state, fine
            writes = bool(re.search(r'\.(save|update|insert|delete|increment)\(', cbody))
            opens = 'dataSource.transaction' in cbody
            takes_mgr = 'manager' in methods[callee][:0] or bool(re.search(r'manager\?:\s*EntityManager', text[text.find(f'{callee}('):text.find(f'{callee}(')+400]))
            # Reviewed-and-deliberate sites opt out with a `txn-connection-ok:`
            # comment in the 6 lines above the helper's declaration, so a
            # clean run means zero and any new hit is genuinely new.
            # Anchor on the declaration, not the first mention: a call site
            # earlier in the file would otherwise be searched for the waiver.
            dm = re.search(r'(?:private|public|protected|async)\s+(?:async\s+)?' + re.escape(callee) + r'\s*\(', text)
            decl = dm.start() if dm else text.find(f'{callee}(')
            head = text[max(0, decl - 500):decl]
            if 'txn-connection-ok' in head:
                waived.append((str(f).replace('modules/',''), callee))
                continue
            rows.append((str(f).replace('modules/',''), callee, writes, opens, takes_mgr))

seen=set()
print('AFTER a write, inside the transaction, on a different connection:\n')
for f,callee,writes,opens,takes in sorted(rows):
    k=(f,callee)
    if k in seen: continue
    seen.add(k)
    tag = 'OPENS OWN TXN' if opens else ('writes' if writes else 'reads')
    note = ' (helper accepts a manager — just not given one)' if takes else ''
    print(f"  {tag:14} {f:44} -> {callee}(){note}")
print(f"\n{len(seen)} sites")
if waived:
    print(f"\n({len(set(waived))} reviewed sites waived via txn-connection-ok)")
