const csvInput = document.getElementById("csvFile");
const searchInput = document.getElementById("searchInput");
const tableHead = null; // No longer used
const tableBody = null; // No longer used
const cardList = document.getElementById("cardList");
const resultSummary = document.getElementById("resultSummary");
const filteredSummary = document.getElementById("filteredSummary");
const emptyState = null; // No longer used
const emptyStateCards = null; // No longer used
const sheetControl = document.getElementById("sheetControl");
const sheetSelect = document.getElementById("sheetSelect");
const googleFileControl = document.getElementById("googleFileControl");
const googleFileSelect = document.getElementById("googleFileSelect");
const googleStatus = document.getElementById("googleStatus");
const todoForm = document.getElementById("todoForm");
const todoInput = document.getElementById("todoInput");
const todoList = document.getElementById("todoList");
const todoEmptyState = document.getElementById("todoEmptyState");
const todoSummary = document.getElementById("todoSummary");
const todoUndoButton = document.getElementById("todoUndo");
const todoHistoryLabel = document.getElementById("todoHistoryLabel");
const todoFilterButtons = Array.from(
  document.querySelectorAll("[data-todo-filter]")
);

let parsedRows = [];
let headers = [];
let workbook = null;
let googleAuth = null;
let googleFiles = [];
let currentGoogleSheetId = null;
let allSheetsData = {}; // Store data for all sheets
let currentSheetName = null; // Track current sheet
let todos = [];
let todoHistory = [];
let todoFilter = "all";

// ========================
// LocalStorage Management
// ========================

const STORAGE_KEY = "minimercado_spreadsheet_data";
const TODO_STORAGE_KEY = "minimercado_todo_state";

const saveToLocalStorage = () => {
  const data = {
    headers,
    rows: parsedRows,
    allSheetsData,
    currentSheetName,
    timestamp: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log("Data saved to localStorage");
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
  }
};

const loadFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      headers = data.headers || [];
      parsedRows = data.rows || [];
      allSheetsData = data.allSheetsData || {};
      currentSheetName = data.currentSheetName || null;
      console.log("Data restored from localStorage");
      return true;
    }
  } catch (error) {
    console.error("Failed to load from localStorage:", error);
  }
  return false;
};

const clearLocalStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    headers = [];
    parsedRows = [];
    allSheetsData = {};
    currentSheetName = null;
    console.log("localStorage cleared");
  } catch (error) {
    console.error("Failed to clear localStorage:", error);
  }
};

// ========================
// Todo List Management
// ========================

const TODO_STATUS = {
  PENDING: "Pending",
  DONE: "Done",
  ARCHIVED: "Archived",
};

const cloneTodos = (list) => {
  if (typeof structuredClone === "function") {
    return structuredClone(list);
  }
  return JSON.parse(JSON.stringify(list));
};

const saveTodoState = () => {
  const data = {
    todos,
    history: todoHistory,
    filter: todoFilter,
    timestamp: new Date().toISOString(),
  };
  try {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save todo state:", error);
  }
};

const loadTodoState = () => {
  try {
    const stored = localStorage.getItem(TODO_STORAGE_KEY);
    if (!stored) {
      return false;
    }
    const data = JSON.parse(stored);
    todos = data.todos || [];
    todoHistory = data.history || [];
    todoFilter = data.filter || "all";
    return true;
  } catch (error) {
    console.error("Failed to load todo state:", error);
    return false;
  }
};

const normalizeTodoText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const buildTodoId = (text, index) => {
  const base = normalizeTodoText(text).replace(/\s+/g, "-");
  const sheetScope = currentSheetName ? normalizeTodoText(currentSheetName) : "planilha";
  return `${sheetScope}-${base || "item"}-${index}`;
};

const updateUndoUI = () => {
  const lastAction = todoHistory[todoHistory.length - 1];
  todoUndoButton.disabled = !lastAction;
  todoHistoryLabel.textContent = lastAction
    ? `Última ação: ${lastAction.label}`
    : "Nenhuma ação para desfazer";
};

const updateTodoSummary = () => {
  const total = todos.length;
  const pending = todos.filter((todo) => todo.status === TODO_STATUS.PENDING).length;
  const done = todos.filter((todo) => todo.status === TODO_STATUS.DONE).length;
  const archived = todos.filter((todo) => todo.status === TODO_STATUS.ARCHIVED).length;

  todoSummary.textContent = `${total} itens | Pending: ${pending} | Done: ${done} | Archived: ${archived}`;
};

