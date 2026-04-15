#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DatabaseStack } from "../stacks/database";
import { StorageStack } from "../stacks/storage";
import { IamStack } from "../stacks/iam";
import { LoggingStack } from "../stacks/logging";

const app = new cdk.App();

const envName: string = app.node.tryGetContext("env") ?? "staging";

const databaseStack = new DatabaseStack(app, `BajuKurungDatabase-${envName}`, {
  env_name: envName,
  stackName: `baju-kurung-database-${envName}`,
});

const storageStack = new StorageStack(app, `BajuKurungStorage-${envName}`, {
  env_name: envName,
  stackName: `baju-kurung-storage-${envName}`,
});

new IamStack(app, `BajuKurungIam-${envName}`, {
  env_name: envName,
  stackName: `baju-kurung-iam-${envName}`,
  tableArn: databaseStack.table.tableArn,
  imagesBucketArn: storageStack.imagesBucket.bucketArn,
});

new LoggingStack(app, `BajuKurungLogging-${envName}`, {
  env_name: envName,
  stackName: `baju-kurung-logging-${envName}`,
});
