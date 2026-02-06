const csvInput = document.getElementById("csvFile");
const searchInput = document.getElementById("searchInput");
const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const cardList = document.getElementById("cardList");
const resultSummary = document.getElementById("resultSummary");
const filteredSummary = document.getElementById("filteredSummary");
const emptyState = document.getElementById("emptyState");
const emptyStateCards = document.getElementById("emptyStateCards");
const sheetControl = document.getElementById("sheetControl");
const sheetSelect = document.getElementById("sheetSelect");
const googleFileControl = document.getElementById("googleFileControl");
const googleFileSelect = document.getElementById("googleFileSelect");
const googleStatus = document.getElementById("googleStatus");

let parsedRows = [];
let headers = [];
let workbook = null;
let googleAuth = null;
let googleFiles = [];
let currentGoogleSheetId = null;

// ========================
// Google Sheets Integration
// ========================

const initGoogle = async () => {
  // Load Google API client library
  return new Promise((resolve) => {
    gapi.load("client", async () => {
      try {
        await gapi.client.init({
          apiKey: GOOGLE_CONFIG.API_KEY,
          discoveryDocs: [
            "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
            "https://www.googleapis.com/discovery/v1/apis/sheets/v4/rest",
          ],
        });
        resolve(true);
      } catch (error) {
        console.error("Failed to initialize Google API:", error);
        resolve(false);
      }
    });
  });
};

const initGoogleAuth = () => {
  const client = google.accounts.id;
  client.initialize({
    client_id: GOOGLE_CONFIG.CLIENT_ID,
    callback: handleCredentialResponse,
    scopes: GOOGLE_CONFIG.SCOPES.join(" "),
  });

  client.renderButton(
    document.getElementById("buttonDiv"),
    {
      theme: "outline",
      size: "large",
      text: "signin",
    }
  );
};

const handleCredentialResponse = async (response) => {
  // Store the token
  const token = response.credential;

  // Use the token with Google API
  try {
    // Exchange credential for access token
    const authResult = await gapi.auth2.authorize({
      client_id: GOOGLE_CONFIG.CLIENT_ID,
      scope: GOOGLE_CONFIG.SCOPES.join(" "),
      redirect_uri: window.location.origin,
    });

    googleAuth = authResult;
    updateGoogleStatus(true, response.name || "Usuário");
    await loadGoogleFiles();
  } catch (error) {
    // Fallback: use the credential as is for some operations
    console.log("Using credential token for API calls");
    googleAuth = { credential: token };
    updateGoogleStatus(true, "Usuário");
    await loadGoogleFiles();
  }
};

const updateGoogleStatus = (isLoggedIn, userName = null) => {
  if (isLoggedIn) {
    googleStatus.textContent = `Conectado como ${userName || "Usuário"}`;
    googleStatus.style.color = "#4CAF50";
    googleFileControl.hidden = false;
  } else {
    googleStatus.textContent = "Desconectado";
    googleStatus.style.color = "#666";
    googleFileControl.hidden = true;
  }
};

