#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

import { program } from "commander";
import ChromeExtension from "./index.js";

const pkg = JSON.parse(fs.readFileSync("../package.json", "utf8"));

const cwd = process.cwd();

program.version(pkg.version);
// coming soon
// .option("-x, --xml", "output autoupdate xml instead of extension ")

/** @typedef { import("./index") } BrowserExtension */

/**
 * @typedef {Object} InterfaceCli
 * @property {number=} crxVersion
 * @property {boolean} force
 * @property {string} privateKey
 * @property {string=} output
 * @property {string=} zipOutput
 * @property {number=} maxBuffer
 */

program
  .command("keygen [directory]")
  .option("--force", "overwrite the private key if it exists")
  .option(
    "-c, --crx-version [number]",
    "CRX format version, can be either 2 or 3, defaults to 3",
    parseInt,
  )
  .description("generate a private key in [directory]/key.pem")
  .action(keygen);

program
  .command("pack [directory]")
  .description("pack [directory] into a .crx extension")
  .option(
    "-o, --output <file>",
    "write the crx content to <file> instead of stdout",
  )
  .option("--zip-output <file>", "write the zip content to <file>")
  .option(
    "-p, --private-key <file>",
    "relative path to private key [key.pem], defaults to [directory/../key.pem]")
  .option(
    "-b, --max-buffer <total>",
    "max amount of memory allowed to generate the crx, in byte",
  )
  .option(
    "-c, --crx-version [number]",
    "CRX format version, can be either 2 or 3, defaults to 3",
    parseInt,
  )
  .action(pack);

/** @type {InterfaceCli} */
program.parse(process.argv);

/**
 * Generate a new key file
 * @param {String} keyPath path of the key file to create
 * @param {InterfaceCli} opts
 * @returns {Promise<void>}
 */
function generateKeyFile(keyPath, opts) {
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "der",
    },
    privateKeyEncoding: {
      // Chromium (tested on 72.0.3626.109) which generates CRX v3 files requires pkcs8 key
      type: `pkcs${opts.crxVersion === 2 ? "1" : "8"}`,
      format: "pem",
    },
  });
  return fs.promises.writeFile(keyPath, privateKey);
}

/**
 * Generates a Private Key
 *
 * @param {string} dir
 * @param {InterfaceCli} opts
 */
function keygen(dir, opts) {
  dir = dir ? path.resolve(cwd, dir) : cwd;

  const keyPath = path.join(dir, "key.pem");

  try {
    fs.accessSync(keyPath);
    if (!opts.force) {
      throw new Error("key.pem already exists in the given location.");
    }
  }
  catch (_err) {
    generateKeyFile(keyPath, opts);
  }
}

/**
 * @param {string} dir
 * @param {InterfaceCli} opts
 */
function pack(dir, opts) {
  const input = dir ? path.resolve(cwd, dir) : cwd;
  const keyPath = opts.privateKey
    ? path.resolve(cwd, opts.privateKey)
    : path.join(input, "..", "key.pem");
  let output;

  if (opts.output) {
    if (path.extname(opts.output) !== ".crx") {
      throw new Error(
        `-o file is expected to have a \`.crx\` suffix: [${opts.output}] was given.`,
      );
    }
  }

  if (opts.zipOutput) {
    if (path.extname(opts.zipOutput) !== ".zip") {
      throw new Error(
        `--zip-output file is expected to have a \`.zip\` suffix: [${opts.zipOutput}] was given.`,
      );
    }
  }

  const crx = new ChromeExtension({
    rootDirectory: input,
    maxBuffer: opts.maxBuffer,
    version: opts.crxVersion || 3,
  });

  fs.promises.readFile(keyPath)
    .then(null, async (err) => {
      // If the key file doesn't exist, create one
      if (err.code === "ENOENT") {
        await generateKeyFile(keyPath, opts);
        process.stderr.write(`Created new private key at: ${keyPath}.\n`);
        return fs.readFileSync(keyPath);
      }
      else {
        throw err;
      }
    })
    .then((key) => {
      crx.privateKey = key;
    })
    .then(() => {
      crx
        .load()
        .then(() => crx.loadContents())
        .then((fileBuffer) => {
          if (opts.zipOutput) {
            const outFile = path.resolve(cwd, opts.zipOutput);

            fs.createWriteStream(outFile).end(fileBuffer);
          }
          else {
            return crx.pack(fileBuffer);
          }
        })
        .then((crxBuffer) => {
          if (opts.zipOutput) {
            return;
          }
          else if (opts.output) {
            output = opts.output;
          }
          else {
            output = `${path.basename(cwd)}.crx`;
          }

          const outFile = path.resolve(cwd, output);
          if (outFile) {
            fs.createWriteStream(outFile).end(crxBuffer);
          }
          else {
            process.stdout.end(crxBuffer);
          }
        });
    });
}

export default program;
