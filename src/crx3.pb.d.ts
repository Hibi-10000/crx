import type { PbfWriter } from "pbf";

interface CrxFileHeader {
  sha256_with_rsa?: AsymmetricKeyProof[];
  sha256_with_ecdsa?: AsymmetricKeyProof[];
  verified_contents?: Uint8Array;
  signed_header_data?: Uint8Array;
}
export function readCrxFileHeader(pbf: PbfWriter, end?: number): CrxFileHeader;
export function writeCrxFileHeader(obj: CrxFileHeader, pbf: PbfWriter): void;

interface AsymmetricKeyProof {
  public_key?: Uint8Array;
  signature?: Uint8Array;
}
export function readAsymmetricKeyProof(pbf: PbfWriter, end?: number): AsymmetricKeyProof;
export function writeAsymmetricKeyProof(obj: AsymmetricKeyProof, pbf: PbfWriter): void;

interface SignedData {
  crx_id?: Uint8Array;
}
export function readSignedData(pbf: PbfWriter, end?: number): SignedData;
export function writeSignedData(obj: SignedData, pbf: PbfWriter): void;
