#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { GitHubClient } from "./githubClient.js";
import { collectMetrics } from "./metrics.js";
import { scoreMetrics } from "./scorer.js";

const program = new Command();

program
  .name("repo-health")
  .description("Score a public GitHub repository's health based on commit frequency, issue response time, and PR merge time.")
  .argument("<owner/repo>", 'Repository to analyze, e.g. "facebook/react"')
  .option("--json", "output raw JSON instead of a formatted report")
  .action(async (ownerRepo, options) => {
    const [owner, repo] = ownerRepo.split("/");
    if (!owner || !repo) {
      console.error(chalk.red('Expected format "owner/repo", e.g. facebook/react'));
      process.exit(1);
    }

    const client = new GitHubClient();

    try {
      const metrics = await collectMetrics(client, owner, repo);
      const scores = scoreMetrics(metrics);

      if (options.json) {
        console.log(JSON.stringify({ metrics, scores }, null, 2));
        return;
      }

      printReport(metrics, scores);
    } catch (err) {
      console.error(chalk.red(`\nError: ${err.message}\n`));
      process.exit(1);
    }
  });

function printReport(metrics, scores) {
  const { repo } = metrics;

  console.log();
  console.log(chalk.bold.cyan(`  ${repo.fullName}`));
  console.log(chalk.gray(`  ${repo.stars} stars  ·  ${repo.openIssues} open issues  ·  last push ${formatDate(repo.pushedAt)}`));
  console.log();

  const table = new Table({
    head: [chalk.bold("Metric"), chalk.bold("Value"), chalk.bold("Score")],
    colWidths: [26, 32, 10],
  });

  table.push(
    [
      "Commit frequency",
      `${metrics.commits.commitsLast30Days} commits in last 30 days`,
      scoreCell(scores.commitScore),
    ],
    [
      "Issue response time",
      formatHours(metrics.issues.avgFirstResponseHours, metrics.issues.sampledIssues),
      scoreCell(scores.responseScore),
    ],
    [
      "PR merge time",
      formatHours(metrics.prs.avgMergeHours, metrics.prs.sampledPRs, "PRs"),
      scoreCell(scores.mergeScore),
    ]
  );

  console.log(table.toString());
  console.log();

  const overallColor = colorFor(scores.overall);
  console.log(
    `  ${chalk.bold("Overall health:")} ${overallColor(String(scores.overall ?? "N/A"))}/100  ${chalk.bold(overallColor(scores.label))}`
  );
  console.log();
}

function formatHours(avgHours, sampleCount, unit = "issues") {
  if (avgHours === null) return `no data (0 ${unit} sampled)`;
  const days = avgHours / 24;
  const display = days >= 1 ? `${days.toFixed(1)} days` : `${avgHours.toFixed(1)} hrs`;
  return `${display} avg (${sampleCount} ${unit} sampled)`;
}

function formatDate(iso) {
  if (!iso) return "unknown";
  return new Date(iso).toISOString().slice(0, 10);
}

function scoreCell(score) {
  if (score === null) return chalk.gray("N/A");
  return colorFor(score)(String(score));
}

function colorFor(score) {
  if (score === null) return chalk.gray;
  if (score >= 80) return chalk.green;
  if (score >= 60) return chalk.yellowBright;
  if (score >= 40) return chalk.yellow;
  return chalk.red;
}

program.parseAsync(process.argv);
