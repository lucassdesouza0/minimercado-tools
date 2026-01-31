const csvInput = document.getElementById("csvFile");
const searchInput = document.getElementById("searchInput");
const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const resultSummary = document.getElementById("resultSummary");
const filteredSummary = document.getElementById("filteredSummary");
const emptyState = document.getElementById("emptyState");
const sheetControl = document.getElementById("sheetControl");
const sheetSelect = document.getElementById("sheetSelect");

let parsedRows = [];
let headers = [];
let workbook = null;

const sanitizeHeader = (header) => header.replace(/\s+/g, " ").trim();

const normalizeRows = (rawHeaders, dataRows) => {
  headers = rawHeaders.map(sanitizeHeader);
  parsedRows = dataRows.map((row) => {
    const data = headers.reduce((acc, header, index) => {
      const originalHeader = rawHeaders[index];
      acc[header] = row?.[originalHeader] ?? row?.[header] ?? "";
      return acc;
    }, {});

    return {
      data,
      values: headers.map((header) => data[header] ?? ""),
    };
  });
};

const parseCsv = (content) => {
  const rows = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!rows.length) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = rows[0].split(";").map(sanitizeHeader);
  const dataRows = rows.slice(1).map((row) => {
    const values = row.split(";").map((value) => value.trim());
    return {
      values,
      data: rawHeaders.reduce((acc, header, index) => {
        acc[header] = values[index] ?? "";
        return acc;
      }, {}),
    };
  });

  return { headers: rawHeaders, rows: dataRows };
};

const renderTable = (data) => {
  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  if (!data.length || !headers.length) {
    tableBody.appendChild(emptyState.content.cloneNode(true));
    return;
  }

  const headerRow = document.createElement("tr");
  headers.forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;
    headerRow.appendChild(th);
  });
  tableHead.appendChild(headerRow);

  data.forEach((row) => {
    const tr = document.createElement("tr");
    headers.forEach((header) => {
      const td = document.createElement("td");
      td.textContent = row.data?.[header] || row[header] || "—";
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });
};

const updateSummary = (total, filtered) => {
  resultSummary.textContent = total
    ? `${total} itens carregados`
    : "Nenhum arquivo carregado";
  filteredSummary.textContent = `${filtered} itens`;
};

const filterRows = () => {
  const query = searchInput.value.toLowerCase().trim();
  const filtered = parsedRows.filter((row) => {
    const descricao = (
      row.values?.[1] ||
      row.data?.["Descrição"] ||
      row.data?.["Descricao"] ||
      row["Descrição"] ||
      row["Descricao"] ||
      ""
    ).toLowerCase();
    return descricao.includes(query);
  });

  renderTable(filtered);
  updateSummary(parsedRows.length, filtered.length);
};

const resetSheetSelector = () => {
  sheetControl.hidden = true;
  sheetSelect.innerHTML = '<option value="">Selecione uma aba</option>';
  sheetSelect.disabled = true;
  workbook = null;
};

const loadSheet = (sheetName) => {
  if (!workbook || !sheetName) {
    return;
  }

  const worksheet = workbook.Sheets[sheetName];
  const jsonRows = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
  });
  const rawHeaders = jsonRows.length
    ? Object.keys(jsonRows[0]).map(sanitizeHeader)
    : [];

  normalizeRows(rawHeaders, jsonRows);
  searchInput.disabled = parsedRows.length === 0;
  searchInput.value = "";
  renderTable(parsedRows);
  updateSummary(parsedRows.length, parsedRows.length);
};

const handleCsvFile = (file) => {
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    const content = String(loadEvent.target.result || "");
    const parsed = parseCsv(content);
    normalizeRows(
      parsed.headers,
      parsed.rows.map((row) => row.data)
    );

    resetSheetSelector();
    searchInput.disabled = parsedRows.length === 0;
    searchInput.value = "";

    renderTable(parsedRows);
    updateSummary(parsedRows.length, parsedRows.length);
  };

  reader.readAsText(file, "utf-8");
};

const handleXlsxFile = (file) => {
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    const data = loadEvent.target.result;
    workbook = XLSX.read(data, { type: "array" });
    const sheetNames = workbook.SheetNames || [];

    sheetControl.hidden = sheetNames.length === 0;
    sheetSelect.disabled = sheetNames.length === 0;
    sheetSelect.innerHTML = '<option value="">Selecione uma aba</option>';

    sheetNames.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      sheetSelect.appendChild(option);
    });

    if (sheetNames.length) {
      sheetSelect.value = sheetNames[0];
      loadSheet(sheetNames[0]);
    } else {
      normalizeRows([], []);
      renderTable([]);
      updateSummary(0, 0);
    }
  };

  reader.readAsArrayBuffer(file);
};

csvInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const fileName = file.name.toLowerCase();
  if (fileName.endsWith(".xlsx")) {
    handleXlsxFile(file);
    return;
  }

  handleCsvFile(file);
});

sheetSelect.addEventListener("change", () => {
  loadSheet(sheetSelect.value);
});

searchInput.addEventListener("input", filterRows);

renderTable([]);
