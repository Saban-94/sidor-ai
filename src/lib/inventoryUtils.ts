import { InventoryItem, SaleRecord } from '../types';

export interface ProductStats extends InventoryItem {
  totalSold: number;
  totalRevenue: number;
}

/**
 * Calculates real-time sales stats for each product and identifies top sellers.
 */
export const calculateInventoryStats = (
  items: InventoryItem[],
  sales: SaleRecord[]
): { topProducts: ProductStats[]; allStats: ProductStats[] } => {
  const statsMap = new Map<string, { totalSold: number; totalRevenue: number }>();

  // Aggregate sales by item ID (SKU)
  sales.forEach((sale) => {
    const sku = sale.itemId;
    const current = statsMap.get(sku) || { totalSold: 0, totalRevenue: 0 };
    
    const quantity = Number(sale.quantity) || 0;
    const price = Number(sale.priceAtSale) || 0;
    
    statsMap.set(sku, {
      totalSold: current.totalSold + quantity,
      totalRevenue: current.totalRevenue + (quantity * price),
    });
  });

  // Map back to item objects
  const allStats: ProductStats[] = items.map((item) => {
    const stats = statsMap.get(item.sku) || { totalSold: 0, totalRevenue: 0 };
    return {
      ...item,
      totalSold: stats.totalSold,
      totalRevenue: stats.totalRevenue,
    };
  });

  // Sort by total sold for top products
  const topProducts = [...allStats]
    .filter((p) => p.totalSold > 0)
    .sort((a, b) => b.totalSold - a.totalSold)
    .slice(0, 5); // Take top 5

  return { topProducts, allStats };
};
