use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("8vHAoAwSX4QeQL4624iRMRWt8gKgHRgb1rJFqDK917we");

#[program]
pub mod circle {
    use super::*;

    /// Create a new Chama (ROSCA group)
    pub fn create_chama(
        ctx: Context<CreateChama>,
        name: String,
        contribution_amount: u64,
        epoch_period: i64, // in seconds
        max_members: u8,
    ) -> Result<()> {
        require!(name.len() <= 32, ChamaError::NameTooLong);
        require!(
            contribution_amount > 0,
            ChamaError::InvalidContributionAmount
        );
        require!(
            max_members >= 2 && max_members <= 20,
            ChamaError::InvalidMaxMembers
        );
        require!(epoch_period >= 60, ChamaError::EpochTooShort);

        let chama = &mut ctx.accounts.chama;
        chama.admin = ctx.accounts.admin.key();
        chama.name = name;
        chama.contribution_amount = contribution_amount;
        chama.epoch_period = epoch_period;
        chama.max_members = max_members;
        chama.member_count = 1;
        chama.current_round = 0;
        chama.total_rounds_completed = 0;
        chama.epoch_end_time = 0;
        chama.is_active = false;
        chama.members = Vec::new();
        chama.members.push(ctx.accounts.admin.key());
        chama.member_claimed = Vec::new();
        chama.member_claimed.push(false);
        chama.bump = ctx.bumps.chama;

        msg!("Chama created: {}", chama.name);
        msg!("Admin: {}", chama.admin);
        msg!(
            "Contribution amount: {} lamports",
            chama.contribution_amount
        );
        msg!("Epoch period: {} seconds", chama.epoch_period);

        Ok(())
    }

    /// Join an existing Chama
    pub fn join_chama(ctx: Context<JoinChama>) -> Result<()> {
        let chama = &mut ctx.accounts.chama;

        require!(!chama.is_active, ChamaError::ChamaAlreadyActive);
        require!(
            chama.member_count < chama.max_members,
            ChamaError::ChamaFull
        );

        let member_key = ctx.accounts.member.key();
        require!(
            !chama.members.contains(&member_key),
            ChamaError::MemberAlreadyJoined
        );

        chama.members.push(member_key);
        chama.member_claimed.push(false);
        chama.member_count += 1;

        if chama.member_count == chama.max_members {
            chama.is_active = true;
            let clock = Clock::get()?;
            chama.epoch_end_time = clock.unix_timestamp + chama.epoch_period;
            msg!(
                "Chama is now active! First epoch ends at: {}",
                chama.epoch_end_time
            );
        }

        msg!("Member {} joined the chama", member_key);
        msg!(
            "Current member count: {}/{}",
            chama.member_count,
            chama.max_members
        );

        Ok(())
    }

    pub fn contribute(ctx: Context<Contribute>) -> Result<()> {
        let chama = &ctx.accounts.chama;
        let member = &ctx.accounts.member;

        require!(chama.is_active, ChamaError::ChamaNotActive);

        let member_key = member.key();
        require!(chama.members.contains(&member_key), ChamaError::NotAMember);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp < chama.epoch_end_time,
            ChamaError::EpochEnded
        );

