interface AnalysisData {
  id: string;
  image_name: string;
  analysis_result: any; // New regulatory analysis schema
  compliance_status: string;
  issues_found: number;
  created_at: string;
}

export function generateCSV(analyses: AnalysisData[]): string {
  const headers = [
    'Date',
    'Product Name',
    'Product Type',
    'Overall Compliance',
    'Confidence',
    'Critical Issues',
    'Summary',
    'Key Findings',
  ];

  const rows = analyses.map((analysis) => {
    const result = analysis.analysis_result;
    const criticalIssues =
      result.recommendations?.filter((r: any) => r.priority === 'critical' || r.priority === 'high')
        .length || 0;
    const keyFindings = result.overall_assessment?.key_findings?.join('; ') || '';

    return [
      new Date(analysis.created_at).toLocaleDateString(),
      result.product_name || 'Unknown',
      result.product_type || 'Unknown',
      result.overall_assessment?.primary_compliance_status || 'unknown',
      result.overall_assessment?.confidence_level || 'unknown',
      criticalIssues,
      (result.overall_assessment?.summary || '').replace(/"/g, '""'),
      keyFindings.replace(/"/g, '""'),
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

export function generateJSON(analyses: AnalysisData[]): string {
  const exportData = analyses.map((analysis) => ({
    id: analysis.id,
    date: analysis.created_at,
    image_name: analysis.image_name,
    compliance_status: analysis.compliance_status,
    issues_found: analysis.issues_found,
    analysis: analysis.analysis_result,
  }));

  return JSON.stringify(exportData, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function exportAnalysesAsCSV(analyses: AnalysisData[]) {
  const csv = generateCSV(analyses);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadFile(csv, `label-analyses-${timestamp}.csv`, 'text/csv');
}

export function exportAnalysesAsJSON(analyses: AnalysisData[]) {
  const json = generateJSON(analyses);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadFile(json, `label-analyses-${timestamp}.json`, 'application/json');
}

export async function exportAnalysesAsPDF(analyses: AnalysisData[]) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF();
  const timestamp = new Date().toLocaleDateString();

  doc.setFontSize(20);
  doc.text('Label Compliance Report', 14, 20);

  doc.setFontSize(10);
  doc.text(`Generated: ${timestamp}`, 14, 28);
  doc.text(`Total Analyses: ${analyses.length}`, 14, 33);

  const compliantCount = analyses.filter((a) => a.compliance_status === 'compliant').length;
  doc.text(`Compliant: ${compliantCount}/${analyses.length}`, 14, 38);

  autoTable(doc, {
    startY: 45,
    head: [['Date', 'Product', 'Compliance Status', 'Critical Issues']],
    body: analyses.map((analysis) => {
      const result = analysis.analysis_result;
      const criticalIssues =
        result.recommendations?.filter(
          (r: any) => r.priority === 'critical' || r.priority === 'high'
        ).length || 0;
      const status =
        result.overall_assessment?.primary_compliance_status || analysis.compliance_status;

      return [
        new Date(analysis.created_at).toLocaleDateString(),
        result.product_name || 'Unknown',
        status.replace(/_/g, ' '),
        criticalIssues.toString(),
      ];
    }),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
  });

  let yPos = (doc as any).lastAutoTable.finalY + 15;

  analyses.forEach((analysis, index) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    const result = analysis.analysis_result;

    doc.setFontSize(14);
    doc.text(`${index + 1}. ${result.product_name || 'Unknown Product'}`, 14, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.text(`Date: ${new Date(analysis.created_at).toLocaleString()}`, 14, yPos);
    yPos += 5;

    const complianceStatus =
      result.overall_assessment?.primary_compliance_status || analysis.compliance_status;
    doc.text(`Status: ${complianceStatus.replace(/_/g, ' ')}`, 14, yPos);
    yPos += 5;

    doc.text(`Critical Issues: ${analysis.issues_found}`, 14, yPos);
    yPos += 8;

    const summary = result.overall_assessment?.summary || result.summary;
    if (summary) {
      doc.setFontSize(9);
      const summaryLines = doc.splitTextToSize(summary, 180);
      doc.text(summaryLines, 14, yPos);
      yPos += summaryLines.length * 5 + 5;
    }

    if (result.recommendations && result.recommendations.length > 0) {
      doc.setFontSize(10);
      doc.text('Top Recommendations:', 14, yPos);
      yPos += 5;
      doc.setFontSize(9);
      result.recommendations.slice(0, 3).forEach((rec: any) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        const recText = typeof rec === 'string' ? rec : rec.recommendation;
        const recLines = doc.splitTextToSize(`• ${recText}`, 175);
        doc.text(recLines, 16, yPos);
        yPos += recLines.length * 4.5 + 2;
      });
    }

    yPos += 10;
  });

  const pdfTimestamp = new Date().toISOString().split('T')[0];
  doc.save(`label-compliance-report-${pdfTimestamp}.pdf`);
}

export async function exportSingleAnalysisAsPDF(analysis: AnalysisData) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF();
  const result = analysis.analysis_result;

  // Header
  doc.setFillColor(37, 99, 235); // Blue-600
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text(result.product_name || 'Label Compliance Analysis', 14, 20);

  doc.setFontSize(11);
  doc.text(result.product_type || 'Regulatory Analysis', 14, 28);

  doc.setFontSize(9);
  doc.text(`Analysis Date: ${new Date(analysis.created_at).toLocaleString()}`, 14, 35);

  // Overall Compliance Status Badge
  const complianceStatus = result.overall_assessment?.primary_compliance_status || 'unknown';
  const statusColor: [number, number, number] =
    complianceStatus === 'compliant' || complianceStatus === 'likely_compliant'
      ? [34, 197, 94]
      : complianceStatus === 'potentially_non_compliant'
        ? [234, 179, 8]
        : [239, 68, 68];

  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.rect(150, 12, 48, 16, 'F');
  doc.setFontSize(10);
  doc.text(complianceStatus.toUpperCase().replace(/_/g, ' '), 174, 22, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  let yPos = 50;

  // Overall Assessment
  if (result.overall_assessment) {
    doc.setFillColor(239, 246, 255);
    doc.rect(10, yPos, 190, 30, 'F');

    doc.setFontSize(14);
    doc.text('Overall Compliance Assessment', 14, yPos + 8);

    doc.setFontSize(10);
    doc.text(`Confidence: ${result.overall_assessment.confidence_level || 'N/A'}`, 160, yPos + 8);

    doc.setFontSize(9);
    const summaryLines = doc.splitTextToSize(
      result.overall_assessment.summary || 'No summary available',
      180
    );
    doc.text(summaryLines, 14, yPos + 16);

    yPos += 35;
  }

  // Key Findings
  if (
    result.overall_assessment?.key_findings &&
    result.overall_assessment.key_findings.length > 0
  ) {
    doc.setFontSize(12);
    doc.text('Key Findings', 14, yPos);
    yPos += 6;

    doc.setFontSize(9);
    result.overall_assessment.key_findings.forEach((finding: string, idx: number) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      const findingLines = doc.splitTextToSize(`• ${finding}`, 180);
      doc.text(findingLines, 14, yPos);
      yPos += findingLines.length * 4.5 + 2;
    });
    yPos += 5;
  }

  // Compliance Summary Table
  if (result.compliance_table && result.compliance_table.length > 0) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.text('Compliance Summary', 14, yPos);
    yPos += 5;

    autoTable(doc, {
      startY: yPos,
      head: [['Labeling Element', 'Status', 'Rationale']],
      body: result.compliance_table.map((row: any) => [row.element, row.status, row.rationale]),
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 35 },
        2: { cellWidth: 'auto' },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Detailed Sections - New Page
  doc.addPage();
  yPos = 20;

  doc.setFontSize(16);
  doc.text('Detailed Regulatory Analysis', 14, yPos);
  yPos += 10;

  // General Labeling
  if (result.general_labeling) {
    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.text('1. General Labeling Requirements', 14, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 7;

    ['statement_of_identity', 'net_quantity', 'manufacturer_address'].forEach((key) => {
      if (result.general_labeling[key]) {
        const section = result.general_labeling[key];
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(
          `${key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}: ${section.status}`,
          14,
          yPos
        );
        doc.setFont('helvetica', 'normal');
        yPos += 5;

        doc.setFontSize(8);
        const detailLines = doc.splitTextToSize(section.details, 180);
        doc.text(detailLines, 14, yPos);
        yPos += detailLines.length * 4 + 3;

        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
      }
    });
  }

  // Ingredient Labeling
  if (result.ingredient_labeling) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.text('2. Ingredient Labeling', 14, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 7;

    doc.setFontSize(10);
    doc.text(`Status: ${result.ingredient_labeling.status}`, 14, yPos);
    yPos += 6;

    if (
      result.ingredient_labeling.ingredients_list &&
      result.ingredient_labeling.ingredients_list.length > 0
    ) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Ingredients:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 4;
      const ingredientText = result.ingredient_labeling.ingredients_list.join(', ');
      const ingredientLines = doc.splitTextToSize(ingredientText, 180);
      doc.text(ingredientLines, 14, yPos);
      yPos += ingredientLines.length * 4 + 5;
    }

    if (result.ingredient_labeling.details) {
      doc.setFontSize(8);
      const detailLines = doc.splitTextToSize(result.ingredient_labeling.details, 180);
      doc.text(detailLines, 14, yPos);
      yPos += detailLines.length * 4 + 8;
    }
  }

  // Allergen Labeling
  if (result.allergen_labeling) {
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.text('3. Allergen Labeling (FALCPA/FASTER Act)', 14, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 7;

    doc.setFontSize(10);
    doc.text(`Status: ${result.allergen_labeling.status}`, 14, yPos);
    doc.text(`Risk Level: ${result.allergen_labeling.risk_level || 'N/A'}`, 100, yPos);
    yPos += 7;

    if (
      result.allergen_labeling.potential_allergens &&
      result.allergen_labeling.potential_allergens.length > 0
    ) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Potential Allergen-Containing Ingredients:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 4;
      result.allergen_labeling.potential_allergens.forEach((allergen: string) => {
        doc.text(`• ${allergen}`, 14, yPos);
        yPos += 4;
      });
      yPos += 3;
    }

    if (result.allergen_labeling.details) {
      doc.setFontSize(8);
      const detailLines = doc.splitTextToSize(result.allergen_labeling.details, 180);
      doc.text(detailLines, 14, yPos);
      yPos += detailLines.length * 4 + 8;
    }
  }

  // Nutrition Labeling
  if (result.nutrition_labeling) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.text('4. Nutrition Labeling', 14, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 7;

    doc.setFontSize(10);
    doc.text(`Status: ${result.nutrition_labeling.status}`, 14, yPos);
    yPos += 5;
    doc.text(`Panel Present: ${result.nutrition_labeling.panel_present ? 'Yes' : 'No'}`, 14, yPos);
    doc.text(
      `Exemption Applicable: ${result.nutrition_labeling.exemption_applicable ? 'Yes' : 'No'}`,
      90,
      yPos
    );
    yPos += 7;

    if (result.nutrition_labeling.exemption_reason) {
      doc.setFillColor(239, 246, 255);
      doc.rect(10, yPos - 3, 190, 15, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Exemption Reason:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 4;
      const exemptionLines = doc.splitTextToSize(result.nutrition_labeling.exemption_reason, 180);
      doc.text(exemptionLines, 14, yPos);
      yPos += exemptionLines.length * 4 + 8;
    }

    if (result.nutrition_labeling.details) {
      doc.setFontSize(8);
      const detailLines = doc.splitTextToSize(result.nutrition_labeling.details, 180);
      doc.text(detailLines, 14, yPos);
      yPos += detailLines.length * 4 + 8;
    }
  }

  // Recommendations - New Page
  if (result.recommendations && result.recommendations.length > 0) {
    doc.addPage();
    yPos = 20;

    doc.setFontSize(16);
    doc.text('Recommendations', 14, yPos);
    yPos += 10;

    result.recommendations.forEach((rec: any, index: number) => {
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      const priorityColor: [number, number, number] =
        rec.priority === 'critical'
          ? [220, 38, 38]
          : rec.priority === 'high'
            ? [234, 88, 12]
            : rec.priority === 'medium'
              ? [202, 138, 4]
              : [37, 99, 235];

      doc.setFillColor(priorityColor[0], priorityColor[1], priorityColor[2]);
      doc.rect(14, yPos - 3, 30, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(rec.priority.toUpperCase(), 29, yPos + 1, { align: 'center' });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      const recLines = doc.splitTextToSize(rec.recommendation, 150);
      doc.text(recLines, 48, yPos);
      yPos += recLines.length * 5 + 2;

      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Regulation: ${rec.regulation}`, 48, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 8;
    });
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated by LabelCheck - Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
  }

  const filename = `${(result.product_name || 'analysis').toLowerCase().replace(/\s+/g, '-')}-compliance-report-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
