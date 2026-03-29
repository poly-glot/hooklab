/**
 * Security tests for Deno Worker sandbox
 *
 * These tests verify that Deno's permission model properly isolates
 * user scripts and prevents access to dangerous APIs.
 */

import { assertEquals } from "@std/assert";

Deno.test("Worker Security - Deno namespace is undefined", async () => {
  const worker = new Worker(
    new URL("../sandbox.worker.ts", import.meta.url).href,
    {
      type: "module",
      // @ts-ignore: Deno-specific worker options
      deno: {
        permissions: {
          net: false,
          read: false,
          write: false,
          env: false,
          run: false,
          ffi: false,
          sys: false,
          hrtime: false,
        },
      },
    }
  );

  const result = await new Promise((resolve) => {
    worker.onmessage = (e) => {
      worker.terminate();
      resolve(e.data);
    };

    worker.postMessage({
      script: `
        const denoType = typeof Deno;
        return {
          status: 200,
          body: JSON.stringify({ denoType })
        };
      `,
      request: {
        method: "POST",
        headers: {},
        query: {},
        body: "",
        url: "http://test",
      },
    });
  });

  // @ts-ignore: result type
  const body = JSON.parse(result.response.body);
  assertEquals(body.denoType, "undefined", "Deno namespace should be undefined");
});

Deno.test("Worker Security - fetch is undefined", async () => {
  const worker = new Worker(
    new URL("../sandbox.worker.ts", import.meta.url).href,
    {
      type: "module",
      // @ts-ignore: Deno-specific worker options
      deno: {
        permissions: {
          net: false,
          read: false,
          write: false,
          env: false,
          run: false,
          ffi: false,
          sys: false,
          hrtime: false,
        },
      },
    }
  );

  const result = await new Promise((resolve) => {
    worker.onmessage = (e) => {
      worker.terminate();
      resolve(e.data);
    };

    worker.postMessage({
      script: `
        const fetchType = typeof fetch;
        return {
          status: 200,
          body: JSON.stringify({ fetchType })
        };
      `,
      request: {
        method: "POST",
        headers: {},
        query: {},
        body: "",
        url: "http://test",
      },
    });
  });

  // @ts-ignore: result type
  const body = JSON.parse(result.response.body);
  assertEquals(body.fetchType, "undefined", "fetch should be undefined");
});

Deno.test("Worker Security - globalThis has no dangerous APIs", async () => {
  const worker = new Worker(
    new URL("../sandbox.worker.ts", import.meta.url).href,
    {
      type: "module",
      // @ts-ignore: Deno-specific worker options
      deno: {
        permissions: {
          net: false,
          read: false,
          write: false,
          env: false,
          run: false,
          ffi: false,
          sys: false,
          hrtime: false,
        },
      },
    }
  );

  const result = await new Promise((resolve) => {
    worker.onmessage = (e) => {
      worker.terminate();
      resolve(e.data);
    };

    worker.postMessage({
      script: `
        // Try to access globalThis
        const global = Function('return this')();
        return {
          status: 200,
          body: JSON.stringify({
            hasDeno: typeof global.Deno,
            hasFetch: typeof global.fetch,
            hasImportScripts: typeof global.importScripts
          })
        };
      `,
      request: {
        method: "POST",
        headers: {},
        query: {},
        body: "",
        url: "http://test",
      },
    });
  });

  // @ts-ignore: result type
  const body = JSON.parse(result.response.body);
  assertEquals(body.hasDeno, "undefined");
  assertEquals(body.hasFetch, "undefined");
  assertEquals(body.hasImportScripts, "undefined");
});

