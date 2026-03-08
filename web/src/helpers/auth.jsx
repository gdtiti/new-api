/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const POST_LOGIN_REDIRECT_KEY = 'post_login_redirect';
const DEFAULT_PORTAL_HOME = '/app/overview';
const AUTH_PAGE_PREFIXES = ['/login', '/register', '/reset', '/user/reset'];

export function authHeader() {
  // return authorization header with jwt token
  let user = JSON.parse(localStorage.getItem('user'));

  if (user && user.token) {
    return { Authorization: 'Bearer ' + user.token };
  } else {
    return {};
  }
}

function buildTargetPath(locationLike) {
  if (!locationLike) return '';
  if (typeof locationLike === 'string') return locationLike;
  const pathname = locationLike.pathname || '';
  const search = locationLike.search || '';
  const hash = locationLike.hash || '';
  return `${pathname}${search}${hash}`;
}

export function getDefaultAuthenticatedHome(rawUser) {
  let user = rawUser;
  if (typeof rawUser === 'string') {
    try {
      user = JSON.parse(rawUser);
    } catch (e) {
      user = null;
    }
  }

  if (user && typeof user.role === 'number' && user.role >= 10) {
    return '/console';
  }

  return DEFAULT_PORTAL_HOME;
}

export function sanitizeAuthTarget(target, fallback = DEFAULT_PORTAL_HOME) {
  if (!target || typeof target !== 'string') {
    return fallback;
  }

  if (!target.startsWith('/')) {
    return fallback;
  }

  const isAuthPage = AUTH_PAGE_PREFIXES.some(
    (prefix) => target === prefix || target.startsWith(`${prefix}?`),
  );

  if (isAuthPage || target.startsWith('/oauth/')) {
    return fallback;
  }

  return target;
}

export function rememberPostLoginRedirect(target) {
  const safeTarget = sanitizeAuthTarget(buildTargetPath(target), '');
  if (safeTarget) {
    localStorage.setItem(POST_LOGIN_REDIRECT_KEY, safeTarget);
  }
}

export function consumePostLoginRedirect(fallback = DEFAULT_PORTAL_HOME) {
  const storedTarget = localStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  return sanitizeAuthTarget(storedTarget, fallback);
}

export function resolvePostLoginTarget(user, locationState, fallbackTarget) {
  const fallback = fallbackTarget || getDefaultAuthenticatedHome(user);
  const stateTarget = sanitizeAuthTarget(
    buildTargetPath(locationState?.from),
    '',
  );

  if (stateTarget) {
    localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    return stateTarget;
  }

  return consumePostLoginRedirect(fallback);
}

export const AuthRedirect = ({ children }) => {
  const user = localStorage.getItem('user');
  const location = useLocation();

  if (user) {
    return (
      <Navigate
        to={resolvePostLoginTarget(user, location.state)}
        replace
      />
    );
  }

  return children;
};

function PrivateRoute({ children }) {
  const location = useLocation();
  if (!localStorage.getItem('user')) {
    rememberPostLoginRedirect(location);
    return <Navigate to='/login' state={{ from: location }} replace />;
  }
  return children;
}

export function AdminRoute({ children }) {
  const location = useLocation();
  const raw = localStorage.getItem('user');
  if (!raw) {
    rememberPostLoginRedirect(location);
    return <Navigate to='/login' state={{ from: location }} replace />;
  }
  try {
    const user = JSON.parse(raw);
    if (user && typeof user.role === 'number' && user.role >= 10) {
      return children;
    }
  } catch (e) {
    // ignore
  }
  return <Navigate to='/forbidden' replace />;
}

export { PrivateRoute };
