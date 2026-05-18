/**
/**
 * SabanOS Parallel Sync Protocol (v6.0)
 * Manages the connection between Firebase (Local Ops) and GAS Bridge (Master Archive)
 */

import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { GasService } from '../services/gasService';

export const SYNC_COLLECTIONS = [
  'users',
  'customers',
  'orders',
  'inventory',
  'drivers',
  'reminders',
  'smart_locations',
  'chat_sessions',
  'sales',
  'system_logs',
  'blackbox_logs',
  'site_profiles',
  'waze_links',
  'notifications',
  'auth_audit',
  'pto_records',
  'gps_tracks',
  'logistics_insights'
];

class DBBridge {
  /**
   * Universal Sync Trigger
   * Call after any successful Firestore write to sync with Master GAS DB
   */
  public async syncToMaster(collectionName: string, data: any, operation: 'CREATE' | 'UPDATE' | 'DELETE') {
    if (!SYNC_COLLECTIONS.includes(collectionName)) {
      console.warn(`Collection ${collectionName} is not part of the Parallel Sync Protocol.`);
      return;
    }

    try {
      // 1. Log to BlackBox for Audit
      await this.logBlackBox(collectionName, data, operation);

      // 2. Trigger GAS Bridge Sync
      await GasService.syncGeneric(collectionName, data, operation);

      console.log(`[SabanOS Sync] ${collectionName} synced successfully (${operation})`);
    } catch (err) {
      console.error(`[SabanOS Sync Error] Failed to sync ${collectionName}:`, err);
    }
  }

  private async logBlackBox(collectionName: string, data: any, operation: string) {
    try {
      const logId = `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      await setDoc(doc(db, 'blackbox_logs', logId), {
        timestamp: serverTimestamp(),
        collection: collectionName,
        operation,
        data: JSON.parse(JSON.stringify(data)), // Ensure serializable
        user: 'system_bridge'
      });
    } catch (e) {
      console.error("BlackBox logging failed", e);
    }
  }
}

export const dbBridge = new DBBridge();
