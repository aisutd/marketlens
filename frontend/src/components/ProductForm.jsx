
import { useEffect, useState } from "react";
import { getCategories } from "../services/marketlensApi";

export default function ProductForm({ product, setProduct }) {
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoryError, setCategoryError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      try {
        const data = await getCategories();

        if (!Array.isArray(data)) {
          throw new Error("Unexpected categories response.");
        }

        if (active) {
          setCategories(data);
        }
      } catch (error) {
        if (active) {
          setCategoryError(error.message);
        }
      } finally {
        if (active) {
          setLoadingCategories(false);
        }
      }
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, []);

  const updateField = (field, value) => {
    setProduct((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const inputClass =
    "h-12 w-full rounded border border-[#89949D] bg-white px-3 text-sm font-normal outline-none focus:border-[#E9BC3E]";

  return (
    <section className="overflow-hidden rounded-lg border border-[#D5DADF] bg-white">
      <div className="border-b-[3px] border-[#E9BC3E] bg-[#FFFAE9] px-6 py-5 font-semibold">
        Single product ✓
      </div>

      <div className="space-y-6 p-7">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Product details
          </h2>
          <span className="text-xs text-slate-500">
            * Required fields
          </span>
        </div>

        <label className="flex flex-col gap-2 text-sm font-semibold">
          Product title *
          <input
            type="text"
            maxLength={500}
            value={product.title}
            placeholder="Enter product title"
            onChange={(event) =>
              updateField("title", event.target.value)
            }
            className={inputClass}
          />
        </label>

        <p className="-mt-4 text-xs text-slate-500">
          Use a clear title that describes the product you want to evaluate.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Category *
            <select
              value={product.category}
              onChange={(event) =>
                updateField("category", event.target.value)
              }
              disabled={loadingCategories || Boolean(categoryError)}
              className={inputClass}
            >
              <option value="">
                {loadingCategories
                  ? "Loading categories..."
                  : categoryError
                    ? "Unable to load categories"
                    : "Select a category"}
              </option>

              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold">
            Selling price *
            <input
              type="number"
              min="0.01"
              max="100000"
              step="0.01"
              value={product.price}
              placeholder="Enter price"
              onChange={(event) =>
                updateField("price", event.target.value)
              }
              className={inputClass}
            />
          </label>
        </div>

        {categoryError && (
          <p role="alert" className="text-xs text-red-600">
            {categoryError}
          </p>
        )}

        <div className="border-t border-slate-200 pt-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Brand · optional
              <input
                type="text"
                value={product.brand}
                placeholder="Enter brand"
                onChange={(event) =>
                  updateField("brand", event.target.value)
                }
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold">
              Original (was) price · optional
              <input
                type="number"
                min="0"
                step="0.01"
                value={product.originalPrice}
                placeholder="Enter original price"
                onChange={(event) =>
                  updateField("originalPrice", event.target.value)
                }
                className={inputClass}
              />
            </label>
          </div>

          <p className="mt-5 text-xs text-slate-500">
            Have more details? Add a brand or the original price for extra product context.
          </p>
        </div>
      </div>
    </section>
  );
}
