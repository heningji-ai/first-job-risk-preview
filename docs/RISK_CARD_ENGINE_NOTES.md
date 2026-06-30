# RISK_CARD_ENGINE_NOTES

## Implemented in this stage

1. `src/lib/riskCardEngine.ts` provides pure risk card evaluation functions.
2. The engine accepts `answers`, `resultDraft`, and `riskCards`.
3. It evaluates:
   - `strongMatch` as an admission check only.
   - answer, dimension, finalRisk, and flag conditions.
   - protectRules before normal triggering.
   - primary risk signal requirements.
   - triggered, skipped, protected, and top risk cards.
4. `selectTopRiskCards` returns up to 3 cards by score, priority, and config order.
5. If no cards trigger, `H0_GENERAL_REMINDER` is returned only as a display fallback in `topRiskCards`.
6. The engine does not read localStorage, render pages, call APIs, or depend on React.

## Still engineering sample only

1. Current `risk_cards.json` is marked as `ENGINEERING_SAMPLE_ONLY`.
2. It contains 3 sample cards, not the complete formal 16-card set.
3. Card copy is placeholder text.
4. Current priorities, scores, and protectRules are for engineering verification only.

## Not a formal product judgement

The current triggered cards are a draft logic output for engineering verification. They must not be shown as formal user-facing conclusions until product confirms the complete card set, trigger rules, priority standards, protection rules, fallback copy, and viral copy.

## Product inputs still required

1. Complete 16 risk cards.
2. Formal trigger rules for every card.
3. Formal priority and score standards.
4. Formal protectRules business rules.
5. Fallback display copy.
6. Formal viral copy.
