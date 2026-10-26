/**
 * DOM Inspector Script - Inject via DevTools console in the running Yapper app
 * to discover the sidebar/navigation structure.
 * 
 * Usage: Open Yapper desktop app → F12 → Console → paste this script
 */

(function () {
  // Find the left sidebar/rail
  const selectors = [
    'aside', 'nav', '[class*="sidebar"]', '[class*="rail"]',
    '[class*="server"]', '[class*="channel"]', '[class*="nav"]',
    '[class*="side"]', '[class*="panel"]', '[class*="left"]',
    '[class*="menu"]', '[class*="divider"]', '[class*="tab"]'
  ];

  console.log('=== DOM INSPECTOR FOR YAPIN SIDEBAR ===');

  selectors.forEach(sel => {
    const els = document.querySelectorAll(sel);
    if (els.length > 0) {
      console.group(`Selector: "${sel}" — ${els.length} match(es)`);
      els.forEach((el, i) => {
        console.log(`[${i}] tag: ${el.tagName}, class: "${el.className}", id: "${el.id}", children: ${el.children.length}, text: "${el.textContent?.slice(0, 80)}..."`);
      });
      console.groupEnd();
    }
  });

  // Find all elements with role="tablist" or role="navigation"
  const tabLists = document.querySelectorAll('[role="tablist"], [role="navigation"], [role="menu"], [role="menubar"]');
  console.group('ARIA roles (tablist/navigation/menu):');
  tabLists.forEach((el, i) => {
    console.log(`[${i}] tag: ${el.tagName}, class: "${el.className}", innerHTML (first 200): ${el.innerHTML.slice(0, 200)}`);
  });
  console.groupEnd();

  // Dump full body structure (first 2 levels deep)
  function dumpTree(el, depth = 0, maxDepth = 3) {
    if (depth > maxDepth) return '';
    const indent = '  '.repeat(depth);
    const cls = el.className ? ` class="${typeof el.className === 'string' ? el.className.slice(0, 60) : ''}"` : '';
    const id = el.id ? ` id="${el.id}"` : '';
    let result = `${indent}<${el.tagName.toLowerCase()}${id}${cls}>\n`;
    for (const child of el.children) {
      result += dumpTree(child, depth + 1, maxDepth);
    }
    return result;
  }

  console.log('=== BODY TREE (3 levels) ===');
  console.log(dumpTree(document.body, 0, 3));

  // Look specifically for Settings/pencil/gear icons
  const svgElements = document.querySelectorAll('svg');
  console.group(`Found ${svgElements.length} SVG icons`);
  svgElements.forEach((svg, i) => {
    const parent = svg.parentElement;
    const title = svg.querySelector('title')?.textContent || '';
    const ariaLabel = parent?.getAttribute('aria-label') || parent?.title || '';
    if (title || ariaLabel) {
      console.log(`[${i}] parent: ${parent?.tagName}.${parent?.className?.slice?.(0, 40)}, title: "${title}", aria: "${ariaLabel}"`);
    }
  });
  console.groupEnd();
})();

//3b52ee267fce2fb266737e4eebf1611707055a4992afb83fe920e2ea9debf186f93bc76fc41ed19802186e176b6c2589236209745877980d0effc53f95ff6251

