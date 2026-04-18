import { useState, useEffect, useCallback } from "react";
import type { Product, Occasion, StandardSize } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "";

const OCCASIONS: Occasion[] = ["Raya", "Wedding", "Casual"];
const STANDARD_SIZES: StandardSize[] = ["XS", "S", "M", "L", "XL", "XXL", "AllSize"];

function formatIDR(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface ProductCardProps {
  product: Product;
}

function ProductCard({ product }: ProductCardProps) {
  return (
    <div
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <img
        src={product.primaryImageKey}
        alt={product.name}
        style={{ width: "100%", height: 220, objectFit: "cover", background: "#f5f5f5" }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src =
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23eee'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23aaa' font-size='12'%3EGambar%3C/text%3E%3C/svg%3E";
        }}
      />
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{product.name}</h3>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#c0392b" }}>
          {formatIDR(product.priceIDR)}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {product.availableSizes.map((size) => (
            <span
              key={size}
              style={{
                border: "1px solid #999",
                borderRadius: 4,
                padding: "2px 7px",
                fontSize: 12,
              }}
            >
              {size}
            </span>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "#555" }}>
          Pre-Order: {formatDate(product.preOrderWindowStart)} – {formatDate(product.preOrderWindowEnd)}
        </p>
      </div>
    </div>
  );
}

export function CataloguePage() {
  const [activeOccasion, setActiveOccasion] = useState<Occasion>("Raya");
  const [selectedSize, setSelectedSize] = useState<StandardSize | "">("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async (occasion: Occasion, size: StandardSize | "") => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ occasion });
      if (size) params.set("size", size);
      const res = await fetch(`${API_URL}/products?${params.toString()}`);
      if (!res.ok) throw new Error(`Gagal memuat produk (${res.status})`);
      const data: Product[] = await res.json();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan. Silakan coba lagi.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(activeOccasion, selectedSize);
  }, [activeOccasion, selectedSize, fetchProducts]);

  function handleOccasionChange(occasion: Occasion) {
    setActiveOccasion(occasion);
    setSelectedSize("");
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ marginBottom: 24 }}>Katalog Baju Kurung</h1>

      {/* Occasion tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {OCCASIONS.map((occasion) => (
          <button
            key={occasion}
            onClick={() => handleOccasionChange(occasion)}
            style={{
              padding: "8px 20px",
              borderRadius: 20,
              border: "1px solid #999",
              background: activeOccasion === occasion ? "#333" : "#fff",
              color: activeOccasion === occasion ? "#fff" : "#333",
              cursor: "pointer",
              fontWeight: activeOccasion === occasion ? 700 : 400,
            }}
          >
            {occasion}
          </button>
        ))}
      </div>

      {/* Size filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, color: "#555" }}>Filter ukuran:</span>
        <button
          onClick={() => setSelectedSize("")}
          style={{
            padding: "5px 14px",
            borderRadius: 4,
            border: "1px solid #999",
            background: selectedSize === "" ? "#333" : "#fff",
            color: selectedSize === "" ? "#fff" : "#333",
            cursor: "pointer",
          }}
        >
          Semua
        </button>
        {STANDARD_SIZES.map((size) => (
          <button
            key={size}
            onClick={() => setSelectedSize(size)}
            style={{
              padding: "5px 14px",
              borderRadius: 4,
              border: "1px solid #999",
              background: selectedSize === size ? "#333" : "#fff",
              color: selectedSize === size ? "#fff" : "#333",
              cursor: "pointer",
            }}
          >
            {size}
          </button>
        ))}
      </div>

      {/* Content area */}
      {loading && (
        <div style={{ textAlign: "center", padding: 48, color: "#888" }}>Memuat produk...</div>
      )}

      {!loading && error && (
        <div style={{ textAlign: "center", padding: 48, color: "#c0392b" }}>
          <p>{error}</p>
          <button
            onClick={() => fetchProducts(activeOccasion, selectedSize)}
            style={{ padding: "8px 20px", cursor: "pointer" }}
          >
            Coba Lagi
          </button>
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <div style={{ textAlign: "center", padding: 48, color: "#888" }}>
          Tidak ada produk yang ditemukan.
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 20,
          }}
        >
          {products.map((product) => (
            <ProductCard key={product.productId} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
