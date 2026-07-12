import { auth } from "../lib/auth.js";
import { resolveBranchScopeFromSession } from "../lib/branch-scope.js";

export async function attachSessionScope(req, res, next) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });
    req.session = session;
    req.branchScope = await resolveBranchScopeFromSession(session);
  } catch {
    req.session = null;
    req.branchScope = {
      authenticated: false,
      seesAllBranches: true,
      branchId: null,
      user: null,
    };
  }
  next();
}
