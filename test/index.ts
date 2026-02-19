"use strict";

import fs from "node:fs";
import { join } from "node:path";
import Zip from "adm-zip";
import ChromeExtension from "../src/index.ts";
import type { TestContextAssert } from "node:test";

export interface Test {
  throws: TestContextAssert["throws"];
  ok: (...args: Parameters<TestContextAssert["ok"]>) => void;
  pass: (msg?: string) => void;
  deepEqual: TestContextAssert["deepEqual"];
  equals: TestContextAssert["equal"];
  rejects: TestContextAssert["rejects"];
}

const privateKey = fs.readFileSync(join(import.meta.dirname, "key.pem"));
const updateXml2 = fs.readFileSync(join(import.meta.dirname, "expectations", "updateCRX2.xml"));
const updateXml3 = fs.readFileSync(join(import.meta.dirname, "expectations", "updateCRX3.xml"));
const updateXmlCustom = fs.readFileSync(join(import.meta.dirname, "expectations", "updateProdVersionMin.xml"));

function newCrx(opts?: ConstructorParameters<typeof ChromeExtension>[0]): ChromeExtension {
  return new ChromeExtension({
    privateKey: privateKey,
    path: "/tmp",
    codebase: "http://localhost:8000/myFirstExtension.crx",
    rootDirectory: join(import.meta.dirname, "myFirstExtension"),
    ...opts,
  });
}

export const TESTS: Record<string, (t: Test, opts: { version: 2 | 3 } | undefined) => void | Promise<void>> = {
  ChromeExtension: (t, opts) => {
    //@ts-expect-error
    t.throws(() => ChromeExtension({}));
    t.ok(newCrx(opts));
  },

  load: async (t, opts) => {
    t.pass(/*JSON.stringify*/(await newCrx(opts).load()).toString());

    // Test relative path
    t.ok(await newCrx().load("./test/myFirstExtension"));

    // Test absolute path
    t.ok(await newCrx().load(join(import.meta.dirname, "myFirstExtension")));

    // Test list of files
    const fileList = [
      "test/myFirstExtension/manifest.json",
      "test/myFirstExtension/icon.png",
    ];

    t.ok(await newCrx(opts).load(fileList));

    const fileList2 = [
      "test/myFirstExtension/icon.png",
    ];

    await t.rejects(async () => await newCrx(opts).load(fileList2));

    //@ts-expect-error
    await t.rejects(async () => await newCrx(opts).load(Buffer.from("")));
  },

  pack: async (t, opts) => {
    const crx = newCrx(opts);
    const packageData = await crx.pack();
    t.ok(packageData instanceof Buffer);
  },

  writeFile: (t, opts) => {
    const crx = newCrx(opts);

    //@ts-expect-error
    t.throws(() => crx.writeFile("/tmp/crx"));
  },

  ignoreFiles: async (t, opts) => {
    const crx = newCrx({
      ignore: ["*.png"],
      ...opts,
    });

    await crx.load();
    const packageData = await crx.loadContents();
    const entries = new Zip(packageData)
      .getEntries()
      .map((entry) => {
        return entry.entryName;
      });

    t.deepEqual(entries, ["manifest.json"]);
  },

  loadContents: async (t, opts) => {
    await t.rejects(async () => await newCrx(opts).loadContents(), (err) => err instanceof Error);

    const crx = newCrx(opts);

    await crx.load();
    const contentsBuffer = await crx.loadContents();
    t.ok(contentsBuffer instanceof Buffer);
    const packageData = contentsBuffer;
    const entries = new Zip(packageData)
      .getEntries()
      .map((entry) => {
        return entry.entryName;
      })
      .sort((a, b) => {
        return a.localeCompare(b);
      });

    t.deepEqual(entries, ["icon.png", "manifest.json"]);
  },

  generateUpdateXML: async (t, opts) => {
    t.throws(() => new ChromeExtension({}).generateUpdateXML(), "No URL provided for update.xml");

    const crx = newCrx(opts);
    const expected = crx.version === 2 ? updateXml2 : updateXml3;

    await crx.pack();
    const xmlBuffer = crx.generateUpdateXML();

    t.equals(xmlBuffer.toString(), expected.toString());

    const crxCustom = newCrx(opts);
    await crxCustom.load();
    crxCustom.manifest.minimum_chrome_version = "99.99.99-crxtest";
    await crxCustom.pack();
    const xmlBufferCustom = crxCustom.generateUpdateXML();

    t.equals(xmlBufferCustom.toString(), updateXmlCustom.toString());
  },

  generatePublicKey: async (t, opts) => {
    const crx = newCrx(opts);
    //@ts-expect-error
    crx.privateKey = null;

    await t.rejects(async () => await crx.generatePublicKey());

    const publicKey = await newCrx(opts).generatePublicKey();
    t.equals(publicKey.length, 162);
  },

  generateAppId: async (t, opts) => {
    t.throws(() => {
      newCrx(opts).generateAppId();
    }, /Public key is neither set, nor given/);

    const crx = newCrx(opts);

    // from Public Key
    const publicKey = await crx.generatePublicKey();
    t.equals(crx.generateAppId(publicKey), "eoilidhiokfphdhpmhoaengdkehanjif");

    // from Linux Path
    t.equals(crx.generateAppId("/usr/local/extension"), "ioglhmppkolgcgoonkfdbjkcedfjhbcd");

    // from Windows Path
    t.equals(crx.generateAppId("c:\\a"), "igchicfaapedlfgmepccnpolhajaphik");
  },

  "end to end": async (t, opts) => {
    const crx = newCrx(opts);

    const loadedCrx = await crx.load();
    const crxBuffer = await loadedCrx.pack();
    await fs.promises.writeFile("build.crx", crxBuffer);
    await fs.promises.writeFile("update.xml", loadedCrx.generateUpdateXML());
  },
};

// Setup list of different configurations to test
// Each key is the test name prefix.
// Each value is an options obect to be passed to test implementation.
export const TEST_OPTIONS = {
  "": undefined, // use defaults
  v2: { version: 2 },
  v3: { version: 3 },
} as const;
