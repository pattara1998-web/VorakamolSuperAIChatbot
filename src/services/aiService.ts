/**
 * AI Service - Product context fetcher for AI prompts (browser side).
 * Talks to the Express API instead of touching the database directly —
 * PostgreSQL access lives on the server (server.ts) only.
 */

interface ProductContext {
  name: string;
  description: string;
  price: number;
  category: string;
}

export async function getProductContext(pageId: string): Promise<ProductContext[]> {
  try {
    const res = await fetch(`/api/products?page_id=${encodeURIComponent(pageId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    const products: any[] = Array.isArray(data) ? data : data.products || [];
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