const renderTodoList = () => {
  const visibleTodos = todos.filter((todo) => {
    if (todoFilter === "all") {
      return true;
    }
    return todo.status === todoFilter;
  });

  todoList.innerHTML = "";
  todoEmptyState.hidden = visibleTodos.length > 0;

  const grouped = {
    [TODO_STATUS.PENDING]: [],
    [TODO_STATUS.DONE]: [],
    [TODO_STATUS.ARCHIVED]: [],
  };

  visibleTodos.forEach((todo) => {
    if (grouped[todo.status]) {
      grouped[todo.status].push(todo);
    }
  });

  const sections = [
    { key: TODO_STATUS.PENDING, label: "Pending" },
    { key: TODO_STATUS.DONE, label: "Done" },
    { key: TODO_STATUS.ARCHIVED, label: "Archived" },
  ];

  sections.forEach((section) => {
    const items = grouped[section.key] || [];
    if (!items.length) {
      return;
    }

    const group = document.createElement("li");
    group.className = "todo__group";
    group.innerHTML = `
      <div class="todo__group-header">
        <h3>${section.label}</h3>
        <span>${items.length} itens</span>
      </div>
      <ul class="todo__group-list"></ul>
    `;

    const list = group.querySelector(".todo__group-list");

    items.forEach((todo) => {
      const item = document.createElement("li");
      item.className = "todo__item";
      item.dataset.id = todo.id;

      const statusClass = `todo__status todo__status--${todo.status}`;
      const createdDate = new Date(todo.createdAt).toLocaleDateString("pt-BR");

      item.innerHTML = `
        <div class="todo__item-main">
          <div class="todo__item-text">${todo.text}</div>
          <div class="todo__item-meta">
            <span class="${statusClass}">${todo.status}</span>
            <span class="todo__history">Criado em ${createdDate}</span>
          </div>
        </div>
        <div class="todo__actions">
          ${todo.status === TODO_STATUS.PENDING ? '<button class="todo__action todo__action--primary" data-action="done">Done</button>' : ""}
          ${todo.status !== TODO_STATUS.PENDING ? '<button class="todo__action" data-action="pending">Pending</button>' : ""}
          ${todo.status !== TODO_STATUS.ARCHIVED ? '<button class="todo__action" data-action="archived">Archived</button>' : ""}
          <button class="todo__action" data-action="edit">Editar</button>
          <button class="todo__action todo__action--danger" data-action="delete">Excluir</button>
        </div>
      `;

      list.appendChild(item);
    });

    todoList.appendChild(group);
  });

  updateTodoSummary();
  updateUndoUI();
  saveTodoState();
};

const syncTodosWithParsedRows = () => {
  if (!parsedRows.length) {
    todos = todos.filter((todo) => todo.origin !== "sheet");
    return;
  }

  const existingSheetTodos = new Map(
    todos
      .filter((todo) => todo.origin === "sheet")
      .map((todo) => [todo.sourceId, todo])
  );

  const sheetTodos = parsedRows
    .map((row, index) =>
      getValueFromRow(row, ["Descrição", "Descricao", "DESCRICAO"]).trim()
    )
    .filter(Boolean)
    .map((description, index) => {
      const sourceId = buildTodoId(description, index);
      const existing = existingSheetTodos.get(sourceId);
      return {
        id: existing?.id || sourceId,
        sourceId,
        origin: "sheet",
        text: description,
        status: existing?.status || TODO_STATUS.PENDING,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: existing?.updatedAt || new Date().toISOString(),
      };
    });

  const manualTodos = todos.filter((todo) => todo.origin !== "sheet");
  todos = [...sheetTodos, ...manualTodos];
};

const pushTodoHistory = (label) => {
  todoHistory.push({
    label,
    todos: cloneTodos(todos),
    timestamp: new Date().toISOString(),
  });

  if (todoHistory.length > 50) {
    todoHistory.shift();
  }
};

