/* ============================================================
   js/exclusive.js  (v4.2.00)
   Exklusive Schichten: Tischtabelle mit Soll, Ist, Tisch-Nr. und frei benennbaren Gerichten

   - NUR Manager/Developer (Kachel „🍽️ Exklusiv-Schicht“ im Dashboard; die Datenbank erlaubt es auch nur ihnen).
   - Pro Schicht: Tische (Soll/Ist beginnen leer) und Gericht-Spalten (Anzahl oder Notiz, z. B. „Medium Well“).
     Gerichte lassen sich direkt in der Kopfzeile umbenennen, hinzufügen, löschen und sortieren.
   - Summen unten: Soll, Ist und jedes Gericht (Notizen und Tisch-Nr. werden nicht gezählt).
   - „Tisch hinzufügen“: neue Zeile mit der nächsten Tisch-Nummer.
   - Drucken (A4/A3 quer) und Excel-Export im gleichen Aussehen wie die Vorlage (reine Datei, ohne Zusatzbibliothek).
   Tabellen: exclusive_shifts, exclusive_tables; Funktion exclusive_set_field (sql/4.2.00_exclusive.sql).
   ============================================================ */

// <<pure  (reine Funktionen ohne Seiteneffekte; auch für Tests ohne Browser verwendbar)
    const EX_DEFAULT_TABLES = ['101', '102', '103', '104', '105', '106', '107', '108', '109', '110',
      '301', '302', '303', '304', '305', '306', '307', '308', '309', '310', '311',
      '401', '402', '403', '404', '405', '406', '407', '408', '409', '410', '411', '666'];
    const EX_DEFAULT_DISHES = [{ name: 'Tag', type: 'count' }, { name: 'Fisch', type: 'count' }, { name: 'Rav', type: 'count' }, { name: 'Extras', type: 'note' }];

    function exNewDishId() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

    // Tische nach Nummer sortieren (Zahlen zuerst numerisch, dann Text)
    function exSortTables(rows) {
      const num = v => (/^\d+$/.test(String(v).trim()) ? parseInt(v, 10) : null);
      return rows.slice().sort((a, b) => {
        const x = num(a.table_no), y = num(b.table_no);
        if (x !== null && y !== null) return x - y || String(a.table_no).localeCompare(String(b.table_no));
        if (x !== null) return -1;
        if (y !== null) return 1;
        return String(a.table_no).localeCompare(String(b.table_no), undefined, { numeric: true });
      });
    }

    // Summen: Soll, Ist und pro Gericht (nur Typ „count“)
    function exTotals(dishes, rows) {
      const t = { soll: 0, ist: 0, counts: {}, tables: rows.length };
      dishes.forEach(d => { if (d.type !== 'note') t.counts[d.id] = 0; });
      rows.forEach(r => {
        t.soll += Number(r.soll) || 0;
        t.ist += Number(r.ist) || 0;
        dishes.forEach(d => { if (d.type !== 'note') t.counts[d.id] += Number((r.cells || {})[d.id]) || 0; });
      });
      return t;
    }

    // Nächste Tisch-Nummer: nach dem höchsten „normalen“ Tisch (unter 600; Sondertische wie 666 zählen nicht)
    function exNextTableNo(rows) {
      const nums = rows.map(r => String(r.table_no).trim()).filter(v => /^\d+$/.test(v)).map(Number);
      const normal = nums.filter(n => n < 600);
      if (normal.length) return String(Math.max.apply(null, normal) + 1);
      if (nums.length) return String(Math.max.apply(null, nums) + 1);
      return '101';
    }

    function exColLetter(i) {
      let s = ''; i++;
      while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
      return s;
    }
    function exXml(s) {
      return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function exHtml(s) { return exXml(s).replace(/'/g, '&#39;'); }

    // --- Minimaler ZIP-Schreiber (ohne Kompression), damit die .xlsx-Datei ohne Zusatzbibliothek entsteht ---
    let EX_CRC_TABLE = null;
    function exCrc32(bytes) {
      if (!EX_CRC_TABLE) {
        EX_CRC_TABLE = new Uint32Array(256);
        for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); EX_CRC_TABLE[n] = c >>> 0; }
      }
      let crc = 0xFFFFFFFF;
      for (let i = 0; i < bytes.length; i++) crc = EX_CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
      return (crc ^ 0xFFFFFFFF) >>> 0;
    }
    function exZip(files) {   // files: [{ name, data: string }]
      const enc = new TextEncoder();
      const parts = [], central = [];
      let offset = 0;
      const dosTime = 0, dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
      files.forEach(f => {
        const name = enc.encode(f.name), data = enc.encode(f.data), crc = exCrc32(data);
        const lh = new DataView(new ArrayBuffer(30));
        lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
        lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
        lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
        parts.push(new Uint8Array(lh.buffer), name, data);
        const ch = new DataView(new ArrayBuffer(46));
        ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
        ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
        ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
        ch.setUint32(42, offset, true);
        central.push(new Uint8Array(ch.buffer), name);
        offset += 30 + name.length + data.length;
      });
      let cdSize = 0; central.forEach(c => { cdSize += c.length; });
      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
      end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
      const all = parts.concat(central, [new Uint8Array(end.buffer)]);
      let total = 0; all.forEach(p => { total += p.length; });
      const out = new Uint8Array(total); let pos = 0;
      all.forEach(p => { out.set(p, pos); pos += p.length; });
      return out;
    }

    // Excel-Datei im Aussehen der Vorlage: Kopf grün, Tisch-Nr. gelb, Summenzeile grau, fixierte Spalten/Kopfzeile, Querformat
    // model: { title, dateText, dishes:[{id,name,type}], rows:[{table_no,soll,ist,cells}], paper: 'A4' | 'A3' }
    function exBuildXlsx(model) {
      const dishes = model.dishes, rows = exSortTables(model.rows), tot = exTotals(dishes, rows);
      const ncols = 3 + dishes.length;
      const cell = (c, r, style, v) => {
        const ref = exColLetter(c) + r;
        if (v === null || v === undefined || v === '') return `<c r="${ref}" s="${style}"/>`;
        if (typeof v === 'number') return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
        return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${exXml(v)}</t></is></c>`;
      };
      const sheetRows = [];
      sheetRows.push(`<row r="1" ht="24" customHeight="1">${cell(0, 1, 6, model.title + (model.dateText ? '  ·  ' + model.dateText : ''))}</row>`);
      let hdr = cell(0, 2, 1, 'Soll') + cell(1, 2, 1, 'Ist') + cell(2, 2, 1, 'T.Nr.');
      dishes.forEach((d, i) => { hdr += cell(3 + i, 2, 1, d.name); });
      sheetRows.push(`<row r="2" ht="24" customHeight="1">${hdr}</row>`);
      let r = 3;
      rows.forEach(row => {
        const tn = /^\d+$/.test(String(row.table_no).trim()) ? parseInt(row.table_no, 10) : String(row.table_no);
        let x = cell(0, r, 2, row.soll == null ? null : Number(row.soll)) + cell(1, r, 2, row.ist == null ? null : Number(row.ist)) + cell(2, r, 3, tn);
        dishes.forEach((d, i) => {
          const v = (row.cells || {})[d.id];
          if (d.type === 'note') x += cell(3 + i, r, 4, v == null ? null : String(v));
          else x += cell(3 + i, r, 2, v == null || v === '' ? null : Number(v));
        });
        sheetRows.push(`<row r="${r}" ht="20" customHeight="1">${x}</row>`);
        r++;
      });
      let ft = cell(0, r, 5, tot.soll) + cell(1, r, 5, tot.ist) + cell(2, r, 5, 'Σ');
      dishes.forEach((d, i) => { ft += d.type === 'note' ? cell(3 + i, r, 5, null) : cell(3 + i, r, 5, tot.counts[d.id]); });
      sheetRows.push(`<row r="${r}" ht="22" customHeight="1">${ft}</row>`);
      const lastRow = r;

      const cols = [`<col min="1" max="1" width="7" customWidth="1"/>`, `<col min="2" max="2" width="7" customWidth="1"/>`, `<col min="3" max="3" width="9" customWidth="1"/>`]
        .concat(dishes.map((d, i) => `<col min="${4 + i}" max="${4 + i}" width="${d.type === 'note' ? 26 : 14}" customWidth="1"/>`)).join('');
      const paper = model.paper === 'A3' ? 8 : 9;
      const sheetName = 'Exklusiv';
      const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${exColLetter(ncols - 1)}${lastRow}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="3" ySplit="2" topLeftCell="D3" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${cols}</cols><sheetData>${sheetRows.join('')}</sheetData><printOptions horizontalCentered="1"/><pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="${paper}" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;L${exXml(model.title)}&amp;RSeite &amp;P / &amp;N</oddFooter></headerFooter></worksheet>`;

      const side = c => `<left style="thin"><color rgb="${c}"/></left><right style="thin"><color rgb="${c}"/></right>`;
      const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFA9D08E"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE699"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border>${side('FF7F7F7F')}<top style="thin"><color rgb="FF7F7F7F"/></top><bottom style="thin"><color rgb="FF7F7F7F"/></bottom><diagonal/></border><border>${side('FF7F7F7F')}<top style="medium"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF7F7F7F"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
      const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">${sheetName}!$1:$2</definedName></definedNames></workbook>`;
      const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
      const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
      const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
      return exZip([
        { name: '[Content_Types].xml', data: ct }, { name: '_rels/.rels', data: rels },
        { name: 'xl/workbook.xml', data: workbook }, { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
        { name: 'xl/styles.xml', data: styles }, { name: 'xl/worksheets/sheet1.xml', data: sheet }
      ]);
    }

    // Druck-Seite (HTML) – gleiches Aussehen wie die Excel-Datei
    function exPrintHtml(model) {
      const dishes = model.dishes, rows = exSortTables(model.rows), tot = exTotals(dishes, rows);
      const paper = model.paper === 'A3' ? 'A3' : 'A4';
      const n = 3 + dishes.length;
      // Zeilenhöhe so wählen, dass die Tabelle möglichst auf eine Seite passt (viele Tische = engere Zeilen)
      const avail = paper === 'A3' ? 232 : 150;
      const rh = Math.max(4.2, Math.min(7.4, avail / (rows.length + 2)));
      let fs = n > 14 ? 8.5 : n > 10 ? 10 : 11.5;
      if (rh < 5.2) fs = Math.min(fs, 8); else if (rh < 6.2) fs = Math.min(fs, 9.5);
      const th = (t, cls) => `<th class="${cls || ''}">${exHtml(t)}</th>`;
      const num = v => (v == null || v === '' ? '' : exHtml(v));
      const body = rows.map(r => `<tr><td class="c b">${num(r.soll)}</td><td class="c b">${num(r.ist)}</td><td class="c b no">${exHtml(r.table_no)}</td>${
        dishes.map(d => d.type === 'note' ? `<td class="l">${num((r.cells || {})[d.id])}</td>` : `<td class="c b">${num((r.cells || {})[d.id])}</td>`).join('')}</tr>`).join('');
      const foot = `<tr class="tot"><td class="c b">${tot.soll}</td><td class="c b">${tot.ist}</td><td class="c b">Σ</td>${
        dishes.map(d => d.type === 'note' ? '<td></td>' : `<td class="c b">${tot.counts[d.id]}</td>`).join('')}</tr>`;
      return `<!doctype html><html><head><meta charset="utf-8"><title>${exHtml(model.title)}</title><style>
@page { size: ${paper} landscape; margin: 9mm; }
* { box-sizing: border-box; }
body { font-family: Calibri, Arial, sans-serif; color: #000; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1 { font-size: ${fs + 5}pt; margin: 0 0 3mm; display: flex; justify-content: space-between; }
h1 span { font-weight: 400; font-size: ${fs + 1}pt; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: ${fs}pt; }
th, td { border: 1px solid #7f7f7f; padding: 0 1.5mm; height: ${rh.toFixed(1)}mm; line-height: 1.1; }
th { background: #a9d08e; font-weight: 700; text-align: center; }
th.s, td.s { width: 12mm; }
td.c { text-align: center; } td.l { text-align: left; overflow: hidden; } .b { font-weight: 700; }
td.no { background: #ffe699; }
tr.tot td { background: #d9d9d9; border-top: 2px solid #000; height: ${(rh + 1).toFixed(1)}mm; }
thead { display: table-header-group; } tr { page-break-inside: avoid; }
.foot { margin-top: 3mm; font-size: 8pt; color: #555; }
</style></head><body>
<h1>${exHtml(model.title)}<span>${exHtml(model.dateText || '')}</span></h1>
<table><colgroup><col style="width:11mm"><col style="width:11mm"><col style="width:15mm">${dishes.map(d => d.type === 'note' ? '<col style="width:34mm">' : '<col>').join('')}</colgroup>
<thead><tr>${th('Soll')}${th('Ist')}${th('T.Nr.')}${dishes.map(d => th(d.name)).join('')}</tr></thead>
<tbody>${body}</tbody><tfoot>${foot}</tfoot></table>
<div class="foot">${exHtml(model.printedText || '')}</div>
</body></html>`;
    }
// >>pure

    // ---------------------------------------------------------------
    // Zustand und Laden
    // ---------------------------------------------------------------
    let ex = { m: null, shifts: [], shift: null, tables: [] };
    const EX_SEL_KEY = 'nexus_ex_shift';

    const exReadOnly = () => !ex.shift || ex.shift.status === 'closed';
    const exFmtDate = iso => fmParseIso(iso).toLocaleDateString(langLocale(), { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
    const exShiftLabel = s => exFmtDate(s.shift_date) + ' · ' + s.title + (s.status === 'closed' ? ' 🔒' : '');

    function exErrorHtml(err) {
      const msg = (err && err.message) ? String(err.message) : String(err || '');
      const code = (err && err.code) ? String(err.code) : '';
      if (/does not exist|schema cache|could not find/i.test(msg) || code === '42P01' || code === '42883' || /^PGRST20/.test(code)) {
        return `<p class="staff-empty" style="color:#ef4444">${escapeHtml(fmL(
          'Die Datenbank ist für diese Funktion noch nicht eingerichtet. Bitte zuerst sql/4.2.00_exclusive.sql im Supabase SQL Editor ausführen.',
          'The database is not set up for this feature yet. Please run sql/4.2.00_exclusive.sql in the Supabase SQL editor first.'))}</p>`;
      }
      return fmErrorHtml(err);
    }
    function exToastError(err) {
      const msg = (err && err.message) ? String(err.message) : String(err || '');
      if (/does not exist|schema cache|could not find/i.test(msg)) return fmToast(fmL('Bitte zuerst sql/4.2.00_exclusive.sql ausführen.', 'Please run sql/4.2.00_exclusive.sql first.'));
      fmToast(fmDbError(err));
    }

    function openExclusiveModal() {
      if (!userIsAdmin) return;
      closeSettingsMenu();
      ex.m = fmOpen('exModal', {
        title: '🍽️ ' + fmL('Exklusiv-Schicht', 'Exclusive shift'),
        sub: fmL('Tische, Gäste und Gerichte – Summen unten.', 'Tables, guests and dishes – totals at the bottom.'),
        wide: true
      });
      ex.m.root.classList.add('ex-root');
      ex.m.setBody('<p class="staff-empty">' + escapeHtml(fmL('Lade ...', 'Loading ...')) + '</p>');
      exLoadShifts(null);
    }

    async function exLoadShifts(selectId) {
      const { data, error } = await _supabase.from('exclusive_shifts').select('id,title,shift_date,status,dishes,created_by')
        .order('shift_date', { ascending: false }).order('created_at', { ascending: false }).limit(60);
      if (error) { ex.m.setBody(exErrorHtml(error)); ex.m.setToolbar(''); ex.m.setFoot(''); return; }
      ex.shifts = (data || []).map(s => Object.assign(s, { dishes: Array.isArray(s.dishes) ? s.dishes : [] }));
      let want = selectId;
      if (!want) { try { want = localStorage.getItem(EX_SEL_KEY); } catch (e) {} }
      ex.shift = ex.shifts.find(s => s.id === want) || ex.shifts[0] || null;
      if (ex.shift) await exLoadTables(); else ex.tables = [];
      exRender();
    }

    async function exLoadTables() {
      const { data, error } = await _supabase.from('exclusive_tables').select('*').eq('shift_id', ex.shift.id).limit(300);
      if (error) { ex.tables = []; fmToast(fmDbError(error)); return; }
      ex.tables = (data || []).map(r => Object.assign(r, { cells: (r.cells && typeof r.cells === 'object') ? r.cells : {} }));
    }

    async function exSelectShift(id) {
      ex.shift = ex.shifts.find(s => s.id === id) || null;
      try { localStorage.setItem(EX_SEL_KEY, id); } catch (e) {}
      if (ex.shift) await exLoadTables();
      exRender();
    }

    // ---------------------------------------------------------------
    // Darstellung
    // ---------------------------------------------------------------
    function exRender() {
      if (!ex.m) return;
      const s = ex.shift;
      const bar = [];
      if (ex.shifts.length) {
        bar.push(`<select id="exShiftSel" class="ui-field ex-sel" onchange="exSelectShift(this.value)">${ex.shifts.map(x =>
          `<option value="${x.id}"${s && s.id === x.id ? ' selected' : ''}>${escapeHtml(exShiftLabel(x))}</option>`).join('')}</select>`);
      }
      bar.push(`<button type="button" class="fm-btn" onclick="exNewShift()">➕ ${escapeHtml(fmL('Neue Schicht', 'New shift'))}</button>`);
      if (s) {
        const ro = exReadOnly();
        if (!ro) bar.push(`<button type="button" class="fm-btn fm-btn-ok" onclick="exAddTable()">➕ ${escapeHtml(fmL('Tisch hinzufügen', 'Add table'))}</button>`,
          `<button type="button" class="fm-btn" onclick="exEditDishes()">🍽️ ${escapeHtml(fmL('Gerichte', 'Dishes'))}</button>`);
        bar.push(`<button type="button" class="fm-btn" onclick="exPrintDialog()">🖨️ ${escapeHtml(fmL('Drucken', 'Print'))}</button>`,
          `<button type="button" class="fm-btn" onclick="exExportXlsx()">📊 Excel</button>`,
          `<button type="button" class="fm-btn" onclick="exShiftMenu()">⋯</button>`);
      }
      ex.m.setToolbar(`<div class="ex-bar">${bar.join('')}</div>`);
      ex.m.setFoot('');

      if (!s) {
        ex.m.setBody(`<div class="ex-empty"><p>${escapeHtml(fmL('Noch keine Schicht angelegt.', 'No shift created yet.'))}</p>
          <button type="button" class="ui-btn-primary" onclick="exNewShift()">➕ ${escapeHtml(fmL('Erste Schicht anlegen', 'Create first shift'))}</button></div>`);
        return;
      }
      const ro = exReadOnly();
      const rows = exSortTables(ex.tables);
      const dis = ro ? ' disabled' : '';
      const head = `<tr><th class="ex-s1">Soll</th><th class="ex-s2">Ist</th><th class="ex-s3">T.Nr.</th>${s.dishes.map(d =>
        `<th class="${d.type === 'note' ? 'ex-note' : ''}"><input type="text" class="ex-th" maxlength="30" value="${escapeHtml(d.name)}"${dis} onchange="exRenameDish(${jsArg(d.id)}, this)" title="${escapeHtml(fmL('Name des Gerichts (zum Ändern antippen)', 'Dish name (tap to change)'))}"></th>`).join('')}${ro ? '' : '<th class="ex-x"></th>'}</tr>`;
      const bodyRows = rows.map(r => `<tr data-id="${r.id}">
        <td class="ex-s1"><input class="ex-cell" type="number" inputmode="numeric" min="0" max="99" value="${r.soll == null ? '' : r.soll}"${dis} oninput="exInput(${jsArg(r.id)},'soll',this)" onchange="exSet(${jsArg(r.id)},'soll',this)"></td>
        <td class="ex-s2"><input class="ex-cell" type="number" inputmode="numeric" min="0" max="99" value="${r.ist == null ? '' : r.ist}"${dis} oninput="exInput(${jsArg(r.id)},'ist',this)" onchange="exSet(${jsArg(r.id)},'ist',this)"></td>
        <td class="ex-s3"><input class="ex-cell ex-no" type="text" maxlength="12" value="${escapeHtml(r.table_no)}"${dis} onchange="exSet(${jsArg(r.id)},'table_no',this)"></td>
        ${s.dishes.map(d => d.type === 'note'
          ? `<td class="ex-note"><input class="ex-cell ex-text" type="text" maxlength="60" value="${escapeHtml(r.cells[d.id] == null ? '' : r.cells[d.id])}"${dis} onchange="exSet(${jsArg(r.id)},${jsArg('c:' + d.id)},this)"></td>`
          : `<td><input class="ex-cell" type="number" inputmode="numeric" min="0" max="99" value="${r.cells[d.id] == null ? '' : escapeHtml(r.cells[d.id])}"${dis} oninput="exInput(${jsArg(r.id)},${jsArg('c:' + d.id)},this)" onchange="exSet(${jsArg(r.id)},${jsArg('c:' + d.id)},this)"></td>`).join('')}
        ${ro ? '' : `<td class="ex-x"><button type="button" class="ex-del" onclick="exDelTable(${jsArg(r.id)})" aria-label="${escapeHtml(fmL('Tisch löschen', 'Delete table'))}">🗑</button></td>`}</tr>`).join('');
      const empty = rows.length ? '' : `<tr><td colspan="${3 + s.dishes.length + (ro ? 0 : 1)}" class="ex-none">${escapeHtml(fmL('Keine Tische. Mit „Tisch hinzufügen“ einen anlegen.', 'No tables. Add one with “Add table”.'))}</td></tr>`;
      const foot = `<tr class="ex-tot"><td class="ex-s1" id="exTotSoll"></td><td class="ex-s2" id="exTotIst"></td><td class="ex-s3">Σ</td>${s.dishes.map(d =>
        `<td id="exTot_${d.id}"></td>`).join('')}${ro ? '' : '<td class="ex-x"></td>'}</tr>`;
      ex.m.setBody(`${ro ? `<p class="fm-hint">🔒 ${escapeHtml(fmL('Diese Schicht ist abgeschlossen (nur lesen). Über „⋯“ kannst du sie wieder öffnen.', 'This shift is closed (read only). Reopen it via “⋯”.'))}</p>` : ''}
        <div class="ex-wrap"><table class="ex-table" id="exTable"><thead>${head}</thead><tbody>${bodyRows}${empty}</tbody><tfoot>${foot}</tfoot></table></div>`);
      exUpdateTotals();
      exBindKeys();
    }

    function exUpdateTotals() {
      if (!ex.shift) return;
      const t = exTotals(ex.shift.dishes, ex.tables);
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
      set('exTotSoll', t.soll); set('exTotIst', t.ist);
      ex.shift.dishes.forEach(d => { if (d.type !== 'note') set('exTot_' + d.id, t.counts[d.id]); });
    }

    // Enter springt in dieselbe Spalte eine Zeile tiefer
    function exBindKeys() {
      const tb = document.getElementById('exTable');
      if (!tb || tb._keys) return;
      tb._keys = true;
      tb.addEventListener('keydown', e => {
        if (e.key !== 'Enter' || !e.target.classList.contains('ex-cell')) return;
        e.preventDefault();
        const td = e.target.closest('td'), tr = td.parentElement;
        const idx = Array.prototype.indexOf.call(tr.children, td);
        let next = tr.nextElementSibling;
        while (next && !next.querySelector('.ex-cell')) next = next.nextElementSibling;
        const target = next && next.children[idx] && next.children[idx].querySelector('.ex-cell');
        e.target.blur();
        if (target) { target.focus(); if (target.select) target.select(); }
      });
    }

    // ---------------------------------------------------------------
    // Eingabe und Speichern
    // ---------------------------------------------------------------
    function exDishType(field) {
      if (!field || field.indexOf('c:') !== 0) return null;
      const d = ex.shift.dishes.find(x => x.id === field.slice(2));
      return d ? d.type : 'count';
    }

    // Während der Eingabe: Summen sofort neu rechnen (noch nicht speichern)
    function exInput(id, field, el) {
      const row = ex.tables.find(r => r.id === id); if (!row) return;
      const raw = String(el.value).trim();
      const v = raw === '' ? null : (/^\d{1,2}$/.test(raw) ? parseInt(raw, 10) : null);
      if (field === 'soll' || field === 'ist') row[field] = v;
      else if (field.indexOf('c:') === 0) { if (v === null) delete row.cells[field.slice(2)]; else row.cells[field.slice(2)] = v; }
      exUpdateTotals();
    }

    async function exSet(id, field, el) {
      if (exReadOnly()) return;
      const row = ex.tables.find(r => r.id === id); if (!row) return;
      const raw = String(el.value).trim();
      const numeric = field === 'soll' || field === 'ist' || exDishType(field) === 'count';
      if (numeric && raw !== '' && !/^\d{1,2}$/.test(raw)) {
        fmToast(fmL('Bitte eine Zahl von 0 bis 99 eingeben.', 'Please enter a number from 0 to 99.'));
        el.classList.add('ex-err');
        return;
      }
      if (field === 'table_no' && raw === '') { fmToast(fmL('Die Tischnummer darf nicht leer sein.', 'The table number cannot be empty.')); el.value = row.table_no; return; }
      const { error } = await _supabase.rpc('exclusive_set_field', { p_id: id, p_field: field, p_value: raw });
      if (error) { el.classList.add('ex-err'); return exToastError(error); }
      el.classList.remove('ex-err');
      if (field === 'table_no') row.table_no = raw;
      else if (field === 'soll' || field === 'ist') row[field] = raw === '' ? null : parseInt(raw, 10);
      else if (raw === '') delete row.cells[field.slice(2)];
      else row.cells[field.slice(2)] = numeric ? parseInt(raw, 10) : raw;
      exUpdateTotals();
    }

    async function exAddTable() {
      if (exReadOnly()) return;
      const no = exNextTableNo(ex.tables);
      const { data, error } = await _supabase.from('exclusive_tables').insert([{ shift_id: ex.shift.id, table_no: no, updated_by: currentWaiterName }]).select().single();
      if (error) return exToastError(error);
      ex.tables.push(Object.assign(data, { cells: {} }));
      exRender();
      const tr = document.querySelector(`#exTable tr[data-id="${data.id}"]`);
      if (tr) { tr.scrollIntoView({ block: 'nearest' }); const inp = tr.querySelector('.ex-no'); if (inp) { inp.focus(); inp.select(); } }
    }

    async function exDelTable(id) {
      if (exReadOnly()) return;
      const row = ex.tables.find(r => r.id === id); if (!row) return;
      const hasData = row.soll != null || row.ist != null || Object.keys(row.cells || {}).length;
      if (hasData && !confirm(fmL('Tisch ' + row.table_no + ' mit allen Eingaben löschen?', 'Delete table ' + row.table_no + ' with all entries?'))) return;
      const { error } = await _supabase.from('exclusive_tables').delete().eq('id', id);
      if (error) return exToastError(error);
      ex.tables = ex.tables.filter(r => r.id !== id);
      exRender();
    }

    async function exSaveDishes(dishes) {
      const { error } = await _supabase.from('exclusive_shifts').update({ dishes }).eq('id', ex.shift.id);
      if (error) { exToastError(error); return false; }
      ex.shift.dishes = dishes;
      return true;
    }

    async function exRenameDish(dishId, el) {
      const name = String(el.value).trim().slice(0, 30);
      const old = ex.shift.dishes.find(d => d.id === dishId);
      if (!old) return;
      if (!name) { el.value = old.name; return fmToast(fmL('Der Name darf nicht leer sein.', 'The name cannot be empty.')); }
      const next = ex.shift.dishes.map(d => d.id === dishId ? Object.assign({}, d, { name }) : d);
      if (!await exSaveDishes(next)) el.value = old.name;
    }

    // Gerichte verwalten: Name, Art (Anzahl/Notiz), Reihenfolge, löschen, hinzufügen
    function exEditDishes() {
      if (exReadOnly()) return;
      ex.draft = ex.shift.dishes.map(d => Object.assign({}, d));
      const m = fmOpen('exDishes', { title: '🍽️ ' + fmL('Gerichte', 'Dishes'), sub: fmL('Spalten dieser Schicht', 'Columns of this shift'), layer: 2 });
      ex.dm = m;
      exRenderDishList();
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="fmClose('exDishes')">${escapeHtml(fmL('Abbrechen', 'Cancel'))}</button>
        <button type="button" class="ui-btn-primary" onclick="exDishesSave()">💾 ${escapeHtml(fmL('Speichern', 'Save'))}</button>`);
    }

    function exRenderDishList() {
      ex.dm.setBody(`<div class="fm-stack">
        <p class="fm-hint">${escapeHtml(fmL('„Anzahl“ wird unten summiert. „Notiz“ ist freier Text (z. B. Medium Well) und wird nicht gezählt. Das Löschen einer Spalte entfernt sie nur aus der Ansicht, bereits eingetragene Werte gehen dabei verloren, sobald du speicherst.', '“Count” is summed at the bottom. “Note” is free text (e.g. Medium Well) and is not counted. Deleting a column removes it from the view.'))}</p>
        ${ex.draft.map((d, i) => `<div class="ex-dish-row">
          <input type="text" class="ui-field" maxlength="30" value="${escapeHtml(d.name)}" oninput="exDraftSet(${i},'name',this.value)">
          <select class="ui-field" onchange="exDraftSet(${i},'type',this.value)">
            <option value="count"${d.type !== 'note' ? ' selected' : ''}>${escapeHtml(fmL('Anzahl', 'Count'))}</option>
            <option value="note"${d.type === 'note' ? ' selected' : ''}>${escapeHtml(fmL('Notiz', 'Note'))}</option></select>
          <button type="button" class="fm-btn" onclick="exDraftMove(${i},-1)"${i === 0 ? ' disabled' : ''}>↑</button>
          <button type="button" class="fm-btn" onclick="exDraftMove(${i},1)"${i === ex.draft.length - 1 ? ' disabled' : ''}>↓</button>
          <button type="button" class="fm-btn fm-btn-danger" onclick="exDraftDel(${i})">🗑</button></div>`).join('')}
        <button type="button" class="fm-btn fm-btn-ok" onclick="exDraftAdd()">➕ ${escapeHtml(fmL('Gericht hinzufügen', 'Add dish'))}</button></div>`);
    }
    function exDraftSet(i, k, v) { if (ex.draft[i]) ex.draft[i][k] = v; }
    function exDraftMove(i, dir) { const j = i + dir; if (j < 0 || j >= ex.draft.length) return; const t = ex.draft[i]; ex.draft[i] = ex.draft[j]; ex.draft[j] = t; exRenderDishList(); }
    function exDraftDel(i) { ex.draft.splice(i, 1); exRenderDishList(); }
    function exDraftAdd() { ex.draft.push({ id: exNewDishId(), name: fmL('Gericht', 'Dish') + ' ' + (ex.draft.length + 1), type: 'count' }); exRenderDishList(); }

    async function exDishesSave() {
      const list = ex.draft.map(d => ({ id: d.id, name: String(d.name).trim().slice(0, 30), type: d.type === 'note' ? 'note' : 'count' }));
      if (list.some(d => !d.name)) return fmToast(fmL('Jedes Gericht braucht einen Namen.', 'Every dish needs a name.'));
      if (await exSaveDishes(list)) { fmClose('exDishes'); exRender(); }
    }

    // ---------------------------------------------------------------
    // Schichten: anlegen, bearbeiten, abschließen, löschen
    // ---------------------------------------------------------------
    function exNewShift() {
      const last = ex.shifts[0] || null;
      ex.nw = { selected: new Set(EX_DEFAULT_TABLES), extra: [], copy: false, lastTables: [] };
      const m = fmOpen('exNew', { title: '➕ ' + fmL('Neue Schicht', 'New shift'), layer: 2 });
      ex.nm = m;
      const draw = () => {
        const all = Array.from(new Set(EX_DEFAULT_TABLES.concat(ex.nw.lastTables, ex.nw.extra)));
        const sorted = exSortTables(all.map(t => ({ table_no: t })));
        m.setBody(`<div class="fm-stack">
          <div class="fm-grid2">
            <div class="fm-field"><label class="form-label" for="exnTitle">${escapeHtml(fmL('Name', 'Name'))}</label>
              <input type="text" id="exnTitle" class="ui-field" maxlength="80" value="${escapeHtml(ex.nw.title || 'Exklusiv')}" oninput="ex.nw.title=this.value"></div>
            <div class="fm-field"><label class="form-label" for="exnDate">${escapeHtml(fmL('Datum', 'Date'))}</label>
              <input type="date" id="exnDate" class="ui-field" value="${ex.nw.date || fmIso(new Date())}" oninput="ex.nw.date=this.value"></div>
          </div>
          ${last ? `<label class="sp-confirm" style="font-weight:700"><input type="checkbox" ${ex.nw.copy ? 'checked' : ''} onchange="exNewCopy(this.checked)"> ${escapeHtml(fmL(
            'Gerichte und Tische der letzten Schicht übernehmen (Zahlen bleiben leer)', 'Copy dishes and tables of the last shift (numbers stay empty)'))}</label>` : ''}
          <div class="fm-field"><label class="form-label">${escapeHtml(fmL('Tische', 'Tables'))} (${ex.nw.selected.size})</label>
            <div class="fm-row-flex" style="gap:.4rem;flex-wrap:wrap;margin-bottom:.4rem">
              <button type="button" class="fm-btn" onclick="exNewAll(true)">${escapeHtml(fmL('Alle', 'All'))}</button>
              <button type="button" class="fm-btn" onclick="exNewAll(false)">${escapeHtml(fmL('Keine', 'None'))}</button></div>
            <div class="ex-chips">${sorted.map(t => `<button type="button" class="ex-chip${ex.nw.selected.has(t.table_no) ? ' on' : ''}" onclick="exNewToggle(${jsArg(t.table_no)})">${escapeHtml(t.table_no)}</button>`).join('')}</div></div>
          <div class="fm-field"><label class="form-label" for="exnExtra">${escapeHtml(fmL('Weitere Tische (mit Komma getrennt)', 'More tables (comma separated)'))}</label>
            <div class="fm-row-flex" style="gap:.4rem"><input type="text" id="exnExtra" class="ui-field" placeholder="501, 502" onkeydown="if(event.key==='Enter'){event.preventDefault();exNewAddExtra();}">
              <button type="button" class="fm-btn" onclick="exNewAddExtra()">➕</button></div></div>
        </div>`);
      };
      ex.nw.draw = draw;
      draw();
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="fmClose('exNew')">${escapeHtml(fmL('Abbrechen', 'Cancel'))}</button>
        <button type="button" class="ui-btn-primary" onclick="exNewCreate()">✔ ${escapeHtml(fmL('Schicht anlegen', 'Create shift'))}</button>`);
    }
    function exNewToggle(t) { if (ex.nw.selected.has(t)) ex.nw.selected.delete(t); else ex.nw.selected.add(t); ex.nw.draw(); }
    function exNewAll(on) { const all = new Set(EX_DEFAULT_TABLES.concat(ex.nw.lastTables, ex.nw.extra)); ex.nw.selected = on ? all : new Set(); ex.nw.draw(); }
    function exNewAddExtra() {
      const el = document.getElementById('exnExtra'); if (!el) return;
      el.value.split(/[,;\s]+/).map(s => s.trim().slice(0, 12)).filter(Boolean).forEach(t => { if (ex.nw.extra.indexOf(t) === -1) ex.nw.extra.push(t); ex.nw.selected.add(t); });
      ex.nw.draw();
    }
    async function exNewCopy(on) {
      ex.nw.copy = on;
      if (on && ex.shifts[0]) {
        const { data } = await _supabase.from('exclusive_tables').select('table_no').eq('shift_id', ex.shifts[0].id).limit(300);
        ex.nw.lastTables = (data || []).map(r => String(r.table_no));
        ex.nw.selected = new Set(ex.nw.lastTables);
      } else { ex.nw.selected = new Set(EX_DEFAULT_TABLES); ex.nw.lastTables = []; }
      ex.nw.draw();
    }

    async function exNewCreate() {
      const title = String(ex.nw.title || 'Exklusiv').trim().slice(0, 80) || 'Exklusiv';
      const date = ex.nw.date || fmIso(new Date());
      const tables = exSortTables(Array.from(ex.nw.selected).map(t => ({ table_no: t }))).map(t => t.table_no);
      const base = ex.nw.copy && ex.shifts[0] ? ex.shifts[0].dishes : EX_DEFAULT_DISHES;
      const dishes = base.map(d => ({ id: ex.nw.copy ? d.id : exNewDishId(), name: d.name, type: d.type === 'note' ? 'note' : 'count' }));
      const { data, error } = await _supabase.from('exclusive_shifts').insert([{ title, shift_date: date, dishes, created_by: currentWaiterName }]).select().single();
      if (error) return exToastError(error);
      if (tables.length) {
        const { error: e2 } = await _supabase.from('exclusive_tables').insert(tables.map(t => ({ shift_id: data.id, table_no: t, updated_by: currentWaiterName })));
        if (e2) { exToastError(e2); }
      }
      fmClose('exNew');
      fmToast(fmL('Schicht angelegt', 'Shift created'));
      await exLoadShifts(data.id);
    }

    function exShiftMenu() {
      if (!ex.shift) return;
      const s = ex.shift;
      const m = fmOpen('exMenu', { title: '⋯ ' + fmL('Schicht', 'Shift'), layer: 2 });
      m.setBody(`<div class="fm-stack">
        <div class="fm-grid2">
          <div class="fm-field"><label class="form-label" for="exmTitle">${escapeHtml(fmL('Name', 'Name'))}</label><input type="text" id="exmTitle" class="ui-field" maxlength="80" value="${escapeHtml(s.title)}"></div>
          <div class="fm-field"><label class="form-label" for="exmDate">${escapeHtml(fmL('Datum', 'Date'))}</label><input type="date" id="exmDate" class="ui-field" value="${s.shift_date}"></div>
        </div>
        <button type="button" class="fm-btn" onclick="exShiftSave()">💾 ${escapeHtml(fmL('Name und Datum speichern', 'Save name and date'))}</button>
        <button type="button" class="fm-btn" onclick="exShiftToggle()">${s.status === 'closed' ? '🔓 ' + escapeHtml(fmL('Schicht wieder öffnen', 'Reopen shift')) : '🔒 ' + escapeHtml(fmL('Schicht abschließen (nur lesen)', 'Close shift (read only)'))}</button>
        <button type="button" class="fm-btn fm-btn-danger" onclick="exShiftDelete()">🗑 ${escapeHtml(fmL('Schicht löschen', 'Delete shift'))}</button></div>`);
      m.setFoot(`<button type="button" class="ui-btn-primary" onclick="fmClose('exMenu')">${escapeHtml(fmL('Fertig', 'Done'))}</button>`);
    }
    async function exShiftSave() {
      const title = document.getElementById('exmTitle').value.trim().slice(0, 80), date = document.getElementById('exmDate').value;
      if (!title || !date) return fmToast(fmL('Name und Datum werden gebraucht.', 'Name and date are required.'));
      const { error } = await _supabase.from('exclusive_shifts').update({ title, shift_date: date }).eq('id', ex.shift.id);
      if (error) return exToastError(error);
      fmClose('exMenu'); fmToast(fmL('Gespeichert', 'Saved'));
      await exLoadShifts(ex.shift.id);
    }
    async function exShiftToggle() {
      const status = ex.shift.status === 'closed' ? 'open' : 'closed';
      const { error } = await _supabase.from('exclusive_shifts').update({ status }).eq('id', ex.shift.id);
      if (error) return exToastError(error);
      fmClose('exMenu');
      await exLoadShifts(ex.shift.id);
    }
    async function exShiftDelete() {
      if (!confirm(fmL('Diese Schicht mit allen Tischen unwiderruflich löschen?', 'Permanently delete this shift with all tables?'))) return;
      const { error } = await _supabase.from('exclusive_shifts').delete().eq('id', ex.shift.id);
      if (error) return exToastError(error);
      fmClose('exMenu');
      try { localStorage.removeItem(EX_SEL_KEY); } catch (e) {}
      await exLoadShifts(null);
    }

    // ---------------------------------------------------------------
    // Drucken und Excel
    // ---------------------------------------------------------------
    function exModel(paper) {
      const s = ex.shift;
      return {
        title: s.title, dateText: exFmtDate(s.shift_date), dishes: s.dishes, rows: ex.tables, paper: paper || 'A4',
        printedText: fmL('Gedruckt am ', 'Printed on ') + new Date().toLocaleString(langLocale())
      };
    }

    function exPrintDialog() {
      if (!ex.shift) return;
      const m = fmOpen('exPrint', { title: '🖨️ ' + fmL('Drucken', 'Print'), sub: fmL('Querformat, mit Summen unten', 'Landscape, totals at the bottom'), layer: 2 });
      m.setBody(`<div class="fm-stack"><p class="fm-hint">${escapeHtml(fmL('Papierformat wählen. Danach öffnet sich der Druckdialog deines Geräts (dort auch „Als PDF speichern“ möglich).', 'Choose the paper size. Your device’s print dialog opens next (you can also save as PDF there).'))}</p>
        <button type="button" class="ui-btn-primary" style="padding:.9rem" onclick="exPrint('A4')">🖨️ A4 ${escapeHtml(fmL('quer', 'landscape'))}</button>
        <button type="button" class="ui-btn-ghost" style="padding:.8rem" onclick="exPrint('A3')">🖨️ A3 ${escapeHtml(fmL('quer', 'landscape'))}</button></div>`);
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="fmClose('exPrint')">${escapeHtml(fmL('Abbrechen', 'Cancel'))}</button>`);
    }

    function exPrint(paper) {
      fmClose('exPrint');
      const html = exPrintHtml(exModel(paper));
      const old = document.getElementById('exPrintFrame'); if (old) old.remove();
      const f = document.createElement('iframe');
      f.id = 'exPrintFrame';
      f.setAttribute('aria-hidden', 'true');
      f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
      document.body.appendChild(f);
      const doc = f.contentWindow.document;
      doc.open(); doc.write(html); doc.close();
      setTimeout(() => {
        try { f.contentWindow.focus(); f.contentWindow.print(); }
        catch (e) { fmToast(fmL('Drucken wird auf diesem Gerät nicht unterstützt.', 'Printing is not supported on this device.')); }
        setTimeout(() => { const el = document.getElementById('exPrintFrame'); if (el) el.remove(); }, 60000);
      }, 400);
    }

    function exExportXlsx() {
      if (!ex.shift) return;
      try {
        const bytes = exBuildXlsx(exModel('A4'));
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'Exklusiv_' + ex.shift.shift_date + '.xlsx';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        fmToast(fmL('Excel-Datei erstellt', 'Excel file created'));
      } catch (e) { fmToast(fmL('Excel-Export fehlgeschlagen', 'Excel export failed')); }
    }
