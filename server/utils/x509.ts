/**
 * Minimal X.509 certificate utilities.
 *
 * Extracts SubjectPublicKeyInfo (SPKI) from DER-encoded X.509 certificates
 * and imports them as CryptoKeys for RS256 signature verification.
 */

import { decodeBase64 } from "@std/encoding/base64";

/**
 * Imports a public key from a PEM-encoded X.509 certificate.
 *
 * Strips PEM headers, decodes base64, extracts the SPKI block,
 * and imports it as a CryptoKey for RS256 verification.
 *
 * @param pem - PEM-encoded X.509 certificate string
 * @returns CryptoKey for RSA signature verification
 */
export async function importPublicKey(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s/g, "");
  const der = decodeBase64(b64);
  const spki = extractSPKI(der);

  return crypto.subtle.importKey(
    "spki",
    spki.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

/**
 * Extract SubjectPublicKeyInfo from a DER-encoded X.509 certificate.
 *
 * Walks the ASN.1 structure:
 *   SEQUENCE (certificate)
 *     SEQUENCE (tbsCertificate)
 *       version, serial, algorithm, issuer, validity, subject,
 *       SEQUENCE (subjectPublicKeyInfo) ← extracted
 */
function extractSPKI(cert: Uint8Array): Uint8Array {
  let offset = 0;

  function readTag(): { tag: number; length: number; start: number } {
    const tag = cert[offset++];
    let length = cert[offset++];

    if (length & 0x80) {
      const numBytes = length & 0x7f;
      length = 0;
      for (let i = 0; i < numBytes; i++) {
        length = (length << 8) | cert[offset++];
      }
    }

    return { tag, length, start: offset };
  }

  function skipElement(): void {
    const { length } = readTag();
    offset += length;
  }

  // Outer SEQUENCE (Certificate)
  readTag();
  // TBSCertificate SEQUENCE
  readTag();

  // Version [0] EXPLICIT — optional
  if (cert[offset] === 0xa0) {
    skipElement();
  }

  skipElement(); // serialNumber
  skipElement(); // signature algorithm
  skipElement(); // issuer
  skipElement(); // validity
  skipElement(); // subject

  // subjectPublicKeyInfo SEQUENCE — capture the whole element
  const spkiStart = offset;
  const spkiHeader = readTag();
  const spkiEnd = offset + spkiHeader.length;

  return cert.slice(spkiStart, spkiEnd);
}