const addTodo = (text) => {
  pushTodoHistory("Adicionar tarefa");
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  todos.unshift({
    id,
    sourceId: id,
    origin: "manual",
    text,
    status: TODO_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  renderTodoList();
};

const updateTodo = (id, updates, label) => {
  const index = todos.findIndex((todo) => todo.id === id);
  if (index === -1) {
    return;
  }
  pushTodoHistory(label);
  todos[index] = {
    ...todos[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  renderTodoList();
};

const removeTodo = (id) => {
  const index = todos.findIndex((todo) => todo.id === id);
  if (index === -1) {
    return;
  }
  pushTodoHistory("Excluir tarefa");
  todos.splice(index, 1);
  renderTodoList();
};

const undoLastTodoAction = () => {
  const previous = todoHistory.pop();
  if (!previous) {
    return;
  }
  todos = previous.todos || [];
  renderTodoList();
};

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
      return String(data[originalKey] || "");
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
    cardList.innerHTML = '<div class="card-empty">Carregue um arquivo para visualizar os itens.</div>';
    return;
  }

  data.forEach((row) => {
    const description =
      getValueFromRow(row, ["Descrição", "Descricao"]) || "—";
    const cost = 
      getValueFromRow(row, ["Custo", "CUSTO", "Custo Unitário"]) || 
      getValueFromRow(row, ["Custo da última compra", "Custo da última Compra"]) || 
      "—";
    const averageCost =
      getValueFromRow(row, [
        "CUSTO_MEDIO",
        "Custo_medio",
        "Custo Medio",
        "Custo Médio",
        "CUSTO MEDIO",
        "CUSTO_MEDIO_AJUSTADO",
      ]) ||
      "—";
    const qtdPdv =
      getValueFromRow(row, [
        "qtd pdv",
        "Qtd PDV",
        "QTD PDV",
        "QTD_PDV",
        "Qtd_PDV",
        "Quantidade PDV",
      ]) ||
      "—";
    const stock =
      getValueFromRow(row, ["Estoque", "ESTOQUE", "QUANTIDADE_ESTOQUE", "Quantidade"]) ||
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
          <span class="mobile-card__label">Custo Médio</span>
          <p class="mobile-card__value">${averageCost}</p>
        </div>
        <div>
          <span class="mobile-card__label">Qtd PDV</span>
          <p class="mobile-card__value">${qtdPdv}</p>
        </div>
        <div>
          <span class="mobile-card__label">Estoque</span>
          <p class="mobile-card__value">${stock}</p>
        </div>
      </div>
    `;

    cardList.appendChild(card);
  });
};

const renderTable = (data) => {
  if (!data.length || !headers.length) {
    renderCards([]);
    return;
  }

  renderCards(data);
};

const updateSummary = (total, filtered) => {
  resultSummary.textContent = total
    ? `${total} itens carregados`
    : "Nenhum arquivo carregado";
  filteredSummary.textContent = `${filtered} itens`;
  syncTodosWithParsedRows();
  renderTodoList();
};

const filterRows = () => {
  const query = searchInput.value.toLowerCase().trim();
  
  if (query === "") {
    // Show all rows if search is empty
    renderTable(parsedRows);
    updateSummary(parsedRows.length, parsedRows.length);
    return;
  }
  
  const filtered = parsedRows.filter((row) => {
    // Search in description field with multiple possible column names
    const descricao = getValueFromRow(row, [
      "Descrição",
      "Descricao",
      "DESCRICAO"
    ]).toLowerCase();
    
    // Also search in other key fields
    const custo = getValueFromRow(row, [
      "Custo",
      "CUSTO",
      "Custo Unitário"
    ]).toLowerCase();
    
    const estoque = getValueFromRow(row, [
      "Estoque",
      "ESTOQUE",
      "QUANTIDADE_ESTOQUE",
      "Quantidade"
    ]).toLowerCase();
    
    // Return true if query matches any of these fields
    return (
      descricao.includes(query) ||
      custo.includes(query) ||
      estoque.includes(query)
    );
  });

  renderTable(filtered);
  updateSummary(parsedRows.length, filtered.length);
};

const resetSheetSelector = () => {
  // Only hide if there are no stored sheets
  if (Object.keys(allSheetsData).length === 0) {
    sheetControl.hidden = true;
    sheetSelect.innerHTML = '<option value="">Selecione uma aba</option>';
    sheetSelect.disabled = true;
  }
  workbook = null;
};

const loadSheet = (sheetName) => {
  if (!sheetName) {
    return;
  }

  // Try to load from workbook first (if file is loaded)
  if (workbook && workbook.Sheets[sheetName]) {
    const worksheet = workbook.Sheets[sheetName];
    const jsonRows = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
    });
    const rawHeaders = jsonRows.length
      ? Object.keys(jsonRows[0]).map(sanitizeHeader)
      : [];

    normalizeRows(rawHeaders, jsonRows);
    currentSheetName = sheetName;
    saveToLocalStorage();
    searchInput.disabled = parsedRows.length === 0;
    searchInput.value = "";
    renderTable(parsedRows);
    updateSummary(parsedRows.length, parsedRows.length);
  } 
  // Otherwise load from stored data in localStorage
  else if (allSheetsData[sheetName]) {
    const sheetData = allSheetsData[sheetName];
    headers = sheetData.headers || [];
    parsedRows = sheetData.rows || [];
    currentSheetName = sheetName;
    saveToLocalStorage();
    searchInput.disabled = parsedRows.length === 0;
    searchInput.value = "";
    renderTable(parsedRows);
    updateSummary(parsedRows.length, parsedRows.length);
  }
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

    saveToLocalStorage();
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

    // Clear previous sheets data and store data for all sheets
    allSheetsData = {};
    
    sheetNames.forEach((name) => {
      const worksheet = workbook.Sheets[name];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
      });
      const rawHeaders = jsonRows.length
        ? Object.keys(jsonRows[0]).map(sanitizeHeader)
        : [];

      // Normalize the rows for this sheet
      const normalizedHeaders = rawHeaders.map(sanitizeHeader);
      const normalizedRows = jsonRows.map((row) => {
        const data = normalizedHeaders.reduce((acc, header, index) => {
          const originalHeader = rawHeaders[index];
          acc[header] = row?.[originalHeader] ?? row?.[header] ?? "";
          return acc;
        }, {});

        return {
          data,
          values: normalizedHeaders.map((header) => data[header] ?? ""),
        };
      });

      // Store this sheet's data
      allSheetsData[name] = {
        headers: normalizedHeaders,
        rows: normalizedRows,
      };
    });

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
      clearLocalStorage();
    }
  };

  reader.readAsArrayBuffer(file);
};

todoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = todoInput.value.trim();
  if (!value) {
    return;
  }
  addTodo(value);
  todoInput.value = "";
});

todoUndoButton.addEventListener("click", () => {
  undoLastTodoAction();
});

todoFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    todoFilter = button.dataset.todoFilter || "all";
    todoFilterButtons.forEach((btn) => btn.classList.remove("chip--active"));
    button.classList.add("chip--active");
    renderTodoList();
  });
});

todoList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const action = target.dataset.action;
  if (!action) {
    return;
  }
  const item = target.closest(".todo__item");
  if (!item) {
    return;
  }
  const id = item.dataset.id;
  if (!id) {
    return;
  }

  if (action === "done") {
    updateTodo(id, { status: TODO_STATUS.DONE }, "Marcar como Done");
    return;
  }

  if (action === "pending") {
    updateTodo(id, { status: TODO_STATUS.PENDING }, "Marcar como Pending");
    return;
  }

  if (action === "archived") {
    updateTodo(id, { status: TODO_STATUS.ARCHIVED }, "Marcar como Archived");
    return;
  }

  if (action === "edit") {
    const current = todos.find((todo) => todo.id === id);
    if (!current) {
      return;
    }
    const updatedText = window.prompt("Editar tarefa:", current.text);
    if (updatedText === null) {
      return;
    }
    const trimmed = updatedText.trim();
    if (!trimmed || trimmed === current.text) {
      return;
    }
    updateTodo(id, { text: trimmed }, "Editar tarefa");
    return;
  }

  if (action === "delete") {
    removeTodo(id);
  }
});

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

// Restore data from localStorage on page load
const initializeApp = () => {
  const hasTodoState = loadTodoState();
  if (hasTodoState) {
    const activeButton =
      todoFilterButtons.find((button) => button.dataset.todoFilter === todoFilter) ||
      todoFilterButtons[0];
    todoFilterButtons.forEach((button) => button.classList.remove("chip--active"));
    if (activeButton) {
      activeButton.classList.add("chip--active");
    }
  }

  const hasStoredData = loadFromLocalStorage();
  if (hasStoredData && parsedRows.length > 0) {
    searchInput.disabled = false;
    
    // Restore sheet selector if there are stored sheets
    const sheetNames = Object.keys(allSheetsData);
    if (sheetNames.length > 0) {
      sheetControl.hidden = false;
      sheetSelect.disabled = false;
      sheetSelect.innerHTML = '<option value="">Selecione uma aba</option>';
      
      sheetNames.forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        sheetSelect.appendChild(option);
      });
      
      // Set current sheet in selector
      if (currentSheetName) {
        sheetSelect.value = currentSheetName;
      }
    } else {
      resetSheetSelector();
    }
    
    renderTable(parsedRows);
    updateSummary(parsedRows.length, parsedRows.length);
  } else {
    renderTable([]);
  }

  syncTodosWithParsedRows();
  renderTodoList();

  // Initialize Google integration (kept but hidden from UI)
  // Uncomment the line below if you want to re-enable Google Sheets
  // initializeGoogleIntegration();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
