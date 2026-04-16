# Learning Hub (Static Website)

Production-ready modular Java learning website using only HTML, CSS, and vanilla JavaScript.

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
    └── questions.json
```

## Run Locally

1. Open `index.html` directly in a browser.
2. If your browser blocks `fetch()` on local file origin, run a tiny static server (for example: `python -m http.server`) and open `http://localhost:8000`.

## Features Included

- Nested content model: category -> subcategory -> questions
- Theory questions with "Show Answer" toggle
- Programming questions with "Show Code" and "Show Output" toggles
- Prism.js Java syntax highlighting
- Expand all / Collapse all
- Dark/light mode toggle
- Copy code button
- Localhost-only "Add Question" form that writes to `data/questions.json` via PHP

## Data Format (Primary: JSON)

Update `data/questions.json` using this shape:

```json
{
  "categories": [
    {
      "name": "Category Name",
      "subcategories": [
        {
          "name": "Subcategory Name",
          "questions": [
            {
              "type": "theory",
              "question": "Question text",
              "answer": "Answer text"
            },
            {
              "type": "program",
              "question": "Programming problem",
              "code": "public class Main { ... }",
              "output": "Expected output"
            }
          ]
        }
      ]
    }
  ]
}
```

## Adding New Questions

1. Choose the target category/subcategory in `data/questions.json`.
2. Append a new question object in `questions`.
3. For theory items use `type: "theory"` with `answer`.
4. For coding items use `type: "program"` with `code` and `output`.
5. Save and refresh the page.

The UI updates automatically because all rendering is data-driven.

## Optional Data Sources

`js/dataLoader.js` also supports `.csv` and `.txt` loading when `loadQuestions()` is pointed to those file types.
