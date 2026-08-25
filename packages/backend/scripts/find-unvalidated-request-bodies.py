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

  * An interface or type alias IS now reported: any named @Body() type with no
    matching `export class` anywhere under src/ is flagged as erased. What is
    still NOT checked is whether a real class carries validator decorators --
    a class with none passes this scan and validates nothing.
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


# `export` is optional. A DTO declared `class FooDto {}` beside the controller
# that uses it is a perfectly good class — it exists at runtime and validates —
# and indexing only exported ones reported three of them as erased types.
CLASS_NAMES = {
    name
    for f in (ROOT.parent).rglob('*.ts')
    for name in re.findall(r'^\s*(?:export\s+)?(?:abstract\s+)?class (\w+)', f.read_text(errors='ignore'), re.M)
}


def main() -> int:
    findings = []
    allowed = []
    for path in sorted(ROOT.rglob('*.controller.ts')):
        # Two passes, and the order and flags matter. Stripping both patterns
        # together under re.S made `//.*` match from the first line comment to
        # the end of the file — so this scanner saw only each controller's
        # imports and reported "every @Body() names a class" while 39 handlers
        # took `any`. A scanner that lies is worse than no scanner.
        raw_src = path.read_text()
        # Blank the comments out rather than deleting them, so line numbers
        # still line up with the file on disk. Deleting them shifted every
        # reported line and broke the exception-marker lookup below, which
        # reads the real source around the match.
        src = re.sub(r'/\*.*?\*/', lambda m: '\n' * m.group(0).count('\n'), raw_src, flags=re.S)
        src = re.sub(r'//[^\n]*', '', src)
        for m in re.finditer(r'@Body\(\s*\)\s*(\w+)\s*:\s*([A-Za-z_][\w.]*|\{)', src):
            typ = m.group(2)
            if typ == '{':
                kind = 'inline type'
            elif typ in ('any', 'object', 'Object'):
                kind = typ
            elif typ in CLASS_NAMES:
                continue  # a real class; decorators are a separate question
            elif typ in ('Partial', 'Record', 'Pick', 'Omit'):
                kind = f'{typ}<> (erased)'
            elif typ[0].isupper():
                # Named, but no `export class` anywhere declares it — so it is
                # an interface or type alias. Both vanish at compile time and
                # leave the pipe with `Object` to validate against, which it
                # cannot. POST /patients/:id/notes was exactly this: it named
                # CreateNoteDto, validated nothing, and persisted whatever it
                # was sent.
                kind = 'interface/type alias (erased)'
            else:
                continue
            line = src[: m.start()].count('\n') + 1
            # A deliberate exception is declared in the source, next to the
            # parameter, and must say why. Some bodies genuinely are open —
            # a jsonb payload whose shape varies by record type cannot be
            # given a DTO, because `whitelist` would strip it to {}. Silently
            # tolerating those is what lets real gaps hide among them.
            preceding = raw_src.splitlines()[max(0, line - 10) : line]
            if any('unvalidated-body:' in l for l in preceding):
                allowed.append((path.relative_to(ROOT.parent.parent), line, m.group(1)))
                continue
            findings.append((path.relative_to(ROOT.parent.parent), line, m.group(1), kind))

    if allowed:
        print(f'{len(allowed)} declared exception(s), each with a stated reason:')
        for rel, line, name in allowed:
            print(f'    {rel}:{line} {name}')
        print()

    if not findings:
        print('find-unvalidated-request-bodies: every @Body() the pipe can check, it checks.')
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
