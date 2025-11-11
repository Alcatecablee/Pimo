// Comprehensive artist registry
// Each artist has a canonical name and optional aliases/keywords

export interface ArtistEntry {
  canonical: string;  // The official folder name
  aliases: string[];  // All variations and alternate spellings
  keywords?: string[]; // Additional keywords that identify this artist
}

export const ARTIST_REGISTRY: ArtistEntry[] = [
  {
    canonical: "Xoli Mfeka",
    aliases: ["xolisile", "xoli m", "xoli", "xoli mfeka"],
    keywords: ["xoli"],
  },
  {
    canonical: "Simplypiiper",
    aliases: ["simplypiper", "simply piper", "simplypiiper"],
    keywords: ["piiper", "piper"],
  },
  {
    canonical: "Pipipiper",
    aliases: ["pipipiper13", "pipi piper", "pipipiper"],
    keywords: ["pipipiper"],
  },
  {
    canonical: "Hailee Starr",
    aliases: ["hailee", "hailee starr"],
    keywords: ["hailee"],
  },
  {
    canonical: "Premlly Prem",
    aliases: ["premly prem", "premlly", "prem"],
    keywords: ["premlly", "premly"],
  },
  {
    canonical: "Kira",
    aliases: ["kira"],
    keywords: ["kira"],
  },
  // Add more artists as discovered
];

// Generic/stopwords that should NOT be considered artist names
export const STOPWORDS = new Set([
  "watch", "new", "hot", "sexy", "leaked", "exclusive", "best", "top",
  "big", "booty", "mzansi", "sandton", "based", "showing", "masturbating",
  "nudes", "webcam", "porn", "video", "onlyfans", "shower", "tease",
  "vs", "and", "the", "with", "on", "in", "riding", "threesome",
  "fingering", "clapping", "twerking", "naked", "friend", "streaming",
  "live", "dildo", "erotic", "dance", "facial", "doggystyle", "thick",
  "upskirt", "zimbabwe", "says", "magosha", "crazy", "man", "only",
]);

// Check if a string looks like a hex ID
export function isHexId(str: string): boolean {
  return /^[0-9a-f]{8,}$/i.test(str.trim());
}

// Normalize a string for comparison
export function normalize(str: string): string {
  return str.trim().toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ");
}

// Find the canonical artist name from a title
export function findArtist(title: string): string | null {
  const normalized = normalize(title);
  
  // Check if title is just a hex ID or filename
  if (isHexId(title) || title.endsWith(".mp4") || title.endsWith(".mov")) {
    return null;
  }
  
  // Check each artist in the registry
  for (const artist of ARTIST_REGISTRY) {
    // Check canonical name
    if (normalized.includes(normalize(artist.canonical))) {
      return artist.canonical;
    }
    
    // Check aliases
    for (const alias of artist.aliases) {
      const normalizedAlias = normalize(alias);
      // Use word boundary matching to avoid partial matches
      const regex = new RegExp(`\\b${normalizedAlias}\\b`);
      if (regex.test(normalized)) {
        return artist.canonical;
      }
    }
    
    // Check keywords
    if (artist.keywords) {
      for (const keyword of artist.keywords) {
        const normalizedKeyword = normalize(keyword);
        const regex = new RegExp(`\\b${normalizedKeyword}\\b`);
        if (regex.test(normalized)) {
          return artist.canonical;
        }
      }
    }
  }
  
  return null;
}

// Get list of all canonical artist names
export function getAllArtistNames(): string[] {
  return ARTIST_REGISTRY.map(a => a.canonical);
}
