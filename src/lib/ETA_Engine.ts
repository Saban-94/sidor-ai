import { Order, Driver } from '../types';

/**
 * Smarter ETA Calculation Engine
 * Factors in distance, driver status, and crane PTO mode.
 */
export class ETAEngine {
  // Average truck speed in city (km/h)
  private static AVG_SPEED = 35;
  // Buffer for loading/unloading (minutes)
  private static LOAD_BUFFER = 15;
  // Buffer for crane operation (minutes)
  private static CRANE_PTO_BUFFER = 20;

  /**
   * Refined ETA Calculation
   */
  static calculateRefinedETA(
    order: Order, 
    driver?: Driver, 
    currentCoords?: { lat: number, lng: number }
  ): { eta: string, progress: number, statusMessage: string } {
    
    // Default fallback
    if (!order.time) {
      return { eta: '--:--', progress: 0, statusMessage: 'ממתין לשיבוץ' };
    }

    let extraMinutes = 0;
    let statusMessage = "בטיפול";
    let progress = 0;

    // 1. Factor in Driver Status
    if (driver) {
      if (driver.status === 'off_duty') {
        return { eta: 'לא זמין', progress: 0, statusMessage: 'נהג לא במשמרת' };
      }

      // Check for specific "truck" status extensions (simulated via metadata or sub-status)
      // Since our Driver type is limited, we check statuses typically found in SabanOS
      const driverStatus = (driver as any).currentMobilityStatus || 'idle';
      
      if (driverStatus === 'loading') {
        extraMinutes += this.LOAD_BUFFER;
        statusMessage = "בהמסה במחסן";
        progress = 15;
      } else if (driverStatus === 'pto_active' && driver.vehicleType === 'crane') {
        extraMinutes += this.CRANE_PTO_BUFFER;
        statusMessage = "מנוף בפעולה (פריקה)";
        progress = 85;
      }
    }

    // 2. Distance Calculation (Haversine if GPS is available)
    if (currentCoords && (order as any).destinationCoords) {
      const dist = this.getDistance(
        currentCoords.lat, 
        currentCoords.lng, 
        (order as any).destinationCoords.lat, 
        (order as any).destinationCoords.lng
      );
      
      const travelTimeMinutes = (dist / this.AVG_SPEED) * 60;
      extraMinutes += travelTimeMinutes;
      
      // Dynamic progress
      if (order.status === 'on_the_way') {
          // Assume start distance was roughly 15km if not known
          const totalDist = 15; 
          progress = Math.min(95, Math.max(30, 100 - (dist / totalDist * 70)));
          statusMessage = `בדרך (מרחק: ${dist.toFixed(1)} ק"מ)`;
      }
    } else {
      // Fallback progress based on status
      const statusMap: Record<string, {p: number, m: string}> = {
        'pending': { p: 5, m: 'הזמנה נקלטה' },
        'preparing': { p: 25, m: 'בשלבי הכנה' },
        'ready': { p: 50, m: 'מוכן ליציאה' },
        'on_the_way': { p: 75, m: 'בדרך ליעד' },
        'delivered': { p: 100, m: 'סופק בהצלחה' }
      };
      const stage = statusMap[order.status] || statusMap.pending;
      progress = stage.p;
      statusMessage = stage.m;
    }

    // 3. Final Time Calc
    const now = new Date();
    const etaDate = new Date(now.getTime() + extraMinutes * 60000);
    const etaStr = etaDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });

    return { 
      eta: order.status === 'delivered' ? 'סופק' : (order.eta || etaStr), 
      progress, 
      statusMessage 
    };
  }

  private static getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  }

  private static deg2rad(deg: number) {
    return deg * (Math.PI / 180);
  }
}
