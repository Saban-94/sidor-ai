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
  status: 'pending' | 'preparing' | 'ready' | 'on_the_way' | 'delivered' | 'cancelled';
  orderFormId?: string;
  deliveryNoteId?: string;
  documentIds?: string[];
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

export interface SiteProfile {
  siteName: string;
  address: string;
  wazeLink?: string;
  contactPerson?: string;
  unloadingRequirements?: string;
}

export interface Customer {
  id?: string;
  customerNumber: string;
  name: string;
  contactPerson: string;
  phoneNumber: string;
  phone?: string; 
  email?: string;
  address?: string;
  totalOrders?: number;
  lastOrderAt?: Timestamp;
  driveFolderId?: string;
  wazeLinks?: Record<string, string>; // Map of site names to Waze links
  unloadingRequirements?: string;
  historicalTrends?: string;
  siteProfiles?: SiteProfile[];
  lastInteraction?: string;
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
  videoUrl?: string; // Multimedia section: How-to videos
  unit: string;
  currentStock: number;
  minStock: number;
  price?: number;
  category?: string;
  // Technical Specs
  dryingTime?: string;
  coverage?: string;
  applicationMethod?: string;
  // Ecosystem
  relatedProducts?: string[]; // SKUs of related products
  upsellItems?: string[]; // SKUs of upsell items
  // Insights
  noaInsight?: string;
  demandTrend?: 'rising' | 'falling' | 'stable';
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
  originWarehouse?: string; 
  isSpecialOrder?: boolean; // New field
  createdAt?: Timestamp;
}

export interface OrderItem {
  id?: string;
  orderId: string;
  sku: string;
  name: string;
  quantity: number;
  price?: number;
  originWarehouse: 'החרש' | 'התלמיד' | 'חיצוני';
  status: 'pending' | 'supplied' | 'shortage';
  createdAt: Timestamp;
}

export interface UserProfile {
  id: string; // 4 digits
  name: string;
  phone: string;
  email: string;
  role: string;
  avatarUrl: string;
  lastSeen: any;
  isTyping?: boolean;
  typingTo?: string;
  lastTyped?: any;
  hasUnread?: boolean;
  lastReadChat?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface TeamChatMessage {
  id?: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  imageUrl?: string;
  fileUrl?: string;
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  type?: 'text' | 'image' | 'file';
  mentionedUserIds?: string[];
  priority?: 'normal' | 'urgent';
  timestamp: any;
  recipientId?: string; // Optional for private team messages
}

export interface SmartLocation {
  id?: string;
  address: string;
  normalizedAddress: string;
  totalDeliveries: number;
  averageUnloadingTime: number; // in minutes
  bestDriverId?: string;
  typicalArrivalTime?: string; // HH:mm
  hasPTOHistory: boolean;
  ptoAverageDuration?: number;
  customerNotes?: string[];
  lastDeliveryAt?: any;
}

export interface ChatSession {
  id: string;
  title: string;
  lastMessage?: string;
  createdAt: any;
  updatedAt: any;
  userId: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'model' | 'assistant';
  parts: { text: string }[];
  timestamp: any;
  sessionId?: string;
}
