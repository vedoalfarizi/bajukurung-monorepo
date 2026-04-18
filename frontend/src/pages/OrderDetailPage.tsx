import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Order, OrderStatus } from "../types";
import { authFetch } from "../utils/auth";
import { generateOrderSummaryMessage, generateTrackingMessage } from "../utils";

const API_URL = import.meta.env.VITE_API_URL ?? "";

// Valid next statuses per current status (mirrors the backend state machine)
const NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING: ["PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_PENDING: ["PACKAGED", "CANCELLED"],
  PACKAGED: ["READY_TO_SHIP", "REFUND"],
  READY_TO_SHIP: ["SHIPPED"],
  SHIPPED: ["DELIVERED", "REFUND"],
  DELIVERED: ["REFUND"],
};

// Fields required per target status
const REQUIRED_FIELDS: Partial<Record<OrderStatus, string[]>> = {
  PACKAGED: ["proofOfPaymentKey"],
  SHIPPED: ["trackingLink"],
  REFUND: ["refundAmountIDR", "proofOfRefundKey"],
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Menunggu",
  PAYMENT_PENDING: "Menunggu Pembayaran",
  PACKAGED: "Dikemas",
  READY_TO_SHIP: "Siap Kirim",
  SHIPPED: "Dikirim",
  DELIVERED: "Terkirim",
  CANCELLED: "Dibatalkan",
  REFUND: "Refund",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: "#f59e0b",
  PAYMENT_PENDING: "#3b82f6",
  PACKAGED: "#8b5cf6",
  READY_TO_SHIP: "#06b6d4",
  SHIPPED: "#10b981",
  DELIVERED: "#22c55e",
  CANCELLED: "#ef4444",
  REFUND: "#f97316",
};

