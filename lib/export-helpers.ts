interface AnalysisData {
  id: string;
  image_name: string;
  analysis_result: {
    product_name: string;
    summary: string;
    ingredients: string[];
    nutrition_facts: Record<string, string>;
    health_score: number;
    recommendations: string[];
  };
  compliance_status: string;
  issues_found: number;
  created_at: string;
}

export function generateCSV(analyses: AnalysisData[]): string {
  const headers = [
    'Date',
    'Product Name',
    'Health Score',
    'Compliance Status',
    'Issues Found',
    'Summary',
    'Ingredients',
    'Recommendations',
  ];

  const rows = analyses.map((analysis) => {
    const result = analysis.analysis_result;
    return [
      new Date(analysis.created_at).toLocaleDateString(),
      result.product_name || 'Unknown',
      result.health_score || 0,
      analysis.compliance_status,
      analysis.issues_found,
      (result.summary || '').replace(/"/g, '""'),
      (result.ingredients || []).join('; ').replace(/"/g, '""'),
      (result.recommendations || []).join('; ').replace(/"/g, '""'),
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
    product_name: analysis.analysis_result.product_name,
    health_score: analysis.analysis_result.health_score,
    compliance_status: analysis.compliance_status,
    issues_found: analysis.issues_found,
    summary: analysis.analysis_result.summary,
    ingredients: analysis.analysis_result.ingredients,
    nutrition_facts: analysis.analysis_result.nutrition_facts,
    recommendations: analysis.analysis_result.recommendations,
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
  downloadFile(csv, `food-label-analyses-${timestamp}.csv`, 'text/csv');
}

export function exportAnalysesAsJSON(analyses: AnalysisData[]) {
  const json = generateJSON(analyses);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadFile(json, `food-label-analyses-${timestamp}.json`, 'application/json');
}

export async function exportAnalysesAsPDF(analyses: AnalysisData[]) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF();
  const timestamp = new Date().toLocaleDateString();

  doc.setFontSize(20);
  doc.text('Food Label Analysis Report', 14, 20);

  doc.setFontSize(10);
  doc.text(`Generated: ${timestamp}`, 14, 28);
  doc.text(`Total Analyses: ${analyses.length}`, 14, 33);

  const avgScore = analyses.reduce((sum, a) => sum + (a.analysis_result.health_score || 0), 0) / analyses.length;
  doc.text(`Average Health Score: ${avgScore.toFixed(1)}/100`, 14, 38);

  const compliantCount = analyses.filter(a => a.compliance_status === 'compliant').length;
  doc.text(`Compliant: ${compliantCount}/${analyses.length}`, 14, 43);

  autoTable(doc, {
    startY: 50,
    head: [['Date', 'Product', 'Score', 'Status', 'Issues']],
    body: analyses.map(analysis => [
      new Date(analysis.created_at).toLocaleDateString(),
      analysis.analysis_result.product_name || 'Unknown',
      (analysis.analysis_result.health_score || 0).toString(),
      analysis.compliance_status,
      analysis.issues_found.toString(),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
  });

  let yPos = (doc as any).lastAutoTable.finalY + 15;

  analyses.forEach((analysis, index) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text(`${index + 1}. ${analysis.analysis_result.product_name || 'Unknown Product'}`, 14, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.text(`Date: ${new Date(analysis.created_at).toLocaleString()}`, 14, yPos);
    yPos += 5;
    doc.text(`Health Score: ${analysis.analysis_result.health_score || 0}/100`, 14, yPos);
    yPos += 5;
    doc.text(`Compliance: ${analysis.compliance_status} (${analysis.issues_found} issues)`, 14, yPos);
    yPos += 8;

    if (analysis.analysis_result.summary) {
      doc.setFontSize(9);
      const summaryLines = doc.splitTextToSize(analysis.analysis_result.summary, 180);
      doc.text(summaryLines, 14, yPos);
      yPos += summaryLines.length * 5 + 5;
    }

    if (analysis.analysis_result.recommendations && analysis.analysis_result.recommendations.length > 0) {
      doc.setFontSize(10);
      doc.text('Recommendations:', 14, yPos);
      yPos += 5;
      doc.setFontSize(9);
      analysis.analysis_result.recommendations.slice(0, 3).forEach(rec => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        const recLines = doc.splitTextToSize(`• ${rec}`, 175);
        doc.text(recLines, 16, yPos);
        yPos += recLines.length * 4.5 + 2;
      });
    }

    yPos += 10;
  });

  const pdfTimestamp = new Date().toISOString().split('T')[0];
  doc.save(`food-label-report-${pdfTimestamp}.pdf`);
}

export async function exportSingleAnalysisAsPDF(analysis: AnalysisData) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF();
  const result = analysis.analysis_result;

  doc.setFontSize(22);
  doc.text(result.product_name || 'Food Label Analysis', 14, 20);

  doc.setFontSize(10);
  doc.text(`Analysis Date: ${new Date(analysis.created_at).toLocaleString()}`, 14, 30);
  doc.text(`Compliance Status: ${analysis.compliance_status}`, 14, 36);
  doc.text(`Issues Found: ${analysis.issues_found}`, 14, 42);

  const scoreColor: [number, number, number] = result.health_score >= 70 ? [34, 197, 94] : result.health_score >= 40 ? [234, 179, 8] : [239, 68, 68];
  doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.rect(150, 25, 45, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(`${result.health_score || 0}/100`, 172.5, 38, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  let yPos = 55;

  if (result.summary) {
    doc.setFontSize(12);
    doc.text('Summary', 14, yPos);
    yPos += 7;
    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(result.summary, 180);
    doc.text(summaryLines, 14, yPos);
    yPos += summaryLines.length * 5 + 10;
  }

  if (result.nutrition_facts && Object.keys(result.nutrition_facts).length > 0) {
    doc.setFontSize(12);
    doc.text('Nutrition Facts', 14, yPos);
    yPos += 7;

    autoTable(doc, {
      startY: yPos,
      head: [['Nutrient', 'Value']],
      body: Object.entries(result.nutrition_facts).map(([key, value]) => [
        key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value as string,
      ]),
      theme: 'plain',
      headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  if (result.ingredients && result.ingredients.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.text('Ingredients', 14, yPos);
    yPos += 7;
    doc.setFontSize(9);
    const ingredientText = result.ingredients.join(', ');
    const ingredientLines = doc.splitTextToSize(ingredientText, 180);
    doc.text(ingredientLines, 14, yPos);
    yPos += ingredientLines.length * 4.5 + 10;
  }

  if (result.recommendations && result.recommendations.length > 0) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.text('Recommendations', 14, yPos);
    yPos += 7;
    doc.setFontSize(10);

    result.recommendations.forEach((rec, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      const recLines = doc.splitTextToSize(`${index + 1}. ${rec}`, 175);
      doc.text(recLines, 14, yPos);
      yPos += recLines.length * 5 + 3;
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('Generated by LabelCheck - Food Label Compliance Checker', 105, 285, { align: 'center' });

  const filename = `${(result.product_name || 'analysis').toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
