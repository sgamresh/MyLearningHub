import { loadQuestions } from "./dataLoader.js";
import { renderApp, getCounts } from "./renderer.js";

const STORAGE_KEYS = { theme: "java-learning-theme" };
const state = {
  rawData: { categories: [] },
  expandedSections: new Set(),
  isLocalhost: false
};

const content = document.getElementById("content");
const stats = document.getElementById("stats");
const addQuestionPanel = document.getElementById("add-question-panel");
const addQuestionForm = document.getElementById("add-question-form");
const addCategory = document.getElementById("add-category");
const addSubcategory = document.getElementById("add-subcategory");
const addType = document.getElementById("add-type");
const addAnswer = document.getElementById("add-answer");
const addCode = document.getElementById("add-code");
const addOutput = document.getElementById("add-output");
const addQuestionStatus = document.getElementById("add-question-status");

function setTheme(theme) { document.documentElement.setAttribute("data-theme", theme); localStorage.setItem(STORAGE_KEYS.theme, theme); }
function initializeTheme() { setTheme(localStorage.getItem(STORAGE_KEYS.theme) || "light"); }

function updateStats() {
  const total = getCounts(state.rawData);
  stats.textContent = `Total questions: ${total}`;
}

function reRender() {
  renderApp(content, state.rawData, state);
  updateStats();
}

function populateAddQuestionSelectors(data) {
  addCategory.innerHTML = "";
  data.categories.forEach((category) => {
    const opt = document.createElement("option");
    opt.value = category.name;
    opt.textContent = category.name;
    addCategory.appendChild(opt);
  });
  updateSubcategories();
}

function updateSubcategories() {
  addSubcategory.innerHTML = "";
  const category = state.rawData.categories.find((item) => item.name === addCategory.value);
  if (!category) return;
  category.subcategories.forEach((subcategory) => {
    const opt = document.createElement("option");
    opt.value = subcategory.name;
    opt.textContent = subcategory.name;
    addSubcategory.appendChild(opt);
  });
}

function updateTypeFields() {
  const isTheory = addType.value === "theory";
  addAnswer.required = isTheory;
  addCode.required = !isTheory;
  addOutput.required = !isTheory;
  addAnswer.disabled = !isTheory;
  addCode.disabled = isTheory;
  addOutput.disabled = isTheory;
}

function isLocalhost() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

async function addQuestionFromUI(event) {
  event.preventDefault();
  if (!isLocalhost()) return;

  const payload = {
    category: addCategory.value,
    subcategory: addSubcategory.value,
    question: {
      type: addType.value,
      question: document.getElementById("add-question-text").value.trim(),
      answer: addType.value === "theory" ? addAnswer.value.trim() : "",
      code: addType.value === "program" ? addCode.value.trim() : "",
      output: addType.value === "program" ? addOutput.value.trim() : ""
    }
  };

  try {
    const response = await fetch("./api/save-question.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Failed to save question.");

    const category = state.rawData.categories.find((item) => item.name === payload.category);
    const subcategory = category?.subcategories.find((item) => item.name === payload.subcategory);
    subcategory?.questions.push(payload.question);
    addQuestionForm.reset();
    updateTypeFields();
    addQuestionStatus.textContent = "Question added and questions.json updated.";
    reRender();
  } catch (error) {
    addQuestionStatus.textContent = error.message;
  }
}

function getQuestionByLocation(categoryName, subcategoryName, index) {
  const category = state.rawData.categories.find((item) => item.name === categoryName);
  const subcategory = category?.subcategories.find((item) => item.name === subcategoryName);
  if (!subcategory || !Array.isArray(subcategory.questions)) return null;
  return { category, subcategory, question: subcategory.questions[index] };
}