const loadGoogleFiles = async () => {
  if (!GOOGLE_CONFIG.FOLDER_ID) {
    console.error("FOLDER_ID not configured in config.js");
    alert("Configure FOLDER_ID em config.js");
    return;
  }

  try {
    googleFileSelect.innerHTML = '<option value="">Carregando arquivos...</option>';
    googleFileSelect.disabled = true;

    const response = await gapi.client.drive.files.list({
      q: `'${GOOGLE_CONFIG.FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
      spaces: "drive",
      fields: "files(id, name, modifiedTime)",
      orderBy: "modifiedTime desc",
      pageSize: 50,
    });

    googleFiles = response.result.files || [];

    if (googleFiles.length === 0) {
      googleFileSelect.innerHTML =
        '<option value="">Nenhuma planilha encontrada</option>';
      googleFileSelect.disabled = true;
      return;
    }

    googleFileSelect.innerHTML = '<option value="">Selecione uma planilha...</option>';
    googleFiles.forEach((file) => {
      const option = document.createElement("option");
      option.value = file.id;
      option.textContent = file.name;
      googleFileSelect.appendChild(option);
    });

    googleFileSelect.disabled = false;
  } catch (error) {
    console.error("Error loading Google files:", error);
    googleFileSelect.innerHTML =
      '<option value="">Erro ao carregar arquivos</option>';
    googleFileSelect.disabled = true;
    alert("Erro ao carregar arquivos do Google Drive. Verifique suas credenciais.");
  }
};

const loadGoogleSheet = async (fileId, sheetName = null) => {
  if (!fileId) return;

  try {
    googleFileSelect.disabled = true;

    const response = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: fileId,
      fields: "sheets(properties(sheetId,title))",
    });

    const sheets = response.result.sheets || [];
    const targetSheet = sheetName || sheets[0]?.properties?.title;

    if (!targetSheet) {
      alert("Nenhuma aba encontrada na planilha");
      return;
    }

    currentGoogleSheetId = fileId;

    // Populate sheet selector if multiple sheets
    if (sheets.length > 1) {
      sheetControl.hidden = false;
      sheetSelect.innerHTML = '<option value="">Selecione uma aba</option>';
      sheets.forEach((sheet) => {
        const option = document.createElement("option");
        option.value = sheet.properties.title;
        option.textContent = sheet.properties.title;
        sheetSelect.appendChild(option);
      });
      sheetSelect.disabled = false;
      sheetSelect.value = targetSheet;
    } else {
      resetSheetSelector();
    }

    // Load sheet data
    await loadGoogleSheetData(fileId, targetSheet);
    googleFileSelect.disabled = false;
  } catch (error) {
    console.error("Error loading Google sheet:", error);
    alert("Erro ao carregar a planilha. Verifique as permissões.");
    googleFileSelect.disabled = false;
  }
};

const loadGoogleSheetData = async (fileId, sheetName) => {
  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range: `'${sheetName}'`,
    });

    const values = response.result.values || [];

    if (values.length === 0) {
      normalizeRows([], []);
      renderTable([]);
      updateSummary(0, 0);
      return;
    }

    const [headerRow, ...dataRows] = values;
    const rawHeaders = headerRow.map(sanitizeHeader);

    // Convert array format to object format
    const jsonRows = dataRows.map((row) => {
      return rawHeaders.reduce((acc, header, index) => {
        acc[header] = row[index] || "";
        return acc;
      }, {});
    });

    normalizeRows(rawHeaders, jsonRows);
    searchInput.disabled = parsedRows.length === 0;
    searchInput.value = "";
    renderTable(parsedRows);
    updateSummary(parsedRows.length, parsedRows.length);
  } catch (error) {
    console.error("Error loading Google sheet data:", error);
    alert("Erro ao carregar dados da planilha.");
  }
};

// Initialize Google Auth when page loads (if using Google Sign-In library v3)
const initializeGoogleIntegration = async () => {
  try {
    // Check if we can use the new Google Identity Services
    if (typeof google !== "undefined" && google.accounts) {
      initGoogleAuth();
    } else {
      console.warn("Google Identity Services not loaded");
    }

    // Initialize Google API client
    const apiReady = await initGoogle();
    if (!apiReady) {
      console.error("Google API client initialization failed");
    }
  } catch (error) {
    console.error("Error initializing Google integration:", error);
  }
};

const sanitizeHeader = (header) => header.replace(/\s+/g, " ").trim();

const normalizeKey = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_]+/g, "");

const getValueFromRow = (row, candidateKeys) => {
  const data = row?.data || {};
  const dataKeys = Object.keys(data);
  const normalizedMap = dataKeys.reduce((acc, key) => {
    acc[normalizeKey(key)] = key;
    return acc;
  }, {});

  for (const key of candidateKeys) {
    const normalizedKey = normalizeKey(key);
    const originalKey = normalizedMap[normalizedKey];
    if (originalKey) {
      return data[originalKey];
    }
  }

  return "";
};

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

const renderCards = (data) => {
  cardList.innerHTML = "";

  if (!data.length) {
    cardList.appendChild(emptyStateCards.content.cloneNode(true));
    return;
  }

  data.forEach((row) => {
    const description =
      getValueFromRow(row, ["Descrição", "Descricao"]) || "—";
    const cost = getValueFromRow(row, ["Custo"]) || getValueFromRow(row, ["Custo da última compra"]) || "—";
    const averageCost =
      getValueFromRow(row, ["CUSTO_MEDIO", "Custo Medio", "Custo Médio"]) ||
      "—";

    const card = document.createElement("article");
    card.className = "mobile-card";

    card.innerHTML = `
      <div class="mobile-card__main">
        <span class="mobile-card__label">Descrição</span>
        <p class="mobile-card__value">${description}</p>
      </div>
      <div class="mobile-card__meta">
        <div>
          <span class="mobile-card__label">Custo</span>
          <p class="mobile-card__value mobile-card__value--emphasis">${cost}</p>
        </div>
        <div>
          <span class="mobile-card__label">Custo médio</span>
          <p class="mobile-card__value">${averageCost}</p>
        </div>
      </div>
    `;

    cardList.appendChild(card);
  });
};

const renderTable = (data) => {
  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  if (!data.length || !headers.length) {
    tableBody.appendChild(emptyState.content.cloneNode(true));
    renderCards([]);
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

  renderCards(data);
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
  if (currentGoogleSheetId) {
    loadGoogleSheetData(currentGoogleSheetId, sheetSelect.value);
  } else {
    loadSheet(sheetSelect.value);
  }
});

googleFileSelect.addEventListener("change", () => {
  if (googleFileSelect.value) {
    loadGoogleSheet(googleFileSelect.value);
  }
});

searchInput.addEventListener("input", filterRows);

renderTable([]);

// Initialize Google integration when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeGoogleIntegration);
} else {
  initializeGoogleIntegration();
}
