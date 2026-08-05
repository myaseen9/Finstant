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

export default function DataTable({ children, messageText, ...props }) {
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
      console.error("Failed to generate Excel file", e);
    }
  };

  const handleDownloadPDF = () => {
    try {
      const thead = children.find(child => child.type === 'thead');
      const tbody = children.find(child => child.type === 'tbody');
      
      let head = [];
      let body = [];
      
      if (thead) {
        const headerRow = thead.props.children;
        if (headerRow) {
          head = [React.Children.toArray(headerRow.props.children).map(th => extractText(th))];
        }
      }
      
      if (tbody) {
        const rows = React.Children.toArray(tbody.props.children);
        body = rows.map(tr => {
          return React.Children.toArray(tr.props.children).map(td => extractText(td));
        });
      }
      
      const doc = new jsPDF();
      
      let startY = 20;
      
      if (messageText) {
        let title = "Data Report";
        const lines = messageText.split('\n').filter(l => l.trim().length > 0 && !l.includes('|'));
        if (lines.length > 0) {
           title = lines[0].replace(/#/g, '').replace(/\*\*/g, '').trim();
           if (title.length > 80) title = title.substring(0, 80) + '...';
        }
        
        doc.setFontSize(14);
        doc.text(title, 14, startY);
        startY += 10;
      } else {
        doc.setFontSize(16);
        doc.text("Data Report", 14, startY);
        startY += 10;
      }
      
      autoTable(doc, {
        head: head,
        body: body,
        startY: startY,
        theme: 'grid',
        styles: {
          lineColor: [40, 40, 40],
          lineWidth: 0.1,
          fontSize: 9,
        },
        headStyles: {
          fillColor: [30, 30, 30],
          textColor: [255, 255, 255],
        },
        didDrawPage: function (data) {
          const pageDoc = data.doc;
          const pageWidth = pageDoc.internal.pageSize.width;
          const pageHeight = pageDoc.internal.pageSize.height;
          
          // Page Border
          pageDoc.setDrawColor(40, 40, 40);
          pageDoc.setLineWidth(0.5);
          pageDoc.rect(5, 5, pageWidth - 10, pageHeight - 10);
          
          // Watermark at the top right
          pageDoc.setFontSize(10);
          pageDoc.setTextColor(150, 150, 150);
          pageDoc.text("Generated by FINSTΛNT", pageWidth - 10, 12, { align: 'right' });
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
    </div>
  );
}
