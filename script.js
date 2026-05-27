(function () {
  "use strict";

  const STORAGE = {
    checkins: "sapl_checkins",
    appointments: "sapl_appointments",
    trucks: "sapl_trucks",
    drivers: "sapl_drivers",
    carriers: "sapl_carriers",
    occurrences: "sapl_occurrences",
    administrative: "sapl_administrative_cases",
    audit: "sapl_audit",
    settings: "sapl_settings",
    protocolCounters: "sapl_protocol_counters"
  };

  const DEFAULT_SETTINGS = {
    companyName: "Matriz - Pátio 01",
    theme: "corporate",
    maximumStayHours: 8,
    alertsEnabled: true,
    advancedMode: true,
    allowDeletion: true,
    requireValidCnh: true,
    requireActiveCarrier: false
  };

  const PAGE_META = {
    dashboard: ["Dashboard Operacional", "Dashboard"],
    checkin: ["Registro de Check-in", "Check-in"],
    checkout: ["Liberação de Check-out", "Check-out"],
    appointments: ["Gestão de Agendamentos", "Agendamentos"],
    entries: ["Controle de Entradas", "Entradas"],
    exits: ["Controle de Saídas", "Saídas"],
    trucks: ["Cadastro de Caminhões", "Caminhões"],
    drivers: ["Cadastro de Motoristas", "Motoristas"],
    carriers: ["Cadastro de Transportadoras", "Transportadoras"],
    occurrences: ["Gestão de Ocorrências", "Ocorrências"],
    administrative: ["Análise Administrativa", "Análise Administrativa"],
    reports: ["Central de Relatórios", "Relatórios"],
    audit: ["Auditoria do Sistema", "Auditoria"],
    settings: ["Configurações Gerais", "Configurações"]
  };

  const state = {
    checkins: [],
    appointments: [],
    trucks: [],
    drivers: [],
    carriers: [],
    occurrences: [],
    administrative: [],
    audit: [],
    settings: Object.assign({}, DEFAULT_SETTINGS),
    selectedCheckoutId: "",
    latestReceiptId: "",
    reportColumns: [],
    reportRows: []
  };

  const $ = (selector, context) => (context || document).querySelector(selector);
  const $$ = (selector, context) => Array.from((context || document).querySelectorAll(selector));

  function readStorage(key, fallback) {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function persist(collection) {
    writeStorage(STORAGE[collection], state[collection]);
  }

  function id(prefix) {
    return prefix + "-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function todayISO() {
    const now = new Date();
    return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
  }

  function timeNow() {
    const now = new Date();
    return pad(now.getHours()) + ":" + pad(now.getMinutes());
  }

  function datetimeNowInput() {
    return todayISO() + "T" + timeNow();
  }

  function dateFromOffset(offset) {
    const value = new Date();
    value.setDate(value.getDate() + offset);
    return value.getFullYear() + "-" + pad(value.getMonth() + 1) + "-" + pad(value.getDate());
  }

  function formatDate(value) {
    if (!value) {
      return "-";
    }
    const parts = String(value).slice(0, 10).split("-");
    if (parts.length !== 3) {
      return value;
    }
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  function formatDateTime(date, time) {
    if (!date) {
      return "-";
    }
    return formatDate(date) + (time ? " " + time : "");
  }

  function formatDatetimeLocal(value) {
    if (!value) {
      return "-";
    }
    const parts = value.split("T");
    return formatDateTime(parts[0], parts[1] ? parts[1].slice(0, 5) : "");
  }

  function toMoment(date, time) {
    return new Date(date + "T" + (time || "00:00") + ":00");
  }

  function durationMinutes(startDate, startTime, endDate, endTime) {
    const start = toMoment(startDate, startTime);
    const end = toMoment(endDate, endTime);
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }

  function durationLabel(minutes) {
    if (minutes == null || Number.isNaN(Number(minutes))) {
      return "-";
    }
    const safeMinutes = Math.max(0, Number(minutes));
    const hours = Math.floor(safeMinutes / 60);
    const remainder = safeMinutes % 60;
    return hours ? hours + "h " + pad(remainder) + "min" : remainder + "min";
  }

  function truncate(value, limit) {
    const text = String(value || "-");
    return text.length > limit ? text.slice(0, limit - 3) + "..." : text;
  }

  function values(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function fillForm(form, data) {
    Object.keys(data).forEach(function (key) {
      const field = form.elements[key];
      if (!field) {
        return;
      }
      if (field.type === "checkbox") {
        field.checked = Boolean(data[key]);
      } else {
        field.value = data[key] == null ? "" : data[key];
      }
    });
  }

  function sortByDateTime(records, dateKey, timeKey) {
    return records.slice().sort(function (a, b) {
      const one = String(a[dateKey] || "") + String(a[timeKey] || "");
      const two = String(b[dateKey] || "") + String(b[timeKey] || "");
      return two.localeCompare(one);
    });
  }

  function statusBadge(status) {
    const key = normalize(status);
    let cssClass = "status-pending";
    if (key.includes("dentro") || key === "ativa" || key === "ativo" || key === "liberado" || key === "confirmado") {
      cssClass = "status-inside";
    } else if (key.includes("check-out") || key.includes("realizado") || key === "resolvida" || key === "resolvido") {
      cssClass = "status-completed";
    } else if (key.includes("bloquead") || key === "critica" || key === "crítica" || key === "alta") {
      cssClass = "status-critical";
    } else if (key === "aberta") {
      cssClass = "status-open";
    } else if (key.includes("suspens") || key === "media" || key === "média" || key === "urgente") {
      cssClass = "status-warning";
    } else if (key.includes("analise") || key.includes("encaminhado")) {
      cssClass = "status-analysis";
    }
    return '<span class="badge ' + cssClass + '">' + escapeHtml(status || "-") + "</span>";
  }

  function emptyRow(columns, message) {
    return '<tr class="empty-row"><td colspan="' + columns + '">' + escapeHtml(message) + "</td></tr>";
  }

  function tableActions(entity, recordId, actions) {
    const icons = {
      view: ["fa-eye", "Visualizar", ""],
      edit: ["fa-pen", "Editar", ""],
      delete: ["fa-trash", "Excluir", "danger"],
      checkout: ["fa-arrow-right-from-bracket", "Fazer check-out", "success"],
      select: ["fa-check", "Selecionar", "success"],
      arrive: ["fa-right-to-bracket", "Iniciar check-in", "success"],
      resolve: ["fa-circle-check", "Marcar resolvida", "success"]
    };
    const buttons = actions.map(function (action) {
      const detail = icons[action];
      return '<button class="action-button ' + detail[2] + '" type="button" data-entity="' + entity +
        '" data-action="' + action + '" data-id="' + escapeHtml(recordId) + '" title="' + detail[1] +
        '"><i class="fa-solid ' + detail[0] + '"></i></button>';
    }).join("");
    return '<div class="table-actions">' + buttons + "</div>";
  }

  function toast(title, message, type) {
    const container = $("#toastContainer");
    const item = document.createElement("div");
    const icon = type === "error" ? "fa-circle-exclamation" : type === "warning" ? "fa-triangle-exclamation" : "fa-circle-check";
    item.className = "toast " + (type || "success");
    item.innerHTML = '<i class="fa-solid ' + icon + '"></i><div><strong>' + escapeHtml(title) +
      "</strong><p>" + escapeHtml(message) + "</p></div>";
    container.appendChild(item);
    window.setTimeout(function () {
      item.remove();
    }, 4300);
  }

  function shortRecord(record) {
    if (!record) {
      return "-";
    }
    return truncate(record.protocol || record.plate || record.name || record.employee || record.type || record.id, 38);
  }

  function addAudit(action, screen, record, previous, next) {
    const entry = {
      id: id("AUD"),
      user: "Usuário Portaria",
      action: action,
      screen: screen,
      date: todayISO(),
      time: timeNow(),
      record: shortRecord(record),
      oldValue: truncate(previous || "-", 70),
      newValue: truncate(next || "-", 70)
    };
    state.audit.unshift(entry);
    state.audit = state.audit.slice(0, 500);
    persist("audit");
    renderAudit();
  }

  function describe(record) {
    if (!record) {
      return "-";
    }
    return [
      record.protocol,
      record.truckPlate || record.plate,
      record.driverName || record.driver || record.name,
      record.status
    ].filter(Boolean).join(" | ");
  }

  function loadState() {
    state.checkins = readStorage(STORAGE.checkins, []);
    state.appointments = readStorage(STORAGE.appointments, []);
    state.trucks = readStorage(STORAGE.trucks, []);
    state.drivers = readStorage(STORAGE.drivers, []);
    state.carriers = readStorage(STORAGE.carriers, []);
    state.occurrences = readStorage(STORAGE.occurrences, []);
    state.administrative = readStorage(STORAGE.administrative, []);
    state.audit = readStorage(STORAGE.audit, []);
    state.settings = Object.assign({}, DEFAULT_SETTINGS, readStorage(STORAGE.settings, {}));

    if (!state.audit.length) {
      state.audit.push({
        id: id("AUD"),
        user: "Sistema",
        action: "Inicialização",
        screen: "Sistema",
        date: todayISO(),
        time: timeNow(),
        record: "Armazenamento local",
        oldValue: "-",
        newValue: "Ambiente pronto para operação"
      });
      persist("audit");
    }
    writeStorage(STORAGE.settings, state.settings);
  }

  function nextProtocol(date) {
    const counters = readStorage(STORAGE.protocolCounters, {});
    counters[date] = (counters[date] || 0) + 1;
    writeStorage(STORAGE.protocolCounters, counters);
    return "SAPL-" + date.replace(/-/g, "") + "-" + String(counters[date]).padStart(4, "0");
  }

  function setInitialFormValues() {
    const checkinForm = $("#checkinForm");
    if (!checkinForm.elements.id.value) {
      checkinForm.elements.entryDate.value = todayISO();
      checkinForm.elements.entryTime.value = timeNow();
    }
    if (!$("#appointmentForm").elements.id.value) {
      $("#appointmentForm").elements.scheduledDate.value = todayISO();
      $("#appointmentForm").elements.scheduledTime.value = timeNow();
    }
    if (!$("#occurrenceForm").elements.id.value) {
      $("#occurrenceForm").elements.occurredAt.value = datetimeNowInput();
    }
  }

  function applySettings() {
    document.body.classList.remove("theme-dark", "theme-contrast");
    if (state.settings.theme === "dark") {
      document.body.classList.add("theme-dark");
    }
    if (state.settings.theme === "contrast") {
      document.body.classList.add("theme-contrast");
    }
    $(".unit-badge strong").textContent = state.settings.companyName;
    $$('[data-page="administrative"], [data-page="audit"]').forEach(function (button) {
      button.classList.toggle("restricted", !state.settings.advancedMode);
      button.title = state.settings.advancedMode ? "" : "Habilite o modo avançado nas configurações";
    });
  }

  function showPage(page) {
    if (!PAGE_META[page]) {
      page = "dashboard";
    }
    if (!state.settings.advancedMode && (page === "administrative" || page === "audit")) {
      toast("Modo avançado desativado", "Ative o módulo nas configurações para acessar esta tela.", "warning");
      page = "settings";
    }
    $$(".page").forEach(function (section) {
      section.classList.toggle("active", section.id === "page-" + page);
    });
    $$(".nav-item").forEach(function (item) {
      item.classList.toggle("active", item.dataset.page === page);
    });
    $("#pageTitle").textContent = PAGE_META[page][0];
    $("#breadcrumbPage").textContent = PAGE_META[page][1];
    if (page === "checkout") {
      renderCheckoutResults();
    }
    if (page === "reports" && !state.reportColumns.length) {
      generateReport();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindNavigation() {
    $$(".nav-item").forEach(function (button) {
      button.addEventListener("click", function () {
        showPage(button.dataset.page);
      });
    });
    $$("[data-go-page]").forEach(function (button) {
      button.addEventListener("click", function () {
        showPage(button.dataset.goPage);
      });
    });
  }

  function renderDataLists() {
    $("#carriersDataList").innerHTML = state.carriers.map(function (carrier) {
      return '<option value="' + escapeHtml(carrier.name) + '"></option>';
    }).join("");
    $("#driversDataList").innerHTML = state.drivers.map(function (driver) {
      return '<option value="' + escapeHtml(driver.name) + '"></option>';
    }).join("");
    $("#trucksDataList").innerHTML = state.trucks.map(function (truck) {
      return '<option value="' + escapeHtml(truck.model + " - " + truck.plate) + '"></option>';
    }).join("");
  }

  function validateCheckin(data) {
    if (state.settings.requireValidCnh && data.cnhExpiry < todayISO()) {
      toast("CNH inválida", "A habilitação informada está vencida e a política bloqueia a entrada.", "error");
      return false;
    }
    const registeredDriver = state.drivers.find(function (driver) {
      return normalize(driver.cpf) === normalize(data.driverCpf) || normalize(driver.name) === normalize(data.driverName);
    });
    if (registeredDriver && normalize(registeredDriver.status) === "bloqueado") {
      toast("Motorista bloqueado", "O motorista possui restrição ativa no cadastro.", "error");
      return false;
    }
    if (state.settings.requireActiveCarrier) {
      const carrier = state.carriers.find(function (item) {
        return normalize(item.name) === normalize(data.carrierName);
      });
      if (!carrier || normalize(carrier.status) !== "ativa") {
        toast("Transportadora não liberada", "Cadastre e libere a transportadora antes do check-in.", "error");
        return false;
      }
    }
    return true;
  }

  function submitCheckin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = values(form);
    if (!validateCheckin(data)) {
      return;
    }
    const existingIndex = state.checkins.findIndex(function (record) {
      return record.id === data.id;
    });
    const existing = existingIndex >= 0 ? state.checkins[existingIndex] : null;
    const protocol = data.protocol || nextProtocol(data.entryDate);
    const record = Object.assign({}, existing || {}, data, {
      id: data.id || id("CHK"),
      protocol: protocol,
      truckPlate: data.truckPlate.toUpperCase(),
      trailerPlate: data.trailerPlate.toUpperCase(),
      status: existing ? existing.status : "Dentro da empresa",
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    if (record.checkout) {
      const adjustedMinutes = durationMinutes(record.entryDate, record.entryTime, record.checkout.date, record.checkout.time);
      if (adjustedMinutes < 0) {
        toast("Horário inconsistente", "A entrada editada não pode ocorrer após a saída já registrada.", "error");
        return;
      }
      record.checkout.durationMinutes = adjustedMinutes;
    }
    if (existing) {
      state.checkins[existingIndex] = record;
      addAudit("Edição de check-in", "Check-in", record, describe(existing), describe(record));
    } else {
      state.checkins.unshift(record);
      addAudit("Novo check-in", "Check-in", record, "-", describe(record));
    }
    persist("checkins");
    state.latestReceiptId = record.id;
    form.reset();
    $("#protocolPreview").textContent = "Gerado ao salvar";
    setInitialFormValues();
    renderAll();
    toast("Check-in salvo", "Protocolo " + record.protocol + " registrado com sucesso.");
  }

  function renderCheckins() {
    const query = normalize($("#checkinQuickFilter").value);
    const rows = sortByDateTime(state.checkins, "entryDate", "entryTime").filter(function (record) {
      return !query || normalize([
        record.protocol,
        record.truckPlate,
        record.carrierName,
        record.driverName,
        record.destinationSector,
        record.status
      ].join(" ")).includes(query);
    });
    $("#checkinTableBody").innerHTML = rows.length ? rows.slice(0, 20).map(function (record) {
      const actions = record.status === "Dentro da empresa" ? ["view", "edit", "delete", "checkout"] : ["view", "edit", "delete"];
      return "<tr><td><strong>" + escapeHtml(record.protocol) + "</strong></td><td>" +
        formatDateTime(record.entryDate, record.entryTime) + "</td><td>" + escapeHtml(record.truckPlate) +
        "</td><td>" + escapeHtml(record.carrierName) + "</td><td>" + escapeHtml(record.driverName) +
        "</td><td>" + escapeHtml(record.destinationSector) + "</td><td>" + statusBadge(record.status) +
        "</td><td>" + tableActions("checkin", record.id, actions) + "</td></tr>";
    }).join("") : emptyRow(8, "Nenhum check-in registrado.");
  }

  function detailEntry(label, value, full) {
    return '<div class="detail-entry ' + (full ? "full" : "") + '"><small>' + escapeHtml(label) +
      "</small><strong>" + escapeHtml(value || "-") + "</strong></div>";
  }

  function openModal(title, content) {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = content;
    $("#recordModal").classList.add("visible");
    $("#recordModal").setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    $("#recordModal").classList.remove("visible");
    $("#recordModal").setAttribute("aria-hidden", "true");
  }

  function viewCheckin(record, receipt) {
    if (!record) {
      return;
    }
    const heading = receipt
      ? '<div class="receipt-title"><h3>Comprovante de Check-in</h3><p>Sistema Avançado de Controle de Portaria Logística</p></div>'
      : "";
    const checkout = record.checkout || {};
    const content = heading + '<div class="detail-grid">' +
      detailEntry("Protocolo", record.protocol) +
      detailEntry("Status", record.status) +
      detailEntry("Entrada", formatDateTime(record.entryDate, record.entryTime)) +
      detailEntry("Transportadora", record.carrierName) +
      detailEntry("Motorista", record.driverName) +
      detailEntry("CPF / CNH", record.driverCpf + " / " + record.driverCnh) +
      detailEntry("Validade CNH", formatDate(record.cnhExpiry)) +
      detailEntry("Caminhão / carreta", record.truckPlate + " / " + record.trailerPlate) +
      detailEntry("Modelo", record.truckModel) +
      detailEntry("Carga / peso", record.cargoType + " / " + record.approxWeight + " kg") +
      detailEntry("Destino", record.destinationSector) +
      detailEntry("Responsável interno", record.internalResponsible) +
      detailEntry("Motivo", record.entryReason, true) +
      detailEntry("Observações", record.entryNotes, true) +
      (record.checkout ? detailEntry("Saída", formatDateTime(checkout.date, checkout.time)) +
        detailEntry("Permanência", durationLabel(checkout.durationMinutes)) +
        detailEntry("Conferente", checkout.responsible) : "") +
      "</div>";
    openModal(receipt ? "Comprovante " + record.protocol : "Detalhes " + record.protocol, content);
  }

  function editCheckin(record) {
    if (!record) {
      return;
    }
    fillForm($("#checkinForm"), record);
    $("#protocolPreview").textContent = record.protocol;
    showPage("checkin");
    toast("Edição habilitada", "Atualize os dados e salve o protocolo " + record.protocol + ".");
  }

  function removeRecord(collection, record, screen, label) {
    if (!state.settings.allowDeletion) {
      toast("Exclusão bloqueada", "A permissão de exclusão está desativada nas configurações.", "warning");
      return false;
    }
    if (!window.confirm("Deseja realmente excluir " + label + "?")) {
      return false;
    }
    state[collection] = state[collection].filter(function (item) {
      return item.id !== record.id;
    });
    if (collection === "checkins" && state.selectedCheckoutId === record.id) {
      clearCheckoutSelection();
    }
    persist(collection);
    addAudit("Exclusão", screen, record, describe(record), "Registro excluído");
    toast("Registro excluído", label + " foi removido.");
    renderAll();
    return true;
  }

  function selectCheckout(record) {
    if (!record || record.status !== "Dentro da empresa") {
      toast("Check-out indisponível", "Este registro já foi liberado.", "warning");
      return;
    }
    state.selectedCheckoutId = record.id;
    $("#checkoutEmptyDetail").classList.add("hidden");
    $("#checkoutSelectedDetail").classList.remove("hidden");
    $("#checkoutSelectedProtocol").textContent = record.protocol;
    $("#checkoutSelectedSummary").textContent = record.truckPlate + " | " + record.driverName;
    $("#checkoutRecordSummary").innerHTML =
      '<div class="summary-item"><small>Entrada</small><strong>' + formatDateTime(record.entryDate, record.entryTime) + "</strong></div>" +
      '<div class="summary-item"><small>Transportadora</small><strong>' + escapeHtml(record.carrierName) + "</strong></div>" +
      '<div class="summary-item"><small>Destino</small><strong>' + escapeHtml(record.destinationSector) + "</strong></div>" +
      '<div class="summary-item"><small>Carga</small><strong>' + escapeHtml(record.cargoType) + "</strong></div>" +
      '<div class="summary-item"><small>Carreta</small><strong>' + escapeHtml(record.trailerPlate) + "</strong></div>" +
      '<div class="summary-item"><small>Responsável</small><strong>' + escapeHtml(record.internalResponsible) + "</strong></div>";
    const form = $("#checkoutForm");
    form.reset();
    form.elements.recordId.value = record.id;
    form.elements.exitTime.value = timeNow();
    showPage("checkout");
  }

  function clearCheckoutSelection() {
    state.selectedCheckoutId = "";
    $("#checkoutEmptyDetail").classList.remove("hidden");
    $("#checkoutSelectedDetail").classList.add("hidden");
    $("#checkoutForm").reset();
  }

  function checkoutMatches(record, filters) {
    return (!filters.protocol || normalize(record.protocol).includes(normalize(filters.protocol))) &&
      (!filters.plate || normalize(record.truckPlate).includes(normalize(filters.plate))) &&
      (!filters.driver || normalize(record.driverName).includes(normalize(filters.driver)));
  }

  function renderCheckoutResults() {
    const filters = values($("#checkoutSearchForm"));
    const rows = sortByDateTime(state.checkins, "entryDate", "entryTime").filter(function (record) {
      return record.status === "Dentro da empresa" && checkoutMatches(record, filters);
    });
    $("#checkoutSearchBody").innerHTML = rows.length ? rows.map(function (record) {
      return "<tr><td>" + escapeHtml(record.protocol) + "</td><td>" + escapeHtml(record.truckPlate) +
        "</td><td>" + escapeHtml(record.driverName) + "</td><td>" + statusBadge(record.status) +
        "</td><td>" + tableActions("checkin", record.id, ["select"]) + "</td></tr>";
    }).join("") : emptyRow(5, "Nenhum veículo aguardando check-out para os critérios informados.");
  }

  function submitCheckout(event) {
    event.preventDefault();
    const data = values(event.currentTarget);
    const index = state.checkins.findIndex(function (record) {
      return record.id === data.recordId;
    });
    if (index < 0 || state.checkins[index].status !== "Dentro da empresa") {
      toast("Registro não encontrado", "Atualize a busca e selecione um veículo em pátio.", "error");
      return;
    }
    const record = state.checkins[index];
    const exitDate = todayISO();
    const minutes = durationMinutes(record.entryDate, record.entryTime, exitDate, data.exitTime);
    if (minutes < 0) {
      toast("Horário inconsistente", "A saída não pode ocorrer antes do horário de entrada.", "error");
      return;
    }
    const previous = describe(record);
    record.status = "Check-out realizado";
    record.checkout = {
      date: exitDate,
      time: data.exitTime,
      responsible: data.exitResponsible,
      finalNotes: data.finalNotes,
      situation: data.exitSituation,
      releaseConfirmed: true,
      durationMinutes: minutes
    };
    record.updatedAt = new Date().toISOString();
    state.checkins[index] = record;
    persist("checkins");
    addAudit("Finalização de check-out", "Check-out", record, previous, describe(record) + " | " + durationLabel(minutes));
    clearCheckoutSelection();
    renderAll();
    toast("Check-out finalizado", record.protocol + " permaneceu " + durationLabel(minutes) + " na empresa.");
  }

  function checkinFilter(record, filters, dateKey) {
    const targetDate = dateKey === "exit" && record.checkout ? record.checkout.date : record.entryDate;
    return (!filters.startDate || targetDate >= filters.startDate) &&
      (!filters.endDate || targetDate <= filters.endDate) &&
      (!filters.carrier || normalize(record.carrierName).includes(normalize(filters.carrier))) &&
      (!filters.driver || normalize(record.driverName).includes(normalize(filters.driver))) &&
      (!filters.plate || normalize(record.truckPlate).includes(normalize(filters.plate))) &&
      (!filters.status || record.status === filters.status);
  }

  function renderEntries() {
    const filters = values($("#entriesFilters"));
    const records = sortByDateTime(state.checkins, "entryDate", "entryTime").filter(function (record) {
      return checkinFilter(record, filters, "entry");
    });
    $("#entriesCount").textContent = records.length + " registro" + (records.length === 1 ? "" : "s");
    $("#entriesTableBody").innerHTML = records.length ? records.map(function (record) {
      const actions = record.status === "Dentro da empresa" ? ["view", "checkout"] : ["view"];
      return "<tr><td>" + escapeHtml(record.protocol) + "</td><td>" + formatDateTime(record.entryDate, record.entryTime) +
        "</td><td>" + escapeHtml(record.truckPlate) + "</td><td>" + escapeHtml(record.carrierName) +
        "</td><td>" + escapeHtml(record.driverName) + "</td><td>" + escapeHtml(record.destinationSector) +
        "</td><td>" + statusBadge(record.status) + "</td><td>" + tableActions("checkin", record.id, actions) + "</td></tr>";
    }).join("") : emptyRow(8, "Nenhuma entrada encontrada.");
  }

  function renderExits() {
    const filters = values($("#exitsFilters"));
    const records = state.checkins.filter(function (record) {
      return record.checkout && checkinFilter(record, filters, "exit");
    }).sort(function (a, b) {
      return (b.checkout.date + b.checkout.time).localeCompare(a.checkout.date + a.checkout.time);
    });
    $("#exitsCount").textContent = records.length + " registro" + (records.length === 1 ? "" : "s");
    $("#exitsTableBody").innerHTML = records.length ? records.map(function (record) {
      return "<tr><td>" + escapeHtml(record.protocol) + "</td><td>" + escapeHtml(record.truckPlate) +
        "</td><td>" + formatDateTime(record.entryDate, record.entryTime) + "</td><td>" +
        formatDateTime(record.checkout.date, record.checkout.time) + "</td><td><strong>" +
        durationLabel(record.checkout.durationMinutes) + "</strong></td><td>" + escapeHtml(record.checkout.responsible) +
        "</td><td>" + escapeHtml(record.checkout.situation) + "</td><td>" +
        tableActions("checkin", record.id, ["view"]) + "</td></tr>";
    }).join("") : emptyRow(8, "Nenhum check-out realizado.");
  }

  function submitAppointment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = values(form);
    const index = state.appointments.findIndex(function (record) {
      return record.id === data.id;
    });
    const previous = index >= 0 ? state.appointments[index] : null;
    const record = Object.assign({}, previous || {}, data, {
      id: data.id || id("AGE"),
      plate: data.plate.toUpperCase(),
      status: previous ? previous.status : "Pendente",
      updatedAt: new Date().toISOString()
    });
    if (previous) {
      state.appointments[index] = record;
      addAudit("Edição de agendamento", "Agendamentos", record, describe(previous), describe(record));
    } else {
      state.appointments.unshift(record);
      addAudit("Novo agendamento", "Agendamentos", record, "-", describe(record));
    }
    persist("appointments");
    form.reset();
    setInitialFormValues();
    renderAll();
    toast("Agendamento salvo", "Chegada prevista para " + formatDateTime(record.scheduledDate, record.scheduledTime) + ".");
  }

  function renderAppointments() {
    const records = sortByDateTime(state.appointments, "scheduledDate", "scheduledTime");
    $("#appointmentsTableBody").innerHTML = records.length ? records.map(function (record) {
      return "<tr><td>" + formatDate(record.scheduledDate) + "</td><td>" + escapeHtml(record.scheduledTime) +
        "</td><td>" + escapeHtml(record.carrier) + "</td><td>" + escapeHtml(record.driver) +
        "</td><td>" + escapeHtml(record.plate) + "</td><td>" + statusBadge(record.priority) +
        "</td><td>" + statusBadge(record.status) + "</td><td>" +
        tableActions("appointment", record.id, ["arrive", "edit", "delete"]) + "</td></tr>";
    }).join("") : emptyRow(8, "Nenhum agendamento cadastrado.");
  }

  function beginAppointmentCheckin(record) {
    if (!record) {
      return;
    }
    const checkinForm = $("#checkinForm");
    checkinForm.reset();
    fillForm(checkinForm, {
      entryDate: todayISO(),
      entryTime: timeNow(),
      carrierName: record.carrier,
      driverName: record.driver,
      truckPlate: record.plate,
      cargoType: record.cargo,
      destinationSector: record.sector,
      entryReason: "Entrada vinculada ao agendamento"
    });
    $("#protocolPreview").textContent = "Gerado ao salvar";
    const previous = record.status;
    record.status = "Chegada iniciada";
    persist("appointments");
    addAudit("Conversão para check-in", "Agendamentos", record, previous, record.status);
    renderAll();
    showPage("checkin");
    toast("Agendamento localizado", "Complete os documentos do motorista para confirmar o check-in.");
  }

  function upsertCatalog(collection, form, screen, label, duplicateKey) {
    const data = values(form);
    const index = state[collection].findIndex(function (record) {
      return record.id === data.id;
    });
    if (duplicateKey) {
      const duplicate = state[collection].some(function (record) {
        return record.id !== data.id && normalize(record[duplicateKey]) === normalize(data[duplicateKey]);
      });
      if (duplicate) {
        toast("Cadastro duplicado", label + " já possui " + duplicateKey + " informado.", "error");
        return;
      }
    }
    if (data.plate) {
      data.plate = data.plate.toUpperCase();
    }
    if (data.trailerPlate) {
      data.trailerPlate = data.trailerPlate.toUpperCase();
    }
    const previous = index >= 0 ? state[collection][index] : null;
    const record = Object.assign({}, previous || {}, data, {
      id: data.id || id(collection.slice(0, 3).toUpperCase()),
      updatedAt: new Date().toISOString()
    });
    if (previous) {
      state[collection][index] = record;
      addAudit("Edição", screen, record, describe(previous), describe(record));
    } else {
      state[collection].unshift(record);
      addAudit("Cadastro", screen, record, "-", describe(record));
    }
    persist(collection);
    form.reset();
    renderAll();
    toast(label + " salvo", "O cadastro foi atualizado com sucesso.");
  }

  function renderTrucks() {
    $("#trucksTableBody").innerHTML = state.trucks.length ? state.trucks.map(function (record) {
      return "<tr><td><strong>" + escapeHtml(record.plate) + "</strong></td><td>" + escapeHtml(record.trailerPlate) +
        "</td><td>" + escapeHtml(record.model + " / " + record.brand) + "</td><td>" + escapeHtml(record.year) +
        "</td><td>" + escapeHtml(record.type) + "</td><td>" + escapeHtml(record.capacity) + " kg</td><td>" +
        statusBadge(record.status) + "</td><td>" + tableActions("truck", record.id, ["edit", "delete"]) + "</td></tr>";
    }).join("") : emptyRow(8, "Nenhum caminhão cadastrado.");
  }

  function renderDrivers() {
    $("#driversTableBody").innerHTML = state.drivers.length ? state.drivers.map(function (record) {
      return "<tr><td><strong>" + escapeHtml(record.name) + "</strong></td><td>" + escapeHtml(record.cpf) +
        "</td><td>" + escapeHtml(record.cnh + " / " + record.category) + "</td><td>" + formatDate(record.expiry) +
        "</td><td>" + escapeHtml(record.carrier) + "</td><td>" + escapeHtml(record.phone) + "</td><td>" +
        statusBadge(record.status) + "</td><td>" + tableActions("driver", record.id, ["edit", "delete"]) + "</td></tr>";
    }).join("") : emptyRow(8, "Nenhum motorista cadastrado.");
  }

  function renderCarriers() {
    $("#carriersTableBody").innerHTML = state.carriers.length ? state.carriers.map(function (record) {
      return "<tr><td><strong>" + escapeHtml(record.name) + "</strong></td><td>" + escapeHtml(record.cnpj) +
        "</td><td>" + escapeHtml(record.phone) + "<br>" + escapeHtml(record.email) + "</td><td>" +
        escapeHtml(record.responsible) + "</td><td>" + statusBadge(record.status) + "</td><td>" +
        tableActions("carrier", record.id, ["edit", "delete"]) + "</td></tr>";
    }).join("") : emptyRow(6, "Nenhuma transportadora cadastrada.");
  }

  function submitOccurrence(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = values(form);
    const index = state.occurrences.findIndex(function (record) {
      return record.id === data.id;
    });
    const previous = index >= 0 ? state.occurrences[index] : null;
    const record = Object.assign({}, previous || {}, data, {
      id: data.id || id("OCO"),
      updatedAt: new Date().toISOString()
    });
    if (previous) {
      state.occurrences[index] = record;
      addAudit("Edição de ocorrência", "Ocorrências", record, describe(previous), describe(record));
    } else {
      state.occurrences.unshift(record);
      addAudit("Registro de ocorrência", "Ocorrências", record, "-", describe(record));
    }
    persist("occurrences");
    form.reset();
    setInitialFormValues();
    renderAll();
    toast("Ocorrência salva", "O evento foi incluído no acompanhamento operacional.");
  }

  function renderOccurrences() {
    const records = state.occurrences.slice().sort(function (a, b) {
      return String(b.occurredAt).localeCompare(String(a.occurredAt));
    });
    $("#occurrencesTableBody").innerHTML = records.length ? records.map(function (record) {
      const actions = record.status === "Resolvida" ? ["edit", "delete"] : ["resolve", "edit", "delete"];
      return "<tr><td>" + formatDatetimeLocal(record.occurredAt) + "</td><td>" + escapeHtml(record.type) +
        "</td><td>" + escapeHtml(record.involved) + "</td><td>" + statusBadge(record.severity) +
        "</td><td>" + statusBadge(record.status) + "</td><td>" + escapeHtml(record.responsible) +
        "</td><td>" + tableActions("occurrence", record.id, actions) + "</td></tr>";
    }).join("") : emptyRow(7, "Nenhuma ocorrência registrada.");
  }

  function submitAdministrative(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = values(form);
    const index = state.administrative.findIndex(function (record) {
      return record.id === data.id;
    });
    const previous = index >= 0 ? state.administrative[index] : null;
    const record = Object.assign({}, previous || {}, data, {
      id: data.id || id("ADM"),
      updatedAt: new Date().toISOString()
    });
    if (previous) {
      state.administrative[index] = record;
      addAudit("Edição de caso", "Análise Administrativa", record, describe(previous), describe(record));
    } else {
      state.administrative.unshift(record);
      addAudit("Novo caso administrativo", "Análise Administrativa", record, "-", describe(record));
    }
    persist("administrative");
    form.reset();
    renderAll();
    toast("Caso registrado", "As informações foram armazenadas localmente para acompanhamento.");
  }

  function viewAdministrative(record) {
    openModal("Caso administrativo - " + record.employee, '<div class="detail-grid">' +
      detailEntry("Funcionário", record.employee) +
      detailEntry("Cargo", record.role) +
      detailEntry("Setor original", record.originalSector) +
      detailEntry("Gerente / supervisor", record.manager) +
      detailEntry("Tipo", record.situationType) +
      detailEntry("Situação final", record.finalSituation) +
      detailEntry("Atividades contratadas", record.contractedActivities, true) +
      detailEntry("Atividades posteriores", record.additionalActivities, true) +
      detailEntry("Descrição", record.description, true) +
      detailEntry("Datas", record.eventDates, true) +
      detailEntry("Providência do RH", record.hrAction, true) +
      detailEntry("Observações finais", record.finalNotes, true) +
      "</div>");
  }

  function renderAdministrative() {
    $("#administrativeTableBody").innerHTML = state.administrative.length ? state.administrative.map(function (record) {
      return "<tr><td><strong>" + escapeHtml(record.employee) + "</strong></td><td>" + escapeHtml(record.role) +
        "</td><td>" + escapeHtml(record.situationType) + "</td><td>" + escapeHtml(record.manager) +
        "</td><td>" + escapeHtml(truncate(record.eventDates, 32)) + "</td><td>" +
        statusBadge(record.finalSituation) + "</td><td>" +
        tableActions("administrative", record.id, ["view", "edit", "delete"]) + "</td></tr>";
    }).join("") : emptyRow(7, "Nenhum caso administrativo registrado.");
  }

  function renderDashboard() {
    const today = todayISO();
    const inside = state.checkins.filter(function (record) { return record.status === "Dentro da empresa"; });
    const entriesToday = state.checkins.filter(function (record) { return record.entryDate === today; });
    const exitsToday = state.checkins.filter(function (record) { return record.checkout && record.checkout.date === today; });
    const pendingAppointments = state.appointments.filter(function (record) { return normalize(record.status) === "pendente"; });
    const openOccurrences = state.occurrences.filter(function (record) { return normalize(record.status) !== "resolvida"; });
    const blockedDrivers = state.drivers.filter(function (record) { return normalize(record.status) === "bloqueado"; });
    const activeCarriers = state.carriers.filter(function (record) { return normalize(record.status) === "ativa"; });

    $("#kpiInside").textContent = inside.length;
    $("#kpiEntriesToday").textContent = entriesToday.length;
    $("#kpiExitsToday").textContent = exitsToday.length;
    $("#kpiAppointments").textContent = pendingAppointments.length;
    $("#kpiOccurrences").textContent = openOccurrences.length;
    $("#kpiBlockedDrivers").textContent = blockedDrivers.length;
    $("#kpiActiveCarriers").textContent = activeCarriers.length;
    $("#kpiNoExit").textContent = inside.length;
    $("#sidebarOccupancy").textContent = inside.length + " veículo" + (inside.length === 1 ? "" : "s");
    $("#sidebarProgress").style.width = Math.min(100, inside.length * 4) + "%";

    const movements = [];
    state.checkins.forEach(function (record) {
      movements.push({
        protocol: record.protocol,
        type: "Entrada",
        plate: record.truckPlate,
        driver: record.driverName,
        date: record.entryDate,
        time: record.entryTime,
        status: record.status
      });
      if (record.checkout) {
        movements.push({
          protocol: record.protocol,
          type: "Saída",
          plate: record.truckPlate,
          driver: record.driverName,
          date: record.checkout.date,
          time: record.checkout.time,
          status: "Check-out realizado"
        });
      }
    });
    movements.sort(function (a, b) {
      return (b.date + b.time).localeCompare(a.date + a.time);
    });
    $("#dashboardMovementsBody").innerHTML = movements.length ? movements.slice(0, 8).map(function (movement) {
      return "<tr><td>" + escapeHtml(movement.protocol) + "</td><td>" + escapeHtml(movement.type) +
        "</td><td>" + escapeHtml(movement.plate) + "</td><td>" + escapeHtml(movement.driver) +
        "</td><td>" + formatDateTime(movement.date, movement.time) + "</td><td>" +
        statusBadge(movement.status) + "</td></tr>";
    }).join("") : emptyRow(6, "Nenhuma movimentação registrada hoje.");

    renderAlerts(inside, pendingAppointments, openOccurrences);
    renderChart();
    renderIndicators(inside);
  }

  function renderAlerts(inside, pendingAppointments, openOccurrences) {
    const alerts = [];
    if (state.settings.alertsEnabled) {
      const maxMinutes = Number(state.settings.maximumStayHours) * 60;
      inside.forEach(function (record) {
        const elapsed = durationMinutes(record.entryDate, record.entryTime, todayISO(), timeNow());
        if (elapsed > maxMinutes) {
          alerts.push({
            type: "danger",
            icon: "fa-clock",
            title: "Permanência acima do limite",
            detail: record.truckPlate + " - " + durationLabel(elapsed) + " em pátio"
          });
        }
        if (record.cnhExpiry && record.cnhExpiry < todayISO()) {
          alerts.push({
            type: "danger",
            icon: "fa-id-card",
            title: "CNH vencida em registro ativo",
            detail: record.driverName + " - protocolo " + record.protocol
          });
        }
      });
      openOccurrences.filter(function (record) {
        return normalize(record.severity) === "critica" || normalize(record.severity) === "alta";
      }).forEach(function (record) {
        alerts.push({
          type: "danger",
          icon: "fa-triangle-exclamation",
          title: record.severity + ": " + record.type,
          detail: truncate(record.involved, 38)
        });
      });
      pendingAppointments.filter(function (record) {
        return record.scheduledDate < todayISO();
      }).forEach(function (record) {
        alerts.push({
          type: "warning",
          icon: "fa-calendar-xmark",
          title: "Agendamento em atraso",
          detail: record.plate + " - previsto para " + formatDate(record.scheduledDate)
        });
      });
    }
    const visibleAlerts = alerts.slice(0, 5);
    if (!visibleAlerts.length) {
      visibleAlerts.push({
        type: "success",
        icon: "fa-circle-check",
        title: state.settings.alertsEnabled ? "Operação sem alertas críticos" : "Alertas desativados",
        detail: state.settings.alertsEnabled ? "Nenhuma pendência automática detectada." : "Ative os alertas nas configurações."
      });
    }
    $("#alertsList").innerHTML = visibleAlerts.map(function (alert) {
      return '<div class="alert-item ' + alert.type + '"><i class="fa-solid ' + alert.icon +
        '"></i><div><strong>' + escapeHtml(alert.title) + "</strong><small>" +
        escapeHtml(alert.detail) + "</small></div></div>";
    }).join("");
    $("#notificationCount").textContent = alerts.length;
  }

  function renderChart() {
    const days = [];
    for (let offset = -6; offset <= 0; offset += 1) {
      const date = dateFromOffset(offset);
      days.push({
        date: date,
        entries: state.checkins.filter(function (record) { return record.entryDate === date; }).length,
        exits: state.checkins.filter(function (record) { return record.checkout && record.checkout.date === date; }).length
      });
    }
    const highest = Math.max.apply(null, days.map(function (item) {
      return Math.max(item.entries, item.exits);
    }).concat([1]));
    $("#movementChart").innerHTML = days.map(function (day) {
      const entryHeight = Math.max(4, Math.round(day.entries / highest * 140));
      const exitHeight = Math.max(4, Math.round(day.exits / highest * 140));
      return '<div class="chart-column"><div class="chart-bars"><span class="chart-bar entry" data-value="' +
        day.entries + '" style="height:' + entryHeight + 'px"></span><span class="chart-bar exit" data-value="' +
        day.exits + '" style="height:' + exitHeight + 'px"></span></div><small>' +
        formatDate(day.date).slice(0, 5) + "</small></div>";
    }).join("");
  }

  function renderIndicators(inside) {
    const completed = state.checkins.filter(function (record) { return record.checkout; });
    const maxMinutes = Number(state.settings.maximumStayHours) * 60;
    const withinTime = completed.filter(function (record) {
      return Number(record.checkout.durationMinutes) <= maxMinutes;
    }).length;
    const validDocuments = inside.filter(function (record) {
      return !record.cnhExpiry || record.cnhExpiry >= todayISO();
    }).length;
    const average = completed.length ? Math.round(completed.reduce(function (sum, record) {
      return sum + Number(record.checkout.durationMinutes || 0);
    }, 0) / completed.length) : 0;
    const rows = [
      { label: "Saídas dentro do SLA", value: completed.length ? Math.round(withinTime / completed.length * 100) : 100, className: "green" },
      { label: "Documentação válida em pátio", value: inside.length ? Math.round(validDocuments / inside.length * 100) : 100, className: "green" },
      { label: "Check-outs concluídos", value: state.checkins.length ? Math.round(completed.length / state.checkins.length * 100) : 0, className: "" },
      { label: "Permanência média: " + durationLabel(average), value: average ? Math.min(100, Math.round(average / maxMinutes * 100)) : 0, className: "yellow" }
    ];
    $("#operationalIndicators").innerHTML = rows.map(function (row) {
      return '<div class="indicator"><div class="indicator-label"><span>' + escapeHtml(row.label) +
        "</span><strong>" + row.value + '%</strong></div><div class="indicator-bar ' + row.className +
        '"><span style="width:' + row.value + '%"></span></div></div>';
    }).join("");
  }

  function getFilteredCheckins(filters) {
    return state.checkins.filter(function (record) {
      return checkinFilter(record, filters, "entry") &&
        (!filters.sector || normalize(record.destinationSector).includes(normalize(filters.sector))) &&
        (!filters.responsible || normalize(record.internalResponsible).includes(normalize(filters.responsible))) &&
        (!filters.vehicleType || normalize(record.truckModel).includes(normalize(filters.vehicleType)));
    });
  }

  function aggregate(records, keyFunction) {
    const map = {};
    records.forEach(function (record) {
      const key = keyFunction(record) || "Não informado";
      if (!map[key]) {
        map[key] = { name: key, total: 0, inside: 0, completed: 0 };
      }
      map[key].total += 1;
      map[key].inside += record.status === "Dentro da empresa" ? 1 : 0;
      map[key].completed += record.checkout ? 1 : 0;
    });
    return Object.keys(map).map(function (key) { return map[key]; });
  }

  function generateReport(event) {
    if (event) {
      event.preventDefault();
    }
    const filters = values($("#reportFilters"));
    const reportType = filters.reportType || "entradas";
    const checkins = getFilteredCheckins(filters);
    let title = "Relatório de entradas";
    let columns = [];
    let rows = [];

    if (reportType === "entradas") {
      columns = [["protocol", "Protocolo"], ["entry", "Entrada"], ["plate", "Placa"], ["carrier", "Transportadora"], ["driver", "Motorista"], ["status", "Status"]];
      rows = checkins.map(function (record) {
        return { protocol: record.protocol, entry: formatDateTime(record.entryDate, record.entryTime), plate: record.truckPlate, carrier: record.carrierName, driver: record.driverName, status: record.status };
      });
    } else if (reportType === "saidas" || reportType === "permanencia") {
      title = reportType === "saidas" ? "Relatório de saídas" : "Relatório de permanência";
      columns = [["protocol", "Protocolo"], ["plate", "Placa"], ["entry", "Entrada"], ["exit", "Saída"], ["duration", "Permanência"], ["responsible", "Conferente"]];
      rows = checkins.filter(function (record) { return record.checkout; }).map(function (record) {
        return { protocol: record.protocol, plate: record.truckPlate, entry: formatDateTime(record.entryDate, record.entryTime), exit: formatDateTime(record.checkout.date, record.checkout.time), duration: durationLabel(record.checkout.durationMinutes), responsible: record.checkout.responsible };
      });
    } else if (reportType === "transportadora" || reportType === "motorista") {
      title = reportType === "transportadora" ? "Relatório por transportadora" : "Relatório por motorista";
      columns = [["name", reportType === "transportadora" ? "Transportadora" : "Motorista"], ["total", "Entradas"], ["inside", "Em pátio"], ["completed", "Saídas"]];
      rows = aggregate(checkins, function (record) {
        return reportType === "transportadora" ? record.carrierName : record.driverName;
      });
    } else if (reportType === "ocorrencias") {
      title = "Relatório de ocorrências";
      columns = [["date", "Data/Hora"], ["type", "Tipo"], ["involved", "Envolvidos"], ["severity", "Gravidade"], ["status", "Status"]];
      rows = state.occurrences.filter(function (record) {
        return (!filters.startDate || record.occurredAt.slice(0, 10) >= filters.startDate) &&
          (!filters.endDate || record.occurredAt.slice(0, 10) <= filters.endDate) &&
          (!filters.occurrence || normalize(record.type).includes(normalize(filters.occurrence))) &&
          (!filters.responsible || normalize(record.responsible).includes(normalize(filters.responsible)));
      }).map(function (record) {
        return { date: formatDatetimeLocal(record.occurredAt), type: record.type, involved: record.involved, severity: record.severity, status: record.status };
      });
    } else if (reportType === "administrativo") {
      title = "Relatório administrativo";
      columns = [["employee", "Funcionário"], ["role", "Cargo"], ["type", "Tipo"], ["manager", "Supervisor"], ["status", "Situação"]];
      rows = state.administrative.map(function (record) {
        return { employee: record.employee, role: record.role, type: record.situationType, manager: record.manager, status: record.finalSituation };
      });
    } else {
      title = "Relatório de auditoria";
      columns = [["date", "Data/Hora"], ["user", "Usuário"], ["action", "Ação"], ["screen", "Tela"], ["record", "Registro"]];
      rows = state.audit.map(function (record) {
        return { date: formatDateTime(record.date, record.time), user: record.user, action: record.action, screen: record.screen, record: record.record };
      });
    }

    state.reportColumns = columns;
    state.reportRows = rows;
    $("#reportResultTitle").textContent = title;
    $("#reportResultDescription").textContent = rows.length + " item(ns) disponíveis para visualização e exportação.";
    $("#reportTableHead").innerHTML = "<tr>" + columns.map(function (column) {
      return "<th>" + escapeHtml(column[1]) + "</th>";
    }).join("") + "</tr>";
    $("#reportTableBody").innerHTML = rows.length ? rows.map(function (row) {
      return "<tr>" + columns.map(function (column) {
        return "<td>" + escapeHtml(row[column[0]]) + "</td>";
      }).join("") + "</tr>";
    }).join("") : emptyRow(columns.length || 1, "Nenhum dado encontrado para os filtros.");

    const completed = checkins.filter(function (record) { return record.checkout; });
    const average = completed.length ? Math.round(completed.reduce(function (sum, record) {
      return sum + Number(record.checkout.durationMinutes || 0);
    }, 0) / completed.length) : 0;
    $("#reportTotal").textContent = rows.length;
    $("#reportInside").textContent = checkins.filter(function (record) { return record.status === "Dentro da empresa"; }).length;
    $("#reportAverage").textContent = completed.length ? durationLabel(average) : "--";
    $("#reportOccurrences").textContent = state.occurrences.length;
    if (event) {
      addAudit("Geração de relatório", "Relatórios", { name: title }, "-", rows.length + " registros");
      toast("Relatório gerado", title + " contém " + rows.length + " item(ns).");
    }
  }

  function exportCsv() {
    if (!state.reportColumns.length) {
      generateReport();
    }
    const encodeCell = function (value) {
      return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
    };
    const lines = [
      state.reportColumns.map(function (column) { return encodeCell(column[1]); }).join(";")
    ].concat(state.reportRows.map(function (row) {
      return state.reportColumns.map(function (column) { return encodeCell(row[column[0]]); }).join(";");
    }));
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "relatorio_portaria_" + todayISO() + ".csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    addAudit("Exportação CSV", "Relatórios", { name: "CSV" }, "-", state.reportRows.length + " registros");
    toast("Arquivo exportado", "O relatório CSV foi gerado no navegador.");
  }

  function renderAudit() {
    if (!$("#auditTableBody")) {
      return;
    }
    const filters = values($("#auditFilters"));
    const entries = state.audit.filter(function (record) {
      return (!filters.user || normalize(record.user).includes(normalize(filters.user))) &&
        (!filters.action || normalize(record.action).includes(normalize(filters.action))) &&
        (!filters.screen || normalize(record.screen).includes(normalize(filters.screen))) &&
        (!filters.date || record.date === filters.date);
    });
    $("#auditCount").textContent = entries.length + " evento" + (entries.length === 1 ? "" : "s");
    $("#auditTableBody").innerHTML = entries.length ? entries.map(function (record) {
      return "<tr><td>" + escapeHtml(record.user) + "</td><td><strong>" + escapeHtml(record.action) +
        "</strong></td><td>" + escapeHtml(record.screen) + "</td><td>" + formatDate(record.date) +
        "</td><td>" + escapeHtml(record.time) + "</td><td>" + escapeHtml(record.record) +
        "</td><td>" + escapeHtml(record.oldValue) + "</td><td>" + escapeHtml(record.newValue) + "</td></tr>";
    }).join("") : emptyRow(8, "Nenhum evento localizado.");
  }

  function loadSettingsForm() {
    fillForm($("#settingsForm"), state.settings);
  }

  function submitSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const previous = JSON.stringify(state.settings);
    state.settings = {
      companyName: form.elements.companyName.value,
      theme: form.elements.theme.value,
      maximumStayHours: Number(form.elements.maximumStayHours.value),
      alertsEnabled: form.elements.alertsEnabled.checked,
      advancedMode: form.elements.advancedMode.checked,
      allowDeletion: form.elements.allowDeletion.checked,
      requireValidCnh: form.elements.requireValidCnh.checked,
      requireActiveCarrier: form.elements.requireActiveCarrier.checked
    };
    writeStorage(STORAGE.settings, state.settings);
    addAudit("Atualização de configurações", "Configurações", { name: "Políticas do sistema" }, previous, JSON.stringify(state.settings));
    applySettings();
    renderAll();
    toast("Configurações salvas", "As políticas operacionais foram atualizadas.");
  }

  function restoreSettings() {
    state.settings = Object.assign({}, DEFAULT_SETTINGS);
    writeStorage(STORAGE.settings, state.settings);
    loadSettingsForm();
    applySettings();
    addAudit("Restauração de configurações", "Configurações", { name: "Padrões" }, "-", "Valores padrão restaurados");
    renderAll();
    toast("Padrões restaurados", "As configurações iniciais foram recuperadas.");
  }

  function globalSearch() {
    const query = normalize($("#globalSearch").value);
    const resultBox = $("#globalSearchResults");
    if (query.length < 2) {
      resultBox.classList.remove("visible");
      resultBox.innerHTML = "";
      return;
    }
    const results = [];
    state.checkins.forEach(function (record) {
      if (normalize([record.protocol, record.truckPlate, record.driverName, record.carrierName].join(" ")).includes(query)) {
        results.push({ icon: "fa-truck", title: record.protocol + " - " + record.truckPlate, subtitle: record.driverName, page: "entries", entity: "checkin", id: record.id });
      }
    });
    state.appointments.forEach(function (record) {
      if (normalize([record.plate, record.driver, record.carrier].join(" ")).includes(query)) {
        results.push({ icon: "fa-calendar-check", title: "Agenda - " + record.plate, subtitle: record.driver, page: "appointments", entity: "appointment", id: record.id });
      }
    });
    state.drivers.forEach(function (record) {
      if (normalize([record.name, record.cpf, record.cnh].join(" ")).includes(query)) {
        results.push({ icon: "fa-id-card", title: record.name, subtitle: "Motorista - " + record.status, page: "drivers", entity: "driver", id: record.id });
      }
    });
    const limited = results.slice(0, 8);
    resultBox.innerHTML = limited.length ? limited.map(function (result) {
      return '<button class="search-result" type="button" data-search-page="' + result.page +
        '" data-search-entity="' + result.entity + '" data-search-id="' + result.id + '"><i class="fa-solid ' +
        result.icon + '"></i><span><strong>' + escapeHtml(result.title) + "</strong><small>" +
        escapeHtml(result.subtitle) + "</small></span></button>";
    }).join("") : '<div class="search-result"><span><strong>Nenhum resultado</strong><small>Refine o termo pesquisado.</small></span></div>';
    resultBox.classList.add("visible");
  }

  function handleTableAction(button) {
    const action = button.dataset.action;
    const entity = button.dataset.entity;
    const recordId = button.dataset.id;
    let record;
    if (entity === "checkin") {
      record = state.checkins.find(function (item) { return item.id === recordId; });
      if (action === "view") { viewCheckin(record, false); }
      if (action === "edit") { editCheckin(record); }
      if (action === "delete" && record) { removeRecord("checkins", record, "Check-in", "o check-in " + record.protocol); }
      if ((action === "checkout" || action === "select") && record) { selectCheckout(record); }
      return;
    }
    if (entity === "appointment") {
      record = state.appointments.find(function (item) { return item.id === recordId; });
      if (action === "arrive") { beginAppointmentCheckin(record); }
      if (action === "edit" && record) { fillForm($("#appointmentForm"), record); showPage("appointments"); }
      if (action === "delete" && record) { removeRecord("appointments", record, "Agendamentos", "o agendamento"); }
      return;
    }
    const entityConfig = {
      truck: ["trucks", "#truckForm", "trucks", "Caminhões", "o caminhão"],
      driver: ["drivers", "#driverForm", "drivers", "Motoristas", "o motorista"],
      carrier: ["carriers", "#carrierForm", "carriers", "Transportadoras", "a transportadora"],
      occurrence: ["occurrences", "#occurrenceForm", "occurrences", "Ocorrências", "a ocorrência"],
      administrative: ["administrative", "#administrativeForm", "administrative", "Análise Administrativa", "o caso"]
    };
    const config = entityConfig[entity];
    if (!config) {
      return;
    }
    record = state[config[0]].find(function (item) { return item.id === recordId; });
    if (!record) {
      return;
    }
    if (action === "edit") {
      fillForm($(config[1]), record);
      showPage(config[2]);
      toast("Edição habilitada", "Atualize os campos e salve o registro.");
    } else if (action === "delete") {
      removeRecord(config[0], record, config[3], config[4]);
    } else if (action === "resolve" && entity === "occurrence") {
      const priorStatus = record.status;
      record.status = "Resolvida";
      persist("occurrences");
      addAudit("Resolução de ocorrência", "Ocorrências", record, priorStatus, record.status);
      renderAll();
      toast("Ocorrência resolvida", "O status do evento foi atualizado.");
    } else if (action === "view" && entity === "administrative") {
      viewAdministrative(record);
    }
  }

  function bindForms() {
    $("#checkinForm").addEventListener("submit", submitCheckin);
    $("#checkinForm").addEventListener("reset", function () {
      window.setTimeout(function () {
        $("#protocolPreview").textContent = "Gerado ao salvar";
        setInitialFormValues();
      }, 0);
    });
    $("#generateProtocolButton").addEventListener("click", function () {
      const form = $("#checkinForm");
      if (!form.elements.protocol.value) {
        form.elements.protocol.value = nextProtocol(form.elements.entryDate.value || todayISO());
      }
      $("#protocolPreview").textContent = form.elements.protocol.value;
      toast("Protocolo reservado", form.elements.protocol.value + " será usado ao salvar.");
    });
    $("#printReceiptButton").addEventListener("click", function () {
      const idToPrint = $("#checkinForm").elements.id.value || state.latestReceiptId;
      const record = state.checkins.find(function (item) { return item.id === idToPrint; });
      if (!record) {
        toast("Sem comprovante", "Salve ou visualize um check-in antes de imprimir.", "warning");
        return;
      }
      viewCheckin(record, true);
      window.print();
    });
    $("#checkinQuickFilter").addEventListener("input", renderCheckins);
    $("#checkoutSearchForm").addEventListener("submit", function (event) {
      event.preventDefault();
      renderCheckoutResults();
    });
    $("#checkoutSearchForm").addEventListener("reset", function () {
      window.setTimeout(renderCheckoutResults, 0);
    });
    $("#checkoutForm").addEventListener("submit", submitCheckout);
    $("#appointmentForm").addEventListener("submit", submitAppointment);
    $("#appointmentForm").addEventListener("reset", function () { window.setTimeout(setInitialFormValues, 0); });
    $("#entriesFilters").addEventListener("submit", function (event) { event.preventDefault(); renderEntries(); });
    $("#entriesFilters").addEventListener("reset", function () { window.setTimeout(renderEntries, 0); });
    $("#exitsFilters").addEventListener("submit", function (event) { event.preventDefault(); renderExits(); });
    $("#exitsFilters").addEventListener("reset", function () { window.setTimeout(renderExits, 0); });
    $("#truckForm").addEventListener("submit", function (event) {
      event.preventDefault();
      upsertCatalog("trucks", event.currentTarget, "Caminhões", "Caminhão", "plate");
    });
    $("#driverForm").addEventListener("submit", function (event) {
      event.preventDefault();
      upsertCatalog("drivers", event.currentTarget, "Motoristas", "Motorista", "cpf");
    });
    $("#carrierForm").addEventListener("submit", function (event) {
      event.preventDefault();
      upsertCatalog("carriers", event.currentTarget, "Transportadoras", "Transportadora", "cnpj");
    });
    $("#occurrenceForm").addEventListener("submit", submitOccurrence);
    $("#occurrenceForm").addEventListener("reset", function () { window.setTimeout(setInitialFormValues, 0); });
    $("#administrativeForm").addEventListener("submit", submitAdministrative);
    $("#reportFilters").addEventListener("submit", generateReport);
    $("#reportFilters").addEventListener("reset", function () { window.setTimeout(generateReport, 0); });
    $("#exportCsvButton").addEventListener("click", exportCsv);
    $("#printReportButton").addEventListener("click", function () {
      document.body.classList.add("print-report");
      window.print();
      window.setTimeout(function () { document.body.classList.remove("print-report"); }, 500);
    });
    $("#auditFilters").addEventListener("submit", function (event) { event.preventDefault(); renderAudit(); });
    $("#auditFilters").addEventListener("reset", function () { window.setTimeout(renderAudit, 0); });
    $("#settingsForm").addEventListener("submit", submitSettings);
    $("#restoreSettingsButton").addEventListener("click", restoreSettings);
  }

  function bindGlobalEvents() {
    document.addEventListener("click", function (event) {
      const actionButton = event.target.closest("[data-entity][data-action]");
      if (actionButton) {
        handleTableAction(actionButton);
        return;
      }
      if (event.target.closest("[data-close-modal]")) {
        closeModal();
        return;
      }
      const result = event.target.closest("[data-search-page]");
      if (result) {
        showPage(result.dataset.searchPage);
        $("#globalSearchResults").classList.remove("visible");
        if (result.dataset.searchEntity === "checkin") {
          const record = state.checkins.find(function (item) { return item.id === result.dataset.searchId; });
          viewCheckin(record, false);
        }
        return;
      }
      if (!event.target.closest(".global-search")) {
        $("#globalSearchResults").classList.remove("visible");
      }
    });
    $("#globalSearch").addEventListener("input", globalSearch);
    $("#modalPrintButton").addEventListener("click", function () {
      window.print();
    });
    $("#notificationButton").addEventListener("click", function () {
      showPage("dashboard");
      toast("Central de alertas", "Os eventos monitorados estão exibidos no painel.");
    });
    $("#logoutButton").addEventListener("click", function () {
      addAudit("Solicitação de saída", "Sessão", { name: "Usuário Portaria" }, "Sessão ativa", "Encerramento simulado");
      toast("Sessão simulada", "Em uma aplicação estática, não há autenticação real para encerrar.", "warning");
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeModal();
      }
    });
  }

  function renderAll() {
    renderDataLists();
    renderDashboard();
    renderCheckins();
    renderCheckoutResults();
    renderAppointments();
    renderEntries();
    renderExits();
    renderTrucks();
    renderDrivers();
    renderCarriers();
    renderOccurrences();
    renderAdministrative();
    renderAudit();
  }

  function init() {
    loadState();
    bindNavigation();
    bindForms();
    bindGlobalEvents();
    loadSettingsForm();
    applySettings();
    setInitialFormValues();
    $("#systemDate").textContent = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "full"
    }).format(new Date());
    renderAll();
    showPage("dashboard");
  }

  init();
}());
