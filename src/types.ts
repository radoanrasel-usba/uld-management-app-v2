export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  role: 'admin' | 'user' | 'visitor';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface ULD {
  id: number;
  number: string;
  type: 'AKE' | 'PMC';
  status: 'ACTIVE' | 'DAMAGED';
  currentStation: string;
  createdAt: string;
  updatedAt: string;
}

export interface ULDHistory {
  id: number;
  uldId: number | null;
  uldNumber: string;
  action: 'CREATE' | 'REMOVE' | 'SEND' | 'RECEIVE' | 'STATUS_CHANGE';
  originStation: string | null;
  destinationStation: string | null;
  performedBy: string;
  timestamp: string;
  remarks: string | null;
}

export interface UserLog {
  id: number;
  userEmail: string;
  action: string;
  status: 'SUCCESS' | 'FAILURE' | 'ALERT' | 'SUSPICIOUS';
  ipAddress: string | null;
  details: string | null;
  timestamp: string;
}

export interface DBBackup {
  id: number;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  data?: string; // Serialized tables
}

export const STATIONS = [
  'DAC', 'KUL', 'SIN', 'DXB', 'SHJ', 'CAN', 'MAA', 'RUH', 'JED', 'MCT', 'MLE', 'CCU', 'DOH', 'AUH'
] as const;

export type StationCode = typeof STATIONS[number];
