function sectionTemplate(title, level, key, expanded) {
  return `<section class="section-card level-${level}">
    <button class="section-toggle" data-key="${key}" data-kind="section" aria-expanded="${expanded}">
      <span>${title}</span><span>${expanded ? "-" : "+"}</span>
    </button>
    <div class="section-content ${expanded ? "open" : ""}">`;
}

function escapeHtml(text = "") {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(text = "") {
  return escapeHtml(text).replaceAll("\"", "&quot;");
}

function getEditorToolbarTemplate() {
  return `<div class="rich-toolbar" role="toolbar" aria-label="Theory answer formatting toolbar">
      <button type="button" class="btn btn-secondary small" data-editor-cmd="bold" title="Bold">B</button>
      <button type="button" class="btn btn-secondary small" data-editor-cmd="italic" title="Italic">I</button>
      <button type="button" class="btn btn-secondary small" data-editor-cmd="underline" title="Underline">U</button>
      <button type="button" class="btn btn-secondary small" data-editor-cmd="insertUnorderedList" title="Bulleted list">UL</button>
      <button type="button" class="btn btn-secondary small" data-editor-cmd="insertOrderedList" title="Numbered list">OL</button>
      <input type="color" class="editor-color" value="#0284c7" data-editor-cmd="foreColor" aria-label="Text color">
    </div>`;
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
      if (!/^https?:\/\//i.test(href)) {
        element.removeAttribute("href");
      }
    }

    if (tag === "FONT") {
      const color = (element.getAttribute("color") || "").trim();
      if (color) {
        element.style.color = color;
      }
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
  return template.innerHTML;
}

function questionTemplate(question, id, isLocalhost, categoryName, subcategoryName, index, numberLabel) {
  const editButton = isLocalhost
    ? `<button class="btn btn-secondary small" data-kind="edit-open" data-id="${id}" data-show="Edit" data-hide="Close Edit">Edit</button>`
    : "";
  const deleteButton = isLocalhost
    ? `<button class="btn btn-danger small" data-kind="delete-question" data-category="${escapeAttr(categoryName)}" data-subcategory="${escapeAttr(subcategoryName)}" data-index="${index}">Delete</button>`
    : "";
  const common = `<div class="actions"></div>`;
  const safeAnswerHtml = sanitizeRichHtml(question.answer || "");
  const editPanel = isLocalhost ? `<div id="edit-${id}" class="panel edit-panel">
      <div class="edit-form" data-category="${escapeAttr(categoryName)}" data-subcategory="${escapeAttr(subcategoryName)}" data-index="${index}">
        <label>Type
          <select class="edit-type">
            <option value="theory" ${question.type === "theory" ? "selected" : ""}>Theory</option>
            <option value="program" ${question.type === "program" ? "selected" : ""}>Program</option>
          </select>
        </label>
        <label>Question
          <textarea class="edit-question" rows="2">${escapeHtml(question.question || "")}</textarea>
        </label>
        <label>Answer (Theory)
          <div class="rich-editor edit-rich-editor">
            ${getEditorToolbarTemplate()}
            <div class="rich-editor-input edit-answer-editor" contenteditable="true" role="textbox" aria-multiline="true" data-initial-answer="${encodeURIComponent(question.answer || "")}"></div>
            <input type="hidden" class="edit-answer">
          </div>
        </label>
        <label>Code (Program)
          <textarea class="edit-code" rows="4">${escapeHtml(question.code || "")}</textarea>
        </label>
        <label>Output (Program)
          <textarea class="edit-output" rows="3">${escapeHtml(question.output || "")}</textarea>
        </label>
        <div class="edit-actions">
          <button class="btn small" data-kind="edit-save">Save Changes</button>
          <button class="btn btn-secondary small" data-kind="edit-cancel" data-id="${id}" data-show="Edit">Cancel</button>
        </div>
      </div>
    </div>` : "";

  if (question.type === "theory") {
    return `<article class="question-card"><h4><span class="question-number">${escapeHtml(numberLabel)}.</span> ${escapeHtml(question.question)}</h4>${common}
      <div class="program-controls">
        <button class="btn small answer-btn" data-kind="toggle" data-id="answer-${id}" data-show="Show Answer" data-hide="Hide Answer">Show Answer</button>
        ${editButton}
        ${deleteButton}
      </div>
      <div id="answer-${id}" class="panel rich-answer">${safeAnswerHtml}</div>${editPanel}</article>`;
  }
  const formattedCode = formatJavaCode(question.code);
  return `<article class="question-card"><h4><span class="question-number">${escapeHtml(numberLabel)}.</span> ${escapeHtml(question.question)}</h4>${common}
    <div class="program-controls">
      <button class="btn small code-btn" data-kind="toggle" data-id="code-${id}" data-show="Show Code" data-hide="Hide Code">Show Code</button>
      <button class="btn small" data-kind="copy" data-copy="${encodeURIComponent(question.code)}">Copy Code</button>
      <button class="btn small output-btn" data-kind="toggle" data-id="output-${id}" data-show="Show Output" data-hide="Hide Output">Show Output</button>
      ${editButton}
      ${deleteButton}
    </div>
    <div id="code-${id}" class="panel"><pre><code class="language-java">${escapeHtml(formattedCode)}</code></pre></div>
    <div id="output-${id}" class="panel output-panel">${escapeHtml(question.output)}</div>${editPanel}</article>`;
}

function formatJavaCode(code = "") {
  if (!code.trim()) return "";

  if (code.includes("\n")) {
    const normalizedLines = code
      .replaceAll("\r\n", "\n")
      .split("\n")
      .map((line) => line.replace(/\s+$/g, ""));
    const nonEmpty = normalizedLines.filter((line) => line.trim().length > 0);
    const commonIndent = nonEmpty.length ? Math.min(...nonEmpty.map((line) => line.match(/^ */)[0].length)) : 0;
    return normalizedLines.map((line) => line.slice(commonIndent)).join("\n").trim();
  }

  let tokenized = "";
  let parenDepth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < code.length; i += 1) {
    const ch = code[i];
    tokenized += ch;

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "(") {
      parenDepth += 1;
      continue;
    }
    if (ch === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    if (ch === "{" || ch === "}") {
      tokenized += "\n";
      continue;
    }
    if (ch === ";" && parenDepth === 0) {
      tokenized += "\n";
    }
  }

  const lines = tokenized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let indentLevel = 0;
  const indent = "    ";
  const formatted = lines.map((line) => {
    if (line.startsWith("}")) {
      indentLevel = Math.max(0, indentLevel - 1);
    }
    const result = `${indent.repeat(indentLevel)}${line}`;
    if (line.endsWith("{")) {
      indentLevel += 1;
    }
    return result;
  });

  return formatted.join("\n");
}

