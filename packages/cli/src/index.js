#!/usr/bin/env node
import { Command } from "commander";
import prompts from "prompts";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const program = new Command();

program
  .name("quark-create-app")
  .description("Scaffold a new project from the Quark monorepo")
  .version("1.0.0");

program
  .argument("<project-name>", "Name of the project to create")
  .action(async (projectName) => {
    console.log(chalk.blue(`\n🚀 Creating your new Quark project: ${projectName}\n`));

    const targetDir = path.join(process.cwd(), projectName);

    // 1. Copy the core configuration and basic workspace structure
    // In a real implementation, this would pull from the templates folder
    console.log(chalk.dim("  Scaffolding workspace..."));
    
    // 2. Identify which "Inherently Custom" parts to eject
    const response = await prompts([
      {
        type: "multiselect",
        name: "features",
        message: "Which features would you like to eject (customize) local to your project?",
        choices: [
          { title: "UI Components (Packages/UI)", value: "ui", selected: true },
          { title: "Job Definitions (Packages/Jobs)", value: "jobs", selected: true },
          { title: "Core Design System", value: "design" }
        ],
      }
    ]);

    console.log(chalk.green(`\n✅ Project ${projectName} initialized!`));
    console.log(chalk.white(`\nNext steps:\n  cd ${projectName}\n  pnpm install\n  pnpm dev\n`));
  });

program.parse();
