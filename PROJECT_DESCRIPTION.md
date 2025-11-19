# Project Description

**Deployed Frontend URL:** [Vercel Link](https://program-0xodus-eth-u6md.vercel.app/)

**Solana Program ID:** 8vHAoAwSX4QeQL4624iRMRWt8gKgHRgb1rJFqDK917we

## Project Overview

### Description

Circle is a decentralized Rotating Savings and Credit Association (ROSCA) platform built on Solana, inspired by traditional "Chama" groups common in East Africa. Users can create savings groups where members contribute a fixed amount of SOL each period, and in each round, one member receives the entire pooled funds. This continues in a fair rotation until all members have received their payout, then the cycle repeats. The dApp enables trustless group savings with automatic payouts, eliminating the need for a central coordinator while maintaining transparency and security through blockchain technology.

### Key Features

- **Create ROSCA Groups**: Set up custom savings groups with configurable contribution amounts, time periods, and member limits
- **Join Groups**: Discover and join existing ROSCA groups that match your savings goals
- **Contribute SOL**: Make regular contributions each epoch with automatic validation
- **Automatic Rotation**: Fair round-robin system ensures everyone gets their turn to receive pooled funds
- **Claim Payouts**: Trigger distribution of pooled funds to the current round's recipient after epoch ends
- **Real-time Tracking**: Monitor group status, member contributions, and time remaining for current epoch
- **Transparent History**: View all members, their claim status, and total rounds completed

### How to Use the dApp

1. **Connect Wallet** - Connect your Phantom or Solflare wallet and ensure you have Devnet SOL
2. **Create a Chama**:
   - Enter a unique group name (e.g., "Friends Savings")
   - Set contribution amount (e.g., 0.1 SOL)
   - Define epoch period in seconds (e.g., 86400 for daily)
   - Choose maximum members (2-10 members)
   - Submit transaction to create the group
3. **Join a Chama**:
   - Paste the chama address you received or were invited to
   - Click "Fetch Chama" to view group details
   - Click "Join Chama" if spots are available
4. **Contribute**:
   - Once you're a member, click "Contribute" during the active epoch
   - Exact contribution amount is automatically sent to the vault
5. **Claim Round**:
   - Wait for the epoch timer to reach zero
   - Any member can trigger "Claim Round" to send pooled funds to the current recipient
   - New epoch automatically starts for the next round

## Program Architecture

The Circle program implements a trustless ROSCA system using Anchor framework with two main PDA accounts: a Chama account storing group state and member information, and a Vault account holding pooled SOL contributions. The architecture ensures secure fund management through CPI transfers and enforces fair distribution through round-robin recipient selection.

### PDA Usage

The program uses two Program Derived Addresses to manage group data and securely hold funds.

**PDAs Used:**

- **Chama PDA**: Derived from seeds `["chama", group_name, admin_pubkey]` - Stores all group configuration (contribution amount, epoch period, max members), member list, contribution tracking, current round state, and timing information. The seeds ensure each admin can create uniquely named groups.
- **Vault PDA**: Derived from seeds `["vault", chama_pubkey]` - Holds pooled SOL contributions securely until distribution. Uses CPI with signing for secure transfers, protecting funds from unauthorized access while allowing programmatic payouts.

### Program Instructions

**Instructions Implemented:**

- **create_chama**: Initializes a new ROSCA group with specified parameters (name, contribution_amount, epoch_period, max_members). Sets the caller as admin, initializes empty member arrays, and sets the first epoch end time. Creates both Chama and implicit Vault PDAs.
- **join_chama**: Adds a new member to an existing group. Validates that the group isn't full, member isn't already joined, and group is active. Updates member count and adds member's public key to the members array with unclaimed status.
- **contribute**: Accepts exact contribution amount from a member for the current epoch. Validates member is in the group, hasn't contributed yet this round, and amount matches required contribution. Transfers SOL from member to vault PDA using system program transfer, then marks member as having claimed/contributed.
- **claim_round**: Distributes pooled funds to the current round's recipient after epoch ends. Validates epoch has ended and all members have contributed. Calculates recipient using round-robin (current_round % member_count), transfers funds from vault to recipient using CPI with PDA signing, increments round counter, resets contribution tracking, and sets new epoch end time.

### Account Structure

```rust
#[account]
pub struct Chama {
    pub admin: Pubkey,                  // Creator/administrator of the group
    pub name: String,                   // Unique identifier for the group
    pub contribution_amount: u64,       // Fixed amount each member contributes (lamports)
    pub epoch_period: i64,              // Duration of each round in seconds
    pub max_members: u8,                // Maximum number of participants allowed
    pub member_count: u8,               // Current number of members
    pub current_round: u32,             // Current payout round number
    pub total_rounds_completed: u32,    // Total successful payouts since creation
    pub epoch_end_time: i64,            // Unix timestamp when current epoch ends
    pub is_active: bool,                // Whether group is accepting contributions
    pub members: Vec<Pubkey>,           // List of all member wallet addresses
    pub member_claimed: Vec<bool>,      // Tracks contributions for current round
    pub bump: u8,                       // PDA bump seed for account derivation
}
```

## Testing

### Test Coverage

Comprehensive test suite covering all four instructions with multiple scenarios including successful operations, edge cases, and error conditions. Tests verify account initialization, state transitions, fund transfers, timing enforcement, and access control.

**Happy Path Tests:**

- **Create Chama**: Successfully creates a ROSCA group with valid parameters, initializes all fields correctly, and sets proper epoch timing
- **Join Chama**: Multiple members successfully join the group in sequence, member count increments correctly
- **Contribute**: All members contribute exact amounts, vault balance accumulates correctly, contribution tracking updates properly
- **Claim Round**: After epoch ends and all contributions made, claim successfully transfers pooled funds to correct recipient, resets for next round, increments counters

**Unhappy Path Tests:**

- **Create with Invalid Params**: Fails when max_members is 0 or 1, or when contribution_amount is 0
- **Join Full Chama**: Fails when attempting to join a group that has reached max_members
- **Duplicate Join**: Fails when a member tries to join the same group twice
- **Wrong Contribution Amount**: Fails when member sends incorrect SOL amount (too little or too much)
- **Early Claim**: Fails when trying to claim before epoch_end_time has passed
- **Incomplete Contributions**: Fails when trying to claim without all members having contributed
- **Unauthorized Access**: Fails when non-member tries to contribute

### Running Tests

```bash
cd anchor_project/circle
yarn install          # Install dependencies
anchor test          # Run full test suite on local validator
```

### Additional Notes for Evaluators

This project was inspired by traditional East African savings groups (Chamas) and aims to bring that trusted community finance model to Web3. The biggest technical challenge was implementing secure vault transfers using CPI with PDA signing - initially tried direct lamport manipulation which failed with ownership errors. Learning to use `invoke_signed` with proper PDA seeds was crucial. Another challenge was managing epoch timing and ensuring the round-robin distribution was truly fair and tamper-proof. The frontend uses Vite + React with Solana wallet adapters for a clean, modern user experience. The dApp is deployed on Devnet and ready for testing with faucet SOL.
