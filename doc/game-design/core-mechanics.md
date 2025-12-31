# Core Gameplay Mechanics

**Jackpet Agent** is an agentic, luck-based on-chain game designed to showcase **MetaMask Advanced Permissions**. Players grant a single **ERC-7715 permission** to an autonomous agent, allowing it to automatically start and execute multiple game rounds on their behalf—eliminating repeated wallet confirmations while strictly enforcing per-round limits, multipliers, and reward rules.

## Game Entry

- Players authorize an agent with a single ERC-7715 permission to start rounds.
- Each round requires a base ticket fee of **0.01 ETH**.
- Once authorized, the agent triggers rounds automatically, without further user interaction.

## Game Flow

1. The agent submits a transaction with the required ticket fee on behalf of the player.
2. The contract requests a random value using **Chainlink VRF**.
3. Once randomness is fulfilled, the game draws **12 pets** from a pool of 24 (3 types × 8 variations).
4. The drawn pets are evaluated against predefined reward rules.
5. The contract settles rewards and, if applicable, distributes jackpot funds.

All steps after the initial permission are executed autonomously by the agent, with full on-chain enforcement—no off-chain intervention is required.

## Pet Drawing Mechanism

- Each round draws **12 pets without replacement** from a **24-pet pool**.
- Pet types and counts determine the outcome according to the reward rules.
- Randomness is verifiable and tamper-proof via Chainlink VRF.

This mechanism ensures **fair, auditable, and deterministic outcomes** while preventing manipulation or repetition in a single draw.

## Settlement

- Rewards are calculated strictly according to the predefined table.
- Losing rounds contribute a portion of the ticket fee to the on-chain jackpot pool.
- All settlements occur atomically within the same transaction finalizing the round, fully compatible with agent-based execution and ERC-7715 permission constraints.
