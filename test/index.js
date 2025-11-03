"use strict";

import fs from "node:fs";
import { join } from "node:path";
import Zip from "adm-zip";
import ChromeExtension from "../src/index.js";

const privateKey = fs.readFileSync(join(import.meta.dirname, "key.pem"));
const updateXml2 = fs.readFileSync(join(import.meta.dirname, "expectations", "updateCRX2.xml"));
const updateXml3 = fs.readFileSync(join(import.meta.dirname, "expectations", "updateCRX3.xml"));
const updateXmlCustom = fs.readFileSync(join(import.meta.dirname, "expectations", "updateProdVersionMin.xml"));

/** @type {(opts?: { version: number }) => ChromeExtension} */
function newCrx(opts) {
  return new ChromeExtension(Object.assign({
    privateKey: privateKey,
    path: "/tmp",
    codebase: "http://localhost:8000/myFirstExtension.crx",
    rootDirectory: join(import.meta.dirname, "myFirstExtension"),
  }, opts));
}

/** @type {Record<string, (t: import("tape").Test, opts?: { version: number }) => Promise<void>>} */
export const TESTS = {
  ChromeExtension: (t, opts) => {
    t.plan(2);

    t.throws(() => ChromeExtension({}));
    t.ok(newCrx(opts));
  },

  load: (t, opts) => {
    t.plan(6);

    newCrx(opts).load().then(c => t.pass(/*JSON.stringify*/(c)));

    // Test relative path
    newCrx().load("./test/myFirstExtension").then((crx) => {
      t.ok(crx);
    }).catch(t.error.bind(t));

    // Test absolute path
    newCrx().load(join(import.meta.dirname, "myFirstExtension")).then((crx) => {
      t.ok(crx);
    }).catch(t.error.bind(t));

    // Test list of files
    const fileList = [
      "test/myFirstExtension/manifest.json",
      "test/myFirstExtension/icon.png",
    ];

    newCrx(opts).load(fileList).then((crx) => {
      t.ok(crx);
    });

    const fileList2 = [
      "test/myFirstExtension/icon.png",
    ];

    newCrx(opts).load(fileList2).catch((err) => {
      t.ok(err);
    });

    newCrx(opts).load(Buffer.from("")).catch((err) => {
      t.ok(err);
    });
  },

  pack: (t, opts) => {
    t.plan(1);

    const crx = newCrx(opts);
    crx.pack().then((packageData) => {
      t.ok(packageData instanceof Buffer);
    })
      .catch(t.error.bind(t));
  },

  writeFile: (t, opts) => {
    t.plan(1);

    const crx = newCrx(opts);

    t.throws(() => crx.writeFile("/tmp/crx"));
  },

  ignoreFiles: (t, opts) => {
    t.plan(1);

    const crx = newCrx(Object.assign({
      ignore: ["*.png"],
    }, opts));

    crx.load().then(() => {
      return crx.loadContents();
    })
      .then((packageData) => {
        const entries = new Zip(packageData)
          .getEntries()
          .map((entry) => {
            return entry.entryName;
          });

        t.deepEqual(entries, ["manifest.json"]);
      })
      .catch(t.error.bind(t));
  },

  loadContents: (t, opts) => {
    t.plan(3);

    newCrx(opts).loadContents().catch((err) => {
      t.ok(err instanceof Error);
    });

    const crx = newCrx(opts);

    crx.load().then(() => {
      return crx.loadContents();
    })
      .then((contentsBuffer) => {
        t.ok(contentsBuffer instanceof Buffer);

        return contentsBuffer;
      })
      .then((packageData) => {
        const entries = new Zip(packageData)
          .getEntries()
          .map((entry) => {
            return entry.entryName;
          })
          .sort((a, b) => {
            return a.localeCompare(b);
          });

        t.deepEqual(entries, ["icon.png", "manifest.json"]);

        return packageData;
      })
      .catch(t.error.bind(t));
  },

  generateUpdateXML: (t, opts) => {
    t.plan(3);

    t.throws(() => new ChromeExtension({}).generateUpdateXML(), "No URL provided for update.xml");

    const crx = newCrx(opts);
    const expected = crx.version === 2 ? updateXml2 : updateXml3;

    crx.pack().then(() => {
      const xmlBuffer = crx.generateUpdateXML();

      t.equals(xmlBuffer.toString(), expected.toString());
    })
      .catch(t.error.bind(t));

    const crxCustom = newCrx(opts);
    crxCustom.load().then(() => {
      crxCustom.manifest.minimum_chrome_version = "99.99.99-crxtest";
      crxCustom.pack().then(() => {
        const xmlBuffer = crxCustom.generateUpdateXML();

        t.equals(xmlBuffer.toString(), updateXmlCustom.toString());
      })
        .catch(t.error.bind(t));
    });
  },

  generatePublicKey: (t, opts) => {
    t.plan(2);

    const crx = newCrx(opts);
    crx.privateKey = null;

    crx.generatePublicKey().catch((err) => {
      t.ok(err);
    });

    newCrx(opts).generatePublicKey().then((publicKey) => {
      t.equals(publicKey.length, 162);
    });
  },

  generateAppId: (t, opts) => {
    t.plan(4);

    t.throws(() => {
      newCrx(opts).generateAppId();
    }, /Public key is neither set, nor given/);

    const crx = newCrx(opts);

    // from Public Key
    crx.generatePublicKey().then((publicKey) => {
      t.equals(crx.generateAppId(publicKey), "eoilidhiokfphdhpmhoaengdkehanjif");
    })
      .catch(t.error.bind(t));

    // from Linux Path
    t.equals(crx.generateAppId("/usr/local/extension"), "ioglhmppkolgcgoonkfdbjkcedfjhbcd");

    // from Windows Path
    t.equals(crx.generateAppId("c:\\a"), "igchicfaapedlfgmepccnpolhajaphik");
  },

  "end to end": (t, opts) => {
    const crx = newCrx(opts);

    crx.load()
      .then((crx) => {
        return crx.pack();
      })
      .then(async (crxBuffer) => {
        await fs.promises.writeFile("build.crx", crxBuffer);
        await fs.promises.writeFile("update.xml", crx.generateUpdateXML());
      })
      .then(t.end);
  },
};

// Setup list of different configurations to test
// Each key is the test name prefix.
// Each value is an options obect to be passed to test implementation.
export const TEST_OPTIONS = {
  "": undefined, // use defaults
  v2: { version: 2 },
  v3: { version: 3 },
};
