/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { apiFetch, getStoredToken, setStoredToken } from './utils/api';
import type { UserRecord } from './types';
import { PublicPortal } from './components/PublicPortal';
import { WorkspaceLayout } from './components/WorkspaceLayout';

export default function App() {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setCheckingAuth(false);
      return;
    }

    apiFetch<{ user: UserRecord }>('/api/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => {
        setStoredToken(null);
        setUser(null);
      })
      .finally(() => setCheckingAuth(false));
  }, []);

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setStoredToken(null);
    setUser(null);
  }

  if (checkingAuth) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
        <img
          src="/assets/aistudio/images__1__1__c9cae615.jpeg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 h-full w-full object-cover object-[center_22%]"
        />
        <div className="glass-card relative z-10 rounded-2xl px-6 py-4 text-sm font-semibold text-white">
          የሰንበት ትምህርት ቤት መድረክ በመከፈት ላይ ነው...
        </div>
      </div>
    );
  }

  if (!user) {
    return <PublicPortal onAuthenticated={(u) => setUser(u)} />;
  }

  return (
    <WorkspaceLayout
      currentUser={user}
      onUserUpdated={(u) => setUser(u)}
      onLogout={handleLogout}
    />
  );
}
