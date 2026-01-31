const csvInput = document.getElementById("csvFile");
const searchInput = document.getElementById("searchInput");
const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const resultSummary = document.getElementById("resultSummary");
const filteredSummary = document.getElementById("filteredSummary");
const emptyState = document.getElementById("emptyState");

let parsedRows = [];
let headers = [];

const sanitizeHeader = (header) => header.replace(/\s+/g, " ").trim();

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
    return rawHeaders.reduce((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
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
      td.textContent = row[header] || "—";
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
    const descricao = (row["Descrição"] || row["Descricao"] || "").toLowerCase();
    return descricao.includes(query);
  });

  renderTable(filtered);
  updateSummary(parsedRows.length, filtered.length);
};

csvInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    const content = String(loadEvent.target.result || "");
    const parsed = parseCsv(content);
    headers = parsed.headers;
    parsedRows = parsed.rows;

    searchInput.disabled = parsedRows.length === 0;
    searchInput.value = "";

    renderTable(parsedRows);
    updateSummary(parsedRows.length, parsedRows.length);
  };

  reader.readAsText(file, "utf-8");
});

searchInput.addEventListener("input", filterRows);

renderTable([]);
