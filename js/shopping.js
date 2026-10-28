/* ============================================================
   js/shopping.js
   Einkaufsliste / Inventur
   ============================================================ */
    function openShoppingModal() {
      closeSettingsMenu();
      document.getElementById('shoppingSeasonName').innerText = currentSeasonFilter;
      
      let activeDishes = allDishes.filter(d => (d.season || '') === currentSeasonFilter);
      let ingredientsMap = {};
      activeDishes.forEach(d => {
        if (Array.isArray(d.ingredients_json)) {
          d.ingredients_json.forEach(ing => {
            let key = ing.name.toLowerCase().trim();
            if (!ingredientsMap[key]) {
              ingredientsMap[key] = { name: ing.name, amounts: [] };
            }
            if (ing.amount) ingredientsMap[key].amounts.push(`${ing.amount} (${d.name})`);
          });
        }
      });

      let container = document.getElementById('shoppingListContainer');
      let keys = Object.keys(ingredientsMap).sort();
      if (keys.length === 0) {
        container.innerHTML = `<p class="text-slate-500 italic p-4 text-center">Keine Zutaten in dieser Saison gefunden.</p>`;
      } else {
        let tableHtml = `
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-300 dark:border-slate-700 text-amber-600 dark:text-amber-400 text-[11px] uppercase">
                  <th class="p-2.5 w-1/3">Zutat / Produkt</th>
                  <th class="p-2.5 w-2/3">Verwendung & Mengen</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 dark:divide-slate-800/60">
        `;
        keys.forEach(k => {
          let item = ingredientsMap[k];
          tableHtml += `
            <tr class="hover:bg-slate-200/50 dark:hover:bg-slate-900/60 transition">
              <td class="p-2.5 font-bold align-top">📦 ${escapeHtml(item.name)}</td>
              <td class="p-2.5 text-slate-700 dark:text-slate-300 align-top"><div class="flex flex-col gap-0.5">${item.amounts.map(a => `<span class="custom-box px-2 py-0.5 rounded border text-[11px]">${escapeHtml(a)}</span>`).join('')}</div></td>
            </tr>
          `;
        });
        tableHtml += `</tbody></table></div>`;
        container.innerHTML = tableHtml;
      }

      document.getElementById('shoppingModal').classList.remove('hidden');
      document.getElementById('shoppingModal').classList.add('flex');
    }

    function closeShoppingModal() {
      document.getElementById('shoppingModal').classList.remove('flex');
      document.getElementById('shoppingModal').classList.add('hidden');
    }

    function printShoppingList() {
      window.print();
    }

    function exportShoppingListExcel() {
      let activeDishes = allDishes.filter(d => (d.season || '') === currentSeasonFilter);
      let ingredientsMap = {};
      activeDishes.forEach(d => {
        if (Array.isArray(d.ingredients_json)) {
          d.ingredients_json.forEach(ing => {
            let key = ing.name.toLowerCase().trim();
            if (!ingredientsMap[key]) {
              ingredientsMap[key] = { name: ing.name, amounts: [] };
            }
            if (ing.amount) ingredientsMap[key].amounts.push(`${ing.amount} (${d.name})`);
          });
        }
      });

      let keys = Object.keys(ingredientsMap).sort();
      if (keys.length === 0) return alert("Keine Zutaten für den Export vorhanden.");

      let dataToExport = keys.map(k => {
        let item = ingredientsMap[k];
        return {
          Zutat: item.name,
          Verwendung_und_Mengen: item.amounts.join(', ')
        };
      });

      let worksheet = XLSX.utils.json_to_sheet(dataToExport);
      let workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Einkaufsliste");
      XLSX.writeFile(workbook, `kueche_einkaufsliste_${currentSeasonFilter}.xlsx`);
    }
