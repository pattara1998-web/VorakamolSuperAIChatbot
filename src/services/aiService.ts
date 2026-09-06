import * as dbService from './database.js';

/**
 * AI Service - Product context fetcher for AI prompts.
 * Uses SQLite database via the database service layer.
 */

interface ProductContext {
  name: string;
  description: string;
  price: number;
  category: string;
}

export async function getProductContext(pageId: string): Promise<ProductContext[]> {
  try {
    const products = dbService.getProductsByPage(pageId);
    return products.map((p: any) => ({
      name: p.product_name || '',
      description: p.detail_text || p.description || '',
      price: p.display_price || p.price_1 || 0,
      category: p.category || ''
    }));
  } catch (err) {
    console.error('[AI Service] Failed to fetch product context:', err);
    return [];
  }
}

export function getProductForAiPrompt(pageId: string, category: string): any {
  const products = dbService.getProductsByPage(pageId);
  if (products.length > 0) return products[0];

  const categoryProducts = dbService.getProductsByCategory(category.toUpperCase());
  return categoryProducts[0] || null;
}
