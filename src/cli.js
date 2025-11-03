#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs";
import rsa from "node-rsa";

import { program } from "commander";
import ChromeExtension from "./index.js";

const pkg = JSON.parse(fs.readFileSync("../package.json", "utf8"));

const cwd = process.cwd();

program.version(pkg.version);
// coming soon
// .option("-x, --xml", "output autoupdate xml instead of extension ")

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

program.parse(process.argv);

/**
 * Generate a new key file
 * @param {String} keyPath path of the key file to create
 * @param {Object} opts
 * @returns {Promise}
 */
function generateKeyFile(keyPath, opts) {
  // Chromium (tested on 72.0.3626.109) which generates CRX v3 files requires pkcs8 key
  const pkcs = `pkcs${opts.crxVersion === 2 ? "1" : "8"}-private-pem`;

  const keyVal = new rsa({ b: 2048 }).exportKey(pkcs);
  return fs.writeFileSync(keyPath, keyVal);
}

function keygen(dir, options) {
  dir = dir ? path.resolve(cwd, dir) : cwd;

  const keyPath = path.join(dir, "key.pem");

  try {
    fs.accessSync(keyPath);
    if (!options.force) {
      throw new Error("key.pem already exists in the given location.");
    }
  }
  catch (_err) {
    generateKeyFile(keyPath, options);
  }
}

function pack(dir, options) {
  const input = dir ? path.resolve(cwd, dir) : cwd;
  const keyPath = options.privateKey
    ? path.resolve(cwd, options.privateKey)
    : path.join(input, "..", "key.pem");
  let output;

  if (options.output) {
    if (path.extname(options.output) !== ".crx") {
      throw new Error(
        `-o file is expected to have a \`.crx\` suffix: [${options.output}] was given.`,
      );
    }
  }

  if (options.zipOutput) {
    if (path.extname(options.zipOutput) !== ".zip") {
      throw new Error(
        `--zip-output file is expected to have a \`.zip\` suffix: [${options.zipOutput}] was given.`,
      );
    }
  }

  const crx = new ChromeExtension({
    rootDirectory: input,
    maxBuffer: options.maxBuffer,
    version: options.crxVersion || 3,
  });

  fs.promises.readFile(keyPath)
    .then(null, async (err) => {
      // If the key file doesn't exist, create one
      if (err.code === "ENOENT") {
        await generateKeyFile(keyPath, options);
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
          if (options.zipOutput) {
            const outFile = path.resolve(cwd, options.zipOutput);

            fs.createWriteStream(outFile).end(fileBuffer);
          }
          else {
            return crx.pack(fileBuffer);
          }
        })
        .then((crxBuffer) => {
          if (options.zipOutput) {
            return;
          }
          else if (options.output) {
            output = options.output;
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
