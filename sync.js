const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Načítanie premenných z prostredia (z GitHub Secrets)
const EMAIL = process.env.GASTRONAUT_EMAIL;
const PASSWORD = process.env.GASTRONAUT_PASSWORD;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const AUTH_FILE = path.join(__dirname, 'auth.json');

async function stiahniData() {
  console.log('1. Spúšťam prehliadač v cloudovom prostredí...');
  const browser = await chromium.launch({ headless: true }); // V cloude beží bez okna
  
  let contextOptions = {};
  if (fs.existsSync(AUTH_FILE)) {
    contextOptions = { storageState: AUTH_FILE };
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    console.log('2. Otváram aplikáciu...');
    await page.goto('https://app.gastronaut.ai/', { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(3000);

    if (page.url().includes('/auth/login')) {
      console.log('> Relácia vypršala alebo neexistuje, prihlasujem sa nanovo...');
      if (fs.existsSync(AUTH_FILE)) fs.unlinkSync(AUTH_FILE);

      await page.fill('input[name="email"]', EMAIL);
      await page.fill('input[name="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(5000);

      await context.storageState({ path: AUTH_FILE });
      await page.goto('https://app.gastronaut.ai/', { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(3000);
    } else {
      console.log('> Úspešne prihlásený cez uloženú reláciu.');
    }

    console.log('3. Otváram rezervácie...');
    const rezervacieBtn = page.locator('button[aria-label="Reservierungen"]');
    await rezervacieBtn.waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(1000);
    await rezervacieBtn.click();
    await page.waitForTimeout(6000);

    async function vybalSmenuKomplet() {
      for (let i = 0; i < 4; i++) {
        await page.mouse.wheel(0, 1000);
        await page.waitForTimeout(400);
      }

      return await page.evaluate(() => {
        const statElements = Array.from(document.querySelectorAll('span.text-3.color-subdued'));
        const statistiky = statElements.map(el => el.innerText.trim()).filter(Boolean);

        const riadky = document.body.innerText
          .split('\n')
          .map(r => r.trim())
          .filter(Boolean);

        const rezervacie = [];
        const uzMame = new Set();

        for (let i = 0; i < riadky.length; i++) {
          if (riadky[i].startsWith('#') && riadky[i].length > 4) {
            const kodMeno = riadky[i];
            if (!uzMame.has(kodMeno)) {
              uzMame.add(kodMeno);
              rezervacie.push({
                cas_a_osoby: riadky[i - 1] || '',
                kod_a_meno: kodMeno,
                stol: riadky[i + 1] || ''
              });
            }
          }
        }

        return {
          suhrnne_hodnoty: statistiky,
          pocet_v_zozname: rezervacie.length,
          rezervacie: rezervacie
        };
      });
    }

    async function prepniSmenu(nazovSmeny) {
      console.log(`Prepínam smenu na: ${nazovSmeny}...`);
      const tlacidloSmeny = page.locator('button:has-text("Ganzer Tag"), button:has-text("FRÜHSCHICHT"), button:has-text("ABENDSCHICHT")').first();
      await tlacidloSmeny.click();
      await page.waitForTimeout(1500);

      await page.evaluate((hladanyText) => {
        const spans = Array.from(document.querySelectorAll('span, div'));
        const ciel = spans.find(el => el.innerText.trim() === hladanyText && el.offsetParent !== null);
        if (ciel) ciel.click();
      }, nazovSmeny);
      await page.waitForTimeout(5000);
    }

    await prepniSmenu('FRÜHSCHICHT');
    const fruhData = await vybalSmenuKomplet();

    await prepniSmenu('ABENDSCHICHT');
    const abendData = await vybalSmenuKomplet();

    const kompletnyVysledok = {
      aktualizovane: new Date().toISOString(),
      fruhschicht: fruhData,
      abendschicht: abendData
    };

    console.log('Odosielam dáta do Supabase...');
    const { error } = await supabase
      .from('gastronaut_sync') // Názov tabuľky v Supabase
      .upsert({ 
        id: 1, 
        data: kompletnyVysledok,
        updated_at: new Date()
      });

    if (error) {
      console.error('Chyba pri zápise do Supabase:', error.message);
    } else {
      console.log('HOTOVO! Dáta úspešne synchronizované so Supabase.');
    }

  } catch (chyba) {
    console.error('Nastala chyba:', chyba);
  } finally {
    await browser.close();
  }
}

stiahniData();
