import type Pbf from "pbf";

interface CrxFileHeader {
  sha256_with_rsa?: AsymmetricKeyProof[];
  sha256_with_ecdsa?: AsymmetricKeyProof[];
  signed_header_data?: Uint8Array;
}
export function readCrxFileHeader(pbf: Pbf, end?: number): CrxFileHeader;
export function writeCrxFileHeader(obj: CrxFileHeader, pbf: Pbf): void;

interface AsymmetricKeyProof {
  public_key?: Uint8Array;
  signature?: Uint8Array;
}
export function readAsymmetricKeyProof(pbf: Pbf, end?: number): AsymmetricKeyProof;
export function writeAsymmetricKeyProof(obj: AsymmetricKeyProof, pbf: Pbf): void;

interface SignedData {
  crx_id?: Uint8Array;
}
export function readSignedData(pbf: Pbf, end?: number): SignedData;
export function writeSignedData(obj: SignedData, pbf: Pbf): void;