        let transfer_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: member.to_account_info(),
                to: ctx.accounts.chama_vault.to_account_info(),
            },
        );
        system_program::transfer(transfer_ctx, chama.contribution_amount)?;

        msg!(
            "Member {} contributed {} lamports",
            member_key,
            chama.contribution_amount
        );

        Ok(())
    }

    pub fn claim_round(ctx: Context<ClaimRound>) -> Result<()> {
        let chama = &mut ctx.accounts.chama;

        require!(chama.is_active, ChamaError::ChamaNotActive);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= chama.epoch_end_time,
            ChamaError::EpochNotEnded
        );

        let recipient_index = (chama.current_round as usize) % (chama.max_members as usize);
        let recipient = chama.members[recipient_index];

        require!(
            !chama.member_claimed[recipient_index],
            ChamaError::MemberAlreadyClaimed
        );

        let vault_balance = ctx.accounts.chama_vault.lamports();
        let rent = Rent::get()?;
        let rent_exempt_minimum = rent.minimum_balance(0);

        let amount_to_transfer = vault_balance.saturating_sub(rent_exempt_minimum);

        require!(amount_to_transfer > 0, ChamaError::InsufficientFunds);

        chama.member_claimed[recipient_index] = true;

        let chama_key = chama.key();
        let vault_bump = ctx.bumps.chama_vault;
        let vault_seeds: &[&[u8]] = &[b"vault", chama_key.as_ref(), &[vault_bump]];
        let signer_seeds = &[vault_seeds];

        let transfer_instruction = system_program::Transfer {
            from: ctx.accounts.chama_vault.to_account_info(),
            to: ctx.accounts.recipient.to_account_info(),
        };

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            transfer_instruction,
            signer_seeds,
        );

        system_program::transfer(cpi_context, amount_to_transfer)?;

        let claimed_round = chama.current_round;

        chama.current_round += 1;

        if chama.current_round as u8 >= chama.max_members {
            chama.total_rounds_completed += 1;
            chama.current_round = 0;
            chama.member_claimed = vec![false; chama.max_members as usize];
            msg!(
                "Cycle {} completed! Starting new cycle.",
                chama.total_rounds_completed
            );
        }

        chama.epoch_end_time = clock.unix_timestamp + chama.epoch_period;

        msg!("Round {} claimed by {}", claimed_round, recipient);
        msg!("Amount disbursed: {} lamports", amount_to_transfer);
        msg!("Next epoch ends at: {}", chama.epoch_end_time);

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateChama<'info> {
    #[account(
        init,
        payer = admin,
        space = Chama::space(&name, 20),
        seeds = [b"chama", name.as_bytes(), admin.key().as_ref()],
        bump
    )]
    pub chama: Account<'info, Chama>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinChama<'info> {
    #[account(mut)]
    pub chama: Account<'info, Chama>,

    pub member: Signer<'info>,
}

#[derive(Accounts)]
pub struct Contribute<'info> {
    #[account(mut)]
    pub chama: Account<'info, Chama>,

    #[account(mut)]
    pub member: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", chama.key().as_ref()],
        bump
    )]
    pub chama_vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRound<'info> {
    #[account(mut)]
    pub chama: Account<'info, Chama>,

    /// CHECK: This is the vault PDA that holds contributions
    #[account(
        mut,
        seeds = [b"vault", chama.key().as_ref()],
        bump
    )]
    pub chama_vault: AccountInfo<'info>,

    #[account(mut)]
    pub recipient: AccountInfo<'info>,

    pub caller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// Account Structures

#[account]
pub struct Chama {
    pub admin: Pubkey,               // 32 bytes
    pub name: String,                // 4 + name length
    pub contribution_amount: u64,    // 8 bytes
    pub epoch_period: i64,           // 8 bytes (in seconds)
    pub max_members: u8,             // 1 byte
    pub member_count: u8,            // 1 byte
    pub current_round: u32,          // 4 bytes
    pub total_rounds_completed: u32, // 4 bytes
    pub epoch_end_time: i64,         // 8 bytes
    pub is_active: bool,             // 1 byte
    pub members: Vec<Pubkey>,        // 4 + (32 * max_members)
    pub member_claimed: Vec<bool>,   // 4 + (1 * max_members)
    pub bump: u8,                    // 1 byte
}

impl Chama {
    pub fn space(name: &str, max_members: u8) -> usize {
        8 +   // discriminator
        32 +  // admin
        4 + name.len() + // name with length prefix
        8 +   // contribution_amount
        8 +   // epoch_period
        1 +   // max_members
        1 +   // member_count
        4 +   // current_round
        4 +   // total_rounds_completed
        8 +   // epoch_end_time
        1 +   // is_active
        4 + (32 * max_members as usize) + // members vector
        4 + (1 * max_members as usize) +  // member_claimed vector
        1 +   // bump
        64 // padding for safety
    }
}

// Errors

#[error_code]
pub enum ChamaError {
    #[msg("Chama name is too long (max 32 characters)")]
    NameTooLong,

    #[msg("Contribution amount must be greater than 0")]
    InvalidContributionAmount,

    #[msg("Max members must be between 2 and 20")]
    InvalidMaxMembers,

    #[msg("Epoch period must be at least 60 seconds")]
    EpochTooShort,

    #[msg("Chama is already full")]
    ChamaFull,

    #[msg("Member has already joined this chama")]
    MemberAlreadyJoined,

    #[msg("Chama is not active yet (not all members have joined)")]
    ChamaNotActive,

    #[msg("Not a member of this chama")]
    NotAMember,

    #[msg("Epoch has ended, cannot contribute")]
    EpochEnded,

    #[msg("Epoch has not ended yet, cannot claim")]
    EpochNotEnded,

    #[msg("Member has already claimed in this cycle")]
    MemberAlreadyClaimed,

    #[msg("Chama is already active")]
    ChamaAlreadyActive,

    #[msg("Insufficient funds in vault")]
    InsufficientFunds,
}
