import { loadQuestions } from "./dataLoader.js";
import { renderApp, getCounts } from "./renderer.js";

const STORAGE_KEYS = { theme: "java-learning-theme" };
const NEW_OPTION_VALUE = "__new__";
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
const addCategoryNew = document.getElementById("add-category-new");
const addSubcategory = document.getElementById("add-subcategory");
const addSubcategoryNew = document.getElementById("add-subcategory-new");
const addType = document.getElementById("add-type");
const addQuestionText = document.getElementById("add-question-text");
const addAnswerRich = document.getElementById("add-answer-rich");
const addAnswerEditor = document.getElementById("add-answer-editor");
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

function sanitizeRichHtml(input = "") {
  const template = document.createElement("template");
  template.innerHTML = String(input || "");
  const allowedTags = new Set(["B", "STRONG", "I", "EM", "U", "S", "BR", "P", "DIV", "SPAN", "UL", "OL", "LI", "CODE", "PRE", "BLOCKQUOTE", "A", "H1", "H2", "H3", "H4", "FONT"]);
  const allowedStyles = new Set(["color", "background-color", "font-weight", "font-style", "text-decoration"]);

  const cleanNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.remove();
      return;
    }

    const element = node;
    const tag = element.tagName.toUpperCase();
    if (!allowedTags.has(tag)) {
      const parent = element.parentNode;
      if (!parent) return;
      while (element.firstChild) parent.insertBefore(element.firstChild, element);
      parent.removeChild(element);
      return;
    }

    const attrs = Array.from(element.attributes);
    attrs.forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name === "href" && tag === "A") return;
      if (name === "style") return;
      if (name === "color" && tag === "FONT") return;
      element.removeAttribute(attr.name);
    });

    if (tag === "A") {
      const href = (element.getAttribute("href") || "").trim();
      if (!/^https?:\/\//i.test(href)) element.removeAttribute("href");
    }

    if (tag === "FONT") {
      const color = (element.getAttribute("color") || "").trim();
      if (color) element.style.color = color;
      element.removeAttribute("color");
    }

    const styleText = element.getAttribute("style") || "";
    if (styleText) {
      const probe = document.createElement("span");
      probe.style.cssText = styleText;
      const cleanStyleParts = [];
      allowedStyles.forEach((prop) => {
        const value = probe.style.getPropertyValue(prop);
        if (value) cleanStyleParts.push(`${prop}:${value}`);
      });
      if (cleanStyleParts.length) {
        element.setAttribute("style", cleanStyleParts.join(";"));
      } else {
        element.removeAttribute("style");
      }
    }

    Array.from(element.childNodes).forEach(cleanNode);
  };

  Array.from(template.content.childNodes).forEach(cleanNode);
  return template.innerHTML.trim();
}

function setEditorHtml(editorElement, html) {
  editorElement.innerHTML = sanitizeRichHtml(html);
}

function syncEditorToHidden(editorElement, hiddenInput) {
  hiddenInput.value = sanitizeRichHtml(editorElement.innerHTML);
}

function initializeAddAnswerEditor() {
  if (!addAnswerEditor || addAnswerEditor.dataset.initialized === "true") return;
  addAnswerEditor.dataset.initialized = "true";
  setEditorHtml(addAnswerEditor, "");
  syncEditorToHidden(addAnswerEditor, addAnswer);
  addAnswerEditor.addEventListener("input", () => syncEditorToHidden(addAnswerEditor, addAnswer));
}

function initializeEditAnswerEditors() {
  content.querySelectorAll(".edit-rich-editor").forEach((editorRoot) => {
    if (editorRoot.dataset.initialized === "true") return;
    const editorInput = editorRoot.querySelector(".edit-answer-editor");
    const hiddenInput = editorRoot.querySelector(".edit-answer");
    if (!editorInput || !hiddenInput) return;

    const initialHtml = decodeURIComponent(editorInput.dataset.initialAnswer || "");
    setEditorHtml(editorInput, initialHtml);
    syncEditorToHidden(editorInput, hiddenInput);
    editorInput.addEventListener("input", () => syncEditorToHidden(editorInput, hiddenInput));
    editorRoot.dataset.initialized = "true";
  });
}

function setAddQuestionStatus(message, type = "info") {
  addQuestionStatus.textContent = message;
  addQuestionStatus.classList.remove("status-success", "status-error");
  if (type === "success") addQuestionStatus.classList.add("status-success");
  if (type === "error") addQuestionStatus.classList.add("status-error");
}

