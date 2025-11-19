import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { SystemProgram } from '@solana/web3.js';
import { getProgram, getChamaPDA } from '../utils/anchorClient';
import { LAMPORTS_PER_SOL } from '../utils/constants';
import * as anchor from '@coral-xyz/anchor';

export const CreateChama = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  
  const [name, setName] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [epochPeriod, setEpochPeriod] = useState('');
  const [maxMembers, setMaxMembers] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const [chamaPDA] = getChamaPDA(name, wallet.publicKey);

      const tx = await program.methods
        .createChama(
          name,
          new anchor.BN(parseFloat(contributionAmount) * LAMPORTS_PER_SOL),
          new anchor.BN(parseInt(epochPeriod)),
          parseInt(maxMembers)
        )
        .accounts({
          chama: chamaPDA,
          admin: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setSuccess(`Chama created! Transaction: ${tx}`);
      setName('');
      setContributionAmount('');
      setEpochPeriod('');
      setMaxMembers('');
    } catch (err: any) {
      setError(`Error: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-chama">
      <h2>Create New Chama</h2>
      <form onSubmit={handleCreate}>
        <div className="form-group">
          <label>Chama Name:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
            placeholder="e.g., Friends ROSCA"
          />
        </div>
        
        <div className="form-group">
          <label>Contribution Amount (SOL):</label>
          <input
            type="number"
            step="0.01"
            value={contributionAmount}
            onChange={(e) => setContributionAmount(e.target.value)}
            required
            disabled={loading}
            placeholder="e.g., 0.1"
          />
        </div>
        
        <div className="form-group">
          <label>Epoch Period (seconds):</label>
          <input
            type="number"
            value={epochPeriod}
            onChange={(e) => setEpochPeriod(e.target.value)}
            required
            disabled={loading}
            placeholder="e.g., 86400 (1 day)"
          />
        </div>
        
        <div className="form-group">
          <label>Max Members:</label>
          <input
            type="number"
            min="2"
            max="10"
            value={maxMembers}
            onChange={(e) => setMaxMembers(e.target.value)}
            required
            disabled={loading}
            placeholder="e.g., 5"
          />
        </div>
        
        <button type="submit" disabled={loading || !wallet}>
          {loading ? 'Creating...' : 'Create Chama'}
        </button>
      </form>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
    </div>
  );
};
