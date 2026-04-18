import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Occasion, StandardSize, SizeChart } from "../types";
import { authFetch } from "../utils/auth";

const API_URL = import.meta.env.VITE_API_URL ?? "";

const OCCASIONS: Occasion[] = ["Raya", "Wedding", "Casual"];
const ALL_SIZES: StandardSize[] = ["XS", "S", "M", "L", "XL", "XXL", "AllSize"];

interface FormErrors {
  name?: string;
  occasion?: string;
  description?: string;
  fabricType?: string;
  colours?: string;
  availableSizes?: string;
  sizeChart?: string;
  priceIDR?: string;
  images?: string;
  preOrderWindowStart?: string;
  preOrderWindowEnd?: string;
}

interface SizeChartEntry {
  bust: string;
  waist: string;
  hip: string;
}

export function AddProductPage() {
  const navigate = useNavigate();

  // Form state
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState<Occasion>("Raya");
  const [description, setDescription] = useState("");
  const [fabricType, setFabricType] = useState("");
  const [coloursInput, setColoursInput] = useState(""); // comma-separated
  const [availableSizes, setAvailableSizes] = useState<StandardSize[]>([]);
  const [sizeChartEntries, setSizeChartEntries] = useState<Record<StandardSize, SizeChartEntry>>(
    {} as Record<StandardSize, SizeChartEntry>
  );
  const [priceIDR, setPriceIDR] = useState("");
  const [preOrderWindowStart, setPreOrderWindowStart] = useState("");
  const [preOrderWindowEnd, setPreOrderWindowEnd] = useState("");

  // Image upload state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadedImageKeys, setUploadedImageKeys] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  // Submission state
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Size selection ──────────────────────────────────────────────────────────

  function toggleSize(size: StandardSize) {
    setAvailableSizes((prev) => {
      if (prev.includes(size)) {
        // Remove size and its chart entry
        const next = prev.filter((s) => s !== size);
        setSizeChartEntries((entries) => {
          const updated = { ...entries };
          delete updated[size];
          return updated;
        });
        return next;
      } else {
        setSizeChartEntries((entries) => ({
          ...entries,
          [size]: { bust: "", waist: "", hip: "" },
        }));
        return [...prev, size];
      }
    });
  }

  function updateSizeChart(size: StandardSize, field: keyof SizeChartEntry, value: string) {
    setSizeChartEntries((prev) => ({
      ...prev,
      [size]: { ...prev[size], [field]: value },
    }));
  }

  // ── Image upload ────────────────────────────────────────────────────────────

  async function uploadImages(files: File[]): Promise<string[]> {
    const keys: string[] = [];
    for (const file of files) {
      const res = await authFetch(`${API_URL}/products/uploads`, {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      if (!res.ok) throw new Error(`Gagal mendapatkan URL upload untuk ${file.name}`);
      const { uploadUrl, key } = await res.json();

      const s3Res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!s3Res.ok) throw new Error(`Gagal mengunggah ${file.name}`);
      keys.push(key);
    }
    return keys;
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setImageFiles(files);
    setUploadingImages(true);
    setImageUploadError(null);
    setUploadedImageKeys([]);

    try {
      const keys = await uploadImages(files);
      setUploadedImageKeys(keys);
    } catch (err) {
      setImageUploadError(
        err instanceof Error ? err.message : "Gagal mengunggah gambar."
      );
    } finally {
      setUploadingImages(false);
    }
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!name.trim()) newErrors.name = "Nama produk wajib diisi.";
    if (!description.trim()) newErrors.description = "Deskripsi wajib diisi.";
    if (!fabricType.trim()) newErrors.fabricType = "Jenis kain wajib diisi.";

    const colours = coloursInput
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (colours.length === 0) newErrors.colours = "Masukkan minimal satu warna.";

    if (availableSizes.length === 0)
      newErrors.availableSizes = "Pilih minimal satu ukuran.";

    // Validate size chart completeness
    for (const size of availableSizes) {
      const entry = sizeChartEntries[size];
      if (!entry || !entry.bust.trim() || !entry.waist.trim() || !entry.hip.trim()) {
        newErrors.sizeChart = `Lengkapi tabel ukuran untuk semua ukuran yang dipilih (${size} belum lengkap).`;
        break;
      }
    }

    const price = Number(priceIDR);
    if (!priceIDR || isNaN(price) || price <= 0)
      newErrors.priceIDR = "Harga harus berupa angka positif.";

    if (uploadedImageKeys.length === 0 && !uploadingImages)
      newErrors.images = "Unggah minimal satu gambar produk.";

    if (!preOrderWindowStart)
      newErrors.preOrderWindowStart = "Tanggal mulai pre-order wajib diisi.";
    if (!preOrderWindowEnd)
      newErrors.preOrderWindowEnd = "Tanggal akhir pre-order wajib diisi.";
    if (
      preOrderWindowStart &&
      preOrderWindowEnd &&
      preOrderWindowEnd < preOrderWindowStart
    ) {
      newErrors.preOrderWindowEnd = "Tanggal akhir harus setelah tanggal mulai.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);

    const colours = coloursInput
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const sizeChart: SizeChart = {};
    for (const size of availableSizes) {
      sizeChart[size] = sizeChartEntries[size];
    }

    const payload = {
      name: name.trim(),
      occasion,
      description: description.trim(),
      fabricType: fabricType.trim(),
      colours,
      availableSizes,
      sizeChart,
      priceIDR: Number(priceIDR),
      imageKeys: uploadedImageKeys,
      primaryImageKey: uploadedImageKeys[0],
      preOrderWindowStart,
      preOrderWindowEnd,
    };

    try {
      const res = await authFetch(`${API_URL}/products`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data?.error?.message ?? "Gagal membuat produk.");
        return;
      }

      navigate("/seller");
    } catch {
      setSubmitError("Gagal terhubung ke server. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa" }}>
      {/* Top bar */}
      <div style={topBarStyle}>
        <button onClick={() => navigate("/seller")} style={backButtonStyle}>
          ← Kembali
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Tambah Produk Baru</h1>
        <div style={{ width: 80 }} />
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}
      >
        {/* Basic info */}
        <div style={cardStyle}>
          <h3 style={sectionTitleStyle}>Informasi Produk</h3>

          <Field label="Nama Produk *" error={errors.name}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Baju Kurung Moden Raya"
              style={inputStyle}
              disabled={submitting}
            />
          </Field>

          <Field label="Occasion *" error={errors.occasion}>
            <div style={{ display: "flex", gap: 8 }}>
              {OCCASIONS.map((occ) => (
                <button
                  key={occ}
                  type="button"
                  onClick={() => setOccasion(occ)}
                  style={toggleButtonStyle(occasion === occ)}
                >
                  {occ}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Deskripsi *" error={errors.description}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi produk..."
              rows={4}
              style={{ ...inputStyle, resize: "vertical" }}
              disabled={submitting}
            />
          </Field>

          <Field label="Jenis Kain *" error={errors.fabricType}>
            <input
              type="text"
              value={fabricType}
              onChange={(e) => setFabricType(e.target.value)}
              placeholder="Contoh: Cotton Silk"
              style={inputStyle}
              disabled={submitting}
            />
          </Field>

          <Field label="Warna (pisahkan dengan koma) *" error={errors.colours}>
            <input
              type="text"
              value={coloursInput}
              onChange={(e) => setColoursInput(e.target.value)}
              placeholder="Contoh: Dusty Rose, Sage Green, Navy"
              style={inputStyle}
              disabled={submitting}
            />
          </Field>

          <Field label="Harga (IDR) *" error={errors.priceIDR}>
            <input
              type="number"
              value={priceIDR}
              onChange={(e) => setPriceIDR(e.target.value)}
              placeholder="Contoh: 450000"
              min={1}
              style={inputStyle}
              disabled={submitting}
            />
          </Field>
        </div>

        {/* Sizes & size chart */}
        <div style={cardStyle}>
          <h3 style={sectionTitleStyle}>Ukuran & Tabel Ukuran</h3>

          <Field label="Ukuran Tersedia *" error={errors.availableSizes}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ALL_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => toggleSize(size)}
                  style={toggleButtonStyle(availableSizes.includes(size))}
                >
                  {size}
                </button>
              ))}
            </div>
          </Field>

          {availableSizes.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 10 }}>
                Tabel Ukuran (cm) *
              </div>
              {errors.sizeChart && (
                <p style={errorStyle}>{errors.sizeChart}</p>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    <th style={thStyle}>Ukuran</th>
                    <th style={thStyle}>Dada (cm)</th>
                    <th style={thStyle}>Pinggang (cm)</th>
                    <th style={thStyle}>Pinggul (cm)</th>
                  </tr>
                </thead>
                <tbody>
                  {availableSizes.map((size) => (
                    <tr key={size} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{size}</td>
                      {(["bust", "waist", "hip"] as const).map((field) => (
                        <td key={field} style={tdStyle}>
                          <input
                            type="text"
                            value={sizeChartEntries[size]?.[field] ?? ""}
                            onChange={(e) => updateSizeChart(size, field, e.target.value)}
                            placeholder="76–80"
                            style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                            disabled={submitting}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Images */}
        <div style={cardStyle}>
          <h3 style={sectionTitleStyle}>Gambar Produk</h3>
          <Field label="Upload Gambar (min. 1) *" error={errors.images}>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              disabled={submitting || uploadingImages}
              style={{ fontSize: 13 }}
            />
            {uploadingImages && (
              <span style={{ fontSize: 12, color: "#888" }}>Mengunggah gambar...</span>
            )}
            {imageUploadError && (
              <span style={{ fontSize: 12, color: "#c62828" }}>{imageUploadError}</span>
            )}
            {uploadedImageKeys.length > 0 && (
              <span style={{ fontSize: 12, color: "#22c55e" }}>
                ✓ {uploadedImageKeys.length} gambar berhasil diunggah
              </span>
            )}
            {imageFiles.length > 0 && uploadedImageKeys.length === 0 && !uploadingImages && (
              <span style={{ fontSize: 12, color: "#888" }}>
                {imageFiles.length} file dipilih
              </span>
            )}
          </Field>
        </div>

        {/* Pre-order window */}
        <div style={cardStyle}>
          <h3 style={sectionTitleStyle}>Periode Pre-Order</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Tanggal Mulai *" error={errors.preOrderWindowStart}>
              <input
                type="date"
                value={preOrderWindowStart}
                onChange={(e) => setPreOrderWindowStart(e.target.value)}
                style={inputStyle}
                disabled={submitting}
              />
            </Field>
            <Field label="Tanggal Akhir *" error={errors.preOrderWindowEnd}>
              <input
                type="date"
                value={preOrderWindowEnd}
                onChange={(e) => setPreOrderWindowEnd(e.target.value)}
                style={inputStyle}
                disabled={submitting}
              />
            </Field>
          </div>
        </div>

        {/* Submit */}
        {submitError && (
          <p style={{ ...errorStyle, textAlign: "center" }} role="alert">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || uploadingImages}
          style={submitButtonStyle(submitting || uploadingImages)}
        >
          {submitting ? "Menyimpan..." : "Simpan Produk"}
        </button>
      </form>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {error && <p style={errorStyle}>{error}</p>}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const topBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 24px",
  background: "#fff",
  borderBottom: "1px solid #e0e0e0",
  position: "sticky",
  top: 0,
  zIndex: 100,
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 10,
  padding: "20px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 15,
  fontWeight: 700,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#444",
};

const inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  border: "1px solid #ccc",
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const errorStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#c62828",
};

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 600,
  color: "#555",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 14,
};

const backButtonStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid #ccc",
  borderRadius: 8,
  padding: "8px 16px",
  cursor: "pointer",
  fontSize: 14,
  color: "#333",
};

function toggleButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: "7px 16px",
    borderRadius: 8,
    border: "1px solid " + (active ? "#333" : "#ccc"),
    background: active ? "#333" : "#fff",
    color: active ? "#fff" : "#555",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
  };
}

function submitButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "13px",
    background: disabled ? "#ccc" : "#333",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 15,
    fontWeight: 700,
  };
}
