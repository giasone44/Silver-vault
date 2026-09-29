// Mirrors server/src/schemas.ts - keep in sync.

export type Metal = "silver" | "gold" | "platinum" | "palladium" | "copper" | "other";
export type ItemType = "coin" | "round" | "bar" | "other";
export type Category = "bullion" | "semi-numismatic" | "numismatic";

export type Identification = {
  name: string;
  item_type: ItemType;
  category: Category;
  metal: Metal;
  purity: number | null;
  gross_weight_troy_oz: number | null;
  fine_weight_troy_oz: number | null;
  weight_grams: number | null;
  diameter_mm: number | null;
  thickness_mm: number | null;
  country: string | null;
  mint: string | null;
  mint_mark: string | null;
  year: string | null;
  denomination: string | null;
  series: string | null;
  catalog_number: string | null;
  mintage: string | null;
  designer: string | null;
  obverse_description: string;
  reverse_description: string;
  edge: string | null;
  certification_service: string;
  certification_grade: string | null;
  cert_number: string | null;
  estimated_grade: string | null;
  condition_notes: string | null;
  variety_or_error: string | null;
  search_query: string;
  confidence: number;
  notes_for_user: string | null;
};

export type Comp = {
  title: string;
  price_usd: number;
  date: string | null;
  source: string;
  url: string | null;
  kind: "sold" | "auction" | "dealer_sell" | "dealer_buy" | "price_guide" | "asking";
};

export type Valuation = {
  pricing_model: "bullion" | "numismatic";
  estimated_value_usd: number;
  low_usd: number;
  high_usd: number;
  dealer_buy_usd: number | null;
  dealer_sell_usd: number | null;
  confidence: "low" | "medium" | "high";
  comps: Comp[];
  summary: string;
  selling_tips: string | null;
  valued_at: string;
  spot_at_valuation: number | null;
  melt_at_valuation: number | null;
  model: string;
};

export type ItemInput = {
  name: string;
  item_type: ItemType;
  category: Category;
  metal: Metal;
  purity: number | null;
  gross_weight_troy_oz: number | null;
  fine_weight_troy_oz: number | null;
  year: string | null;
  mint: string | null;
  mint_mark: string | null;
  country: string | null;
  denomination: string | null;
  series: string | null;
  catalog_number: string | null;
  certification_service: string | null;
  certification_grade: string | null;
  cert_number: string | null;
  grade: string | null;
  condition_notes: string | null;
  quantity: number;
  purchase_price_per_unit: number | null;
  purchase_date: string | null;
  purchase_source: string | null;
  storage_location: string | null;
  tags: string[];
  notes: string | null;
  search_query: string | null;
  numista_id: number | null;
  specs: Identification | null;
};

export type Item = ItemInput & {
  id: string;
  obverse_photo: string | null;
  reverse_photo: string | null;
  valuation: Valuation | null;
  created_at: string;
  updated_at: string;
};

export type ItemDetail = Item & { history: Valuation[] };

export type SpotQuote = {
  silver: number | null;
  gold: number | null;
  platinum: number | null;
  palladium: number | null;
  currency: "USD";
  provider: string;
  fetched_at: string;
};

export type Photo = {
  base64: string;
  /** Smaller copy sent to the AI for reading. */
  aiBase64?: string;
  mediaType: "image/jpeg";
  uri: string;
};

export type Health = {
  ok: boolean;
  ai_provider: "claude" | "ollama";
  ai_model: string;
  ai: boolean;
  ai_detail: string | null;
  catalog: boolean;
  ebay: boolean;
  ebay_sold_data: boolean;
  spot_provider: string;
};

export type CatalogHit = {
  id: number;
  title: string;
  issuer: string | null;
  years: string | null;
  category: string;
  thumbnail: string | null;
};

export type CatalogSpecs = Partial<ItemInput> & {
  numista_id: number;
  catalog_title: string;
  catalog_url: string | null;
  weight_grams: number | null;
  diameter_mm: number | null;
  thickness_mm: number | null;
  obverse_description: string | null;
  reverse_description: string | null;
  edge: string | null;
  designer: string | null;
  mints: string[];
  mintage: number | null;
  issues: CatalogIssue[];
};

export type CatalogIssue = { id: number; year: number | null; mint_letter: string | null; mintage: number | null; comment: string | null };

export type Maker = {
  id: string;
  name: string;
  aliases: string[];
  kind: string;
  country: string;
  founded: string | null;
  status: string;
  about: string;
  collecting: string;
};
