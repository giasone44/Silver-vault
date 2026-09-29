import * as z from "zod/v4";

export const Metal = z.enum(["silver", "gold", "platinum", "palladium", "copper", "other"]);
export type Metal = z.infer<typeof Metal>;

/** What Claude returns after looking at the two photos. */
export const Identification = z.object({
  name: z.string().describe('Short catalog title, e.g. "2023 American Silver Eagle 1 oz" or "10 oz Engelhard Silver Bar"'),
  item_type: z.enum(["coin", "round", "bar", "other"]),
  category: z
    .enum(["bullion", "semi-numismatic", "numismatic"])
    .describe("bullion = trades near melt; numismatic = value driven by rarity/grade/collector demand"),
  metal: Metal,
  purity: z.number().nullable().describe("Fineness as a decimal, e.g. 0.999, 0.9999, 0.900"),
  gross_weight_troy_oz: z.number().nullable(),
  fine_weight_troy_oz: z.number().nullable().describe("Actual precious-metal content in troy oz (ASW/AGW)"),
  weight_grams: z.number().nullable(),
  diameter_mm: z.number().nullable(),
  thickness_mm: z.number().nullable(),
  country: z.string().nullable(),
  mint: z.string().nullable().describe("Issuing mint or refiner, e.g. US Mint, Royal Canadian Mint, Engelhard, SilverTowne"),
  mint_mark: z.string().nullable(),
  year: z.string().nullable(),
  denomination: z.string().nullable(),
  series: z.string().nullable(),
  catalog_number: z.string().nullable().describe("KM#, Y#, or other standard catalog reference when known"),
  mintage: z.string().nullable(),
  designer: z.string().nullable(),
  obverse_description: z.string(),
  reverse_description: z.string(),
  edge: z.string().nullable(),
  certification_service: z.enum(["none", "PCGS", "NGC", "ANACS", "ICG", "CAC", "other"]),
  certification_grade: z.string().nullable().describe("Grade printed on the slab, if certified"),
  cert_number: z.string().nullable(),
  estimated_grade: z.string().nullable().describe("Your estimate for raw coins, e.g. 'MS-63 to MS-65 (estimated from photos)'"),
  condition_notes: z.string().nullable().describe("Visible wear, toning, spots, scratches, milk spots, rim dings"),
  variety_or_error: z.string().nullable(),
  search_query: z.string().describe("Best marketplace search query for finding sold comparables of exactly this item"),
  confidence: z.number().describe("0 to 1 - how sure you are of the identification"),
  notes_for_user: z
    .string()
    .nullable()
    .describe("Anything uncertain and what photo would resolve it, e.g. 'mint mark not visible - photograph below the date'"),
});
export type Identification = z.infer<typeof Identification>;

export const Comp = z.object({
  title: z.string(),
  price_usd: z.number(),
  date: z.string().nullable().describe("Sale or listing date, ISO format if known"),
  source: z.string().describe("e.g. eBay, Heritage, APMEX, PCGS Price Guide, Greysheet"),
  url: z.string().nullable(),
  kind: z.enum(["sold", "auction", "dealer_sell", "dealer_buy", "price_guide", "asking"]),
});
export type Comp = z.infer<typeof Comp>;

/** What Claude returns after researching the market. */
export const MarketResearch = z.object({
  pricing_model: z
    .enum(["bullion", "numismatic"])
    .describe("bullion = value moves with spot (premium over melt); numismatic = collector value mostly independent of spot"),
  estimated_value_usd: z.number().describe("Fair market value for ONE unit in the stated condition, based on recent actual sales"),
  low_usd: z.number(),
  high_usd: z.number(),
  dealer_buy_usd: z.number().nullable().describe("What a dealer would typically pay you for one unit"),
  dealer_sell_usd: z.number().nullable().describe("What a dealer typically charges for one unit"),
  confidence: z.enum(["low", "medium", "high"]),
  comps: z.array(Comp).describe("The individual recent sales and prices you relied on, most relevant first"),
  summary: z.string().describe("2-4 sentences explaining how you arrived at the value"),
  selling_tips: z.string().nullable().describe("Best venue and approach to sell this specific item"),
});
export type MarketResearch = z.infer<typeof MarketResearch>;

