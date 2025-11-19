import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getProgram, getChamaPDA, getVaultPDA } from '../utils/anchorClient';
import { LAMPORTS_PER_SOL, formatTimeRemaining, shortenAddress } from '../utils/constants';
import * as anchor from '@coral-xyz/anchor';

interface ChamaData {
  admin: PublicKey;
  name: string;
  contributionAmount: anchor.BN;
  epochPeriod: anchor.BN;
  maxMembers: number;
  memberCount: number;
  currentRound: number;
  totalRoundsCompleted: number;
  epochEndTime: anchor.BN;
  isActive: boolean;
  members: PublicKey[];
  memberClaimed: boolean[];
  bump: number;
}

export const ViewChama = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  
  const [chamaAddress, setChamaAddress] = useState('');
  const [chamaData, setChamaData] = useState<ChamaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (chamaData) {
      const interval = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        const remaining = chamaData.epochEndTime.toNumber() - now;
        setTimeRemaining(remaining > 0 ? remaining : 0);
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [chamaData]);

  const handleFetch = async () => {
    setError('');
    setSuccess('');
    
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
      setError('Please connect your wallet');
      return;
    }

    try {
      setLoading(true);
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
      };
      const program = getProgram(connection, anchorWallet as any);
      const chamaPubkey = new PublicKey(chamaAddress);
      
      const data = await (program.account as any).chama.fetch(chamaPubkey) as ChamaData;
      setChamaData(data);
    } catch (err: any) {
      setError(`Error: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    setError('');
    setSuccess('');
    
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions || !chamaData) return;

    try {
      setLoading(true);
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
      };
      const program = getProgram(connection, anchorWallet as any);
      const chamaPubkey = new PublicKey(chamaAddress);

      const tx = await program.methods
        .joinChama()
        .accounts({
          chama: chamaPubkey,
          member: wallet.publicKey,
        })
        .rpc();

      setSuccess(`Joined chama! Transaction: ${tx}`);
      await handleFetch();
    } catch (err: any) {
      setError(`Error: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleContribute = async () => {
    setError('');
    setSuccess('');
    
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions || !chamaData) return;

    try {
      setLoading(true);
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
      };
      const program = getProgram(connection, anchorWallet as any);
      const chamaPubkey = new PublicKey(chamaAddress);
      const [vaultPDA] = getVaultPDA(chamaPubkey);

      const tx = await program.methods
        .contribute()
        .accounts({
          chama: chamaPubkey,
          member: wallet.publicKey,
          chamaVault: vaultPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setSuccess(`Contribution made! Transaction: ${tx}`);
      await handleFetch();
    } catch (err: any) {
      setError(`Error: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    setError('');
    setSuccess('');
    
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions || !chamaData) return;

    try {
      setLoading(true);
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
      };
      const program = getProgram(connection, anchorWallet as any);
      const chamaPubkey = new PublicKey(chamaAddress);
      const [vaultPDA] = getVaultPDA(chamaPubkey);
      
      const currentRecipientIndex = chamaData.currentRound % chamaData.memberCount;
      const recipient = chamaData.members[currentRecipientIndex];

      const tx = await program.methods
        .claimRound()
        .accounts({
          chama: chamaPubkey,
          chamaVault: vaultPDA,
          recipient: recipient,
          caller: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setSuccess(`Round claimed! Transaction: ${tx}`);
      await handleFetch();
    } catch (err: any) {
      setError(`Error: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isMember = chamaData && wallet.publicKey && 
    chamaData.members.some(m => m.toString() === wallet.publicKey!.toString());
  
  const canClaim = chamaData && timeRemaining === 0 && chamaData.isActive;

  return (
    <div className="view-chama">
      <h2>View Chama</h2>
      
      <div className="chama-search">
        <input
          type="text"
          value={chamaAddress}
          onChange={(e) => setChamaAddress(e.target.value)}
          placeholder="Enter Chama Address"
          disabled={loading}
        />
        <button onClick={handleFetch} disabled={loading || !wallet}>
          {loading ? 'Loading...' : 'Fetch Chama'}
        </button>
      </div>

      {chamaData && (
        <div className="chama-details">
          <h3>{chamaData.name}</h3>
          
          <div className="info-row">
            <span>Admin:</span>
            <span>{shortenAddress(chamaData.admin.toString())}</span>
          </div>
          
          <div className="info-row">
            <span>Contribution Amount:</span>
            <span>{chamaData.contributionAmount.toNumber() / LAMPORTS_PER_SOL} SOL</span>
          </div>
          
          <div className="info-row">
            <span>Epoch Period:</span>
            <span>{chamaData.epochPeriod.toNumber()}s</span>
          </div>
          
          <div className="info-row">
            <span>Members:</span>
            <span>{chamaData.memberCount} / {chamaData.maxMembers}</span>
          </div>
          
          <div className="info-row">
            <span>Current Round:</span>
            <span>{chamaData.currentRound}</span>
          </div>
          
          <div className="info-row">
            <span>Total Rounds Completed:</span>
            <span>{chamaData.totalRoundsCompleted}</span>
          </div>
          
          <div className="info-row">
            <span>Status:</span>
            <span>{chamaData.isActive ? 'Active' : 'Inactive'}</span>
          </div>
          
          <div className="info-row">
            <span>Time Remaining:</span>
            <span>{formatTimeRemaining(timeRemaining)}</span>
          </div>

          <div className="members-list">
            <h4>Members:</h4>
            {chamaData.members.map((member, i) => (
              <div key={i} className="member-item">
                {shortenAddress(member.toString())}
                {chamaData.memberClaimed[i] && ' ✓ (Claimed)'}
              </div>
            ))}
          </div>

          <div className="actions">
            {!isMember && chamaData.memberCount < chamaData.maxMembers && wallet.publicKey && (
              <button onClick={handleJoin} disabled={loading}>
                Join Chama
              </button>
            )}
            
            {isMember && wallet.publicKey && (
              <>
                <button onClick={handleContribute} disabled={loading}>
                  Contribute
                </button>
                
                {canClaim && (
                  <button onClick={handleClaim} disabled={loading}>
                    Claim Round
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
    </div>
  );
};
