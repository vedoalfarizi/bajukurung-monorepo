#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DatabaseStack } from "../stacks/database";
import { StorageStack } from "../stacks/storage";

const app = new cdk.App();

const envName: string = app.node.tryGetContext("env") ?? "staging";

new DatabaseStack(app, `BajuKurungDatabase-${envName}`, {
  env_name: envName,
  stackName: `baju-kurung-database-${envName}`,
});

new StorageStack(app, `BajuKurungStorage-${envName}`, {
  env_name: envName,
  stackName: `baju-kurung-storage-${envName}`,
});
