#!/usr/bin/env python3
"""
Find @RequireModule declarations with no ModuleGuard behind them.

@RequireModule('reports') only writes metadata. Something has to READ it, and
the only thing that does is ModuleGuard — which is NOT registered as an
APP_GUARD. So a controller that declares a module but never puts ModuleGuard in
its guard chain answers normally for a tenant that has the module switched off,
or never licensed it. The declaration reads like a gate and is decoration.

Found live on 2026-08-24: 25 of 90 controllers, 20 of them on modules that are
not always-allowed. Verified by narrowing the dev tenant's enabled_modules and
comparing: /lab/tests and /ipd/wards returned 403 while /critical-results,
/analytics/dashboard and /schedules returned 200 with their modules disabled.

The guard chain can arrive three ways, and all three count:
  * @UseGuards(..., ModuleGuard) on the controller class
  * AuthWithModule(module, ...perms) on the handlers, which bundles ModuleGuard
  * ModuleGuard named anywhere in the file (a custom composite decorator)

BLIND SPOTS — read before trusting a clean run:

  * TWO @UseGuards DECORATORS ON ONE CLASS DO NOT COMPOSE. UseGuards calls
    Reflect.defineMetadata, which replaces; the decorator applied last (the
    topmost, since class decorators run bottom-up) wins outright and the other
    is silently discarded. doctor-duty carried @UseGuards(ModuleGuard) above
    and @UseGuards(AuthGuard('jwt')) below and only ModuleGuard survived. This
    script cannot see that: it greps for the NAME, so a ModuleGuard sitting in
    a chain that some other @UseGuards overwrites still reads as covered. If
    you touch a controller with more than one class-level @UseGuards, merge
    them into one call rather than trusting a clean run here.
  * Presence is not enforcement. ModuleGuard exempts system admins and the
    always-allowed modules ('admin', 'registration'), and treats a tenant with
    no configured modules as allow-all. A controller can be listed as covered
    and still answer for everyone.
  * Comments are stripped before matching, so a @RequireModule quoted in a
    doc comment is not counted — but a guard named only inside a comment is
    not counted either, which is the safe direction.
  * Only *.controller.ts under src/modules is examined.

Exits non-zero when anything is found, so it can hold a CI gate.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'src' / 'modules'
ALWAYS_ALLOWED = {'admin', 'registration'}


def strip_comments(text: str) -> str:
    return re.sub(r'//.*|/\*.*?\*/', '', text, flags=re.S)


def main() -> int:
    findings = []
    checked = 0
    for path in sorted(ROOT.rglob('*.controller.ts')):
        src = strip_comments(path.read_text())
        if '@RequireModule(' not in src:
            continue
        checked += 1
        if 'ModuleGuard' in src or 'AuthWithModule(' in src:
            continue
        modules = sorted(set(re.findall(r'@RequireModule\(\s*[\'"]([^\'"]+)', src)))
        gated_in_practice = not all(m in ALWAYS_ALLOWED for m in modules)
        findings.append((path, modules, gated_in_practice))

    if not findings:
        print(f'find-ungated-module-requirements: {checked} controllers declare a module, all gated.')
        return 0

    real = [f for f in findings if f[2]]
    print(f'{len(findings)} controller(s) declare @RequireModule with no ModuleGuard '
          f'({len(real)} on a module that is not always-allowed):\n')
    for path, modules, gated in findings:
        note = '' if gated else '   (always-allowed module: no behaviour change if gated)'
        rel = path.relative_to(ROOT.parent.parent)
        print(f'  {",".join(modules):14} {rel}{note}')
    print('\nAdd ModuleGuard to the class guard chain — MERGED into any existing '
          '@UseGuards on that class, never as a second decorator.')
    return 1


if __name__ == '__main__':
    sys.exit(main())