function setInputVisibility(input, visible) {
  input.classList.toggle("hidden", !visible);
  input.required = visible;
  if (!visible) input.value = "";
}

function setRichEditorEnabled(editorRoot, enabled) {
  const editorInput = editorRoot?.querySelector(".rich-editor-input");
  if (editorInput) editorInput.contentEditable = enabled ? "true" : "false";
  editorRoot?.querySelectorAll("[data-editor-cmd]").forEach((control) => {
    control.disabled = !enabled;
  });
}

function runEditorCommand(control) {
  const cmd = control.dataset.editorCmd;
  if (!cmd) return false;
  const editorRoot = control.closest(".rich-editor");
  const editorInput = editorRoot?.querySelector(".rich-editor-input");
  if (!editorInput || editorInput.contentEditable !== "true") return false;

  editorInput.focus();
  const value = control.value || null;
  document.execCommand(cmd, false, value);
  return true;
}

function appendSelectOption(selectElement, value, label) {
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  selectElement.appendChild(opt);
}

function getSelectedCategoryName() {
  return addCategory.value === NEW_OPTION_VALUE ? addCategoryNew.value.trim() : addCategory.value;
}

function getSelectedSubcategoryName() {
  return addSubcategory.value === NEW_OPTION_VALUE ? addSubcategoryNew.value.trim() : addSubcategory.value;
}

function reRender() {
  renderApp(content, state.rawData, state);
  initializeEditAnswerEditors();
  updateStats();
}

function populateAddQuestionSelectors(data) {
  addCategory.innerHTML = "";
  data.categories.forEach((category) => appendSelectOption(addCategory, category.name, category.name));
  appendSelectOption(addCategory, NEW_OPTION_VALUE, "+ Add new category");

  if (data.categories.length === 0) {
    addCategory.value = NEW_OPTION_VALUE;
  }
  setInputVisibility(addCategoryNew, addCategory.value === NEW_OPTION_VALUE);
  updateSubcategories();
}

function updateSubcategories() {
  addSubcategory.innerHTML = "";
  if (addCategory.value === NEW_OPTION_VALUE) {
    appendSelectOption(addSubcategory, NEW_OPTION_VALUE, "+ Add new subcategory");
    addSubcategory.value = NEW_OPTION_VALUE;
    setInputVisibility(addSubcategoryNew, true);
    return;
  }

  const category = state.rawData.categories.find((item) => item.name === addCategory.value);
  if (!category) {
    appendSelectOption(addSubcategory, NEW_OPTION_VALUE, "+ Add new subcategory");
    addSubcategory.value = NEW_OPTION_VALUE;
    setInputVisibility(addSubcategoryNew, true);
    return;
  }

  category.subcategories.forEach((subcategory) => appendSelectOption(addSubcategory, subcategory.name, subcategory.name));
  appendSelectOption(addSubcategory, NEW_OPTION_VALUE, "+ Add new subcategory");
  setInputVisibility(addSubcategoryNew, addSubcategory.value === NEW_OPTION_VALUE);
}

function handleCategorySelection() {
  const isNewCategory = addCategory.value === NEW_OPTION_VALUE;
  setInputVisibility(addCategoryNew, isNewCategory);
  updateSubcategories();
}

function handleSubcategorySelection() {
  setInputVisibility(addSubcategoryNew, addSubcategory.value === NEW_OPTION_VALUE);
}

function updateTypeFields() {
  const isTheory = addType.value === "theory";
  addAnswer.required = isTheory;
  addCode.required = !isTheory;
  addOutput.required = !isTheory;
  addAnswer.disabled = !isTheory;
  addCode.disabled = isTheory;
  addOutput.disabled = isTheory;
  setRichEditorEnabled(addAnswerRich, isTheory);
}

function isLocalhost() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

