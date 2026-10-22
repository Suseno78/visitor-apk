import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { zipSync } from 'fflate';
import { Visitor, Visit, Note } from '../types';
import { VisitorStorage } from '../storage/storage';
import { NoteStorage } from '../storage/noteStorage';

// =============================================================================
// Helper: XML Escaping
// =============================================================================
function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// =============================================================================
// Helper: Date/Time Formatting
// =============================================================================
const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatIndoDateTime(d: Date): string {
  const day = d.getDate();
  const month = INDO_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${minutes} WIB`;
}

function formatDateForFilename(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// =============================================================================
// OpenXML Constants
// =============================================================================

// Namespace constants used across XML files
const NS_SPREADSHEET = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_RELATIONSHIPS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_CONTENT_TYPES = 'http://schemas.openxmlformats.org/package/2006/content-types';
const NS_REL_PACKAGE = 'http://schemas.openxmlformats.org/package/2006/relationships';

// Relationship type URIs
const REL_TYPE_WORKSHEET = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet';
const REL_TYPE_STYLES = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles';
const REL_TYPE_SHARED_STRINGS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings';
const REL_TYPE_WORKBOOK = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';

// =============================================================================
// Shared Strings Table
// =============================================================================
class SharedStringsBuilder {
  private strings: string[] = [];
  private indexMap: Map<string, number> = new Map();

  /**
   * Returns the shared string index for the given value.
   * If the string is new, it is appended to the table.
   */
  getIndex(value: string): number {
    const existing = this.indexMap.get(value);
    if (existing !== undefined) return existing;
    const idx = this.strings.length;
    this.strings.push(value);
    this.indexMap.set(value, idx);
    return idx;
  }

  get count(): number {
    return this.strings.length;
  }

  toXml(): string {
    const items = this.strings
      .map((s) => `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`)
      .join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="${NS_SPREADSHEET}" count="${this.strings.length}" uniqueCount="${this.strings.length}">
${items}
</sst>`;
  }
}

