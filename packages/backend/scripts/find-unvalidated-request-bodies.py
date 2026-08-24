#!/usr/bin/env python3
"""
Find @Body() handlers whose type the ValidationPipe cannot see.

A DTO only gets validated when it is a CLASS. Two shapes defeat that, and both
compile and look fine:

    @Body() dto: any                       -- no metadata at all
    @Body() body: { featureKey: string }   -- an inline type, erased at compile

TypeScript erases both, so `emitDecoratorMetadata` records `Object`, the
ValidationPipe has nothing to check against, and the body passes through
untouched no matter what it contains. `forbidNonWhitelisted` does not save you
either: with no schema there is nothing to whitelist against.

What it costs, all found by sending `{}` to every mutation route:

  * POST /features/check-batch reached `body.featureKeys.map` and threw
    "Cannot read properties of undefined (reading 'map')" -- a 500.
  * POST /features/system/definitions, /inventory/recalls and
    /inventory/cycle-counts reached Postgres and failed on NOT NULL columns --
    500s where the honest answer is a 400 naming the missing field.
  * Earlier in the same campaign: the maternity partograph DTO was an
    `interface`, so `moulding: "xyz"` was accepted; and the critical-result
    acknowledgement took `{"note": {"a": 1}}` into `.trim()` and 500'd.

BLIND SPOTS -- read before trusting a clean run:

  * An `interface` used as a @Body() type looks like a class here and is NOT
    reported. It has the identical failure mode. Only a class with validator
    decorators is actually checked; this script cannot tell the difference
    between `class CreateFooDto` with decorators and one without.
  * A class DTO with no class-validator decorators on its properties passes
    this scan and validates nothing.
  * @Body('field') single-property extraction is not examined, and it is
    unvalidated too -- doctor-duty's PATCH :id/status pulled a bare
    @Body('status') and accepted an absent value as a silent no-op.

So: a clean run means "no `any` and no inline object types", not "every body is
validated". Exits non-zero when it finds any.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'src' / 'modules'


def main() -> int:
    findings = []
    for path in sorted(ROOT.rglob('*.controller.ts')):
        src = re.sub(r'//.*|/\*.*?\*/', '', path.read_text(), flags=re.S)
        for m in re.finditer(r'@Body\(\s*\)\s*(\w+)\s*:\s*(any\b|\{)', src):
            kind = 'any' if m.group(2) == 'any' else 'inline type'
            line = src[: m.start()].count('\n') + 1
            findings.append((path.relative_to(ROOT.parent.parent), line, m.group(1), kind))

    if not findings:
        print('find-unvalidated-request-bodies: every @Body() names a class.')
        return 0

    by_file: dict = {}
    for rel, line, name, kind in findings:
        by_file.setdefault(str(rel), []).append((line, name, kind))

    print(f'{len(findings)} @Body() parameter(s) the ValidationPipe cannot check, '
          f'across {len(by_file)} controller(s):\n')
    for rel in sorted(by_file, key=lambda f: -len(by_file[f])):
        entries = by_file[rel]
        print(f'  {len(entries):3}  {rel}')
        for line, name, kind in entries[:4]:
            print(f'         :{line} {name} ({kind})')
        if len(entries) > 4:
            print(f'         ... and {len(entries) - 4} more')
    print('\nReplace each with a DTO class carrying class-validator decorators.')
    return 1


if __name__ == '__main__':
    sys.exit(main())
