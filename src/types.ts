import { Timestamp } from 'firebase/firestore';

export interface Order {
  id?: string;
  orderNumber?: string;
  date: string;
  time: string;
  driverId: string;
  customerName: string;
  destination: string;
  items: string;
  warehouse: 'החרש' | 'התלמיד';
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  orderFormId?: string;
  deliveryNoteId?: string;
  eta?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  vehicleType: 'truck' | 'crane';
  plateNumber?: string;
  vehicleModel?: string;
  status: 'active' | 'off_duty';
  totalDeliveries?: number;
  onTimeRate?: number;
  rating?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Customer {
  id?: string;
  customerNumber: string;
  name: string;
  contactPerson: string;
  phoneNumber: string;
  driveFolderId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
