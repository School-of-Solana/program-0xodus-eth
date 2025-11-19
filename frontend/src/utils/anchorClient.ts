import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import idlJson from '../idl/circle.json';
import { PROGRAM_ID } from './constants';

if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

interface AnchorWallet {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>;
}

export const getProgram = (connection: Connection, wallet: AnchorWallet) => {
  const provider = new AnchorProvider(connection, wallet as any, {
    commitment: 'confirmed',
  });
  
  return new Program(idlJson as any, provider);
};

export const getChamaPDA = (name: string, admin: PublicKey): [PublicKey, number] => {
  const nameBuffer = typeof name === 'string' ? Buffer.from(name, 'utf-8') : name;
  return PublicKey.findProgramAddressSync(
    [Buffer.from('chama', 'utf-8'), nameBuffer, admin.toBuffer()],
    PROGRAM_ID
  );
};

export const getVaultPDA = (chama: PublicKey): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault', 'utf-8'), chama.toBuffer()],
    PROGRAM_ID
  );
};