Deno.test("Worker Security - safe APIs are available", async () => {
  const worker = new Worker(
    new URL("../sandbox.worker.ts", import.meta.url).href,
    {
      type: "module",
      // @ts-ignore: Deno-specific worker options
      deno: {
        permissions: {
          net: false,
          read: false,
          write: false,
          env: false,
          run: false,
          ffi: false,
          sys: false,
          hrtime: false,
        },
      },
    }
  );

  const result = await new Promise((resolve) => {
    worker.onmessage = (e) => {
      worker.terminate();
      resolve(e.data);
    };

    worker.postMessage({
      script: `
        return {
          status: 200,
          body: JSON.stringify({
            hasJSON: typeof JSON,
            hasMath: typeof Math,
            hasDate: typeof Date,
            hasArray: typeof Array,
            hasObject: typeof Object
          })
        };
      `,
      request: {
        method: "POST",
        headers: {},
        query: {},
        body: "",
        url: "http://test",
      },
    });
  });

  // @ts-ignore: result type
  const body = JSON.parse(result.response.body);
  assertEquals(body.hasJSON, "object");
  assertEquals(body.hasMath, "object");
  assertEquals(body.hasDate, "function");
  assertEquals(body.hasArray, "function");
  assertEquals(body.hasObject, "function");
});

Deno.test("Worker Security - timeout is enforced", async () => {
  const worker = new Worker(
    new URL("../sandbox.worker.ts", import.meta.url).href,
    {
      type: "module",
      // @ts-ignore: Deno-specific worker options
      deno: {
        permissions: {
          net: false,
          read: false,
          write: false,
          env: false,
          run: false,
          ffi: false,
          sys: false,
          hrtime: false,
        },
      },
    }
  );

  const result = await new Promise((resolve) => {
    worker.onmessage = (e) => {
      worker.terminate();
      resolve(e.data);
    };

    // Script that runs forever
    worker.postMessage({
      script: `
        while(true) { /* infinite loop */ }
        return { status: 200, body: "never" };
      `,
      request: {
        method: "POST",
        headers: {},
        query: {},
        body: "",
        url: "http://test",
      },
    });
  });

  // @ts-ignore: result type
  assertEquals(result.success, false);
  // @ts-ignore: result type
  assertEquals(result.error.includes("timed out"), true);
});

Deno.test("Worker Security - request object is frozen", async () => {
  const worker = new Worker(
    new URL("../sandbox.worker.ts", import.meta.url).href,
    {
      type: "module",
      // @ts-ignore: Deno-specific worker options
      deno: {
        permissions: {
          net: false,
          read: false,
          write: false,
          env: false,
          run: false,
          ffi: false,
          sys: false,
          hrtime: false,
        },
      },
    }
  );

  const result = await new Promise((resolve) => {
    worker.onmessage = (e) => {
      worker.terminate();
      resolve(e.data);
    };

    worker.postMessage({
      script: `
        let canModify = false;
        try {
          request.method = "HACKED";
          canModify = true;
        } catch (e) {
          canModify = false;
        }
        return {
          status: 200,
          body: JSON.stringify({ canModify, actualMethod: request.method })
        };
      `,
      request: {
        method: "POST",
        headers: {},
        query: {},
        body: "",
        url: "http://test",
      },
    });
  });

  // @ts-ignore: result type
  const body = JSON.parse(result.response.body);
  assertEquals(body.canModify, false, "Request should be immutable");
  assertEquals(body.actualMethod, "POST", "Method should remain unchanged");
});

Deno.test("Worker Security - script size limit enforced (bytes)", async () => {
  const worker = new Worker(
    new URL("../sandbox.worker.ts", import.meta.url).href,
    {
      type: "module",
      // @ts-ignore: Deno-specific worker options
      deno: {
        permissions: {
          net: false,
          read: false,
          write: false,
          env: false,
          run: false,
          ffi: false,
          sys: false,
          hrtime: false,
        },
      },
    }
  );

  const result = await new Promise((resolve) => {
    worker.onmessage = (e) => {
      worker.terminate();
      resolve(e.data);
    };

    // Create a script larger than 65KB
    const largeScript = "const x = 1;\n".repeat(10000);

    worker.postMessage({
      script: largeScript,
      request: {
        method: "POST",
        headers: {},
        query: {},
        body: "",
        url: "http://test",
      },
    });
  });

  // @ts-ignore: result type
  assertEquals(result.success, false);
  // @ts-ignore: result type
  assertEquals(result.error.includes("too large"), true);
});