// =============================================================================
// Cell Reference Helpers
// =============================================================================
function colLetter(colIndex: number): string {
  let result = '';
  let n = colIndex;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

function cellRef(row: number, col: number): string {
  return `${colLetter(col)}${row}`;
}

// =============================================================================
// Row/Cell XML Builders
// =============================================================================

/** Creates a cell element referencing a shared string. */
function stringCell(row: number, col: number, ssIndex: number, styleIndex?: number): string {
  const ref = cellRef(row, col);
  const s = styleIndex !== undefined ? ` s="${styleIndex}"` : '';
  return `<c r="${ref}" t="s"${s}><v>${ssIndex}</v></c>`;
}

/** Creates a cell with an inline number value. */
function numberCell(row: number, col: number, value: number, styleIndex?: number): string {
  const ref = cellRef(row, col);
  const s = styleIndex !== undefined ? ` s="${styleIndex}"` : '';
  return `<c r="${ref}"${s}><v>${value}</v></c>`;
}

// =============================================================================
// Content Types XML
// =============================================================================
function generateContentTypesXml(sheetCount: number): string {
  let overrides = '';
  overrides += `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`;
  overrides += `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`;
  overrides += `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>`;
  for (let i = 1; i <= sheetCount; i++) {
    overrides += `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${NS_CONTENT_TYPES}">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${overrides}
</Types>`;
}

// =============================================================================
// Package Relationships (_rels/.rels)
// =============================================================================
function generateRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${NS_REL_PACKAGE}">
  <Relationship Id="rId1" Type="${REL_TYPE_WORKBOOK}" Target="xl/workbook.xml"/>
</Relationships>`;
}

// =============================================================================
// Workbook Relationships (xl/_rels/workbook.xml.rels)
// =============================================================================
function generateWorkbookRelsXml(sheetCount: number): string {
  const rels: string[] = [];
  for (let i = 1; i <= sheetCount; i++) {
    rels.push(`<Relationship Id="rId${i}" Type="${REL_TYPE_WORKSHEET}" Target="worksheets/sheet${i}.xml"/>`);
  }
  rels.push(`<Relationship Id="rId${sheetCount + 1}" Type="${REL_TYPE_STYLES}" Target="styles.xml"/>`);
  rels.push(`<Relationship Id="rId${sheetCount + 2}" Type="${REL_TYPE_SHARED_STRINGS}" Target="sharedStrings.xml"/>`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${NS_REL_PACKAGE}">
  ${rels.join('\n  ')}
</Relationships>`;
}

// =============================================================================
// Workbook XML
// =============================================================================
function generateWorkbookXml(sheetNames: string[]): string {
  const sheets = sheetNames
    .map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('\n    ');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${NS_SPREADSHEET}" xmlns:r="${NS_RELATIONSHIPS}">
  <sheets>
    ${sheets}
  </sheets>
</workbook>`;
}

// =============================================================================
// Styles XML
// =============================================================================
function generateStylesXml(): string {
  // Style indices:
  //   0 = default
  //   1 = header row (bold, green fill, white text, centered)
  //   2 = summary label (bold)
  //   3 = summary value
  //   4 = number format (right-aligned)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${NS_SPREADSHEET}">
  <numFmts count="0"/>
  <fonts count="4">
    <!-- 0: Default font -->
    <font>
      <sz val="11"/>
      <color rgb="FF191D16"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <!-- 1: Bold white (header) -->
    <font>
      <b/>
      <sz val="11"/>
      <color rgb="FFFFFFFF"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <!-- 2: Bold dark (summary label) -->
    <font>
      <b/>
      <sz val="11"/>
      <color rgb="FF191D16"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <!-- 3: Normal green (summary value) -->
    <font>
      <sz val="12"/>
      <color rgb="FF266210"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
  </fonts>
  <fills count="3">
    <!-- 0: none -->
    <fill><patternFill patternType="none"/></fill>
    <!-- 1: gray125 (required placeholder) -->
    <fill><patternFill patternType="gray125"/></fill>
    <!-- 2: Green header background -->
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FF266210"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
  </fills>
  <borders count="2">
    <!-- 0: No border -->
    <border>
      <left/><right/><top/><bottom/><diagonal/>
    </border>
    <!-- 1: Thin bottom border -->
    <border>
      <left/>
      <right/>
      <top/>
      <bottom style="thin"><color rgb="FFE6E9DE"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="5">
    <!-- 0: Default -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0">
      <alignment vertical="center" wrapText="1"/>
    </xf>
    <!-- 1: Header row (bold white on green, centered) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 2: Summary label (bold) -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1">
      <alignment vertical="center"/>
    </xf>
    <!-- 3: Summary value (green) -->
    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1">
      <alignment vertical="center"/>
    </xf>
    <!-- 4: Number cell (right-aligned) -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
  </cellXfs>
</styleSheet>`;
}

// =============================================================================
// Worksheet XML Builder
// =============================================================================
interface ColumnDef {
  header: string;
  width: number;
}

interface WorksheetOptions {
  columns: ColumnDef[];
  freezeRow?: number;
  autoFilter?: boolean;
}

function buildWorksheetXml(
  rows: (string | number | null | undefined)[][],
  ss: SharedStringsBuilder,
  options: WorksheetOptions,
): string {
  const { columns, freezeRow = 1, autoFilter = false } = options;
  const totalRows = rows.length + 1; // +1 for header
  const lastCol = colLetter(columns.length - 1);
  const rangeRef = `A1:${lastCol}${totalRows}`;

  // Column widths
  const colsXml = columns
    .map((col, i) => `<col min="${i + 1}" max="${i + 1}" width="${col.width}" customWidth="1"/>`)
    .join('');

  // Header row
  const headerCells = columns
    .map((col, i) => stringCell(1, i, ss.getIndex(col.header), 1))
    .join('');
  const headerRow = `<row r="1" ht="24" customHeight="1">${headerCells}</row>`;

  // Data rows
  const dataRows = rows.map((row, rIdx) => {
    const rowNum = rIdx + 2; // 1-indexed, after header
    const cells = row.map((value, cIdx) => {
      if (value === null || value === undefined || value === '') {
        return stringCell(rowNum, cIdx, ss.getIndex('-'), 0);
      }
      if (typeof value === 'number') {
        return numberCell(rowNum, cIdx, value, 4);
      }
      return stringCell(rowNum, cIdx, ss.getIndex(String(value)), 0);
    });
    return `<row r="${rowNum}">${cells.join('')}</row>`;
  });

  // SheetView: freeze pane
  let sheetViewInner = '';
  if (freezeRow > 0) {
    sheetViewInner = `<pane ySplit="${freezeRow}" topLeftCell="A${freezeRow + 1}" activePane="bottomLeft" state="frozen"/>
      <selection pane="bottomLeft"/>`;
  }

  const autoFilterXml = autoFilter ? `<autoFilter ref="${rangeRef}"/>` : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS_SPREADSHEET}" xmlns:r="${NS_RELATIONSHIPS}">
  <sheetViews>
    <sheetView tabSelected="0" workbookViewId="0">
      ${sheetViewInner}
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${colsXml}</cols>
  <sheetData>
    ${headerRow}
    ${dataRows.join('\n    ')}
  </sheetData>
  ${autoFilterXml}
</worksheet>`;
}

// =============================================================================
// Summary Worksheet (special layout, not a data table)
// =============================================================================
function buildSummaryWorksheetXml(
  generatedDateStr: string,
  visitorCount: number,
  visitCount: number,
  noteCount: number,
  ss: SharedStringsBuilder,
): string {
  const rows: string[] = [];
  let r = 1;

  // Title
  rows.push(`<row r="${r}" ht="30" customHeight="1"><c r="A${r}" t="s" s="2"><v>${ss.getIndex('Laporan Data Visitra')}</v></c></row>`);
  r++;

  // Blank row
  rows.push(`<row r="${r}"/>`);
  r++;

  // Generation date
  rows.push(`<row r="${r}"><c r="A${r}" t="s" s="2"><v>${ss.getIndex('Tanggal Pembuatan')}</v></c><c r="B${r}" t="s" s="3"><v>${ss.getIndex(generatedDateStr)}</v></c></row>`);
  r++;

  // Blank row
  rows.push(`<row r="${r}"/>`);
  r++;

  // Counts
  const summaryItems: { label: string; value: number }[] = [
    { label: 'Total Pengunjung', value: visitorCount },
    { label: 'Total Kunjungan', value: visitCount },
    { label: 'Total Catatan', value: noteCount },
  ];

  for (const item of summaryItems) {
    rows.push(`<row r="${r}"><c r="A${r}" t="s" s="2"><v>${ss.getIndex(item.label)}</v></c><c r="B${r}" s="3"><v>${item.value}</v></c></row>`);
    r++;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS_SPREADSHEET}" xmlns:r="${NS_RELATIONSHIPS}">
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="24" customWidth="1"/>
    <col min="2" max="2" width="40" customWidth="1"/>
  </cols>
  <sheetData>
    ${rows.join('\n    ')}
  </sheetData>
</worksheet>`;
}

