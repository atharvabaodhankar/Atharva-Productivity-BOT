// Entrypoint proxy for AWS Lambda pointing to modular src/handlers/lambda.js
const { handler } = require("./src/handlers/lambda");

exports.handler = handler;