function formatIDR(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Copyable message block ────────────────────────────────────────────────────

function CopyableMessage({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={copyableBoxStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
        <button onClick={handleCopy} style={copyButtonStyle}>
          {copied ? "✓ Disalin" : "Salin"}
        </button>
      </div>
      <pre style={preStyle}>{text}</pre>
    </div>
  );
}

// ── Proof photo upload ────────────────────────────────────────────────────────

interface PhotoUploadProps {
  label: string;
  onUploaded: (key: string) => void;
  disabled?: boolean;
}

function PhotoUpload({ label, onUploaded, disabled }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // 1. Get pre-signed URL from the API
      // Note: orderId is not available here directly; caller passes it via closure
      const res = await authFetch(`${API_URL}/orders/uploads`, {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });

      if (!res.ok) throw new Error("Gagal mendapatkan URL upload.");

      const { uploadUrl, key } = await res.json();

      // 2. Upload directly to S3
      const s3Res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!s3Res.ok) throw new Error("Gagal mengunggah foto.");

      setUploadedKey(key);
      onUploaded(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunggah.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={labelStyle}>{label}</label>
      <input
        type="file"
        accept="image/*"
        onChange={handleFile}
        disabled={disabled || uploading}
        style={{ fontSize: 13 }}
      />
      {uploading && <span style={{ fontSize: 12, color: "#888" }}>Mengunggah...</span>}
      {uploadedKey && (
        <span style={{ fontSize: 12, color: "#22c55e" }}>✓ Foto berhasil diunggah</span>
      )}
      {error && <span style={{ fontSize: 12, color: "#c62828" }}>{error}</span>}
    </div>
  );
}

// ── Transition form ───────────────────────────────────────────────────────────

interface TransitionFormProps {
  orderId: string;
  currentStatus: OrderStatus;
  onSuccess: (updatedOrder: Order) => void;
}

function TransitionForm({ orderId, currentStatus, onSuccess }: TransitionFormProps) {
  const nextStatuses = NEXT_STATUSES[currentStatus] ?? [];
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | null>(null);
  const [trackingLink, setTrackingLink] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [proofOfPaymentKey, setProofOfPaymentKey] = useState("");
  const [proofOfRefundKey, setProofOfRefundKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (nextStatuses.length === 0) return null;

  async function handleTransition() {
    if (!selectedStatus) return;
    setSubmitting(true);
    setError(null);

    const body: Record<string, unknown> = { status: selectedStatus };
    if (trackingLink) body.trackingLink = trackingLink;
    if (refundAmount) body.refundAmountIDR = Number(refundAmount);
    if (proofOfPaymentKey) body.proofOfPaymentKey = proofOfPaymentKey;
    if (proofOfRefundKey) body.proofOfRefundKey = proofOfRefundKey;

    try {
      const res = await authFetch(`${API_URL}/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error?.message ?? "Gagal memperbarui status.");
        return;
      }

      onSuccess(data.order ?? data);
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setSubmitting(false);
    }
  }

  const required = selectedStatus ? (REQUIRED_FIELDS[selectedStatus] ?? []) : [];

  return (
    <div style={sectionStyle}>
      <h3 style={sectionTitleStyle}>Perbarui Status</h3>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {nextStatuses.map((s) => (
          <button
            key={s}
            onClick={() => setSelectedStatus(s === selectedStatus ? null : s)}
            style={actionButtonStyle(s === selectedStatus)}
          >
            → {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Required fields for selected transition */}
      {selectedStatus && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {required.includes("proofOfPaymentKey") && (
            <PhotoUpload
              label="Bukti Pembayaran *"
              onUploaded={setProofOfPaymentKey}
              disabled={submitting}
            />
          )}

          {required.includes("trackingLink") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={labelStyle}>Link Tracking *</label>
              <input
                type="url"
                value={trackingLink}
                onChange={(e) => setTrackingLink(e.target.value)}
                placeholder="https://..."
                style={inputStyle}
                disabled={submitting}
              />
            </div>
          )}

          {required.includes("refundAmountIDR") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={labelStyle}>Jumlah Refund (IDR) *</label>
              <input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="Contoh: 450000"
                style={inputStyle}
                disabled={submitting}
              />
            </div>
          )}

          {required.includes("proofOfRefundKey") && (
            <PhotoUpload
              label="Bukti Refund *"
              onUploaded={setProofOfRefundKey}
              disabled={submitting}
            />
          )}

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: "#c62828" }} role="alert">
              {error}
            </p>
          )}

          <button
            onClick={handleTransition}
            disabled={submitting}
            style={confirmButtonStyle(submitting)}
          >
            {submitting ? "Memproses..." : `Konfirmasi → ${STATUS_LABELS[selectedStatus]}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/orders/${orderId}`);
      if (!res.ok) throw new Error(`Gagal memuat pesanan (${res.status})`);
      const data: Order = await res.json();
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  if (loading) {
    return <div style={centeredStyle}>Memuat detail pesanan...</div>;
  }

  if (error || !order) {
    return (
      <div style={centeredStyle}>
        <p style={{ color: "#c62828" }}>{error ?? "Pesanan tidak ditemukan."}</p>
        <button onClick={() => navigate("/seller")} style={backButtonStyle}>
          ← Kembali
        </button>
      </div>
    );
  }

  const summaryMessage =
    order.status === "PAYMENT_PENDING" ? generateOrderSummaryMessage(order) : null;
  const trackingMessage =
    order.status === "SHIPPED" && order.trackingLink
      ? generateTrackingMessage(order)
      : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa" }}>
      {/* Top bar */}
      <div style={topBarStyle}>
        <button onClick={() => navigate("/seller")} style={backButtonStyle}>
          ← Kembali
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Detail Pesanan</h1>
        <div style={{ width: 80 }} />
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Order summary */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>ID Pesanan</div>
              <div style={{ fontFamily: "monospace", fontSize: 14 }}>{order.orderId}</div>
            </div>
            <span
              style={{
                display: "inline-block",
                padding: "5px 14px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                background: STATUS_COLORS[order.status] + "22",
                color: STATUS_COLORS[order.status],
                border: `1px solid ${STATUS_COLORS[order.status]}44`,
              }}
            >
              {STATUS_LABELS[order.status]}
            </span>
          </div>

          <div style={dividerStyle} />

          <div style={gridStyle}>
            <InfoField label="Nama Pelanggan" value={order.customerName} />
            <InfoField label="WhatsApp" value={order.customerWhatsApp} />
            <InfoField label="Tanggal Pesanan" value={formatDate(order.createdAt)} />
            <InfoField label="Total" value={formatIDR(order.totalPriceIDR)} bold />
          </div>
        </div>

        {/* Line items */}
        <div style={cardStyle}>
          <h3 style={sectionTitleStyle}>Item Pesanan</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th style={thStyle}>Produk</th>
                <th style={thStyle}>Ukuran</th>
                <th style={thStyle}>Qty</th>
                <th style={thStyle}>Harga Satuan</th>
                <th style={thStyle}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.lineItems.map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={tdStyle}>{item.productName}</td>
                  <td style={tdStyle}>{item.size}</td>
                  <td style={tdStyle}>{item.quantity}</td>
                  <td style={tdStyle}>{formatIDR(item.unitPriceIDR)}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    {formatIDR(item.quantity * item.unitPriceIDR)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ textAlign: "right", padding: "12px 16px", fontWeight: 700, fontSize: 15 }}>
            Total: {formatIDR(order.totalPriceIDR)}
          </div>
        </div>

        {/* Proof photos & tracking */}
        {(order.trackingLink || order.proofOfPaymentKey || order.proofOfReceiptKey || order.refundAmountIDR) && (
          <div style={cardStyle}>
            <h3 style={sectionTitleStyle}>Informasi Tambahan</h3>
            <div style={gridStyle}>
              {order.trackingLink && (
                <InfoField
                  label="Link Tracking"
                  value={
                    <a href={order.trackingLink} target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6" }}>
                      {order.trackingLink}
                    </a>
                  }
                />
              )}
              {order.refundAmountIDR != null && (
                <InfoField label="Jumlah Refund" value={formatIDR(order.refundAmountIDR)} />
              )}
              {order.proofOfPaymentKey && (
                <InfoField label="Bukti Pembayaran" value={<ProofPhoto s3Key={order.proofOfPaymentKey} />} />
              )}
              {order.proofOfReceiptKey && (
                <InfoField label="Bukti Penerimaan" value={<ProofPhoto s3Key={order.proofOfReceiptKey} />} />
              )}
              {order.proofOfRefundKey && (
                <InfoField label="Bukti Refund" value={<ProofPhoto s3Key={order.proofOfRefundKey} />} />
              )}
            </div>
          </div>
        )}

        {/* Copyable WhatsApp messages */}
        {summaryMessage && (
          <CopyableMessage
            label="Pesan Ringkasan Pesanan (untuk dikirim ke pelanggan)"
            text={summaryMessage}
          />
        )}
        {trackingMessage && (
          <CopyableMessage
            label="Pesan Link Tracking (untuk dikirim ke pelanggan)"
            text={trackingMessage}
          />
        )}

        {/* Status transition */}
        <div style={cardStyle}>
          <TransitionForm
            orderId={order.orderId}
            currentStatus={order.status}
            onSuccess={(updated) => setOrder(updated)}
          />
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function InfoField({
  label,
  value,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: bold ? 700 : 400 }}>{value}</div>
    </div>
  );
}

function ProofPhoto({ s3Key }: { s3Key: string }) {
  // In production the CDN URL would be constructed from the key.
  // Here we render the key as a link placeholder.
  return (
    <a
      href={`${import.meta.env.VITE_CDN_URL ?? ""}/${s3Key}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "#3b82f6", fontSize: 13 }}
    >
      Lihat Foto
    </a>
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

const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 15,
  fontWeight: 700,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 16,
};

const dividerStyle: React.CSSProperties = {
  borderTop: "1px solid #f0f0f0",
  margin: "16px 0",
};

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 600,
  color: "#555",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 14,
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
};

const centeredStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  gap: 16,
  color: "#888",
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

function actionButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid " + (active ? "#333" : "#ccc"),
    background: active ? "#333" : "#fff",
    color: active ? "#fff" : "#333",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
  };
}

function confirmButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "11px 20px",
    background: disabled ? "#ccc" : "#333",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 14,
    fontWeight: 600,
    alignSelf: "flex-start",
  };
}

const copyableBoxStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e0e0e0",
  borderRadius: 10,
  padding: "16px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};

const copyButtonStyle: React.CSSProperties = {
  padding: "5px 14px",
  background: "#f0f0f0",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const preStyle: React.CSSProperties = {
  margin: 0,
  whiteSpace: "pre-wrap",
  fontFamily: "inherit",
  fontSize: 13,
  color: "#333",
  background: "#f8f9fa",
  padding: "12px",
  borderRadius: 6,
  lineHeight: 1.6,
};
