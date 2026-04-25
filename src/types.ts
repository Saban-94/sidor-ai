import { Timestamp } from 'firebase/firestore';

export interface Order {
  id?: string;
  orderNumber?: string;
  trackingId?: string;
  customerId?: string;
  date: string;
  time: string;
  driverId: string;
  customerName: string;
  customerPhone?: string;
  phone?: string; // Compatibility alias
  destination: string;
  items: string;
  warehouse: 'החרש' | 'התלמיד';
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  orderFormId?: string;
  deliveryNoteId?: string;
  totalAmount?: number;
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
  phone?: string; // Standardized field
  address?: string;
  totalOrders?: number;
  lastOrderAt?: Timestamp;
  driveFolderId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Reminder {
  id?: string;
  title: string;
  description?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime: string; // HH:mm
  reminderTime?: string; // ISO string for precise alert
  isCompleted: boolean;
  priority: 'low' | 'high' | 'urgent' | 'critical';
  isNagging: boolean;
  snoozeCount: number;
  ringtone: 'classic' | 'alert' | 'urgent' | 'digital' | string;
  status: 'active' | 'completed' | 'snoozed';
  orderId?: string;
  userId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface InventoryItem {
  id?: string;
  sku: string;
  name: string;
  description?: string;
  imageUrl?: string;
  unit: string;
  currentStock: number;
  minStock: number;
  price?: number;
  category?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SaleRecord {
  id?: string;
  itemId: string;
  itemName?: string;
  orderId?: string;
  customerName: string;
  quantity: number;
  date: string;
  priceAtSale?: number;
  createdAt?: Timestamp;
}
