// Analytics module
// Responsibilities:
//   - 360 dashboard: GMV, ROAS, LTV, SLA, gross margin (all data from same DB — no API fan-out)
//   - Health score calculation: ROAS(30%) + SLA(25%) + LTV growth(20%) + engagement(15%) + response(10%)
//   - Automated monthly PDF report generation
//   - Cohort retention analysis
//   - Channel attribution cross-module aggregation
//
// NOTE: Analytics only queries existing tables — no dedicated analytics tables initially.
//       Add materialized views or a dedicated analytics schema when query latency demands it.

export {}
