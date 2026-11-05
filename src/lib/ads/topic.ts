// Turns ONE user question into Blisscco topic slugs. Pure function: no network, no storage.
// Only these slugs ever leave ChatLOL (never the question text). Slugs = Blisscco's active categories.
// Sensitive subjects return [] so no ad request is made at all.

export const AD_TOPICS = [
  "developer_tools",
  "education",
  "finance",
  "fitness",
  "food",
  "gaming",
  "lifestyle",
  "technology",
  "travel",
] as const;
export type AdTopic = (typeof AD_TOPICS)[number];

/** Blisscco accepts `topic` plus at most 2 fallback topics. */
export const MAX_TOPICS = 3;

// Whole-word / word-prefix matches on lowercase text. Keep lists short and obvious.
const KEYWORDS: Record<AdTopic, readonly string[]> = {
  gaming: ["gaming", "gamer", "gamers", "game", "games", "videogame", "esports", "playstation", "xbox", "nintendo", "fps", "minecraft"],
  technology: ["laptop", "laptops", "smartphone", "smartphones", "phone", "phones", "gadget", "gadgets", "tablet", "tablets", "headphones", "monitor", "monitors", "keyboard", "processor", "gpu", "cpu", "pc"],
  developer_tools: ["javascript", "typescript", "python", "react", "api", "debugging", "github", "docker", "ide", "coding", "programming", "developer", "developers"],
  education: ["learn", "course", "courses", "tutorial", "exam", "exams", "study", "university", "scholarship", "homework"],
  finance: ["invest", "investing", "stocks", "budget", "savings", "loan", "mortgage", "credit", "banking", "fintech"],
  fitness: ["workout", "workouts", "gym", "exercise", "running", "yoga", "cardio", "bodybuilding", "muscle"],
  food: ["recipe", "recipes", "cooking", "cook", "dinner", "lunch", "breakfast", "baking", "restaurant", "restaurants"],
  travel: ["travel", "trip", "trips", "flight", "flights", "hotel", "hotels", "vacation", "itinerary", "visa", "tourism"],
  lifestyle: ["lifestyle", "fashion", "decor", "skincare", "hobby", "hobbies"],
};

// Mirrors Blisscco's own sensitive list, widened a little. If any of these appear, ask for no ad.
const SENSITIVE = [
  "health", "medical", "medicine", "doctor", "disease", "symptom", "symptoms", "depression", "anxiety", "suicide", "therapy",
  "disability", "pregnant", "pregnancy", "addiction", "religion", "religious", "politics", "political", "election", "sexuality",
  "sexual", "gender", "ethnicity", "race", "caste", "immigration", "criminal", "arrested", "lawsuit", "union", "diagnosis",
];

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/**
 * Returns up to 3 topics, best first. Best = most keyword hits; ties go to the topic mentioned first.
 * Returns [] when nothing matches or the question touches a sensitive subject.
 */
export function deriveTopics(question: string): AdTopic[] {
  if (typeof question !== "string") return [];
  const tokens = words(question);
  if (tokens.length === 0) return [];
  const sensitive = new Set(SENSITIVE);
  if (tokens.some((t) => sensitive.has(t))) return [];

  const scored: { topic: AdTopic; hits: number; first: number }[] = [];
  for (const topic of AD_TOPICS) {
    const set = new Set(KEYWORDS[topic]);
    let hits = 0;
    let first = Infinity;
    tokens.forEach((t, i) => {
      if (set.has(t)) {
        hits++;
        if (i < first) first = i;
      }
    });
    if (hits > 0) scored.push({ topic, hits, first });
  }
  scored.sort((a, b) => b.hits - a.hits || a.first - b.first);
  return scored.slice(0, MAX_TOPICS).map((s) => s.topic);
}
