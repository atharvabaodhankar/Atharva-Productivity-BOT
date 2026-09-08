const {
  CreateTableCommand,
  DescribeTableCommand,
} = require("@aws-sdk/client-dynamodb");
const { rawClient, TABLE_NAME, REGION } = require("../src/config/dynamoClient");

async function setupDynamoTable() {
  console.log(`Checking table "${TABLE_NAME}" in region "${REGION}"...`);

  try {
    const describe = await rawClient.send(
      new DescribeTableCommand({ TableName: TABLE_NAME })
    );
    console.log(`✅ Table "${TABLE_NAME}" already exists. Status: ${describe.Table.TableStatus}`);
    return;
  } catch (err) {
    if (err.name !== "ResourceNotFoundException") {
      console.error("Error describing table:", err);
      throw err;
    }
  }

  console.log(`Creating table "${TABLE_NAME}" with 5 RCU / 5 WCU (Always Free Tier)...`);

  const params = {
    TableName: TABLE_NAME,
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
      { AttributeName: "GSI1PK", AttributeType: "S" },
      { AttributeName: "GSI1SK", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "GSI1",
        KeySchema: [
          { AttributeName: "GSI1PK", KeyType: "HASH" },
          { AttributeName: "GSI1SK", KeyType: "RANGE" },
        ],
        Projection: {
          ProjectionType: "ALL",
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    BillingMode: "PROVISIONED",
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  };

  try {
    const res = await rawClient.send(new CreateTableCommand(params));
    console.log(`✅ Table creation initiated: ${res.TableDescription.TableStatus}`);
    console.log("Waiting for table to become ACTIVE...");

    let status = res.TableDescription.TableStatus;
    while (status !== "ACTIVE") {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const desc = await rawClient.send(
        new DescribeTableCommand({ TableName: TABLE_NAME })
      );
      status = desc.Table.TableStatus;
      console.log(`Current status: ${status}`);
    }
    console.log(`🎉 DynamoDB Table "${TABLE_NAME}" is now ACTIVE and ready!`);
  } catch (err) {
    console.error("Failed to create DynamoDB table:", err.message);
    throw err;
  }
}

if (require.main === module) {
  setupDynamoTable()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { setupDynamoTable };
