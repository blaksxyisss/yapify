/**
 * Custom Dropdown Component for Yapify
 * Provides sleek, dark-themed, glassmorphic dropdowns to replace standard browser <select>.
 */

export function createCustomDropdown({
  options = [],
  value = '',
  onChange = () => {},
  placeholder = 'Select option...',
  width = '210px'
}) {
  let currentValue = value;

  const wrapper = document.createElement('div');
  wrapper.className = 'yf-custom-dropdown';
  wrapper.style.width = width;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'yf-dropdown-trigger';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'yf-dropdown-label';

  const arrowIcon = document.createElement('div');
  arrowIcon.className = 'yf-dropdown-arrow';
  arrowIcon.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `;

  trigger.appendChild(labelSpan);
  trigger.appendChild(arrowIcon);
  wrapper.appendChild(trigger);

  const menu = document.createElement('div');
  menu.className = 'yf-dropdown-menu';
  wrapper.appendChild(menu);

  function updateTriggerLabel() {
    const selected = options.find(o => o.value === currentValue);
    labelSpan.textContent = selected ? selected.label : placeholder;
  }

  function renderItems() {
    menu.innerHTML = '';
    for (const opt of options) {
      const item = document.createElement('div');
      item.className = 'yf-dropdown-item' + (opt.value === currentValue ? ' is-selected' : '');
      item.setAttribute('data-value', opt.value);

      const text = document.createElement('span');
      text.className = 'yf-dropdown-item-text';
      text.textContent = opt.label;
      item.appendChild(text);

      const checkSvg = document.createElement('div');
      checkSvg.className = 'yf-dropdown-check';
      checkSvg.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
      item.appendChild(checkSvg);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        currentValue = opt.value;
        updateTriggerLabel();
        renderItems();
        closeMenu();
        onChange(currentValue);
      });

      menu.appendChild(item);
    }
  }

  function openMenu() {
    // Close any other open dropdowns first
    document.querySelectorAll('.yf-custom-dropdown.is-open').forEach(el => {
      if (el !== wrapper) {
        el.classList.remove('is-open');
        el.querySelector('.yf-dropdown-menu')?.classList.remove('is-open');
      }
    });

    wrapper.classList.add('is-open');
    menu.classList.add('is-open');
  }

  function closeMenu() {
    wrapper.classList.remove('is-open');
    menu.classList.remove('is-open');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (menu.classList.contains('is-open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Close on outside click
  const onDocClick = (e) => {
    if (!wrapper.contains(e.target)) {
      closeMenu();
    }
  };
  document.addEventListener('click', onDocClick);

  // Close on Escape key
  const onKeyDown = (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) {
      closeMenu();
    }
  };
  document.addEventListener('keydown', onKeyDown);

  updateTriggerLabel();
  renderItems();

  wrapper.setValue = (newVal) => {
    currentValue = newVal;
    updateTriggerLabel();
    renderItems();
  };

  wrapper.getValue = () => currentValue;

  wrapper.destroy = () => {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKeyDown);
    wrapper.remove();
  };

  return wrapper;
}
