function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function createSimplePdf(lines: string[]) {
  const pageLines = lines.slice(0, 42);
  const commands: string[] = ["BT", "/F1 11 Tf", "50 790 Td"];
  pageLines.forEach((line, index) => {
    if (index > 0) {
      commands.push("0 -16 Td");
    }
    commands.push(`(${escapePdfText(line)}) Tj`);
  });
  commands.push("ET");
  const stream = commands.join("\n");
  const streamLength = Buffer.byteLength(stream, "utf8");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let body = "";
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += object;
  }

  const header = "%PDF-1.4\n";
  const xrefStart = Buffer.byteLength(header + body, "utf8");
  const xrefEntries = offsets
    .map((offset, index) => {
      if (index === 0) {
        return "0000000000 65535 f ";
      }
      const absoluteOffset = Buffer.byteLength(header, "utf8") + offset;
      return `${String(absoluteOffset).padStart(10, "0")} 00000 n `;
    })
    .join("\n");

  const trailer = [
    "xref",
    `0 ${offsets.length}`,
    xrefEntries,
    "trailer",
    `<< /Size ${offsets.length} /Root 1 0 R >>`,
    "startxref",
    String(xrefStart),
    "%%EOF",
  ].join("\n");

  return Buffer.from(header + body + trailer, "utf8");
}
