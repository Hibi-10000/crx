"use strict";

import fs from "node:fs";
import { join } from "node:path";
import crypto from "node:crypto";
import archiver from "archiver";
import resolve from "./resolver.js";
import crx2 from "./crx2.js";
import crx3 from "./crx3.js";

const DEFAULTS = {
  appId: null,
  rootDirectory: "",
  publicKey: null,
  privateKey: null,
  codebase: null,
  path: null,
  src: "**",
  ignore: ["*.crx"],
  version: 3,
};

class ChromeExtension {
  constructor(attrs) {
    // Setup defaults
    Object.assign(this, DEFAULTS, attrs);

    this.loaded = false;
  }

  /**
   * Packs the content of the extension in a crx file.
   *
   * @param {Buffer=} contentsBuffer
   * @returns {Promise}
   * @example
   *
   * crx.pack().then(function(crxContent){
   *  // do something with the crxContent binary data
   * });
   *
   */
  async pack(contentsBuffer) {
    if (!this.loaded) {
      return this.load().then(this.pack.bind(this, contentsBuffer));
    }

    const publicKey = await this.generatePublicKey();
    const contents = contentsBuffer || await this.loadContents();

    this.publicKey = publicKey;

    if (this.version === 2) {
      return crx2(this.privateKey, publicKey, contents);
    }

    return crx3(this.privateKey, publicKey, contents);
  }

  /**
   * Loads extension manifest and copies its content to a workable path.
   *
   * @param {string=} path
   * @returns {Promise}
   */
  async load(path) {
    const metadata = await resolve(path || this.rootDirectory);
    this.path = metadata.path;
    this.src = metadata.src;

    const manifestPath = join(this.path, "manifest.json");

    this.manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    this.loaded = true;

    return this;
  }

  /**
   * Generates a public key.
   *
   * BC BREAK `this.publicKey` is not stored anymore (since 1.0.0)
   * BC BREAK callback parameter has been removed in favor to the promise interface.
   *
   * @returns {Promise} Resolves to {Buffer} containing the public key
   * @example
   *
   * crx.generatePublicKey(function(publicKey){
   *   // do something with publicKey
   * });
   */
  generatePublicKey() {
    const privateKey = this.privateKey;

    return new Promise((resolve, reject) => {
      if (!privateKey) {
        return reject(
          "Impossible to generate a public key: privateKey option has not been defined or is empty.",
        );
      }

      const key = crypto.createPublicKey(privateKey);

      resolve(key.export({ type: "spki", format: "der" }));
    });
  }

  /**
   *
   * BC BREAK `this.contents` is not stored anymore (since 1.0.0)
   *
   * @returns {Promise}
   */
  loadContents() {
    const selfie = this;

    return new Promise((resolve, reject) => {
      const archive = archiver("zip", { zlib: { level: 9 } });
      let contents = Buffer.from("");

      if (!selfie.loaded) {
        throw new Error(
          "crx.load needs to be called first in order to prepare the workspace.",
        );
      }

      archive.on("error", reject);

      /*
        TODO: Remove in v4.
        It will be better to resolve an archive object
        rather than fitting everything in memory.

        @see https://github.com/oncletom/crx/issues/61
      */
      archive.on("data", (buf) => {
        contents = Buffer.concat([contents, buf]);
      });

      archive.on("finish", () => {
        resolve(contents);
      });

      archive
        .glob(selfie.src, {
          cwd: selfie.path,
          matchBase: true,
          ignore: ["*.pem", ".git"].concat(selfie.ignore),
        })
        .finalize();
    });
  }

  /**
   * Generates an appId from the publicKey.
   * Public key has to be set for this to work, otherwise an error is thrown.
   *
   * BC BREAK `this.appId` is not stored anymore (since 1.0.0)
   * BC BREAK introduced `publicKey` parameter as it is not stored any more since 2.0.0
   *
   * @param {Buffer|string} [publicKey] the public key to use to generate the app ID
   * @returns {string}
   */
  generateAppId(keyOrPath) {
    keyOrPath = keyOrPath || this.publicKey;

    if (typeof keyOrPath !== "string" && !(keyOrPath instanceof Buffer)) {
      throw new Error("Public key is neither set, nor given");
    }

    // Handling Windows Path
    // Possibly to be moved in a different method
    if (typeof keyOrPath === "string") {
      const charCode = keyOrPath.charCodeAt(0);

      // 65 (A) < charCode < 122 (z)
      if (charCode >= 65 && charCode <= 122 && keyOrPath[1] === ":") {
        keyOrPath = keyOrPath[0].toUpperCase() + keyOrPath.slice(1);

        keyOrPath = Buffer.from(keyOrPath, "utf-16le");
      }
    }

    return crypto
      .createHash("sha256")
      .update(keyOrPath)
      .digest()
      .toString("hex")
      .split("")
      .map(x => (parseInt(x, 16) + 0x0a).toString(26))
      .join("")
      .slice(0, 32);
  }

  /**
   * Generates an updateXML file from the extension content.
   *
   * If manifest does not include `minimum_chrome_version`, defaults to:
   * - '29.0.0' for CRX2, which is earliest extensions API available
   * - '64.0.3242' for CRX3, which is when Chrome etension packager switched to CRX3
   *
   * BC BREAK `this.updateXML` is not stored anymore (since 1.0.0)
   *
   * @see
   *   [Chrome Extensions APIs]{@link https://developer.chrome.com/extensions/api_index}
   * @see
   *   [Chrome verions]{@link https://en.wikipedia.org/wiki/Google_Chrome_version_history}
   * @see
   *   [Chromium switches to CRX3]{@link https://chromium.googlesource.com/chromium/src.git/+/b8bc9f99ef4ad6223dfdcafd924051561c05ac75}
   * @returns {Buffer}
   */
  generateUpdateXML() {
    if (!this.codebase) {
      throw new Error("No URL provided for update.xml.");
    }

    const browserVersion = this.manifest.minimum_chrome_version
      || (this.version < 3 && "29.0.0") // Earliest version with extensions API
      || "64.0.3242"; // Chrome started generating CRX3 packages

    return Buffer.from(`<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${this.appId || this.generateAppId()}'>
    <updatecheck codebase='${this.codebase}' version='${this.manifest.version}' prodversionmin='${browserVersion}' />
  </app>
</gupdate>`);
  }
}

export default ChromeExtension;
