# Evaluating the kit

Unit tests (`npm test`) prove the scripts work. They do not prove the kit makes an AI build better sites.
These evals check that.

## Method
1. For each case in `cases.json`, prepare the fixture project twice in identical sandboxes.
2. Install the kit in one (`node bin/jarvis-immersive.mjs init <dir>`); leave the other bare as the baseline.
3. Give both a fresh agent session with the same model and the case's prompt. Do not help either one.
4. Build and serve both results. Run the inspector on each:
   ```bash
   node skills/immersive-inspect/scripts/inspect.mjs <url> --out evals/runs/<case>/<kit|baseline>
   ```
5. Give both screenshot sets, unlabelled and in random order, to a judge (a person or a separate model
   session) with `skills/immersive-inspect/references/critique.md`. Record both weighted scores.
6. Tick each grader for the kit run; a grader passes only with evidence (a file, a command output, a screenshot).
7. Negative cases pass when the kit stays out of the way.

## Record
Add a row per run to `evals/RESULTS.md`:

| Date | Case | Agent / model | Inspector FAIL kit / base | Critique kit / base | Graders passed | Notes |
|---|---|---|---|---|---|---|

The kit earns its place when, across cases, the kit runs have zero inspector FAILs, a higher blind critique
score than the baseline, and pass at least 90% of graders. Report regressions as plainly as wins.
