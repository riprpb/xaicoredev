export type UserRole = 'ADMIN' | 'USER' | 'PREMIUM';

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  verified: boolean;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Wallet {
  id: string;
  userId: string;
  address: string;
  balance: number;
  chainId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  walletId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'TRADE';
  amount: number;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
  hash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Brain {
  id: string;
  userId: string;
  name: string;
  description?: string;
  type: 'NEURAL_NETWORK' | 'LLM' | 'HYBRID' | 'CUSTOM';
  status: 'ACTIVE' | 'INACTIVE' | 'TRAINING' | 'ERROR';
  config?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