export const Source = z.object({ title: z.string(), url: z.string() });

/** Everything worth knowing about a piece, researched from authoritative sources. */
export const Dossier = z.object({
  summary: z.string().describe("2-3 sentences: exactly what this piece is and why it matters"),
  history: z.string().describe("Background: who issued it, when and why, the series and its place in collecting"),
  obverse_design: z.string(),
  reverse_design: z.string(),
  designer: z.string().nullable(),
  specifications: z.object({
    composition: z.string().nullable(),
    purity: z.number().nullable(),
    weight_grams: z.number().nullable(),
    gross_weight_troy_oz: z.number().nullable(),
    fine_weight_troy_oz: z.number().nullable(),
    diameter_mm: z.number().nullable(),
    thickness_mm: z.number().nullable(),
    edge: z.string().nullable(),
  }),
  mintage: z.string().nullable().describe("Mintage for this exact year and mint, with the source; for private bars explain that none is published"),
  mintage_context: z.string().nullable().describe("How scarce this issue is relative to the rest of the series"),
  key_facts: z.array(z.string()),
  varieties: z.array(z.string()).describe("Known varieties, errors or die differences worth checking this piece for"),
  authentication: z.array(z.string()).describe("Practical checks that this piece is genuine: weight, dimensions, magnet, ping, known fakes"),
  grading_notes: z.string().nullable().describe("What determines grade for this type and where wear shows first"),
  care: z.string().nullable(),
  sources: z.array(Source),
});
export type Dossier = z.infer<typeof Dossier>;

export type ResearchStatus = "queued" | "running" | "done" | "failed";

export type Valuation = MarketResearch & {
  valued_at: string;
  spot_at_valuation: number | null;
  melt_at_valuation: number | null;
  model: string;
};

/** Fields the user can edit on an inventory item. */
/** Optional on input; stored as null when absent. */
const opt = <T extends z.ZodType>(t: T) => t.nullable().default(null);

export const ItemInput = z.object({
  name: z.string().min(1),
  item_type: z.enum(["coin", "round", "bar", "other"]),
  category: z.enum(["bullion", "semi-numismatic", "numismatic"]),
  metal: Metal,
  purity: opt(z.number()),
  gross_weight_troy_oz: opt(z.number()),
  fine_weight_troy_oz: opt(z.number()),
  year: opt(z.string()),
  mint: opt(z.string()),
  mint_mark: opt(z.string()),
  country: opt(z.string()),
  denomination: opt(z.string()),
  series: opt(z.string()),
  catalog_number: opt(z.string()),
  certification_service: opt(z.string()),
  certification_grade: opt(z.string()),
  cert_number: opt(z.string()),
  grade: opt(z.string()),
  condition_notes: opt(z.string()),
  quantity: z.number().int().positive().default(1),
  purchase_price_per_unit: opt(z.number()),
  purchase_date: opt(z.string()),
  purchase_source: opt(z.string()),
  storage_location: opt(z.string()),
  tags: z.array(z.string()).default([]),
  notes: opt(z.string()),
  search_query: opt(z.string()),
  /** Numista catalogue type id, used for specs and price-guide lookups. */
  numista_id: opt(z.number()),
  specs: Identification.nullable().default(null),
});
export type ItemInput = z.infer<typeof ItemInput>;

export type Item = ItemInput & {
  id: string;
  obverse_photo: string | null;
  reverse_photo: string | null;
  valuation: Valuation | null;
  dossier: Dossier | null;
  research_status: ResearchStatus | null;
  research_error: string | null;
  created_at: string;
  updated_at: string;
};
