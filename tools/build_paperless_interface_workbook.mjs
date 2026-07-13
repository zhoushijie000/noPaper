import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataPath = path.join(rootDir, "tmp", "pdfs", "paperless_interfaces.json");
const outputDir = path.join(rootDir, "outputs", "paperless_interfaces");
const outputPath = path.join(outputDir, "无纸化接口清单.xlsx");
const previewPath = path.join(outputDir, "接口清单预览.png");

const rows = JSON.parse(await fs.readFile(dataPath, "utf8"));
const headers = [
  "系统名称",
  "路由编码(routeCode)",
  "路由名称(routeName)",
  "后端API路径(backendPath)",
  "项目分组(projectName)",
];

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("接口清单");
sheet.showGridLines = false;

const matrix = [
  headers,
  ...rows.map((row) => headers.map((header) => row[header] ?? "")),
];

sheet.getRangeByIndexes(0, 0, matrix.length, headers.length).values = matrix;

const usedRange = sheet.getRangeByIndexes(0, 0, matrix.length, headers.length);
usedRange.format = {
  font: { name: "Microsoft YaHei", size: 10, color: "#1F2937" },
  wrapText: false,
  verticalAlignment: "center",
};

const headerRange = sheet.getRange("A1:E1");
headerRange.format = {
  fill: "#1F4E78",
  font: { name: "Microsoft YaHei", bold: true, color: "#FFFFFF", size: 10 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
headerRange.format.rowHeight = 28;

sheet.getRange(`A2:E${matrix.length}`).format = {
  fill: "#FFFFFF",
  font: { name: "Microsoft YaHei", size: 10, color: "#111827" },
  verticalAlignment: "center",
};

sheet.getRange(`A1:E${matrix.length}`).format.borders = {
  insideHorizontal: { style: "thin", color: "#E5E7EB" },
  insideVertical: { style: "thin", color: "#E5E7EB" },
  top: { style: "thin", color: "#CBD5E1" },
  bottom: { style: "thin", color: "#CBD5E1" },
  left: { style: "thin", color: "#CBD5E1" },
  right: { style: "thin", color: "#CBD5E1" },
};

sheet.getRange(`A2:A${matrix.length}`).format.horizontalAlignment = "center";
sheet.getRange(`B2:B${matrix.length}`).format.horizontalAlignment = "center";
sheet.getRange(`E2:E${matrix.length}`).format.horizontalAlignment = "center";
sheet.getRange(`C2:D${matrix.length}`).format.horizontalAlignment = "left";

sheet.getRange("A:A").format.columnWidth = 16;
sheet.getRange("B:B").format.columnWidth = 22;
sheet.getRange("C:C").format.columnWidth = 30;
sheet.getRange("D:D").format.columnWidth = 58;
sheet.getRange("E:E").format.columnWidth = 20;
sheet.getRange(`A2:E${matrix.length}`).format.rowHeight = 23;

const table = sheet.tables.add(`A1:E${matrix.length}`, true, "PaperlessInterfaceList");
table.style = "TableStyleMedium2";
table.showFilterButton = true;
table.showBandedColumns = false;

sheet.freezePanes.freezeRows(1);

const inspect = await workbook.inspect({
  kind: "table",
  range: `A1:E${matrix.length}`,
  tableMaxRows: 8,
  tableMaxCols: 5,
  tableMaxCellChars: 80,
  maxChars: 5000,
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

await fs.mkdir(outputDir, { recursive: true });

const preview = await workbook.render({
  sheetName: "接口清单",
  range: `A1:E${matrix.length}`,
  scale: 2,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ rows: rows.length, outputPath, previewPath }));
