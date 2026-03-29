export const DEFAULT_SCRIPT = `// Access the incoming request via the 'request' object:
// - request.method (string)
// - request.headers (object)
// - request.query (object)
// - request.body (string)
// - request.url (string)
//
// Return a response object:
return {
  status: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ok: true, timestamp: Date.now() })
};`;

export const EXAMPLE_SCRIPTS = [
  {
    title: "Echo Request Body",
    description: "Returns the received request body back to the sender",
    code: `// Echo back whatever was sent
return {
  status: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    echo: request.body,
    method: request.method,
    receivedAt: new Date().toISOString()
  })
};`,
  },
  {
    title: "Conditional Response by Method",
    description: "Return different responses based on HTTP method",
    code: `// Handle different HTTP methods
if (request.method === "POST") {
  return {
    status: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Resource created" })
  };
} else if (request.method === "GET") {
  return {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Hello from webhook!" })
  };
} else {
  return {
    status: 405,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: "Method not allowed" })
  };
}`,
  },
  {
    title: "Parse JSON and Transform",
    description: "Parse incoming JSON body and respond with processed data",
    code: `// Parse and process JSON body
try {
  const data = JSON.parse(request.body || "{}");
  return {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      success: true,
      receivedKeys: Object.keys(data),
      processedAt: new Date().toISOString()
    })
  };
} catch (e) {
  return {
    status: 400,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: "Invalid JSON body" })
  };
}`,
  },
];
