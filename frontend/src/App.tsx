import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CataloguePage, ProductDetailPage } from "./pages";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CataloguePage />} />
        <Route path="/products/:productId" element={<ProductDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