async function addQuestionFromUI(event) {
  event.preventDefault();
  if (!isLocalhost()) return;

  const categoryName = getSelectedCategoryName();
  const subcategoryName = getSelectedSubcategoryName();
  syncEditorToHidden(addAnswerEditor, addAnswer);

  if (!categoryName || !subcategoryName) {
    setAddQuestionStatus("Category and subcategory names are required.", "error");
    return;
  }

  const payload = {
    category: categoryName,
    subcategory: subcategoryName,
    question: {
      type: addType.value,
      question: addQuestionText.value.trim(),
      answer: addType.value === "theory" ? addAnswer.value : "",
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

    let category = state.rawData.categories.find((item) => item.name === payload.category);
    if (!category) {
      category = { name: payload.category, subcategories: [] };
      state.rawData.categories.push(category);
    }

    let subcategory = category.subcategories.find((item) => item.name === payload.subcategory);
    if (!subcategory) {
      subcategory = { name: payload.subcategory, questions: [] };
      category.subcategories.push(subcategory);
    }
    subcategory.questions.push(payload.question);

    addQuestionForm.reset();
    setEditorHtml(addAnswerEditor, "");
    syncEditorToHidden(addAnswerEditor, addAnswer);
    populateAddQuestionSelectors(state.rawData);
    updateTypeFields();
    setAddQuestionStatus("Question added and data files updated.", "success");
    reRender();
  } catch (error) {
    setAddQuestionStatus(error.message, "error");
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
  const answer = formElement.querySelector(".edit-answer")?.value || "";
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

async function deleteQuestionByLocation(categoryName, subcategoryName, questionIndex) {
  const payload = {
    action: "delete",
    category: categoryName,
    subcategory: subcategoryName,
    questionIndex
  };

  const response = await fetch("./api/save-question.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to delete question.");

  const category = state.rawData.categories.find((item) => item.name === categoryName);
  const subcategory = category?.subcategories.find((item) => item.name === subcategoryName);
  if (!subcategory || !Array.isArray(subcategory.questions)) return;

  if (questionIndex >= 0 && questionIndex < subcategory.questions.length) {
    subcategory.questions.splice(questionIndex, 1);
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
  addCategory.addEventListener("change", handleCategorySelection);
  addSubcategory.addEventListener("change", handleSubcategorySelection);
  addType.addEventListener("change", updateTypeFields);
  addQuestionForm.addEventListener("submit", addQuestionFromUI);

  addQuestionPanel.addEventListener("click", (event) => {
    const control = event.target.closest("[data-editor-cmd]");
    if (!control) return;
    event.preventDefault();
    if (!runEditorCommand(control)) return;
    syncEditorToHidden(addAnswerEditor, addAnswer);
  });
  addQuestionPanel.addEventListener("change", (event) => {
    if (!event.target.matches(".editor-color")) return;
    runEditorCommand(event.target);
    syncEditorToHidden(addAnswerEditor, addAnswer);
  });

  content.addEventListener("click", async (event) => {
    const editorControl = event.target.closest("[data-editor-cmd]");
    if (editorControl) {
      event.preventDefault();
      if (runEditorCommand(editorControl)) {
        const editorRoot = editorControl.closest(".edit-rich-editor");
        const editorInput = editorRoot?.querySelector(".edit-answer-editor");
        const hiddenInput = editorRoot?.querySelector(".edit-answer");
        if (editorInput && hiddenInput) syncEditorToHidden(editorInput, hiddenInput);
      }
      return;
    }

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
      const editorInput = formElement.querySelector(".edit-answer-editor");
      const hiddenInput = formElement.querySelector(".edit-answer");
      if (editorInput && hiddenInput) syncEditorToHidden(editorInput, hiddenInput);
      try {
        await saveEditedQuestion(formElement);
        reRender();
      } catch (error) {
        setAddQuestionStatus(error.message, "error");
      }
    } else if (kind === "delete-question") {
      if (!isLocalhost()) return;
      const categoryName = target.dataset.category || "";
      const subcategoryName = target.dataset.subcategory || "";
      const questionIndex = Number(target.dataset.index);
      const shouldDelete = window.confirm("Delete this question permanently?");
      if (!shouldDelete) return;

      try {
        await deleteQuestionByLocation(categoryName, subcategoryName, questionIndex);
        populateAddQuestionSelectors(state.rawData);
        setAddQuestionStatus("Question deleted and data files updated.", "success");
        reRender();
      } catch (error) {
        setAddQuestionStatus(error.message, "error");
      }
    }
  });

  content.addEventListener("change", (event) => {
    if (!event.target.matches(".edit-rich-editor .editor-color")) return;
    runEditorCommand(event.target);
    const editorRoot = event.target.closest(".edit-rich-editor");
    const editorInput = editorRoot?.querySelector(".edit-answer-editor");
    const hiddenInput = editorRoot?.querySelector(".edit-answer");
    if (editorInput && hiddenInput) syncEditorToHidden(editorInput, hiddenInput);
  });
}

async function bootstrap() {
  try {
    initializeTheme();
    state.isLocalhost = isLocalhost();
    state.rawData = await loadQuestions("./data/questions.index.json");
    if (state.isLocalhost) {
      addQuestionPanel.classList.remove("hidden");
      initializeAddAnswerEditor();
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
