import assert from "node:assert/strict";
import test from "node:test";
import { homeFor, routeFor } from "../src/lib/auth-routing.ts";

test("signed-out visitors are redirected to login from both protected pages", () => {
  for (const path of ["/", "/customer/tickets", "/staff/inbox", "/login"])
    assert.equal(routeFor(null, path), "/login");
});
test("customers go to their ticket list, including when opening a staff URL", () => {
  assert.equal(homeFor("customer"), "/customer/tickets");
  for (const path of ["/login", "/", "/staff/inbox", "/customer/tickets"])
    assert.equal(routeFor("customer", path), "/customer/tickets");
});
test("staff go to their inbox, including when opening a customer URL", () => {
  assert.equal(homeFor("staff"), "/staff/inbox");
  for (const path of ["/login", "/", "/customer/tickets", "/staff/inbox"])
    assert.equal(routeFor("staff", path), "/staff/inbox");
});
