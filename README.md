# Learning Hub (Static Website)

Production-ready modular learning website using only HTML, CSS, and vanilla JavaScript.

## Folder Structure

```text
.
├── api/
│   └── save-question.php
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── dataLoader.js
│   └── renderer.js
└── data/
    ├── questions.index.json
    ├── questions.json (legacy backup)
    └── modules/
        └── <module-slug>/
            └── <category-slug>--<subcategory-slug>.json
```

## Run Locally

1. Open `index.html` directly in a browser.
2. If your browser blocks `fetch()` on local file origin, run a static server (for example: `python -m http.server`) and open `http://localhost:8000`.

## Features Included

- Nested content model: category -> subcategory -> questions
- Theory questions with rich-formatted answers
- Programming questions with Show Code and Show Output toggles
- Prism.js Java syntax highlighting
- Expand all / Collapse all
- Dark/light mode toggle
- Copy code button
- Localhost-only Add/Edit/Delete flow that writes modular JSON files via PHP

## Data Format (Primary: Modular JSON)

Top-level index file: `data/questions.index.json`

```json
{
  "modules": [
    {
      "name": "Module Name",
      "slug": "module-slug",
      "items": [
        {
          "category": "Category Name",
          "subcategory": "Subcategory Name",
          "file": "modules/module-slug/category-slug--subcategory-slug.json"
        }
      ]
    }
  ]
}
```

Per category/subcategory question file:

```json
{
  "module": "Module Name",
  "category": "Category Name",
  "subcategory": "Subcategory Name",
  "questions": [
    {
      "type": "theory",
      "question": "Question text",
      "answer": "<p>Rich HTML answer</p>"
    },
    {
      "type": "program",
      "question": "Programming problem",
      "code": "public class Main { ... }",
      "output": "Expected output"
    }
  ]
}
```

## Adding New Questions

Use the localhost Add Question form. The app will:

1. Resolve the mapped category/subcategory file from `questions.index.json`.
2. Create a new category/subcategory file automatically when needed.
3. Save add/update/delete changes directly into that modular file.

## Optional Data Sources

`js/dataLoader.js` also supports `.csv` and `.txt` loading when `loadQuestions()` is pointed to those file types.
