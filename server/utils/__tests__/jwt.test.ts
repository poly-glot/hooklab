import { assert, assertEquals } from "@std/assert";
import { decodeBase64 } from "@std/encoding/base64";
import { encodeBase64Url } from "@std/encoding/base64url";
import { GOOGLE_CERTS_URL, GOOGLE_OIDC_CERTS_URL } from "../../config.ts";
import { verifyRS256Signature } from "../jwt.ts";

const KID = "scheduler-test-kid";

const CERT_PEM = `
-----BEGIN CERTIFICATE-----
MIIDETCCAfmgAwIBAgIUfuOB1mtHFKuDnxV+DhZfNG+A9q4wDQYJKoZIhvcNAQEL
BQAwFzEVMBMGA1UEAwwMaG9va2xhYi10ZXN0MCAXDTI2MTAwMjE5MzExNFoYDzIx
MjYwOTA4MTkzMTE0WjAXMRUwEwYDVQQDDAxob29rbGFiLXRlc3QwggEiMA0GCSqG
SIb3DQEBAQUAA4IBDwAwggEKAoIBAQDRZyJVL8KK+UHFcv7d+sn09gua/HFFmTwW
HqKCXCdKwf8rsUcmJLZShwVlJNd/GahBEi9kueYR4ukMP5kv658ljSio5rc7g8T+
5rFWAffqOqN9tvUoCdMwZZhRuJQo/Wnb4PBhu+4PChcKRfH/UulsNgMLaEQFLhlI
sUpNL6gYNtCBvtssybDXe9XmDH62gQYtGXhdYu6Da2yvoCRnHyvir2P1RLGTns4k
uHJIQX8ZM3nvnW0C0LxTKbHFpsvoHMNnOGl4/Lr4PxhUgop4PGrS39lE5KKmnAx9
mfb60p5l/MCvvIbF78GnDsduFTwRKi9tInZadIK9XThZlKUkCYXDAgMBAAGjUzBR
MB0GA1UdDgQWBBQETTKIEWzAUYtlL8kJHSokLik3ZzAfBgNVHSMEGDAWgBQETTKI
EWzAUYtlL8kJHSokLik3ZzAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUA
A4IBAQB2CZj6NqkmX6jL7DU4frZ0Nsg0CVxBEljYshwGkzhPyPi80uOfOr1li3hI
AB4UqvMxcDABP2XyltRXlerXw0Hriz1Q6fjgtK3vpOF2P/jFKR0E2eIdOPAy4u7R
LUEKMbBSRo9D+bz0jQVGN9rpNCDOHtLFrUSoAh+x/mVFoY4plk8QmyRFfnzISUQh
aGpvBZfCsD745/p3RF2j1hcNP+Oz+pzkR30mQzYb8BCsBWyA16u6BSKgRuavn62E
4BG989tnEDIvd2Y0E9V6LBx2HorbEQ9aLa59BTgpsxptXoOM1t8dzDUmWhSB/XvD
b3+BNsiRIFA4tsuYsJ7wzM6bWrQh
-----END CERTIFICATE-----
`;

