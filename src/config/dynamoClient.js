const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
require("dotenv").config();

const region =
  process.env.DYNAMO_AWS_REGION ||
  process.env.AWS_REGION ||
  "ap-south-1";

const tableName =
  process.env.DYNAMO_TABLE_NAME ||
  "AtharvaOS-Production";

// Support dedicated DYNAMO credentials if provided, or fallback to standard AWS credentials locally
const accessKeyId =
  process.env.DYNAMO_AWS_ACCESS_KEY_ID ||
  process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey =
  process.env.DYNAMO_AWS_SECRET_ACCESS_KEY ||
  process.env.AWS_SECRET_ACCESS_KEY;

const clientConfig = { region };

// Only attach explicit credentials if they exist (local development)
// In AWS Lambda, ambient IAM execution role will authenticate automatically
if (accessKeyId && secretAccessKey) {
  clientConfig.credentials = {
    accessKeyId,
    secretAccessKey,
  };
}

const rawClient = new DynamoDBClient(clientConfig);

const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

module.exports = {
  rawClient,
  docClient,
  TABLE_NAME: tableName,
  REGION: region,
};
