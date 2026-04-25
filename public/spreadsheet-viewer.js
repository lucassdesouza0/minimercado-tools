const fileInput = document.getElementById("spreadsheetFile");
const searchInput = document.getElementById("searchInput");
const headersContainer = document.getElementById("headersContainer");
const itemsContainer = document.getElementById("itemsContainer");
const headerHelper = document.getElementById("headerHelper");
const resultSummary = document.getElementById("resultSummary");
const headersCollapse = document.getElementById("headersCollapse");
const invertOrderToggle = document.getElementById("invertOrderToggle");

const STORAGE_KEY = "minimercado_spreadsheet_viewer_state";
const MAX_TEXT_LENGTH = 25;

let rows = [];
let headers = [];
let selectedHeaders = [];
let searchTerm = "";
let invertOrder = false;

const formatValue = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "—";
  }
  return String(value);
};

const truncateText = (value) => {
  const text = String(value || "");
  if (text.length <= MAX_TEXT_LENGTH) {
    return text;
  }
  return `${text.slice(0, MAX_TEXT_LENGTH)}...`;
};

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const saveState = () => {
  try {
    const state = {
      headers,
      rows,
      selectedHeaders,
      invertOrder,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save viewer state", error);
  }
};

const getFilteredRows = () => {
  const term = normalizeText(searchTerm).trim();
  if (!term) {
    return rows;
  }

  return rows.filter((row) => {
    const searchableHeaders = selectedHeaders.length ? selectedHeaders : headers;
    return searchableHeaders.some((header) => normalizeText(row[header]).includes(term));
  });
};

const updateSummary = (visibleCount) => {
  if (!searchTerm.trim()) {
    resultSummary.textContent = `${rows.length} itens`;
    return;
  }
  resultSummary.textContent = `${visibleCount} de ${rows.length} itens`;
};

const renderItems = () => {
  itemsContainer.innerHTML = "";

  if (!rows.length) {
    itemsContainer.innerHTML = '<div class="empty-state">Carregue uma planilha para visualizar itens.</div>';
    updateSummary(0);
    return;
  }

  if (!selectedHeaders.length) {
    itemsContainer.innerHTML =
      '<div class="empty-state">Selecione pelo menos um cabeçalho para mostrar valores.</div>';
    updateSummary(0);
    return;
  }

  const filteredRows = getFilteredRows();
  const rowsForDisplay = invertOrder ? [...filteredRows].reverse() : filteredRows;

  if (!rowsForDisplay.length) {
    itemsContainer.innerHTML =
      '<div class="empty-state">Nenhum item encontrado com o filtro informado.</div>';
    updateSummary(0);
    return;
  }

  const fragment = document.createDocumentFragment();

  rowsForDisplay.forEach((row) => {
    const card = document.createElement("article");
    card.className = "item-card";

    const grid = document.createElement("div");
    grid.className = "item-grid";

    selectedHeaders.forEach((header) => {
      const field = document.createElement("div");
      field.className = "item-field";
      field.innerHTML = `
        <span class="item-field__label">${truncateText(header)}</span>
        <span class="item-field__value">${truncateText(formatValue(row[header]))}</span>
      `;
      grid.appendChild(field);
    });

    card.appendChild(grid);
    fragment.appendChild(card);
  });

  itemsContainer.appendChild(fragment);
  updateSummary(rowsForDisplay.length);
};

const updateHeaderHelper = () => {
  if (!headers.length) {
    headerHelper.textContent = "Nenhuma planilha carregada ainda.";
    return;
  }

  headerHelper.textContent = `${headers.length} cabeçalho(s) encontrado(s). ${selectedHeaders.length} selecionado(s).`;
};

const renderHeaderSelector = () => {
  headersContainer.innerHTML = "";

  if (!headers.length) {
    updateHeaderHelper();
    return;
  }

  const fragment = document.createDocumentFragment();

  headers.forEach((header) => {
    const wrapper = document.createElement("label");
    wrapper.className = "header-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedHeaders.includes(header);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedHeaders = [...selectedHeaders, header];
      } else {
        selectedHeaders = selectedHeaders.filter((value) => value !== header);
      }
      saveState();
      updateHeaderHelper();
      renderItems();
    });

    const labelText = document.createElement("span");
    labelText.textContent = truncateText(header);

    wrapper.appendChild(checkbox);
    wrapper.appendChild(labelText);
    fragment.appendChild(wrapper);
  });

  headersContainer.appendChild(fragment);
  updateHeaderHelper();
};

const sanitizeRows = (rawHeaders, rawRows) => {
  headers = rawHeaders
    .map((header, index) => (String(header || "").trim() || `Coluna ${index + 1}`))
    .filter((header, index, list) => list.indexOf(header) === index);

  rows = rawRows.map((row) => {
    return headers.reduce((acc, header, index) => {
      acc[header] = row[index] ?? "";
      return acc;
    }, {});
  });

  selectedHeaders = headers.slice(0, Math.min(headers.length, 4));

  saveState();
  renderHeaderSelector();
  renderItems();
};

const readWorkbookFile = async (file) => {
  if (!file) {
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      throw new Error("Nenhuma aba encontrada");
    }

    const firstSheet = workbook.Sheets[firstSheetName];
    const matrix = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    if (!matrix.length) {
      headers = [];
      rows = [];
      selectedHeaders = [];
      saveState();
      renderHeaderSelector();
      renderItems();
      return;
    }

    const [headerRow, ...dataRows] = matrix;
    sanitizeRows(headerRow, dataRows);
  } catch (error) {
    console.error("Error reading spreadsheet", error);
    alert("Não foi possível ler este arquivo XLSX.");
  }
};

const setupHeaderCollapse = () => {
  if (!headersCollapse) {
    return;
  }

  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  headersCollapse.open = !isMobile;
};

const restoreState = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      if (invertOrderToggle) {
        invertOrderToggle.checked = false;
      }
      renderHeaderSelector();
      renderItems();
      return;
    }

    const parsed = JSON.parse(stored);
    headers = Array.isArray(parsed.headers) ? parsed.headers : [];
    rows = Array.isArray(parsed.rows) ? parsed.rows : [];
    invertOrder = Boolean(parsed.invertOrder);

    if (invertOrderToggle) {
      invertOrderToggle.checked = invertOrder;
    }

    const persistedSelection = Array.isArray(parsed.selectedHeaders)
      ? parsed.selectedHeaders.filter((header) => headers.includes(header))
      : [];

    selectedHeaders = persistedSelection.length ? persistedSelection : headers.slice(0, 4);

    renderHeaderSelector();
    renderItems();
  } catch (error) {
    console.error("Failed to restore state", error);
    renderHeaderSelector();
    renderItems();
  }
};

fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files || [];
  readWorkbookFile(file);
});

searchInput.addEventListener("input", (event) => {
  searchTerm = event.target.value || "";
  renderItems();
});

if (invertOrderToggle) {
  invertOrderToggle.addEventListener("change", (event) => {
    invertOrder = Boolean(event.target.checked);
    saveState();
    renderItems();
  });
}

setupHeaderCollapse();
restoreState();