async function saveEditedQuestion(formElement) {
  const categoryName = formElement.dataset.category;
  const subcategoryName = formElement.dataset.subcategory;
  const questionIndex = Number(formElement.dataset.index);
  const type = formElement.querySelector(".edit-type")?.value || "theory";
  const question = formElement.querySelector(".edit-question")?.value.trim() || "";
  const answer = formElement.querySelector(".edit-answer")?.value.trim() || "";
  const code = formElement.querySelector(".edit-code")?.value.trim() || "";
  const output = formElement.querySelector(".edit-output")?.value.trim() || "";

  const payload = {
    action: "update",
    category: categoryName,
    subcategory: subcategoryName,
    questionIndex,
    question: {
      type,
      question,
      answer: type === "theory" ? answer : "",
      code: type === "program" ? code : "",
      output: type === "program" ? output : ""
    }
  };

  const response = await fetch("./api/save-question.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to update question.");

  const found = getQuestionByLocation(categoryName, subcategoryName, questionIndex);
  if (found) {
    found.subcategory.questions[questionIndex] = payload.question;
  }
}

function expandCollapseAll(expand) {
  state.expandedSections.clear();
  if (expand) {
    state.rawData.categories.forEach((category) => {
      state.expandedSections.add(`category:${category.name}`);
      category.subcategories.forEach((subcategory) => {
        state.expandedSections.add(`subcategory:${category.name}:${subcategory.name}`);
      });
    });
  }
  reRender();
}

function attachEvents() {
  document.getElementById("theme-toggle").addEventListener("click", () => setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"));
  document.getElementById("expand-all").addEventListener("click", () => expandCollapseAll(true));
  document.getElementById("collapse-all").addEventListener("click", () => expandCollapseAll(false));
  addCategory.addEventListener("change", updateSubcategories);
  addType.addEventListener("change", updateTypeFields);
  addQuestionForm.addEventListener("submit", addQuestionFromUI);

  content.addEventListener("click", async (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    const kind = target.dataset.kind;
    if (kind === "toggle") {
      const panel = document.getElementById(target.dataset.id);
      if (panel) {
        const isOpen = panel.classList.toggle("open");
        target.textContent = isOpen ? target.dataset.hide : target.dataset.show;
      }
    } else if (kind === "section") {
      const key = target.dataset.key;
      if (state.expandedSections.has(key)) state.expandedSections.delete(key); else state.expandedSections.add(key);
      reRender();
    } else if (kind === "copy") {
      await navigator.clipboard.writeText(decodeURIComponent(target.dataset.copy || ""));
      target.textContent = "Copied!";
      setTimeout(() => { target.textContent = "Copy Code"; }, 1000);
    } else if (kind === "edit-open") {
      const panel = document.getElementById(`edit-${target.dataset.id}`);
      if (panel) {
        const isOpen = panel.classList.toggle("open");
        target.textContent = isOpen ? target.dataset.hide : target.dataset.show;
      }
    } else if (kind === "edit-cancel") {
      const panel = document.getElementById(`edit-${target.dataset.id}`);
      if (panel) panel.classList.remove("open");
      const openBtn = content.querySelector(`button[data-kind="edit-open"][data-id="${target.dataset.id}"]`);
      if (openBtn) openBtn.textContent = openBtn.dataset.show;
    } else if (kind === "edit-save") {
      const formElement = target.closest(".edit-form");
      if (!formElement) return;
      try {
        await saveEditedQuestion(formElement);
        reRender();
      } catch (error) {
        addQuestionStatus.textContent = error.message;
      }
    }
  });
}

async function bootstrap() {
  try {
    initializeTheme();
    state.isLocalhost = isLocalhost();
    state.rawData = await loadQuestions("./data/questions.json");
    if (state.isLocalhost) {
      addQuestionPanel.classList.remove("hidden");
      populateAddQuestionSelectors(state.rawData);
      updateTypeFields();
    }
    attachEvents();
    reRender();
  } catch (error) {
    content.innerHTML = `<div class="empty-state"><h2>Error</h2><p>${error.message}</p></div>`;
  }
}

bootstrap();
