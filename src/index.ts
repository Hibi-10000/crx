"use strict";

import fs from "node:fs";
import { join } from "node:path";
import crypto from "node:crypto";
import archiver from "archiver";
import resolve from "./resolver.ts";
import crx2 from "./crx2.ts";
import crx3 from "./crx3.ts";

/** @enum {number} CrxVersion */
export const CrxVersion = {
  VERSION_2: 2,
  VERSION_3: 3,
} as const;

interface BrowserManifest {
  minimum_chrome_version?: string;
  version: string;
}

type BrowserExtensionOptions = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  [K in keyof Omit<ChromeExtension, "loaded"> as ChromeExtension[K] extends Function ? never : K]?: ChromeExtension[K];
};

class ChromeExtension {
  appId?: string;
  rootDirectory: string = "";
  publicKey?: Buffer;
  privateKey?: crypto.KeyLike;
  codebase?: string;
  path?: string;
  src: string = "**";
  ignore: string[] = ["*.crx"];
  version: number = CrxVersion.VERSION_3;
  loaded: boolean;
  manifest?: BrowserManifest;

  constructor(attrs: BrowserExtensionOptions) {
    Object.assign(this, attrs);
    this.loaded = false;
  }

  /**
   * Packs the content of the extension in a crx file.
   *
   * @example
   *
   * crx.pack().then(function(crxContent){
   *  // do something with the crxContent binary data
   * });
   *
   */
  async pack(contentsBuffer?: Buffer): Promise<Buffer> {
    if (!this.loaded) {
      return this.load().then(this.pack.bind(this, contentsBuffer));
    }

    const publicKey = await this.generatePublicKey();
    const contents = contentsBuffer ?? await this.loadContents();

    this.publicKey = publicKey;

    if (this.version === 2) {
      return crx2(this.privateKey!, publicKey, contents);
    }

    return crx3(this.privateKey!, publicKey, contents);
  }

  /**
   * Loads extension manifest and copies its content to a workable path.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async load(path: string | string[] = this.rootDirectory): Promise<ChromeExtension> {
    const metadata = resolve(path);
    this.path = metadata.path;
    this.src = metadata.src;

    const manifestPath = join(this.path, "manifest.json");

    this.manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as BrowserManifest;
    this.loaded = true;

    return this;
  }

  /**
   * Generates a public key.
   *
   * BC BREAK `this.publicKey` is not stored anymore (since 1.0.0)
   * BC BREAK callback parameter has been removed in favor to the promise interface.
   *
   * @returns Resolves to {Buffer} containing the public key
   * @example
   *
   * crx.generatePublicKey(function(publicKey){
   *   // do something with publicKey
   * });
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async generatePublicKey(): Promise<Buffer> {
    const privateKey = this.privateKey;

    if (!privateKey) {
      throw new Error("Impossible to generate a public key: privateKey option has not been defined or is empty.");
    }

    const key = crypto.createPublicKey(privateKey);

    return key.export({ type: "spki", format: "der" });
  }

  /**
   * BC BREAK `this.contents` is not stored anymore (since 1.0.0)
   */
  loadContents(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const archive = archiver("zip", { zlib: { level: 9 } });
      let contents = Buffer.from("");

      if (!this.loaded) {
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

      void archive
        .glob(this.src, {
          cwd: this.path,
          matchBase: true,
          ignore: ["*.pem", ".git", ...this.ignore],
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
   * @param keyOrPath the public key to use to generate the app ID
   */
  generateAppId(keyOrPath: Buffer | string | undefined = this.publicKey): string {
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

        keyOrPath = Buffer.from(keyOrPath, "utf16le");
      }
    }

    return crypto
      .createHash("sha256")
      .update(keyOrPath)
      .digest()
      .toString("hex")
      .split("")
      .map((x) => (parseInt(x, 16) + 0x0a).toString(26))
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
   * [Chrome Extensions APIs]{@link https://developer.chrome.com/extensions/api_index}
   * [Chrome verions]{@link https://en.wikipedia.org/wiki/Google_Chrome_version_history}
   * [Chromium switches to CRX3]{@link https://chromium.googlesource.com/chromium/src.git/+/b8bc9f99ef4ad6223dfdcafd924051561c05ac75}
   */
  generateUpdateXML(): Buffer {
    if (!this.codebase) {
      throw new Error("No URL provided for update.xml.");
    }
    if (!this.loaded) {
      throw new Error(
        "crx.load needs to be called first in order to generate update.xml.",
      );
    }

    const browserVersion = this.manifest!.minimum_chrome_version
      ?? (this.version < 3 ? "29.0.0" : undefined) // Earliest version with extensions API
      ?? "64.0.3242"; // Chrome started generating CRX3 packages

    return Buffer.from(`<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${this.appId ?? this.generateAppId()}'>
    <updatecheck codebase='${this.codebase}' version='${this.manifest!.version}' prodversionmin='${browserVersion}' />
  </app>
</gupdate>`);
  }
}

export { ChromeExtension as default, ChromeExtension as "module.exports" };
