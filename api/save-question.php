<?php
declare(strict_types=1);

header("Content-Type: application/json");

$allowedOrigins = ["127.0.0.1", "::1"];
$remoteAddress = $_SERVER["REMOTE_ADDR"] ?? "";

if (!in_array($remoteAddress, $allowedOrigins, true)) {
  http_response_code(403);
  echo json_encode(["error" => "This endpoint only works on localhost."]);
  exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode(["error" => "Method not allowed."]);
  exit;
}

$rawBody = file_get_contents("php://input");
$payload = json_decode($rawBody ?: "", true);

if (!is_array($payload)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid JSON payload."]);
  exit;
}

$categoryName = trim((string)($payload["category"] ?? ""));
$subcategoryName = trim((string)($payload["subcategory"] ?? ""));
$question = $payload["question"] ?? null;
$action = trim((string)($payload["action"] ?? "add"));
$questionIndex = isset($payload["questionIndex"]) ? (int)$payload["questionIndex"] : -1;

if ($categoryName === "" || $subcategoryName === "") {
  http_response_code(400);
  echo json_encode(["error" => "Missing category/subcategory data."]);
  exit;
}

if (!in_array($action, ["add", "update", "delete"], true)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid action. Use add, update, or delete."]);
  exit;
}

if ($action !== "delete") {
  if (!is_array($question)) {
    http_response_code(400);
    echo json_encode(["error" => "Missing question data."]);
    exit;
  }

  $type = trim((string)($question["type"] ?? ""));
  $text = trim((string)($question["question"] ?? ""));

  if (!in_array($type, ["theory", "program"], true) || $text === "") {
    http_response_code(400);
    echo json_encode(["error" => "Question type and question text are required."]);
    exit;
  }

  $cleanQuestion = [
    "type" => $type,
    "question" => $text
  ];

  if ($type === "theory") {
    $answer = trim((string)($question["answer"] ?? ""));
    if ($answer === "") {
      http_response_code(400);
      echo json_encode(["error" => "Answer is required for theory question."]);
      exit;
    }
    $cleanQuestion["answer"] = $answer;
  } else {
    $code = trim((string)($question["code"] ?? ""));
    $output = trim((string)($question["output"] ?? ""));
    if ($code === "" || $output === "") {
      http_response_code(400);
      echo json_encode(["error" => "Code and output are required for program question."]);
      exit;
    }
    $cleanQuestion["code"] = $code;
    $cleanQuestion["output"] = $output;
  }
}

$jsonPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . "data" . DIRECTORY_SEPARATOR . "questions.json";
$jsonContent = file_get_contents($jsonPath);

if ($jsonContent === false) {
  http_response_code(500);
  echo json_encode(["error" => "Unable to read questions.json"]);
  exit;
}

$data = json_decode($jsonContent, true);

if (!is_array($data) || !isset($data["categories"]) || !is_array($data["categories"])) {
  http_response_code(500);
  echo json_encode(["error" => "Invalid questions.json structure."]);
  exit;
}

$categoryIndex = null;
foreach ($data["categories"] as $index => $category) {
  if (($category["name"] ?? "") === $categoryName) {
    $categoryIndex = $index;
    break;
  }
}

if ($categoryIndex === null) {
  if ($action === "update") {
    http_response_code(404);
    echo json_encode(["error" => "Selected category/subcategory was not found."]);
    exit;
  }
  $data["categories"][] = [
    "name" => $categoryName,
    "subcategories" => []
  ];
  $categoryIndex = count($data["categories"]) - 1;
}

if (!isset($data["categories"][$categoryIndex]["subcategories"]) || !is_array($data["categories"][$categoryIndex]["subcategories"])) {
  $data["categories"][$categoryIndex]["subcategories"] = [];
}

$subcategoryIndex = null;
foreach ($data["categories"][$categoryIndex]["subcategories"] as $index => $subcategory) {
  if (($subcategory["name"] ?? "") === $subcategoryName) {
    $subcategoryIndex = $index;
    break;
  }
}

if ($subcategoryIndex === null) {
  if ($action === "update") {
    http_response_code(404);
    echo json_encode(["error" => "Selected category/subcategory was not found."]);
    exit;
  }
  $data["categories"][$categoryIndex]["subcategories"][] = [
    "name" => $subcategoryName,
    "questions" => []
  ];
  $subcategoryIndex = count($data["categories"][$categoryIndex]["subcategories"]) - 1;
}

if (!isset($data["categories"][$categoryIndex]["subcategories"][$subcategoryIndex]["questions"]) || !is_array($data["categories"][$categoryIndex]["subcategories"][$subcategoryIndex]["questions"])) {
  $data["categories"][$categoryIndex]["subcategories"][$subcategoryIndex]["questions"] = [];
}

if ($action === "update") {
  if ($questionIndex < 0 || $questionIndex >= count($data["categories"][$categoryIndex]["subcategories"][$subcategoryIndex]["questions"])) {
    http_response_code(404);
    echo json_encode(["error" => "Question index not found for update."]);
    exit;
  }
  $data["categories"][$categoryIndex]["subcategories"][$subcategoryIndex]["questions"][$questionIndex] = $cleanQuestion;
} elseif ($action === "delete") {
  if ($questionIndex < 0 || $questionIndex >= count($data["categories"][$categoryIndex]["subcategories"][$subcategoryIndex]["questions"])) {
    http_response_code(404);
    echo json_encode(["error" => "Question index not found for delete."]);
    exit;
  }
  array_splice($data["categories"][$categoryIndex]["subcategories"][$subcategoryIndex]["questions"], $questionIndex, 1);
} else {
  $data["categories"][$categoryIndex]["subcategories"][$subcategoryIndex]["questions"][] = $cleanQuestion;
}

$encoded = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
if ($encoded === false) {
  http_response_code(500);
  echo json_encode(["error" => "Failed to encode updated data."]);
  exit;
}

if (file_put_contents($jsonPath, $encoded . PHP_EOL, LOCK_EX) === false) {
  http_response_code(500);
  echo json_encode(["error" => "Failed to write questions.json"]);
  exit;
}

echo json_encode(["ok" => true]);
