// What each factor behind an opportunity score means, and how it moved it.
//
// The /reasons API groups raw model features under a friendly label
// (predict.FRIENDLY in the scoring repo) and returns that label with the
// largest raw feature in the group. The label is the stable key: "title
// length" can arrive as title_len or title_words, "title meaning" as any of
// the title_emb_pca_* columns. Pages look factors up with factorKey() and
// read everything shown from factorInfo(), so a factor has one name and one
// explanation everywhere. `npm run check:score-factors` fails when a label
// in predict.FRIENDLY has no entry here.
//
// Each entry:
//   name     plain name shown to people
//   means    what the factor measures
//   up       how it raised this score (factor pushed the score up)
//   down     how it lowered this score
//   action   what to look into next

export const SCORE_FACTORS = {
  "title wording": {
    name: "Title wording",
    means:
      "Which words and short phrases your product title uses. The model compared them with the titles of products that became top sellers in their category.",
    up: "Your title uses wording that is common among top-selling products, so it raised your score.",
    down: "Your title uses wording that is less common among top-selling products, so it lowered your score. This does not point to any single word.",
    action:
      "Check whether a shopper could tell at a glance what the product is, what it does and who it is for.",
  },
  "title meaning": {
    name: "Title meaning",
    means:
      "What your product title is about as a whole, rather than its exact words. Titles with similar meanings are grouped, and some groups sell better than others.",
    up: "Your title describes the kind of product that tends to sell well, so it raised your score.",
    down: "Your title describes the kind of product that sells well less often, so it lowered your score. It does not identify a specific keyword problem.",
    action:
      "Make sure the title describes the product accurately and leads with its most important features.",
  },
  "title length": {
    name: "Title length",
    means:
      "How long your product title is, in characters and words, compared with titles that sell well.",
    up: "Your title length is in a range that does well, so it raised your score.",
    down: "Your title is longer or shorter than titles that tend to sell well, so it lowered your score.",
    action:
      "Keep the title easy to scan. Include what shoppers need and cut words that add nothing.",
  },
  "title capitals": {
    name: "Title capitals",
    means:
      "How much of your product title is in capital letters.",
    up: "Your title's use of capitals matches titles that sell well, so it raised your score.",
    down: "Your title uses more or fewer capitals than titles that sell well, so it lowered your score.",
    action:
      "Use consistent capitalization and avoid capitals used only for emphasis.",
  },
  "size in title": {
    name: "Size in the title",
    means:
      "Whether your product title states a size or amount, such as 20 inch, 16 oz or 500 ml.",
    up: "Whether your title states a size matched what works in this category, so it raised your score.",
    down: "Whether your title states a size went against what works in this category, so it lowered your score.",
    action:
      "If size matters for this product, state it in the title so shoppers don't have to look for it.",
  },
  "pack size": {
    name: "Pack size",
    means:
      "How many items your title says come in one pack, for example \"Pack of 6\" or \"12 count\".",
    up: "Your pack size matched what sells well, so it raised your score.",
    down: "Your pack size is different from what tends to sell well, so it lowered your score.",
    action:
      "Look at the pack sizes your competitors sell most and whether a different quantity would suit buyers better.",
  },
  "sold as a set": {
    name: "Sold as a set",
    means:
      "Whether your title describes a set, kit, bundle or multi-piece product.",
    up: "Whether you sell it as a set matched what does well in this category, so it raised your score.",
    down: "Whether you sell it as a set went against what does well in this category, so it lowered your score.",
    action:
      "Check whether shoppers in this category prefer single items or bundles, and say clearly in the title which yours is.",
  },
  price: {
    name: "Price",
    means:
      "Your selling price on its own, before comparing it with anything else.",
    up: "Your selling price is at a level that tends to sell well, so it raised your score.",
    down: "Your selling price is at a level that sells well less often, so it lowered your score. This alone does not mean the price is too high or too low.",
    action:
      "Compare similar products and estimate your costs before deciding whether your price is competitive and profitable.",
  },
  "price vs category": {
    name: "Price compared with the category",
    means:
      "How your price compares with the typical (median) price of products in the same category.",
    up: "Your price compared with the category's typical price is in a range that does well, so it raised your score.",
    down: "Your price is further from the category's typical price than products that do well, so it lowered your score.",
    action:
      "Look at what products near the typical price offer, and make sure your price is justified by what yours offers.",
  },
  "price rank in category": {
    name: "Price rank in the category",
    means:
      "Where your price sits among products in the same category, from cheapest to most expensive.",
    up: "Your position from cheapest to most expensive in the category is one that does well, so it raised your score.",
    down: "Your position from cheapest to most expensive in the category is one that does less well, so it lowered your score.",
    action:
      "Try a few prices in \"Explore a different price\" on the overview to see how moving up or down the range changes the score.",
  },
  discount: {
    name: "Discount",
    means:
      "How far your selling price is below your list (\"was\") price.",
    up: "Your discount is in a range that does well, so it raised your score.",
    down: "Your discount is larger or smaller than what tends to sell well, so it lowered your score.",
    action:
      "Make sure any discount still leaves enough room to cover your costs.",
  },
  "shows a 'was' price": {
    name: "Shows a \"was\" price",
    means:
      "Whether you gave a list price above your selling price, so shoppers see a crossed-out \"was\" price.",
    up: "Whether you show a \"was\" price matched what does well, so it raised your score.",
    down: "Whether you show a \"was\" price went against what does well, so it lowered your score.",
    action:
      "Only show a \"was\" price you have actually charged. Check whether competitors in this category use one.",
  },
  category: {
    name: "Category",
    means:
      "The product category you chose. Some categories are harder to stand out in than others.",
    up: "Products like yours do comparatively well in this category, so it raised your score.",
    down: "Products like yours find it harder to stand out in this category, so it lowered your score.",
    action:
      "Check the category is the one shoppers would browse for this product, and look at how the top sellers there stand out.",
  },
  "category size": {
    name: "Category size",
    means:
      "How many products are listed in your category, which shows how crowded it is.",
    up: "The size of your category works in your favour, so it raised your score.",
    down: "The size of your category works against you, for example because it is crowded, so it lowered your score.",
    action:
      "In a crowded category, find a clear angle that sets the product apart from the many alternatives.",
  },
  "category review level": {
    name: "Typical review count in the category",
    means:
      "How many reviews products in your category usually have, which shows how established the competition is.",
    up: "How established the competition in your category is works in your favour, so it raised your score.",
    down: "Products in your category usually have many reviews, which makes it harder for a newcomer, so it lowered your score.",
    action:
      "Plan how you will collect early reviews, since shoppers compare them with well-reviewed competitors.",
  },
  "brand size": {
    name: "Brand size",
    means:
      "How many products the brand at the start of your title has listed, from one-off sellers to large brands.",
    up: "Your brand's size matches brands that tend to do well, so it raised your score.",
    down: "Your brand's size matches brands that do well less often, so it lowered your score.",
    action:
      "Look at the brands you compete with and consider how shoppers would discover and recognize yours.",
  },
  "brand breadth": {
    name: "Brand breadth",
    means:
      "How many different categories the brand sells in, from a specialist to a brand that sells everything.",
    up: "How widely your brand sells matched brands that do well, so it raised your score.",
    down: "How widely your brand sells matched brands that do well less often, so it lowered your score.",
    action:
      "Consider whether shoppers would see the brand as a specialist for this kind of product.",
  },
  "brand track record": {
    name: "Brand track record overall",
    means:
      "How often the brand's other products, across all categories, are top sellers. A new or unknown brand gets an average value.",
    up: "The brand's products often sell well, so it raised your score.",
    down: "The brand's products sell well less often than average, so it lowered your score.",
    action:
      "Study established competitors and look for customer needs they don't fully meet.",
  },
  "brand track record in category": {
    name: "Brand track record in this category",
    means:
      "How often the brand's products in this category are top sellers. A brand new to the category gets the category's average.",
    up: "The brand's products in this category often sell well, so it raised your score.",
    down: "The brand's products in this category sell well less often than average, so it lowered your score.",
    action:
      "Study established competitors in this category and look for customer needs they don't fully meet.",
  },
  "star rating": {
    name: "Star rating",
    means:
      "The product's average star rating. Only used when you enter one, for a product already on sale.",
    up: "Your star rating is at a level that sells well, so it raised your score.",
    down: "Your star rating is lower than products that sell well, so it lowered your score.",
    action:
      "Read your lower reviews for repeated complaints you could fix in the product or its description.",
  },
  "rating rank in category": {
    name: "Rating rank in the category",
    means:
      "Where your star rating sits among products in the same category, from lowest to highest.",
    up: "Your rating compares well with others in the category, so it raised your score.",
    down: "Your rating is lower than many others in the category, so it lowered your score.",
    action:
      "Compare your reviews with top-rated competitors to see what shoppers praise in theirs.",
  },
  "review count": {
    name: "Review count",
    means:
      "How many reviews the product has, and whether a review count was given at all.",
    up: "Your number of reviews is at a level that sells well, so it raised your score.",
    down: "Your number of reviews is lower than products that sell well, or none was given, so it lowered your score.",
    action:
      "Plan how to encourage honest reviews from early buyers.",
  },
  "review rank in category": {
    name: "Review rank in the category",
    means:
      "Where your number of reviews sits among products in the same category, from fewest to most.",
    up: "You have more reviews than many products in the category, so it raised your score.",
    down: "You have fewer reviews than many products in the category, so it lowered your score.",
    action:
      "Plan how to encourage honest reviews from early buyers.",
  },
};

// For a label the table doesn't know yet. Never shows the raw label: a new
// model feature reads "item_ratio" until someone writes it up.
const UNKNOWN_FACTOR = {
  name: "Other product detail",
  means:
    "A detail of your product the model uses that doesn't have a plain-language description yet.",
  up: "This detail raised your score.",
  down: "This detail lowered your score.",
  action:
    "Weigh this finding alongside customer needs, competing products and your costs.",
};

export function factorKey(reason) {
  return String(reason?.label || "")
    .trim()
    .toLowerCase();
}

export function factorName(reason) {
  return factorInfo(reason).name;
}

// Everything a page shows for one factor. `positive` picks the sentence
// for the direction it moved this score.
export function factorInfo(reason, positive) {
  const entry = SCORE_FACTORS[factorKey(reason)] || UNKNOWN_FACTOR;

  return {
    ...entry,
    effect: positive ? entry.up : entry.down,
  };
}
