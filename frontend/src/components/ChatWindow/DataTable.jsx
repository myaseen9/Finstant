import React from 'react';
import styles from './ChatWindow.module.css';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const extractText = (node) => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && node.props && node.props.children) return extractText(node.props.children);
  return '';
};

const toCamelCase = (str) => {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
};

export default function DataTable({ children, messageText, isReportMode, ...props }) {
  const handleDownloadExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Data Report');
      
      const thead = children.find(child => child.type === 'thead');
      const tbody = children.find(child => child.type === 'tbody');
      
      let columnCount = 0;

      // Parse Headers
      if (thead) {
        const headerRow = thead.props.children;
        if (headerRow) {
          const headers = React.Children.toArray(headerRow.props.children).map(th => {
            return toCamelCase(extractText(th));
          });
          columnCount = headers.length;
          worksheet.addRow(headers);
          
          // Style header row
          const row = worksheet.getRow(1);
          row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2D2D2D' } // dark premium color
          };
          row.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      }

      // Parse Body
      if (tbody) {
        const rows = React.Children.toArray(tbody.props.children);
        rows.forEach(tr => {
          const cells = React.Children.toArray(tr.props.children).map(td => {
            let val = extractText(td);
            // Convert to number if it is numeric
            if (!isNaN(val) && val.trim() !== '') {
               return Number(val);
            }
            return val;
          });
          worksheet.addRow(cells);
        });
      }

      // Auto-fit columns and borders
      for (let i = 1; i <= columnCount; i++) {
        let maxLen = 10;
        worksheet.getColumn(i).eachCell({ includeEmpty: true }, function(cell) {
          const colLen = cell.value ? cell.value.toString().length : 10;
          if (colLen > maxLen) {
            maxLen = colLen;
          }
        });
        worksheet.getColumn(i).width = maxLen < 50 ? maxLen + 2 : 50;
      }
      
      worksheet.eachRow({ includeEmpty: true }, function(row) {
        row.eachCell({ includeEmpty: true }, function(cell) {
          cell.border = {
            top: {style:'thin'},
            left: {style:'thin'},
            bottom: {style:'thin'},
            right: {style:'thin'}
          };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `extract_${Date.now()}.xlsx`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Failed to parse table for Excel", e);
    }
  };

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF('p', 'pt', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      const title = "Finstant Data Extract";
      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.text(title, pageWidth / 2, 40, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, 55, { align: 'center' });
      
      let startY = 70;
      if (messageText) {
        doc.setFontSize(11);
        doc.setTextColor(60, 60, 60);
        const splitText = doc.splitTextToSize(messageText.substring(0, 300) + (messageText.length > 300 ? '...' : ''), pageWidth - 80);
        doc.text(splitText, 40, startY);
        startY += (splitText.length * 15) + 20;
      }

      const thead = children.find(child => child.type === 'thead');
      const tbody = children.find(child => child.type === 'tbody');

      let headers = [];
      if (thead) {
        const headerRow = thead.props.children;
        if (headerRow) {
          headers = React.Children.toArray(headerRow.props.children).map(th => extractText(th));
        }
      }

      let data = [];
      if (tbody) {
        const rows = React.Children.toArray(tbody.props.children);
        data = rows.map(tr => {
          return React.Children.toArray(tr.props.children).map(td => extractText(td));
        });
      }

      autoTable(doc, {
        head: [headers],
        body: data,
        startY: startY,
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [45, 45, 45], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        margin: { top: 40, right: 40, bottom: 40, left: 40 },
        didDrawPage: function(data) {
          // Page Border
          doc.setDrawColor(40, 40, 40);
          doc.setLineWidth(0.5);
          doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
          
          // Watermark at the top right
          doc.setFontSize(10);
          doc.setTextColor(150, 150, 150);
          doc.text("Generated by FINSTΛNT", pageWidth - 10, 12, { align: 'right' });
        }
      });
      doc.save(`extract_${Date.now()}.pdf`);
    } catch (e) {
      console.error("Failed to parse table for PDF", e);
    }
  };

  return (
    <div className={styles.tableContainer}>
      <table {...props}>
        {children}
      </table>
      {!isReportMode && (
        <div className={styles.tableFooter}>
          <button onClick={handleDownloadExcel} className={styles.csvBtn}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Excel
          </button>
          <button onClick={handleDownloadPDF} className={styles.csvBtn}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            PDF
          </button>
        </div>
      )}
    </div>
  );
}
