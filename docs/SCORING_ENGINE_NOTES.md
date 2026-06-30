# SCORING_ENGINE_NOTES

## Implemented in this stage

1. `src/lib/scoringEngine.ts` provides pure scoring functions.
2. The engine accepts `answers`, `questions`, and `scoringConfig`.
3. It calculates:
   - directR scores from answered question options.
   - dimension scores from answered question options.
   - finalRisk scores from configured formulas.
   - a structured `ResultDraft`.
4. Missing sources are skipped instead of treated as zero.
5. finalRisk formulas re-normalize available weights only.
6. The engine does not read localStorage, render pages, call APIs, or depend on React.

## Still placeholder

1. Current `scoring.json` is marked as `TODO_PLACEHOLDER`.
2. Current directR option values are engineering structure data, not final product scoring.
3. Current dimension scoring is calculated from option marks, but formal dimension rules and weights are not complete.
4. Current finalRisk formulas mostly use `directRWeight: 1` and empty `dimensionWeights`.
5. Risk card triggering and ranking are not part of this stage.

## Not a formal product judgement

The current output is a scoring draft for engineering verification only. It must not be shown as a final user-facing result, because product has not confirmed formal directR values, dimension weights, finalRisk formulas, risk card triggers, or result copy.

## Product inputs still required

1. Formal directR score values.
2. Formal dimension weights and dimension calculation rules.
3. Formal finalRisk weights.
4. Complete risk card trigger rules.
5. Formal result page copy.
