export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function printHtmlDocument(title: string, html: string): void {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!printWindow) {
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body {
            font-family: "Plus Jakarta Sans", system-ui, sans-serif;
            color: #16302b;
            margin: 0;
            padding: 32px;
            line-height: 1.6;
            background: #fbf7ef;
          }
          h1, h2, h3 {
            margin: 0 0 12px;
            color: #21352e;
          }
          .section {
            border: 1px solid #d7ccbd;
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 20px;
            background: #fffdf8;
          }
          .pill {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 999px;
            margin: 0 8px 8px 0;
            background: #ecf4ee;
            font-size: 12px;
            font-weight: 700;
          }
          ul {
            margin: 8px 0 0 18px;
            padding: 0;
          }
          p {
            margin: 8px 0;
          }
          small {
            color: #5b6f66;
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
