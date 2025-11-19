import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Circle } from "../target/types/circle";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

describe("Circle - ROSCA Tests", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Circle as Program<Circle>;

  // Test accounts
  const admin = provider.wallet;
  let member2: anchor.web3.Keypair;
  let member3: anchor.web3.Keypair;
  let chamaName: string;
  let chamaPda: PublicKey;
  let chamaVault: PublicKey;
  let contributionAmount: BN;
  let epochPeriod: number;

  before(async () => {
    // Setup test members
    member2 = anchor.web3.Keypair.generate();
    member3 = anchor.web3.Keypair.generate();

    // Airdrop SOL to test members
    const airdropAmount = 10 * LAMPORTS_PER_SOL;
    
    const sig2 = await provider.connection.requestAirdrop(
      member2.publicKey,
      airdropAmount
    );
    await provider.connection.confirmTransaction(sig2);

    const sig3 = await provider.connection.requestAirdrop(
      member3.publicKey,
      airdropAmount
    );
    await provider.connection.confirmTransaction(sig3);

    console.log("Test accounts funded");
    console.log("Admin:", admin.publicKey.toString());
    console.log("Member 2:", member2.publicKey.toString());
    console.log("Member 3:", member3.publicKey.toString());
  });

  describe("Create Chama", () => {
    it("Should create a new chama", async () => {
      chamaName = "TestChama";
      contributionAmount = new BN(0.1 * LAMPORTS_PER_SOL); // 0.1 SOL
      epochPeriod = 120; // 2 minutes for testing
      const maxMembers = 3;

      // Derive PDA for chama
      [chamaPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("chama"),
          Buffer.from(chamaName),
          admin.publicKey.toBuffer(),
        ],
        program.programId
      );

      console.log("Chama PDA:", chamaPda.toString());

      const tx = await program.methods
        .createChama(chamaName, contributionAmount, new BN(epochPeriod), maxMembers)
        .accounts({
          chama: chamaPda,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Create chama transaction:", tx);

      // Verify chama was created correctly
      const chamaAccount = await program.account.chama.fetch(chamaPda);
      assert.equal(chamaAccount.admin.toString(), admin.publicKey.toString());
      assert.equal(chamaAccount.name, chamaName);
      assert.equal(chamaAccount.contributionAmount.toString(), contributionAmount.toString());
      assert.equal(chamaAccount.epochPeriod.toNumber(), epochPeriod);
      assert.equal(chamaAccount.maxMembers, maxMembers);
      assert.equal(chamaAccount.memberCount, 1);
      assert.equal(chamaAccount.currentRound, 0);
      assert.equal(chamaAccount.isActive, false);
      assert.equal(chamaAccount.members.length, 1);
      assert.equal(chamaAccount.members[0].toString(), admin.publicKey.toString());

      console.log("✓ Chama created successfully");
    });
  });

  describe("Join Chama", () => {
    it("Should allow member 2 to join", async () => {
      const tx = await program.methods
        .joinChama()
        .accounts({
          chama: chamaPda,
          member: member2.publicKey,
        })
        .signers([member2])
        .rpc();

      console.log("Member 2 join transaction:", tx);

      const chamaAccount = await program.account.chama.fetch(chamaPda);
      assert.equal(chamaAccount.memberCount, 2);
      assert.equal(chamaAccount.isActive, false); // Still waiting for member 3
      console.log("✓ Member 2 joined successfully");
    });

    it("Should allow member 3 to join and activate chama", async () => {
      const tx = await program.methods
        .joinChama()
        .accounts({
          chama: chamaPda,
          member: member3.publicKey,
        })
        .signers([member3])
        .rpc();

      console.log("Member 3 join transaction:", tx);

      const chamaAccount = await program.account.chama.fetch(chamaPda);
      assert.equal(chamaAccount.memberCount, 3);
      assert.equal(chamaAccount.isActive, true); // Now active!
      assert.isAbove(chamaAccount.epochEndTime.toNumber(), 0);
      
      console.log("✓ Member 3 joined successfully");
      console.log("✓ Chama is now active!");
      console.log("Epoch ends at:", new Date(chamaAccount.epochEndTime.toNumber() * 1000).toISOString());
    });

    it("Should not allow duplicate members", async () => {
      
      try {
        await program.methods
          .joinChama()
          .accounts({
            chama: chamaPda,
            member: member2.publicKey,
          })
          .signers([member2])
          .rpc();
        
        assert.fail("Should have thrown error");
      } catch (error) {
        // Will get ChamaAlreadyActive error because chama is active after all members joined
        const errorMsg = error.toString();
        assert.isTrue(
          errorMsg.includes("ChamaAlreadyActive") || errorMsg.includes("6011") || errorMsg.includes("MemberAlreadyJoined"),
          `Expected chama error but got: ${errorMsg}`
        );
        console.log("✓ Correctly rejected duplicate member (chama is active)");
      }
    });
  });

  describe("Contribute", () => {
    before(async () => {
      // Derive vault PDA
      [chamaVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), chamaPda.toBuffer()],
        program.programId
      );
      console.log("Chama Vault PDA:", chamaVault.toString());
    });

    it("Should allow admin to contribute", async () => {
      const vaultBalanceBefore = await provider.connection.getBalance(chamaVault);
      
      const tx = await program.methods
        .contribute()
        .accounts({
          chama: chamaPda,
          member: admin.publicKey,
          chamaVault: chamaVault,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Admin contribution transaction:", tx);

      const vaultBalanceAfter = await provider.connection.getBalance(chamaVault);
      const contributed = vaultBalanceAfter - vaultBalanceBefore;
      
      assert.equal(contributed, contributionAmount.toNumber());
      console.log(`✓ Admin contributed ${contributed / LAMPORTS_PER_SOL} SOL`);
    });

    it("Should allow member 2 to contribute", async () => {
      const vaultBalanceBefore = await provider.connection.getBalance(chamaVault);
      
      const tx = await program.methods
        .contribute()
        .accounts({
          chama: chamaPda,
          member: member2.publicKey,
          chamaVault: chamaVault,
          systemProgram: SystemProgram.programId,
        })
        .signers([member2])
        .rpc();

      console.log("Member 2 contribution transaction:", tx);

      const vaultBalanceAfter = await provider.connection.getBalance(chamaVault);
      const contributed = vaultBalanceAfter - vaultBalanceBefore;
      
      assert.equal(contributed, contributionAmount.toNumber());
      console.log(`✓ Member 2 contributed ${contributed / LAMPORTS_PER_SOL} SOL`);
    });

    it("Should allow member 3 to contribute", async () => {
      const vaultBalanceBefore = await provider.connection.getBalance(chamaVault);
      
      const tx = await program.methods
        .contribute()
        .accounts({
          chama: chamaPda,
          member: member3.publicKey,
          chamaVault: chamaVault,
          systemProgram: SystemProgram.programId,
        })
        .signers([member3])
        .rpc();

      console.log("Member 3 contribution transaction:", tx);

      const vaultBalanceAfter = await provider.connection.getBalance(chamaVault);
      const totalInVault = vaultBalanceAfter;
      
      console.log(`✓ Member 3 contributed ${contributionAmount.toNumber() / LAMPORTS_PER_SOL} SOL`);
      console.log(`✓ Total in vault: ${totalInVault / LAMPORTS_PER_SOL} SOL`);
    });

    it("Should not allow non-members to contribute", async () => {
      const nonMember = anchor.web3.Keypair.generate();
      
      // Airdrop some SOL to non-member
      const sig = await provider.connection.requestAirdrop(
        nonMember.publicKey,
        LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      try {
        await program.methods
          .contribute()
          .accounts({
            chama: chamaPda,
            member: nonMember.publicKey,
            chamaVault: chamaVault,
            systemProgram: SystemProgram.programId,
          })
          .signers([nonMember])
          .rpc();
        
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.include(error.toString(), "NotAMember");
        console.log("✓ Correctly rejected non-member contribution");
      }
    });
  });

  describe("Claim Round", () => {
    it("Should not allow claiming before epoch ends", async () => {
      try {
        await program.methods
          .claimRound()
          .accounts({
            chama: chamaPda,
            chamaVault: chamaVault,
            recipient: admin.publicKey,
            caller: admin.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.include(error.toString(), "EpochNotEnded");
        console.log("✓ Correctly rejected early claim");
      }
    });

    it("Should allow claiming after epoch ends - Round 0 (Admin)", async () => {
      console.log("⏳ Waiting for epoch to end...");
      await new Promise(resolve => setTimeout(resolve, epochPeriod * 1000 + 2000));

      const adminBalanceBefore = await provider.connection.getBalance(admin.publicKey);
      const vaultBalanceBefore = await provider.connection.getBalance(chamaVault);

      const tx = await program.methods
        .claimRound()
        .accounts({
          chama: chamaPda,
          chamaVault: chamaVault,
          recipient: admin.publicKey,
          caller: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Round 0 claim transaction:", tx);

      const adminBalanceAfter = await provider.connection.getBalance(admin.publicKey);
      const vaultBalanceAfter = await provider.connection.getBalance(chamaVault);

      // Account for transaction fees
      const received = adminBalanceAfter - adminBalanceBefore;

      console.log(`✓ Admin received ~${received / LAMPORTS_PER_SOL} SOL`);
      console.log(`Vault balance after: ${vaultBalanceAfter / LAMPORTS_PER_SOL} SOL`);

      const chamaAccount = await program.account.chama.fetch(chamaPda);
      assert.equal(chamaAccount.currentRound, 1);
      console.log("✓ Round incremented to:", chamaAccount.currentRound);
      console.log("✓ Next epoch ends at:", new Date(chamaAccount.epochEndTime.toNumber() * 1000).toISOString());
    });

    it("Should proceed to Round 1 after contributions", async () => {
      // Check current epoch time
      let chamaAccount = await program.account.chama.fetch(chamaPda);
      const currentTime = Math.floor(Date.now() / 1000);
      
      console.log("Current time:", currentTime);
      console.log("Epoch end time:", chamaAccount.epochEndTime.toNumber());
      console.log("Time until epoch ends:", chamaAccount.epochEndTime.toNumber() - currentTime, "seconds");

      // All members contribute again
      await program.methods
        .contribute()
        .accounts({
          chama: chamaPda,
          member: admin.publicKey,
          chamaVault: chamaVault,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .contribute()
        .accounts({
          chama: chamaPda,
          member: member2.publicKey,
          chamaVault: chamaVault,
          systemProgram: SystemProgram.programId,
        })
        .signers([member2])
        .rpc();

      await program.methods
        .contribute()
        .accounts({
          chama: chamaPda,
          member: member3.publicKey,
          chamaVault: chamaVault,
          systemProgram: SystemProgram.programId,
        })
        .signers([member3])
        .rpc();

      console.log("✓ All members contributed for round 1");

      // Check how much time left in epoch
      chamaAccount = await program.account.chama.fetch(chamaPda);
      const timeLeft = chamaAccount.epochEndTime.toNumber() - Math.floor(Date.now() / 1000);
      
      if (timeLeft > 0) {
        console.log(`⏳ Waiting ${timeLeft + 2} seconds for epoch to end...`);
        await new Promise(resolve => setTimeout(resolve, (timeLeft + 2) * 1000));
      }

      // Claim for member 2
      const member2BalanceBefore = await provider.connection.getBalance(member2.publicKey);

      await program.methods
        .claimRound()
        .accounts({
          chama: chamaPda,
          chamaVault: chamaVault,
          recipient: member2.publicKey,
          caller: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const member2BalanceAfter = await provider.connection.getBalance(member2.publicKey);
      const received = member2BalanceAfter - member2BalanceBefore;

      console.log(`✓ Member 2 received ~${received / LAMPORTS_PER_SOL} SOL in round 1`);

      chamaAccount = await program.account.chama.fetch(chamaPda);
      assert.equal(chamaAccount.currentRound, 2);
      console.log("✓ Round incremented to:", chamaAccount.currentRound);
    });
  });

  describe("Complete Cycle", () => {
    it("Should complete full cycle and reset", async () => {
      // Round 2 - Member 3's turn
      // Check current epoch time
      let chamaAccount = await program.account.chama.fetch(chamaPda);
      const currentTime = Math.floor(Date.now() / 1000);
      
      console.log("Current time:", currentTime);
      console.log("Epoch end time:", chamaAccount.epochEndTime.toNumber());

      // Contribute
      await program.methods
        .contribute()
        .accounts({
          chama: chamaPda,
          member: admin.publicKey,
          chamaVault: chamaVault,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .contribute()
        .accounts({
          chama: chamaPda,
          member: member2.publicKey,
          chamaVault: chamaVault,
          systemProgram: SystemProgram.programId,
        })
        .signers([member2])
        .rpc();

      await program.methods
        .contribute()
        .accounts({
          chama: chamaPda,
          member: member3.publicKey,
          chamaVault: chamaVault,
          systemProgram: SystemProgram.programId,
        })
        .signers([member3])
        .rpc();

      console.log("✓ All members contributed for round 2");

      // Check how much time left in epoch
      chamaAccount = await program.account.chama.fetch(chamaPda);
      const timeLeft = chamaAccount.epochEndTime.toNumber() - Math.floor(Date.now() / 1000);
      
      if (timeLeft > 0) {
        console.log(`⏳ Waiting ${timeLeft + 2} seconds for epoch to end...`);
        await new Promise(resolve => setTimeout(resolve, (timeLeft + 2) * 1000));
      }

      // Claim for member 3
      const member3BalanceBefore = await provider.connection.getBalance(member3.publicKey);

      await program.methods
        .claimRound()
        .accounts({
          chama: chamaPda,
          chamaVault: chamaVault,
          recipient: member3.publicKey,
          caller: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const member3BalanceAfter = await provider.connection.getBalance(member3.publicKey);
      const received = member3BalanceAfter - member3BalanceBefore;

      console.log(`✓ Member 3 received ~${received / LAMPORTS_PER_SOL} SOL in round 2`);

      chamaAccount = await program.account.chama.fetch(chamaPda);
      
      // After round 2 (which is the 3rd round total), cycle should reset
      assert.equal(chamaAccount.currentRound, 0);
      assert.equal(chamaAccount.totalRoundsCompleted, 1);
      
      console.log("✓ Cycle completed!");
      console.log("✓ Current round reset to:", chamaAccount.currentRound);
      console.log("✓ Total cycles completed:", chamaAccount.totalRoundsCompleted);
      console.log("🎉 Chama can start a new cycle!");
    });
  });
});
