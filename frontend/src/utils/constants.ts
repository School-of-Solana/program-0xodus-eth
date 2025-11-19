import { PublicKey } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('8vHAoAwSX4QeQL4624iRMRWt8gKgHRgb1rJFqDK917we');

export const LAMPORTS_PER_SOL = 1000000000;

export const formatTimeRemaining = (seconds: number): string => {
  if (seconds <= 0) return 'Epoch ended';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

export const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleString();
};

export const shortenAddress = (address: string, chars = 4): string => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};
