#!/usr/bin/env python3
"""Find calls that omit a required tenantId positional argument.

Every one of these fails at runtime with "Missing tenant context" — and every
one found so far sat behind a try/catch or a .catch that logged the failure and
carried on, so nothing surfaced. Live examples: the thank-you SMS after a
payment (never once sent), removing a prescription item leaving its charge on
the invoice, the configured write-off ceiling never being read, chronic-care
reminders never going out, and a released lab result never returning the
patient to the doctor.

How it works: resolve `this.<field>` to its declared class, look up the method
on that class, and compare the argument count against the position of
tenantId. Only reports calls that pass too few arguments AND mention no
tenant-ish identifier.

Known limits — this net has holes, and the live walk is what catches the rest:

  * A method counts as tenant-requiring if its own body calls
    requireTenantId(tenantId) OR merely mentions tenantId. The second clause
    exists because EncountersService.returnToDoctor delegates the requirement
    to a private helper and was invisible without it. It also means some hits
    are methods where tenantId is genuinely optional — see below.
  * Optional-by-design methods are false positives. RefreshTokenService
    .revokeAllUserTokens only narrows its WHERE when given a tenant, so
    omitting it revokes MORE, which is the safer direction. Check the callee
    before "fixing" anything here.
  * Only `this.<field>.<method>(` is resolved. A call through a local variable
    or a destructured service is not seen.
  * Platform-scope reads are expected hits: saas-revenue and setup read
    settings whose own comments say "system-wide, tenantId NULL", and
    SystemSettingsService.getByKey cannot express that scope. Making
    system-scope reads first-class is a product decision, not a fix.
"""
import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent / 'src'


def tenant_requiring_methods():
    """class name -> {method: index of tenantId in the parameter list}."""
    classes: dict[str, dict[str, int]] = {}
    for path in ROOT.rglob('*.ts'):
        src = path.read_text()
        for cm in re.finditer(r'export class (\w+)', src):
            cls = cm.group(1)
            start = cm.end()
            nxt = src.find('export class', start)
            body = src[start: nxt if nxt > -1 else len(src)]
            for m in re.finditer(r'async ([A-Za-z0-9_]+)\(([^)]*)\)\s*:', body, re.S):
                name, params = m.group(1), m.group(2)
                if 'tenantId?: string' not in params:
                    continue
                nm = re.search(r'\n  (?:private |public |protected )?async \w+\(', body[m.end():])
                mbody = body[m.end(): m.end() + (nm.start() if nm else 2500)]
                if not re.search(r'\btenantId\b', mbody):
                    continue
                parts = [p.strip() for p in re.split(r',(?![^<>()]*[>)])', params) if p.strip()]
                idx = next((i for i, p in enumerate(parts) if p.startswith('tenantId')), None)
                if idx is not None:
                    classes.setdefault(cls, {})[name] = idx
    return classes


def count_args(src: str, open_paren: int) -> str:
    """Return the raw argument text for a call whose '(' is at open_paren."""
    i, depth, args = open_paren, 1, ''
    while i < len(src) and depth:
        ch = src[i]
        if ch in '([{':
            depth += 1
        elif ch in ')]}':
            depth -= 1
            if depth == 0:
                break
        args += ch
        i += 1
    return args


def main() -> int:
    classes = tenant_requiring_methods()
    hits = []
    for path in ROOT.rglob('*.ts'):
        src = path.read_text()
        fields = dict(
            re.findall(r'(?:private|public|readonly|protected)\s+(?:readonly\s+)?(\w+)\s*:\s*(\w+)', src)
        )
        for m in re.finditer(r'this\.(\w+)\s*\.\s*(\w+)\(', src):
            field, method = m.group(1), m.group(2)
            cls = fields.get(field)
            if not cls or cls not in classes or method not in classes[cls]:
                continue
            idx = classes[cls][method]
            # A trailing comma is not an argument. Counting it as one is why an
            # earlier version of this script missed the very bug it was written
            # for.
            args = count_args(src, m.end()).strip().rstrip(',')
            n = 0 if not args else 1
            depth = 0
            for ch in args:
                if ch in '([{':
                    depth += 1
                elif ch in ')]}':
                    depth -= 1
                elif ch == ',' and depth == 0:
                    n += 1
            if n <= idx and 'tenant' not in args and 'tid' not in args:
                line = src[:m.start()].count('\n') + 1
                rel = path.relative_to(ROOT)
                hits.append(f'  {rel}:{line}  this.{field}.{method}() -> {cls} wants tenantId at #{idx + 1}, got {n}')

    print('Calls omitting a required tenantId (check the callee before changing any):\n')
    for h in sorted(set(hits)):
        print(h)
    print(f'\n{len(set(hits))} sites')
    return 0


if __name__ == '__main__':
    sys.exit(main())