export function renderApp(container, data, state) {
  if (!data.categories.length) {
    const empty = document.getElementById("empty-state-template");
    container.innerHTML = "";
    container.appendChild(empty.content.cloneNode(true));
    return;
  }
  let html = "";
  data.categories.forEach((category, categoryIndex) => {
    const ck = `category:${category.name}`;
    const categoryNumber = `${categoryIndex + 1}`;
    html += sectionTemplate(`${categoryNumber}. ${category.name}`, 1, ck, state.expandedSections.has(ck));
    category.subcategories.forEach((subcategory, subcategoryIndex) => {
      const sk = `subcategory:${category.name}:${subcategory.name}`;
      const subcategoryNumber = `${categoryNumber}.${subcategoryIndex + 1}`;
      html += sectionTemplate(`${subcategoryNumber}. ${subcategory.name}`, 2, sk, state.expandedSections.has(sk));
      subcategory.questions.forEach((question, index) => {
        const questionNumber = `${subcategoryNumber}.${index + 1}`;
        const id = `${category.name}|${subcategory.name}|${index}`;
        html += questionTemplate(question, id, state.isLocalhost, category.name, subcategory.name, index, questionNumber);
      });
      html += "</div></section>";
    });
    html += "</div></section>";
  });
  container.innerHTML = html;
  if (window.Prism) window.Prism.highlightAllUnder(container);
}

export function getCounts(data) {
  let total = 0;
  data.categories.forEach((c) => c.subcategories.forEach((s) => { total += s.questions.length; }));
  return total;
}