// =============================================================================
// Data Preparation
// =============================================================================
function prepareVisitorRows(visitors: Visitor[]): (string | number | null)[][] {
  return visitors.map((v) => {
    const activeVisits = (v.visits || []).filter((vt) => !vt.deletedAt);
    return [
      v.name || '-',
      v.category || 'Reguler',
      v.occupation || '-',
      v.address || '-',
      v.phone || '-',
      v.status || 'Aktif',
      activeVisits.length,
    ];
  });
}

function prepareVisitRows(visitors: Visitor[]): (string | number | null)[][] {
  const rows: (string | number | null)[][] = [];
  for (const v of visitors) {
    const activeVisits = (v.visits || []).filter((vt) => !vt.deletedAt);
    for (const visit of activeVisits) {
      const activeAttachments = (visit.attachments || []).filter((att) => !att.deletedAt);
      rows.push([
        v.name || '-',
        visit.date || '-',
        visit.time || '-',
        visit.duration || '-',
        visit.problem || '-',
        visit.solution || '-',
        visit.notes || '-',
        activeAttachments.length,
      ]);
    }
  }
  return rows;
}

function prepareNoteRows(notes: Note[]): (string | number | null)[][] {
  return notes.map((n) => {
    const activeAttachments = (n.attachments || []).filter((att) => !att.deletedAt);
    return [
      n.title || '-',
      n.content || '-',
      n.createdAt ? formatNoteDate(n.createdAt) : '-',
      n.updatedAt ? formatNoteDate(n.updatedAt) : '-',
      activeAttachments.length,
    ];
  });
}

function formatNoteDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const day = d.getDate();
    const month = INDO_MONTHS[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return iso;
  }
}

