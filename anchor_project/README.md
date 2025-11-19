# Circle - Solana ROSCA Program

A decentralized Rotating Savings and Credit Association (ROSCA) smart contract built with Anchor on Solana.

## What is a ROSCA?

A ROSCA (Rotating Savings and Credit Association) is a group savings scheme where members contribute a fixed amount regularly, and each period one member receives the total pooled funds. This continues in rotation until all members have received.

## Program Overview

**Program ID**: `8vHAoAwSX4QeQL4624iRMRWt8gKgHRgb1rJFqDK917we`

The Circle program implements a ROSCA on Solana with the following features:

- Group creation with configurable parameters
- Member joining and contribution tracking
- Automatic round-robin payout system
- Time-based epochs for contributions
- Secure fund management using PDAs

## Instructions

### 1. Create Chama

Initialize a new ROSCA group.

**Parameters**:

- `name`: String - Unique name for the group
- `contribution_amount`: u64 - Amount each member contributes (in lamports)
- `epoch_period`: i64 - Duration of each round (in seconds)
- `max_members`: u8 - Maximum number of members allowed

### 2. Join Chama

Join an existing ROSCA group as a member.

### 3. Contribute

Make your contribution for the current epoch. Must be an exact match of the required contribution amount.

### 4. Claim Round

Trigger payout to the current round's recipient after the epoch ends. Anyone can call this once all members have contributed and the epoch period has passed.

## Account Structure

### Chama Account (PDA)

Seeds: `["chama", name, admin_pubkey]`

Stores group configuration, member list, contribution tracking, and round state.

### Vault Account (PDA)

Seeds: `["vault", chama_pubkey]`

Holds pooled SOL contributions until distribution.

## Building

```bash
anchor build
```

## Testing

```bash
anchor test
```

## Deploying

```bash
# Set to Devnet
solana config set --url devnet

# Deploy
anchor deploy
```

## Example Usage

1. Admin creates a chama: 5 members, 0.1 SOL contribution, 1 day epochs
2. Members join until group is full (5/5)
3. All members contribute 0.1 SOL each (0.5 SOL total in vault)
4. After 1 day, anyone calls claim_round → Member #1 receives 0.5 SOL
5. Next epoch starts, all contribute again → Member #2 receives 0.5 SOL
6. Pattern repeats until all 5 members have received their payout
7. Cycle can continue indefinitely
