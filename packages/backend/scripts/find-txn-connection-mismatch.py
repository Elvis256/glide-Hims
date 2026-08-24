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


def comment_block_above(text, pos):
    """The contiguous comment/blank lines immediately above `pos`.

    A fixed character lookback kept getting this wrong in both directions: too
    short and a waiver at the top of a long doc comment was missed, too long
    and an unrelated comment several declarations up could waive a call it had
    nothing to do with. Walking the block is exact.
    """
    line_start = text.rfind('\n', 0, pos) + 1
    out = []
    i = line_start
    while i > 0:
        prev_start = text.rfind('\n', 0, i - 1) + 1
        line = text[prev_start:i - 1].strip()
        if line == '' or line.startswith('//') or line.startswith('*') or \
           line.startswith('/*') or line.endswith('*/'):
            out.append(line)
            i = prev_start
            if prev_start == 0:
                break
        else:
            break
    return '\n'.join(out)


def waiver_context(text, pos):
    """Where a `txn-connection-ok` marker is allowed to sit for a call at `pos`.

    The comment block directly above, plus the handful of lines before it. The
    block alone is too strict: a waiver often documents the `try {` that wraps
    the call, or a second call one line below the first it was written for. A
    plain line window alone is too loose at the other end, missing a marker at
    the top of a long doc comment.
    """
    line_start = text.rfind('\n', 0, pos) + 1
    window_start = line_start
    for _ in range(6):
        window_start = text.rfind('\n', 0, max(0, window_start - 1)) + 1
        if window_start == 0:
            break
    return comment_block_above(text, pos) + '\n' + text[window_start:line_start]

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
        # Unawaited calls count too. postGoodsReceipt fired both its GL post
        # and its PR auto-complete as bare `this.foo(...).catch(...)` inside
        # the transaction; being unawaited makes the connection mismatch
        # worse, not better, so matching only `await this.` hid them.
        for call in re.finditer(r'this\.([A-Za-z0-9_]+)\s*\(', cb):
            callee = call.group(1)
            if callee not in methods: continue
            args, _ = block(cb, call.end()-1, '(', ')')     # full balanced args
            if re.search(r'\bmanager\b', args): continue     # manager threaded through
            cbody = methods[callee]
            # No trailing dot required: the manager-aware helpers assign the
            # repo to a local first (`const repo = manager ? ... : this.fooRepo`),
            # and requiring `.` made every one of them invisible here.
            # A helper that reaches a sibling service counts too: it is on
            # another connection just as surely as one holding its own repo.
            # Without this a private wrapper hid the call from pass 1 while
            # pass 2 could not see it either, since pass 2 only matches the
            # `this.x.y(` form written inline in the transaction.
            if not re.search(
                r'this\.[A-Za-z0-9_]*[Rr]epo(sitory)?\b|this\.dataSource\.|this\.[A-Za-z0-9_]+Service\.',
                cbody): continue
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
            head = waiver_context(text, decl)
            if 'txn-connection-ok' in head:
                waived.append((str(f).replace('modules/',''), callee))
                continue
            rows.append((str(f).replace('modules/',''), callee, writes, opens, takes_mgr))

# Second pass: calls that are on another connection BY CONSTRUCTION, with no
# need to resolve a callee body — a sibling service uses its own repositories,
# and this.fooRepo is the injected repository rather than the manager's. The
# first pass cannot see either: its regex is `this.name(`, so `this.x.y(` never
# matches. That is how supplier-finance's payment journal and procurement's GRN
# journal both stayed hidden.
direct = []
for f in files:
    text = f.read_text()
    for tm in re.finditer(r'dataSource\.transaction\(\s*async\s*\(\s*manager', text):
        cb, _ = block(text, tm.end())
        w = WRITE.search(cb)
        if not w: continue
        for call in re.finditer(
            r'this\.([A-Za-z0-9_]*(?:[Rr]epo(?:sitory)?|Service))\s*\.\s*([A-Za-z0-9_]+)\s*\(', cb):
            if call.start() < w.start(): continue
            recv, meth = call.group(1), call.group(2)
            # logger/config and the like are not database work
            if recv in ('logger', 'configService', 'eventEmitter'): continue
            # repo.create() only instantiates an entity; it issues no query
            if meth == 'create': continue
            # already handed the transaction's manager
            args, _ = block(cb, call.end()-1, '(', ')')
            if re.search(r'\bmanager\b', args): continue
            # Waive per call, not per transaction: a transaction can hold one
            # deliberate read and one genuine escaping write, and waiving the
            # whole block would hide the second. The comment has to sit within
            # the few lines directly above the call.
            head = waiver_context(cb, call.start())
            line = text[:tm.end() + call.start()].count('\n') + 1
            direct.append((str(f).replace('modules/',''), f'{recv}.{meth}', 'txn-connection-ok' in head, line))

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

dseen = set()
rows2 = [(f, c, ln) for f, c, w, ln in direct if not w and (f, c) not in dseen and not dseen.add((f, c))]
print('\nSibling service / injected repo called inside a transaction after a write')
print('(on its own connection by construction — check each is deliberate):\n')
for f, c, ln in sorted(rows2):
    print(f"  {f}:{ln}".ljust(52) + f"-> {c}()")
print(f"\n{len(rows2)} sites")
dwaived = {(f, c) for f, c, w, _ in direct if w}
if dwaived:
    print(f"({len(dwaived)} reviewed sites waived via txn-connection-ok)")
