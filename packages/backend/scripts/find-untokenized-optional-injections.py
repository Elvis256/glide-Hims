#!/usr/bin/env python3
"""
Find constructor dependencies that Nest will silently inject as `undefined`.

    @Optional()
    private readonly x: SomeService | null,

A union parameter type makes TypeScript emit `Object` for that parameter's
`design:paramtypes` entry, so Nest has no token to resolve. Without
`@Optional()` that is a boot-time error you cannot miss; WITH it, Nest injects
`undefined` and every `if (!this.x) return;` guard downstream reads as "this
feature is switched off". Nothing logs, nothing throws, and the feature is
simply gone.

Found this way: maternity's SMS notifier (so the EPI defaulter reminder cron
had never sent a single message), discharge medication reconciliation, and the
drug-disease interaction check.

The fix is to name the token explicitly:

    @Optional() @Inject(SomeService)                     # plain dependency
    @Optional() @Inject(forwardRef(() => SomeService))   # circular import

BLIND SPOTS — read before trusting a clean run:
  * Only constructor parameters carrying an access modifier (private/public/
    protected/readonly) are matched. A plain `@Optional() svc: X | null`
    parameter that is assigned by hand in the body is missed.
  * Only `| null` and `| undefined` unions are matched. A three-way union, or
    an alias that resolves to a union (`type MaybeX = X | null`), is missed —
    an alias in particular looks like a plain type here and is invisible.
  * The reverse is NOT checked: `@Inject()` naming the wrong token still
    compiles and still injects the wrong thing.
  * A bare `@Optional() private x?: SomeService` (optional parameter, no union)
    is FINE and is deliberately not reported — TypeScript still emits the real
    type for it.

Exit code 1 if anything is found, so it can hold a CI gate.
"""
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src"

# @Optional(), optionally followed by more decorators, then a parameter
# property whose declared type is a union with null/undefined.
PATTERN = re.compile(
    r"@Optional\(\)\s*"
    r"((?:@Inject\([^)]*\)\s*)?)"          # group 1: an explicit token, if any
    r"(?:@[A-Za-z]+\([^)]*\)\s*)*"          # any other decorators
    r"(?:private|public|protected|readonly)[^;\n]*?"
    r":\s*([A-Za-z0-9_.<>\[\] ]+?)\s*\|\s*(?:null|undefined)"
)

STRIP_BLOCK = re.compile(r"/\*.*?\*/", re.S)
STRIP_LINE = re.compile(r"//[^\n]*")


def main() -> int:
    findings = []
    for path in sorted(SRC.rglob("*.ts")):
        if "__tests__" in path.parts or path.name.endswith(".spec.ts"):
            continue
        text = path.read_text()
        # Comments quote this pattern when documenting it — strip them, but
        # keep the line count intact so reported lines stay accurate.
        stripped = STRIP_LINE.sub("", STRIP_BLOCK.sub(lambda m: "\n" * m.group(0).count("\n"), text))
        for match in PATTERN.finditer(stripped):
            if match.group(1).strip():
                continue  # a token is named — this one resolves
            line = stripped[: match.start()].count("\n") + 1
            findings.append((path.relative_to(SRC.parent), line, match.group(2).strip()))

    if not findings:
        print("No untokenized @Optional() union-typed injections found.")
        return 0

    print(f"{len(findings)} dependency/dependencies Nest will inject as undefined:\n")
    for rel, line, service in findings:
        print(f"  {rel}:{line}")
        print(f"      {service} | null  ->  add @Inject({service})")
    print("\nEach of these makes a guarded feature silently unavailable.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
