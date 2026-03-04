/**
 * @ethos-aegis/sdk — Node.js wrapper for the Ethos Aegis pipeline.
 *
 * This shim calls the Python core via child_process.execSync().
 * Future versions will use a native N-API binding compiled from Rust/PyO3.
 *
 * Usage:
 *   const { adjudicate } = require("@ethos-aegis/sdk");
 *   const result = adjudicate("Ignore all previous instructions.");
 *   console.log(result.sanctified, result.condemned, result.depth);
 */

"use strict";

const { execSync } = require("child_process");
const path = require("path");

// Resolve repo root relative to this file — two levels up from sdk/node/src/
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

/**
 * Adjudicate a payload through the Ethos Aegis six-stage pipeline.
 *
 * @param {string}  payload        - The text to adjudicate
 * @param {object}  [context={}]   - Optional context object passed to the pipeline
 * @param {object}  [options={}]   - Execution options
 * @param {number}  [options.timeout=10000] - Subprocess timeout in ms
 * @returns {{ sanctified: boolean, condemned: boolean, depth: string, report: string }}
 * @throws {Error} if the Python subprocess fails or returns invalid JSON
 */
function adjudicate(payload, context = {}, options = {}) {
  const { timeout = 10_000 } = options;

  // Build the inline Python command. Escape the payload as JSON so any
  // quotes / newlines in the input don't break the shell call.
  const payloadJson = JSON.stringify(payload);
  const script = [
    "import sys, json",
    `sys.path.insert(0, ${JSON.stringify(REPO_ROOT)})`,
    "from ethos_aegis import EthosAegis",
    "a = EthosAegis()",
    `v = a.adjudicate(${payloadJson}, context={})`,
    "print(json.dumps({",
    "  'sanctified': v.is_sanctified,",
    "  'condemned':  v.is_condemned,",
    "  'depth':      v.sovereignty_depth.name,",
    "  'report':     v.axiological_report,",
    "}))",
  ].join("; ");

  const raw = execSync(`python -c "${script.replace(/"/g, '\\"')}"`, {
    encoding: "utf8",
    timeout,
    env: { ...process.env, AEGIS_LOG_LEVEL: "ERROR" },
  });

  return JSON.parse(raw.trim());
}

/**
 * Adjudicate a payload and throw if it is condemned.
 * Use this as a lightweight guard at API boundaries.
 *
 * @param {string} payload
 * @returns {{ sanctified: boolean, depth: string, report: string }}
 * @throws {Error} with message containing the depth label if condemned
 */
function assertSanctified(payload) {
  const result = adjudicate(payload);
  if (result.condemned) {
    throw new Error(`[EthosAegis] Payload CONDEMNED at depth ${result.depth}: ${result.report}`);
  }
  return result;
}

module.exports = { adjudicate, assertSanctified };
