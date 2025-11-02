"use strict";

import crypto from "node:crypto";

/**
 * Generates and returns a signed package from extension content.
 *
 * BC BREAK `this.package` is not stored anymore (since 1.0.0)
 *
 * @param {Buffer} signature
 * @param {Buffer} publicKey
 * @param {Buffer} contents
 * @returns {Buffer}
 */
export default function generatePackage(privateKey, publicKey, contents) {
  const signature = generateSignature(privateKey, contents);

  const keyLength = publicKey.length;
  const sigLength = signature.length;
  const zipLength = contents.length;
  const length = 16 + keyLength + sigLength + zipLength;

  const crx = Buffer.alloc(length);

  crx.write("Cr24" + new Array(13).join("\x00"), "binary");

  crx[4] = 2;
  crx.writeUInt32LE(keyLength, 8);
  crx.writeUInt32LE(sigLength, 12);

  publicKey.copy(crx, 16);
  signature.copy(crx, 16 + keyLength);
  contents.copy(crx, 16 + keyLength + sigLength);

  return crx;
};

/**
 * Generates a SHA1 package signature.
 *
 * BC BREAK `this.signature` is not stored anymore (since 1.0.0)
 *
 * @param {Buffer} privateKey
 * @param {Buffer} contents
 * @returns {Buffer}
 */
function generateSignature(privateKey, contents) {
  return Buffer.from(
    crypto
      .createSign("sha1")
      .update(contents)
      .sign(privateKey),
    "binary",
  );
}
