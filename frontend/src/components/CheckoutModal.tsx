import { useState } from "react";
import { useCartStore } from "../store";
import { generateOrderIntentLink } from "../utils";

const SELLER_PHONE = import.meta.env.VITE_SELLER_PHONE ?? "60123456789";
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Toast {
  message: string;
  type: "error" | "success";
}

export function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);

  const [customerName, setCustomerName] = useState("");
  const [customerWhatsApp, setCustomerWhatsApp] = useState("");
  const [errors, setErrors] = useState<{ name?: string; whatsapp?: string; cart?: string }>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  function validate(): boolean {
    const newErrors: typeof errors = {};

    if (items.length === 0) {
      newErrors.cart = "Keranjang Anda kosong. Tambahkan produk sebelum checkout.";
    }
    if (!customerName.trim()) {
      newErrors.name = "Nama tidak boleh kosong.";
    }
    if (!customerWhatsApp.trim()) {
      newErrors.whatsapp = "Nomor WhatsApp tidak boleh kosong.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function submitOrder() {
    if (!validate()) return;

    setLoading(true);
    setToast(null);

    try {
      const lineItems = items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        size: item.size,
        quantity: item.quantity,
        unitPriceIDR: item.unitPriceIDR,
      }));

      const response = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerWhatsApp: customerWhatsApp.trim(),
          lineItems,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          body?.error?.message ?? "Terjadi kesalahan. Silakan coba lagi.";
        setToast({ type: "error", message });
        return;
      }

      const { orderId } = await response.json();

      const waLink = generateOrderIntentLink(
        items,
        customerName.trim(),
        orderId,
        SELLER_PHONE
      );

      clearCart();
      window.open(waLink, "_blank", "noopener,noreferrer");
      onClose();
    } catch {
      setToast({
        type: "error",
        message: "Gagal terhubung ke server. Silakan coba lagi.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitOrder();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={backdropStyle}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Checkout"
        style={modalStyle}
      >
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Checkout</h2>
          <button
            onClick={onClose}
            aria-label="Tutup modal checkout"
            style={closeButtonStyle}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} noValidate style={bodyStyle}>
          {/* Empty cart error */}
          {errors.cart && (
            <p style={inlineErrorStyle} role="alert">
              {errors.cart}
            </p>
          )}

          {/* Customer Name */}
          <div style={fieldStyle}>
            <label htmlFor="checkout-name" style={labelStyle}>
              Nama Lengkap
            </label>
            <input
              id="checkout-name"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Masukkan nama Anda"
              style={inputStyle}
              disabled={loading}
              aria-describedby={errors.name ? "checkout-name-error" : undefined}
            />
            {errors.name && (
              <p id="checkout-name-error" style={inlineErrorStyle} role="alert">
                {errors.name}
              </p>
            )}
          </div>

          {/* Customer WhatsApp */}
          <div style={fieldStyle}>
            <label htmlFor="checkout-whatsapp" style={labelStyle}>
              Nomor WhatsApp
            </label>
            <input
              id="checkout-whatsapp"
              type="tel"
              value={customerWhatsApp}
              onChange={(e) => setCustomerWhatsApp(e.target.value)}
              placeholder="Contoh: +628123456789"
              style={inputStyle}
              disabled={loading}
              aria-describedby={errors.whatsapp ? "checkout-whatsapp-error" : undefined}
            />
            {errors.whatsapp && (
              <p id="checkout-whatsapp-error" style={inlineErrorStyle} role="alert">
                {errors.whatsapp}
              </p>
            )}
          </div>

          {/* Toast notification */}
          {toast && (
            <div style={toastStyle(toast.type)} role="alert">
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => submitOrder()}
                style={retryButtonStyle}
                disabled={loading}
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || items.length === 0}
            style={submitButtonStyle(loading || items.length === 0)}
          >
            {loading ? "Memproses..." : "Pesan via WhatsApp"}
          </button>
        </form>
      </div>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  zIndex: 1100,
};

const modalStyle: React.CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 420,
  maxWidth: "calc(100vw - 32px)",
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  zIndex: 1101,
  display: "flex",
  flexDirection: "column",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px",
  borderBottom: "1px solid #e0e0e0",
};

const bodyStyle: React.CSSProperties = {
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#333",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #ccc",
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
};

const inlineErrorStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#d32f2f",
};

function toastStyle(type: "error" | "success"): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 8,
    background: type === "error" ? "#fdecea" : "#e8f5e9",
    color: type === "error" ? "#c62828" : "#2e7d32",
    fontSize: 13,
  };
}

const retryButtonStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid currentColor",
  borderRadius: 6,
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: 12,
  color: "inherit",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

function submitButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "12px",
    background: disabled ? "#ccc" : "#25D366",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 0.2s",
  };
}

const closeButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 18,
  color: "#555",
  padding: 4,
  lineHeight: 1,
};
