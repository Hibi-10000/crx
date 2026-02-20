"use strict";

import path from "node:path";

interface PathMetadata {
  path: string;
  src: string;
}

export default function resolve(pathOrFiles: string | string[]): PathMetadata {
  // legacy and original mode
  if (typeof pathOrFiles === "string") {
    return {
      path: path.resolve(pathOrFiles),
      src: "**",
    };
  }

  // new mode, with a list of files
  else if (Array.isArray(pathOrFiles)) {
    let manifestFile = "";

    pathOrFiles.some((f) => {
      if (/(^|\/)manifest.json$/.test(f)) {
        manifestFile = f;
        return true;
      }
    });

    if (!manifestFile) {
      throw new Error("Unable to locate a manifest file in your list of files.");
    }

    const manifestDir = path.dirname(manifestFile);

    return {
      path: path.resolve(manifestDir),
      src: `{${
        pathOrFiles
          .map((f) => {
            return path.relative(manifestDir, f);
          })
          .join(",")
      }}`,
    };
  }

  //
  else {
    throw new Error(
      "load path is none of a folder location nor a list of files to pack",
    );
  }
};
