/* ============================================================
   js/share-doc.js  (v1.0.25)
   Gemeinsame Funktionen zum Teilen eines Dokuments, das als Bild (Canvas) gezeichnet wurde:
   Vorschau, WhatsApp / Teilen-Menü des Geräts (Bild oder PDF), als Text in WhatsApp, Bild (PNG) speichern,
   PDF speichern, Drucken. Ohne Zusatzbibliothek (das PDF wird selbst geschrieben). Genutzt von Bestellliste
   und Kühlschrank-Temperaturen.
   Aufruf: shPreview({ title, sub, canvas, base, text, landscape, shareText, onPrint })
   ============================================================ */

    let sh = { pv: null };

    function shToBlob(cv, type, q) { return new Promise(res => cv.toBlob(res, type, q)); }

    // Einseitiges A4-PDF (hoch oder quer) mit dem Bild (JPEG)
    async function shBuildPdf(cv, landscape) {
      const jpg = new Uint8Array(await (await shToBlob(cv, 'image/jpeg', 0.92)).arrayBuffer());
      const enc = new TextEncoder(), parts = [], offs = [];
      let len = 0;
      const push = b => { const u = typeof b === 'string' ? enc.encode(b) : b; parts.push(u); len += u.length; };
      const obj = (n, body) => { offs[n] = len; push(n + ' 0 obj\n'); push(body); push('\nendobj\n'); };
      const w = landscape ? '841.89' : '595.28', h = landscape ? '595.28' : '841.89';
      push('%PDF-1.4\n');
      obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
      obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
      obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + w + ' ' + h + '] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>');
      const cs = 'q ' + w + ' 0 0 ' + h + ' 0 0 cm /Im0 Do Q';
      obj(4, '<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream');
      offs[5] = len; push('5 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + cv.width + ' /Height ' + cv.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n');
      push(jpg); push('\nendstream\nendobj\n');
      const xref = len;
      let x = 'xref\n0 6\n0000000000 65535 f \n';
      for (let i = 1; i <= 5; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
      push(x + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
      const out = new Uint8Array(len); let p = 0; parts.forEach(a => { out.set(a, p); p += a.length; });
      return new Blob([out], { type: 'application/pdf' });
    }

    async function shPreview(o) {
      const m = fmOpen('shPrev', { title: '👁 ' + (o.title || fmL('Vorschau', 'Preview')), sub: o.sub || fmL('So sieht das Dokument aus. Teilen, als Bild oder PDF speichern oder drucken.', 'This is the document. Share it, save as image or PDF, or print.'), layer: 2, wide: true,
        onClose: () => { if (sh.pv) { try { URL.revokeObjectURL(sh.pv.url); } catch (e) {} sh.pv = null; } } });
      m.setBody('<p class="staff-empty">' + escapeHtml(fmL('Erstelle Vorschau ...', 'Creating preview ...')) + '</p>');
      const png = await shToBlob(o.canvas, 'image/png');
      const pdf = await shBuildPdf(o.canvas, !!o.landscape);
      sh.pv = { png, pdf, url: URL.createObjectURL(png), base: o.base || 'Dokument', text: o.text || '', landscape: !!o.landscape, shareText: o.shareText || o.title || '', onPrint: o.onPrint || null };
      m.setBody(`<div class="ol-prev-wrap"><img class="ol-prev-img" src="${sh.pv.url}" alt="${escapeHtml(o.title || '')}"></div>`);
      m.setFoot(`<div class="ol-prev-btns">
        <button type="button" class="ui-btn-primary" onclick="shShare('png')">💬 ${escapeHtml(fmL('WhatsApp / Teilen (Bild)', 'WhatsApp / Share (image)'))}</button>
        <button type="button" class="ui-btn-ghost" onclick="shShare('pdf')">📄 ${escapeHtml(fmL('Teilen als PDF', 'Share as PDF'))}</button>
        ${sh.pv.text ? `<button type="button" class="ui-btn-ghost" onclick="shWhatsText()">💬 ${escapeHtml(fmL('Als Text', 'As text'))}</button>` : ''}
        <button type="button" class="ui-btn-ghost" onclick="shSave('png')">🖼️ ${escapeHtml(fmL('Bild speichern', 'Save image'))}</button>
        <button type="button" class="ui-btn-ghost" onclick="shSave('pdf')">📄 ${escapeHtml(fmL('PDF speichern', 'Save PDF'))}</button>
        <button type="button" class="ui-btn-ghost" onclick="shPrint()">🖨️ ${escapeHtml(fmL('Drucken', 'Print'))}</button></div>`);
    }

    function shSave(kind) {
      if (!sh.pv) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(kind === 'pdf' ? sh.pv.pdf : sh.pv.png);
      a.download = sh.pv.base + (kind === 'pdf' ? '.pdf' : '.png');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      fmToast(kind === 'pdf' ? fmL('PDF gespeichert', 'PDF saved') : fmL('Bild gespeichert', 'Image saved'));
    }

    // Teilen über das Menü des Geräts (dort „WhatsApp“ wählen). Ohne Unterstützung: Datei speichern.
    async function shShare(kind) {
      if (!sh.pv) return;
      const blob = kind === 'pdf' ? sh.pv.pdf : sh.pv.png;
      const file = new File([blob], sh.pv.base + (kind === 'pdf' ? '.pdf' : '.png'), { type: blob.type });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: sh.pv.shareText, text: sh.pv.shareText });
          return;
        }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      shSave(kind);
      fmToast(fmL('Teilen von Dateien wird hier nicht unterstützt. Datei wurde gespeichert, bitte in WhatsApp anhängen.', 'Sharing files is not supported here. The file was saved, please attach it in WhatsApp.'));
    }

    function shWhatsText() {
      if (!sh.pv || !sh.pv.text) return;
      window.open('https://wa.me/?text=' + encodeURIComponent(sh.pv.text), '_blank', 'noopener');
    }

    // Drucken: eigene Druckfunktion des Aufrufers, sonst das Bild auf einer Seite
    function shPrint() {
      if (!sh.pv) return;
      if (sh.pv.onPrint) return sh.pv.onPrint();
      const old = document.getElementById('shPrintFrame'); if (old) old.remove();
      const f = document.createElement('iframe');
      f.id = 'shPrintFrame'; f.setAttribute('aria-hidden', 'true');
      f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
      document.body.appendChild(f);
      const doc = f.contentWindow.document;
      doc.open();
      doc.write('<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 ' + (sh.pv.landscape ? 'landscape' : 'portrait') + ';margin:5mm}html,body{margin:0}img{width:100%;display:block}</style></head><body><img id="i" src="' + sh.pv.url + '"></body></html>');
      doc.close();
      const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { fmToast(fmL('Drucken wird auf diesem Gerät nicht unterstützt.', 'Printing is not supported on this device.')); } setTimeout(() => { const el = document.getElementById('shPrintFrame'); if (el) el.remove(); }, 60000); };
      const img = doc.getElementById('i');
      if (img && !img.complete) img.onload = go; else setTimeout(go, 200);
    }
