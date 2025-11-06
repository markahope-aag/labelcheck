/**
 * ComplianceSummaryTable Component
 *
 * Displays a comprehensive summary table of compliance evaluation results.
 *
 * Features:
 * - Automatic sorting by section (General → Ingredient → Allergen → Nutrition → Claims → Additional)
 * - Color-coded status badges (compliant = green, potentially non-compliant = yellow, non-compliant = red)
 * - Three-column layout: Element, Status, Rationale
 * - Hover effects for better readability
 *
 * Extracted from app/analyze/page.tsx for better reusability.
 */

import type { ComplianceTableRow } from '@/types';
import { formatComplianceStatus } from '@/lib/formatting';

interface ComplianceSummaryTableProps {
  complianceTable: ComplianceTableRow[];
}

export function ComplianceSummaryTable({ complianceTable }: ComplianceSummaryTableProps) {
  if (!complianceTable || complianceTable.length === 0) {
    return null;
  }

  // Sort compliance table rows by section order
  const sortedRows = [...complianceTable].sort((a, b) => {
    // Define section order to match analysis structure
    const sectionOrder: Record<string, number> = {
      // Section 1: General Labeling
      'Statement of Identity': 100,
      'Product Name': 101,
      'Net Quantity': 110,
      Manufacturer: 120,
      'Manufacturer Address': 121,
      Distributor: 122,

      // Section 2: Ingredient Labeling
      Ingredient: 200,
      Ingredients: 200,
      'Ingredient List': 201,
      'Ingredient Declaration': 202,
      'Ingredient Labeling': 203,

      // Section 3: Allergen Labeling
      Allergen: 300,
      'Major Food Allergen': 301,
      'Allergen Labeling': 302,
      'Allergen Declaration': 303,
      FALCPA: 304,

      // Section 4: Nutrition/Supplement Facts
      Nutrition: 400,
      'Nutrition Facts': 401,
      'Nutrition Labeling': 402,
      'Supplement Facts': 410,
      'Supplement Facts Panel': 411,

      // Section 5: Claims
      Claims: 500,
      Structure: 501,
      'Nutrient Content': 502,
      'Health Claims': 503,

      // Section 6: Additional Requirements
      Fortification: 600,
      GRAS: 610,
      'GRAS Ingredient': 611,
      NDI: 620,
      'New Dietary Ingredient': 621,
      cGMP: 630,
    };

    // Find the lowest matching order value for each element
    const getOrder = (element: string) => {
      const lowerElement = element.toLowerCase();
      for (const [key, value] of Object.entries(sectionOrder)) {
        if (lowerElement.includes(key.toLowerCase())) {
          return value;
        }
      }
      return 999; // Unknown items go to the end
    };

    return getOrder(a.element) - getOrder(b.element);
  });

  return (
    <div className="mt-12 pt-8 border-t-4 border-slate-300">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-slate-900 mb-2">Summary of Compliance Evaluation</h3>
        <p className="text-sm text-slate-600">
          This table summarizes the compliance status for all sections analyzed above
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-4 py-2 text-left text-sm font-semibold text-slate-900">
                Labeling Element
              </th>
              <th className="border border-slate-300 px-4 py-2 text-left text-sm font-semibold text-slate-900">
                Compliance Status
              </th>
              <th className="border border-slate-300 px-4 py-2 text-left text-sm font-semibold text-slate-900">
                Rationale/Condition for Compliance
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row: ComplianceTableRow, idx: number) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="border border-slate-300 px-4 py-2 text-sm text-slate-900">
                  {row.element}
                </td>
                <td className="border border-slate-300 px-4 py-2 text-sm">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      row.status.toLowerCase().includes('compliant') &&
                      !row.status.toLowerCase().includes('non')
                        ? 'bg-green-100 text-green-800'
                        : row.status.toLowerCase().includes('potentially')
                          ? 'bg-yellow-100 text-yellow-800'
                          : row.status.toLowerCase().includes('non')
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {formatComplianceStatus(row.status)}
                  </span>
                </td>
                <td className="border border-slate-300 px-4 py-2 text-sm text-slate-700">
                  {row.rationale}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
