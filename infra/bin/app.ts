#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DatabaseStack } from "../stacks/database";

const app = new cdk.App();

const envName: string = app.node.tryGetContext("env") ?? "staging";

new DatabaseStack(app, `BajuKurungDatabase-${envName}`, {
  env_name: envName,
  stackName: `baju-kurung-database-${envName}`,
});
