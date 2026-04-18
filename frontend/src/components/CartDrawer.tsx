import { useState } from "react";
import { useCartStore } from "../store";
import type { CartItem } from "../types";
import { CheckoutModal } from "./CheckoutModal";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function CartLineItem({ item, onRemove }: { item: CartItem; onRemove: () => void }) {
  const lineTotal = item.quantity * item.unitPriceIDR;

  return (
    <div style={lineItemStyle}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{item.productName}</div>
        <div style={{ fontSize: 13, color: "#666" }}>
          Ukuran: {item.size} &nbsp;·&nbsp; Qty: {item.quantity}
        </div>
        <div style={{ fontSize: 13, color: "#444", marginTop: 2 }}>
          {formatIDR(item.unitPriceIDR)} × {item.quantity} = <strong>{formatIDR(lineTotal)}</strong>
        </div>
      </div>
      <button
        onClick={onRemove}
        aria-label={`Hapus ${item.productName} (${item.size}) dari keranjang`}
        style={removeButtonStyle}
      >
        ✕
      </button>
    </div>
  );
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal);
  const removeItem = useCartStore((s) => s.removeItem);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          aria-hidden="true"
          style={backdropStyle}
        />
      )}

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keranjang Belanja"
        style={{
          ...drawerStyle,
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Keranjang Belanja</h2>
          <button onClick={onClose} aria-label="Tutup keranjang" style={closeButtonStyle}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          {items.length === 0 ? (
            <p style={{ color: "#888", textAlign: "center", marginTop: 40 }}>
              Keranjang Anda masih kosong.
            </p>
          ) : (
            items.map((item) => (
              <CartLineItem
                key={`${item.productId}-${item.size}`}
                item={item}
                onRemove={() => removeItem(item.productId, item.size)}
              />
            ))
          )}
        </div>

        {/* Footer — subtotal */}
        {items.length > 0 && (
          <div style={footerStyle}>
            <span style={{ fontWeight: 600 }}>Subtotal</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{formatIDR(subtotal)}</span>
          </div>
        )}

        {/* Checkout button */}
        {items.length > 0 && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid #e0e0e0" }}>
            <button
              onClick={() => setCheckoutOpen(true)}
              style={checkoutButtonStyle}
              aria-label="Lanjut ke checkout"
            >
              Checkout via WhatsApp
            </button>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
      />
    </>
  );
}

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  zIndex: 999,
};

const drawerStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  width: 360,
  maxWidth: "100vw",
  height: "100vh",
  background: "#fff",
  boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
  zIndex: 1000,
  display: "flex",
  flexDirection: "column",
  transition: "transform 0.3s ease",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px",
  borderBottom: "1px solid #e0e0e0",
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "12px 20px",
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 20px",
  borderTop: "1px solid #e0e0e0",
  background: "#fafafa",
};

const lineItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid #f0f0f0",
};

const removeButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#999",
  fontSize: 16,
  padding: 4,
  lineHeight: 1,
  flexShrink: 0,
};

const closeButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 18,
  color: "#555",
  padding: 4,
  lineHeight: 1,
};

const checkoutButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  background: "#25D366",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
