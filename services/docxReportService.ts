import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { zipSync } from 'fflate';
import { Visitor, Visit } from '../types';
import { VisitPhotoService } from '../storage/visitPhotoService';
import { supabase } from '../lib/supabase';

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
// Helper: Indonesian Date & Time Formatting and Parsing
// =============================================================================
const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const INDO_MONTH_MAP: Record<string, number> = {
  januari: 0,
  februari: 1,
  maret: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  agustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  desember: 11,
};

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

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_');
}

/**
 * Robustly parses visit date and time strings into a comparable epoch number (ms).
 * Handles:
 * - "YYYY-MM-DD"
 * - Indonesian dates: "23 September 2026" or "Rabu, 23 September 2026"
 * - ISO string or Date parse fallback
 * - Time string: "09:30" or "14:15:00"
 * - Fallback to visit.createdAt if date parsing yields NaN
 */
export function parseVisitDateTimeEpoch(dateStr?: string | null, timeStr?: string | null, fallbackIso?: string): number {
  let year: number | null = null;
  let monthIndex: number | null = null;
  let day: number | null = null;

  if (dateStr && typeof dateStr === 'string') {
    const trimmed = dateStr.trim();

    // Pattern 1: YYYY-MM-DD
    const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymdMatch) {
      year = parseInt(ymdMatch[1], 10);
      monthIndex = parseInt(ymdMatch[2], 10) - 1;
      day = parseInt(ymdMatch[3], 10);
    } else {
      // Pattern 2: "23 September 2026" or "Rabu, 23 September 2026"
      const indoMatch = trimmed.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
      if (indoMatch) {
        day = parseInt(indoMatch[1], 10);
        const mKey = indoMatch[2].toLowerCase();
        if (mKey in INDO_MONTH_MAP) {
          monthIndex = INDO_MONTH_MAP[mKey];
          year = parseInt(indoMatch[3], 10);
        }
      }
    }

    if (year === null) {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        year = parsed.getFullYear();
        monthIndex = parsed.getMonth();
        day = parsed.getDate();
      }
    }
  }

  // Parse time
  let hours = 0;
  let minutes = 0;
  if (timeStr && typeof timeStr === 'string') {
    const timeMatch = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
    }
  }

  if (year !== null && monthIndex !== null && day !== null) {
    const d = new Date(year, monthIndex, day, hours, minutes, 0, 0);
    if (!isNaN(d.getTime())) {
      return d.getTime();
    }
  }

  if (fallbackIso) {
    const fallbackTime = new Date(fallbackIso).getTime();
    if (!isNaN(fallbackTime)) {
      return fallbackTime;
    }
  }

  return 0;
}

/**
 * Parses only the calendar date part (ignoring time) of a visit into local epoch ms at 00:00:00.000.
 * Used for inclusive date-range boundary comparisons.
 */
export function parseVisitDateOnlyEpoch(dateStr?: string | null): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();

  let year: number | null = null;
  let monthIndex: number | null = null;
  let day: number | null = null;

  const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    year = parseInt(ymdMatch[1], 10);
    monthIndex = parseInt(ymdMatch[2], 10) - 1;
    day = parseInt(ymdMatch[3], 10);
  } else {
    const indoMatch = trimmed.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (indoMatch) {
      day = parseInt(indoMatch[1], 10);
      const mKey = indoMatch[2].toLowerCase();
      if (mKey in INDO_MONTH_MAP) {
        monthIndex = INDO_MONTH_MAP[mKey];
        year = parseInt(indoMatch[3], 10);
      }
    }
  }

  if (year === null) {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      year = parsed.getFullYear();
      monthIndex = parsed.getMonth();
      day = parsed.getDate();
    }
  }

  if (year !== null && monthIndex !== null && day !== null) {
    const d = new Date(year, monthIndex, day, 0, 0, 0, 0);
    if (!isNaN(d.getTime())) {
      return d.getTime();
    }
  }

  return null;
}

/**
 * Returns a new array of visits sorted chronologically in ascending order (oldest first).
 * Does not mutate the original array.
 */
function sortVisitsChronologicalAscending(visits: Visit[]): Visit[] {
  return [...visits].sort((a, b) => {
    const epochA = parseVisitDateTimeEpoch(a.date, a.time, a.createdAt);
    const epochB = parseVisitDateTimeEpoch(b.date, b.time, b.createdAt);
    if (epochA !== epochB) {
      return epochA - epochB;
    }
    return (a.id || '').localeCompare(b.id || '');
  });
}

// =============================================================================
// Image Dimension Calculation for Word A4
// =============================================================================
const MAX_EMU_WIDTH = 5029200;  // 5.5 inches
const MAX_EMU_HEIGHT = 3657600; // 4.0 inches
const DEFAULT_EMU_WIDTH = 4572000;  // 5.0 inches
const DEFAULT_EMU_HEIGHT = 3429000; // 3.75 inches (4:3)

function calculateEmuDimensions(origWidth?: number, origHeight?: number): { cx: number; cy: number } {
  if (!origWidth || !origHeight || origWidth <= 0 || origHeight <= 0) {
    return { cx: DEFAULT_EMU_WIDTH, cy: DEFAULT_EMU_HEIGHT };
  }

  let emuW = origWidth * 9525;
  let emuH = origHeight * 9525;

  const widthRatio = emuW / MAX_EMU_WIDTH;
  const heightRatio = emuH / MAX_EMU_HEIGHT;
  const scale = Math.max(widthRatio, heightRatio, 1);

  return {
    cx: Math.round(emuW / scale),
    cy: Math.round(emuH / scale),
  };
}

