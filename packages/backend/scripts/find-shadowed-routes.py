#!/usr/bin/env python3
"""
Find literal Nest routes that a parameterised route declared ABOVE them will
swallow.

Nest matches routes in declaration order. `@Get(':id')` written before
`@Get('displays')` claims /displays, and if the handler pipes the segment
through ParseUUIDPipe the caller gets "Validation failed (uuid is expected)" —
which reads like a bad request rather than a route that cannot be reached. If
there is no pipe it 500s inside the lookup instead. Either way it never looks
like a routing problem.

Found live: insurance claims CSV export, the queue display board, and the
finance inter-facility transfer list. All three had never once responded.

BLIND SPOTS — read before trusting a clean run:

  * An earlier version of this script counted route decorators quoted inside
    COMMENTS as real routes, and so reported a route it had just been used to
    fix as still broken. Comment lines are stripped first now. If you extend
    the pattern, strip comments before matching, not after.
  * Only same-method, same-depth collisions are reported. A literal three-
    segment path is not compared against a two-segment parameterised one, which
    is correct for Nest but means `displays/:code/queue` under `:id/audit-log`
    is not examined.
  * Route arrays (`@Get(['a', 'b'])`) and paths built from constants are not
    parsed at all.
  * Controllers that register a global prefix or version other than the default
    are treated as one namespace. Cross-controller collisions are invisible.

Exit code is 1 when anything is shadowed, so CI can hold the line.
"""
import glob
import re
import sys

DECORATOR = re.compile(r"@(Get|Post|Put|Patch|Delete)\(\s*'([^']*)'")


def strip_comments(src: str) -> str:
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    return "\n".join(re.sub(r"//.*$", "", line) for line in src.split("\n"))


def shadows(earlier: str, later: str) -> bool:
    """True when `earlier` (parameterised) matches everything `later` matches."""
    a, b = earlier.split("/"), later.split("/")
    if len(a) != len(b):
        return False
    if not any(s.startswith(":") for s in a):
        return False
    return all(x.startswith(":") or x == y for x, y in zip(a, b))


def main() -> int:
    findings = []
    for path in sorted(glob.glob("src/**/*.controller.ts", recursive=True)):
        routes = [
            (m.group(1), m.group(2))
            for m in DECORATOR.finditer(strip_comments(open(path).read()))
        ]
        for i, (method, route) in enumerate(routes):
            if any(s.startswith(":") for s in route.split("/")):
                continue
            for method2, route2 in routes[:i]:
                if method2 == method and shadows(route2, route):
                    findings.append((path, method, route, route2))
                    break

    for path, method, route, by in findings:
        print(f"{path}\n   {method} '{route}'  unreachable — '{by}' is declared above it")

    print(f"\n{len(findings)} shadowed route(s)")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
