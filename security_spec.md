# Security Specification - WSS_TechLink V.1.0

## 1. Data Invariants
- **Authentication**: Users must be signed in with a Google account (`request.auth != null`) and their email must be verified.
- **Onsite Service Tickets**: `createdAt` is immutable; `updatedAt` is synchronized to the server time on update.
- **Oncall Service Tickets**: `createdAt` is immutable; `updatedAt` is synchronized to the server time on update.
- **Product Claim Tickets**: `createdAt` is immutable; `updatedAt` is synchronized to the server time on update.
- **Customers**: `createdAt` is immutable; `updatedAt` is synchronized to the server time on update.
- **Settings**: Configuration lists must only be modified by authenticated, verified users.

## 2. The "Dirty Dozen" Payloads (Identity, Integrity, and State Violations)
We list twelve malicious payloads targeting our Firestore collections that must be rejected (`PERMISSION_DENIED`).

1. **Unauthenticated Write (Onsite)**: Attempting to write a ticket without being signed in.
2. **Email Unverified Write**: Attempting to create a ticket while `request.auth.token.email_verified` is `false`.
3. **Owner Impersonation**: Setting `ownerId` to another user's UID.
4. **Id Poisoning**: Injecting an extremely long ID containing invalid characters (e.g., `../../../hacking`).
5. **Denial of Wallet (Huge String)**: Setting fields like `companyName` or `symptomReport` to a 5MB string.
6. **State Shortcut**: Setting `status` to an invalid value (e.g., `status: "SuperCompleted"`).
7. **Immutable Field Modification**: Overwriting `createdAt` with a backdated timestamp on update.
8. **Malicious Settings Injection**: Injecting a custom script or a 1MB string into the settings list.
9. **Claim Status Lock Bypass**: Attempting to overwrite a terminal-status claim ticket without proper validation.
10. **Customer Duplicate/Orphan**: Creating a customer document with an invalid non-alphanumeric ID.
11. **Blanket Read Request**: An unauthenticated user attempting to list all customer data.
12. **Array Poisoning**: Injecting non-string entries or massive arrays into `photos` list in `onsite_services`.

## 3. The Test Runner (`firestore.rules.test.ts`)
Below is the TypeScript code structure for testing these rules.

```typescript
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";

describe("WSS_TechLink Firebase Security Rules", () => {
  let testEnv;

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "distinguished-flames-qd2jw",
      firestore: {
        host: "localhost",
        port: 8080,
      },
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it("should block unauthenticated writes to onsite_services", async () => {
    const context = testEnv.unauthenticatedContext();
    const db = context.firestore();
    await assertFails(db.collection("onsite_services").add({
      companyName: "Acme",
      status: "Pending",
    }));
  });

  it("should block unverified email writes to onsite_services", async () => {
    const context = testEnv.authenticatedContext("user_1", {
      email: "user@example.com",
      email_verified: false,
    });
    const db = context.firestore();
    await assertFails(db.collection("onsite_services").add({
      companyName: "Acme",
      status: "Pending",
    }));
  });
});
```
