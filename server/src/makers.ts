// A reference register of the mints and refiners whose products turn up most
// often in silver and gold collections. Used to recognise the maker of a piece
// (including common misspellings), and to show its background and what
// collectors look for. Facts are kept to well-established ones; years are
// omitted where they aren't certain.

export type Maker = {
  id: string;
  name: string;
  /** Lower-case spellings to recognise, including common misspellings. */
  aliases: string[];
  kind: "Government mint" | "Private mint" | "Refiner";
  country: string;
  founded: string | null;
  status: string;
  about: string;
  collecting: string;
};

export const MAKERS: Maker[] = [
  // --- Private refiners prized by bar collectors ---------------------------
  {
    id: "engelhard",
    name: "Engelhard",
    aliases: ["engelhard", "englehard", "engelhart", "englehart", "engelhard industries", "engelhard corporation"],
    kind: "Refiner",
    country: "United States (also Canada, UK, Australia)",
    founded: "1902",
    status: "No longer produces bullion; acquired by BASF in 2006",
    about:
      "American precious-metals refiner based in New Jersey. Its silver bars and rounds from the 1960s–1980s were made in the United States, Canada, the UK and Australia, in poured, extruded and struck styles.",
    collecting:
      "Among the most collected bullion names. Vintage Engelhard bars usually sell above melt, and the premium depends on size, style (poured vs. extruded/struck), country of manufacture, logo variety, serial number and condition. Private bars have no published mintages, so rarity comes from variety and survival. Compare against eBay sold listings for the exact variety.",
  },
  {
    id: "johnson-matthey",
    name: "Johnson Matthey",
    aliases: ["johnson matthey", "johnson mathey", "johnson mattey", "johnson matthew", "johnson mathew", "matthey", "mathey", "jm bar", "j.m."],
    kind: "Refiner",
    country: "United Kingdom (also Canada, USA, Australia)",
    founded: "1817",
    status: "Sold its gold and silver refining business to Asahi Holdings in 2015",
    about:
      "London refiner and one of the oldest names in precious metals. Johnson Matthey (\"JM\") bars were produced in Britain, Canada, the United States and Australia over several decades.",
    collecting:
      "Vintage JM bars, especially poured bars and older logo varieties, are collectible and typically sell above melt. Value depends on size, country, style, serial number and condition. As with all private bars, there are no published mintages. Check eBay sold listings for the same variety.",
  },
  {
    id: "handy-harman",
    name: "Handy & Harman",
    aliases: ["handy & harman", "handy and harman", "handy harman"],
    kind: "Refiner",
    country: "United States",
    founded: "1867",
    status: "No longer produces retail bullion",
    about: "Long-established American precious-metals refiner and fabricator.",
    collecting: "Vintage Handy & Harman bars are sought by bar collectors and often carry a premium over melt, depending on size and variety.",
  },
  {
    id: "credit-suisse",
    name: "Credit Suisse",
    aliases: ["credit suisse", "credit-suisse"],
    kind: "Refiner",
    country: "Switzerland",
    founded: null,
    status: "Swiss bank; its bars were manufactured by Valcambi",
    about: "Credit Suisse-branded bars were produced by the Valcambi refinery, which the bank owned from 1967 to 2003.",
    collecting: "Widely recognised and easy to resell. Assay-card bars keep their packaging premium best when left sealed.",
  },
  {
    id: "pamp",
    name: "PAMP Suisse",
    aliases: ["pamp", "pamp suisse", "p.a.m.p."],
    kind: "Refiner",
    country: "Switzerland",
    founded: "1977",
    status: "Active",
    about: "Swiss refiner in Ticino, best known for its Lady Fortuna bar design and assay-card packaging.",
    collecting: "Trades close to spot plus a modest premium. Keep assay cards sealed; opened cards reduce resale appeal.",
  },
  {
    id: "valcambi",
    name: "Valcambi",
    aliases: ["valcambi"],
    kind: "Refiner",
    country: "Switzerland",
    founded: "1961",
    status: "Active",
    about: "Refinery in Balerna, Switzerland; maker of CombiBars and of bars sold under other brands, including Credit Suisse.",
    collecting: "Bullion pricing. CombiBars (breakable 1 g segments) carry a higher premium.",
  },
  {
    id: "argor-heraeus",
    name: "Argor-Heraeus",
    aliases: ["argor-heraeus", "argor heraeus", "argor"],
    kind: "Refiner",
    country: "Switzerland",
    founded: "1951",
    status: "Active",
    about: "Swiss refinery in Mendrisio.",
    collecting: "Bullion pricing, widely accepted by dealers.",
  },
  {
    id: "heraeus",
    name: "Heraeus",
    aliases: ["heraeus"],
    kind: "Refiner",
    country: "Germany",
    founded: "1851",
    status: "Active",
    about: "German precious-metals group based in Hanau.",
    collecting: "Bullion pricing, widely accepted by dealers.",
  },
  {
    id: "degussa",
    name: "Degussa",
    aliases: ["degussa"],
    kind: "Refiner",
    country: "Germany",
    founded: "1873",
    status: "The name continues through Degussa Goldhandel",
    about: "Historic Frankfurt refiner. Older Degussa bars predate the current Degussa brand.",
    collecting: "Vintage Degussa bars attract collector interest; modern ones trade as bullion.",
  },
  {
    id: "metalor",
    name: "Metalor",
    aliases: ["metalor"],
    kind: "Refiner",
    country: "Switzerland",
    founded: null,
    status: "Active",
    about: "Swiss refiner based in Neuchâtel.",
    collecting: "Bullion pricing, widely accepted by dealers.",
  },
  {
    id: "asahi",
    name: "Asahi Refining",
    aliases: ["asahi"],
    kind: "Refiner",
    country: "Japan / North America",
    founded: null,
    status: "Active; took over Johnson Matthey's gold and silver refining in 2015",
    about: "Refiner that continued production at the former Johnson Matthey refineries in North America.",
    collecting: "Bullion pricing; plain designs with low premiums.",
  },
  // --- US private mints --------------------------------------------------
  {
    id: "silvertowne",
    name: "SilverTowne",
    aliases: ["silvertowne", "silver towne", "silvertown"],
    kind: "Private mint",
    country: "United States (Winchester, Indiana)",
    founded: null,
    status: "Active",
    about: "Indiana private mint best known for its Prospector design on rounds and bars.",
    collecting: "Mostly bullion pricing; older or limited designs can carry small collector premiums.",
  },
  {
    id: "sunshine",
    name: "Sunshine Minting",
    aliases: ["sunshine minting", "sunshine mint", "sunshine"],
    kind: "Private mint",
    country: "United States (Idaho)",
    founded: null,
    status: "Active",
    about: "Idaho private mint whose bars and rounds carry its MintMark SI anti-counterfeiting feature, and which supplies coin blanks to government mints.",
    collecting: "Bullion pricing. The MintMark SI can be checked with a decoder lens.",
  },
  {
    id: "northwest-territorial",
    name: "Northwest Territorial Mint",
    aliases: ["northwest territorial", "nwtm", "northwest territorial mint"],
    kind: "Private mint",
    country: "United States (Washington)",
    founded: null,
    status: "Closed after bankruptcy in 2016",
    about: "Washington State private mint that produced a wide range of bars and rounds.",
    collecting: "Some designs gained collector interest after the mint closed; most trade near bullion.",
  },
  {
    id: "golden-state",
    name: "Golden State Mint",
    aliases: ["golden state mint", "golden state"],
    kind: "Private mint",
    country: "United States (California)",
    founded: null,
    status: "Active",
    about: "California private mint producing rounds and bars in many designs.",
    collecting: "Bullion pricing, with small premiums on popular designs.",
  },
  {
    id: "scottsdale",
    name: "Scottsdale Mint",
    aliases: ["scottsdale mint", "scottsdale"],
    kind: "Private mint",
    country: "United States (Arizona)",
    founded: null,
    status: "Active",
    about: "Arizona private mint known for stacker bars and poured-style bars.",
    collecting: "Bullion pricing; some limited series carry premiums.",
  },
  {
    id: "monarch",
    name: "Monarch Precious Metals",
    aliases: ["monarch precious metals", "monarch"],
    kind: "Private mint",
    country: "United States (Oregon)",
    founded: null,
    status: "Active",
    about: "Oregon private mint producing hand-poured bars and rounds.",
    collecting: "Hand-poured pieces often carry a modest premium over melt.",
  },
  {
    id: "mother-lode",
    name: "Mother Lode Mint",
    aliases: ["mother lode mint", "mother lode", "motherlode"],
    kind: "Private mint",
    country: "United States",
    founded: null,
    status: "Vintage; no longer operating",
    about: "Vintage American private mint whose older bars and art rounds turn up in collections.",
    collecting: "Vintage pieces attract bar and round collectors; premiums vary by design and rarity.",
  },
  {
    id: "geiger",
    name: "Geiger Edelmetalle",
    aliases: ["geiger", "geiger edelmetalle"],
    kind: "Private mint",
    country: "Germany",
    founded: null,
    status: "Active",
    about: "German maker of the square \"Original\" series bars.",
    collecting: "Modest premiums; popular with European collectors.",
  },
  // --- Government mints ----------------------------------------------------
  {
    id: "us-mint",
    name: "United States Mint",
    aliases: ["united states mint", "us mint", "u.s. mint", "philadelphia", "san francisco", "denver", "west point", "carson city"],
    kind: "Government mint",
    country: "United States",
    founded: "1792",
    status: "Active",
    about: "Official US mint, with branch mints marked P (Philadelphia), D (Denver), S (San Francisco), W (West Point), and historically CC (Carson City), O (New Orleans) and others.",
    collecting: "Mint marks matter: the same coin can be common from one mint and scarce from another. Mintages by year and mint are on each coin's page.",
  },
  {
    id: "royal-canadian-mint",
    name: "Royal Canadian Mint",
    aliases: ["royal canadian mint", "rcm", "canada mint"],
    kind: "Government mint",
    country: "Canada",
    founded: "1908",
    status: "Active",
    about: "Canada's mint; maker of the Maple Leaf bullion coins, which carry anti-counterfeiting security marks on modern issues.",
    collecting: "Bullion Maple Leafs trade on metal value; special and low-mintage issues carry premiums.",
  },
  {
    id: "royal-mint",
    name: "The Royal Mint",
    aliases: ["royal mint", "the royal mint", "llantrisant"],
    kind: "Government mint",
    country: "United Kingdom",
    founded: null,
    status: "Active (over 1,100 years old; at Llantrisant, Wales since 1968)",
    about: "The UK's mint; maker of Britannia and Sovereign coins.",
    collecting: "Britannias trade near bullion; older Sovereigns and proofs carry collector premiums.",
  },
  {
    id: "perth-mint",
    name: "Perth Mint",
    aliases: ["perth mint", "perth"],
    kind: "Government mint",
    country: "Australia",
    founded: "1899",
    status: "Active",
    about: "Western Australian mint; maker of the Kangaroo, Kookaburra, Koala and Lunar series.",
    collecting: "Series such as the Kookaburra and Lunar carry premiums over plain bullion, especially early years.",
  },
  {
    id: "austrian-mint",
    name: "Austrian Mint",
    aliases: ["austrian mint", "münze österreich", "munze osterreich", "muenze oesterreich"],
    kind: "Government mint",
    country: "Austria",
    founded: null,
    status: "Active (history reaching back to the 12th century)",
    about: "Vienna mint; maker of the Vienna Philharmonic, first issued in 1989.",
    collecting: "Trades on metal value with a low premium.",
  },
  {
    id: "mexican-mint",
    name: "Casa de Moneda de México",
    aliases: ["casa de moneda", "mexican mint", "mexico mint"],
    kind: "Government mint",
    country: "Mexico",
    founded: "1535",
    status: "Active",
    about: "The oldest mint in the Americas; maker of the Libertad, issued since 1982.",
    collecting: "Libertads have relatively low mintages, so some years carry strong premiums.",
  },
  {
    id: "south-african-mint",
    name: "South African Mint",
    aliases: ["south african mint"],
    kind: "Government mint",
    country: "South Africa",
    founded: null,
    status: "Active",
    about: "Maker of the Krugerrand, first issued in 1967 (gold) and in silver from 2017.",
    collecting: "Krugerrands trade on metal value; proofs and early dates carry premiums.",
  },
  {
    id: "china-mint",
    name: "China Mint",
    aliases: ["china mint", "people's bank of china", "chinese mint"],
    kind: "Government mint",
    country: "China",
    founded: null,
    status: "Active",
    about: "Maker of the Panda series, whose design changes almost every year.",
    collecting: "Because the design changes most years, Pandas are collected by date. Beware of counterfeits.",
  },
];

function normalise(s: string) {
  return ` ${s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9&.' -]/g, " ").replace(/\s+/g, " ")} `;
}

/** Finds the maker named anywhere in the given texts (longest alias wins). */
export function matchMaker(...texts: (string | null | undefined)[]): Maker | null {
  const hay = normalise(texts.filter(Boolean).join(" | "));
  let best: { maker: Maker; len: number } | null = null;
  for (const maker of MAKERS) {
    for (const alias of maker.aliases) {
      const a = alias.length <= 3 ? ` ${alias} ` : alias; // short aliases must be whole words
      if (hay.includes(a) && (!best || alias.length > best.len)) best = { maker, len: alias.length };
    }
  }
  return best?.maker ?? null;
}
