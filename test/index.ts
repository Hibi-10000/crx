"use strict";

import fs from "node:fs";
import { join } from "node:path";
import Zip from "adm-zip";
import type { Test } from "tape";
import ChromeExtension from "../src/index.ts";

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
    await newCrx(opts).load().then((c) => t.pass(/*JSON.stringify*/String(c)));

    // Test relative path
    await newCrx().load("./test/myFirstExtension").then((crx) => {
      t.ok(crx);
    });

    // Test absolute path
    await newCrx().load(join(import.meta.dirname, "myFirstExtension")).then((crx) => {
      t.ok(crx);
    });

    // Test list of files
    const fileList = [
      "test/myFirstExtension/manifest.json",
      "test/myFirstExtension/icon.png",
    ];

    await newCrx(opts).load(fileList).then((crx) => {
      t.ok(crx);
    });

    const fileList2 = [
      "test/myFirstExtension/icon.png",
    ];

    await newCrx(opts).load(fileList2).catch((err) => {
      t.ok(err);
    });

    //@ts-expect-error
    await newCrx(opts).load(Buffer.from("")).catch((err) => {
      t.ok(err);
    });
  },

  pack: async (t, opts) => {
    const crx = newCrx(opts);
    await crx.pack().then((packageData) => {
      t.ok(packageData instanceof Buffer);
    });
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

    await crx.load().then(() => {
      return crx.loadContents();
    })
      .then((packageData) => {
        const entries = new Zip(packageData)
          .getEntries()
          .map((entry) => {
            return entry.entryName;
          });

        t.deepEqual(entries, ["manifest.json"]);
      });
  },

  loadContents: async (t, opts) => {
    await newCrx(opts).loadContents().catch((err) => {
      t.ok(err instanceof Error);
    });

    const crx = newCrx(opts);

    await crx.load().then(() => {
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
      });
  },

  generateUpdateXML: async (t, opts) => {
    t.throws(() => new ChromeExtension({}).generateUpdateXML(), "No URL provided for update.xml");

    const crx = newCrx(opts);
    const expected = crx.version === 2 ? updateXml2 : updateXml3;

    await crx.pack().then(() => {
      const xmlBuffer = crx.generateUpdateXML();

      t.equals(xmlBuffer.toString(), expected.toString());
    });

    const crxCustom = newCrx(opts);
    await crxCustom.load().then(async () => {
      crxCustom.manifest.minimum_chrome_version = "99.99.99-crxtest";
      await crxCustom.pack().then(() => {
        const xmlBuffer = crxCustom.generateUpdateXML();

        t.equals(xmlBuffer.toString(), updateXmlCustom.toString());
      });
    });
  },

  generatePublicKey: async (t, opts) => {
    const crx = newCrx(opts);
    //@ts-expect-error
    crx.privateKey = null;

    await crx.generatePublicKey().catch((err) => {
      t.ok(err);
    });

    await newCrx(opts).generatePublicKey().then((publicKey) => {
      t.equals(publicKey.length, 162);
    });
  },

  generateAppId: async (t, opts) => {
    t.throws(() => {
      newCrx(opts).generateAppId();
    }, /Public key is neither set, nor given/);

    const crx = newCrx(opts);

    // from Public Key
    await crx.generatePublicKey().then((publicKey) => {
      t.equals(crx.generateAppId(publicKey), "eoilidhiokfphdhpmhoaengdkehanjif");
    });

    // from Linux Path
    t.equals(crx.generateAppId("/usr/local/extension"), "ioglhmppkolgcgoonkfdbjkcedfjhbcd");

    // from Windows Path
    t.equals(crx.generateAppId("c:\\a"), "igchicfaapedlfgmepccnpolhajaphik");
  },

  "end to end": async (t, opts) => {
    const crx = newCrx(opts);

    await crx.load()
      .then((crx) => {
        return crx.pack();
      })
      .then(async (crxBuffer) => {
        await fs.promises.writeFile("build.crx", crxBuffer);
        await fs.promises.writeFile("update.xml", crx.generateUpdateXML());
      });
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
