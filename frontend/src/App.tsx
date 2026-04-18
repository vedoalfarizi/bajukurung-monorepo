import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CataloguePage, ProductDetailPage, SellerDashboard, OrderDetailPage, AddProductPage, SellerAuthCallback } from "./pages";
import { RequireAuth } from "./components";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Customer-facing routes */}
        <Route path="/" element={<CataloguePage />} />
        <Route path="/products/:productId" element={<ProductDetailPage />} />

        {/* Cognito callback */}
        <Route path="/seller/callback" element={<SellerAuthCallback />} />

        {/* Seller dashboard — all routes require auth */}
        <Route
          path="/seller"
          element={
            <RequireAuth>
              <SellerDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/seller/orders/:orderId"
          element={
            <RequireAuth>
              <OrderDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/seller/products/new"
          element={
            <RequireAuth>
              <AddProductPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
