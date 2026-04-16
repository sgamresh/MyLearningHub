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

function questionTemplate(question, id, isLocalhost, categoryName, subcategoryName, index, numberLabel) {
  const editButton = isLocalhost
    ? `<button class="btn btn-secondary small" data-kind="edit-open" data-id="${id}" data-show="Edit" data-hide="Close Edit">Edit</button>`
    : "";
  const deleteButton = isLocalhost
    ? `<button class="btn btn-danger small" data-kind="delete-question" data-category="${escapeAttr(categoryName)}" data-subcategory="${escapeAttr(subcategoryName)}" data-index="${index}">Delete</button>`
    : "";
  const common = `<div class="actions"></div>`;
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
          <textarea class="edit-answer" rows="3">${escapeHtml(question.answer || "")}</textarea>
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
      <div id="answer-${id}" class="panel">${escapeHtml(question.answer)}</div>${editPanel}</article>`;
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
