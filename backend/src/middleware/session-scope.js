import { auth } from "../lib/auth.js";
import { resolveBranchScopeFromSession } from "../lib/portfolio-scope.js";
import { createHash } from "node:crypto";

const scopeCache = new Map();
const SCOPE_CACHE_MS = 10_000;
const MAX_SCOPE_CACHE = 500;
const responseCache = new Map();
const RESPONSE_CACHE_MS = 5 * 60 * 1000;
const MAX_RESPONSE_CACHE = 2_000;

function requestKey(req) {
  const identity = req.headers.cookie || req.headers.authorization;
  return identity ? createHash("sha256").update(identity).digest("hex") : "anonymous";
}

async function resolveCachedScope(req) {
  const key = requestKey(req);
  const cached = scopeCache.get(key);
  if (cached && Date.now() - cached.createdAt < SCOPE_CACHE_MS) return cached.promise;

  const promise = (async () => {
    const session = await auth.api.getSession({ headers: req.headers });
    return { session, scope: await resolveBranchScopeFromSession(session) };
  })();
  scopeCache.set(key, { createdAt: Date.now(), promise });
  promise.catch(() => scopeCache.delete(key));

  if (scopeCache.size > MAX_SCOPE_CACHE) {
    const oldest = scopeCache.keys().next().value;
    scopeCache.delete(oldest);
  }
  return promise;
}

export async function attachSessionScope(req, res, next) {
  const isRead = req.method === "GET";
  const cacheKey = isRead ? `${requestKey(req)}:${req.originalUrl}` : null;
  if (cacheKey) {
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < RESPONSE_CACHE_MS) {
      res.set("X-Cache", "HIT");
      return res.status(cached.status).json(cached.body);
    }
  } else {
    responseCache.clear();
  }

  try {
    const { session, scope } = await resolveCachedScope(req);
    req.session = session;
    req.branchScope = scope;
  } catch {
    req.session = null;
    req.branchScope = {
      authenticated: false,
      seesAllBranches: true,
      portfolioId: null,
      user: null,
    };
  }

  if (cacheKey) {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400) {
        responseCache.set(cacheKey, {
          createdAt: Date.now(),
          status: res.statusCode,
          body,
        });
        if (responseCache.size > MAX_RESPONSE_CACHE) {
          responseCache.delete(responseCache.keys().next().value);
        }
      }
      res.set("X-Cache", "MISS");
      return originalJson(body);
    };
  }
  next();
}
