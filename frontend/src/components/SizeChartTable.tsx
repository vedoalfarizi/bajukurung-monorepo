import type { SizeChart, StandardSize } from "../types";

interface SizeChartTableProps {
  sizeChart: SizeChart;
  availableSizes: StandardSize[];
}

export function SizeChartTable({ sizeChart, availableSizes }: SizeChartTableProps) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 14,
      }}
    >
      <thead>
        <tr style={{ background: "#f5f5f5" }}>
          <th style={thStyle}>Ukuran</th>
          <th style={thStyle}>Dada (cm)</th>
          <th style={thStyle}>Pinggang (cm)</th>
          <th style={thStyle}>Pinggul (cm)</th>
        </tr>
      </thead>
      <tbody>
        {availableSizes.map((size) => {
          const entry = sizeChart[size];
          const isAllSize = size === "AllSize";
          return (
            <tr key={size} style={{ borderBottom: "1px solid #e0e0e0" }}>
              <td style={tdStyle}>
                <strong>{size}</strong>
              </td>
              {isAllSize ? (
                <td colSpan={3} style={{ ...tdStyle, color: "#555", fontStyle: "italic" }}>
                  Cocok untuk berbagai bentuk tubuh, setara ukuran M atau L
                </td>
              ) : (
                <>
                  <td style={tdStyle}>{entry?.bust ?? "—"}</td>
                  <td style={tdStyle}>{entry?.waist ?? "—"}</td>
                  <td style={tdStyle}>{entry?.hip ?? "—"}</td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontWeight: 600,
  borderBottom: "2px solid #ddd",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  verticalAlign: "middle",
};
