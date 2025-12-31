# Reward Rules

**Jackpet Agent** uses a deterministic, rule-based system to evaluate each game round executed by an autonomous agent under a single **ERC-7715 permission**.

After drawing 12 pets, the counts of the three pet types are sorted in descending order and represented as a combination `{a, b, c}`. Each combination maps to a predefined reward rule.

## Reward Components

Each rule may include one or both of the following:

1. **Fixed Ticket Payout**  
   A multiplier applied to the base ticket fee, scaled by the player's selected ticket rate.

2. **Jackpot Pool Share**  
   A percentage of the current jackpot pool distributed to the player automatically.

## Example Outcomes

- **Top Jackpot Outcome `{8,4,0}`**  
  - Pays a high multiple of the ticket fee  
  - Distributes nearly the entire jackpot pool  
  - Represents the rarest and most valuable outcome

- **Mid-Tier Winning Outcomes (e.g. `{8,3,1}`, `{7,5,0}`)**  
  - Provide meaningful ticket multipliers  
  - Distribute a portion of the jackpot pool

- **Low-Tier Outcomes (e.g. `{6,4,2}`, `{4,4,4}`)**  
  - Return the ticket fee with a small bonus  
  - Do not affect the jackpot pool

- **Losing Outcome `{5,4,3}`**  
  - Pays no reward  
  - Contributes a portion of the ticket fee to the jackpot pool

## Jackpot Contribution

- Losing rounds add **1% of the ticket fee** to the on-chain jackpot pool.  
- The jackpot pool grows organically through autonomous gameplay and can only be reduced according to predefined rules.

## Rule Enforcement

All reward rules are **strictly enforced on-chain** via smart contracts:

- Rules are executed automatically by the agent under the ERC-7715 permission.  
- No discretionary or manual payouts exist; every reward and jackpot distribution is fully verifiable.  
- Neither the project team nor any external party can influence or manipulate outcomes once a round starts.  

This guarantees **equal treatment for all players**, full transparency, and trust-minimized agentic gameplay.