const PRIVATE_KEY_PEM = `
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDRZyJVL8KK+UHF
cv7d+sn09gua/HFFmTwWHqKCXCdKwf8rsUcmJLZShwVlJNd/GahBEi9kueYR4ukM
P5kv658ljSio5rc7g8T+5rFWAffqOqN9tvUoCdMwZZhRuJQo/Wnb4PBhu+4PChcK
RfH/UulsNgMLaEQFLhlIsUpNL6gYNtCBvtssybDXe9XmDH62gQYtGXhdYu6Da2yv
oCRnHyvir2P1RLGTns4kuHJIQX8ZM3nvnW0C0LxTKbHFpsvoHMNnOGl4/Lr4PxhU
gop4PGrS39lE5KKmnAx9mfb60p5l/MCvvIbF78GnDsduFTwRKi9tInZadIK9XThZ
lKUkCYXDAgMBAAECggEAAcj4nfPzm0Osr9uJw1KpThFFiriu2S0JOhcLbkO4LLGi
qeNaUT+W3kqQXTWx2z+DaP/tWip2L54uO7spuc2EZHQ47deppYmQsFY/GhXs4G5H
iSwkwtvylO2zcrQ5bxqvQFSWjVQQyh1dPOqDuZgiApjN8IGfCCbwcueFU/XICmIe
m9g4F9WNEv7dqBhavYT2aECMykzneeCcQwAx3G2BwRzlKN/lp5m0gJbLC8Mz1QzN
2n3m+yiiELlxC3I7kP8G89UtXMN1crO3FozSxSfeagHeppWs44rBkr0f4+k+EVRw
1sl5ekxY3+UHj3csY1S3vFhhNzEa7gaG39UYHdNHoQKBgQD8pURfJ8dOu2Oj/qoY
uwJwu562RWNOsV0doAqkAWZotvMAjjMyFz+E/Blp4LWWaNpgRnEOZx5hK+/Z2nep
krSXEiV5wQfrZQnpHGxEyMhDyKlwqYmo8xNqibPCvEuk30/6mMJ+Xkh/mNLCeebM
HZIkasj5p8D7Ca2yD//pWBdsrQKBgQDULuL9hciI9j3G2QVzyYfINXhylRVqnNxz
SWry+d5BDc5JiqHAetUoVigPLRWQl54IQ9zg3xTGEDwWcVHNJmUkTRJjhrOlCdDG
UJEVu6+dUi2Nqxdl5cvwseY4qFGGGCkH0XypMkXhaQI54dI/JcxnZA2fG/K17HM8
f/j1HN8aLwKBgEGcuhDsR7qOt+XTMWGSz6NvVlyH0K6TKVeURK8rHel7+cffJjSQ
DRMAValFjmMtf+kY4iuXZDBgNL4jGoiTbQr+z3S7SM89QkGj/AoxCrFv33E+1l1m
I1i7wk+EjzCWPjMakQg4fCOHENUoy2OfGmESynbrthZ8APwJY7C6C/tRAoGAAhxl
TbhjAlnQy4WlND2xCCDgDePFzsW4u7zjP3+U4njMsJacfVm7fSc+RshgCow3mkVy
kRonDsFil6aQ9cWIBBBwOmVArEeouBBdISY43QvQQDSPiwf6O27Jp46lIPxkjBtd
biF96Hwu9Xx1pwMtQWoRaJ/SjlTH4LY1N9sNrSkCgYEApYL5DS79XkVupIwuV/cS
cOxQx5AS5M9nE9Hj/t4KUu5Ezgtamxm1OJbFOR/S6FJt//1f8PLhlhNYR2xSj08b
LlKFeaCCv4T3fsRYhxkgiAbn9Xax37DcvTvlaf+MJqUi51vx+3idg4SHTx4JZLZ9
9JHudCUMCiGYZIy0I9orEpc=
-----END PRIVATE KEY-----
`;

const certsByUrl: Record<string, Record<string, string>> = {
  [GOOGLE_OIDC_CERTS_URL]: { [KID]: CERT_PEM.trim() },
  [GOOGLE_CERTS_URL]: {},
};

globalThis.fetch = (input: string | URL | Request) =>
  Promise.resolve(Response.json(certsByUrl[String(input)] ?? {}));

async function signToken(payload: Record<string, unknown>): Promise<string> {
  const der = decodeBase64(PRIVATE_KEY_PEM.replace(/-----[^-]+-----|\s/g, ""));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const encode = (part: unknown) => encodeBase64Url(new TextEncoder().encode(JSON.stringify(part)));
  const signingInput = `${encode({ alg: "RS256", kid: KID, typ: "JWT" })}.${encode(payload)}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));

  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
}

const schedulerPayload = {
  aud: "https://hooklab-api.example/api/internal",
  email: "hooklab-runtime@example.iam.gserviceaccount.com",
  exp: Math.floor(Date.now() / 1000) + 300,
  iss: "https://accounts.google.com",
};

Deno.test("scheduler OIDC token verifies against Google OAuth2 certs", async () => {
  const result = await verifyRS256Signature(await signToken(schedulerPayload), GOOGLE_OIDC_CERTS_URL);

  assert(result);
  assertEquals(result.payload.email, schedulerPayload.email);
});

Deno.test("scheduler OIDC token is unknown to the Firebase securetoken certs", async () => {
  const result = await verifyRS256Signature(await signToken(schedulerPayload), GOOGLE_CERTS_URL);

  assertEquals(result, null);
});

Deno.test("tampered payload fails signature verification", async () => {
  const [header, , signature] = (await signToken(schedulerPayload)).split(".");
  const forged = encodeBase64Url(new TextEncoder().encode(JSON.stringify({ ...schedulerPayload, email: "attacker@example.com" })));

  assertEquals(await verifyRS256Signature(`${header}.${forged}.${signature}`, GOOGLE_OIDC_CERTS_URL), null);
});
