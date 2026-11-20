
const STORAGE_PREFIX = "marketlens:saved-products:v1";

function getStorageKey(userId) {
  if (!userId) {
    throw new Error("A signed-in user is required.");
  }

  return `${STORAGE_PREFIX}:${userId}`;
}

export function getSavedProducts(userId) {
  const key = getStorageKey(userId);

  try {
    const saved = JSON.parse(localStorage.getItem(key) || "[]");

    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.error("Unable to load saved products:", error);
    return [];
  }
}

export function saveProduct(userId, analysis) {
  if (!analysis || typeof analysis !== "object") {
    throw new Error("A valid product analysis is required.");
  }

  const savedProducts = getSavedProducts(userId);

  const savedProduct = {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    analysis,
  };

  localStorage.setItem(
    getStorageKey(userId),
    JSON.stringify([savedProduct, ...savedProducts])
  );

  return savedProduct;
}

export function removeSavedProduct(userId, productId) {
  const savedProducts = getSavedProducts(userId);

  const updatedProducts = savedProducts.filter(
    (product) => product.id !== productId
  );

  localStorage.setItem(
    getStorageKey(userId),
    JSON.stringify(updatedProducts)
  );

  return updatedProducts;
}
