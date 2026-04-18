import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import type { Product, StandardSize } from "../types";
import { SizeChartTable } from "../components";
import { useCartStore } from "../store";

const API_URL = import.meta.env.VITE_API_URL ?? "";

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

function isPreOrderOpen(product: Product): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return product.preOrderWindowStart <= today && today <= product.preOrderWindowEnd;
}

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<StandardSize | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/products/${productId}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Produk tidak ditemukan." : `Gagal memuat produk (${res.status})`);
        return res.json() as Promise<Product>;
      })
      .then((data) => {
        setProduct(data);
        setSelectedImage(data.imageKeys?.[0] ?? data.primaryImageKey);
        // Auto-select AllSize if it's the only available size
        if (data.availableSizes.length === 1 && data.availableSizes[0] === "AllSize") {
          setSelectedSize("AllSize");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Terjadi kesalahan."))
      .finally(() => setLoading(false));
  }, [productId]);

  function handleAddToCart() {
    if (!product) return;

    const isAllSizeOnly = product.availableSizes.length === 1 && product.availableSizes[0] === "AllSize";

    if (!isAllSizeOnly && !selectedSize) {
      setSizeError("Silakan pilih ukuran terlebih dahulu.");
      return;
    }

    setSizeError(null);

    const size = selectedSize ?? "AllSize";

    const result = addItem(
      {
        productId: product.productId,
        productName: product.name,
        size,
        quantity: 1,
        unitPriceIDR: product.priceIDR,
        preOrderWindowEnd: product.preOrderWindowEnd,
      },
      product.availableSizes
    );

    if (result.success) {
      setCartMessage({ type: "success", text: "Produk berhasil ditambahkan ke keranjang." });
    } else {
      setCartMessage({ type: "error", text: result.error ?? "Gagal menambahkan ke keranjang." });
    }

    setTimeout(() => setCartMessage(null), 3000);
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 64, color: "#888" }}>
        Memuat produk...
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ textAlign: "center", padding: 64, color: "#c0392b" }}>
        <p>{error ?? "Produk tidak ditemukan."}</p>
        <button onClick={() => window.location.reload()} style={{ padding: "8px 20px", cursor: "pointer" }}>
          Coba Lagi
        </button>
      </div>
    );
  }

  const isAllSizeOnly = product.availableSizes.length === 1 && product.availableSizes[0] === "AllSize";
  const preOrderOpen = isPreOrderOpen(product);
  const allImages = product.imageKeys?.length ? product.imageKeys : [product.primaryImageKey];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>
      {/* Back link */}
      <a href="/" style={{ color: "#555", fontSize: 14, textDecoration: "none" }}>
        ← Kembali ke Katalog
      </a>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 24 }}>
        {/* Image gallery */}
        <div>
          <img
            src={selectedImage ?? product.primaryImageKey}
            alt={product.name}
            style={{ width: "100%", borderRadius: 8, objectFit: "cover", maxHeight: 420, background: "#f5f5f5" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23eee'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23aaa' font-size='12'%3EGambar%3C/text%3E%3C/svg%3E";
            }}
          />
          {allImages.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {allImages.map((key, i) => (
                <img
                  key={i}
                  src={key}
                  alt={`${product.name} ${i + 1}`}
                  onClick={() => setSelectedImage(key)}
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "cover",
                    borderRadius: 4,
                    cursor: "pointer",
                    border: selectedImage === key ? "2px solid #333" : "2px solid transparent",
                    background: "#f5f5f5",
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23eee'/%3E%3C/svg%3E";
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>{product.name}</h1>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#c0392b" }}>
            {formatIDR(product.priceIDR)}
          </p>

          {/* Pre-Order Window */}
          <div style={{ background: preOrderOpen ? "#e8f5e9" : "#fce4ec", borderRadius: 6, padding: "10px 14px", fontSize: 13 }}>
            <strong>Pre-Order:</strong>{" "}
            {formatDate(product.preOrderWindowStart)} – {formatDate(product.preOrderWindowEnd)}
            {!preOrderOpen && (
              <span style={{ color: "#c0392b", marginLeft: 8 }}>
                (Periode pre-order telah berakhir)
              </span>
            )}
          </div>

          {/* Description */}
          <div>
            <p style={{ margin: "0 0 4px", fontWeight: 600 }}>Deskripsi</p>
            <p style={{ margin: 0, color: "#444", lineHeight: 1.6 }}>{product.description}</p>
          </div>

          {/* Fabric */}
          <div>
            <p style={{ margin: "0 0 4px", fontWeight: 600 }}>Bahan</p>
            <p style={{ margin: 0, color: "#444" }}>{product.fabricType}</p>
          </div>

          {/* Colours */}
          <div>
            <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Warna Tersedia</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {product.colours.map((colour) => (
                <span
                  key={colour}
                  style={{
                    border: "1px solid #bbb",
                    borderRadius: 4,
                    padding: "3px 10px",
                    fontSize: 13,
                    background: "#fafafa",
                  }}
                >
                  {colour}
                </span>
              ))}
            </div>
          </div>

          {/* Size selector */}
          {!isAllSizeOnly && (
            <div>
              <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Pilih Ukuran</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {product.availableSizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setSelectedSize(size);
                      setSizeError(null);
                    }}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 4,
                      border: selectedSize === size ? "2px solid #333" : "1px solid #bbb",
                      background: selectedSize === size ? "#333" : "#fff",
                      color: selectedSize === size ? "#fff" : "#333",
                      cursor: "pointer",
                      fontWeight: selectedSize === size ? 700 : 400,
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
              {sizeError && (
                <p style={{ margin: "6px 0 0", color: "#c0392b", fontSize: 13 }}>{sizeError}</p>
              )}
            </div>
          )}

          {isAllSizeOnly && (
            <div style={{ background: "#f3f0ff", borderRadius: 6, padding: "10px 14px", fontSize: 13, color: "#555" }}>
              Produk ini tersedia dalam ukuran <strong>AllSize</strong> — cocok untuk berbagai bentuk tubuh, setara ukuran M atau L.
            </div>
          )}

          {/* Add to cart */}
          <button
            onClick={handleAddToCart}
            disabled={!preOrderOpen}
            style={{
              padding: "12px 24px",
              borderRadius: 6,
              border: "none",
              background: preOrderOpen ? "#333" : "#bbb",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: preOrderOpen ? "pointer" : "not-allowed",
              marginTop: 4,
            }}
          >
            {preOrderOpen ? "Tambah ke Keranjang" : "Pre-Order Ditutup"}
          </button>

          {/* Cart feedback toast */}
          {cartMessage && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 6,
                background: cartMessage.type === "success" ? "#e8f5e9" : "#fce4ec",
                color: cartMessage.type === "success" ? "#2e7d32" : "#c0392b",
                fontSize: 13,
              }}
            >
              {cartMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* Size chart */}
      <div style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Tabel Ukuran</h2>
        <SizeChartTable sizeChart={product.sizeChart} availableSizes={product.availableSizes} />
      </div>
    </div>
  );
}
