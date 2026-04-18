import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { Order, OrderStatus } from "../types";
import { authFetch, redirectToLogout } from "../utils/auth";

const API_URL = import.meta.env.VITE_API_URL ?? "";

const ALL_STATUSES: OrderStatus[] = [
  "PENDING",
  "PAYMENT_PENDING",
  "PACKAGED",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUND",
];

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
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: STATUS_COLORS[status] + "22",
        color: STATUS_COLORS[status],
        border: `1px solid ${STATUS_COLORS[status]}44`,
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

interface OrderRowProps {
  order: Order;
  onClick: () => void;
}

function OrderRow({ order, onClick }: OrderRowProps) {
  return (
    <tr
      onClick={onClick}
      style={{ cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <td style={tdStyle}>
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "#555" }}>
          {order.orderId.slice(0, 8)}…
        </span>
      </td>
      <td style={tdStyle}>
        <StatusBadge status={order.status} />
      </td>
      <td style={tdStyle}>
        <div style={{ fontWeight: 600 }}>{order.customerName}</div>
        <div style={{ fontSize: 12, color: "#666" }}>{order.customerWhatsApp}</div>
      </td>
      <td style={tdStyle}>
        {order.lineItems.map((item, i) => (
          <div key={i} style={{ fontSize: 13, color: "#444" }}>
            {item.productName} — {item.size} × {item.quantity}
          </div>
        ))}
      </td>
      <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: "nowrap" }}>
        {formatIDR(order.totalPriceIDR)}
      </td>
      <td style={{ ...tdStyle, fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>
        {formatDate(order.createdAt)}
      </td>
    </tr>
  );
}

export function SellerDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeStatus, setActiveStatus] = useState<OrderStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (status: OrderStatus | "ALL") => {
    setLoading(true);
    setError(null);
    try {
      const url =
        status === "ALL"
          ? `${API_URL}/orders`
          : `${API_URL}/orders?status=${status}`;
      const res = await authFetch(url);
      if (!res.ok) throw new Error(`Gagal memuat pesanan (${res.status})`);
      const data: Order[] = await res.json();
      setOrders(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan. Silakan coba lagi."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(activeStatus);
  }, [activeStatus, fetchOrders]);

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa" }}>
      {/* Top bar */}
      <div style={topBarStyle}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
          Dashboard Penjual
        </h1>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => navigate("/seller/products/new")}
            style={primaryButtonStyle}
          >
            + Tambah Produk
          </button>
          <button onClick={redirectToLogout} style={outlineButtonStyle}>
            Keluar
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        {/* Status filter tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          <button
            onClick={() => setActiveStatus("ALL")}
            style={tabStyle(activeStatus === "ALL")}
          >
            Semua
          </button>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setActiveStatus(s)}
              style={tabStyle(activeStatus === s)}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && (
          <div style={centeredStyle}>Memuat pesanan...</div>
        )}

        {!loading && error && (
          <div style={{ ...centeredStyle, color: "#c62828" }}>
            <p>{error}</p>
            <button
              onClick={() => fetchOrders(activeStatus)}
              style={primaryButtonStyle}
            >
              Coba Lagi
            </button>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div style={centeredStyle}>Tidak ada pesanan ditemukan.</div>
        )}

        {!loading && !error && orders.length > 0 && (
          <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                  <th style={thStyle}>ID Pesanan</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Pelanggan</th>
                  <th style={thStyle}>Item</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <OrderRow
                    key={order.orderId}
                    order={order}
                    onClick={() => navigate(`/seller/orders/${order.orderId}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const topBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 24px",
  background: "#fff",
  borderBottom: "1px solid #e0e0e0",
  position: "sticky",
  top: 0,
  zIndex: 100,
};

const thStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: 13,
  fontWeight: 600,
  color: "#555",
  borderBottom: "1px solid #e0e0e0",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  verticalAlign: "top",
  fontSize: 14,
};

const centeredStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "48px 0",
  color: "#888",
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "7px 16px",
    borderRadius: 20,
    border: "1px solid " + (active ? "#333" : "#ccc"),
    background: active ? "#333" : "#fff",
    color: active ? "#fff" : "#555",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
  };
}

const primaryButtonStyle: React.CSSProperties = {
  padding: "9px 18px",
  background: "#333",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
};

const outlineButtonStyle: React.CSSProperties = {
  padding: "9px 18px",
  background: "#fff",
  color: "#333",
  border: "1px solid #ccc",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
};
