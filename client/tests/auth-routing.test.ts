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
test("customer create/detail URLs stay protected and survive direct navigation", () => {
  for (const path of [
    "/customer/tickets/new",
    "/customer/tickets/20000000-0000-4000-8000-000000000001",
  ]) {
    assert.equal(routeFor("customer", path), path);
    assert.equal(routeFor(null, path), "/login");
    assert.equal(routeFor("staff", path), "/staff/inbox");
  }
  assert.equal(
    routeFor("customer", "/customer/tickets/not-a-uuid"),
    "/customer/tickets",
  );
});

test("registration is public and overview and profile require the matching role", () => {
  assert.equal(routeFor(null, "/register"), "/register");
  for (const role of ["customer", "staff"] as const) {
    assert.equal(routeFor(role, "/register"), homeFor(role));
    for (const page of ["overview", "profile"]) {
      assert.equal(routeFor(role, `/${role}/${page}`), `/${role}/${page}`);
      assert.equal(routeFor(null, `/${role}/${page}`), "/login");
    }
  }
});