// =============================================================================
// XML Templates for OpenXML DOCX
// =============================================================================

function generateContentTypesXml(imageParts: { relId: string; filename: string; mime: string }[]): string {
  const imageOverrides = imageParts
    .map(
      (img) =>
        `<Override PartName="/word/media/${img.filename}" ContentType="${img.mime || 'image/jpeg'}" />`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  ${imageOverrides}
</Types>`;
}

function generateRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function generateDocumentRelsXml(imageParts: { relId: string; filename: string }[]): string {
  const imageRels = imageParts
    .map(
      (img) =>
        `<Relationship Id="${img.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${img.filename}"/>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
  ${imageRels}
</Relationships>`;
}

function generateStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Segoe UI"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="191D16"/>
        <w:lang w:val="id-ID"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:widowControl/>
        <w:spacing w:after="160" w:line="260" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>`;
}

/**
 * Requirement 1: Explicitly preserve whitespace with xml:space="preserve"
 * so footer pagination renders cleanly as "Halaman 1 dari 7" across all Word viewers.
 */
function generateFooterXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:pBdr>
        <w:top w:val="single" w:sz="4" w:space="8" w:color="E6E9DE"/>
      </w:pBdr>
      <w:jc w:val="both"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:sz w:val="18"/>
        <w:color w:val="717A6B"/>
      </w:rPr>
      <w:t>Visitra — Sistem Manajemen Pengunjung</w:t>
    </w:r>
    <w:r>
      <w:rPr>
        <w:sz w:val="18"/>
        <w:color w:val="717A6B"/>
      </w:rPr>
      <w:tab/>
      <w:t xml:space="preserve">Halaman </w:t>
    </w:r>
    <w:fldSimple w:instr="PAGE"/>
    <w:r>
      <w:rPr>
        <w:sz w:val="18"/>
        <w:color w:val="717A6B"/>
      </w:rPr>
      <w:t xml:space="preserve"> dari </w:t>
    </w:r>
    <w:fldSimple w:instr="NUMPAGES"/>
  </w:p>
</w:ftr>`;
}

// =============================================================================
// Helper: Drawing XML snippet for an embedded image
// =============================================================================
function generateDrawingXml(
  docPrId: number,
  relId: string,
  name: string,
  cx: number,
  cy: number,
  keepWithNextCaption = false
): string {
  return `<w:p>
    <w:pPr>
      <w:jc w:val="center"/>
      <w:spacing w:before="120" w:after="80"/>
      <w:keepLines/>
      ${keepWithNextCaption ? '<w:keepNext/>' : ''}
    </w:pPr>
    <w:r>
      <w:drawing>
        <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
          <wp:extent cx="${cx}" cy="${cy}"/>
          <wp:effectExtent l="0" t="0" r="0" b="0"/>
          <wp:docPr id="${docPrId}" name="${escapeXml(name)}"/>
          <wp:cNvGraphicFramePr>
            <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
          </wp:cNvGraphicFramePr>
          <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:nvPicPr>
                  <pic:cNvPr id="${docPrId}" name="${escapeXml(name)}"/>
                  <pic:cNvPicPr>
                    <a:picLocks noChangeAspect="1" noChangeArrowheads="1"/>
                  </pic:cNvPicPr>
                </pic:nvPicPr>
                <pic:blipFill>
                  <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${relId}"/>
                  <a:stretch>
                    <a:fillRect/>
                  </a:stretch>
                </pic:blipFill>
                <pic:spPr>
                  <a:xfrm>
                    <a:off x="0" y="0"/>
                    <a:ext cx="${cx}" cy="${cy}"/>
                  </a:xfrm>
                  <a:prstGeom prst="rect">
                    <a:avLst/>
                  </a:prstGeom>
                </pic:spPr>
              </pic:pic>
            </a:graphicData>
          </a:graphic>
        </wp:inline>
      </w:drawing>
    </w:r>
  </w:p>`;
}

// =============================================================================
// Helper: Render visits list for a visitor
// =============================================================================
interface ImagePlacement {
  relId: string;
  caption: string;
  cx: number;
  cy: number;
}

let globalDocPrCounter = 100;

function renderVisitsSectionXml(
  visitsSorted: Visit[],
  imagePlacementsByVisitId: Map<string, ImagePlacement[]>
): string {
  if (visitsSorted.length === 0) {
    return `
    <w:p>
      <w:pPr><w:spacing w:before="120" w:after="160"/></w:pPr>
      <w:r>
        <w:rPr><w:i/><w:color w:val="717A6B"/></w:rPr>
        <w:t>Belum ada catatan riwayat kunjungan untuk pengunjung ini.</w:t>
      </w:r>
    </w:p>`;
  }

  let xml = '';
  visitsSorted.forEach((vt, index) => {
    const visitNumber = index + 1;
    const visitImages = imagePlacementsByVisitId.get(vt.id) || [];

    let imagesXml = '';
    if (visitImages.length > 0) {
      imagesXml = visitImages
        .map((img) => {
          globalDocPrCounter++;
          // Drawing keeps with its caption paragraph
          const drawing = generateDrawingXml(globalDocPrCounter, img.relId, img.caption, img.cx, img.cy, true);
          return `${drawing}
          <w:p>
            <w:pPr>
              <w:jc w:val="center"/>
              <w:spacing w:after="200"/>
              <w:keepLines/>
            </w:pPr>
            <w:r>
              <w:rPr><w:i/><w:sz w:val="18"/><w:color w:val="717A6B"/></w:rPr>
              <w:t>${escapeXml(img.caption)}</w:t>
            </w:r>
          </w:p>`;
        })
        .join('');
    }

    xml += `
    <!-- VISIT #${visitNumber} -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="280" w:after="100"/>
        <w:shd w:val="clear" w:color="auto" w:fill="EDF6E8"/>
        <w:pBdr>
          <w:left w:val="single" w:sz="24" w:space="15" w:color="266210"/>
        </w:pBdr>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="22"/>
          <w:color w:val="266210"/>
        </w:rPr>
        <w:t>Kunjungan #${visitNumber} — ${escapeXml(vt.date || 'Tanggal tidak dicatat')}</w:t>
      </w:r>
    </w:p>

    <!-- Visit Meta Line (keepNext with Problem heading) -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="60" w:after="140"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="41493C"/></w:rPr>
        <w:t>Waktu: </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:sz w:val="20"/></w:rPr>
        <w:t>${escapeXml(vt.time || '-')}</w:t>
      </w:r>
      <w:r>
        <w:rPr><w:sz w:val="20"/><w:color w:val="717A6B"/></w:rPr>
        <w:t>   |   </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="41493C"/></w:rPr>
        <w:t>Durasi: </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:sz w:val="20"/></w:rPr>
        <w:t>${escapeXml(vt.duration || '-')}</w:t>
      </w:r>
    </w:p>

    <!-- Problem Section Heading (keepNext with problem text) -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="100" w:after="40"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="BA1A1A"/></w:rPr>
        <w:t>Masalah / Keperluan:</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="0" w:after="140"/>
        <w:ind w:left="240"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:sz w:val="20"/><w:color w:val="191D16"/></w:rPr>
        <w:t>${escapeXml(vt.problem || '-')}</w:t>
      </w:r>
    </w:p>

    <!-- Solution Section Heading (keepNext with solution text) -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="100" w:after="40"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="2F6B19"/></w:rPr>
        <w:t>Solusi / Tindak Lanjut:</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:keepLines/>
        ${vt.notes || visitImages.length > 0 ? '<w:keepNext/>' : ''}
        <w:spacing w:before="0" w:after="140"/>
        <w:ind w:left="240"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:sz w:val="20"/><w:color w:val="191D16"/></w:rPr>
        <w:t>${escapeXml(vt.solution || '-')}</w:t>
      </w:r>
    </w:p>

    ${
      vt.notes
        ? `
    <!-- Additional Notes Heading (keepNext with notes text) -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="100" w:after="40"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="41493C"/></w:rPr>
        <w:t>Catatan Tambahan:</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:keepLines/>
        ${visitImages.length > 0 ? '<w:keepNext/>' : ''}
        <w:spacing w:before="0" w:after="140"/>
        <w:ind w:left="240"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:sz w:val="20"/><w:color w:val="191D16"/></w:rPr>
        <w:t>${escapeXml(vt.notes)}</w:t>
      </w:r>
    </w:p>`
        : ''
    }

    ${
      visitImages.length > 0
        ? `
    <!-- Photo Attachments Header (keepNext so heading never gets orphaned from the first photo) -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="140" w:after="100"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="266210"/></w:rPr>
        <w:t>Lampiran Foto / Bukti Kunjungan (${visitImages.length}):</w:t>
      </w:r>
    </w:p>
    ${imagesXml}`
        : ''
    }
    `;
  });

  return xml;
}

// =============================================================================
// Document XML Generator for Single Visitor
// =============================================================================
function generateDocumentXml(
  visitor: Visitor,
  visitsSorted: Visit[],
  generatedDateStr: string,
  imagePlacementsByVisitId: Map<string, ImagePlacement[]>
): string {
  const profileRows = [
    { label: 'Nama Lengkap', value: visitor.name || '-' },
    { label: 'Kategori', value: visitor.category || 'Reguler' },
    { label: 'Pekerjaan', value: visitor.occupation || '-' },
    { label: 'Alamat', value: visitor.address || '-' },
    { label: 'No. Telepon', value: visitor.phone || '-' },
    { label: 'Status Pengunjung', value: visitor.status || 'Aktif' },
    { label: 'Total Kunjungan', value: `${visitsSorted.length} kali kunjungan` },
  ];

  const tableRowsXml = profileRows
    .map(
      (row) => `
    <w:tr>
      <w:trPr>
        <w:cantSplit/>
      </w:trPr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="2800" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="F7FAF5"/>
          <w:tcMar>
            <w:top w:w="120" w:type="dxa"/>
            <w:left w:w="180" w:type="dxa"/>
            <w:bottom w:w="120" w:type="dxa"/>
            <w:right w:w="180" w:type="dxa"/>
          </w:tcMar>
        </w:tcPr>
        <w:p>
          <w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:keepLines/></w:pPr>
          <w:r>
            <w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="41493C"/></w:rPr>
            <w:t>${escapeXml(row.label)}</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="6200" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>
          <w:tcMar>
            <w:top w:w="120" w:type="dxa"/>
            <w:left w:w="180" w:type="dxa"/>
            <w:bottom w:w="120" w:type="dxa"/>
            <w:right w:w="180" w:type="dxa"/>
          </w:tcMar>
        </w:tcPr>
        <w:p>
          <w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:keepLines/></w:pPr>
          <w:r>
            <w:rPr><w:sz w:val="20"/><w:color w:val="191D16"/></w:rPr>
            <w:t>${escapeXml(row.value)}</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>`
    )
    .join('');

  const visitSectionsXml = renderVisitsSectionXml(visitsSorted, imagePlacementsByVisitId);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    <!-- DOCUMENT HEADER -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="100" w:after="60"/>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="36"/>
          <w:szCs w:val="36"/>
          <w:color w:val="266210"/>
        </w:rPr>
        <w:t>LAPORAN RIWAYAT KUNJUNGAN</w:t>
      </w:r>
    </w:p>

    <!-- Subtitle / Subject -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="0" w:after="60"/>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="26"/>
          <w:color w:val="191D16"/>
        </w:rPr>
        <w:t>${escapeXml(visitor.name)}</w:t>
      </w:r>
    </w:p>

    <!-- Date of generation -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="0" w:after="240"/>
        <w:jc w:val="center"/>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="12" w:space="15" w:color="266210"/>
        </w:pBdr>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="18"/>
          <w:color w:val="717A6B"/>
        </w:rPr>
        <w:t>Tanggal Pembuatan: ${escapeXml(generatedDateStr)}</w:t>
      </w:r>
    </w:p>

    <!-- VISITOR INFORMATION SECTION -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="240" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="24"/>
          <w:color w:val="266210"/>
        </w:rPr>
        <w:t>I. INFORMASI PENGUNJUNG</w:t>
      </w:r>
    </w:p>

    <!-- Profile Table -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9000" w:type="dxa"/>
        <w:jc w:val="center"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="E6E9DE"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="E6E9DE"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="E6E9DE"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="E6E9DE"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E6E9DE"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E6E9DE"/>
        </w:tblBorders>
      </w:tblPr>
      ${tableRowsXml}
    </w:tbl>

    <!-- VISIT HISTORY SECTION -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="400" w:after="160"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="24"/>
          <w:color w:val="266210"/>
        </w:rPr>
        <w:t>II. RIWAYAT KUNJUNGAN (${visitsSorted.length})</w:t>
      </w:r>
    </w:p>

    ${visitSectionsXml}

    <!-- SECTION PROPERTIES (A4 Size + 1 inch margins + footer) -->
    <w:sectPr>
      <w:footerReference w:type="default" r:id="rIdFooter"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

// =============================================================================
// Document XML Generator for Multiple Visitors
// =============================================================================
function generateAllVisitorsDocumentXml(
  visitors: Visitor[],
  totalVisitsCount: number,
  generatedDateStr: string,
  imagePlacementsByVisitId: Map<string, ImagePlacement[]>,
  periodSubtitle?: string
): string {
  let visitorsContentXml = '';

  visitors.forEach((visitor, vIdx) => {
    const visitorNum = vIdx + 1;
    const rawVisits = (visitor.visits || []).filter((vt) => !vt.deletedAt);
    const visitsSorted = sortVisitsChronologicalAscending(rawVisits);

    const profileRows = [
      { label: 'Nama Lengkap', value: visitor.name || '-' },
      { label: 'Kategori', value: visitor.category || 'Reguler' },
      { label: 'Pekerjaan', value: visitor.occupation || '-' },
      { label: 'Alamat', value: visitor.address || '-' },
      { label: 'No. Telepon', value: visitor.phone || '-' },
      { label: 'Status Pengunjung', value: visitor.status || 'Aktif' },
      { label: 'Total Kunjungan', value: `${visitsSorted.length} kali kunjungan` },
    ];

    const tableRowsXml = profileRows
      .map(
        (row) => `
      <w:tr>
        <w:trPr>
          <w:cantSplit/>
        </w:trPr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="2800" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="F7FAF5"/>
            <w:tcMar>
              <w:top w:w="120" w:type="dxa"/>
              <w:left w:w="180" w:type="dxa"/>
              <w:bottom w:w="120" w:type="dxa"/>
              <w:right w:w="180" w:type="dxa"/>
            </w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:keepLines/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="41493C"/></w:rPr>
              <w:t>${escapeXml(row.label)}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="6200" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>
            <w:tcMar>
              <w:top w:w="120" w:type="dxa"/>
              <w:left w:w="180" w:type="dxa"/>
              <w:bottom w:w="120" w:type="dxa"/>
              <w:right w:w="180" w:type="dxa"/>
            </w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:keepLines/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="20"/><w:color w:val="191D16"/></w:rPr>
              <w:t>${escapeXml(row.value)}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>`
      )
      .join('');

    const visitsXml = renderVisitsSectionXml(visitsSorted, imagePlacementsByVisitId);

    visitorsContentXml += `
    <!-- VISITOR #${visitorNum} -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="440" w:after="160"/>
        <w:shd w:val="clear" w:color="auto" w:fill="EDF6E8"/>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="16" w:space="10" w:color="266210"/>
        </w:pBdr>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="28"/>
          <w:color w:val="266210"/>
        </w:rPr>
        <w:t>${visitorNum}. ${escapeXml(visitor.name)}</w:t>
      </w:r>
    </w:p>

    <!-- Profile Table -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9000" w:type="dxa"/>
        <w:jc w:val="center"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="E6E9DE"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="E6E9DE"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="E6E9DE"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="E6E9DE"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E6E9DE"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E6E9DE"/>
        </w:tblBorders>
      </w:tblPr>
      ${tableRowsXml}
    </w:tbl>

    <!-- Subhead Riwayat (keepNext with first visit heading) -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="240" w:after="80"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="22"/>
          <w:color w:val="41493C"/>
        </w:rPr>
        <w:t>Riwayat Kunjungan (${visitsSorted.length}):</w:t>
      </w:r>
    </w:p>

    ${visitsXml}
    `;
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    <!-- DOCUMENT COVER / HEADER -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="120" w:after="80"/>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="38"/>
          <w:szCs w:val="38"/>
          <w:color w:val="266210"/>
        </w:rPr>
        <w:t>LAPORAN DATA PENGUNJUNG</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="0" w:after="${periodSubtitle ? '40' : '80'}"/>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="22"/>
          <w:color w:val="41493C"/>
        </w:rPr>
        <w:t>Ringkasan Seluruh Pengunjung &amp; Riwayat Kunjungan</w:t>
      </w:r>
    </w:p>

    ${
      periodSubtitle
        ? `
    <!-- Period Subtitle -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="0" w:after="80"/>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="20"/>
          <w:color w:val="266210"/>
        </w:rPr>
        <w:t>${escapeXml(periodSubtitle)}</w:t>
      </w:r>
    </w:p>`
        : ''
    }

    <!-- Generation Date -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:keepLines/>
        <w:spacing w:before="0" w:after="240"/>
        <w:jc w:val="center"/>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="12" w:space="15" w:color="266210"/>
        </w:pBdr>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="18"/>
          <w:color w:val="717A6B"/>
        </w:rPr>
        <w:t>Tanggal Pembuatan: ${escapeXml(generatedDateStr)}</w:t>
      </w:r>
    </w:p>

    <!-- SUMMARY CARD TABLE -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9000" w:type="dxa"/>
        <w:jc w:val="center"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="266210"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="266210"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="266210"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="266210"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="EDF6E8"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="EDF6E8"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:trPr>
          <w:cantSplit/>
        </w:trPr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="4500" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="EDF6E8"/>
            <w:tcMar>
              <w:top w:w="160" w:type="dxa"/>
              <w:left w:w="200" w:type="dxa"/>
              <w:bottom w:w="160" w:type="dxa"/>
              <w:right w:w="200" w:type="dxa"/>
            </w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/><w:keepLines/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="266210"/></w:rPr>
              <w:t>${visitors.length}</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/><w:keepLines/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="18"/><w:color w:val="41493C"/></w:rPr>
              <w:t>Total Pengunjung Terdaftar</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="4500" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="EDF6E8"/>
            <w:tcMar>
              <w:top w:w="160" w:type="dxa"/>
              <w:left w:w="200" w:type="dxa"/>
              <w:bottom w:w="160" w:type="dxa"/>
              <w:right w:w="200" w:type="dxa"/>
            </w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/><w:keepLines/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="266210"/></w:rPr>
              <w:t>${totalVisitsCount}</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/><w:keepLines/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="18"/><w:color w:val="41493C"/></w:rPr>
              <w:t>Total Riwayat Kunjungan</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <!-- ALL VISITORS CONTENT -->
    ${visitorsContentXml}

    <!-- SECTION PROPERTIES (A4 Size + 1 inch margins + footer) -->
    <w:sectPr>
      <w:footerReference w:type="default" r:id="rIdFooter"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

// =============================================================================
// Helper: Photo Processing with Deduplication & Clean Captions
// =============================================================================
async function processVisitPhotos(
  visits: Visit[],
  imageParts: { relId: string; filename: string; mime: string; bytes: Uint8Array }[],
  imagePlacementsByVisitId: Map<string, ImagePlacement[]>,
  missingPhotosList: string[],
  photoCacheByUri: Map<string, { relId: string; filename: string; mime: string }>,
  visitorLabel: string
) {
  for (const vt of visits) {
    const activeAtts = (vt.attachments || []).filter((a) => !a.deletedAt);
    const placementsForThisVisit: ImagePlacement[] = [];

    // Track photo index within this specific visit for clean labeling ("Foto 1", "Foto 2")
    let photoNumInVisit = 1;

    for (const att of activeAtts) {
      let bytes: Uint8Array | null = null;
      const dedupeKey = att.localUri || att.remoteId || att.id;
      const cleanCaption = `Foto ${photoNumInVisit}`;

      // Check if image already processed and placed in imageParts
      if (dedupeKey && photoCacheByUri.has(dedupeKey)) {
        const cached = photoCacheByUri.get(dedupeKey)!;
        const { cx, cy } = calculateEmuDimensions(att.width, att.height);
        placementsForThisVisit.push({
          relId: cached.relId,
          caption: cleanCaption,
          cx,
          cy,
        });
        photoNumInVisit++;
        continue;
      }

      // Attempt 1: Read from local document storage
      if (att.localUri) {
        bytes = await VisitPhotoService.readAttachmentBytes(att.localUri);
      }

      // Attempt 2: If missing locally but has remoteId, try fetching from Supabase private storage
      if ((!bytes || bytes.length === 0) && att.remoteId) {
        try {
          const { data: imgRow } = await supabase
            .from('visit_images')
            .select('storage_path')
            .eq('id', att.remoteId)
            .maybeSingle();

          if (imgRow?.storage_path) {
            const { data: signedData } = await supabase.storage
              .from('visit-attachments')
              .createSignedUrl(imgRow.storage_path, 300);

            if (signedData?.signedUrl) {
              const dlUri = await VisitPhotoService.downloadFromSignedUrl(
                signedData.signedUrl,
                att.fileName || `visit-img-${att.remoteId}.jpg`
              );
              if (dlUri) {
                att.localUri = dlUri;
                bytes = await VisitPhotoService.readAttachmentBytes(dlUri);
              }
            }
          }
        } catch (err) {
          console.warn('[DocxReportService] Failed fallback download for attachment:', att.id, err);
        }
      }

      // Validate photo bytes
      if (!bytes || bytes.length === 0) {
        missingPhotosList.push(
          `${cleanCaption} (${visitorLabel} - Kunjungan ${vt.date || 'tanpa tanggal'})`
        );
        continue;
      }

      const imageIndex = imageParts.length + 1;
      const ext = att.fileName?.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      const mediaFilename = `image${imageIndex}.${ext}`;
      const relId = `rIdImg${imageIndex}`;

      imageParts.push({
        relId,
        filename: mediaFilename,
        mime,
        bytes,
      });

      if (dedupeKey) {
        photoCacheByUri.set(dedupeKey, { relId, filename: mediaFilename, mime });
      }

      const { cx, cy } = calculateEmuDimensions(att.width, att.height);

      placementsForThisVisit.push({
        relId,
        caption: cleanCaption,
        cx,
        cy,
      });

      photoNumInVisit++;
    }

    imagePlacementsByVisitId.set(vt.id, placementsForThisVisit);
  }
}

// =============================================================================
// Public Service API
// =============================================================================

export interface ExportWordResult {
  success: boolean;
  filePath?: string;
  error?: string;
  missingPhotosWarning?: string;
}

export const DocxReportService = {
  /**
   * Generates a .docx report for the specified visitor and opens native sharing.
   */
  async exportVisitorWordReport(visitor: Visitor): Promise<ExportWordResult> {
    let docxFile: File | null = null;
    try {
      if (!visitor || !visitor.id) {
        return { success: false, error: 'Data pengunjung tidak valid.' };
      }

      const now = new Date();
      const generatedDateStr = formatIndoDateTime(now);
      const dateForFile = formatDateForFilename(now);
      const safeVisitorName = sanitizeFilename(visitor.name || 'Pengunjung');
      const filename = `Laporan_${safeVisitorName}_${dateForFile}.docx`;

      // 1. Sort visits in chronological order (oldest first) without mutating stored data
      const rawVisits = (visitor.visits || []).filter((vt) => !vt.deletedAt);
      const visitsSorted = sortVisitsChronologicalAscending(rawVisits);

      // 2. Collect and load photo binaries
      const imageParts: { relId: string; filename: string; mime: string; bytes: Uint8Array }[] = [];
      const imagePlacementsByVisitId = new Map<string, ImagePlacement[]>();
      const missingPhotosList: string[] = [];
      const photoCache = new Map<string, { relId: string; filename: string; mime: string }>();

      await processVisitPhotos(
        visitsSorted,
        imageParts,
        imagePlacementsByVisitId,
        missingPhotosList,
        photoCache,
        visitor.name || 'Pengunjung'
      );

      // If there are unreadable photos, warn user rather than silently omitting
      let missingPhotosWarning: string | undefined = undefined;
      if (missingPhotosList.length > 0) {
        missingPhotosWarning = `Perhatian: Terdapat ${missingPhotosList.length} foto lampiran yang tidak dapat dimuat:\n• ${missingPhotosList.slice(0, 3).join('\n• ')}${missingPhotosList.length > 3 ? `\n...dan ${missingPhotosList.length - 3} lainnya` : ''}`;
      }

      // 3. Generate XML strings
      const contentTypesXml = generateContentTypesXml(imageParts);
      const relsXml = generateRelsXml();
      const documentRelsXml = generateDocumentRelsXml(imageParts);
      const stylesXml = generateStylesXml();
      const footerXml = generateFooterXml();
      const documentXml = generateDocumentXml(visitor, visitsSorted, generatedDateStr, imagePlacementsByVisitId);

      // 4. Construct ZIP archive in memory using fflate
      const textEncoder = new TextEncoder();
      const zipData: Record<string, Uint8Array> = {
        '[Content_Types].xml': textEncoder.encode(contentTypesXml),
        '_rels/.rels': textEncoder.encode(relsXml),
        'word/_rels/document.xml.rels': textEncoder.encode(documentRelsXml),
        'word/document.xml': textEncoder.encode(documentXml),
        'word/styles.xml': textEncoder.encode(stylesXml),
        'word/footer1.xml': textEncoder.encode(footerXml),
      };

      // Embed binary images into word/media/
      for (const img of imageParts) {
        zipData[`word/media/${img.filename}`] = img.bytes;
      }

      const zipped = zipSync(zipData);

      // 5. Write to persistent cache file
      docxFile = new File(Paths.cache, filename);
      if (docxFile.exists) docxFile.delete();
      docxFile.write(zipped);

      // 6. Native Share dialog
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        return {
          success: false,
          error: 'Fitur berbagi file tidak tersedia di perangkat ini.',
        };
      }

      await Sharing.shareAsync(docxFile.uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        dialogTitle: `Laporan Riwayat Kunjungan - ${visitor.name}`,
        UTI: 'org.openxmlformats.wordprocessingml.document',
      });

      return {
        success: true,
        filePath: docxFile.uri,
        missingPhotosWarning,
      };
    } catch (err: unknown) {
      if (docxFile && docxFile.exists) {
        try {
          docxFile.delete();
        } catch {
          // ignore cache cleanup error
        }
      }
      const message = err instanceof Error ? err.message : 'Gagal membuat laporan Word.';
      return { success: false, error: message };
    }
  },

  /**
   * Generates a single comprehensive .docx report containing ALL visitors and their visit histories.
   */
  async exportAllVisitorsWordReport(visitors: Visitor[]): Promise<ExportWordResult> {
    let docxFile: File | null = null;
    try {
      const activeVisitors = (visitors || []).filter((v) => !v.deletedAt);

      if (activeVisitors.length === 0) {
        return {
          success: false,
          error: 'Belum ada data pengunjung untuk diekspor.',
        };
      }

      const now = new Date();
      const generatedDateStr = formatIndoDateTime(now);
      const dateForFile = formatDateForFilename(now);
      const filename = `Laporan_Semua_Pengunjung_${dateForFile}.docx`;

      // Count total visits across all active visitors
      let totalVisitsCount = 0;
      for (const v of activeVisitors) {
        totalVisitsCount += (v.visits || []).filter((vt) => !vt.deletedAt).length;
      }

      // Collect photos across all visitors
      const imageParts: { relId: string; filename: string; mime: string; bytes: Uint8Array }[] = [];
      const imagePlacementsByVisitId = new Map<string, ImagePlacement[]>();
      const missingPhotosList: string[] = [];
      const photoCache = new Map<string, { relId: string; filename: string; mime: string }>();

      for (const visitor of activeVisitors) {
        const rawVisits = (visitor.visits || []).filter((vt) => !vt.deletedAt);
        const visitsSorted = sortVisitsChronologicalAscending(rawVisits);

        await processVisitPhotos(
          visitsSorted,
          imageParts,
          imagePlacementsByVisitId,
          missingPhotosList,
          photoCache,
          visitor.name || 'Pengunjung'
        );
      }

      // If there are unreadable photos, warn user rather than silently omitting
      let missingPhotosWarning: string | undefined = undefined;
      if (missingPhotosList.length > 0) {
        missingPhotosWarning = `Perhatian: Terdapat ${missingPhotosList.length} foto lampiran yang tidak dapat dimuat:\n• ${missingPhotosList.slice(0, 3).join('\n• ')}${missingPhotosList.length > 3 ? `\n...dan ${missingPhotosList.length - 3} lainnya` : ''}`;
      }

      // Generate XML strings
      const contentTypesXml = generateContentTypesXml(imageParts);
      const relsXml = generateRelsXml();
      const documentRelsXml = generateDocumentRelsXml(imageParts);
      const stylesXml = generateStylesXml();
      const footerXml = generateFooterXml();
      const documentXml = generateAllVisitorsDocumentXml(
        activeVisitors,
        totalVisitsCount,
        generatedDateStr,
        imagePlacementsByVisitId
      );

      // Construct ZIP archive in memory using fflate
      const textEncoder = new TextEncoder();
      const zipData: Record<string, Uint8Array> = {
        '[Content_Types].xml': textEncoder.encode(contentTypesXml),
        '_rels/.rels': textEncoder.encode(relsXml),
        'word/_rels/document.xml.rels': textEncoder.encode(documentRelsXml),
        'word/document.xml': textEncoder.encode(documentXml),
        'word/styles.xml': textEncoder.encode(stylesXml),
        'word/footer1.xml': textEncoder.encode(footerXml),
      };

      for (const img of imageParts) {
        zipData[`word/media/${img.filename}`] = img.bytes;
      }

      const zipped = zipSync(zipData);

      // Write to persistent cache file
      docxFile = new File(Paths.cache, filename);
      if (docxFile.exists) docxFile.delete();
      docxFile.write(zipped);

      // Native Share dialog
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        return {
          success: false,
          error: 'Fitur berbagi file tidak tersedia di perangkat ini.',
        };
      }

      await Sharing.shareAsync(docxFile.uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        dialogTitle: 'Laporan Data Pengunjung Visitra',
        UTI: 'org.openxmlformats.wordprocessingml.document',
      });

      return {
        success: true,
        filePath: docxFile.uri,
        missingPhotosWarning,
      };
    } catch (err: unknown) {
      if (docxFile && docxFile.exists) {
        try {
          docxFile.delete();
        } catch {
          // ignore cache cleanup error
        }
      }
      const message = err instanceof Error ? err.message : 'Gagal membuat laporan Word.';
      return { success: false, error: message };
    }
  },

  /**
   * Export all visits within a specific date range across all visitors to a Word (.docx) file.
   * - Filters visits inclusively based on their visit date.
   * - Includes only visitors who have at least 1 visit within the date range.
   * - Embeds photos and preserves chronological ordering and A4 layout.
   */
  async exportDateRangeWordReport(
    visitors: Visitor[],
    startDate: Date,
    endDate: Date
  ): Promise<{ success: boolean; filePath?: string; missingPhotosWarning?: string; error?: string }> {
    let docxFile: File | null = null;
    try {
      const activeVisitors = visitors.filter((v) => !v.deletedAt);
      if (activeVisitors.length === 0) {
        return {
          success: false,
          error: 'Belum ada data pengunjung untuk diekspor.',
        };
      }

      // Normalize date boundaries to midnight (00:00:00.000) for inclusive day-level comparison
      const startDayEpoch = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
        0, 0, 0, 0
      ).getTime();

      const endDayEpoch = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate(),
        0, 0, 0, 0
      ).getTime();

      // Filter visitors and their visits: keep only non-deleted visits within [startDayEpoch, endDayEpoch]
      const visitorsWithFilteredVisits: Visitor[] = [];
      let totalFilteredVisitsCount = 0;

      for (const visitor of activeVisitors) {
        const rawVisits = (visitor.visits || []).filter((vt) => !vt.deletedAt);
        const matchedVisits: Visit[] = [];

        for (const vt of rawVisits) {
          const visitDateEpoch = parseVisitDateOnlyEpoch(vt.date);
          if (visitDateEpoch !== null) {
            if (visitDateEpoch >= startDayEpoch && visitDateEpoch <= endDayEpoch) {
              matchedVisits.push(vt);
            }
          } else {
            // Fallback: if visit.date cannot be parsed, use fallback createdAt if available
            if (vt.createdAt) {
              const createdDate = new Date(vt.createdAt);
              const createdDayEpoch = new Date(
                createdDate.getFullYear(),
                createdDate.getMonth(),
                createdDate.getDate(),
                0, 0, 0, 0
              ).getTime();
              if (createdDayEpoch >= startDayEpoch && createdDayEpoch <= endDayEpoch) {
                matchedVisits.push(vt);
              }
            }
          }
        }

        if (matchedVisits.length > 0) {
          visitorsWithFilteredVisits.push({
            ...visitor,
            visits: matchedVisits,
          });
          totalFilteredVisitsCount += matchedVisits.length;
        }
      }

      if (visitorsWithFilteredVisits.length === 0 || totalFilteredVisitsCount === 0) {
        return {
          success: false,
          error: 'Tidak ditemukan riwayat kunjungan pada periode tanggal yang dipilih.',
        };
      }

      const now = new Date();
      const generatedDateStr = formatIndoDateTime(now);
      const startFileStr = formatDateForFilename(startDate);
      const endFileStr = formatDateForFilename(endDate);
      const filename = `Laporan_Visitra_${startFileStr}_sampai_${endFileStr}.docx`;

      const startIndoStr = `${startDate.getDate()} ${INDO_MONTHS[startDate.getMonth()]} ${startDate.getFullYear()}`;
      const endIndoStr = `${endDate.getDate()} ${INDO_MONTHS[endDate.getMonth()]} ${endDate.getFullYear()}`;
      const periodSubtitle = `Periode Kunjungan: ${startIndoStr} s/d ${endIndoStr}`;

      // Collect photos across all filtered visitors and visits
      const imageParts: { relId: string; filename: string; mime: string; bytes: Uint8Array }[] = [];
      const imagePlacementsByVisitId = new Map<string, ImagePlacement[]>();
      const missingPhotosList: string[] = [];
      const photoCache = new Map<string, { relId: string; filename: string; mime: string }>();

      for (const visitor of visitorsWithFilteredVisits) {
        const rawVisits = (visitor.visits || []).filter((vt) => !vt.deletedAt);
        const visitsSorted = sortVisitsChronologicalAscending(rawVisits);

        await processVisitPhotos(
          visitsSorted,
          imageParts,
          imagePlacementsByVisitId,
          missingPhotosList,
          photoCache,
          visitor.name || 'Pengunjung'
        );
      }

      // If there are unreadable photos, warn user rather than silently omitting
      let missingPhotosWarning: string | undefined = undefined;
      if (missingPhotosList.length > 0) {
        missingPhotosWarning = `Perhatian: Terdapat ${missingPhotosList.length} foto lampiran yang tidak dapat dimuat:\n• ${missingPhotosList.slice(0, 3).join('\n• ')}${missingPhotosList.length > 3 ? `\n...dan ${missingPhotosList.length - 3} lainnya` : ''}`;
      }

      // Generate XML strings
      const contentTypesXml = generateContentTypesXml(imageParts);
      const relsXml = generateRelsXml();
      const documentRelsXml = generateDocumentRelsXml(imageParts);
      const stylesXml = generateStylesXml();
      const footerXml = generateFooterXml();
      const documentXml = generateAllVisitorsDocumentXml(
        visitorsWithFilteredVisits,
        totalFilteredVisitsCount,
        generatedDateStr,
        imagePlacementsByVisitId,
        periodSubtitle
      );

      // Construct ZIP archive in memory using fflate
      const textEncoder = new TextEncoder();
      const zipData: Record<string, Uint8Array> = {
        '[Content_Types].xml': textEncoder.encode(contentTypesXml),
        '_rels/.rels': textEncoder.encode(relsXml),
        'word/_rels/document.xml.rels': textEncoder.encode(documentRelsXml),
        'word/document.xml': textEncoder.encode(documentXml),
        'word/styles.xml': textEncoder.encode(stylesXml),
        'word/footer1.xml': textEncoder.encode(footerXml),
      };

      for (const img of imageParts) {
        zipData[`word/media/${img.filename}`] = img.bytes;
      }

      const zipped = zipSync(zipData);

      // Write to persistent cache file
      docxFile = new File(Paths.cache, filename);
      if (docxFile.exists) docxFile.delete();
      docxFile.write(zipped);

      // Native Share dialog
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        return {
          success: false,
          error: 'Fitur berbagi file tidak tersedia di perangkat ini.',
        };
      }

      await Sharing.shareAsync(docxFile.uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        dialogTitle: 'Laporan Kunjungan Berdasarkan Periode (Visitra)',
        UTI: 'org.openxmlformats.wordprocessingml.document',
      });

      return {
        success: true,
        filePath: docxFile.uri,
        missingPhotosWarning,
      };
    } catch (err: unknown) {
      if (docxFile && docxFile.exists) {
        try {
          docxFile.delete();
        } catch {
          // ignore cache cleanup error
        }
      }
      const message = err instanceof Error ? err.message : 'Gagal membuat laporan Word berdasarkan periode.';
      return { success: false, error: message };
    }
  },
};