// =============================================================================
// Main Export Service
// =============================================================================
export const XlsxExportService = {
  /**
   * Generates and shares a valid .xlsx workbook containing all locally
   * accessible Visitra data (visitors, visits, notes).
   */
  async exportAllDataExcel(): Promise<{
    success: boolean;
    error?: string;
    filePath?: string;
  }> {
    let xlsxFile: File | null = null;
    try {
      // -----------------------------------------------------------------------
      // 1. Load data from local storage (non-deleted only)
      // -----------------------------------------------------------------------
      const visitors = await VisitorStorage.getAll(false);
      const notes = await NoteStorage.getAll(false);

      let totalVisits = 0;
      for (const v of visitors) {
        totalVisits += (v.visits || []).filter((vt) => !vt.deletedAt).length;
      }

      const now = new Date();
      const generatedDateStr = formatIndoDateTime(now);
      const filename = `Visitra_Export_Data_${formatDateForFilename(now)}.xlsx`;

      // -----------------------------------------------------------------------
      // 2. Build shared strings and worksheets
      // -----------------------------------------------------------------------
      const ss = new SharedStringsBuilder();

      // Worksheet 1: Ringkasan
      const summaryXml = buildSummaryWorksheetXml(
        generatedDateStr,
        visitors.length,
        totalVisits,
        notes.length,
        ss,
      );

      // Worksheet 2: Pengunjung
      const visitorColumns: ColumnDef[] = [
        { header: 'Nama', width: 28 },
        { header: 'Kategori', width: 14 },
        { header: 'Pekerjaan', width: 22 },
        { header: 'Alamat', width: 32 },
        { header: 'No. Telepon', width: 18 },
        { header: 'Status', width: 12 },
        { header: 'Jumlah Kunjungan', width: 18 },
      ];
      const visitorRows = prepareVisitorRows(visitors);
      const pengunjungXml = buildWorksheetXml(visitorRows, ss, {
        columns: visitorColumns,
        freezeRow: 1,
        autoFilter: true,
      });

      // Worksheet 3: Kunjungan
      const visitColumns: ColumnDef[] = [
        { header: 'Nama Pengunjung', width: 28 },
        { header: 'Tanggal', width: 22 },
        { header: 'Waktu', width: 12 },
        { header: 'Durasi', width: 14 },
        { header: 'Masalah / Keperluan', width: 36 },
        { header: 'Solusi / Tindak Lanjut', width: 36 },
        { header: 'Catatan Kunjungan', width: 28 },
        { header: 'Jumlah Foto', width: 14 },
      ];
      const visitRows = prepareVisitRows(visitors);
      const kunjunganXml = buildWorksheetXml(visitRows, ss, {
        columns: visitColumns,
        freezeRow: 1,
        autoFilter: true,
      });

      // Worksheet 4: Catatan
      const noteColumns: ColumnDef[] = [
        { header: 'Judul', width: 30 },
        { header: 'Isi Catatan', width: 50 },
        { header: 'Tanggal Dibuat', width: 22 },
        { header: 'Terakhir Diubah', width: 22 },
        { header: 'Jumlah Lampiran', width: 16 },
      ];
      const noteRows = prepareNoteRows(notes);
      const catatanXml = buildWorksheetXml(noteRows, ss, {
        columns: noteColumns,
        freezeRow: 1,
        autoFilter: true,
      });

      // -----------------------------------------------------------------------
      // 3. Generate remaining OpenXML package files
      // -----------------------------------------------------------------------
      const sheetNames = ['Ringkasan', 'Pengunjung', 'Kunjungan', 'Catatan'];
      const sheetCount = sheetNames.length;

      const contentTypesXml = generateContentTypesXml(sheetCount);
      const relsXml = generateRelsXml();
      const workbookRelsXml = generateWorkbookRelsXml(sheetCount);
      const workbookXml = generateWorkbookXml(sheetNames);
      const stylesXml = generateStylesXml();
      const sharedStringsXml = ss.toXml();

      // -----------------------------------------------------------------------
      // 4. Construct ZIP archive
      // -----------------------------------------------------------------------
      const textEncoder = new TextEncoder();
      const zipData: Record<string, Uint8Array> = {
        '[Content_Types].xml': textEncoder.encode(contentTypesXml),
        '_rels/.rels': textEncoder.encode(relsXml),
        'xl/_rels/workbook.xml.rels': textEncoder.encode(workbookRelsXml),
        'xl/workbook.xml': textEncoder.encode(workbookXml),
        'xl/styles.xml': textEncoder.encode(stylesXml),
        'xl/sharedStrings.xml': textEncoder.encode(sharedStringsXml),
        'xl/worksheets/sheet1.xml': textEncoder.encode(summaryXml),
        'xl/worksheets/sheet2.xml': textEncoder.encode(pengunjungXml),
        'xl/worksheets/sheet3.xml': textEncoder.encode(kunjunganXml),
        'xl/worksheets/sheet4.xml': textEncoder.encode(catatanXml),
      };

      const zipped = zipSync(zipData);

      // -----------------------------------------------------------------------
      // 5. Write to cache and share
      // -----------------------------------------------------------------------
      xlsxFile = new File(Paths.cache, filename);
      if (xlsxFile.exists) xlsxFile.delete();
      xlsxFile.write(zipped);

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        return {
          success: false,
          error: 'Fitur berbagi file tidak tersedia di perangkat ini.',
        };
      }

      await Sharing.shareAsync(xlsxFile.uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Data Visitra (Excel)',
        UTI: 'org.openxmlformats.spreadsheetml.sheet',
      });

      return {
        success: true,
        filePath: xlsxFile.uri,
      };
    } catch (err: unknown) {
      if (xlsxFile && xlsxFile.exists) {
        try {
          xlsxFile.delete();
        } catch {
          // ignore cache cleanup error
        }
      }
      const message = err instanceof Error ? err.message : 'Gagal membuat file Excel.';
      return { success: false, error: message };
    }
  },
};
